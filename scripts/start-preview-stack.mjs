import { spawn } from "node:child_process"
import { openSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  resolveGiomApiBaseUrl,
  resolveGiomApiPort,
  resolveGiomWebPreviewPort
} from "../config/runtimePorts.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..")
const webRoot = path.join(repoRoot, "apps", "web-next")
const nextBin = path.join(repoRoot, "node_modules", "next", "dist", "bin", "next")

const apiPort = String(process.argv[2] || resolveGiomApiPort(process.env))
const webPort = String(process.argv[3] || resolveGiomWebPreviewPort(process.env))
const apiBaseUrl = resolveGiomApiBaseUrl({
  ...process.env,
  API_PORT: apiPort,
  PORT: apiPort
})

function createLogStream(fileName) {
  return openSync(path.join(repoRoot, "reports", fileName), "a")
}

function startDetached(command, args, options = {}) {
  const out = createLogStream(options.logFileName || "preview.log")
  const child = spawn(command, args, {
    cwd: options.cwd || repoRoot,
    detached: true,
    stdio: ["ignore", out, out],
    env: {
      ...process.env,
      ...options.env
    }
  })

  child.unref()
  return child
}

const apiChild = startDetached(process.execPath, ["apps/api/src/server.js"], {
  env: {
    PORT: apiPort,
    API_PORT: apiPort
  },
  logFileName: `api-preview-${apiPort}.log`
})

const webChild = startDetached(process.execPath, [nextBin, "start", "-p", webPort], {
  cwd: webRoot,
  env: {
    WEB_PREVIEW_PORT: webPort,
    NEXT_PUBLIC_BACKEND_PROXY_TARGET: apiBaseUrl
  },
  logFileName: `front-preview-${webPort}.log`
})

console.log(JSON.stringify({
  started: true,
  api: {
    pid: apiChild.pid,
    port: apiPort,
    baseUrl: apiBaseUrl
  },
  web: {
    pid: webChild.pid,
    port: webPort,
    baseUrl: `http://127.0.0.1:${webPort}`
  }
}, null, 2))
