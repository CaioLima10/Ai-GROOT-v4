#!/usr/bin/env node

import fs from "fs/promises"
import path from "path"
import { spawnSync } from "child_process"

const ROOT = process.cwd()
const ENV_PATH = path.join(ROOT, ".env")
const ENV_TEMPLATE_PATH = path.join(ROOT, "env-template.txt")

const BASE_ENV = {
  UPLOAD_EXTERNAL_READER_ENABLED: "true",
  UPLOAD_EXTERNAL_READER_URL: "http://127.0.0.1:8090",
  UPLOAD_EXTERNAL_READER_TIMEOUT_MS: "20000",
  DOC_READER_REDIS_URL: "redis://127.0.0.1:6379/0",
  DOC_READER_REDIS_QUEUE_KEY: "doc_reader:queue",
  DOC_READER_REDIS_DLQ_KEY: "doc_reader:dlq",
  DOC_READER_REDIS_JOB_KEY_PREFIX: "doc_reader:job:",
  UPLOAD_QUOTA_WINDOW_HOURS: "24",
  UPLOAD_QUOTA_ANON_PER_WINDOW: "5",
  UPLOAD_QUOTA_AUTH_PER_WINDOW: "9",
  UPLOAD_QUOTA_PAID_PER_WINDOW: "120",
  IMAGE_QUOTA_WINDOW_HOURS: "24",
  IMAGE_QUOTA_ANON_PER_WINDOW: "2",
  IMAGE_QUOTA_AUTH_PER_WINDOW: "4",
  IMAGE_QUOTA_PAID_PER_WINDOW: "80"
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: "utf8" })
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: String(result.stdout || "").trim(),
    stderr: String(result.stderr || "").trim()
  }
}

async function ensureEnvFile() {
  const envExists = await fs.access(ENV_PATH).then(() => true).catch(() => false)
  if (envExists) return

  const templateExists = await fs.access(ENV_TEMPLATE_PATH).then(() => true).catch(() => false)
  if (templateExists) {
    await fs.copyFile(ENV_TEMPLATE_PATH, ENV_PATH)
    return
  }

  await fs.writeFile(ENV_PATH, "", "utf8")
}

function upsertEnv(raw, entries) {
  const lines = String(raw || "").split(/\r?\n/)
  const indexMap = new Map()

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue
    const key = line.slice(0, line.indexOf("=")).trim()
    if (key) indexMap.set(key, i)
  }

  for (const [key, value] of Object.entries(entries)) {
    const line = `${key}=${value}`
    if (indexMap.has(key)) {
      lines[indexMap.get(key)] = line
    } else {
      lines.push(line)
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n"
}

async function setupEnv(entries) {
  await ensureEnvFile()
  const current = await fs.readFile(ENV_PATH, "utf8")
  const next = upsertEnv(current, entries)
  await fs.writeFile(ENV_PATH, next, "utf8")
}

function checkPython() {
  const python = run("python", ["--version"])
  if (python.ok) return { ok: true, cmd: "python", version: python.stdout || python.stderr }

  const py311 = run("py", ["-3.11", "--version"])
  if (py311.ok) return { ok: true, cmd: "py -3.11", version: py311.stdout || py311.stderr }

  const py = run("py", ["--version"])
  if (py.ok) return { ok: true, cmd: "py", version: py.stdout || py.stderr }

  const localAppData = process.env.LOCALAPPDATA || ""
  const userProfile = process.env.USERPROFILE || ""
  const candidates = [
    `${localAppData}\\Programs\\Python\\Python311\\python.exe`,
    `${localAppData}\\Programs\\Python\\Python312\\python.exe`,
    `${userProfile}\\AppData\\Local\\Programs\\Python\\Python311\\python.exe`,
    `${userProfile}\\AppData\\Local\\Programs\\Python\\Python312\\python.exe`,
    "C:\\Python311\\python.exe",
    "C:\\Python312\\python.exe"
  ].filter(Boolean)

  for (const candidate of candidates) {
    const tested = run(candidate, ["--version"])
    if (tested.ok) return { ok: true, cmd: candidate, version: tested.stdout || tested.stderr }
  }

  return { ok: false, error: python.stderr || py.stderr || "python unavailable" }
}

function checkDocker() {
  const cli = run("docker", ["--version"])
  if (!cli.ok) return { ok: false, stage: "cli", error: cli.stderr || cli.stdout }

  const daemon = run("docker", ["info", "--format", "{{.ServerVersion}}"])
  if (!daemon.ok) return { ok: false, stage: "daemon", error: daemon.stderr || daemon.stdout }

  return { ok: true, version: daemon.stdout }
}

function ensureRedisContainer() {
  const inspect = run("docker", ["inspect", "-f", "{{.State.Running}}", "giom-redis"])
  if (inspect.ok && /true/i.test(inspect.stdout)) {
    return { ok: true, action: "already-running" }
  }

  if (inspect.ok && /false/i.test(inspect.stdout)) {
    const start = run("docker", ["start", "giom-redis"])
    if (start.ok) return { ok: true, action: "started" }
    return { ok: false, action: "start-failed", error: start.stderr || start.stdout }
  }

  const runNew = run("docker", ["run", "-d", "--name", "giom-redis", "-p", "6379:6379", "redis:7-alpine"])
  if (runNew.ok) return { ok: true, action: "created" }
  return { ok: false, action: "create-failed", error: runNew.stderr || runNew.stdout }
}

async function main() {
  const python = checkPython()
  const docker = checkDocker()

  const requiredEnv = {
    ...BASE_ENV,
    DOC_READER_QUEUE_BACKEND: docker.ok ? "redis" : "memory"
  }

  await setupEnv(requiredEnv)

  let redis = { ok: false, action: "skipped" }
  if (docker.ok) {
    redis = ensureRedisContainer()
  }

  const summary = {
    envConfigured: true,
    python,
    docker,
    redis
  }

  console.log("BOOTSTRAP_RUNTIME_SUMMARY")
  console.log(JSON.stringify(summary, null, 2))

  if (!python.ok || (docker.ok && !redis.ok)) {
    process.exitCode = 2
  }
}

main().catch((error) => {
  console.error(`BOOTSTRAP_RUNTIME_ERROR ${error.message}`)
  process.exit(1)
})
