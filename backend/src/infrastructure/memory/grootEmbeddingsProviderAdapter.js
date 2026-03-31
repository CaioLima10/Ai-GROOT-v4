function normalizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function createGrootEmbeddingsProviderAdapter({
  embeddings,
  distributedCache,
  cacheTtlMs = 10 * 60 * 1000,
  cacheMaxEntries = 5000
}) {
  if (!embeddings || typeof embeddings.generateEmbedding !== "function") {
    throw new Error("createGrootEmbeddingsProviderAdapter requires embeddings.generateEmbedding")
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
    const oldestFirst = Array.from(cache.entries()).sort((a, b) => (a[1]?.createdAt || 0) - (b[1]?.createdAt || 0))
    const removeCount = Math.max(0, cache.size - cacheMaxEntries)
    for (const [key] of oldestFirst.slice(0, removeCount)) {
      cache.delete(key)
    }
  }

  const buildCacheKey = (text = "") => normalizeText(text)

  const setCache = (key, embedding) => {
    cache.set(key, {
      createdAt: Date.now(),
      expiresAt: Date.now() + Math.max(10_000, Number(cacheTtlMs || 0)),
      embedding: Array.isArray(embedding) ? embedding.slice() : []
    })
  }

  const getCachedLocal = (key) => {
    pruneCache()
    const hit = cache.get(key)
    if (!hit || hit.expiresAt <= Date.now()) return null
    return Array.isArray(hit.embedding) ? hit.embedding.slice() : null
  }

  const getCached = async (key) => {
    const local = getCachedLocal(key)
    if (local) return local

    if (!distributedCache?.getJson) return null

    const distributed = await distributedCache.getJson(`embedding:${key}`)
    const embedding = Array.isArray(distributed?.embedding) ? distributed.embedding : null
    if (!embedding || embedding.length === 0) return null

    setCache(key, embedding)
    return embedding.slice()
  }

  const setCached = async (key, embedding) => {
    setCache(key, embedding)

    if (!distributedCache?.setJson) return
    const ttlSeconds = Math.max(1, Math.floor(Number(cacheTtlMs || 0) / 1000))
    await distributedCache.setJson(`embedding:${key}`, { embedding: embedding.slice() }, ttlSeconds)
  }

  const embedText = async ({ text }) => {
    const normalized = String(text || "").trim()
    if (!normalized) {
      return { embedding: [], cached: true, dimensions: 0 }
    }

    const key = buildCacheKey(normalized)
    const cachedEmbedding = await getCached(key)
    if (cachedEmbedding) {
      return {
        embedding: cachedEmbedding,
        cached: true,
        dimensions: cachedEmbedding.length
      }
    }

    const embedding = await embeddings.generateEmbedding(normalized)
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("Embedding provider returned invalid vector")
    }

    await setCached(key, embedding)
    return {
      embedding: embedding.slice(),
      cached: false,
      dimensions: embedding.length
    }
  }

  const embedBatch = async ({ texts = [] }) => {
    if (!Array.isArray(texts) || texts.length === 0) return []

    const uniqueByKey = new Map()
    const order = []

    for (const text of texts) {
      const normalized = String(text || "").trim()
      const key = buildCacheKey(normalized)
      order.push({ text: normalized, key })
      if (!normalized) continue
      if (!uniqueByKey.has(key)) {
        uniqueByKey.set(key, normalized)
      }
    }

    const missingEntries = []
    const resolved = new Map()

    for (const [key, value] of uniqueByKey.entries()) {
      const cachedEmbedding = await getCached(key)
      if (cachedEmbedding) {
        resolved.set(key, {
          text: value,
          embedding: cachedEmbedding,
          cached: true,
          dimensions: cachedEmbedding.length
        })
      } else {
        missingEntries.push({ key, text: value })
      }
    }

    if (missingEntries.length > 0 && typeof embeddings.generateBatchEmbeddings === "function") {
      const batchResult = await embeddings.generateBatchEmbeddings(missingEntries.map(item => item.text))
      for (const item of batchResult || []) {
        const text = String(item?.text || "").trim()
        const embedding = Array.isArray(item?.embedding) ? item.embedding : []
        if (!text || embedding.length === 0) continue
        const key = buildCacheKey(text)
        await setCached(key, embedding)
        resolved.set(key, {
          text,
          embedding: embedding.slice(),
          cached: false,
          dimensions: embedding.length
        })
      }
    }

    for (const item of missingEntries) {
      if (resolved.has(item.key)) continue
      const one = await embedText({ text: item.text })
      resolved.set(item.key, {
        text: item.text,
        embedding: one.embedding,
        cached: one.cached,
        dimensions: one.dimensions
      })
    }

    return order.map(item => {
      if (!item.text) {
        return { text: "", embedding: [], cached: true, dimensions: 0 }
      }
      const value = resolved.get(item.key)
      return value || { text: item.text, embedding: [], cached: false, dimensions: 0 }
    })
  }

  const cosineSimilarity = ({ left = [], right = [] }) => {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length === 0 || right.length === 0) return 0

    let dot = 0
    let leftNorm = 0
    let rightNorm = 0
    const len = Math.min(left.length, right.length)

    for (let index = 0; index < len; index += 1) {
      dot += left[index] * right[index]
      leftNorm += left[index] * left[index]
      rightNorm += right[index] * right[index]
    }

    const leftSqrt = Math.sqrt(leftNorm)
    const rightSqrt = Math.sqrt(rightNorm)
    if (!leftSqrt || !rightSqrt) return 0
    return dot / (leftSqrt * rightSqrt)
  }

  return {
    embedText,
    embedBatch,
    cosineSimilarity
  }
}
