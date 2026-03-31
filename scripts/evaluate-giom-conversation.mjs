import { spawn } from "child_process"
import dotenv from "dotenv"

dotenv.config()

const SERVER_PORT = Number(process.env.GIOM_EVAL_PORT || (3101 + (process.pid % 400)))
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`
const SERVER_ENTRY = "apps/api/dist/server.js"
const CLI_ARGS = process.argv.slice(2)
const PACK_ID = CLI_ARGS.find((arg) => !arg.startsWith("--")) || "core_diagnostics"
const VERBOSE = CLI_ARGS.includes("--verbose")

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
      // servidor ainda nao respondeu
    }

    await delay(500)
  }

  throw new Error("Servidor nao respondeu dentro do tempo limite")
}

async function main() {
  const adminHeaders = process.env.ADMIN_DASH_KEY
    ? { "X-Admin-Key": process.env.ADMIN_DASH_KEY }
    : {}

  const child = spawn("node", [SERVER_ENTRY], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: String(SERVER_PORT)
    }
  })

  child.stdout.on("data", (chunk) => process.stdout.write(chunk))
  child.stderr.on("data", (chunk) => process.stderr.write(chunk))

  try {
    await waitForServer()

    const response = await fetch(`${SERVER_URL}/evaluation/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": "giom_eval_runner",
        ...adminHeaders
      },
      body: JSON.stringify({
        packId: PACK_ID
      })
    })

    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload?.error || `Erro HTTP ${response.status}`)
    }

    if (!payload?.summary?.score) {
      throw new Error("Benchmark retornou sem score agregado")
    }

    console.log("GIOM benchmark OK")
    console.log(`Pack: ${payload.pack.label}`)
    console.log(`Score geral: ${Math.round(payload.summary.score * 100)}%`)
    console.log(`Status: ${payload.summary.status}`)
    console.log(`Riscos: ${(payload.summary.risks || []).join(" | ") || "nenhum"}`)

    for (const dimension of (payload.summary.dimensions || []).filter((item) => item.applicable !== false || item.applicableCount > 0)) {
      console.log(`${dimension.label}: ${Math.round(dimension.score * 100)}%`)
    }

    if (VERBOSE) {
      console.log("\nDetalhes por cenario:")
      for (const turn of payload.turns || []) {
        const summary = (turn.evaluation?.dimensions || [])
          .filter((item) => item.applicable !== false)
          .map((item) => `${item.label}: ${Math.round(item.score * 100)}%`)
          .join(" | ")

        console.log(`- ${turn.scenarioId}: ${summary}`)
        console.log(`  Pergunta: ${turn.question || turn.userMessage || ""}`)
        console.log(`  Resposta: ${turn.answer || turn.aiResponse || ""}`)
      }
    }
  } finally {
    child.kill("SIGTERM")
    await delay(500)
  }
}

main().catch((error) => {
  console.error("Benchmark GIOM falhou:", error.message)
  process.exit(1)
})
