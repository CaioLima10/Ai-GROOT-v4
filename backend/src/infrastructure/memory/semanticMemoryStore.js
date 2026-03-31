import crypto from "crypto"

function normalizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function buildBucketKey(userId, sessionId = null) {
  return `${String(userId || "default_user")}::${String(sessionId || "default")}`
}

function hashId(value = "") {
  return crypto.createHash("sha1").update(String(value)).digest("hex")
}

function hydrateBucketItems(items = []) {
  const safeItems = Array.isArray(items) ? items : []
  const signatureSet = new Set(safeItems.map(item => normalizeText(item?.text || "")))
  return {
    items: safeItems,
    signatureSet
  }
}

export function createSemanticMemoryStore({
  embeddingProvider,
  distributedClient,
  ttlMs = 3 * 24 * 60 * 60 * 1000,
  maxItemsPerBucket = 5000
}) {
  if (!embeddingProvider || typeof embeddingProvider.cosineSimilarity !== "function") {
    throw new Error("createSemanticMemoryStore requires embeddingProvider.cosineSimilarity")
  }

  const buckets = new Map()

  const pruneExpired = () => {
    const now = Date.now()
    for (const [key, bucket] of buckets.entries()) {
      if (!bucket?.items?.length) {
        buckets.delete(key)
        continue
      }

      bucket.items = bucket.items.filter(item => {
        const createdMs = Date.parse(String(item.created_at || ""))
        if (!Number.isFinite(createdMs)) return true
        return (now - createdMs) <= ttlMs
      })

      if (bucket.items.length === 0) {
        buckets.delete(key)
      }
    }
  }

  const getOrCreateBucket = (userId, sessionId) => {
    pruneExpired()
    const key = buildBucketKey(userId, sessionId)
    const existing = buckets.get(key)
    if (existing) return existing

    const created = {
      key,
      items: [],
      signatureSet: new Set()
    }
    buckets.set(key, created)
    return created
  }

  const getDistributedBucket = async (userId, sessionId) => {
    if (!distributedClient?.getJson) return null
    const key = buildBucketKey(userId, sessionId)
    const payload = await distributedClient.getJson(`semantic-bucket:${key}`)
    if (!payload || !Array.isArray(payload.items)) return null
    return payload.items
  }

  const saveDistributedBucket = async (userId, sessionId, items = []) => {
    if (!distributedClient?.setJson) return
    const key = buildBucketKey(userId, sessionId)
    const ttlSeconds = Math.max(30, Math.floor(ttlMs / 1000))
    await distributedClient.setJson(`semantic-bucket:${key}`, { items }, ttlSeconds)
  }

  const ensureSynchronizedBucket = async (userId, sessionId) => {
    const bucket = getOrCreateBucket(userId, sessionId)
    const distributedItems = await getDistributedBucket(userId, sessionId)
    if (!distributedItems) return bucket

    if (distributedItems.length > bucket.items.length) {
      const hydrated = hydrateBucketItems(distributedItems)
      bucket.items = hydrated.items
      bucket.signatureSet = hydrated.signatureSet
      buckets.set(bucket.key, bucket)
    }

    return bucket
  }

  const upsertMany = async ({ userId, sessionId = null, items = [] }) => {
    if (!Array.isArray(items) || items.length === 0) return { inserted: 0, skipped: 0 }

    const bucket = await ensureSynchronizedBucket(userId, sessionId)
    let inserted = 0
    let skipped = 0

    for (const item of items) {
      const text = String(item?.text || "").trim()
      const embedding = Array.isArray(item?.embedding) ? item.embedding : []
      if (!text || embedding.length === 0) {
        skipped += 1
        continue
      }

      const signature = normalizeText(text)
      if (!signature || bucket.signatureSet.has(signature)) {
        skipped += 1
        continue
      }

      const createdAt = item?.created_at || new Date().toISOString()
      const id = item?.id || hashId(`${String(userId)}|${String(sessionId || "default")}|${signature}|${createdAt}|${item?.type || "generic"}`)

      bucket.items.push({
        id,
        text,
        embedding: embedding.slice(),
        type: item?.type || "history",
        created_at: createdAt,
        metadata: item?.metadata && typeof item.metadata === "object" ? { ...item.metadata } : {}
      })
      bucket.signatureSet.add(signature)
      inserted += 1
    }

    if (bucket.items.length > maxItemsPerBucket) {
      bucket.items = bucket.items
        .sort((a, b) => Date.parse(String(b.created_at || 0)) - Date.parse(String(a.created_at || 0)))
        .slice(0, maxItemsPerBucket)

      bucket.signatureSet = new Set(bucket.items.map(entry => normalizeText(entry.text)))
    }

    await saveDistributedBucket(userId, sessionId, bucket.items)

    return { inserted, skipped }
  }

  const searchSimilar = async ({
    userId,
    sessionId = null,
    queryEmbedding = [],
    limit = 12,
    minSimilarity = 0.2,
    allowedTypes = ["user", "assistant", "summary", "fact", "history"]
  }) => {
    const bucket = await ensureSynchronizedBucket(userId, sessionId)
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0 || !Array.isArray(bucket.items) || bucket.items.length === 0) {
      return []
    }

    const allowed = new Set(Array.isArray(allowedTypes) ? allowedTypes : [])
    const scored = []

    for (const item of bucket.items) {
      if (allowed.size > 0 && !allowed.has(item.type)) continue
      const semanticScore = embeddingProvider.cosineSimilarity({
        left: queryEmbedding,
        right: item.embedding
      })

      if (semanticScore < minSimilarity) continue
      scored.push({
        id: item.id,
        text: item.text,
        type: item.type,
        created_at: item.created_at,
        semanticScore,
        metadata: item.metadata || {}
      })
    }

    return scored
      .sort((a, b) => b.semanticScore - a.semanticScore)
      .slice(0, Math.max(1, Number(limit || 12)))
  }

  const addConversationPair = async ({ userId, sessionId = null, userText = "", assistantText = "", createdAt = new Date().toISOString() }) => {
    const texts = [String(userText || "").trim(), String(assistantText || "").trim()].filter(Boolean)
    if (texts.length === 0) return { inserted: 0, skipped: 0 }

    const embedded = await embeddingProvider.embedBatch({ texts })
    const embeddedByText = new Map(
      embedded
        .filter(item => Array.isArray(item?.embedding) && item.embedding.length > 0)
        .map(item => [String(item.text || "").trim(), item.embedding])
    )

    const items = []
    if (String(userText || "").trim()) {
      items.push({
        text: String(userText || "").trim(),
        embedding: embeddedByText.get(String(userText || "").trim()) || [],
        type: "user",
        created_at: createdAt,
        metadata: {
          source: "runtime_conversation"
        }
      })
    }

    if (String(assistantText || "").trim()) {
      items.push({
        text: String(assistantText || "").trim(),
        embedding: embeddedByText.get(String(assistantText || "").trim()) || [],
        type: "assistant",
        created_at: createdAt,
        metadata: {
          source: "runtime_conversation"
        }
      })
    }

    return upsertMany({
      userId,
      sessionId,
      items
    })
  }

  return {
    upsertMany,
    searchSimilar,
    addConversationPair
  }
}
