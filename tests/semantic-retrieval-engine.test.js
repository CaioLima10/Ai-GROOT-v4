import assert from "node:assert/strict"
import test from "node:test"

import { createGrootMemoryRetrievalAdapter } from "../backend/src/infrastructure/memory/grootMemoryRetrievalAdapter.js"
import { createSemanticMemoryStore } from "../backend/src/infrastructure/memory/semanticMemoryStore.js"

function tokenize(text = "") {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
}

function toVector(text = "") {
  const dims = 64
  const vec = new Array(dims).fill(0)
  const words = tokenize(text)
  if (!words.length) return vec
  for (const word of words) {
    let hash = 0
    for (let i = 0; i < word.length; i += 1) {
      hash = ((hash << 5) - hash) + word.charCodeAt(i)
      hash |= 0
    }
    vec[Math.abs(hash) % dims] += 1 / words.length
  }
  const norm = Math.sqrt(vec.reduce((sum, value) => sum + (value * value), 0))
  if (!norm) return vec
  return vec.map(value => value / norm)
}

const embeddingProvider = {
  async embedText({ text }) {
    const embedding = toVector(text)
    return {
      embedding,
      cached: false,
      dimensions: embedding.length
    }
  },
  async embedBatch({ texts }) {
    return (texts || []).map(text => {
      const embedding = toVector(text)
      return {
        text,
        embedding,
        cached: false,
        dimensions: embedding.length
      }
    })
  },
  cosineSimilarity({ left, right }) {
    let dot = 0
    let leftNorm = 0
    let rightNorm = 0
    const len = Math.min(left.length, right.length)
    for (let i = 0; i < len; i += 1) {
      dot += left[i] * right[i]
      leftNorm += left[i] * left[i]
      rightNorm += right[i] * right[i]
    }
    if (!leftNorm || !rightNorm) return 0
    return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))
  }
}

test("semantic retrieval returns meaningful top hits with hybrid diagnostics", async () => {
  const semanticStore = createSemanticMemoryStore({
    embeddingProvider,
    ttlMs: 24 * 60 * 60 * 1000,
    maxItemsPerBucket: 500
  })

  const connector = {
    async getContextForPrompt() {
      return {
        contextSummary: "Topicos: latencia, memoria, ask",
        summary: "Usuario quer contexto enxuto para endpoint ask",
        knownFactsText: "Nome: Gabe | Area: backend",
        conversationTurns: [
          {
            role: "user",
            content: "Quero reduzir latencia do endpoint ask com contexto relevante",
            created_at: "2026-03-30T10:00:00.000Z"
          },
          {
            role: "assistant",
            content: "Podemos usar embeddings e ranking hibrido",
            created_at: "2026-03-30T10:00:02.000Z"
          }
        ],
        history: [
          {
            user: "Como tirar ruido do contexto?",
            ai: "Use top-k semantico e deduplicacao",
            timestamp: "2026-03-29T11:00:00.000Z"
          }
        ],
        userProfile: {
          style: "technical"
        }
      }
    }
  }

  const retrieval = createGrootMemoryRetrievalAdapter({
    connector,
    embeddingProvider,
    semanticStore,
    cacheTtlMs: 30_000,
    cacheMaxEntries: 50
  })

  const first = await retrieval.retrieveRelevant({
    userId: "u_sem",
    sessionId: "s_sem",
    query: "Como reduzir latencia no ask com contexto semantico?",
    limit: 6,
    topic: "code",
    intent: "technical_optimization",
    activeModules: ["backend"],
    bibleStudyModules: [],
    conversationHistory: []
  })

  assert.ok(Array.isArray(first.conversationTurns))
  assert.ok(first.conversationTurns.length > 0)
  assert.equal(first.diagnostics.semantic.enabled, true)
  assert.ok(first.diagnostics.semantic.semanticSelected > 0)
  assert.ok(first.diagnostics.semantic.maxSemanticScore > 0)
  assert.ok(first.diagnostics.semantic.retrievalAccuracyProxy >= 0)
  assert.equal(
    first.conversationTurns.some((turn) => /^Nome:/i.test(String(turn.content || ""))),
    false
  )

  const second = await retrieval.retrieveRelevant({
    userId: "u_sem",
    sessionId: "s_sem",
    query: "Como reduzir latencia no ask com contexto semantico?",
    limit: 6,
    topic: "code",
    intent: "technical_optimization",
    activeModules: ["backend"],
    bibleStudyModules: [],
    conversationHistory: []
  })

  assert.equal(second.diagnostics.cacheHit, true)
})

test("semantic retrieval uses distributed cache across adapter instances", async () => {
  const distributedMap = new Map()

  const distributedCache = {
    async getJson(key) {
      return distributedMap.has(key) ? JSON.parse(JSON.stringify(distributedMap.get(key))) : null
    },
    async setJson(key, value) {
      distributedMap.set(key, JSON.parse(JSON.stringify(value)))
    },
    async setNx(key, value) {
      if (distributedMap.has(`lock:${key}`)) return false
      distributedMap.set(`lock:${key}`, String(value))
      return true
    },
    async delIfValue(key, expectedValue) {
      const current = distributedMap.get(key)
      if (current !== String(expectedValue)) return false
      distributedMap.delete(key)
      return true
    },
    async getString(key) {
      return distributedMap.get(key) || null
    },
    async del(key) {
      distributedMap.delete(key)
    }
  }

  const connector = {
    async getContextForPrompt() {
      return {
        summary: "cache distributed test",
        knownFactsText: "Nome: Gabe",
        conversationTurns: [
          {
            role: "user",
            content: "Quero melhoria de cache distribuido para retrieval",
            created_at: "2026-03-30T10:00:00.000Z"
          }
        ],
        history: []
      }
    }
  }

  const firstAdapter = createGrootMemoryRetrievalAdapter({
    connector,
    embeddingProvider,
    semanticStore: createSemanticMemoryStore({
      embeddingProvider,
      ttlMs: 24 * 60 * 60 * 1000,
      maxItemsPerBucket: 500,
      distributedClient: distributedCache
    }),
    distributedCache
  })

  const first = await firstAdapter.retrieveRelevant({
    userId: "u_dist",
    sessionId: "s_dist",
    query: "cache distribuido top n retrieval",
    limit: 6,
    topic: "code",
    intent: "technical_optimization",
    activeModules: ["backend"],
    bibleStudyModules: [],
    conversationHistory: []
  })

  assert.equal(first.diagnostics.cacheHit, false)

  const secondAdapter = createGrootMemoryRetrievalAdapter({
    connector,
    embeddingProvider,
    semanticStore: createSemanticMemoryStore({
      embeddingProvider,
      ttlMs: 24 * 60 * 60 * 1000,
      maxItemsPerBucket: 500,
      distributedClient: distributedCache
    }),
    distributedCache
  })

  const second = await secondAdapter.retrieveRelevant({
    userId: "u_dist",
    sessionId: "s_dist",
    query: "cache distribuido top n retrieval",
    limit: 6,
    topic: "code",
    intent: "technical_optimization",
    activeModules: ["backend"],
    bibleStudyModules: [],
    conversationHistory: []
  })

  assert.equal(second.diagnostics.cacheHit, true)
  assert.equal(second.diagnostics.cacheLayer, "distributed")
})

test("semantic retrieval does not replay known facts as synthetic user turns", async () => {
  const semanticStore = createSemanticMemoryStore({
    embeddingProvider,
    ttlMs: 24 * 60 * 60 * 1000,
    maxItemsPerBucket: 500
  })

  const connector = {
    async getContextForPrompt() {
      return {
        contextSummary: "Topicos: genesis, memoria",
        summary: "Usuario quer continuidade correta",
        knownFactsText: "Nome: Gabriel | Objetivo atual: Livro de Genesis",
        conversationTurns: [
          {
            role: "user",
            content: "Meu nome e Gabriel e estamos estudando o Livro de Genesis.",
            created_at: "2026-04-02T10:00:00.000Z"
          },
          {
            role: "assistant",
            content: "Entendido.",
            created_at: "2026-04-02T10:00:01.000Z"
          }
        ],
        history: [],
        userProfile: {
          style: "natural",
          knownFacts: {
            name: "Gabriel",
            currentGoal: "Livro de Genesis"
          }
        }
      }
    }
  }

  const retrieval = createGrootMemoryRetrievalAdapter({
    connector,
    embeddingProvider,
    semanticStore,
    cacheTtlMs: 30_000,
    cacheMaxEntries: 50
  })

  const result = await retrieval.retrieveRelevant({
    userId: "u_facts",
    sessionId: "s_facts",
    query: "Qual e meu nome e qual livro estamos estudando agora?",
    limit: 6,
    topic: "general",
    intent: "fallback_ai",
    activeModules: [],
    bibleStudyModules: [],
    conversationHistory: []
  })

  assert.equal(result.knownFactsText, "Nome: Gabriel | Objetivo atual: Livro de Genesis")
  assert.equal(
    result.conversationTurns.some((turn) => /^Nome:/i.test(String(turn.content || ""))),
    false
  )
})
