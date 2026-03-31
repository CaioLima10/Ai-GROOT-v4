export interface UploadEntry {
  id?: string | null
  name?: string | null
  type?: string | null
  path?: string | null
  size?: number | null
  expiresAt?: string | number | null
  [key: string]: unknown
}

export interface UploadExtractionSummary {
  kind?: unknown
  method?: unknown
  quality?: unknown
  truncated?: unknown
  warnings?: unknown
  pages?: unknown
  fullTextLength?: unknown
  text: string
}

export interface AskContext {
  uploadId?: string | null
  uploadName?: string | null
  uploadType?: string | null
  uploadExtraction?: UploadExtractionSummary | null
  assistantProfile?: string | null
  activeModules?: string[]
  domainSubmodules?: Record<string, unknown>
  bibleStudyModules?: string[]
  promptPacks?: string[]
  liveSearchSummary?: string | null
  agroWeather?: { summary?: string | null, [key: string]: unknown } | null
  liveFixture?: { summary?: string | null, [key: string]: unknown } | null
  biblePassage?: { summary?: string | null, [key: string]: unknown } | null
  originalQuestion?: string
  composedQuestion?: string
  [key: string]: unknown
}

export interface PreparedAskSeedInput {
  body?: Record<string, unknown>
  userId?: string
  sessionId?: string | null
  requestId?: string
  timestamp?: string
  ip?: string | null
  userAgent?: string | null
  maxQuestionLength?: number
}

export interface PreparedAskSeed {
  normalizedQuestion: string
  source: "direct" | "messages" | "contents" | "input_string" | "input_array" | "empty" | string
  context: AskContext
  requestMetadata: {
    userId: string
    sessionId: string | null
    requestId: string
    timestamp: string
    ip: string | null
    userAgent: string | null
  }
  limits: {
    maxQuestionLength: number
  }
}

export interface PreparedAskPayload {
  normalizedQuestion: string
  preparedQuestion: string
  context: AskContext
  flags: {
    source: string
    hasUpload: boolean
    hasUploadExtraction: boolean
    hasRuntimeContext: boolean
    hasGreeting: boolean
    hasWellBeingGreeting: boolean
    isGreetingOnly: boolean
    safetyTriggered: boolean
    safetyAdvisory: boolean
  }
  enrichedData: {
    request: PreparedAskSeed["requestMetadata"]
    upload: {
      entry: UploadEntry | null
      extraction: UploadExtractionSummary | null
      promptBlockIncluded: boolean
    }
    runtime: {
      agroWeatherSummary: string | null
      liveFixtureSummary: string | null
      liveSearchSummary: string | null
      biblePassageSummary: string | null
    }
    [key: string]: unknown
  }
}

export declare function summarizeUploadExtraction(uploadExtraction: unknown): UploadExtractionSummary | null
export declare function buildPreparedAskSeed(input?: PreparedAskSeedInput): PreparedAskSeed
export declare function buildPreparedAskPayload(input: {
  seed: PreparedAskSeed
  runtimeContext?: AskContext
  uploadEntry?: UploadEntry | null
  uploadExtraction?: Record<string, unknown> | null
  uploadPromptBlock?: string
  enrichedData?: Record<string, unknown>
}): PreparedAskPayload
export declare function buildPreparedAskPayloadFromRuntime(input: {
  question: string
  context?: AskContext
  userId?: string
  sessionId?: string | null
  requestId?: string
  timestamp?: string
  enrichedData?: Record<string, unknown>
}): PreparedAskPayload
