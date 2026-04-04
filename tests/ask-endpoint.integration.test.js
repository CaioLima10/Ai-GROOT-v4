import "dotenv/config"
import test, { before, after } from "node:test"
import assert from "node:assert/strict"
import {
  formatRecentLogs,
  startNodeProcess,
  stopChildProcess,
  waitForAnyUrl
} from "../scripts/runtime-qa-support.mjs"

const TEST_PORT = Number(process.env.GIOM_TEST_PORT || process.env.API_PORT || process.env.PORT || 3001)
const BASE_URL = process.env.GIOM_TEST_BASE_URL || `http://127.0.0.1:${TEST_PORT}`
const RUN_ONLINE = process.env.RUN_ONLINE_TESTS !== "false"
const AUTO_START_RUNTIME = process.env.GIOM_TEST_AUTO_START !== "false"

let managedRuntime = null
let runtimeWasStartedByTest = false
let requestCounter = 0
let skipOnlineReason = ""

function nextTestUserId() {
  requestCounter += 1
  return `integration_test_user_${requestCounter}`
}

function parseSSE(rawText) {
  return String(rawText || "")
    .split("\n\n")
    .map((packet) => packet.trim())
    .filter(Boolean)
    .map((packet) => {
      const lines = packet.split(/\r?\n/)
      let event = "message"
      const dataLines = []

      for (const line of lines) {
        if (line.startsWith("event:")) {
          event = line.slice(6).trim()
          continue
        }

        if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trim())
        }
      }

      return {
        event,
        data: dataLines.length > 0 ? JSON.parse(dataLines.join("\n")) : null
      }
    })
}

async function waitForRuntimeReady(timeoutMs = 45_000) {
  return await waitForAnyUrl(
    [
      `${BASE_URL}/config`,
      `${BASE_URL}/capabilities`,
      `${BASE_URL}/health`
    ],
    {
      timeoutMs,
      accept: (response) => response.status >= 200 && response.status < 600
    }
  )
}

async function postAsk(question, context = {}, userId = nextTestUserId()) {
  const response = await fetch(`${BASE_URL}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": userId
    },
    body: JSON.stringify({ question, context })
  })

  const text = await response.text()
  let payload = {}
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = {}
  }

  return {
    status: response.status,
    payload,
    raw: text
  }
}

async function postAskStream(question, context = {}, userId = nextTestUserId()) {
  const response = await fetch(`${BASE_URL}/ask/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": userId
    },
    body: JSON.stringify({ question, context })
  })

  const raw = await response.text()
  return {
    status: response.status,
    raw,
    events: parseSSE(raw)
  }
}

before(async () => {
  if (!RUN_ONLINE) {
    skipOnlineReason = "RUN_ONLINE_TESTS=false"
    return
  }

  const reachable = await waitForRuntimeReady(4_000)
  if (reachable) {
    return
  }

  if (!AUTO_START_RUNTIME) {
    throw new Error(`Runtime local indisponivel em ${BASE_URL} e o auto-start foi desativado.`)
  }

  try {
    managedRuntime = startNodeProcess("apps/api/src/server.js", {
      label: "ask-integration-runtime",
      env: {
        PORT: String(TEST_PORT),
        API_PORT: String(TEST_PORT),
        NODE_ENV: "test"
      }
    })
    runtimeWasStartedByTest = true
  } catch (error) {
    const code = String(error?.code || "")
    if (code === "EPERM") {
      skipOnlineReason = "sandbox bloqueou o auto-start do runtime local"
      return
    }
    throw error
  }

  const ready = await waitForRuntimeReady()
  if (!ready) {
    const details = formatRecentLogs(managedRuntime.logs, 40)
    await stopChildProcess(managedRuntime.child).catch(() => {})
    throw new Error(`Runtime local nao ficou pronto em ${BASE_URL}.\n${details}`)
  }
})

after(async () => {
  if (runtimeWasStartedByTest) {
    await stopChildProcess(managedRuntime?.child).catch(() => {})
  }
})

test("integration /ask should answer greeting naturally", async (t) => {
  if (!RUN_ONLINE || skipOnlineReason) {
    t.skip(skipOnlineReason || "online tests disabled")
  }

  const { status, payload, raw } = await postAsk("oiii", {
    channel: "integration-test",
    migrationStage: 4
  })

  assert.equal(status, 200, raw.slice(0, 200))
  const answer = String(payload?.response || payload?.answer || payload?.data?.response || "")
  assert.ok(answer.length > 0, "response should not be empty")
  assert.match(answer, /ola|oi|bom dia|boa tarde|boa noite|shalom|e ai/i)
})

test("integration /ask should not leak internal context patterns", async (t) => {
  if (!RUN_ONLINE || skipOnlineReason) {
    t.skip(skipOnlineReason || "online tests disabled")
  }

  const { status, payload, raw } = await postAsk("me ajuda com arquitetura", {
    channel: "integration-test",
    migrationStage: 4
  })

  assert.equal(status, 200, raw.slice(0, 200))
  const answer = String(payload?.response || payload?.answer || payload?.data?.response || "")
  assert.ok(answer.length > 0, "response should not be empty")
  assert.doesNotMatch(answer, /com o contexto que eu tenho agora/i)
  assert.doesNotMatch(answer, /topicos recentes|tópicos recentes/i)
  assert.doesNotMatch(answer, /pergunte denovo/i)
})

test("integration /ask should answer current time without sports contamination", async (t) => {
  if (!RUN_ONLINE || skipOnlineReason) {
    t.skip(skipOnlineReason || "online tests disabled")
  }

  const { status, payload, raw } = await postAsk("qual horario de agora , dia mes e ano", {
    channel: "integration-test",
    migrationStage: 4
  })

  assert.equal(status, 200, raw.slice(0, 200))
  const answer = String(payload?.response || payload?.answer || payload?.data?.response || "")
  assert.ok(answer.length > 0, "response should not be empty")
  assert.match(answer, /\d{2}:\d{2}/)
  assert.match(answer, /\d{2}\/\d{2}\/\d{4}/)
  assert.doesNotMatch(answer, /jogo|partida|agenda esportiva|flamengo|santos/i)
})

test("integration /ask/stream should complete without leaking internal context", async (t) => {
  if (!RUN_ONLINE || skipOnlineReason) {
    t.skip(skipOnlineReason || "online tests disabled")
  }

  const { status, raw, events } = await postAskStream("resuma rapidamente quanto e 2 + 2", {
    channel: "integration-test",
    migrationStage: 4
  })

  assert.equal(status, 200, raw.slice(0, 200))
  const completeEvent = events.find((event) => event.event === "complete")
  const answer = String(completeEvent?.data?.response || "")

  assert.ok(answer.length > 0, "stream complete event should include a response")
  assert.match(answer, /2\s*\+\s*2|4|quatro/i)
  assert.doesNotMatch(answer, /com o contexto que eu tenho agora/i)
  assert.doesNotMatch(answer, /topicos recentes|tópicos recentes/i)
})
