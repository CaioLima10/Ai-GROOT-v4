import test from "node:test"
import assert from "node:assert/strict"

import {
  getAskContextDiagnostics,
  isGiomRenderableContent,
  normalizeGiomDataVariant,
  normalizeGiomMessageType,
  sanitizeAskContext
} from "../packages/shared-config/src/runtimeContracts.js"
import {
  extractAskResponseText,
  parseAskContextPayload,
  parseRealtimeSessionAudioRequestPayload,
  parseRealtimeSessionEnvelopePayload,
  parseRealtimeTranscriptionRequestPayload,
  parseRealtimeVoiceRespondRequestPayload,
  parseRuntimeConfigPayload
} from "../packages/shared-config/src/runtimeSchemas.js"

test("normalizeGiomMessageType only accepts supported card types", () => {
  assert.equal(normalizeGiomMessageType("CODE"), "code")
  assert.equal(normalizeGiomMessageType(" weather "), null)
  assert.equal(normalizeGiomMessageType("unknown"), null)
})

test("normalizeGiomDataVariant only accepts supported data variants", () => {
  assert.equal(normalizeGiomDataVariant("FiXtUrE"), "fixture")
  assert.equal(normalizeGiomDataVariant("timeline"), null)
})

test("isGiomRenderableContent accepts strings, arrays and plain objects", () => {
  assert.equal(isGiomRenderableContent("texto"), true)
  assert.equal(isGiomRenderableContent(["a", "b"]), true)
  assert.equal(isGiomRenderableContent({ ok: true }), true)
  assert.equal(isGiomRenderableContent(42), false)
})

test("sanitizeAskContext keeps only allowed keys and sanitizes nested values", () => {
  const context = sanitizeAskContext({
    channel: "web-next",
    assistantProfile: "auto",
    weatherLocation: {
      latitude: -23.55,
      longitude: -46.63,
      label: "Sao Paulo"
    },
    instructions: "a".repeat(2205),
    activeModules: ["developer", "research", "bible"],
    rogue: "should be removed",
    nested: {
      hidden: true
    }
  })

  assert.deepEqual(Object.keys(context).sort(), [
    "activeModules",
    "assistantProfile",
    "channel",
    "instructions",
    "weatherLocation"
  ])
  assert.equal(context.instructions.length, 2000)
  assert.equal(context.weatherLocation.label, "Sao Paulo")
  assert.equal("rogue" in context, false)
})

test("getAskContextDiagnostics reports dropped keys after sanitization", () => {
  const diagnostics = getAskContextDiagnostics({
    channel: "web-next",
    locale: "pt-BR",
    rogue: "drop-me"
  })

  assert.deepEqual(diagnostics.contextKeys.sort(), ["channel", "locale"])
  assert.deepEqual(diagnostics.droppedKeys, ["rogue"])
  assert.ok(diagnostics.contextBytes > 0)
})

test("parseAskContextPayload sanitizes unsupported keys while preserving allowed context", () => {
  const context = parseAskContextPayload({
    channel: "voice-realtime",
    locale: "pt-BR",
    instructions: "responda curto",
    rogue: "drop-me",
    conversationHistory: [
      { role: "user", content: "oi" },
      { role: "assistant", content: "shalom" }
    ]
  })

  assert.equal(context.channel, "voice-realtime")
  assert.equal(context.locale, "pt-BR")
  assert.equal(context.instructions, "responda curto")
  assert.equal("rogue" in context, false)
  assert.equal(Array.isArray(context.conversationHistory), true)
  assert.equal(context.conversationHistory?.length, 2)
})

test("parseRealtimeVoiceRespondRequestPayload rejects missing textual input", () => {
  assert.throws(
    () => parseRealtimeVoiceRespondRequestPayload({
      context: {
        channel: "voice-realtime"
      }
    }),
    /Contrato invalido em voice\.realtime\.respond\.request/i
  )
})

test("parseRealtimeTranscriptionRequestPayload accepts server-side audio input", () => {
  const payload = parseRealtimeTranscriptionRequestPayload({
    sessionId: "rtvoice_123",
    audioBase64: Buffer.from("fake-wav").toString("base64"),
    mimeType: "audio/wav",
    language: "pt-BR",
    providerHint: "whisper.cpp"
  })

  assert.equal(payload.sessionId, "rtvoice_123")
  assert.equal(payload.mimeType, "audio/wav")
  assert.equal(payload.providerHint, "whisper.cpp")
})

test("parseRealtimeSessionAudioRequestPayload validates realtime audio ingestion payload", () => {
  const payload = parseRealtimeSessionAudioRequestPayload({
    audioDataUrl: `data:audio/wav;base64,${Buffer.from("fake-wav").toString("base64")}`,
    language: "pt-BR",
    autoRespond: true,
    returnAudio: true,
    context: {
      channel: "voice-realtime"
    }
  })

  assert.equal(payload.language, "pt-BR")
  assert.equal(payload.autoRespond, true)
  assert.equal(payload.returnAudio, true)
  assert.equal(payload.context?.channel, "voice-realtime")
})

test("parseRealtimeSessionEnvelopePayload validates normalized voice session shape", () => {
  const payload = parseRealtimeSessionEnvelopePayload({
    success: true,
    session: {
      sessionId: "rtvoice_123",
      status: "active",
      userId: "user_1",
      locale: "pt-BR",
      transport: "sse",
      voice: {
        input: "browser-default",
        output: "browser-default"
      },
      vad: {
        enabled: true,
        threshold: 0.045,
        silenceMs: 1400,
        sampleRate: 16000
      }
    }
  })

  assert.equal(payload.session.sessionId, "rtvoice_123")
  assert.equal(payload.session.voice?.output, "browser-default")
  assert.equal(payload.session.vad?.enabled, true)
})

test("parseRuntimeConfigPayload accepts runtime config with contract metadata", () => {
  const config = parseRuntimeConfigPayload({
    service: "giom-runtime",
    features: {
      auth: true,
      streaming: true,
      voiceRealtime: true,
      serverAudioTranscriptions: true,
      serverAudioSpeech: true,
      serverVad: true
    },
    runtime: {
      contracts: {
        boundaryValidation: true,
        engine: "zod-shared"
      }
    }
  })

  assert.equal(config.service, "giom-runtime")
  assert.equal(config.features?.voiceRealtime, true)
  assert.equal(config.features?.serverAudioTranscriptions, true)
  assert.equal(config.features?.serverAudioSpeech, true)
  assert.equal(config.features?.serverVad, true)
  assert.equal(config.runtime?.contracts?.engine, "zod-shared")
})

test("extractAskResponseText normalizes standard ask envelopes", () => {
  assert.equal(extractAskResponseText({
    success: true,
    data: {
      response: "Resposta validada"
    }
  }), "Resposta validada")
})
