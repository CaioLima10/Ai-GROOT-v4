import assert from "node:assert/strict"
import crypto from "node:crypto"
import path from "node:path"
import { spawn } from "node:child_process"
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

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase())
}

function runNodeScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit"
    })

    child.once("error", reject)
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`Smoke child exited with code ${code ?? "null"} and signal ${signal ?? "none"}`))
    })
  })
}

const args = parseCliArgs(process.argv.slice(2))
const port = toInteger(args.port || process.env.SMOKE_BUILT_PORT, 3015)
const baseUrl = `http://127.0.0.1:${port}`
const adminEnabled = isTruthy(args.admin || process.env.SMOKE_BUILT_ADMIN)
const adminKey = adminEnabled
  ? String(args["admin-key"] || process.env.SMOKE_ADMIN_KEY || `smoke_admin_${crypto.randomUUID()}`)
  : ""
const question = String(args.question || process.env.SMOKE_QUESTION || "me explique em uma frase o que e inteligencia artificial")

let serverProcess = null
let serverLogs = []

try {
  const started = startNodeProcess("apps/api/dist/server.js", {
    cwd: repoRoot,
    env: {
      PORT: String(port),
      GIOM_USE_TS_ROUTE_REGISTRARS: "true",
      ...(adminEnabled ? { ADMIN_DASH_KEY: adminKey } : {})
    },
    label: "smoke-enterprise-routes-built-v1"
  })
  serverProcess = started.child
  serverLogs = started.logs

  const isReady = await waitForUrl(`${baseUrl}/health`, {
    timeoutMs: 60_000,
    accept: (response) => response.status >= 200 && response.status < 600
  })

  assert.equal(isReady, true, `Compiled API did not become reachable at ${baseUrl}`)

  const smokeArgs = [
    "scripts/smoke-enterprise-routes-v1.mjs",
    `--base-url=${baseUrl}`,
    "--no-spawn=true",
    `--question=${question}`
  ]

  if (adminEnabled) {
    smokeArgs.push(`--admin-key=${adminKey}`)
  }

  await runNodeScript(smokeArgs[0], smokeArgs.slice(1))
} catch (error) {
  console.error(`smoke:enterprise:routes:built:v1 failed: ${error instanceof Error ? error.message : String(error)}`)

  if (serverLogs.length > 0) {
    console.error(formatRecentLogs(serverLogs))
  }

  process.exitCode = 1
} finally {
  if (serverProcess) {
    await stopChildProcess(serverProcess)
  }
}