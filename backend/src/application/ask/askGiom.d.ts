import type { PreparedAskPayload } from "./buildPreparedAskPayload.d.ts"

export type IntentType =
  | "deterministic_upload"
  | "greeting"
  | "safety"
  | "bible_passage"
  | "bible_guidance"
  | "weather"
  | "sports_fixture"
  | "fallback_ai"
  | "fallback_ai_contingency"
  | "fallback_ai_empty"

export interface HandlerResult {
  handled: boolean
  intent: IntentType
  handler: string
  responseText: string
  routeType: "deterministic" | "ai" | "stream" | "fallback"
  diagnostics?: Record<string, unknown>
}

export interface AIProviderPort {
  ask(question: string, context: Record<string, unknown>): Promise<unknown>
}

export interface MemoryPort {
  saveConversation?(userId: string, question: string, responseText: string, metadata?: Record<string, unknown>): Promise<unknown>
  saveEvaluation?(userId: string, requestId: string, evaluation: Record<string, unknown>): Promise<unknown>
}

export interface ExternalDataPort {
  resolve(question: string, context: Record<string, unknown>): string | null
}

export interface AskGiomOutput {
  responseText: string
  handler: string
  intent: IntentType
  routeType: "deterministic" | "ai" | "stream" | "fallback"
  evaluation?: {
    score: number
    relevance: number
    groundedness: number
    correctness: number
    hallucinationRisk: number
    latencyScore: number
    classification: "EXCELLENT" | "GOOD" | "WARNING" | "CRITICAL"
    status: "healthy" | "warning" | "critical"
    flags: string[]
    issues: string[]
  }
  selfHealing?: {
    applied: boolean
    issues: string[]
  }
  learning?: {
    shouldPersistMemory: boolean
    memoryBoost: number
    markedForRetraining: boolean
    score: number | null
  }
  trace: Array<Record<string, unknown>>
  diagnostics: Record<string, unknown>
  timing: {
    totalMs: number
    matchedHandlerMs: number
    decisionMs?: number
  }
}

export interface AskGiomDecisionResult {
  intent: IntentType
  handlerName: string
  routeType: "deterministic" | "ai" | "stream"
  requiresStreaming: boolean
  decisionMs: number
  checks: Array<{ intent: string, matched: boolean, handlerName: string, durationMs: number }>
}

export interface AskGiomPorts {
  deterministicUpload: ExternalDataPort
  greeting: {
    detect(question: string): { hasGreeting?: boolean, hasWellBeing?: boolean, isGreetingOnly?: boolean }
    build(question: string, context: Record<string, unknown>): string
  }
  safety: {
    resolve(question: string, context: Record<string, unknown>): { responseText: string, safety?: unknown } | null
  }
  bible: {
    passages: ExternalDataPort
    guidance: ExternalDataPort
  }
  weather: ExternalDataPort
  fixture: ExternalDataPort
  aiProvider: AIProviderPort
  response: {
    normalize(answer: unknown): string
    postProcess(question: string, responseText: string, context: Record<string, unknown>): string
    contingency(question: string, context: Record<string, unknown>, reason?: string): string
  }
}

export declare const ASK_GIOM_INTENTS: readonly IntentType[]
export declare function createAskGiomService(config: {
  ports: AskGiomPorts
  logger?: { info?: Function, error?: Function }
  handlerMap?: Record<string, Function>
  evaluation?: {
    enabled?: boolean
    selfHealingEnabled?: boolean
    selfHealingThreshold?: number
    selfHealingTimeoutMs?: number
  }
  now?: () => number
}): ((preparedPayload: PreparedAskPayload, options?: { mode?: "standard" | "stream" }) => Promise<AskGiomOutput>) & {
  decide: (preparedPayload: PreparedAskPayload, options?: { mode?: "standard" | "stream" }) => AskGiomDecisionResult
  execute: (preparedPayload: PreparedAskPayload, decision: AskGiomDecisionResult) => Promise<AskGiomOutput>
}
export declare function createAskGiomLegacyAdapter(askGiom: (preparedPayload: PreparedAskPayload) => Promise<AskGiomOutput>): (questionOrPreparedPayload: string | PreparedAskPayload, context?: Record<string, unknown>) => Promise<string>
