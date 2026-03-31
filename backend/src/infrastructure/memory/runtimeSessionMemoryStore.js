export function createRuntimeSessionMemoryStore(options = {}) {
  const ttlMs = Number(options.ttlMs || 30 * 60 * 1000)
  const maxTurnsPerSession = Number(options.maxTurnsPerSession || 24)
  const sessions = new Map()

  const keyFor = (userId, sessionId = null) => `${String(userId || "default_user")}::${String(sessionId || "default")}`

  const pruneExpired = () => {
    const now = Date.now()
    for (const [key, entry] of sessions.entries()) {
      if (!entry?.updatedAt || (now - entry.updatedAt) > ttlMs) {
        sessions.delete(key)
      }
    }
  }

  return {
    getRecentTurns({ userId, sessionId = null, limit = 8 }) {
      pruneExpired()
      const key = keyFor(userId, sessionId)
      const entry = sessions.get(key)
      if (!entry || !Array.isArray(entry.turns)) return []
      return entry.turns.slice(-Math.max(1, Number(limit || 8)))
    },

    appendTurn({ userId, sessionId = null, role, content, created_at }) {
      const normalized = String(content || "").trim()
      if (!normalized) return

      pruneExpired()
      const key = keyFor(userId, sessionId)
      const entry = sessions.get(key) || { turns: [], updatedAt: Date.now() }
      entry.turns.push({
        role: role === "assistant" ? "assistant" : "user",
        content: normalized,
        created_at: created_at || new Date().toISOString()
      })
      entry.turns = entry.turns.slice(-maxTurnsPerSession)
      entry.updatedAt = Date.now()
      sessions.set(key, entry)
    }
  }
}
