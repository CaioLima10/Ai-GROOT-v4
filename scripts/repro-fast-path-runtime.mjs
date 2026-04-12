import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..")
const port = "3011"
const baseUrl = `http://127.0.0.1:${port}`
const requestId = `fastpath_${Date.now()}`
const question = "o que e inteligencia artificial?"

function hasInternalLeak(text = "") {
  return /\[ System Prompt \]|Pergunta recebida:|Estado dos providers:|Validacao da solucao:|Score geral:/i.test(String(text || ""))
}

async function testAsk() {
  const response = await fetch(`${baseUrl}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": requestId
    },
    body: JSON.stringify({
      question,
      context: {
        assistantProfile: "auto"
      }
    })
  })

  assert.equal(response.ok, true)
  const payload = await response.json()
  assert.equal(payload?.success, true)
  assert.equal(payload?.metadata?.fastPath?.enabled, true)
  assert.equal(hasInternalLeak(payload?.response), false)

  return {
    response: payload.response,
    processingTime: payload?.metadata?.processingTime,
    fastPath: payload?.metadata?.fastPath
  }
}

async function testAskStream() {
  const response = await fetch(`${baseUrl}/ask/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": `${requestId}_stream`
    },
    body: JSON.stringify({
      question,
      context: {
        assistantProfile: "auto"
      }
    })
  })

  assert.equal(response.ok, true)
  assert.ok(response.body)

  const decoder = new TextDecoder()
  const reader = response.body.getReader()
  let buffer = ""
  let currentEvent = "message"
  let meta = null
  let complete = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    while (buffer.includes("\n\n")) {
      const separatorIndex = buffer.indexOf("\n\n")
      const rawEvent = buffer.slice(0, separatorIndex)
      buffer = buffer.slice(separatorIndex + 2)

      if (!rawEvent.trim()) {
        currentEvent = "message"
        continue
      }

      let data = ""
      for (const line of rawEvent.split("\n")) {
        if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim()
        } else if (line.startsWith("data:")) {
          data += `${line.slice(5).trim()}`
        }
      }

      if (!data) {
        currentEvent = "message"
        continue
      }

      const payload = JSON.parse(data)
      if (currentEvent === "meta") {
        meta = payload
      }
      if (currentEvent === "complete") {
        complete = payload
      }
      currentEvent = "message"
    }

    if (meta && complete) {
      break
    }
  }

  assert.equal(meta?.fastPath?.enabled, true)
  assert.equal(hasInternalLeak(complete?.response), false)

  return {
    response: complete?.response,
    processingTime: complete?.metadata?.processingTime,
    fastPath: meta?.fastPath
  }
}

function startServer() {
  return spawn(process.execPath, ["apps/api/src/server.js"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: port
    },
    stdio: ["ignore", "pipe", "pipe"]
  })
}

async function waitForServerReady(timeoutMs = 20_000) {
  const startedAt = Date.now()

  while ((Date.now() - startedAt) < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`)
      if (response.ok) {
        return
      }
    } catch {
      // keep polling while the server boots
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`API temporaria nao respondeu em ${baseUrl} dentro de ${timeoutMs}ms`)
}

const server = startServer()
let stderr = ""

server.stderr.on("data", (chunk) => {
  stderr += String(chunk || "")
})

try {
  await waitForServerReady()
  const ask = await testAsk()
  const askStream = await testAskStream()

  console.log(JSON.stringify({
    ask,
    askStream
  }, null, 2))
} finally {
  server.kill("SIGTERM")
  await new Promise((resolve) => {
    server.once("exit", resolve)
    setTimeout(resolve, 3_000)
  })

  if (stderr.trim()) {
    console.error(stderr.trim())
  }
}
