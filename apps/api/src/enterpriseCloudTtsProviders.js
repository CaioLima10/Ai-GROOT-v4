/**
 * Free TTS provider: Microsoft Edge TTS (neural voices)
 *
 * 100% FREE — no API key needed.
 * Uses the `edge-tts` Python CLI (pip install edge-tts).
 * Neural voices sound natural and support pt-BR, en-US, he-IL, el-GR, etc.
 *
 * Plugs into createEnterpriseLocalVoiceRuntime as `ttsProvider`.
 * Same contract as the Piper provider:
 *   - getStatus()
 *   - getPersonas()
 *   - synthesize({ text, language, voice, requestId, sessionId })
 *
 * Environment variables:
 *   GIOM_VOICE_TTS_PROVIDER  – "edge" | "piper" | "auto" | "disabled"
 *   EDGE_TTS_GIOM_VOICE      – Male voice (default: pt-BR-AntonioNeural)
 *   EDGE_TTS_DIANA_VOICE     – Female voice (default: pt-BR-FranciscaNeural)
 *   EDGE_TTS_COMMAND         – Python executable (default: .venv/Scripts/python.exe or python3)
 */

import { randomUUID } from "crypto"
import { spawn } from "child_process"
import { existsSync } from "fs"
import fs from "fs/promises"
import os from "os"
import path from "path"

function normalizeText(value, maxLength = 240) {
  const normalized = String(value || "").trim()
  return normalized.length <= maxLength
    ? normalized
    : normalized.slice(0, Math.max(0, maxLength - 3)).trim() + "..."
}

// ---------------------------------------------------------------------------
// Edge TTS via Python CLI (edge-tts package)
// ---------------------------------------------------------------------------

function resolvePythonCommand() {
  const explicit = String(process.env.EDGE_TTS_COMMAND || "").trim()
  if (explicit) return explicit

  // Try common locations
  const isWin = os.platform() === "win32"
  const venvPaths = isWin
    ? [".venv/Scripts/python.exe", ".venv\\Scripts\\python.exe"]
    : [".venv/bin/python", ".venv/bin/python3"]

  for (const p of venvPaths) {
    try {
      const resolved = path.resolve(process.cwd(), p)
      if (existsSync(resolved)) return resolved
    } catch (_) { /* ignore */ }
  }

  return isWin ? "python" : "python3"
}

/**
 * Synthesize text to MP3 via edge-tts CLI.
 * Spawns: python -m edge_tts --text "..." --voice "..." --write-media <tmpfile>
 * Returns a Buffer with MP3 audio data.
 */
async function edgeTtsSynthesize(text, voiceName, timeoutMs = 30_000) {
  const pythonCmd = resolvePythonCommand()
  const tmpFile = path.join(os.tmpdir(), `edge-tts-${randomUUID()}.mp3`)

  try {
    await new Promise((resolve, reject) => {
      const args = ["-m", "edge_tts", "--text", text, "--voice", voiceName, "--write-media", tmpFile]
      const child = spawn(pythonCmd, args, {
        stdio: ["ignore", "pipe", "pipe"],
        timeout: timeoutMs,
        windowsHide: true
      })

      let stderr = ""
      child.stderr.on("data", (chunk) => { stderr += chunk.toString() })

      child.on("close", (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(Object.assign(
            new Error(`edge-tts failed (code ${code}): ${stderr.slice(0, 300)}`),
            { code: "VOICE_TTS_PROVIDER_ERROR", statusCode: 502 }
          ))
        }
      })

      child.on("error", (err) => {
        reject(Object.assign(
          new Error(`edge-tts spawn error: ${err.message}`),
          { code: "VOICE_TTS_PROVIDER_ERROR", statusCode: 502 }
        ))
      })
    })

    const audioBuffer = await fs.readFile(tmpFile)
    return audioBuffer
  } finally {
    // Clean up temp file
    fs.unlink(tmpFile).catch(() => { })
  }
}

// ---------------------------------------------------------------------------
// Edge TTS Provider (same contract as Piper)
// ---------------------------------------------------------------------------

export function createEdgeTtsProvider(options = {}) {
  const giomVoice = String(options.giomVoice || process.env.EDGE_TTS_GIOM_VOICE || "pt-BR-AntonioNeural").trim()
  const dianaVoice = String(options.dianaVoice || process.env.EDGE_TTS_DIANA_VOICE || "pt-BR-FranciscaNeural").trim()
  const timeoutMs = Number(options.timeoutMs || process.env.GIOM_VOICE_TTS_TIMEOUT_MS || 30_000)

  const personas = [
    {
      id: "giom",
      voice: "giom",
      label: "GIOM",
      tone: "masculina",
      summary: "Voz principal — Antonio Neural (Microsoft, gratuita).",
      provider: "edge-tts",
      model: "edge-neural",
      serverAudioAvailable: true,
      fallbackMode: "browser-assisted",
      edgeVoice: giomVoice
    },
    {
      id: "diana",
      voice: "diana",
      label: "DIANA",
      tone: "feminina",
      summary: "Voz acolhedora — Francisca Neural (Microsoft, gratuita).",
      provider: "edge-tts",
      model: "edge-neural",
      serverAudioAvailable: true,
      fallbackMode: "browser-assisted",
      edgeVoice: dianaVoice
    }
  ]

  function getStatus() {
    return {
      id: "edge-tts",
      kind: "tts",
      requested: true,
      configured: true,
      available: true,
      mode: "cloud-free",
      reason: null,
      issues: [],
      model: "edge-neural",
      personas: getPersonas()
    }
  }

  function getPersonas() {
    return personas.map(({ edgeVoice, ...p }) => p)
  }

  function resolveEdgeVoice(requestedVoice = "") {
    const requested = normalizeText(requestedVoice, 120).toLowerCase()
    const persona = personas.find((p) => p.id === requested || p.voice === requested)
    return persona?.edgeVoice || giomVoice
  }

  async function synthesize(input = {}) {
    const text = normalizeText(input.text, 4_000)
    if (!text) {
      const error = new Error("Texto obrigatorio para sintese.")
      error.code = "VOICE_TTS_TEXT_REQUIRED"
      error.statusCode = 400
      throw error
    }

    const edgeVoice = resolveEdgeVoice(input.voice)
    const audioBuffer = await edgeTtsSynthesize(text, edgeVoice, timeoutMs)

    const persona = personas.find((p) => p.edgeVoice === edgeVoice)

    return {
      provider: "edge-tts",
      model: "edge-neural",
      format: "mp3",
      mimeType: "audio/mpeg",
      language: normalizeText(input.language || "pt-BR", 10),
      voice: persona?.voice || edgeVoice,
      persona: persona
        ? { id: persona.id, label: persona.label, tone: persona.tone }
        : null,
      audioBase64: audioBuffer.toString("base64"),
      audioBytes: audioBuffer.length,
      durationMs: null
    }
  }

  return { id: "edge-tts", kind: "tts", getStatus, getPersonas, synthesize }
}

// ---------------------------------------------------------------------------
// Factory: pick provider by env var
// ---------------------------------------------------------------------------

export function resolveCloudTtsProvider(options = {}) {
  const requested = normalizeText(
    options.requestedTtsProvider
    || process.env.GIOM_VOICE_TTS_PROVIDER
    || "disabled",
    40
  ).toLowerCase()

  // Edge TTS — always available, 100% free, no API key
  if (requested === "edge" || requested === "edge-tts" || requested === "auto") {
    return createEdgeTtsProvider(options.edge)
  }

  return null
}
