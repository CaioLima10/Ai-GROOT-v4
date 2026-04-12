import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  formatRecentLogs,
  startNodeProcess,
  stopChildProcess,
  waitForUrl
} from "./runtime-qa-support.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..")

function parseCliArgs(argv) {
  const args = {}
  for (const token of argv) {
    if (!token.startsWith("--")) continue
    const withoutPrefix = token.slice(2)
    const separatorIndex = withoutPrefix.indexOf("=")

    if (separatorIndex === -1) {
      args[withoutPrefix] = "true"
      continue
    }

    const key = withoutPrefix.slice(0, separatorIndex)
    const value = withoutPrefix.slice(separatorIndex + 1)
    args[key] = value
  }
  return args
}

function toInteger(value, fallback) {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : fallback
}

function buildHeaders(extraHeaders = {}) {
  return {
    "Content-Type": "application/json",
    ...extraHeaders
  }
}

function truncate(text, maxLength = 600) {
  const normalized = String(text || "")
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 90_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    })
  } finally {
    clearTimeout(timer)
  }
}

async function executeCheck(baseUrl, check) {
  const url = new URL(check.path.replace(/^\//, ""), `${baseUrl.replace(/\/$/, "")}/`).toString()
  const response = await fetchWithTimeout(url, {
    method: check.method,
    headers: check.headers,
    body: check.body === undefined ? undefined : JSON.stringify(check.body)
  }, check.timeoutMs)

  const text = await response.text()
  const contentType = response.headers.get("content-type") || ""
  let payload = null

  if (contentType.includes("application/json") || /^[\[{]/.test(text.trim())) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  assert.ok(
    check.expectedStatuses.includes(response.status),
    `${check.name} returned ${response.status}. Body: ${truncate(text)}`
  )

  if (typeof check.validate === "function") {
    await check.validate({ response, payload, text })
  }

  return {
    name: check.name,
    status: response.status,
    url
  }
}

function buildChecks({ adminKey, question }) {
  const askPayload = {
    question,
    context: {
      channel: "smoke-enterprise-routes-v1"
    }
  }

  const checks = [
    {
      name: "health",
      method: "GET",
      path: "/health",
      headers: undefined,
      expectedStatuses: [200, 503],
      validate: ({ payload }) => {
        assert.ok(payload && typeof payload === "object")
      }
    },
    {
      name: "root",
      method: "GET",
      path: "/",
      headers: undefined,
      expectedStatuses: [200],
      validate: ({ payload }) => {
        assert.equal(typeof payload?.name, "string")
        assert.equal(payload?.status, "ok")
      }
    },
    {
      name: "config",
      method: "GET",
      path: "/config",
      headers: undefined,
      expectedStatuses: [200],
      validate: ({ payload }) => {
        assert.equal(typeof payload?.service, "string")
        assert.ok(payload?.features && typeof payload.features === "object")
      }
    },
    {
      name: "capabilities",
      method: "GET",
      path: "/capabilities",
      headers: undefined,
      expectedStatuses: [200],
      validate: ({ payload }) => {
        assert.ok(payload && typeof payload === "object")
      }
    },
    {
      name: "knowledge-status",
      method: "GET",
      path: "/knowledge/status",
      headers: undefined,
      expectedStatuses: [200],
      validate: ({ payload }) => {
        assert.equal(typeof payload?.service, "string")
      }
    },
    {
      name: "models",
      method: "GET",
      path: "/v1/models",
      headers: undefined,
      expectedStatuses: [200],
      validate: ({ payload }) => {
        assert.ok(Array.isArray(payload?.data))
      }
    },
    {
      name: "feedback-invalid",
      method: "POST",
      path: "/feedback",
      headers: buildHeaders(),
      body: {},
      expectedStatuses: [400],
      validate: ({ payload }) => {
        assert.equal(payload?.code, "INVALID_FEEDBACK")
      }
    },
    {
      name: "bible-missing-passage",
      method: "GET",
      path: "/bible/passage",
      headers: undefined,
      expectedStatuses: [400],
      validate: ({ payload }) => {
        assert.equal(payload?.code, "MISSING_PASSAGE")
      }
    },
    {
      name: "bible-john-3-16",
      method: "GET",
      path: "/bible/passage?passage=JHN.3.16",
      headers: undefined,
      expectedStatuses: [200],
      validate: ({ payload }) => {
        assert.equal(typeof payload?.requestId, "string")
        assert.ok(payload?.data)
      }
    },
    {
      name: "research-weather",
      method: "GET",
      path: "/research/weather",
      headers: undefined,
      expectedStatuses: [400, 503],
      validate: ({ payload }) => {
        assert.equal(typeof payload?.code, "string")
      }
    },
    {
      name: "research-search",
      method: "GET",
      path: "/research/search",
      headers: undefined,
      expectedStatuses: [400, 503],
      validate: ({ payload }) => {
        assert.equal(typeof payload?.code, "string")
      }
    },
    {
      name: "research-sports",
      method: "GET",
      path: "/research/sports",
      headers: undefined,
      expectedStatuses: [400, 503],
      validate: ({ payload }) => {
        assert.equal(typeof payload?.code, "string")
      }
    },
    {
      name: "research-soccer-endpoints",
      method: "GET",
      path: "/research/soccer/endpoints",
      headers: undefined,
      expectedStatuses: [200],
      validate: ({ payload }) => {
        assert.ok(Array.isArray(payload?.endpoints))
      }
    },
    {
      name: "research-soccer-invalid-endpoint",
      method: "GET",
      path: "/research/soccer/not-allowed",
      headers: undefined,
      expectedStatuses: [400, 503],
      validate: ({ payload }) => {
        assert.equal(typeof payload?.code, "string")
      }
    },
    {
      name: "compat-chat-completions",
      method: "POST",
      path: "/v1/chat/completions",
      headers: buildHeaders({ "X-User-Id": "smoke_compat_chat" }),
      body: {
        model: "groot-1-free",
        messages: [
          {
            role: "user",
            content: question
          }
        ]
      },
      expectedStatuses: [200],
      validate: ({ payload }) => {
        assert.equal(typeof payload?.choices?.[0]?.message?.content, "string")
      }
    },
    {
      name: "compat-responses",
      method: "POST",
      path: "/v1/responses",
      headers: buildHeaders({ "X-User-Id": "smoke_compat_responses" }),
      body: {
        model: "groot-1-free",
        input: question
      },
      expectedStatuses: [200],
      validate: ({ payload }) => {
        assert.equal(typeof payload?.output_text, "string")
      }
    },
    {
      name: "compat-gemini-generate-content",
      method: "POST",
      path: "/v1beta/models/groot-1-free:generateContent",
      headers: buildHeaders({ "X-User-Id": "smoke_compat_gemini" }),
      body: {
        contents: [
          {
            role: "user",
            parts: [{ text: question }]
          }
        ]
      },
      expectedStatuses: [200],
      validate: ({ payload }) => {
        assert.equal(typeof payload?.candidates?.[0]?.content?.parts?.[0]?.text, "string")
      }
    },
    {
      name: "ask",
      method: "POST",
      path: "/ask",
      headers: buildHeaders({ "X-User-Id": "smoke_ask" }),
      body: askPayload,
      expectedStatuses: [200],
      validate: ({ payload }) => {
        assert.equal(payload?.success, true)
        assert.equal(typeof payload?.response, "string")
      }
    },
    {
      name: "ask-stream",
      method: "POST",
      path: "/ask/stream",
      headers: buildHeaders({ "X-User-Id": "smoke_ask_stream" }),
      body: askPayload,
      expectedStatuses: [200],
      timeoutMs: 120_000,
      validate: ({ text }) => {
        assert.ok(text.includes("event:") || text.includes("data:"))
      }
    }
  ]

  if (adminKey) {
    const adminHeaders = {
      "X-Admin-Key": adminKey
    }

    checks.push(
      {
        name: "admin",
        method: "GET",
        path: "/admin",
        headers: adminHeaders,
        expectedStatuses: [200],
        validate: ({ payload }) => {
          assert.equal(payload?.admin, true)
        }
      },
      {
        name: "metrics-json",
        method: "GET",
        path: "/metrics/json",
        headers: adminHeaders,
        expectedStatuses: [200],
        validate: ({ payload }) => {
          assert.ok(payload && typeof payload === "object")
        }
      },
      {
        name: "language-runtime-status",
        method: "GET",
        path: "/runtime/language/status",
        headers: adminHeaders,
        expectedStatuses: [200],
        validate: ({ payload }) => {
          assert.equal(payload?.success, true)
        }
      }
    )
  }

  return checks
}

const args = parseCliArgs(process.argv.slice(2))
const defaultPort = toInteger(args.port || process.env.SMOKE_PORT, 3014)
const baseUrl = String(args["base-url"] || process.env.SMOKE_BASE_URL || `http://127.0.0.1:${defaultPort}`)
const shouldSpawnServer = !args["base-url"] && !process.env.SMOKE_BASE_URL && args["no-spawn"] !== "true"
const adminKey = String(args["admin-key"] || process.env.SMOKE_ADMIN_KEY || "")
const question = String(
  args.question ||
  process.env.SMOKE_QUESTION ||
  "me explique em uma frase o que e inteligencia artificial"
)

let serverProcess = null
let serverLogs = []

try {
  if (shouldSpawnServer) {
    const started = startNodeProcess("apps/api/src/server.js", {
      cwd: repoRoot,
      env: {
        PORT: String(defaultPort)
      },
      label: "smoke-enterprise-routes-v1"
    })
    serverProcess = started.child
    serverLogs = started.logs

    const isReady = await waitForUrl(`${baseUrl.replace(/\/$/, "")}/health`, {
      timeoutMs: 60_000,
      accept: (response) => response.status >= 200 && response.status < 600
    })

    assert.equal(isReady, true, `Temporary API did not become reachable at ${baseUrl}`)
  }

  const checks = buildChecks({ adminKey, question })
  const results = []

  for (const check of checks) {
    const result = await executeCheck(baseUrl, check)
    results.push(result)
    console.log(`[ok] ${result.name} -> ${result.status}`)
  }

  console.log(JSON.stringify({
    version: "v1",
    baseUrl,
    totalChecks: results.length,
    adminChecksEnabled: Boolean(adminKey),
    results
  }, null, 2))
} catch (error) {
  console.error(`smoke:enterprise:routes:v1 failed: ${error instanceof Error ? error.message : String(error)}`)

  if (serverLogs.length > 0) {
    console.error(formatRecentLogs(serverLogs))
  }

  process.exitCode = 1
} finally {
  if (serverProcess) {
    await stopChildProcess(serverProcess)
  }
}