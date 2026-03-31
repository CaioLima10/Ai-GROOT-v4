import { spawn } from "node:child_process"

const isWin = process.platform === "win32"
const shell = true

const services = [
  {
    key: "backend",
    command: isWin ? "node" : "node",
    args: ["apps/api/dist/server.js"],
    cwd: process.cwd(),
    minRestartDelayMs: 1200,
    maxRestartDelayMs: 12_000
  },
  {
    key: "frontend",
    command: isWin ? "npm" : "npm",
    args: ["--workspace", "web-next", "run", "dev"],
    cwd: process.cwd(),
    minRestartDelayMs: 1200,
    maxRestartDelayMs: 12_000
  }
]

const state = new Map()
let shuttingDown = false

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function timestamp() {
  return new Date().toISOString()
}

function prefixLog(serviceKey, text) {
  const lines = String(text || "").split(/\r?\n/).filter(Boolean)
  for (const line of lines) {
    console.log(`[${timestamp()}] [${serviceKey}] ${line}`)
  }
}

function spawnService(service) {
  const entry = state.get(service.key) || {
    restarts: 0,
    lastStartAt: 0,
    child: null
  }

  const child = spawn(service.command, service.args, {
    cwd: service.cwd,
    env: process.env,
    shell,
    stdio: ["ignore", "pipe", "pipe"]
  })

  entry.child = child
  entry.lastStartAt = Date.now()
  state.set(service.key, entry)

  prefixLog(service.key, `started pid=${child.pid}`)

  child.stdout.on("data", (chunk) => prefixLog(service.key, chunk))
  child.stderr.on("data", (chunk) => prefixLog(service.key, chunk))

  child.on("exit", async (code, signal) => {
    prefixLog(service.key, `exit code=${code ?? "null"} signal=${signal ?? "null"}`)
    if (shuttingDown) return

    entry.restarts += 1
    state.set(service.key, entry)

    const backoff = Math.min(
      service.maxRestartDelayMs,
      service.minRestartDelayMs * Math.max(1, entry.restarts)
    )

    prefixLog(service.key, `restarting in ${backoff}ms (attempt ${entry.restarts})`)
    await sleep(backoff)
    if (!shuttingDown) {
      spawnService(service)
    }
  })
}

function stopAll(reason) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[${timestamp()}] [supervisor] stopping all services: ${reason}`)

  for (const service of services) {
    const entry = state.get(service.key)
    const child = entry?.child
    if (!child || child.killed) continue

    try {
      if (isWin) {
        spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
          shell,
          stdio: "ignore"
        })
      } else {
        child.kill("SIGTERM")
      }
    } catch {
      // noop
    }
  }

  setTimeout(() => process.exit(0), 400)
}

async function main() {
  console.log(`[${timestamp()}] [supervisor] starting backend + frontend with auto-restart`)

  const backend = services.find((service) => service.key === "backend")
  const frontend = services.find((service) => service.key === "frontend")

  if (!backend || !frontend) {
    throw new Error("services config invalid")
  }

  spawnService(backend)
  await sleep(1500)
  spawnService(frontend)

  process.on("SIGINT", () => stopAll("SIGINT"))
  process.on("SIGTERM", () => stopAll("SIGTERM"))
}

main().catch((error) => {
  console.error(`[${timestamp()}] [supervisor] fatal:`, error)
  process.exit(1)
})
