#!/usr/bin/env node

import fs from "fs/promises"
import path from "path"
import { spawnSync } from "child_process"

async function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env")
  let raw
  try {
    raw = await fs.readFile(envPath, "utf8")
  } catch {
    return
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue
    const eqIdx = trimmed.indexOf("=")
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "")
    if (key && !(key in process.env)) {
      process.env[key] = value
    }
  }
}

function runCandidate(cmd, args = ["--version"]) {
  const result = spawnSync(cmd, args, { encoding: "utf8" })
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: String(result.stdout || "").trim(),
    stderr: String(result.stderr || "").trim()
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function detectPython() {
  const explicit = String(process.env.PYTHON_EXECUTABLE || "").trim()
  if (explicit) {
    const tested = runCandidate(explicit)
    if (tested.ok) return explicit
  }

  const direct = runCandidate("python")
  if (direct.ok) return "python"

  const py311 = runCandidate("py", ["-3.11", "--version"])
  if (py311.ok) return "py"

  const pyAny = runCandidate("py", ["--version"])
  if (pyAny.ok) return "py"

  const localUser = process.env.LOCALAPPDATA || ""
  const userProfile = process.env.USERPROFILE || ""
  const candidates = [
    `${localUser}\\Programs\\Python\\Python311\\python.exe`,
    `${localUser}\\Programs\\Python\\Python312\\python.exe`,
    `${userProfile}\\AppData\\Local\\Programs\\Python\\Python311\\python.exe`,
    `${userProfile}\\AppData\\Local\\Programs\\Python\\Python312\\python.exe`,
    "C:\\Python311\\python.exe",
    "C:\\Python312\\python.exe"
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (!(await exists(candidate))) continue
    const tested = runCandidate(candidate)
    if (tested.ok) return candidate
  }

  return null
}

async function main() {
  await loadDotEnv()

  const python = await detectPython()
  if (!python) {
    console.error("PYTHON_RUNNER_ERROR Python nao encontrado. Defina PYTHON_EXECUTABLE ou instale Python 3.11+")
    process.exit(1)
  }

  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.error("PYTHON_RUNNER_ERROR Nenhum argumento informado para executar Python")
    process.exit(1)
  }

  const finalArgs = python === "py" && args[0] !== "-3.11"
    ? ["-3.11", ...args]
    : args

  const child = spawnSync(python, finalArgs, {
    stdio: "inherit",
    shell: false,
    env: process.env
  })

  process.exit(child.status ?? 1)
}

main().catch((error) => {
  console.error(`PYTHON_RUNNER_ERROR ${error.message}`)
  process.exit(1)
})
