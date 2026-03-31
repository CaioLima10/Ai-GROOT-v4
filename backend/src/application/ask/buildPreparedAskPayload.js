import { sanitizeAskContext } from "../../../../packages/shared-config/src/runtimeContracts.js"
import { detectGreetingSignals } from "../../../../core/greetingBehavior.js"
import { detectSafetyRisk } from "../../../../core/safetyGuard.js"

const DEFAULT_MAX_QUESTION_LENGTH = 50000

/**
 * @param {string} message
 * @param {string} code
 * @param {number} [statusCode]
 * @returns {Error & { code: string, statusCode: number }}
 */
function createPreparationError(message, code, statusCode = 400) {
  const error = new Error(message)
  error.code = code
  error.statusCode = statusCode
  return error
}

/**
 * @param {unknown} content
 * @returns {string}
 */
function flattenMessageContent(content) {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""

  return content
    .map((item) => {
      if (typeof item === "string") return item
      if (item?.text) return item.text
      if (item?.type === "input_text" && item?.text) return item.text
      return ""
    })
    .filter(Boolean)
    .join("\n")
}

/**
 * @param {unknown[]} [messages]
 * @returns {string}
 */
function buildQuestionFromMessages(messages = []) {
  if (!Array.isArray(messages) || messages.length === 0) return ""

  const transcript = messages
    .map((message) => {
      const content = flattenMessageContent(message?.content)
      if (!content) return ""
      return `${message?.role || "user"}: ${content}`
    })
    .filter(Boolean)
    .join("\n")

  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message?.role === "user")

  const lastUserText = flattenMessageContent(lastUserMessage?.content)
  if (!transcript) return lastUserText

  return [
    "Considere o historico abaixo e responda a ultima mensagem do usuario.",
    transcript,
    "",
    "Ultima mensagem do usuario:",
    lastUserText || transcript
  ].join("\n")
}

/**
 * @param {unknown[] | string} [contents]
 * @returns {string}
 */
function buildQuestionFromGeminiContents(contents = []) {
  if (typeof contents === "string") return contents
  if (!Array.isArray(contents)) return ""

  const lines = contents
    .map((item) => {
      const parts = Array.isArray(item?.parts) ? item.parts : []
      const text = parts
        .map((part) => part?.text || "")
        .filter(Boolean)
        .join("\n")

      if (!text) return ""
      return `${item?.role || "user"}: ${text}`
    })
    .filter(Boolean)

  return lines.join("\n")
}

/**
 * @param {Record<string, unknown>} body
 * @returns {{ normalizedQuestion: string, source: string }}
 */
function resolveQuestionFromBody(body) {
  const direct = [body.question, body.prompt, body.message]
    .find((value) => typeof value === "string" && value.trim())
  if (direct) {
    return { normalizedQuestion: direct.trim(), source: "direct" }
  }

  if (Array.isArray(body.messages)) {
    const fromMessages = buildQuestionFromMessages(body.messages)
    if (fromMessages) {
      return { normalizedQuestion: fromMessages.trim(), source: "messages" }
    }
  }

  if (Array.isArray(body.contents) || typeof body.contents === "string") {
    const fromContents = buildQuestionFromGeminiContents(body.contents)
    if (fromContents) {
      return { normalizedQuestion: fromContents.trim(), source: "contents" }
    }
  }

  if (typeof body.input === "string" && body.input.trim()) {
    return { normalizedQuestion: body.input.trim(), source: "input_string" }
  }

  if (Array.isArray(body.input)) {
    const fromInput = body.input
      .map((item) => (typeof item === "string"
        ? item
        : flattenMessageContent(item?.content || item?.text || "")))
      .join("\n")
      .trim()

    if (fromInput) {
      return { normalizedQuestion: fromInput, source: "input_array" }
    }
  }

  return { normalizedQuestion: "", source: "empty" }
}

/**
 * @param {unknown} uploadExtraction
 * @returns {null | {
 *   kind?: unknown,
 *   method?: unknown,
 *   quality?: unknown,
 *   truncated?: unknown,
 *   warnings?: unknown,
 *   pages?: unknown,
 *   fullTextLength?: unknown,
 *   text: string
 * }}
 */
export function summarizeUploadExtraction(uploadExtraction) {
  if (!uploadExtraction || typeof uploadExtraction !== "object") {
    return null
  }

  return {
    kind: uploadExtraction.kind,
    method: uploadExtraction.method,
    quality: uploadExtraction.quality,
    truncated: uploadExtraction.truncated,
    warnings: uploadExtraction.warnings,
    pages: uploadExtraction.pages,
    fullTextLength: uploadExtraction.fullTextLength,
    text: uploadExtraction.text || ""
  }
}

/**
 * @param {{
 *   body?: Record<string, unknown>,
 *   userId?: string,
 *   sessionId?: string | null,
 *   requestId?: string,
 *   timestamp?: string,
 *   ip?: string | null,
 *   userAgent?: string | null,
 *   maxQuestionLength?: number
 * }} input
 */
export function buildPreparedAskSeed(input = {}) {
  const body = input.body && typeof input.body === "object" && !Array.isArray(input.body)
    ? input.body
    : {}
  const rawContext = body.context && typeof body.context === "object" && !Array.isArray(body.context)
    ? body.context
    : {}
  const context = sanitizeAskContext(rawContext)
  const { normalizedQuestion, source } = resolveQuestionFromBody(body)
  const maxQuestionLength = Number(input.maxQuestionLength || DEFAULT_MAX_QUESTION_LENGTH)

  if (!normalizedQuestion) {
    throw createPreparationError("Pergunta vazia", "EMPTY_QUESTION", 400)
  }

  if (normalizedQuestion.length > maxQuestionLength) {
    throw createPreparationError(
      `Pergunta muito longa (máx ${maxQuestionLength.toLocaleString("pt-BR")} caracteres)`,
      "QUESTION_TOO_LONG",
      400
    )
  }

  return {
    normalizedQuestion,
    source,
    context,
    requestMetadata: {
      userId: String(input.userId || "default_user"),
      sessionId: input.sessionId ? String(input.sessionId) : null,
      requestId: String(input.requestId || ""),
      timestamp: String(input.timestamp || new Date(0).toISOString()),
      ip: input.ip ? String(input.ip) : null,
      userAgent: input.userAgent ? String(input.userAgent) : null
    },
    limits: {
      maxQuestionLength
    }
  }
}

/**
 * @param {{
 *   seed: ReturnType<typeof buildPreparedAskSeed>,
 *   runtimeContext?: Record<string, unknown>,
 *   uploadEntry?: Record<string, unknown> | null,
 *   uploadExtraction?: Record<string, unknown> | null,
 *   uploadPromptBlock?: string,
 *   enrichedData?: Record<string, unknown>
 * }} input
 */
export function buildPreparedAskPayload(input) {
  const seed = input?.seed
  if (!seed || typeof seed !== "object") {
    throw createPreparationError("Prepared ask seed ausente", "PREPARED_ASK_SEED_REQUIRED", 500)
  }

  const runtimeContext = input.runtimeContext && typeof input.runtimeContext === "object" && !Array.isArray(input.runtimeContext)
    ? input.runtimeContext
    : {}
  const uploadPromptBlock = String(input.uploadPromptBlock || "")
  const uploadExtractionSummary = summarizeUploadExtraction(input.uploadExtraction)
  const uploadEntry = input.uploadEntry && typeof input.uploadEntry === "object" ? input.uploadEntry : null

  let preparedQuestion = seed.normalizedQuestion
  if (uploadPromptBlock) {
    preparedQuestion += uploadPromptBlock
    if (preparedQuestion.length > seed.limits.maxQuestionLength) {
      preparedQuestion = preparedQuestion.slice(0, seed.limits.maxQuestionLength)
    }
  }

  const context = {
    ...runtimeContext,
    originalQuestion: seed.normalizedQuestion,
    composedQuestion: preparedQuestion
  }

  if (runtimeContext?.agroWeather?.summary) {
    preparedQuestion += `\n\n[Clima operacional nesta execucao]\n${runtimeContext.agroWeather.summary}`
  }

  if (runtimeContext?.liveFixture?.summary) {
    preparedQuestion += `\n\n[Agenda esportiva atual nesta execucao]\n${runtimeContext.liveFixture.summary}`
  }

  if (runtimeContext?.liveSearchSummary) {
    preparedQuestion += `\n\n[Pesquisa web atual nesta execucao]\n${runtimeContext.liveSearchSummary}`
  }

  if (runtimeContext?.biblePassage?.summary) {
    preparedQuestion += `\n\n[Passagem biblica local nesta execucao]\n${runtimeContext.biblePassage.summary}`
  }

  context.composedQuestion = preparedQuestion

  const greeting = detectGreetingSignals(seed.normalizedQuestion)
  const safety = detectSafetyRisk(preparedQuestion)

  return {
    normalizedQuestion: seed.normalizedQuestion,
    preparedQuestion,
    context,
    flags: {
      source: seed.source,
      hasUpload: Boolean(uploadEntry),
      hasUploadExtraction: Boolean(uploadExtractionSummary),
      hasRuntimeContext: Object.keys(runtimeContext).length > 0,
      hasGreeting: Boolean(greeting.hasGreeting),
      hasWellBeingGreeting: Boolean(greeting.hasWellBeing),
      isGreetingOnly: Boolean(greeting.isGreetingOnly),
      safetyTriggered: Boolean(safety?.triggered),
      safetyAdvisory: Boolean(safety?.advisory)
    },
    enrichedData: {
      request: { ...seed.requestMetadata },
      upload: {
        entry: uploadEntry,
        extraction: uploadExtractionSummary,
        promptBlockIncluded: Boolean(uploadPromptBlock)
      },
      runtime: {
        agroWeatherSummary: runtimeContext?.agroWeather?.summary || null,
        liveFixtureSummary: runtimeContext?.liveFixture?.summary || null,
        liveSearchSummary: runtimeContext?.liveSearchSummary || null,
        biblePassageSummary: runtimeContext?.biblePassage?.summary || null
      },
      ...(input.enrichedData && typeof input.enrichedData === "object" ? input.enrichedData : {})
    }
  }
}

/**
 * @param {{
 *   question: string,
 *   context?: Record<string, unknown>,
 *   userId?: string,
 *   sessionId?: string | null,
 *   requestId?: string,
 *   timestamp?: string,
 *   enrichedData?: Record<string, unknown>
 * }} input
 */
export function buildPreparedAskPayloadFromRuntime(input) {
  const context = input?.context && typeof input.context === "object" && !Array.isArray(input.context)
    ? input.context
    : {}

  const seed = buildPreparedAskSeed({
    body: {
      question: String(input?.question || ""),
      context
    },
    userId: input?.userId ? String(input.userId) : String(context?.userId || "default_user"),
    sessionId: input?.sessionId ? String(input.sessionId) : (context?.sessionId ? String(context.sessionId) : null),
    requestId: input?.requestId ? String(input.requestId) : String(context?.requestId || ""),
    timestamp: input?.timestamp ? String(input.timestamp) : new Date(0).toISOString()
  })

  return buildPreparedAskPayload({
    seed,
    runtimeContext: context,
    enrichedData: input?.enrichedData && typeof input.enrichedData === "object"
      ? input.enrichedData
      : {}
  })
}
