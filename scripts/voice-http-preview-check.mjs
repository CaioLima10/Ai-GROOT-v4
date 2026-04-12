import process from "node:process"
import { spawn } from "node:child_process"

import {
  formatRecentLogs,
  startNodeProcess,
  stopChildProcess,
  waitForAnyUrl
} from "./runtime-qa-support.mjs"

const previewPort = String(process.env.GIOM_VOICE_PREVIEW_PORT || "3019").trim() || "3019"
const baseUrl = `http://127.0.0.1:${previewPort}`

let backendRuntime = null

async function runVoiceSmoke() {
  console.log(JSON.stringify({
    status: "running_voice_smoke",
    baseUrl
  }, null, 2))

  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/voice-http-smoke.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        GIOM_VOICE_SMOKE_BASE_URL: baseUrl
      },
      stdio: ["ignore", "pipe", "pipe"]
    })

    const timeout = setTimeout(() => {
      try {
        child.kill("SIGTERM")
      } catch {
        // noop
      }
      reject(new Error("voice-http-smoke excedeu o tempo limite de 210s"))
    }, 210_000)

    child.stdout?.on("data", (chunk) => {
      process.stdout.write(chunk)
    })

    child.stderr?.on("data", (chunk) => {
      process.stderr.write(chunk)
    })

    child.once("error", reject)
    child.once("exit", (code) => {
      clearTimeout(timeout)
      resolve(Number(code || 0))
    })
  })

  if (exitCode !== 0) {
    throw new Error(`voice-http-smoke saiu com codigo ${exitCode}`)
  }
}

try {
  console.log(JSON.stringify({
    status: "starting_voice_preview",
    baseUrl
  }, null, 2))

  backendRuntime = startNodeProcess("apps/api/src/server.js", {
    label: "voice-preview-api",
    env: {
      PORT: previewPort,
      API_PORT: previewPort,
      NODE_ENV: "test"
    }
  })

  const backendReady = await waitForAnyUrl([
    `${baseUrl}/health`,
    `${baseUrl}/config`,
    `${baseUrl}/v1/voice/providers/status`
  ], {
    timeoutMs: 90_000,
    accept: (response) => response.status >= 200 && response.status < 600
  })

  if (!backendReady) {
    throw new Error(`Preview de voz nao subiu em tempo habil em ${baseUrl}`)
  }

  console.log(JSON.stringify({
    status: "voice_preview_ready",
    baseUrl
  }, null, 2))

  await runVoiceSmoke()
} catch (error) {
  const details = formatRecentLogs(backendRuntime?.logs, 40)
  if (details) {
    console.error(details)
  }
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
} finally {
  await stopChildProcess(backendRuntime?.child).catch(() => {})
}
