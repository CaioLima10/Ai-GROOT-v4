function capText(value = "", maxLen = 600) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim()
  return normalized.length > maxLen ? `${normalized.slice(0, Math.max(0, maxLen - 3)).trim()}...` : normalized
}

function inferTopic(question = "") {
  const input = String(question || "").toLowerCase()
  if (/\b(clima|tempo|previs)/.test(input)) return "weather"
  if (/\b(jogo|partida|futebol|time|campeonato)/.test(input)) return "sports"
  if (/\b(biblia|bíblia|jesus|deus|versiculo|versículo|evangelho)/.test(input)) return "bible"
  if (/\b(codigo|código|api|deploy|teste|bug|erro)/.test(input)) return "code"
  return "general"
}

function estimateTokenUsage(text = "") {
  return Math.ceil(String(text || "").length / 4)
}

function normalizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokenize(value = "") {
  return normalizeText(value)
    .split(" ")
    .map(token => token.trim())
    .filter(token => token.length >= 3)
}

function computeSimilarityScore(query = "", content = "") {
  const queryTokens = new Set(tokenize(query))
  const contentTokens = new Set(tokenize(content))
  if (queryTokens.size === 0 || contentTokens.size === 0) return 0

  let overlap = 0
  for (const token of queryTokens.values()) {
    if (contentTokens.has(token)) overlap += 1
  }

  return overlap / Math.max(queryTokens.size, 1)
}

function computeRecencyScore(createdAt, nowMs) {
  const createdMs = createdAt ? Date.parse(String(createdAt)) : NaN
  if (!Number.isFinite(createdMs)) return 0.45
  const ageMs = Math.max(0, nowMs - createdMs)
  const ageHours = ageMs / (60 * 60 * 1000)
  return 1 / (1 + (ageHours / 12))
}

function computeImportanceScore(content = "", topic = "general", intent = "") {
  const text = String(content || "")
  const normalized = normalizeText(text)

  let score = 0.25
  if (text.length >= 80) score += 0.2
  if (text.length >= 180) score += 0.1
  if (/\b(meu nome e|meu nome e|prefiro|gosto de|trabalho com|atuo com|objetivo|meta|prioridade)\b/i.test(normalized)) score += 0.35
  if (topic === "weather" && /\b(clima|tempo|temperatura|chuva|uv|vento|previs)\b/.test(normalized)) score += 0.2
  if (topic === "sports" && /\b(jogo|partida|futebol|time|campeonato|placar|rodada)\b/.test(normalized)) score += 0.2
  if (topic === "bible" && /\b(biblia|evangelho|jesus|deus|versiculo|oracao|teologia)\b/.test(normalized)) score += 0.2
  if (topic === "code" && /\b(codigo|api|deploy|erro|bug|teste|script|typescript|javascript)\b/.test(normalized)) score += 0.2
  if (String(intent || "").toLowerCase().includes("safety") && /\b(risco|seguro|cuidado|limite|politica|policy|compliance)\b/.test(normalized)) score += 0.15

  return Math.min(1, score)
}

function turnSignature(turn = {}) {
  return `${turn.role || "user"}::${normalizeText(turn.content || "")}`
}

function normalizeTurnCandidate(turn = {}, source = "unknown") {
  if (!turn || typeof turn !== "object") return null
  const role = turn.role === "assistant" ? "assistant" : "user"
  const content = String(turn.content || "").trim()
  if (!content) return null

  return {
    role,
    content,
    created_at: turn.created_at || new Date().toISOString(),
    semanticScore: Number(turn.semanticScore || 0),
    _source: source
  }
}

function historyItemToTurns(item = {}, source = "ltm_history") {
  if (!item || typeof item !== "object") return []
  const createdAt = item.timestamp || new Date().toISOString()
  const userText = String(item.user || "").trim()
  const aiText = String(item.ai || "").trim()

  const turns = []
  if (userText) turns.push({ role: "user", content: userText, created_at: createdAt, _source: source })
  if (aiText) turns.push({ role: "assistant", content: aiText, created_at: createdAt, _source: source })
  return turns
}

function trimTurnsByTokenBudget(turns = [], maxTokens = 300) {
  if (!Array.isArray(turns) || turns.length === 0) return []
  const budget = Math.max(80, Number(maxTokens || 300))
  const selected = []
  let running = 0

  for (const turn of turns) {
    const text = `${turn.role || "user"}: ${String(turn.content || "")}`
    const turnTokens = estimateTokenUsage(text)
    if ((running + turnTokens) > budget) continue
    selected.push(turn)
    running += turnTokens
  }

  return selected
}

function combineUniqueSummaryParts(parts = [], maxChars = 500) {
  const seen = new Set()
  const unique = []
  for (const part of parts) {
    const normalized = capText(part || "", maxChars)
    if (!normalized) continue
    const key = normalizeText(normalized)
    if (!key || seen.has(key)) continue
    seen.add(key)
    unique.push(normalized)
  }
  return unique.join(" | ")
}

/**
 * @param {{
 *   preparedPayload: import("../ask/buildPreparedAskPayload.d.ts").PreparedAskPayload,
 *   decisionResult: import("../ask/askGiom.d.ts").AskGiomDecisionResult,
 *   ports: {
 *     stm: import("./ports.d.ts").ConversationMemoryPort,
 *     retrieval: import("./ports.d.ts").RetrievalPort,
 *     runtimeContext: {
 *       enrich: (question: string, context: Record<string, unknown>, extras: Record<string, unknown>) => Promise<Record<string, unknown>>
 *     }
 *   },
 *   limits?: {
 *     maxConversationTurns?: number,
 *     maxMemorySummaryChars?: number,
 *     maxContextTokens?: number
 *   }
 * }} input
 */
export async function buildRuntimeContext(input) {
  const buildStartedAt = Date.now()
  const preparedPayload = input?.preparedPayload
  const decisionResult = input?.decisionResult
  const ports = input?.ports

  if (!preparedPayload || !ports?.stm || !ports?.retrieval || !ports?.runtimeContext) {
    throw new Error("buildRuntimeContext requires preparedPayload + stm + retrieval + runtimeContext ports")
  }

  const limits = {
    maxConversationTurns: Number(input?.limits?.maxConversationTurns || 10),
    maxMemorySummaryChars: Number(input?.limits?.maxMemorySummaryChars || 450),
    maxContextTokens: Number(input?.limits?.maxContextTokens || 1800),
    maxRetrievedItems: Number(input?.limits?.maxRetrievedItems || 18)
  }

  const userId = String(preparedPayload?.enrichedData?.request?.userId || "default_user")
  const sessionId = preparedPayload?.enrichedData?.request?.sessionId || null
  const question = String(preparedPayload.normalizedQuestion || "").trim()
  const topic = inferTopic(question)

  const stmFetchStartedAt = Date.now()
  const stmTurns = ports.stm.getRecentTurns({
    userId,
    sessionId,
    limit: limits.maxConversationTurns
  })
  const stmFetchMs = Date.now() - stmFetchStartedAt

  const retrievalStartedAt = Date.now()
  const ltm = await ports.retrieval.retrieveRelevant({
    userId,
    sessionId,
    query: question,
    intent: decisionResult?.intent,
    topic,
    limit: limits.maxConversationTurns,
    activeModules: Array.isArray(preparedPayload?.context?.activeModules) ? preparedPayload.context.activeModules : [],
    bibleStudyModules: Array.isArray(preparedPayload?.context?.bibleStudyModules) ? preparedPayload.context.bibleStudyModules : [],
    conversationHistory: stmTurns
  })
  const retrievalMs = Date.now() - retrievalStartedAt

  const nowMs = Date.now()
  const rawCandidates = [
    ...stmTurns
      .map(turn => normalizeTurnCandidate(turn, "stm"))
      .filter(Boolean),
    ...(Array.isArray(ltm?.conversationTurns) ? ltm.conversationTurns : [])
      .map(turn => normalizeTurnCandidate(turn, "ltm_turn"))
      .filter(Boolean),
    ...(Array.isArray(ltm?.history) ? ltm.history : [])
      .flatMap(item => historyItemToTurns(item, "ltm_history"))
      .map(turn => normalizeTurnCandidate(turn, turn?._source || "ltm_history"))
      .filter(Boolean)
  ]

  const candidateCount = rawCandidates.length
  const dedupeMap = new Map()
  for (const candidate of rawCandidates) {
    const signature = turnSignature(candidate)
    const existing = dedupeMap.get(signature)
    if (!existing) {
      dedupeMap.set(signature, candidate)
      continue
    }

    const existingScore = computeRecencyScore(existing.created_at, nowMs)
    const newScore = computeRecencyScore(candidate.created_at, nowMs)
    if (newScore >= existingScore) {
      dedupeMap.set(signature, candidate)
    }
  }

  const dedupedCandidates = Array.from(dedupeMap.values())
  const dedupedCount = dedupedCandidates.length

  const scoredCandidates = dedupedCandidates
    .map(turn => {
      const similarityScore = computeSimilarityScore(question, turn.content)
      const recencyScore = computeRecencyScore(turn.created_at, nowMs)
      const importanceScore = computeImportanceScore(turn.content, topic, decisionResult?.intent)
      const semanticScore = Math.max(0, Math.min(1, Number(turn.semanticScore || 0)))
      const sourceBoost = turn._source === "stm" ? 0.08 : 0
      // Hybrid score formula:
      // final = 0.40 * semantic + 0.25 * lexical + 0.20 * recency + 0.15 * importance + sourceBoost
      const finalScore = (0.40 * semanticScore) + (0.25 * similarityScore) + (0.20 * recencyScore) + (0.15 * importanceScore) + sourceBoost
      return {
        ...turn,
        _scores: {
          semantic: Number(semanticScore.toFixed(4)),
          similarity: Number(similarityScore.toFixed(4)),
          recency: Number(recencyScore.toFixed(4)),
          importance: Number(importanceScore.toFixed(4)),
          final: Number(finalScore.toFixed(4))
        }
      }
    })
    .sort((a, b) => b._scores.final - a._scores.final)

  const maxCandidates = Math.max(limits.maxConversationTurns, Math.min(limits.maxRetrievedItems, scoredCandidates.length))
  const topCandidates = scoredCandidates.slice(0, maxCandidates)

  const memoryTurnsTokenBudget = Math.max(140, Math.floor(limits.maxContextTokens * 0.34))
  const rankedTurns = trimTurnsByTokenBudget(topCandidates, memoryTurnsTokenBudget)
    .slice(0, limits.maxConversationTurns)

  const mergedTurns = rankedTurns.map(turn => ({
    role: turn.role,
    content: turn.content,
    created_at: turn.created_at
  }))

  const memorySummary = combineUniqueSummaryParts([
    ltm?.contextSummary || "",
    ltm?.summary || "",
    ltm?.knownFactsText || ""
  ], limits.maxMemorySummaryChars)

  const enrichStartedAt = Date.now()
  const enrichedContext = await ports.runtimeContext.enrich(
    question,
    {
      ...preparedPayload.context,
      conversationHistory: mergedTurns,
      memorySummary,
      memoryTopic: topic,
      memoryIntent: decisionResult?.intent || null,
      memoryProfile: ltm?.userProfile || {}
    },
    {
      userId,
      sessionId,
      requestId: preparedPayload?.enrichedData?.request?.requestId || "",
      timestamp: preparedPayload?.enrichedData?.request?.timestamp || new Date().toISOString(),
      conversationHistory: mergedTurns,
      memorySummary
    }
  )
  const enrichMs = Date.now() - enrichStartedAt

  let contextText = JSON.stringify(enrichedContext || {})
  let contextTokens = estimateTokenUsage(contextText)
  let appliedFallback = false
  let trimmedTurnsForBudget = 0

  if (contextTokens > limits.maxContextTokens && Array.isArray(enrichedContext?.conversationHistory)) {
    const nonHistoryTokens = estimateTokenUsage(JSON.stringify({
      ...enrichedContext,
      conversationHistory: []
    }))
    const availableHistoryTokens = Math.max(80, limits.maxContextTokens - nonHistoryTokens - 60)
    const originalTurns = Array.isArray(enrichedContext.conversationHistory) ? enrichedContext.conversationHistory : []
    const trimmedHistory = trimTurnsByTokenBudget(originalTurns, availableHistoryTokens)
    trimmedTurnsForBudget = Math.max(0, originalTurns.length - trimmedHistory.length)
    enrichedContext.conversationHistory = trimmedHistory
    contextText = JSON.stringify(enrichedContext || {})
    contextTokens = estimateTokenUsage(contextText)
  }

  if (contextTokens > limits.maxContextTokens) {
    enrichedContext.memorySummary = capText(enrichedContext.memorySummary || memorySummary, Math.max(120, Math.floor(limits.maxMemorySummaryChars * 0.6)))
    appliedFallback = true
    contextText = JSON.stringify(enrichedContext || {})
    contextTokens = estimateTokenUsage(contextText)
  }

  if (contextTokens > limits.maxContextTokens && Array.isArray(enrichedContext?.conversationHistory) && enrichedContext.conversationHistory.length > 2) {
    const keepTurns = Math.max(2, Math.min(4, enrichedContext.conversationHistory.length))
    trimmedTurnsForBudget += Math.max(0, enrichedContext.conversationHistory.length - keepTurns)
    enrichedContext.conversationHistory = enrichedContext.conversationHistory.slice(-keepTurns)
    appliedFallback = true
    contextText = JSON.stringify(enrichedContext || {})
    contextTokens = estimateTokenUsage(contextText)
  }

  const selectedSourceCounts = rankedTurns.reduce((acc, turn) => {
    const source = turn?._source || "unknown"
    acc[source] = (acc[source] || 0) + 1
    return acc
  }, {})

  const retrievalDiagnostics = ltm?.diagnostics && typeof ltm.diagnostics === "object"
    ? ltm.diagnostics
    : {}

  const totalMs = Date.now() - buildStartedAt

  return {
    preparedPayload: {
      ...preparedPayload,
      context: enrichedContext,
      enrichedData: {
        ...preparedPayload.enrichedData,
        memory: {
          topic,
          stmTurns: stmTurns.length,
          ltmTurns: Array.isArray(ltm?.conversationTurns) ? ltm.conversationTurns.length : 0,
          selectedTurns: mergedTurns.length,
          memorySummary,
          contextTokens,
          retrievalMs,
          enrichMs,
          totalMs,
          trimmedTurnsForBudget,
          appliedFallback
        }
      }
    },
    diagnostics: {
      topic,
      stmTurns: stmTurns.length,
      ltmTurns: Array.isArray(ltm?.conversationTurns) ? ltm.conversationTurns.length : 0,
      candidateCount,
      dedupedCount,
      selectedTurns: mergedTurns.length,
      selectedSourceCounts,
      memorySummaryLength: memorySummary.length,
      contextTokens,
      limits,
      timings: {
        stmFetchMs,
        retrievalMs,
        enrichMs,
        totalMs
      },
      retrieval: retrievalDiagnostics,
      semantic: {
        enabled: Boolean(retrievalDiagnostics?.semantic),
        meanSemanticScore: Number(retrievalDiagnostics?.semantic?.meanSemanticScore || 0),
        maxSemanticScore: Number(retrievalDiagnostics?.semantic?.maxSemanticScore || 0),
        retrievalAccuracyProxy: Number(retrievalDiagnostics?.semantic?.retrievalAccuracyProxy || 0)
      },
      budget: {
        exceeded: contextTokens > limits.maxContextTokens,
        trimmedTurnsForBudget,
        appliedFallback
      },
      topScores: topCandidates.slice(0, 5).map(item => ({
        source: item._source,
        role: item.role,
        preview: capText(item.content, 120),
        score: item._scores
      }))
    }
  }
}
