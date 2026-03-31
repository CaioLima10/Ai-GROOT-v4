import { spawn } from "child_process"

const SERVER_URL = "http://127.0.0.1:3000"
const SERVER_ENTRY = "apps/api/dist/server.js"

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForServer(timeoutMs = 12000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${SERVER_URL}/health`)
      if (response.ok) {
        return
      }
    } catch {
      // servidor ainda não respondeu
    }

    await delay(500)
  }

  throw new Error("Servidor não respondeu dentro do tempo limite")
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
