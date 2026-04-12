import { spawn } from "node:child_process"
import { openSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..")
const webRoot = path.join(repoRoot, "apps", "web-next")
const nextBin = path.join(repoRoot, "node_modules", "next", "dist", "bin", "next")

function readCliOption(name, fallback = "") {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length).trim() : fallback
}

const apiPort = String(readCliOption("api-port", process.env.GIOM_QA_API_PORT || "3011")).trim() || "3011"
const webPort = String(readCliOption("web-port", process.env.GIOM_QA_WEB_PORT || "3005")).trim() || "3005"
const profile = String(readCliOption("profile", process.env.GIOM_QA_PROFILE || "general60")).trim() || "general60"

const apiBaseUrl = `http://127.0.0.1:${apiPort}`
const webBaseUrl = `http://127.0.0.1:${webPort}`

function createDetachedLogStream(fileName) {
  return openSync(path.join(repoRoot, "reports", fileName), "a")
}

function spawnPreview(command, args, options = {}) {
  const out = createDetachedLogStream(options.logFileName || "preview.log")
  const child = spawn(command, args, {
    cwd: options.cwd || repoRoot,
    env: {
      ...process.env,
      ...options.env
    },
    stdio: ["ignore", out, out]
  })

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[preview-exit] ${options.label || command} saiu com codigo ${code}`)
    }
  })

  return child
}

async function waitForUrl(url, timeoutMs = 120_000, label = url) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: {
          Accept: "text/html,application/json;q=0.9,*/*;q=0.8"
        }
      })

      if (response.ok || response.status < 500) {
        return response.status
      }
    } catch {
      // retry until timeout
    }

    await new Promise((resolve) => setTimeout(resolve, 1_500))
  }

  throw new Error(`Timeout esperando ${label} ficar disponivel`)
}

function killChild(child, label) {
  if (!child || child.killed) return
  try {
    child.kill("SIGTERM")
  } catch (error) {
    console.error(`[preview-kill] Falha ao encerrar ${label}:`, error instanceof Error ? error.message : String(error))
  }
}

async function main() {
  console.log(JSON.stringify({
    apiBaseUrl,
    webBaseUrl,
    profile,
    status: "starting_previews"
  }, null, 2))

  const apiChild = spawnPreview(process.execPath, ["apps/api/src/server.js"], {
    env: {
      PORT: apiPort
    },
    logFileName: `api-preview-${apiPort}.log`,
    label: "api-preview"
  })

  const webChild = spawnPreview(process.execPath, [nextBin, "start", "-p", webPort], {
    cwd: webRoot,
    env: {
      NEXT_PUBLIC_BACKEND_PROXY_TARGET: apiBaseUrl
    },
    logFileName: `front-preview-${webPort}.log`,
    label: "web-preview"
  })

  try {
    await waitForUrl(`${apiBaseUrl}/health`, 120_000, "API preview")
    await waitForUrl(webBaseUrl, 120_000, "Web preview")

    console.log(JSON.stringify({
      apiBaseUrl,
      webBaseUrl,
      profile,
      status: "running_battery"
    }, null, 2))

    const batteryExitCode = await new Promise((resolve, reject) => {
      const batteryChild = spawn(process.execPath, [
        "scripts/run-giom-multimodal-battery.mjs",
        `--profile=${profile}`
      ], {
        cwd: repoRoot,
        env: {
          ...process.env,
          FRONTEND_URL: webBaseUrl,
          FRONTEND_URL_STRICT: "1"
        },
        stdio: "inherit"
      })

      batteryChild.on("error", reject)
      batteryChild.on("exit", (code) => resolve(code ?? 1))
    })

    if (batteryExitCode !== 0) {
      process.exitCode = Number(batteryExitCode || 1)
    }
  } finally {
    killChild(webChild, "web-preview")
    killChild(apiChild, "api-preview")
  }
}

await main()
