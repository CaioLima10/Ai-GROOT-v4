// @ts-check

import { z } from "zod"

import { sanitizeAskContext } from "./runtimeContracts.js"

const looseObjectSchema = z.object({}).catchall(z.unknown())
const finiteNumberSchema = z.number().finite()
const coercedFiniteNumberSchema = z.coerce.number().finite()

function buildContractError(contractName, error) {
  const issues = Array.isArray(error?.issues) ? error.issues : []
  const details = issues
    .slice(0, 4)
    .map((issue) => {
      const path = Array.isArray(issue.path) && issue.path.length
        ? issue.path.join(".")
        : "<root>"
      return `${path}: ${issue.message}`
    })
  const errorMessage = details.length
    ? `Contrato invalido em ${contractName}: ${details.join("; ")}`
    : `Contrato invalido em ${contractName}.`

  const contractError = new Error(errorMessage)
  contractError.code = "CONTRACT_VALIDATION_FAILED"
  contractError.statusCode = 400
  contractError.details = details
  return contractError
}

function parseSchema(schema, payload, contractName) {
  const result = schema.safeParse(payload)
  if (!result.success) {
    throw buildContractError(contractName, result.error)
  }
  return result.data
}

export const conversationHistoryItemSchema = z.object({
  role: z.string().trim().min(1).max(24).default("user"),
  content: z.string().trim().min(1).max(2_000)
}).passthrough()

export const weatherLocationSchema = z.object({
  label: z.string().trim().min(1).max(140).optional(),
  latitude: coercedFiniteNumberSchema.min(-90).max(90),
  longitude: coercedFiniteNumberSchema.min(-180).max(180),
  forecastDays: z.coerce.number().int().min(1).max(14).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  source: z.string().trim().min(1).max(80).optional(),
  accuracyMeters: coercedFiniteNumberSchema.min(0).nullable().optional(),
  capturedAt: z.string().trim().min(1).max(80).nullable().optional()
}).passthrough()

export const askContextSchema = z.object({
  channel: z.string().trim().min(1).max(80).optional(),
  migrationStage: z.coerce.number().int().min(0).max(99).optional(),
  uploadId: z.string().trim().min(1).max(120).nullable().optional(),
  uploadIds: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  uploadName: z.string().trim().min(1).max(240).nullable().optional(),
  uploadNames: z.array(z.string().trim().min(1).max(240)).max(20).optional(),
  uploadType: z.string().trim().min(1).max(120).nullable().optional(),
  plan: z.string().trim().min(1).max(80).optional(),
  source: z.string().trim().min(1).max(80).optional(),
  assistantProfile: z.string().trim().min(1).max(80).optional(),
  activeModules: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  domain: z.string().trim().min(1).max(80).optional(),
  locale: z.string().trim().min(1).max(32).optional(),
  language: z.string().trim().min(1).max(32).optional(),
  instructions: z.string().trim().min(1).max(4_000).optional(),
  preferredResponseCard: z.string().trim().min(1).max(40).optional(),
  preferredResponseVariant: z.string().trim().min(1).max(40).optional(),
  weatherLocation: weatherLocationSchema.nullable().optional(),
  domainSubmodules: z.record(z.array(z.string().trim().min(1).max(80)).max(20)).optional(),
  bibleStudyModules: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  promptPacks: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  researchCapabilities: looseObjectSchema.optional(),
  preferredBibleCode: z.string().trim().min(1).max(40).optional(),
  ministryFocus: z.string().trim().min(1).max(80).optional(),
  userStyle: z.string().trim().min(1).max(80).optional(),
  depthPreference: z.string().trim().min(1).max(80).optional(),
  ageGroup: z.string().trim().min(1).max(80).optional(),
  verbosity: z.string().trim().min(1).max(40).optional(),
  examples: z.boolean().optional(),
  noEmojis: z.boolean().optional(),
  safetyLevel: z.string().trim().min(1).max(40).optional(),
  evaluationMode: z.boolean().optional(),
  evaluationScenario: z.string().trim().min(1).max(140).optional(),
  conversationHistory: z.array(conversationHistoryItemSchema).max(20).optional()
}).passthrough().transform((value) => sanitizeAskContext(value))

export const runtimeConfigSchema = z.object({
  service: z.string().trim().min(1).max(120).optional(),
  supabaseUrl: z.string().nullable().optional(),
  supabaseAnonKey: z.string().nullable().optional(),
  adminProtected: z.boolean().optional(),
  features: z.object({
    auth: z.boolean().optional(),
    streaming: z.boolean().optional(),
    imageGeneration: z.boolean().optional(),
    documentGeneration: z.boolean().optional(),
    voiceRealtime: z.boolean().optional(),
    audioTranscriptions: z.boolean().optional(),
    audioSpeech: z.boolean().optional(),
    browserVad: z.boolean().optional(),
    serverAudioTranscriptions: z.boolean().optional(),
    serverAudioSpeech: z.boolean().optional(),
    serverVad: z.boolean().optional()
  }).passthrough().optional(),
  uploads: z.object({
    enabled: z.boolean().optional(),
    maxBytes: finiteNumberSchema.optional(),
    accept: z.array(z.string()).optional()
  }).passthrough().optional(),
  ai: z.object({
    documentGeneration: z.object({
      formats: z.array(z.object({
        id: z.string().optional(),
        format: z.string().optional()
      }).passthrough()).optional()
    }).passthrough().optional()
  }).passthrough().optional(),
  runtime: looseObjectSchema.optional()
}).passthrough()

export const realtimeVoiceSessionSchema = z.object({
  sessionId: z.string().trim().min(1),
  status: z.string().trim().min(1),
  userId: z.string().trim().min(1).optional(),
  locale: z.string().trim().min(1).max(32).default("pt-BR"),
  transport: z.string().trim().min(1).max(32).default("sse"),
  voice: z.object({
    input: z.string().trim().min(1).max(80).optional(),
    output: z.string().trim().min(1).max(80).optional()
  }).passthrough().nullable().optional(),
  vad: z.object({
    enabled: z.boolean().optional(),
    threshold: finiteNumberSchema.optional(),
    silenceMs: finiteNumberSchema.optional(),
    sampleRate: finiteNumberSchema.optional()
  }).passthrough().nullable().optional(),
  capabilities: looseObjectSchema.optional(),
  metadata: looseObjectSchema.nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  lastActivityAt: z.string().optional()
}).passthrough()

export const realtimeSpeechManifestSchema = z.object({
  object: z.string().optional(),
  id: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  format: z.string().optional(),
  text: z.string().trim().min(1).max(1_200),
  voice: z.string().trim().min(1).max(80).optional(),
  language: z.string().trim().min(1).max(32).optional(),
  rate: finiteNumberSchema.optional(),
  pitch: finiteNumberSchema.optional(),
  autoPlay: z.boolean().optional(),
  providerMode: z.string().trim().min(1).max(80).optional(),
  audio: z.object({
    mimeType: z.string().trim().min(1).max(80).optional(),
    format: z.string().trim().min(1).max(40).optional(),
    audioBase64: z.string().trim().min(1).max(6_000_000).optional(),
    dataUrl: z.string().trim().min(1).max(6_200_000).optional(),
    audioBytes: finiteNumberSchema.optional(),
    durationMs: finiteNumberSchema.nullable().optional()
  }).passthrough().nullable().optional()
}).passthrough()

export const realtimeSessionCreateRequestSchema = z.object({
  locale: z.string().trim().min(1).max(32).optional(),
  language: z.string().trim().min(1).max(32).optional(),
  voice: z.string().trim().min(1).max(80).optional(),
  inputVoice: z.string().trim().min(1).max(80).optional(),
  outputVoice: z.string().trim().min(1).max(80).optional(),
  transport: z.string().trim().min(1).max(32).optional(),
  metadata: looseObjectSchema.optional(),
  vad: z.object({
    enabled: z.boolean().optional(),
    threshold: coercedFiniteNumberSchema.min(0.001).max(1).optional(),
    silenceMs: z.coerce.number().int().min(300).max(20_000).optional(),
    sampleRate: z.coerce.number().int().min(8_000).max(48_000).optional()
  }).passthrough().optional()
}).passthrough()

export const realtimeTranscriptionSegmentSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  text: z.string().trim().min(1).max(1_000),
  startMs: coercedFiniteNumberSchema.min(0).optional(),
  endMs: coercedFiniteNumberSchema.min(0).optional(),
  start: coercedFiniteNumberSchema.min(0).optional(),
  end: coercedFiniteNumberSchema.min(0).optional(),
  confidence: coercedFiniteNumberSchema.min(0).max(1).optional(),
  final: z.boolean().optional()
}).passthrough()

export const realtimeTranscriptionRequestSchema = z.object({
  sessionId: z.string().trim().min(1).max(120).optional(),
  transcript: z.string().trim().min(1).max(2_000).optional(),
  text: z.string().trim().min(1).max(2_000).optional(),
  audioBase64: z.string().trim().min(1).max(6_000_000).optional(),
  audioDataUrl: z.string().trim().min(1).max(6_200_000).optional(),
  mimeType: z.string().trim().min(1).max(80).optional(),
  sampleRate: z.coerce.number().int().min(8_000).max(48_000).optional(),
  channels: z.coerce.number().int().min(1).max(8).optional(),
  fileName: z.string().trim().min(1).max(240).optional(),
  language: z.string().trim().min(1).max(32).optional(),
  locale: z.string().trim().min(1).max(32).optional(),
  durationMs: coercedFiniteNumberSchema.min(0).max(3_600_000).optional(),
  confidence: coercedFiniteNumberSchema.min(0).max(1).optional(),
  final: z.boolean().optional(),
  segments: z.array(realtimeTranscriptionSegmentSchema).max(40).optional(),
  source: z.string().trim().min(1).max(80).optional(),
  providerHint: z.string().trim().min(1).max(80).optional(),
  vad: z.object({
    enabled: z.boolean().optional(),
    threshold: coercedFiniteNumberSchema.min(0.001).max(1).optional(),
    silenceMs: z.coerce.number().int().min(200).max(20_000).optional(),
    sampleRate: z.coerce.number().int().min(8_000).max(48_000).optional()
  }).passthrough().optional(),
  requestId: z.string().trim().min(1).max(120).optional(),
  traceId: z.string().trim().min(1).max(120).optional()
}).passthrough().superRefine((value, ctx) => {
  const hasAudio = Boolean(value.audioBase64 || value.audioDataUrl)
  if (!value.transcript && !value.text && (!Array.isArray(value.segments) || value.segments.length === 0) && !hasAudio) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["transcript"],
      message: "transcript, text, segments ou audio sao obrigatorios"
    })
  }
})

export const realtimeTranscriptionPayloadSchema = z.object({
  success: z.boolean().optional(),
  object: z.string().optional(),
  id: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  text: z.string().trim().min(1),
  language: z.string().optional(),
  durationMs: finiteNumberSchema.nullable().optional(),
  confidence: finiteNumberSchema.nullable().optional(),
  final: z.boolean().optional(),
  segments: z.array(realtimeTranscriptionSegmentSchema).optional(),
  source: z.string().optional(),
  vad: looseObjectSchema.nullable().optional(),
  audioMeta: looseObjectSchema.nullable().optional(),
  sessionId: z.string().nullable().optional()
}).passthrough()

export const realtimeSpeechRequestSchema = z.object({
  sessionId: z.string().trim().min(1).max(120).optional(),
  input: z.string().trim().min(1).max(1_200).optional(),
  text: z.string().trim().min(1).max(1_200).optional(),
  language: z.string().trim().min(1).max(32).optional(),
  locale: z.string().trim().min(1).max(32).optional(),
  voice: z.string().trim().min(1).max(80).optional(),
  outputVoice: z.string().trim().min(1).max(80).optional(),
  rate: coercedFiniteNumberSchema.min(0.4).max(2).optional(),
  pitch: coercedFiniteNumberSchema.min(0.4).max(2).optional(),
  autoPlay: z.boolean().optional(),
  returnAudio: z.boolean().optional(),
  providerHint: z.string().trim().min(1).max(80).optional(),
  requestId: z.string().trim().min(1).max(120).optional(),
  traceId: z.string().trim().min(1).max(120).optional()
}).passthrough().superRefine((value, ctx) => {
  if (!value.input && !value.text) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["input"],
      message: "input ou text sao obrigatorios"
    })
  }
})

export const realtimeSpeechEnvelopeSchema = z.object({
  success: z.boolean().optional(),
  speech: realtimeSpeechManifestSchema,
  sessionId: z.string().nullable().optional()
}).passthrough()

export const realtimeVoiceRespondRequestSchema = z.object({
  input: z.string().trim().min(1).max(2_000).optional(),
  text: z.string().trim().min(1).max(2_000).optional(),
  transcript: z.string().trim().min(1).max(2_000).optional(),
  context: askContextSchema.optional(),
  appendInputEvent: z.boolean().optional(),
  timeoutMs: z.coerce.number().int().min(5_000).max(120_000).optional(),
  chunkDelayMs: z.coerce.number().int().min(40).max(1_000).optional(),
  maxChunkChars: z.coerce.number().int().min(40).max(240).optional(),
  language: z.string().trim().min(1).max(32).optional(),
  voice: z.string().trim().min(1).max(80).optional(),
  rate: coercedFiniteNumberSchema.min(0.4).max(2).optional(),
  pitch: coercedFiniteNumberSchema.min(0.4).max(2).optional(),
  autoSpeak: z.boolean().optional(),
  returnAudio: z.boolean().optional()
}).passthrough().superRefine((value, ctx) => {
  if (!value.input && !value.text && !value.transcript) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["input"],
      message: "input, text ou transcript sao obrigatorios"
    })
  }
})

export const realtimeSessionAudioRequestSchema = z.object({
  audioBase64: z.string().trim().min(1).max(6_000_000).optional(),
  audioDataUrl: z.string().trim().min(1).max(6_200_000).optional(),
  mimeType: z.string().trim().min(1).max(80).optional(),
  sampleRate: z.coerce.number().int().min(8_000).max(48_000).optional(),
  channels: z.coerce.number().int().min(1).max(8).optional(),
  fileName: z.string().trim().min(1).max(240).optional(),
  language: z.string().trim().min(1).max(32).optional(),
  locale: z.string().trim().min(1).max(32).optional(),
  providerHint: z.string().trim().min(1).max(80).optional(),
  context: askContextSchema.optional(),
  autoRespond: z.boolean().optional(),
  appendInputEvent: z.boolean().optional(),
  timeoutMs: z.coerce.number().int().min(5_000).max(120_000).optional(),
  chunkDelayMs: z.coerce.number().int().min(40).max(1_000).optional(),
  maxChunkChars: z.coerce.number().int().min(40).max(240).optional(),
  voice: z.string().trim().min(1).max(80).optional(),
  rate: coercedFiniteNumberSchema.min(0.4).max(2).optional(),
  pitch: coercedFiniteNumberSchema.min(0.4).max(2).optional(),
  autoSpeak: z.boolean().optional(),
  returnAudio: z.boolean().optional(),
  vad: z.object({
    enabled: z.boolean().optional(),
    threshold: coercedFiniteNumberSchema.min(0.001).max(1).optional(),
    silenceMs: z.coerce.number().int().min(200).max(20_000).optional(),
    sampleRate: z.coerce.number().int().min(8_000).max(48_000).optional()
  }).passthrough().optional()
}).passthrough().superRefine((value, ctx) => {
  if (!value.audioBase64 && !value.audioDataUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["audioBase64"],
      message: "audioBase64 ou audioDataUrl sao obrigatorios"
    })
  }
})

export const realtimeSessionEnvelopeSchema = z.object({
  success: z.boolean().optional(),
  session: realtimeVoiceSessionSchema,
  endpoints: looseObjectSchema.optional()
}).passthrough()

export const realtimeVoiceResponseEnvelopeSchema = z.object({
  success: z.boolean().optional(),
  requestId: z.string().optional(),
  session: realtimeVoiceSessionSchema.optional(),
  response: z.object({
    text: z.string().trim().min(1)
  }).passthrough(),
  speech: realtimeSpeechManifestSchema.nullable().optional()
}).passthrough()

export const askResponseSchema = z.object({
  success: z.boolean().optional(),
  data: z.object({
    response: z.string().trim().min(1).optional()
  }).passthrough().optional(),
  response: z.string().trim().min(1).optional(),
  answer: z.string().trim().min(1).optional(),
  reply: z.string().trim().min(1).optional(),
  message: z.string().trim().min(1).optional(),
  requestId: z.string().optional(),
  metadata: looseObjectSchema.optional()
}).passthrough().superRefine((value, ctx) => {
  const candidate = value.data?.response || value.response || value.answer || value.reply || value.message
  if (!candidate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["response"],
      message: "resposta textual obrigatoria"
    })
  }
})

export function parseAskContextPayload(payload) {
  return parseSchema(askContextSchema, payload || {}, "ask.context")
}

export function parseRuntimeConfigPayload(payload) {
  return parseSchema(runtimeConfigSchema, payload || {}, "runtime.config")
}

export function parseRealtimeSessionCreateRequestPayload(payload) {
  return parseSchema(realtimeSessionCreateRequestSchema, payload || {}, "voice.session.create")
}

export function parseRealtimeSessionEnvelopePayload(payload) {
  return parseSchema(realtimeSessionEnvelopeSchema, payload || {}, "voice.session.response")
}

export function parseRealtimeTranscriptionRequestPayload(payload) {
  return parseSchema(realtimeTranscriptionRequestSchema, payload || {}, "voice.transcription.request")
}

export function parseRealtimeTranscriptionPayload(payload) {
  return parseSchema(realtimeTranscriptionPayloadSchema, payload || {}, "voice.transcription.response")
}

export function parseRealtimeSpeechRequestPayload(payload) {
  return parseSchema(realtimeSpeechRequestSchema, payload || {}, "voice.speech.request")
}

export function parseRealtimeSpeechEnvelopePayload(payload) {
  return parseSchema(realtimeSpeechEnvelopeSchema, payload || {}, "voice.speech.response")
}

export function parseRealtimeVoiceRespondRequestPayload(payload) {
  return parseSchema(realtimeVoiceRespondRequestSchema, payload || {}, "voice.realtime.respond.request")
}

export function parseRealtimeSessionAudioRequestPayload(payload) {
  return parseSchema(realtimeSessionAudioRequestSchema, payload || {}, "voice.realtime.audio.request")
}

export function parseRealtimeVoiceResponseEnvelopePayload(payload) {
  return parseSchema(realtimeVoiceResponseEnvelopeSchema, payload || {}, "voice.realtime.respond.response")
}

export function parseAskResponsePayload(payload) {
  return parseSchema(askResponseSchema, payload || {}, "ask.response")
}

export function extractAskResponseText(payload) {
  const parsed = parseAskResponsePayload(payload)
  return String(
    parsed.data?.response ||
    parsed.response ||
    parsed.answer ||
    parsed.reply ||
    parsed.message ||
    ""
  ).trim()
}
