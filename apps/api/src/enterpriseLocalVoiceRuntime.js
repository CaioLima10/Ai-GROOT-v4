import { accessSync, constants } from "fs"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { spawn } from "child_process"
import { resolveCloudTtsProvider } from "./enterpriseCloudTtsProviders.js"

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {}
}

function normalizeText(value, maxLength = 240) {
  const normalized = String(value || "").trim()
  if (!normalized) {
    return ""
  }

  return normalized.length <= maxLength
    ? normalized
    : normalized.slice(0, Math.max(0, maxLength - 3)).trim() + "..."
}

function normalizeBase64(value, maxLength = 6_000_000) {
  const normalized = String(value || "").replace(/\s+/g, "").trim()
  if (!normalized) {
    return ""
  }

  return normalized.length <= maxLength ? normalized : normalized.slice(0, maxLength)
}

function pathBaseName(value) {
  const normalized = normalizeText(value, 400)
  if (!normalized) {
    return null
  }

  return path.basename(normalized)
}

function normalizeFileSystemPath(value, maxLength = 400) {
  const normalized = normalizeText(value, maxLength)
  if (!normalized) {
    return ""
  }

  if (
    (normalized.startsWith('"') && normalized.endsWith('"'))
    || (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    return normalized.slice(1, -1).trim()
  }

  return normalized
}

function resolvePathCandidate(value) {
  const normalized = normalizeFileSystemPath(value, 400)
  if (!normalized) {
    return ""
  }

  return path.isAbsolute(normalized)
    ? normalized
    : path.resolve(process.cwd(), normalized)
}

function canAccessPath(filePath) {
  const normalized = normalizeText(filePath, 1200)
  if (!normalized) {
    return false
  }

  try {
    accessSync(normalized, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function resolveCommandAvailability(command) {
  const normalized = normalizeFileSystemPath(command, 400)
  if (!normalized) {
    return {
      available: false,
      reason: "command_not_configured",
      resolvedCommand: null,
      source: "missing"
    }
  }

  if (path.isAbsolute(normalized) || normalized.includes("/") || normalized.includes("\\")) {
    const explicitPath = resolvePathCandidate(normalized)
    return canAccessPath(explicitPath)
      ? {
        available: true,
        reason: null,
        resolvedCommand: explicitPath,
        source: "explicit"
      }
      : {
        available: false,
        reason: "command_not_found",
        resolvedCommand: null,
        source: "explicit"
      }
  }

  const pathEntries = String(process.env.PATH || "")
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean)

  const extensions = process.platform === "win32"
    ? (path.extname(normalized)
      ? [""]
      : String(process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM")
        .split(";")
        .map((entry) => entry.trim())
        .filter(Boolean))
    : [""]

  for (const directory of pathEntries) {
    for (const extension of extensions) {
      const candidate = path.join(directory, `${normalized}${extension}`)
      if (canAccessPath(candidate)) {
        return {
          available: true,
          reason: null,
          resolvedCommand: candidate,
          source: "path"
        }
      }
    }
  }

  return {
    available: false,
    reason: "command_not_found",
    resolvedCommand: null,
    source: "path"
  }
}

function resolveModelAvailability(model) {
  const normalized = normalizeFileSystemPath(model, 400)
  if (!normalized) {
    return {
      available: false,
      reason: "model_not_configured",
      resolvedPath: null
    }
  }

  const resolvedPath = resolvePathCandidate(normalized)
  return canAccessPath(resolvedPath)
    ? {
      available: true,
      reason: null,
      resolvedPath
    }
    : {
      available: false,
      reason: "model_not_found",
      resolvedPath: null
    }
}

function buildProviderStatus(baseStatus, checks = {}) {
  const commandAvailable = checks.command?.available !== false
  const modelAvailable = checks.model?.available !== false
  const available = Boolean(baseStatus.configured && commandAvailable && modelAvailable)
  const issues = []

  if (!checks.command?.available && checks.command?.reason) {
    issues.push(checks.command.reason)
  }

  if (!checks.model?.available && checks.model?.reason) {
    issues.push(checks.model.reason)
  }

  return {
    ...baseStatus,
    available,
    reason: issues[0] || null,
    issues,
    checks: {
      commandFound: checks.command?.available ?? null,
      modelFound: checks.model?.available ?? null
    }
  }
}

function buildLocalVoiceError(message, code, statusCode = 400, details = undefined) {
  const error = new Error(message)
  error.code = code
  error.statusCode = statusCode
  if (details !== undefined) {
    error.details = details
  }
  return error
}

function parseAudioDataUrl(dataUrl = "") {
  const match = /^data:([^;,]+)?;base64,(.+)$/i.exec(String(dataUrl || "").trim())
  if (!match) {
    return null
  }

  return {
    mimeType: normalizeText(match[1] || "application/octet-stream", 80) || "application/octet-stream",
    base64: normalizeBase64(match[2] || "")
  }
}

function inferMimeTypeFromFileName(fileName = "") {
  const lower = String(fileName || "").trim().toLowerCase()
  if (!lower) {
    return ""
  }

  if (lower.endsWith(".wav")) return "audio/wav"
  if (lower.endsWith(".webm")) return "audio/webm"
  if (lower.endsWith(".ogg")) return "audio/ogg"
  if (lower.endsWith(".mp3")) return "audio/mpeg"
  if (lower.endsWith(".m4a")) return "audio/mp4"
  return ""
}

function inferExtensionFromMimeType(mimeType = "", fallback = ".bin") {
  const normalized = String(mimeType || "").toLowerCase()
  if (normalized.includes("wav")) return ".wav"
  if (normalized.includes("webm")) return ".webm"
  if (normalized.includes("ogg")) return ".ogg"
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return ".mp3"
  if (normalized.includes("mp4") || normalized.includes("m4a")) return ".m4a"
  return fallback
}

function decodeAudioInput(input = {}) {
  const body = normalizeObject(input)
  const directBase64 = normalizeBase64(body.audioBase64)
  const dataUrlPayload = !directBase64 ? parseAudioDataUrl(body.audioDataUrl || body.audio) : null
  const base64 = directBase64 || dataUrlPayload?.base64 || ""

  if (!base64) {
    return null
  }

  const mimeType = normalizeText(
    body.mimeType || dataUrlPayload?.mimeType || inferMimeTypeFromFileName(body.fileName),
    80
  ) || "application/octet-stream"

  let buffer = null
  try {
    buffer = Buffer.from(base64, "base64")
  } catch {
    throw buildLocalVoiceError("Audio base64 invalido para processamento server-side.", "VOICE_AUDIO_BASE64_INVALID", 400)
  }

  if (!buffer || buffer.length === 0) {
    throw buildLocalVoiceError("Payload de audio vazio para processamento server-side.", "VOICE_AUDIO_EMPTY", 400)
  }

  return {
    audioBase64: base64,
    audioBuffer: buffer,
    audioBytes: buffer.length,
    fileName: normalizeText(body.fileName, 240) || null,
    mimeType,
    sampleRate: Number(body.sampleRate || 0) || null,
    channels: Number(body.channels || 0) || null
  }
}

function splitArgumentString(value = "") {
  const source = String(value || "").trim()
  if (!source) {
    return []
  }

  const parts = []
  let current = ""
  let quote = null

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]

    if (quote) {
      if (char === quote) {
        quote = null
        continue
      }

      if (char === "\\" && source[index + 1] === quote) {
        current += quote
        index += 1
        continue
      }

      current += char
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (/\s/.test(char)) {
      if (current) {
        parts.push(current)
        current = ""
      }
      continue
    }

    current += char
  }

  if (current) {
    parts.push(current)
  }

  return parts
}

function replaceArgumentTokens(args = [], replacements = {}) {
  return args.map((entry) => String(entry || "").replace(/%([A-Z_]+)%/g, (_match, key) => {
    const value = replacements[key]
    return value == null ? "" : String(value)
  }))
}

function normalizeLanguage(language = "pt-BR") {
  return normalizeText(language || "pt-BR", 32) || "pt-BR"
}

function normalizeVoicePersonaId(value = "") {
  const normalized = normalizeText(value, 40).toLowerCase()
  if (normalized === "giom" || normalized === "diana") {
    return normalized
  }

  return ""
}

function normalizeLanguageForWhisper(language = "pt-BR") {
  const normalized = normalizeLanguage(language).toLowerCase()
  if (!normalized || normalized === "auto") {
    return "auto"
  }

  return normalized.split("-")[0] || "auto"
}

function extractTranscriptFromStdout(stdout = "") {
  const candidates = String(stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("[") && !/^whisper/i.test(line))

  if (!candidates.length) {
    return ""
  }

  return candidates.sort((left, right) => right.length - left.length)[0] || ""
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function withTempDirectory(prefix, callback) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix))
  try {
    return await callback(tempDir)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => { })
  }
}

async function runCommand(command, args = [], options = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    })

    let stdout = ""
    let stderr = ""
    let finished = false
    let timer = null

    const finalize = (callback) => {
      if (finished) {
        return
      }
      finished = true
      if (timer) {
        clearTimeout(timer)
      }
      callback()
    }

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })

    child.on("error", (error) => {
      finalize(() => {
        reject(buildLocalVoiceError(
          `Falha ao iniciar provider local de voz: ${error.message}`,
          "VOICE_PROVIDER_COMMAND_FAILED",
          503,
          {
            command: pathBaseName(command),
            args
          }
        ))
      })
    })

    child.on("close", (code, signal) => {
      finalize(() => {
        if (code === 0) {
          resolve({ code, signal, stdout, stderr })
          return
        }

        reject(buildLocalVoiceError(
          `Provider local de voz falhou com codigo ${code ?? "unknown"}.`,
          "VOICE_PROVIDER_EXECUTION_FAILED",
          503,
          {
            code,
            signal,
            command: pathBaseName(command),
            stderr: normalizeText(stderr, 800),
            stdout: normalizeText(stdout, 800)
          }
        ))
      })
    })

    if (Number(options.timeoutMs || 0) > 0) {
      timer = setTimeout(() => {
        if (finished) {
          return
        }

        child.kill("SIGTERM")
        finalize(() => {
          reject(buildLocalVoiceError(
            `Provider local de voz excedeu timeout de ${options.timeoutMs}ms.`,
            "VOICE_PROVIDER_TIMEOUT",
            504,
            {
              command: pathBaseName(command),
              args,
              timeoutMs: Number(options.timeoutMs || 0)
            }
          ))
        })
      }, Number(options.timeoutMs || 0))
    }

    if (options.inputBuffer) {
      child.stdin.write(options.inputBuffer)
    } else if (options.inputText) {
      child.stdin.write(String(options.inputText || ""))
    }
    child.stdin.end()
  })
}

function decodeWavPcm(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 44) {
    return null
  }

  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    return null
  }

  let offset = 12
  let format = null
  let dataChunk = null

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4)
    const chunkSize = buffer.readUInt32LE(offset + 4)
    const chunkStart = offset + 8
    const chunkEnd = chunkStart + chunkSize

    if (chunkEnd > buffer.length) {
      break
    }

    if (chunkId === "fmt ") {
      format = {
        audioFormat: buffer.readUInt16LE(chunkStart),
        channels: buffer.readUInt16LE(chunkStart + 2),
        sampleRate: buffer.readUInt32LE(chunkStart + 4),
        bitsPerSample: buffer.readUInt16LE(chunkStart + 14)
      }
    } else if (chunkId === "data") {
      dataChunk = {
        start: chunkStart,
        size: chunkSize
      }
      break
    }

    offset = chunkEnd + (chunkSize % 2)
  }

  if (!format || !dataChunk) {
    return null
  }

  const channels = Math.max(1, Number(format.channels || 1) || 1)
  const sampleRate = Math.max(8_000, Number(format.sampleRate || 16_000) || 16_000)
  const bitsPerSample = Number(format.bitsPerSample || 16) || 16
  const bytesPerSample = Math.max(1, bitsPerSample / 8)
  const frameSize = bytesPerSample * channels

  if (!Number.isInteger(frameSize) || frameSize <= 0) {
    return null
  }

  const frameCount = Math.floor(dataChunk.size / frameSize)
  if (!frameCount) {
    return null
  }

  const samples = new Float32Array(frameCount)

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    let monoSample = 0

    for (let channelIndex = 0; channelIndex < channels; channelIndex += 1) {
      const baseOffset = dataChunk.start + frameIndex * frameSize + channelIndex * bytesPerSample
      let sampleValue = 0

      if (format.audioFormat === 1 && bitsPerSample === 16) {
        sampleValue = buffer.readInt16LE(baseOffset) / 32768
      } else if (format.audioFormat === 1 && bitsPerSample === 8) {
        sampleValue = (buffer.readUInt8(baseOffset) - 128) / 128
      } else if (format.audioFormat === 3 && bitsPerSample === 32) {
        sampleValue = buffer.readFloatLE(baseOffset)
      } else {
        return null
      }

      monoSample += sampleValue
    }

    samples[frameIndex] = monoSample / channels
  }

  return {
    samples,
    sampleRate,
    channels,
    totalMs: Math.round((frameCount / sampleRate) * 1000)
  }
}

function analyzeWavVad(audioBuffer, options = {}) {
  const wav = decodeWavPcm(audioBuffer)
  if (!wav) {
    return {
      provider: "server-rms",
      available: false,
      supported: false,
      detected: null,
      reason: "wav_required_for_server_vad"
    }
  }

  const threshold = Math.max(0.01, Math.min(Number(options.threshold || 0.045) || 0.045, 0.6))
  const silenceMs = Math.max(200, Number(options.silenceMs || 1_200) || 1_200)
  const windowSamples = Math.max(160, Math.floor(wav.sampleRate * 0.03))
  const segments = []
  let currentSegment = null
  let peak = 0
  let rmsMax = 0

  for (let offset = 0; offset < wav.samples.length; offset += windowSamples) {
    const end = Math.min(offset + windowSamples, wav.samples.length)
    let sumSquares = 0
    let localPeak = 0

    for (let index = offset; index < end; index += 1) {
      const value = wav.samples[index]
      const absValue = Math.abs(value)
      localPeak = Math.max(localPeak, absValue)
      sumSquares += value * value
    }

    const rms = Math.sqrt(sumSquares / Math.max(1, end - offset))
    const startMs = Math.round((offset / wav.sampleRate) * 1000)
    const endMs = Math.round((end / wav.sampleRate) * 1000)
    const active = rms >= threshold

    peak = Math.max(peak, localPeak)
    rmsMax = Math.max(rmsMax, rms)

    if (active) {
      if (!currentSegment) {
        currentSegment = { startMs, endMs }
      } else {
        currentSegment.endMs = endMs
      }
      continue
    }

    if (currentSegment && startMs - currentSegment.endMs >= silenceMs) {
      segments.push({
        startMs: currentSegment.startMs,
        endMs: currentSegment.endMs,
        durationMs: Math.max(0, currentSegment.endMs - currentSegment.startMs)
      })
      currentSegment = null
    } else if (currentSegment) {
      currentSegment.endMs = endMs
    }
  }

  if (currentSegment) {
    segments.push({
      startMs: currentSegment.startMs,
      endMs: currentSegment.endMs,
      durationMs: Math.max(0, currentSegment.endMs - currentSegment.startMs)
    })
  }

  const filteredSegments = segments.filter((segment) => segment.durationMs >= 120)
  const speechMs = filteredSegments.reduce((sum, segment) => sum + segment.durationMs, 0)

  return {
    provider: "server-rms",
    available: true,
    supported: true,
    detected: filteredSegments.length > 0,
    threshold,
    sampleRate: wav.sampleRate,
    channels: wav.channels,
    totalMs: wav.totalMs,
    speechMs,
    peak: Number(peak.toFixed(4)),
    rms: Number(rmsMax.toFixed(4)),
    segments: filteredSegments.slice(0, 16)
  }
}

function createWhisperCppSttProvider(options = {}) {
  const command = normalizeFileSystemPath(options.command || process.env.GIOM_WHISPER_CPP_COMMAND || "", 400)
  const model = normalizeFileSystemPath(options.model || process.env.GIOM_WHISPER_CPP_MODEL || "", 400)

  const timeoutMs = Math.max(5_000, Number(options.timeoutMs || process.env.GIOM_VOICE_STT_TIMEOUT_MS || 120_000) || 120_000)
  const argsTemplate = normalizeText(options.argsTemplate || process.env.GIOM_WHISPER_CPP_ARGS || "", 1200)
  const commandCheck = resolveCommandAvailability(command)
  const modelCheck = resolveModelAvailability(model)
  const status = buildProviderStatus({
    id: "whisper.cpp",
    kind: "stt",
    requested: true,
    configured: Boolean(command && model),
    mode: "cli",
    command: pathBaseName(command),
    model: pathBaseName(model),
    timeoutMs
  }, {
    command: commandCheck,
    model: modelCheck
  })

  return {
    id: "whisper.cpp",
    kind: "stt",
    getStatus() {
      return status
    },
    async transcribe(input = {}) {
      if (!status.available) {
        throw buildLocalVoiceError(
          "Provider whisper.cpp nao esta operacional nesta runtime.",
          "VOICE_STT_PROVIDER_NOT_READY",
          503,
          {
            provider: status
          }
        )
      }

      const audio = normalizeObject(input.audio)
      if (!Buffer.isBuffer(audio.audioBuffer) || audio.audioBuffer.length === 0) {
        throw buildLocalVoiceError("Audio obrigatorio para transcricao server-side.", "VOICE_AUDIO_REQUIRED", 400)
      }

      return await withTempDirectory("giom-whisper-", async (tempDir) => {
        const inputPath = path.join(tempDir, `input${inferExtensionFromMimeType(audio.mimeType, ".wav")}`)
        const outputBase = path.join(tempDir, "transcript")
        const whisperLanguage = normalizeLanguageForWhisper(input.language || input.locale || "pt-BR")
        const replacements = {
          INPUT: inputPath,
          LANGUAGE: whisperLanguage,
          MODEL: modelCheck.resolvedPath || model,
          OUTPUT_BASENAME: outputBase,
          REQUEST_ID: normalizeText(input.requestId, 120),
          SESSION_ID: normalizeText(input.sessionId, 120)
        }

        await fs.writeFile(inputPath, audio.audioBuffer)

        const args = argsTemplate
          ? replaceArgumentTokens(splitArgumentString(argsTemplate), replacements)
          : [
            "-m", modelCheck.resolvedPath || model,
            "-f", inputPath,
            "-otxt",
            "-of", outputBase,
            "-l", whisperLanguage
          ]

        const execution = await runCommand(commandCheck.resolvedCommand || command, args, { timeoutMs })
        const textFilePath = `${outputBase}.txt`
        const text = await (async () => {
          if (await pathExists(textFilePath)) {
            return String(await fs.readFile(textFilePath, "utf8")).trim()
          }
          return extractTranscriptFromStdout(execution.stdout)
        })()

        if (!text) {
          throw buildLocalVoiceError(
            "whisper.cpp nao retornou texto transcrito.",
            "VOICE_STT_EMPTY_RESULT",
            502,
            {
              command: pathBaseName(command),
              model: pathBaseName(model)
            }
          )
        }

        return {
          object: "transcription",
          id: `transcript_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          provider: "whisper.cpp",
          model: pathBaseName(model),
          text,
          language: normalizeLanguage(input.language || input.locale || "pt-BR"),
          durationMs: null,
          confidence: null,
          final: input.final !== false,
          segments: [],
          source: "server_audio"
        }
      })
    }
  }
}

function createPiperTtsProvider(options = {}) {
  const command = normalizeFileSystemPath(options.command || process.env.GIOM_PIPER_COMMAND || "", 400)
  const model = normalizeFileSystemPath(options.model || process.env.GIOM_PIPER_MODEL || "", 400)

  const timeoutMs = Math.max(5_000, Number(options.timeoutMs || process.env.GIOM_VOICE_TTS_TIMEOUT_MS || 60_000) || 60_000)
  const argsTemplate = normalizeText(options.argsTemplate || process.env.GIOM_PIPER_ARGS || "", 1200)
  const configuredSpeaker = normalizeText(options.speaker || process.env.GIOM_PIPER_SPEAKER || "", 120)
  const configuredPersonas = normalizeObject(options.personas)
  const commandCheck = resolveCommandAvailability(command)
  const modelCheck = resolveModelAvailability(model)
  const status = buildProviderStatus({
    id: "piper",
    kind: "tts",
    requested: true,
    configured: Boolean(command && model),
    mode: "cli",
    command: pathBaseName(command),
    model: pathBaseName(model),
    speaker: configuredSpeaker || null,
    timeoutMs
  }, {
    command: commandCheck,
    model: modelCheck
  })

  const defaultModelPath = modelCheck.resolvedPath || model
  const defaultModelLabel = pathBaseName(defaultModelPath || model) || null
  const personas = ["giom", "diana"].map((personaId) => {
    const personaOptions = normalizeObject(configuredPersonas[personaId])
    const envPrefix = `GIOM_PIPER_${personaId.toUpperCase()}`
    const personaModel = normalizeFileSystemPath(
      personaOptions.model
      || process.env[`${envPrefix}_MODEL`]
      || (personaId === "giom" ? model : ""),
      400
    )
    const personaSpeaker = normalizeText(
      personaOptions.speaker
      || process.env[`${envPrefix}_SPEAKER`]
      || (personaId === "giom" ? configuredSpeaker : ""),
      120
    )
    const personaModelCheck = personaModel && personaModel !== model
      ? resolveModelAvailability(personaModel)
      : modelCheck
    const hasDedicatedOverride = Boolean(
      (personaModel && personaModel !== model)
      || (personaSpeaker && personaSpeaker !== configuredSpeaker)
    )
    const serverAudioAvailable = Boolean(
      status.available
      && personaModelCheck.available
      && (personaId === "giom" || hasDedicatedOverride || personaSpeaker)
    )

    return {
      id: personaId,
      voice: personaId,
      label: personaId === "giom" ? "GIOM" : "DIANA",
      tone: personaId === "giom" ? "masculina" : "feminina",
      summary: personaId === "giom"
        ? "Voz principal do assistente no servidor."
        : "Voz alternativa acolhedora no servidor.",
      speaker: personaSpeaker || null,
      modelPath: personaModelCheck.resolvedPath || personaModel || defaultModelPath || model,
      model: pathBaseName(personaModelCheck.resolvedPath || personaModel || defaultModelPath || model) || defaultModelLabel,
      provider: status.id,
      serverAudioAvailable,
      fallbackMode: "browser-assisted"
    }
  })

  function getPersonas() {
    return personas.map(({ modelPath, ...persona }) => ({ ...persona }))
  }

  function resolveVoiceSelection(requestedVoice = "") {
    const requested = normalizeText(requestedVoice, 120)
    const requestedPersonaId = normalizeVoicePersonaId(requested)
    const persona = requestedPersonaId
      ? personas.find((entry) => entry.id === requestedPersonaId) || null
      : null

    if (persona && !persona.serverAudioAvailable) {
      throw buildLocalVoiceError(
        `A persona de voz ${persona.label} ainda nao esta configurada no servidor.`,
        "VOICE_TTS_PERSONA_UNAVAILABLE",
        503,
        {
          persona,
          provider: status
        }
      )
    }

    return {
      persona,
      publicVoice: persona?.voice || requested || configuredSpeaker || defaultModelLabel,
      speaker: persona?.speaker || normalizeText(requested || configuredSpeaker, 120),
      modelPath: persona?.modelPath || defaultModelPath || model,
      modelLabel: persona?.model || defaultModelLabel
    }
  }

  return {
    id: "piper",
    kind: "tts",
    getStatus() {
      return {
        ...status,
        personas: getPersonas()
      }
    },
    getPersonas,
    async synthesize(input = {}) {
      if (!status.available) {
        throw buildLocalVoiceError(
          "Provider Piper nao esta operacional nesta runtime.",
          "VOICE_TTS_PROVIDER_NOT_READY",
          503,
          {
            provider: status
          }
        )
      }

      const text = normalizeText(input.text, 1_600)
      if (!text) {
        throw buildLocalVoiceError("Texto obrigatorio para sintese server-side.", "VOICE_TTS_TEXT_REQUIRED", 400)
      }

      const resolvedVoice = resolveVoiceSelection(input.voice)

      return await withTempDirectory("giom-piper-", async (tempDir) => {
        const outputPath = path.join(tempDir, "speech.wav")
        const replacements = {
          LANGUAGE: normalizeLanguage(input.language || "pt-BR"),
          MODEL: resolvedVoice.modelPath || defaultModelPath || model,
          OUTPUT: outputPath,
          REQUEST_ID: normalizeText(input.requestId, 120),
          SESSION_ID: normalizeText(input.sessionId, 120),
          SPEAKER: resolvedVoice.speaker
        }

        const args = argsTemplate
          ? replaceArgumentTokens(splitArgumentString(argsTemplate), replacements)
          : [
            "--model", resolvedVoice.modelPath || defaultModelPath || model,
            "--output_file", outputPath,
            ...(replacements.SPEAKER ? ["--speaker", replacements.SPEAKER] : [])
          ]

        await runCommand(commandCheck.resolvedCommand || command, args, {
          inputText: text,
          timeoutMs
        })

        if (!(await pathExists(outputPath))) {
          throw buildLocalVoiceError(
            "Piper nao produziu o arquivo de audio esperado.",
            "VOICE_TTS_EMPTY_RESULT",
            502,
            {
              command: pathBaseName(command),
              model: pathBaseName(model)
            }
          )
        }

        const audioBuffer = await fs.readFile(outputPath)
        return {
          provider: "piper",
          model: resolvedVoice.modelLabel || defaultModelLabel,
          format: "wav",
          mimeType: "audio/wav",
          language: normalizeLanguage(input.language || "pt-BR"),
          voice: resolvedVoice.publicVoice || resolvedVoice.modelLabel || defaultModelLabel,
          persona: resolvedVoice.persona
            ? {
              id: resolvedVoice.persona.id,
              label: resolvedVoice.persona.label,
              tone: resolvedVoice.persona.tone
            }
            : null,
          audioBase64: audioBuffer.toString("base64"),
          audioBytes: audioBuffer.length,
          durationMs: null
        }
      })
    }
  }
}

function buildUnavailableProviderStatus(kind, requestedId, reason) {
  const normalizedId = normalizeText(requestedId || "disabled", 40).toLowerCase() || "disabled"
  const requested = normalizedId !== "disabled" && normalizedId !== "off"

  return {
    id: normalizedId,
    kind,
    requested,
    configured: false,
    available: false,
    mode: requested ? "cli" : "disabled",
    reason: requested ? reason || "provider_unavailable" : "disabled",
    issues: requested ? [reason || "provider_unavailable"] : ["disabled"]
  }
}

export function createEnterpriseLocalVoiceRuntime(options = {}) {
  const logger = options.logger || null
  const requestedSttProvider = normalizeText(options.requestedSttProvider || process.env.GIOM_VOICE_STT_PROVIDER || "disabled", 40).toLowerCase() || "disabled"
  const requestedTtsProvider = normalizeText(options.requestedTtsProvider || process.env.GIOM_VOICE_TTS_PROVIDER || "disabled", 40).toLowerCase() || "disabled"
  const serverVadEnabled = options.serverVadEnabled !== false && process.env.GIOM_VOICE_SERVER_VAD_ENABLED !== "false"

  const sttProvider = options.sttProvider
    || ((requestedSttProvider === "whisper.cpp" || requestedSttProvider === "whispercpp" || requestedSttProvider === "auto")
      ? createWhisperCppSttProvider(options.stt)
      : null)

  const ttsProvider = options.ttsProvider
    || ((requestedTtsProvider === "piper" || requestedTtsProvider === "piper1-gpl")
      ? createPiperTtsProvider(options.tts)
      : null)
    || resolveCloudTtsProvider({
      requestedTtsProvider,
      elevenlabs: options.elevenlabs,
      openai: options.openai
    })

  function getFallbackOrder() {
    return ["server-local", "browser-assisted", "text-only"]
  }

  function getPersonas() {
    return ttsProvider?.getPersonas?.() || []
  }

  function getStatus() {
    const personas = getPersonas()
    return {
      stt: sttProvider?.getStatus?.() || buildUnavailableProviderStatus("stt", requestedSttProvider, "provider_unavailable"),
      tts: ttsProvider?.getStatus?.() || buildUnavailableProviderStatus("tts", requestedTtsProvider, "provider_unavailable"),
      vad: {
        id: "server-rms",
        kind: "vad",
        configured: serverVadEnabled,
        available: serverVadEnabled,
        mode: "in-process",
        supportedFormats: ["audio/wav", "audio/x-wav"]
      },
      fallbackOrder: getFallbackOrder(),
      personas
    }
  }

  function buildSessionCapabilities() {
    const status = getStatus()
    const namedVoices = status.personas
      .filter((persona) => persona.serverAudioAvailable)
      .map((persona) => persona.id)
    return {
      transcriptions: true,
      speech: true,
      vad: true,
      realtime: true,
      browserAssisted: true,
      serverTranscriptions: Boolean(status.stt.available),
      serverSpeech: Boolean(status.tts.available),
      serverVad: Boolean(status.vad.available),
      namedVoices,
      provider: status.stt.available || status.tts.available
        ? "server-local+browser-fallback"
        : "browser-assisted-local",
      fallbackOrder: status.fallbackOrder
    }
  }

  function hasServerTranscriptions() {
    return Boolean(sttProvider?.transcribe && sttProvider?.getStatus?.()?.available)
  }

  function hasServerSpeech() {
    return Boolean(ttsProvider?.synthesize && ttsProvider?.getStatus?.()?.available)
  }

  async function analyzeVad(input = {}) {
    if (!serverVadEnabled) {
      return {
        provider: "server-rms",
        available: false,
        supported: false,
        detected: null,
        reason: "server_vad_disabled"
      }
    }

    const audio = decodeAudioInput(input)
    if (!audio) {
      return {
        provider: "server-rms",
        available: false,
        supported: false,
        detected: null,
        reason: "audio_required"
      }
    }

    return analyzeWavVad(audio.audioBuffer, input.vad)
  }

  async function transcribe(input = {}) {
    const audio = decodeAudioInput(input)
    if (!audio) {
      throw buildLocalVoiceError("Audio obrigatorio para transcricao server-side.", "VOICE_AUDIO_REQUIRED", 400)
    }

    if (!hasServerTranscriptions()) {
      throw buildLocalVoiceError(
        "Transcricao local server-side nao configurada nesta runtime.",
        "VOICE_STT_UNAVAILABLE",
        503,
        {
          providers: getStatus()
        }
      )
    }

    const vad = await analyzeVad({ ...input, audioBase64: audio.audioBase64, mimeType: audio.mimeType }).catch(() => null)
    const payload = await sttProvider.transcribe({
      ...input,
      audio,
      requestId: normalizeText(input.requestId, 120) || null,
      sessionId: normalizeText(input.sessionId, 120) || null
    })

    const result = {
      ...normalizeObject(payload),
      language: normalizeLanguage(payload.language || input.language || input.locale || "pt-BR"),
      final: payload.final !== false,
      source: payload.source || "server_audio",
      audioMeta: {
        mimeType: audio.mimeType,
        audioBytes: audio.audioBytes,
        fileName: audio.fileName || null
      },
      vad: vad || null
    }

    logger?.info?.(input.requestId || "voice_stt", "VOICE_LOCAL_STT_COMPLETED", {
      provider: result.provider,
      sessionId: input.sessionId || null,
      hasVad: Boolean(vad)
    })

    return result
  }

  async function synthesize(input = {}) {
    if (!hasServerSpeech()) {
      throw buildLocalVoiceError(
        "Sintese local server-side nao configurada nesta runtime.",
        "VOICE_TTS_UNAVAILABLE",
        503,
        {
          providers: getStatus()
        }
      )
    }

    const result = await ttsProvider.synthesize({
      ...input,
      requestId: normalizeText(input.requestId, 120) || null,
      sessionId: normalizeText(input.sessionId, 120) || null
    })

    logger?.info?.(input.requestId || "voice_tts", "VOICE_LOCAL_TTS_COMPLETED", {
      provider: result.provider,
      sessionId: input.sessionId || null,
      audioBytes: result.audioBytes || 0
    })

    return {
      ...normalizeObject(result),
      dataUrl: result.audioBase64
        ? `data:${result.mimeType || "audio/wav"};base64,${result.audioBase64}`
        : null
    }
  }

  return {
    analyzeVad,
    buildSessionCapabilities,
    getFallbackOrder,
    getPersonas,
    getStatus,
    hasServerSpeech,
    hasServerTranscriptions,
    synthesize,
    transcribe
  }
}