import fs from "node:fs/promises"
import path from "node:path"

const args = process.argv.slice(2)
const watchMode = args.includes("--watch")
const strictMode = args.includes("--strict")
const intervalArg = args.find((arg) => arg.startsWith("--interval="))
const intervalSeconds = Number(intervalArg?.split("=")[1] || 20)
const intervalMs = Number.isFinite(intervalSeconds) && intervalSeconds > 0 ? intervalSeconds * 1000 : 20_000

const FRONTEND_URL = process.env.OPS_FRONTEND_URL || "http://localhost:3002"
const BACKEND_URL = process.env.OPS_BACKEND_URL || "http://localhost:3000"
const REPORT_PATH = path.join(process.cwd(), "reports", "ops-runtime-health.jsonl")

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function nowIso() {
  return new Date().toISOString()
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.headers || {})
      }
    })
    return response
  } finally {
    clearTimeout(timer)
  }
}

function createCheck(name, ok, critical, details) {
  return { name, ok, critical, details }
}

async function checkJsonEndpoint(name, url, critical = true) {
  try {
    const response = await fetchWithTimeout(url)
    if (!response.ok) {
      return createCheck(name, false, critical, `HTTP ${response.status}`)
    }

    const json = await response.json().catch(() => null)
    if (!json) {
      return createCheck(name, false, critical, "JSON invalido")
    }

    return createCheck(name, true, critical, "ok")
  } catch (error) {
    return createCheck(name, false, critical, error?.message || "falha de rede")
  }
}

async function checkFrontendRoot() {
  try {
    const response = await fetchWithTimeout(FRONTEND_URL)
    return createCheck("frontend_root", response.ok, true, response.ok ? "ok" : `HTTP ${response.status}`)
  } catch (error) {
    return createCheck("frontend_root", false, true, error?.message || "falha de rede")
  }
}

async function checkProxyAsk() {
  try {
    const response = await fetchWithTimeout(`${FRONTEND_URL}/backend/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": "ops-check"
      },
      body: JSON.stringify({
        question: "healthcheck: responda apenas OK",
        context: {
          channel: "ops-runtime-check",
          probe: true
        }
      })
    }, 20_000)

    if (!response.ok) {
      const payload = await response.text().catch(() => "")
      return createCheck("proxy_ask", false, true, `HTTP ${response.status} ${payload.slice(0, 220)}`)
    }

    const payload = await response.json().catch(() => null)
    const answer = String(payload?.data?.response || payload?.response || payload?.answer || "").trim()
    if (!answer) {
      return createCheck("proxy_ask", false, true, "resposta vazia")
    }

    const contingency = /modo de contingencia|contingencia operacional|providers externos nao responderam/i.test(answer)
    if (contingency) {
      return createCheck("proxy_ask", false, true, "resposta em modo de contingencia")
    }

    return createCheck("proxy_ask", true, true, answer.slice(0, 80))
  } catch (error) {
    return createCheck("proxy_ask", false, true, error?.message || "falha de rede")
  }
}

async function checkProxyStream() {
  try {
    const response = await fetchWithTimeout(`${FRONTEND_URL}/backend/ask/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": "ops-check"
      },
      body: JSON.stringify({
        question: "healthcheck stream",
        context: {
          channel: "ops-runtime-check",
          probe: true
        }
      })
    }, 20_000)

    if (!response.ok || !response.body) {
      return createCheck("proxy_stream", false, false, `HTTP ${response.status}`)
    }

    const reader = response.body.getReader()
    const firstChunk = await reader.read()
    await reader.cancel().catch(() => { })

    const gotData = Boolean(firstChunk && !firstChunk.done && firstChunk.value?.length)
    return createCheck("proxy_stream", gotData, false, gotData ? "chunk recebido" : "sem chunk inicial")
  } catch (error) {
    return createCheck("proxy_stream", false, false, error?.message || "falha de rede")
  }
}

function summarizeProviders(config) {
  const providers = Array.isArray(config?.ai?.providers) ? config.ai.providers : []
  const ready = providers.filter((provider) => provider?.runtimeStatus === "ready")
  const degraded = providers.filter((provider) => provider?.runtimeStatus && provider.runtimeStatus !== "ready")

  return {
    providersCount: providers.length,
    readyCount: ready.length,
    degradedCount: degraded.length,
    degraded: degraded.map((provider) => `${provider.name}:${provider.runtimeStatus}`).join(", ")
  }
}

async function checkSupabase(config) {
  const url = String(config?.supabaseUrl || "").trim()
  const anon = String(config?.supabaseAnonKey || "").trim()

  if (!url || !anon) {
    return createCheck("supabase_health", false, false, "supabaseUrl/anonKey ausentes no /config")
  }

  try {
    const response = await fetchWithTimeout(`${url}/auth/v1/health`, {
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`
      }
    }, 15_000)

    if (!response.ok) {
      return createCheck("supabase_health", false, false, `HTTP ${response.status}`)
    }

    return createCheck("supabase_health", true, false, "ok")
  } catch (error) {
    return createCheck("supabase_health", false, false, error?.message || "falha de rede")
  }
}

async function runChecks() {
  const checks = []

  checks.push(await checkJsonEndpoint("backend_health", `${BACKEND_URL}/health`, true))
  checks.push(await checkJsonEndpoint("backend_config", `${BACKEND_URL}/config`, true))
  checks.push(await checkFrontendRoot())
  checks.push(await checkJsonEndpoint("frontend_proxy_config", `${FRONTEND_URL}/backend/config`, true))

  let backendConfig = null
  try {
    const response = await fetchWithTimeout(`${BACKEND_URL}/config`)
    backendConfig = response.ok ? await response.json().catch(() => null) : null
  } catch {
    backendConfig = null
  }

  const providerInfo = summarizeProviders(backendConfig)
  const providersReady = providerInfo.providersCount > 0 && providerInfo.readyCount > 0
  checks.push(
    createCheck(
      "providers_ready",
      providersReady,
      false,
      `ready=${providerInfo.readyCount}/${providerInfo.providersCount}${providerInfo.degraded ? ` | ${providerInfo.degraded}` : ""}`
    )
  )

  checks.push(await checkSupabase(backendConfig))
  checks.push(await checkProxyAsk())
  checks.push(await checkProxyStream())

  const criticalFailures = checks.filter((check) => check.critical && !check.ok)
  const warnings = checks.filter((check) => !check.critical && !check.ok)

  const summary = {
    timestamp: nowIso(),
    frontendUrl: FRONTEND_URL,
    backendUrl: BACKEND_URL,
    checks,
    criticalFailures: criticalFailures.length,
    warnings: warnings.length,
    strictMode
  }

  const shouldFail = criticalFailures.length > 0 || (strictMode && warnings.length > 0)
  return { summary, shouldFail }
}

function printSummary(summary) {
  console.log(`\n[OPS] Runtime check @ ${summary.timestamp}`)
  for (const check of summary.checks) {
    const badge = check.ok ? "PASS" : (check.critical ? "FAIL" : "WARN")
    console.log(`[${badge}] ${check.name} -> ${check.details}`)
  }

  console.log(`[OPS] Critical failures: ${summary.criticalFailures} | Warnings: ${summary.warnings}`)
}

async function appendReport(summary) {
  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true })
  await fs.appendFile(REPORT_PATH, `${JSON.stringify(summary)}\n`, "utf8")
}

async function runOnceAndExit() {
  const { summary, shouldFail } = await runChecks()
  printSummary(summary)
  await appendReport(summary)
  process.exit(shouldFail ? 1 : 0)
}

async function runWatch() {
  console.log(`[OPS] watch mode ativo (intervalo ${Math.round(intervalMs / 1000)}s)`)
  while (true) {
    const { summary } = await runChecks()
    printSummary(summary)
    await appendReport(summary)
    await sleep(intervalMs)
  }
}

if (watchMode) {
  runWatch().catch((error) => {
    console.error("[OPS] Falha no watch:", error)
    process.exit(1)
  })
} else {
  runOnceAndExit().catch((error) => {
    console.error("[OPS] Falha na execucao:", error)
    process.exit(1)
  })
}
