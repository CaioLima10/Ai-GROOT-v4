import type { ConversationHistoryItem, GIOMAskContext } from "./runtimeContracts.js"

export interface RuntimeConfigContract {
  service?: string
  supabaseUrl?: string | null
  supabaseAnonKey?: string | null
  adminProtected?: boolean
  features?: Record<string, unknown>
  uploads?: {
    enabled?: boolean
    maxBytes?: number
    accept?: string[]
  } & Record<string, unknown>
  ai?: Record<string, unknown>
  runtime?: Record<string, unknown>
  [key: string]: unknown
}

export interface RealtimeVoiceSessionContract {
  sessionId: string
  status: string
  userId?: string
  locale: string
  transport: string
  voice?: {
    input?: string
    output?: string
  } | null
  vad?: {
    enabled?: boolean
    threshold?: number
    silenceMs?: number
    sampleRate?: number
  } | null
  capabilities?: Record<string, unknown>
  metadata?: Record<string, unknown> | null
  createdAt?: string
  updatedAt?: string
  lastActivityAt?: string
  [key: string]: unknown
}

export interface RealtimeSpeechManifestContract {
  object?: string
  id?: string
  provider?: string
  model?: string
  format?: string
  text: string
  voice?: string
  language?: string
  rate?: number
  pitch?: number
  autoPlay?: boolean
  [key: string]: unknown
}

export interface RealtimeTranscriptionSegmentContract {
  id?: string
  text: string
  startMs?: number
  endMs?: number
  start?: number
  end?: number
  confidence?: number
  final?: boolean
  [key: string]: unknown
}

export interface RealtimeSessionEnvelopeContract {
  success?: boolean
  session: RealtimeVoiceSessionContract
  endpoints?: Record<string, unknown>
  [key: string]: unknown
}

export interface RealtimeTranscriptionContract {
  success?: boolean
  object?: string
  id?: string
  provider?: string
  model?: string
  text: string
  language?: string
  durationMs?: number | null
  confidence?: number | null
  final?: boolean
  segments?: RealtimeTranscriptionSegmentContract[]
  source?: string
  sessionId?: string | null
  [key: string]: unknown
}

export interface RealtimeSpeechEnvelopeContract {
  success?: boolean
  speech: RealtimeSpeechManifestContract
  sessionId?: string | null
  [key: string]: unknown
}

export interface RealtimeVoiceResponseEnvelopeContract {
  success?: boolean
  requestId?: string
  session?: RealtimeVoiceSessionContract
  response: {
    text: string
    [key: string]: unknown
  }
  speech?: RealtimeSpeechManifestContract | null
  [key: string]: unknown
}

export interface AskResponseContract {
  success?: boolean
  data?: {
    response?: string
    [key: string]: unknown
  }
  response?: string
  answer?: string
  reply?: string
  message?: string
  requestId?: string
  metadata?: Record<string, unknown>
  [key: string]: unknown
}

export function parseAskContextPayload(payload: unknown): GIOMAskContext
export function parseRuntimeConfigPayload(payload: unknown): RuntimeConfigContract
export function parseRealtimeSessionCreateRequestPayload(payload: unknown): Record<string, unknown>
export function parseRealtimeSessionEnvelopePayload(payload: unknown): RealtimeSessionEnvelopeContract
export function parseRealtimeTranscriptionRequestPayload(payload: unknown): Record<string, unknown>
export function parseRealtimeTranscriptionPayload(payload: unknown): RealtimeTranscriptionContract
export function parseRealtimeSpeechRequestPayload(payload: unknown): Record<string, unknown>
export function parseRealtimeSpeechEnvelopePayload(payload: unknown): RealtimeSpeechEnvelopeContract
export function parseRealtimeVoiceRespondRequestPayload(payload: unknown): {
  context?: GIOMAskContext
  input?: string
  text?: string
  transcript?: string
  appendInputEvent?: boolean
  timeoutMs?: number
  chunkDelayMs?: number
  maxChunkChars?: number
  language?: string
  voice?: string
  rate?: number
  pitch?: number
  autoSpeak?: boolean
  [key: string]: unknown
}
export function parseRealtimeVoiceResponseEnvelopePayload(payload: unknown): RealtimeVoiceResponseEnvelopeContract
export function parseAskResponsePayload(payload: unknown): AskResponseContract
export function extractAskResponseText(payload: unknown): string

export const conversationHistoryItemSchema: unknown
export const weatherLocationSchema: unknown
export const askContextSchema: unknown
export const runtimeConfigSchema: unknown
export const realtimeVoiceSessionSchema: unknown
export const realtimeSpeechManifestSchema: unknown
export const realtimeSessionCreateRequestSchema: unknown
export const realtimeTranscriptionSegmentSchema: unknown
export const realtimeTranscriptionRequestSchema: unknown
export const realtimeTranscriptionPayloadSchema: unknown
export const realtimeSpeechRequestSchema: unknown
export const realtimeSpeechEnvelopeSchema: unknown
export const realtimeVoiceRespondRequestSchema: unknown
export const realtimeSessionEnvelopeSchema: unknown
export const realtimeVoiceResponseEnvelopeSchema: unknown
export const askResponseSchema: unknown
