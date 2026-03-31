const GENERIC_FALLBACK_PATTERN = /^nao consegui (?:responder|processar) /i

function isGenericFallbackResponse(text = "") {
  return GENERIC_FALLBACK_PATTERN.test(String(text || "").trim())
}

function isRetryableProviderFailure(reason = "") {
  const details = String(reason || "").toLowerCase()
  return /timeout|timed out|rate limit|quota|429|500|502|503|504|overload|temporar|temporari|network|socket|econn|fetch|conexao|conexão|indisponivel|indisponível/.test(details)
}

function buildEffectiveContext(payload, routeQuestion, modelQuestion, answer) {
  if (answer?.contextEnhancements && typeof answer.contextEnhancements === "object") {
    return {
      ...payload.context,
      ...answer.contextEnhancements,
      originalQuestion: routeQuestion,
      composedQuestion: modelQuestion || routeQuestion
    }
  }

  return payload.context
}

/**
 * @param {{ routeQuestion: string, modelQuestion: string, payload: import("../buildPreparedAskPayload.d.ts").PreparedAskPayload, ports: Record<string, any> }} input
 */
export async function fallbackAIHandler({ routeQuestion, modelQuestion, payload, ports }) {
  const maxAttempts = Math.max(1, Number(process.env.GIOM_FALLBACK_AI_MAX_ATTEMPTS || 2))
  const baseContext = {
    ...payload.context,
    originalQuestion: routeQuestion,
    composedQuestion: modelQuestion || routeQuestion
  }

  let lastFailure = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const retryReason = lastFailure?.reason || null
    const attemptContext = attempt === 1
      ? baseContext
      : {
        ...baseContext,
        retryAttempt: attempt,
        retryReason,
        retryingAfterFallback: true
      }

    let answer
    try {
      answer = await ports.aiProvider.ask(modelQuestion || routeQuestion, attemptContext)
    } catch (error) {
      lastFailure = {
        type: "provider_exception",
        reason: error?.message || String(error || "falha do provedor")
      }

      if (attempt < maxAttempts && isRetryableProviderFailure(lastFailure.reason)) {
        continue
      }

      break
    }

    const effectiveContext = buildEffectiveContext(payload, routeQuestion, modelQuestion, answer)

    if (answer && typeof answer === "object" && answer.success === false) {
      lastFailure = {
        type: "provider_failure",
        reason: answer.error || answer.code || "falha do provedor",
        effectiveContext,
        contextEnhanced: Boolean(answer?.contextEnhancements)
      }

      if (attempt < maxAttempts && isRetryableProviderFailure(lastFailure.reason)) {
        continue
      }

      break
    }

    const normalizedResponse = ports.response.normalize(answer)
    if (!normalizedResponse) {
      lastFailure = {
        type: "empty_response",
        reason: "resposta vazia da IA",
        effectiveContext,
        contextEnhanced: Boolean(answer?.contextEnhancements)
      }

      if (attempt < maxAttempts) {
        continue
      }

      break
    }

    const responseText = ports.response.postProcess(routeQuestion, normalizedResponse, effectiveContext)
    if (isGenericFallbackResponse(responseText)) {
      lastFailure = {
        type: "sanitized_generic_fallback",
        reason: "resposta sanitizada para fallback generico",
        effectiveContext,
        contextEnhanced: Boolean(answer?.contextEnhancements)
      }

      if (attempt < maxAttempts) {
        continue
      }

      break
    }

    return {
      handled: true,
      intent: "fallback_ai",
      handler: "fallbackAIHandler",
      responseText,
      routeType: "ai",
      diagnostics: {
        attemptsUsed: attempt,
        contextEnhanced: Boolean(answer?.contextEnhancements),
        ragSources: Array.isArray(answer?.contextEnhancements?.ragSources)
          ? answer.contextEnhancements.ragSources.length
          : 0
      }
    }
  }

  const finalContext = lastFailure?.effectiveContext || payload.context
  const finalReason = lastFailure?.reason || "falha do provedor"

  return {
    handled: true,
    intent: lastFailure?.type === "empty_response" ? "fallback_ai_empty" : "fallback_ai_contingency",
    handler: "fallbackAIHandler",
    responseText: ports.response.contingency(routeQuestion, finalContext, finalReason),
    routeType: "fallback",
    diagnostics: {
      attemptsUsed: maxAttempts,
      providerFailure: lastFailure?.type === "provider_failure" || lastFailure?.type === "provider_exception",
      providerError: finalReason,
      emptyResponse: lastFailure?.type === "empty_response",
      sanitizedGenericFallback: lastFailure?.type === "sanitized_generic_fallback",
      contextEnhanced: Boolean(lastFailure?.contextEnhanced)
    }
  }
}
