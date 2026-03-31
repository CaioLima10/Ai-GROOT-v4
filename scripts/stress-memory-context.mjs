import fs from "node:fs/promises"
import path from "node:path"

const BASE_URL = process.env.GIOM_BASE_URL || "http://localhost:3000"

function parseNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const TOTAL_REQUESTS = Math.max(2, parseNumber(process.env.STRESS_TOTAL_REQUESTS, 40))
const CONCURRENCY = Math.max(1, parseNumber(process.env.STRESS_CONCURRENCY, 8))
const STREAM_RATIO = Math.max(0, Math.min(1, parseNumber(process.env.STRESS_STREAM_RATIO, 0.35)))
const REQUEST_TIMEOUT_MS = Math.max(3_000, parseNumber(process.env.STRESS_REQUEST_TIMEOUT_MS, 90_000))
const ADMIN_DASH_KEY = String(process.env.ADMIN_DASH_KEY || "")
const REPORT_PATH = path.join(process.cwd(), "reports", "memory-context-stress.json")

const SLO = {
  retrievalP95BudgetMs: Number(process.env.MEMORY_SLO_RETRIEVAL_P95_MS || 250),
  totalP95BudgetMs: Number(process.env.MEMORY_SLO_TOTAL_P95_MS || 900),
  totalP99MaxBudgetMs: Number(process.env.MEMORY_SLO_TOTAL_P99_MS || 1800)
}

function percentile(values = [], p = 95) {
  if (!Array.isArray(values) || values.length === 0) return 0
  const sorted = values.slice().sort((a, b) => a - b)
  const rank = Math.ceil((p / 100) * sorted.length) - 1
  const index = Math.max(0, Math.min(sorted.length - 1, rank))
  return sorted[index]
}

function randomQuestion(index) {
  const prompts = [
    "Me ajude a otimizar latencia e custo de contexto no ask",
    "Quais memorias relevantes voce recuperou para esta sessao?",
    "Resuma os pontos tecnicos sobre ranking semantico",
    "Como reduzir p95 e p99 no pipeline de memoria?",
    "Sugira melhorias de observabilidade para GIOM"
  ]
  return `${prompts[index % prompts.length]} [run:${index}]`
}

function buildHeaders() {
  const headers = {
    "Content-Type": "application/json"
  }

  if (ADMIN_DASH_KEY) {
    headers["X-Admin-Key"] = ADMIN_DASH_KEY
  }

  return headers
}

async function postJson(url, body, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const startedAt = Date.now()
    const response = await fetch(url, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal
    })

    const raw = await response.text()
    let json = null
    try {
      json = raw ? JSON.parse(raw) : null
    } catch {
      json = null
    }

    return {
      ok: response.ok,
      status: response.status,
      durationMs: Date.now() - startedAt,
      body: json,
      raw
    }
  } finally {
    clearTimeout(timer)
  }
}

async function runSingle(index) {
  const stream = Math.random() < STREAM_RATIO
  const route = stream ? "/ask/stream" : "/ask"
  const userId = `stress_user_${(index % 5) + 1}`
  const sessionId = `stress_session_${(index % 11) + 1}`
  const body = {
    question: randomQuestion(index),
    context: {
      userId,
      sessionId,
      topic: "memory_observability_stress",
      intent: "technical_optimization"
    }
  }

  try {
    const result = await postJson(`${BASE_URL}${route}`, body, REQUEST_TIMEOUT_MS)
    return {
      index,
      route,
      ...result
    }
  } catch (error) {
    return {
      index,
      route,
      ok: false,
      status: 0,
      durationMs: REQUEST_TIMEOUT_MS,
      error: error?.message || "request_failed"
    }
  }
}

async function runConcurrent(total, concurrency) {
  const queue = Array.from({ length: total }, (_, index) => index)
  const results = []

  async function worker() {
    while (queue.length > 0) {
      const index = queue.shift()
      if (typeof index !== "number") return
      const result = await runSingle(index)
      results.push(result)
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  return results.sort((a, b) => a.index - b.index)
}

async function fetchMemoryMetrics() {
  const headers = {}
  if (ADMIN_DASH_KEY) {
    headers["X-Admin-Key"] = ADMIN_DASH_KEY
  }

  const response = await fetch(`${BASE_URL}/metrics/memoryContext?includeDistributed=true`, {
    headers
  })

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      body: null
    }
  }

  return {
    ok: true,
    status: response.status,
    body: await response.json()
  }
}

function validateSloFromMetrics(snapshot) {
  const latency = snapshot?.memoryContext?.latency || {}
  const retrievalP95 = Number(latency?.retrievalMs?.p95 || 0)
  const totalP95 = Number(latency?.totalMs?.p95 || 0)
  const totalP99 = Number(latency?.totalMs?.p99 || 0)

  const violations = []
  if (retrievalP95 > SLO.retrievalP95BudgetMs) {
    violations.push({ metric: "retrievalMs.p95", value: retrievalP95, budget: SLO.retrievalP95BudgetMs })
  }
  if (totalP95 > SLO.totalP95BudgetMs) {
    violations.push({ metric: "totalMs.p95", value: totalP95, budget: SLO.totalP95BudgetMs })
  }
  if (totalP99 > SLO.totalP99MaxBudgetMs) {
    violations.push({ metric: "totalMs.p99", value: totalP99, budget: SLO.totalP99MaxBudgetMs })
  }

  return {
    retrievalP95,
    totalP95,
    totalP99,
    violations,
    passed: violations.length === 0
  }
}

async function main() {
  const startedAt = Date.now()

  const results = await runConcurrent(TOTAL_REQUESTS, CONCURRENCY)
  const ok = results.filter(item => item.ok)
  const failed = results.filter(item => !item.ok)
  const durations = ok.map(item => Number(item.durationMs || 0))

  const metrics = await fetchMemoryMetrics()
  const sloValidation = metrics.ok ? validateSloFromMetrics(metrics.body) : {
    passed: false,
    violations: [{ metric: "metrics_endpoint", value: metrics.status, budget: 200 }]
  }

  const report = {
    generatedAt: new Date().toISOString(),
    config: {
      baseUrl: BASE_URL,
      totalRequests: TOTAL_REQUESTS,
      concurrency: CONCURRENCY,
      streamRatio: STREAM_RATIO,
      requestTimeoutMs: REQUEST_TIMEOUT_MS,
      slo: SLO
    },
    execution: {
      totalMs: Date.now() - startedAt,
      successCount: ok.length,
      failureCount: failed.length,
      successRate: TOTAL_REQUESTS > 0 ? (ok.length / TOTAL_REQUESTS) : 0,
      requestLatencyMs: {
        p50: percentile(durations, 50),
        p75: percentile(durations, 75),
        p95: percentile(durations, 95),
        p99: percentile(durations, 99)
      }
    },
    sloValidation,
    metricsSnapshot: metrics.body,
    failures: failed.slice(0, 25)
  }

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true })
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8")

  console.log(`memory stress success: ${ok.length}/${TOTAL_REQUESTS}`)
  console.log(`request latency p95: ${report.execution.requestLatencyMs.p95}ms`)
  console.log(`memory total p95: ${sloValidation.totalP95 || 0}ms`)
  console.log(`SLO passed: ${sloValidation.passed ? "yes" : "no"}`)
  console.log(`report: ${REPORT_PATH}`)

  if (!sloValidation.passed || failed.length > 0) {
    process.exitCode = 1
  }
}

main().catch(async (error) => {
  const report = {
    generatedAt: new Date().toISOString(),
    error: error?.message || "stress_failed"
  }

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true })
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8")
  console.error(error)
  process.exit(1)
})
