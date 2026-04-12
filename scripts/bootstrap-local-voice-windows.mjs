#!/usr/bin/env node

import fs from "fs/promises"
import { createWriteStream } from "fs"
import path from "path"
import { spawn } from "child_process"
import { Readable } from "stream"
import { pipeline } from "stream/promises"

const ROOT_DIR = process.cwd()
const CACHE_ROOT = path.join(ROOT_DIR, ".cache", "local-voice")
const DOWNLOAD_ROOT = path.join(CACHE_ROOT, "downloads")
const WHISPER_BIN_ROOT = path.join(CACHE_ROOT, "whispercpp")
const WHISPER_MODEL_ROOT = path.join(CACHE_ROOT, "models", "whisper")
const PIPER_MODEL_ROOT = path.join(CACHE_ROOT, "models", "piper")
const USER_AGENT = "ai-groot-local-voice-bootstrap"

function normalizeText(value, maxLength = 240) {
  const normalized = String(value || "").trim()
  if (!normalized) {
    return ""
  }

  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`
}

function getOptionValue(argv, name, fallback) {
  const prefix = `--${name}=`
  const match = argv.find((entry) => entry.startsWith(prefix))
  return match ? match.slice(prefix.length).trim() : fallback
}

function hasFlag(argv, name) {
  return argv.includes(`--${name}`)
}

function toRelativeEnvPath(filePath) {
  return path.relative(ROOT_DIR, filePath).replace(/\\/g, "/")
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/vnd.github+json"
    }
  })

  if (!response.ok) {
    throw new Error(`Falha ao consultar ${url}: HTTP ${response.status}`)
  }

  return await response.json()
}

async function downloadFile(url, destinationPath) {
  if (await pathExists(destinationPath)) {
    return destinationPath
  }

  await ensureDirectory(path.dirname(destinationPath))
  const tempPath = `${destinationPath}.tmp`
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT
    }
  })

  if (!response.ok || !response.body) {
    throw new Error(`Falha ao baixar ${url}: HTTP ${response.status}`)
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(tempPath))
  await fs.rename(tempPath, destinationPath)
  return destinationPath
}

async function runCommand(command, args = [], options = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || ROOT_DIR,
      env: {
        ...process.env,
        ...(options.env || {})
      },
      shell: false,
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
      windowsHide: true
    })

    let stdout = ""
    let stderr = ""

    if (options.capture) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString()
      })
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString()
      })
    }

    child.on("error", (error) => {
      reject(error)
    })

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }

      reject(new Error(
        `Comando falhou (${path.basename(command)} ${args.join(" ")}): ${normalizeText(stderr || stdout || `exit ${code}`, 1200)}`
      ))
    })
  })
}

async function resolvePowerShellExecutable() {
  const candidates = [
    process.env.POWERSHELL_EXE,
    process.env.SYSTEMROOT ? path.join(process.env.SYSTEMROOT, "System32", "WindowsPowerShell", "v1.0", "powershell.exe") : "",
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, "PowerShell", "7", "pwsh.exe") : ""
  ]
    .map((value) => normalizeText(value, 400))
    .filter(Boolean)

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate
    }
  }

  throw new Error("PowerShell nao encontrado para extrair o zip do whisper.cpp.")
}

async function extractZip(zipPath, destinationPath) {
  await ensureDirectory(destinationPath)
  const powerShellExecutable = await resolvePowerShellExecutable()
  await runCommand(powerShellExecutable, [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destinationPath.replace(/'/g, "''")}' -Force`
  ])
}

async function findFileRecursive(rootPath, fileName) {
  const entries = await fs.readdir(rootPath, { withFileTypes: true })

  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name)
    if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) {
      return entryPath
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const candidate = await findFileRecursive(path.join(rootPath, entry.name), fileName).catch(() => null)
    if (candidate) {
      return candidate
    }
  }

  return null
}

async function resolvePythonExecutable() {
  const candidates = [
    process.env.PYTHON_EXECUTABLE,
    path.join(ROOT_DIR, ".venv", "Scripts", "python.exe")
  ]
    .map((value) => normalizeText(value, 400))
    .filter(Boolean)

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate
    }
  }

  throw new Error("Python da venv nao encontrado. Configure o ambiente Python do workspace antes do bootstrap.")
}

async function installPiperRuntime(pythonExecutable) {
  await runCommand(pythonExecutable, [
    "-m",
    "pip",
    "install",
    "--disable-pip-version-check",
    "piper-tts"
  ])

  await runCommand(pythonExecutable, ["-m", "piper", "--help"], { capture: true })
}

async function resolveWhisperAssetUrl() {
  const release = await fetchJson("https://api.github.com/repos/ggml-org/whisper.cpp/releases/latest")
  const asset = Array.isArray(release.assets)
    ? release.assets.find((entry) => entry.name === "whisper-bin-x64.zip")
    || release.assets.find((entry) => /whisper(?:-blas)?-bin-x64\.zip/i.test(String(entry.name || "")))
    : null

  if (!asset?.browser_download_url) {
    throw new Error("Asset Windows x64 do whisper.cpp nao encontrado na release oficial.")
  }

  return {
    tag: String(release.tag_name || "latest"),
    name: String(asset.name || "whisper-bin-x64.zip"),
    url: String(asset.browser_download_url)
  }
}

async function ensureWhisperCli() {
  const existing = await findFileRecursive(WHISPER_BIN_ROOT, "whisper-cli.exe").catch(() => null)
  if (existing) {
    return existing
  }

  const asset = await resolveWhisperAssetUrl()
  const zipPath = path.join(DOWNLOAD_ROOT, asset.name)
  await downloadFile(asset.url, zipPath)
  await extractZip(zipPath, path.join(WHISPER_BIN_ROOT, asset.tag))

  const whisperCli = await findFileRecursive(WHISPER_BIN_ROOT, "whisper-cli.exe")
  if (!whisperCli) {
    throw new Error("whisper-cli.exe nao foi encontrado apos extrair o asset oficial.")
  }

  await runCommand(whisperCli, ["-h"], { capture: true })
  return whisperCli
}

async function ensureWhisperModel(modelId) {
  const normalizedId = normalizeText(modelId || "base", 80).toLowerCase() || "base"
  const fileName = normalizedId.startsWith("ggml-")
    ? (normalizedId.endsWith(".bin") ? normalizedId : `${normalizedId}.bin`)
    : `ggml-${normalizedId}${normalizedId.endsWith(".bin") ? "" : ".bin"}`
  const destinationPath = path.join(WHISPER_MODEL_ROOT, fileName)
  const url = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${fileName}?download=true`

  await downloadFile(url, destinationPath)
  return destinationPath
}

async function ensurePiperVoice(voiceId, quality) {
  const normalizedVoice = normalizeText(voiceId || "faber", 80).toLowerCase() || "faber"
  const normalizedQuality = normalizeText(quality || "medium", 40).toLowerCase() || "medium"
  const fileBase = `pt_BR-${normalizedVoice}-${normalizedQuality}`
  const baseUrl = `https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/pt/pt_BR/${normalizedVoice}/${normalizedQuality}`
  const modelPath = path.join(PIPER_MODEL_ROOT, `${fileBase}.onnx`)
  const configPath = path.join(PIPER_MODEL_ROOT, `${fileBase}.onnx.json`)

  await downloadFile(`${baseUrl}/${fileBase}.onnx?download=true`, modelPath)
  await downloadFile(`${baseUrl}/${fileBase}.onnx.json?download=true`, configPath)

  return {
    modelPath,
    configPath
  }
}

async function upsertEnvFile(envPath, updates) {
  let raw = ""
  try {
    raw = await fs.readFile(envPath, "utf8")
  } catch {
    raw = ""
  }

  const lines = raw ? raw.split(/\r?\n/) : []
  const seen = new Set()
  const nextLines = lines.map((line) => {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)
    if (!match) {
      return line
    }

    const key = match[1]
    if (!(key in updates)) {
      return line
    }

    seen.add(key)
    return `${key}=${updates[key]}`
  })

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) {
      nextLines.push(`${key}=${value}`)
    }
  }

  const serialized = `${nextLines.filter((line, index, all) => !(index === all.length - 1 && line === "")).join("\r\n")}\r\n`
  await fs.writeFile(envPath, serialized, "utf8")
}

async function main() {
  if (process.platform !== "win32") {
    throw new Error("Este bootstrap foi criado para Windows.")
  }

  const argv = process.argv.slice(2)
  const whisperModel = getOptionValue(argv, "whisper-model", "base")
  const piperVoice = getOptionValue(argv, "piper-voice", "faber")
  const piperQuality = getOptionValue(argv, "piper-quality", "medium")
  const shouldPersistEnv = !hasFlag(argv, "no-env")

  await ensureDirectory(DOWNLOAD_ROOT)
  await ensureDirectory(WHISPER_MODEL_ROOT)
  await ensureDirectory(PIPER_MODEL_ROOT)

  const pythonExecutable = await resolvePythonExecutable()
  const whisperCliPath = await ensureWhisperCli()
  const whisperModelPath = await ensureWhisperModel(whisperModel)
  await installPiperRuntime(pythonExecutable)
  const piperVoiceAssets = await ensurePiperVoice(piperVoice, piperQuality)

  const envUpdates = {
    GIOM_VOICE_STT_PROVIDER: "whisper.cpp",
    GIOM_WHISPER_CPP_COMMAND: toRelativeEnvPath(whisperCliPath),
    GIOM_WHISPER_CPP_MODEL: toRelativeEnvPath(whisperModelPath),
    GIOM_WHISPER_CPP_ARGS: "",
    GIOM_VOICE_TTS_PROVIDER: "piper",
    GIOM_PIPER_COMMAND: toRelativeEnvPath(pythonExecutable),
    GIOM_PIPER_MODEL: toRelativeEnvPath(piperVoiceAssets.modelPath),
    GIOM_PIPER_ARGS: "-m piper --model %MODEL% --output_file %OUTPUT%",
    GIOM_PIPER_SPEAKER: "",
    GIOM_VOICE_SERVER_VAD_ENABLED: "true"
  }

  if (shouldPersistEnv) {
    await upsertEnvFile(path.join(ROOT_DIR, ".env"), envUpdates)
  }

  console.log(JSON.stringify({
    success: true,
    persistedEnv: shouldPersistEnv,
    whisper: {
      command: envUpdates.GIOM_WHISPER_CPP_COMMAND,
      model: envUpdates.GIOM_WHISPER_CPP_MODEL
    },
    piper: {
      command: envUpdates.GIOM_PIPER_COMMAND,
      args: envUpdates.GIOM_PIPER_ARGS,
      model: envUpdates.GIOM_PIPER_MODEL
    }
  }, null, 2))
}

main().catch((error) => {
  console.error(`LOCAL_VOICE_BOOTSTRAP_ERROR ${error.message}`)
  process.exit(1)
})