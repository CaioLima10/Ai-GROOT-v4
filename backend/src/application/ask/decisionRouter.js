function isPreparedAskPayload(value) {
  return Boolean(value) && typeof value === "object" &&
    typeof value.normalizedQuestion === "string" &&
    typeof value.preparedQuestion === "string" &&
    value.context && typeof value.context === "object"
}

function writeDecisionLog(logger, level, requestId, event, payload) {
  if (!logger || typeof logger[level] !== "function") return
  try {
    logger[level](requestId, event, payload)
  } catch (_) {
    // Decision logs must never break request handling.
  }
}

/**
 * @param {{
 *   ports: {
 *     deterministicUpload: { resolve: (question: string, context: Record<string, unknown>) => string | null },
 *     greeting: { detect: (question: string) => { isGreetingOnly?: boolean } },
 *     safety: { resolve: (question: string, context: Record<string, unknown>) => { responseText: string } | null },
 *     bible: {
 *       passages: { resolve: (question: string, context: Record<string, unknown>) => string | null },
 *       guidance: { resolve: (question: string, context: Record<string, unknown>) => string | null }
 *     },
 *     weather: { resolve: (question: string, context: Record<string, unknown>) => string | null },
 *     fixture: { resolve: (question: string, context: Record<string, unknown>) => string | null }
 *   },
 *   logger?: { info?: Function, error?: Function },
 *   now?: () => number
 * }} config
 */
export function createDecisionRouter(config) {
  const ports = config?.ports
  const logger = config?.logger
  const now = typeof config?.now === "function" ? config.now : () => Date.now()

  if (!ports) {
    throw new Error("createDecisionRouter requires ports")
  }

  return {
    /**
     * @param {import("./buildPreparedAskPayload.d.ts").PreparedAskPayload} preparedPayload
     * @param {{ mode?: "standard" | "stream" }} [options]
     */
    decide(preparedPayload, options = {}) {
      if (!isPreparedAskPayload(preparedPayload)) {
        throw new Error("decisionRouter.decide requires a PreparedAskPayload")
      }

      const startedAt = now()
      const mode = options.mode === "stream" ? "stream" : "standard"
      const routeQuestion = String(preparedPayload.context?.originalQuestion || preparedPayload.normalizedQuestion || "").trim()
      const requestId = String(preparedPayload.enrichedData?.request?.requestId || "decision_router")

      /** @type {Array<{ intent: string, matched: boolean, handlerName: string, durationMs: number }>} */
      const checks = []

      const evaluate = (intent, handlerName, fn) => {
        const t0 = now()
        const matched = Boolean(fn())
        checks.push({ intent, matched, handlerName, durationMs: now() - t0 })
        return matched
      }

      let decision

      if (evaluate("deterministic_upload", "uploadResponseHandler", () => ports.deterministicUpload.resolve(routeQuestion, preparedPayload.context))) {
        decision = {
          intent: "deterministic_upload",
          handlerName: "uploadResponseHandler",
          routeType: "deterministic",
          requiresStreaming: false
        }
      } else if (evaluate("greeting", "greetingHandler", () => ports.greeting.detect(routeQuestion)?.isGreetingOnly)) {
        decision = {
          intent: "greeting",
          handlerName: "greetingHandler",
          routeType: "deterministic",
          requiresStreaming: false
        }
      } else if (evaluate("safety", "safetyHandler", () => ports.safety.resolve(routeQuestion, preparedPayload.context))) {
        decision = {
          intent: "safety",
          handlerName: "safetyHandler",
          routeType: "deterministic",
          requiresStreaming: false
        }
      } else if (evaluate("bible_passage", "biblePassageHandler", () => ports.bible.passages.resolve(routeQuestion, preparedPayload.context))) {
        decision = {
          intent: "bible_passage",
          handlerName: "biblePassageHandler",
          routeType: "deterministic",
          requiresStreaming: false
        }
      } else if (evaluate("bible_guidance", "bibleGuidanceHandler", () => ports.bible.guidance.resolve(routeQuestion, preparedPayload.context))) {
        decision = {
          intent: "bible_guidance",
          handlerName: "bibleGuidanceHandler",
          routeType: "deterministic",
          requiresStreaming: false
        }
      } else if (evaluate("weather", "weatherHandler", () => ports.weather.resolve(routeQuestion, preparedPayload.context))) {
        decision = {
          intent: "weather",
          handlerName: "weatherHandler",
          routeType: "deterministic",
          requiresStreaming: false
        }
      } else if (evaluate("sports_fixture", "fixtureHandler", () => ports.fixture.resolve(routeQuestion, preparedPayload.context))) {
        decision = {
          intent: "sports_fixture",
          handlerName: "fixtureHandler",
          routeType: "deterministic",
          requiresStreaming: false
        }
      } else {
        decision = {
          intent: "fallback_ai",
          handlerName: "fallbackAIHandler",
          routeType: mode === "stream" ? "stream" : "ai",
          requiresStreaming: mode === "stream"
        }
      }

      const result = {
        ...decision,
        decisionMs: now() - startedAt,
        checks
      }

      writeDecisionLog(logger, "info", requestId, "ASK_DECISION_SELECTED", {
        intent: result.intent,
        handlerName: result.handlerName,
        routeType: result.routeType,
        requiresStreaming: result.requiresStreaming,
        decisionMs: result.decisionMs
      })

      return result
    }
  }
}
