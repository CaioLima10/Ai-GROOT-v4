import { buildPreparedAskPayloadFromRuntime } from "./buildPreparedAskPayload.js"
import { createDecisionRouter } from "./decisionRouter.js"
import { uploadResponseHandler } from "./handlers/uploadResponseHandler.js"
import { greetingHandler } from "./handlers/greetingHandler.js"
import { safetyHandler } from "./handlers/safetyHandler.js"
import { biblePassageHandler } from "./handlers/biblePassageHandler.js"
import { bibleGuidanceHandler } from "./handlers/bibleGuidanceHandler.js"
import { weatherHandler } from "./handlers/weatherHandler.js"
import { fixtureHandler } from "./handlers/fixtureHandler.js"
import { fallbackAIHandler } from "./handlers/fallbackAIHandler.js"
import { evaluateResponse } from "../evaluation/evaluateResponse.js"
import { processEvaluation } from "../evaluation/improvementLoop.js"
import { selfHealResponse } from "../selfHealing/selfHealResponse.js"

export const ASK_GIOM_INTENTS = Object.freeze([
  "deterministic_upload",
  "greeting",
  "safety",
  "bible_passage",
  "bible_guidance",
  "weather",
  "sports_fixture",
  "fallback_ai",
  "fallback_ai_contingency",
  "fallback_ai_empty"
])

const DEFAULT_HANDLER_MAP = Object.freeze({
  uploadResponseHandler,
  greetingHandler,
  safetyHandler,
  biblePassageHandler,
  bibleGuidanceHandler,
  weatherHandler,
  fixtureHandler,
  fallbackAIHandler
})

function isPreparedAskPayload(value) {
  return Boolean(value) && typeof value === "object" &&
    typeof value.normalizedQuestion === "string" &&
    typeof value.preparedQuestion === "string" &&
    value.context && typeof value.context === "object"
}

function buildLegacyPreparedAskPayload(question, context = {}) {
  return buildPreparedAskPayloadFromRuntime({
    question: String(question || ""),
    context,
    userId: String(context?.userId || "default_user"),
    requestId: String(context?.requestId || ""),
    sessionId: context?.sessionId ? String(context.sessionId) : null,
    timestamp: new Date().toISOString()
  })
}

function writeDecisionLog(logger, level, requestId, event, payload) {
  if (!logger || typeof logger[level] !== "function") return
  try {
    logger[level](requestId, event, payload)
  } catch (_) {
    // Logging must never break the ask pipeline.
  }
}

/**
 * @param {{
 *   ports: {
 *     deterministicUpload: { resolve: (question: string, context: Record<string, unknown>) => string | null },
 *     greeting: {
 *       detect: (question: string) => { hasGreeting?: boolean, hasWellBeing?: boolean, isGreetingOnly?: boolean },
 *       build: (question: string, context: Record<string, unknown>) => string
 *     },
 *     safety: { resolve: (question: string, context: Record<string, unknown>) => { responseText: string, safety?: unknown } | null },
 *     bible: {
 *       passages: { resolve: (question: string, context: Record<string, unknown>) => string | null },
 *       guidance: { resolve: (question: string, context: Record<string, unknown>) => string | null }
 *     },
 *     weather: { resolve: (question: string, context: Record<string, unknown>) => string | null },
 *     fixture: { resolve: (question: string, context: Record<string, unknown>) => string | null },
 *     aiProvider: { ask: (question: string, context: Record<string, unknown>) => Promise<unknown> },
 *     response: {
 *       normalize: (answer: unknown) => string,
 *       postProcess: (question: string, responseText: string, context: Record<string, unknown>) => string,
 *       contingency: (question: string, context: Record<string, unknown>, reason?: string) => string
 *     }
 *   },
 *   logger?: { info?: Function, error?: Function },
 *   handlers?: Array<Function>,
 *   now?: () => number
 * }} config
 */
export function createAskGiomService(config) {
  const handlerMap = {
    ...DEFAULT_HANDLER_MAP,
    ...(config?.handlerMap && typeof config.handlerMap === "object" ? config.handlerMap : {})
  }
  const ports = config?.ports
  const logger = config?.logger
  const now = typeof config?.now === "function" ? config.now : () => Date.now()
  const evaluationEnabled = config?.evaluation?.enabled !== false
  const selfHealingEnabled = config?.evaluation?.selfHealingEnabled !== false
  const selfHealingThreshold = Number(config?.evaluation?.selfHealingThreshold || 0.6)
  const selfHealingTimeoutMs = Number(config?.evaluation?.selfHealingTimeoutMs || 3500)

  if (!ports) {
    throw new Error("createAskGiomService requires ports")
  }

  async function enrichWithEvaluation(output, options = {}) {
    if (!evaluationEnabled) {
      return {
        ...output,
        learning: {
          shouldPersistMemory: true,
          memoryBoost: 1,
          markedForRetraining: false,
          score: null
        }
      }
    }

    const {
      preparedPayload,
      routeQuestion,
      modelQuestion,
      decision,
      startedAt
    } = options

    try {
      const latencyMs = now() - startedAt
      const context = preparedPayload?.context || {}

      let evaluation = await evaluateResponse({
        question: routeQuestion,
        answer: output.responseText,
        context,
        memoryContext: context?.memoryContext || null,
        intent: output.intent || decision?.intent,
        handler: output.handler || decision?.handlerName,
        latencyMs
      })

      let healed = {
        finalAnswer: output.responseText,
        healed: false,
        issues: []
      }

      if (selfHealingEnabled) {
        healed = await selfHealResponse({
          evaluation,
          question: routeQuestion,
          answer: output.responseText,
          aiProvider: ports.aiProvider,
          normalizeAnswer: ports?.response?.normalize,
          threshold: selfHealingThreshold,
          timeoutMs: selfHealingTimeoutMs
        })

        if (healed.healed && healed.finalAnswer) {
          const normalizedHealed = ports.response.postProcess(
            routeQuestion,
            String(healed.finalAnswer),
            context
          )

          output = {
            ...output,
            responseText: normalizedHealed || output.responseText
          }

          evaluation = await evaluateResponse({
            question: routeQuestion,
            answer: output.responseText,
            context,
            memoryContext: context?.memoryContext || null,
            intent: output.intent || decision?.intent,
            handler: output.handler || decision?.handlerName,
            latencyMs: now() - startedAt
          })
        }
      }

      const learning = await processEvaluation(
        evaluation,
        {
          question: routeQuestion,
          normalizedQuestion: modelQuestion,
          requestId: preparedPayload?.enrichedData?.request?.requestId || null,
          intent: output.intent || decision?.intent,
          handler: output.handler || decision?.handlerName
        },
        output
      )

      return {
        ...output,
        evaluation,
        selfHealing: {
          applied: Boolean(healed.healed),
          issues: healed.issues || []
        },
        learning,
        diagnostics: {
          ...(output.diagnostics || {}),
          evaluation,
          selfHealing: {
            applied: Boolean(healed.healed),
            issues: healed.issues || []
          },
          learning
        },
        timing: {
          ...(output.timing || {}),
          totalMs: now() - startedAt
        }
      }
    } catch (error) {
      return {
        ...output,
        diagnostics: {
          ...(output.diagnostics || {}),
          evaluationError: error?.message || "evaluation_failed"
        },
        learning: {
          shouldPersistMemory: true,
          memoryBoost: 1,
          markedForRetraining: false,
          score: null
        }
      }
    }
  }

  const decisionRouter = createDecisionRouter({
    ports,
    logger,
    now
  })

  async function executeDecision(preparedPayload, decision) {
    const startedAt = now()
    const requestId = String(preparedPayload.enrichedData?.request?.requestId || "ask_giom")
    const routeQuestion = String(preparedPayload.context?.originalQuestion || preparedPayload.normalizedQuestion || "").trim()
    const modelQuestion = String(preparedPayload.context?.composedQuestion || preparedPayload.preparedQuestion || routeQuestion).trim()
    const handler = handlerMap[decision.handlerName]

    if (typeof handler !== "function") {
      const responseText = ports.response.contingency(
        routeQuestion,
        preparedPayload.context,
        `handler_nao_encontrado:${decision.handlerName}`
      )
      return {
        responseText,
        handler: "contingencyFallback",
        intent: "fallback_ai_contingency",
        routeType: "fallback",
        trace: [
          {
            handler: decision.handlerName,
            matched: false,
            durationMs: 0,
            error: "handler_not_found"
          }
        ],
        diagnostics: {
          pipelineGap: true,
          missingHandler: decision.handlerName
        },
        timing: {
          totalMs: now() - startedAt,
          matchedHandlerMs: 0
        }
      }
    }

    try {
      const result = await handler({
        payload: preparedPayload,
        routeQuestion,
        modelQuestion,
        ports
      })

      if (!result?.handled) {
        const contingencyResponse = ports.response.contingency(
          routeQuestion,
          preparedPayload.context,
          `handler_sem_saida:${decision.handlerName}`
        )
        return {
          responseText: contingencyResponse,
          handler: "contingencyFallback",
          intent: "fallback_ai_contingency",
          routeType: "fallback",
          trace: [
            {
              handler: decision.handlerName,
              matched: false,
              durationMs: now() - startedAt,
              error: "handler_no_result"
            }
          ],
          diagnostics: {
            pipelineGap: true,
            handlerNoResult: decision.handlerName
          },
          timing: {
            totalMs: now() - startedAt,
            matchedHandlerMs: 0
          }
        }
      }

      const output = {
        responseText: String(result.responseText || ""),
        handler: result.handler || decision.handlerName,
        intent: result.intent || decision.intent,
        routeType: result.routeType || decision.routeType,
        trace: [
          {
            handler: decision.handlerName,
            matched: true,
            durationMs: now() - startedAt,
            intent: result.intent || decision.intent,
            routeType: result.routeType || decision.routeType
          }
        ],
        diagnostics: {
          ...(result.diagnostics || {}),
          decision: {
            intent: decision.intent,
            handlerName: decision.handlerName,
            routeType: decision.routeType,
            requiresStreaming: decision.requiresStreaming,
            decisionMs: decision.decisionMs
          }
        },
        timing: {
          totalMs: now() - startedAt,
          matchedHandlerMs: now() - startedAt,
          decisionMs: decision.decisionMs
        }
      }

      writeDecisionLog(logger, "info", requestId, "ASK_GIOM_ROUTE_SELECTED", {
        handler: output.handler,
        intent: output.intent,
        routeType: output.routeType,
        totalMs: output.timing.totalMs,
        decisionMs: decision.decisionMs
      })

      return enrichWithEvaluation(output, {
        preparedPayload,
        routeQuestion,
        modelQuestion,
        decision,
        startedAt
      })
    } catch (error) {
      writeDecisionLog(logger, "error", requestId, "ASK_GIOM_HANDLER_FAILED", {
        handler: decision.handlerName,
        intent: decision.intent,
        error: error?.message || String(error || "unknown_error")
      })

      const contingencyResponse = ports.response.contingency(
        routeQuestion,
        preparedPayload.context,
        error?.message || "handler_failed"
      )

      const output = {
        responseText: contingencyResponse,
        handler: "contingencyFallback",
        intent: "fallback_ai_contingency",
        routeType: "fallback",
        trace: [
          {
            handler: decision.handlerName,
            matched: false,
            durationMs: now() - startedAt,
            error: error?.message || String(error || "unknown_error")
          }
        ],
        diagnostics: {
          pipelineGap: true,
          handlerFailure: decision.handlerName
        },
        timing: {
          totalMs: now() - startedAt,
          matchedHandlerMs: 0,
          decisionMs: decision.decisionMs
        }
      }

      return enrichWithEvaluation(output, {
        preparedPayload,
        routeQuestion,
        modelQuestion,
        decision,
        startedAt
      })
    }
  }

  const askGiom = async function askGiom(preparedPayload, options = {}) {
    if (!isPreparedAskPayload(preparedPayload)) {
      throw new Error("askGiom requires a PreparedAskPayload")
    }
    const decision = decisionRouter.decide(preparedPayload, {
      mode: options?.mode === "stream" ? "stream" : "standard"
    })
    return executeDecision(preparedPayload, decision)
  }

  askGiom.decide = (preparedPayload, options = {}) => decisionRouter.decide(preparedPayload, options)
  askGiom.execute = executeDecision

  return askGiom
}

export function createAskGiomLegacyAdapter(askGiom) {
  return async function askGiomLegacy(questionOrPreparedPayload, context = {}) {
    const preparedPayload = isPreparedAskPayload(questionOrPreparedPayload)
      ? questionOrPreparedPayload
      : buildLegacyPreparedAskPayload(questionOrPreparedPayload, context)

    const output = await askGiom(preparedPayload)
    return output.responseText
  }
}
