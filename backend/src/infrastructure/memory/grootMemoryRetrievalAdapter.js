import {
  releaseDistributedLock,
  waitForDistributedLock
} from "./redisLock.js"

function normalizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function computeRecencyScore(createdAt, nowMs) {
  const createdMs = createdAt ? Date.parse(String(createdAt)) : NaN
  if (!Number.isFinite(createdMs)) return 0.45
  const ageMs = Math.max(0, nowMs - createdMs)
  const ageHours = ageMs / (60 * 60 * 1000)
  return clamp01(1 / (1 + (ageHours / 18)))
}

function computeImportanceScore(text = "", type = "history") {
  const normalized = normalizeText(text)
  let score = 0.25
  if (normalized.length >= 60) score += 0.15
  if (normalized.length >= 180) score += 0.1
  if (/\b(meu nome|prefiro|objetivo|meta|trabalho com|atuo com|prioridade)\b/.test(normalized)) score += 0.35
  if (type === "fact") score += 0.2
  if (type === "summary") score += 0.12
  return clamp01(score)
}

function lexicalSimilarity(query = "", text = "") {
  const q = new Set(normalizeText(query).split(" ").filter(token => token.length >= 3))
  const t = new Set(normalizeText(text).split(" ").filter(token => token.length >= 3))
  if (q.size === 0 || t.size === 0) return 0

  let overlap = 0
  for (const token of q.values()) {
    if (t.has(token)) overlap += 1
  }
  return overlap / q.size
}

function buildHybridScore({ semanticScore, recencyScore, importanceScore }) {
  // Explicit hybrid formula:
  // final = 0.55 * semantic + 0.25 * recency + 0.20 * importance
  return (0.55 * clamp01(semanticScore)) + (0.25 * clamp01(recencyScore)) + (0.20 * clamp01(importanceScore))
}

function toSemanticItemCandidates({ context, userId, sessionId }) {
  const items = []
  const conversationTurns = Array.isArray(context?.conversationTurns) ? context.conversationTurns : []
  const history = Array.isArray(context?.history) ? context.history : []

  for (const turn of conversationTurns) {
    const content = String(turn?.content || "").trim()
    if (!content) continue
    items.push({
      text: content,
      type: turn?.role === "assistant" ? "assistant" : "user",
      created_at: turn?.created_at || new Date().toISOString(),
      metadata: {
        source: "connector_conversation_turn",
        role: turn?.role === "assistant" ? "assistant" : "user",
        userId,
        sessionId
      }
    })
  }

  for (const row of history) {
    const createdAt = row?.timestamp || new Date().toISOString()
    const userText = String(row?.user || "").trim()
    const aiText = String(row?.ai || "").trim()

    if (userText) {
      items.push({
        text: userText,
        type: "history",
        created_at: createdAt,
        metadata: {
          source: "connector_history",
          role: "user",
          userId,
          sessionId
        }
      })
    }

    if (aiText) {
      items.push({
        text: aiText,
        type: "history",
        created_at: createdAt,
        metadata: {
          source: "connector_history",
          role: "assistant",
          userId,
          sessionId
        }
      })
    }
  }

  if (String(context?.summary || "").trim()) {
    items.push({
      text: String(context.summary).trim(),
      type: "summary",
      created_at: new Date().toISOString(),
      metadata: {
        source: "connector_summary",
        userId,
        sessionId
      }
    })
  }

  if (String(context?.knownFactsText || "").trim()) {
    items.push({
      text: String(context.knownFactsText).trim(),
      type: "fact",
      created_at: new Date().toISOString(),
      metadata: {
        source: "connector_known_facts",
        userId,
        sessionId
      }
    })
  }

  return items
}

async function ensureSemanticStoreSeeded({ semanticStore, embeddingProvider, context, userId, sessionId }) {
  if (!semanticStore || !embeddingProvider) {
    return { inserted: 0, skipped: 0, generated: 0 }
  }

  const candidates = toSemanticItemCandidates({ context, userId, sessionId })
  if (candidates.length === 0) return { inserted: 0, skipped: 0, generated: 0 }

  const embedded = await embeddingProvider.embedBatch({ texts: candidates.map(item => item.text) })
  const embeddingByText = new Map(
    embedded
      .filter(entry => Array.isArray(entry?.embedding) && entry.embedding.length > 0)
      .map(entry => [String(entry.text || "").trim(), entry.embedding])
  )

  const items = candidates
    .map(item => ({
      ...item,
      embedding: embeddingByText.get(String(item.text || "").trim()) || []
    }))
    .filter(item => Array.isArray(item.embedding) && item.embedding.length > 0)

  if (items.length === 0) {
    return { inserted: 0, skipped: candidates.length, generated: 0 }
  }

  const upsert = await semanticStore.upsertMany({
    userId,
    sessionId,
    items
  })

  return {
    inserted: Number(upsert?.inserted || 0),
    skipped: Number(upsert?.skipped || 0),
    generated: items.length
  }
}

function summarizeConversationFingerprint(conversationHistory = []) {
  if (!Array.isArray(conversationHistory) || conversationHistory.length === 0) return "empty"
  const tail = conversationHistory.slice(-2)
  return tail
    .map(item => `${item?.role === "assistant" ? "a" : "u"}:${normalizeText(item?.content || "").slice(0, 80)}`)
    .join("|")
}

function buildCacheKey({ userId, sessionId, query, topic, intent, activeModules, bibleStudyModules, conversationHistory }) {
  return [
    `u:${String(userId || "default_user")}`,
    `s:${String(sessionId || "default")}`,
    `q:${normalizeText(query || "")}`,
    `t:${String(topic || "general")}`,
    `i:${String(intent || "none")}`,
    `m:${(Array.isArray(activeModules) ? activeModules : []).join(",")}`,
    `b:${(Array.isArray(bibleStudyModules) ? bibleStudyModules : []).join(",")}`,
    `h:${summarizeConversationFingerprint(conversationHistory)}`
  ].join("||")
}

export function createGrootMemoryRetrievalAdapter({
  connector,
  embeddingProvider,
  semanticStore,
  distributedCache,
  reranker,
  cacheTtlMs = 30_000,
  cacheMaxEntries = 250,
  distributedCacheTtlMs = 60_000,
  distributedLockTtlMs = 6_000,
  distributedLockTimeoutMs = 2_500,
  distributedLockRetryIntervalMs = 35,
  distributedCacheReadWaitMs = 1_500
}) {
  if (!connector || typeof connector.getContextForPrompt !== "function") {
    throw new Error("createGrootMemoryRetrievalAdapter requires connector.getContextForPrompt")
  }

  const cache = new Map()

  const pruneCache = () => {
    const now = Date.now()
    for (const [key, value] of cache.entries()) {
      if (!value?.expiresAt || value.expiresAt <= now) {
        cache.delete(key)
      }
    }

    if (cache.size <= cacheMaxEntries) return
    const entries = Array.from(cache.entries()).sort((a, b) => (a[1]?.createdAt || 0) - (b[1]?.createdAt || 0))
    const removeCount = Math.max(0, cache.size - cacheMaxEntries)
    for (const [key] of entries.slice(0, removeCount)) {
      cache.delete(key)
    }
  }

  return {
    async retrieveRelevant({
      userId,
      sessionId,
      query,
      limit = 6,
      topic,
      intent,
      activeModules = [],
      bibleStudyModules = [],
      conversationHistory = []
    }) {
      const startedAt = Date.now()
      const cacheKey = buildCacheKey({
        userId,
        sessionId,
        query,
        topic,
        intent,
        activeModules,
        bibleStudyModules,
        conversationHistory
      })

      pruneCache()
      const cached = cache.get(cacheKey)
      if (cached && cached.expiresAt > Date.now()) {
        return {
          ...cached.value,
          diagnostics: {
            ...(cached.value?.diagnostics || {}),
            cacheHit: true,
            cacheLayer: "local",
            retrievalMs: Date.now() - startedAt,
            source: "cache"
          }
        }
      }

      const distributedCacheKey = `retrieval:${cacheKey}`
      if (distributedCache?.getJson) {
        const distributedCached = await distributedCache.getJson(distributedCacheKey)
        if (distributedCached && typeof distributedCached === "object") {
          cache.set(cacheKey, {
            createdAt: Date.now(),
            expiresAt: Date.now() + Math.max(5_000, Number(cacheTtlMs || 30_000)),
            value: distributedCached
          })

          return {
            ...distributedCached,
            diagnostics: {
              ...(distributedCached?.diagnostics || {}),
              cacheHit: true,
              cacheLayer: "distributed",
              retrievalMs: Date.now() - startedAt,
              source: "distributed_cache"
            }
          }
        }
      }

      let lockToken = null
      let lockWaitMs = 0
      let lockTimedOut = false

      if (distributedCache) {
        const lockResult = await waitForDistributedLock({
          distributedClient: distributedCache,
          key: distributedCacheKey,
          ttlMs: Math.max(500, Number(distributedLockTtlMs || 6000)),
          timeoutMs: Math.max(100, Number(distributedLockTimeoutMs || 2500)),
          retryIntervalMs: Math.max(10, Number(distributedLockRetryIntervalMs || 35))
        })

        lockToken = lockResult.token
        lockWaitMs = Number(lockResult.waitedMs || 0)
        lockTimedOut = Boolean(lockResult.timedOut)

        if (!lockToken && distributedCache?.getJson) {
          const waitUntil = Date.now() + Math.max(100, Number(distributedCacheReadWaitMs || 1500))
          while (Date.now() < waitUntil) {
            const retryDistributed = await distributedCache.getJson(distributedCacheKey)
            if (retryDistributed && typeof retryDistributed === "object") {
              cache.set(cacheKey, {
                createdAt: Date.now(),
                expiresAt: Date.now() + Math.max(5_000, Number(cacheTtlMs || 30_000)),
                value: retryDistributed
              })

              return {
                ...retryDistributed,
                diagnostics: {
                  ...(retryDistributed?.diagnostics || {}),
                  cacheHit: true,
                  cacheLayer: "distributed_after_lock_wait",
                  lockWaitMs,
                  lockTimedOut,
                  retrievalMs: Date.now() - startedAt,
                  source: "distributed_cache"
                }
              }
            }
            await new Promise(resolve => setTimeout(resolve, Math.max(10, Number(distributedLockRetryIntervalMs || 35))))
          }
        }
      }

      try {
        const fetchStartedAt = Date.now()
        const context = await connector.getContextForPrompt(String(userId || "default_user"), {
          limit: Math.max(4, Math.min(Number(limit || 6), 16)),
          activeModules,
          bibleStudyModules,
          conversationHistory
        })
        const fetchMs = Date.now() - fetchStartedAt

        const semanticStartedAt = Date.now()
        let semanticDiagnostics = {
          enabled: Boolean(embeddingProvider && semanticStore),
          queryEmbeddingMs: 0,
          indexingMs: 0,
          vectorSearchMs: 0,
          semanticCandidates: 0,
          semanticSelected: 0,
          meanSemanticScore: 0,
          maxSemanticScore: 0
        }

        let semanticConversationTurns = []
        if (embeddingProvider && semanticStore) {
          const queryEmbeddingStartedAt = Date.now()
          const queryEmbedded = await embeddingProvider.embedText({ text: String(query || "") })
          semanticDiagnostics.queryEmbeddingMs = Date.now() - queryEmbeddingStartedAt

          const indexingStartedAt = Date.now()
          const seedResult = await ensureSemanticStoreSeeded({
            semanticStore,
            embeddingProvider,
            context,
            userId,
            sessionId
          })
          semanticDiagnostics.indexingMs = Date.now() - indexingStartedAt

          const searchStartedAt = Date.now()
          const rawSemanticHits = await semanticStore.searchSimilar({
            userId,
            sessionId,
            queryEmbedding: queryEmbedded.embedding,
            limit: Math.max(8, Number(limit || 6) * 4),
            minSimilarity: Number(process.env.MEMORY_SEMANTIC_MIN_SIMILARITY || 0.18)
          })
          semanticDiagnostics.vectorSearchMs = Date.now() - searchStartedAt
          semanticDiagnostics.semanticCandidates = rawSemanticHits.length

          const nowMs = Date.now()
          const ranked = rawSemanticHits
            .map(hit => {
              const semanticScore = clamp01(Number(hit.semanticScore || 0))
              const recencyScore = computeRecencyScore(hit.created_at, nowMs)
              const importanceScore = computeImportanceScore(hit.text, hit.type)
              const hybridScore = buildHybridScore({
                semanticScore,
                recencyScore,
                importanceScore
              })
              return {
                ...hit,
                semanticScore,
                recencyScore,
                importanceScore,
                lexicalScore: lexicalSimilarity(query, hit.text),
                hybridScore
              }
            })
            .sort((a, b) => b.hybridScore - a.hybridScore)

          const rerankerFn = typeof reranker === "function"
            ? reranker
            : (candidates, queryText) => candidates
              .map(item => {
                const rerankScore = (0.7 * item.hybridScore) + (0.3 * lexicalSimilarity(queryText, item.text))
                return {
                  ...item,
                  rerankScore
                }
              })
              .sort((a, b) => b.rerankScore - a.rerankScore)

          const reranked = await Promise.resolve(rerankerFn(ranked.slice(0, Math.max(10, Number(limit || 6) * 2)), String(query || "")))
          const selected = (Array.isArray(reranked) ? reranked : ranked).slice(0, Math.max(4, Number(limit || 6)))

          semanticDiagnostics.semanticSelected = selected.length
          semanticDiagnostics.indexedInserted = seedResult.inserted
          semanticDiagnostics.indexedSkipped = seedResult.skipped
          semanticDiagnostics.indexedGenerated = seedResult.generated
          semanticDiagnostics.meanSemanticScore = selected.length > 0
            ? selected.reduce((sum, item) => sum + Number(item.semanticScore || 0), 0) / selected.length
            : 0
          semanticDiagnostics.maxSemanticScore = selected.length > 0
            ? Math.max(...selected.map(item => Number(item.semanticScore || 0)))
            : 0

          semanticConversationTurns = selected.map(item => ({
            role: item.type === "assistant" ? "assistant" : "user",
            content: String(item.text || "").trim(),
            created_at: item.created_at || new Date().toISOString(),
            semanticScore: Number(item.semanticScore || 0),
            hybridScore: Number(item.hybridScore || 0),
            importanceScore: Number(item.importanceScore || 0),
            recencyScore: Number(item.recencyScore || 0),
            source: "semantic_index"
          }))
        }

        semanticDiagnostics.totalSemanticMs = Date.now() - semanticStartedAt

        const baseTurns = Array.isArray(context?.conversationTurns) ? context.conversationTurns : []
        const mergedTurns = [...semanticConversationTurns, ...baseTurns]

        const value = {
          contextSummary: context?.contextSummary || "",
          summary: context?.summary || "",
          knownFactsText: context?.knownFactsText || "",
          recentConversationText: context?.recentConversationText || "",
          conversationTurns: mergedTurns,
          history: Array.isArray(context?.history) ? context.history : [],
          userProfile: context?.userProfile && typeof context.userProfile === "object" ? context.userProfile : {},
          diagnostics: {
            cacheHit: false,
            cacheLayer: "miss",
            retrievalMs: Date.now() - startedAt,
            connectorFetchMs: fetchMs,
            semanticMs: semanticDiagnostics.totalSemanticMs,
            source: "grootMemoryConnector",
            cache: {
              localHit: false,
              distributedHit: false,
              lockAcquired: Boolean(lockToken),
              lockWaitMs,
              lockTimedOut
            },
            counts: {
              conversationTurns: mergedTurns.length,
              semanticConversationTurns: semanticConversationTurns.length,
              history: Array.isArray(context?.history) ? context.history.length : 0,
              hasSummary: Boolean(context?.summary),
              hasKnownFacts: Boolean(context?.knownFactsText)
            },
            semantic: {
              ...semanticDiagnostics,
              retrievalAccuracyProxy: semanticDiagnostics.meanSemanticScore
            }
          }
        }

        cache.set(cacheKey, {
          createdAt: Date.now(),
          expiresAt: Date.now() + Math.max(5_000, Number(cacheTtlMs || 30_000)),
          value
        })

        if (distributedCache?.setJson) {
          await distributedCache.setJson(
            distributedCacheKey,
            value,
            Math.max(1, Math.floor(Math.max(1000, Number(distributedCacheTtlMs || 60_000)) / 1000))
          )
        }

        return value
      } finally {
        if (lockToken && distributedCache) {
          await releaseDistributedLock({
            distributedClient: distributedCache,
            key: distributedCacheKey,
            token: lockToken
          }).catch(() => { })
        }
      }
    }
  }
}
