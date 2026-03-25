import { spawn } from "child_process"
import dotenv from "dotenv"

const SERVER_URL = "http://127.0.0.1:3000"
const SERVER_ENTRY = "apps/api/src/server.js"
const PACK_ID = process.argv[2] || "core_diagnostics"

dotenv.config()

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
    stdio: ["ignore", "pipe", "pipe"]
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

    for (const dimension of payload.summary.dimensions || []) {
      console.log(`${dimension.label}: ${Math.round(dimension.score * 100)}%`)
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
