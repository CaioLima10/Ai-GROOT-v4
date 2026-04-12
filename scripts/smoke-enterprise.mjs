import "dotenv/config"
import { spawn } from "child_process"

const serverPort = Number(process.env.SMOKE_BACKEND_PORT || process.env.API_PORT || process.env.PORT || 3001)
const SERVER_URL = process.env.SMOKE_SERVER_URL || `http://127.0.0.1:${serverPort}`
const SERVER_ENTRY = "apps/api/dist/server.js"
const SERVER_STARTUP_TIMEOUT_MS = Number(process.env.SMOKE_STARTUP_TIMEOUT_MS || 20_000)

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function isEndpointReady(path) {
  try {
    const response = await fetch(`${SERVER_URL}${path}`)
    return response.ok
  } catch {
    return false
  }
}

async function waitForServer(timeoutMs = SERVER_STARTUP_TIMEOUT_MS) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const [configReady, knowledgeReady, healthReady] = await Promise.all([
      isEndpointReady("/config"),
      isEndpointReady("/knowledge/status"),
      isEndpointReady("/health")
    ])

    if ((configReady && knowledgeReady) || healthReady) {
      return
    }

    await delay(500)
  }

  throw new Error("Servidor não disponibilizou os endpoints principais dentro do tempo limite")
}

function parseSSE(rawText) {
  const packets = String(rawText || "")
    .split("\n\n")
    .map(packet => packet.trim())
    .filter(Boolean)

  return packets.map(packet => {
    const lines = packet.split(/\r?\n/)
    let event = "message"
    const dataLines = []

    lines.forEach(line => {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim()
        return
      }

      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim())
      }
    })

    return {
      event,
      data: dataLines.length > 0 ? JSON.parse(dataLines.join("\n")) : null
    }
  })
}

async function main() {
  const child = spawn("node", [SERVER_ENTRY], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"]
  })

  child.stdout.on("data", chunk => process.stdout.write(chunk))
  child.stderr.on("data", chunk => process.stderr.write(chunk))

  try {
    await waitForServer()

    const [configResponse, knowledgeResponse] = await Promise.all([
      fetch(`${SERVER_URL}/config`),
      fetch(`${SERVER_URL}/knowledge/status`)
    ])

    const config = await configResponse.json()
    const knowledge = await knowledgeResponse.json()

    if (!config?.features?.streaming) {
      throw new Error("Config não expõe streaming")
    }

    if (!Array.isArray(config?.ai?.bibleStudyModules) || config.ai.bibleStudyModules.length === 0) {
      throw new Error("Config não expõe módulos bíblicos")
    }

    if (!knowledge?.stats) {
      throw new Error("Knowledge status sem stats")
    }

    const streamResponse = await fetch(`${SERVER_URL}/ask/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": "smoke_tester"
      },
      body: JSON.stringify({
        question: "Explique rapidamente quanto é 2 + 2.",
        context: {
          assistantProfile: "concise_operator",
          activeModules: ["math_science"]
        }
      })
    })

    const streamText = await streamResponse.text()
    const events = parseSSE(streamText)
    const completeEvent = events.find(event => event.event === "complete")

    if (!completeEvent?.data?.response) {
      throw new Error("Streaming não retornou evento complete com resposta")
    }

    console.log("Smoke test OK")
    console.log(`Config streaming: ${config.features.streaming}`)
    console.log(`Knowledge local: ${knowledge.stats.localKnowledge}`)
    console.log(`Resposta stream: ${completeEvent.data.response.slice(0, 120)}`)
  } finally {
    child.kill("SIGTERM")
    await delay(500)
  }
}

main().catch(error => {
  console.error("Smoke test falhou:", error.message)
  process.exit(1)
})
