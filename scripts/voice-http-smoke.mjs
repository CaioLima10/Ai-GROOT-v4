#!/usr/bin/env node

import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function normalizeText(value, maxLength = 240) {
  const normalized = String(value || "").trim()
  if (!normalized) {
    return ""
  }

  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`
}

async function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env")
  let raw = ""

  try {
    raw = await fs.readFile(envPath, "utf8")
  } catch {
    return
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue
    }

    const separatorIndex = trimmed.indexOf("=")
    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "")
    if (key && !(key in process.env)) {
      process.env[key] = value
    }
  }
}

async function requestJson(baseUrl, routePath, options = {}) {
  const response = await fetch(`${baseUrl}${routePath}`, {
    method: options.method || "GET",
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  })

  const rawText = await response.text()
  let json = null

  try {
    json = rawText ? JSON.parse(rawText) : null
  } catch {
    throw new Error(`Resposta invalida em ${routePath}: ${normalizeText(rawText, 600)}`)
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} em ${routePath}: ${normalizeText(json?.error || rawText, 600)}`)
  }

  return json
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function waitForSessionEvents(baseUrl, sessionId, expectedEventTypes, options = {}) {
  const timeoutMs = Math.max(250, Number(options.timeoutMs || 4000) || 4000)
  const intervalMs = Math.max(50, Number(options.intervalMs || 150) || 150)
  const deadline = Date.now() + timeoutMs
  let sessionState = null

  while (Date.now() <= deadline) {
    sessionState = await requestJson(baseUrl, `/v1/realtime/sessions/${sessionId}`)
    const eventTypes = Array.isArray(sessionState?.events)
      ? sessionState.events.map((event) => String(event?.type || ""))
      : []

    if (expectedEventTypes.every((type) => eventTypes.includes(type))) {
      return sessionState
    }

    await sleep(intervalMs)
  }

  return sessionState
}

async function main() {
  await loadDotEnv()

  const baseUrl = normalizeText(process.env.GIOM_VOICE_SMOKE_BASE_URL || "http://127.0.0.1:3001", 200)
  const speechInput = "Qual e o estado atual da voz local do GIOM?"

  const providerStatus = await requestJson(baseUrl, "/v1/voice/providers/status")
  assert(providerStatus?.success === true, "voice providers status did not return success")
  assert(providerStatus?.providers?.stt?.available === true, "server STT provider is not available over HTTP")
  assert(providerStatus?.providers?.tts?.available === true, "server TTS provider is not available over HTTP")

  const config = await requestJson(baseUrl, "/config")
  assert(config?.features?.serverAudioTranscriptions === true, "config does not expose serverAudioTranscriptions=true")
  assert(config?.features?.serverAudioSpeech === true, "config does not expose serverAudioSpeech=true")
  assert(config?.features?.serverVad === true, "config does not expose serverVad=true")

  const speechEnvelope = await requestJson(baseUrl, "/v1/audio/speech", {
    method: "POST",
    body: {
      input: speechInput,
      language: "pt-BR",
      returnAudio: true
    }
  })

  const generatedAudio = speechEnvelope?.speech?.audio || speechEnvelope?.audio || null
  assert(speechEnvelope?.success === true, "speech endpoint did not return success")
  assert(generatedAudio?.audioBase64, "speech endpoint did not return server audio")

  const transcription = await requestJson(baseUrl, "/v1/audio/transcriptions", {
    method: "POST",
    body: {
      audioBase64: generatedAudio.audioBase64,
      mimeType: generatedAudio.mimeType || "audio/wav",
      language: "pt-BR",
      final: true
    }
  })

  assert(transcription?.success === true, "transcription endpoint did not return success")
  assert(normalizeText(transcription?.text, 120).length >= 1, "transcription endpoint returned empty text")

  const sessionEnvelope = await requestJson(baseUrl, "/v1/realtime/sessions", {
    method: "POST",
    body: {
      locale: "pt-BR"
    }
  })

  const sessionId = normalizeText(sessionEnvelope?.session?.sessionId, 120)
  assert(sessionEnvelope?.success === true && sessionId, "realtime session endpoint did not return a session id")

  const audioResponse = await requestJson(baseUrl, `/v1/realtime/sessions/${sessionId}/audio`, {
    method: "POST",
    body: {
      audioBase64: generatedAudio.audioBase64,
      mimeType: generatedAudio.mimeType || "audio/wav",
      language: "pt-BR",
      autoRespond: true,
      autoSpeak: true,
      returnAudio: true
    }
  })

  assert(audioResponse?.success === true, "realtime session audio endpoint did not return success")
  assert(normalizeText(audioResponse?.transcription?.text, 120).length >= 1, "realtime audio flow did not produce transcription text")
  assert(normalizeText(audioResponse?.response?.text, 240).length >= 1, "realtime audio flow did not produce assistant text")
  assert(audioResponse?.speech?.audio?.audioBase64, "realtime audio flow did not produce assistant audio")

  const sessionState = await waitForSessionEvents(baseUrl, sessionId, ["assistant.completed"], {
    timeoutMs: 5000,
    intervalMs: 150
  })
  const eventTypes = Array.isArray(sessionState?.events)
    ? sessionState.events.map((event) => String(event?.type || ""))
    : []

  assert(eventTypes.includes("transcription.final") || eventTypes.includes("transcription.appended"), "realtime session events are missing transcription event")
  assert(eventTypes.includes("assistant.completed"), "realtime session events are missing assistant completion")

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    providers: providerStatus.providers,
    transcriptionText: transcription.text,
    realtime: {
      sessionId,
      responseText: audioResponse.response.text,
      eventTypes
    }
  }))
  console.log("VOICE_HTTP_SMOKE_OK")
}

main().catch((error) => {
  console.error(`VOICE_HTTP_SMOKE_ERROR ${error?.message || error}`)
  process.exit(1)
})