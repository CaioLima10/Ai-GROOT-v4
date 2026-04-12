function buildRuntimeId(prefix = "voice") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function sanitizeValue(value, depth = 0) {
  if (depth > 2) {
    return "[depth_limit]"
  }

  if (value == null) {
    return value
  }

  if (typeof value === "string") {
    return value.length > 300 ? `${value.slice(0, 297)}...` : value
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => sanitizeValue(entry, depth + 1))
  }

  if (typeof value === "object") {
    return Object.entries(value).slice(0, 24).reduce((acc, [key, entry]) => {
      acc[key] = sanitizeValue(entry, depth + 1)
      return acc
    }, {})
  }

  return String(value)
}

function buildVoiceError(message, code, statusCode = 400) {
  const error = new Error(message)
  error.code = code
  error.statusCode = statusCode
  return error
}

function pushBounded(store, entry, maxItems) {
  store.push(entry)
  if (store.length > maxItems) {
    store.splice(0, store.length - maxItems)
  }
}

function toPublicEvent(event) {
  return {
    id: event.id,
    type: event.type,
    direction: event.direction,
    requestId: event.requestId,
    traceId: event.traceId,
    createdAt: event.createdAt,
    final: Boolean(event.final),
    text: event.text || null,
    payload: event.payload || null
  }
}

function toPublicSession(session) {
  if (!session) return null

  return {
    sessionId: session.sessionId,
    status: session.status,
    userId: session.userId,
    locale: session.locale,
    transport: session.transport,
    voice: session.voice,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastActivityAt: session.lastActivityAt,
    capabilities: session.capabilities,
    vad: session.vad,
    metadata: session.metadata
  }
}

export function createEnterpriseVoiceRuntime(options = {}) {
  const sessions = new Map()
  const maxSessions = Math.max(20, Number(options.maxSessions || 200))
  const maxEventsPerSession = Math.max(20, Number(options.maxEventsPerSession || 250))
  const sessionTtlMs = Math.max(60_000, Number(options.sessionTtlMs || 6 * 60 * 60 * 1000))
  const logger = options.logger || null
  const resolveCapabilities = typeof options.resolveCapabilities === "function"
    ? options.resolveCapabilities
    : null

  function cleanupExpiredSessions() {
    const now = Date.now()
    for (const [sessionId, session] of sessions.entries()) {
      const lastActivityMs = Date.parse(session.lastActivityAt || session.updatedAt || session.createdAt || 0)
      if (Number.isFinite(lastActivityMs) && now - lastActivityMs > sessionTtlMs) {
        for (const subscriber of session.subscribers) {
          try {
            subscriber({
              id: buildRuntimeId("voiceevt"),
              type: "session.expired",
              direction: "system",
              createdAt: new Date().toISOString(),
              final: true,
              text: null,
              requestId: null,
              traceId: null,
              payload: {
                sessionId
              }
            })
          } catch {
            // noop
          }
        }
        sessions.delete(sessionId)
      }
    }

    if (sessions.size <= maxSessions) {
      return
    }

    const removable = Array.from(sessions.values())
      .sort((left, right) => Date.parse(left.lastActivityAt || left.updatedAt || left.createdAt || 0) - Date.parse(right.lastActivityAt || right.updatedAt || right.createdAt || 0))

    while (sessions.size > maxSessions && removable.length > 0) {
      const session = removable.shift()
      sessions.delete(session.sessionId)
    }
  }

  function createSession(input = {}) {
    cleanupExpiredSessions()
    const now = new Date().toISOString()
    const sessionId = buildRuntimeId("rtvoice")
    const baseCapabilities = {
      transcriptions: true,
      speech: true,
      vad: true,
      realtime: true,
      provider: "browser-assisted-local"
    }
    const runtimeCapabilities = sanitizeValue(resolveCapabilities?.(input) || {})
    const session = {
      sessionId,
      status: "active",
      userId: String(input.userId || "anonymous"),
      locale: String(input.locale || "pt-BR"),
      transport: String(input.transport || "sse"),
      voice: {
        input: String(input.inputVoice || input.voice || "browser-default"),
        output: String(input.outputVoice || input.voice || "browser-default")
      },
      vad: {
        enabled: input.vad?.enabled !== false,
        threshold: Number(input.vad?.threshold || 0.045),
        silenceMs: Math.max(300, Number(input.vad?.silenceMs || 1_400)),
        sampleRate: Number(input.vad?.sampleRate || 16_000)
      },
      capabilities: {
        ...baseCapabilities,
        ...runtimeCapabilities
      },
      metadata: sanitizeValue(input.metadata || {}),
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      events: [],
      subscribers: new Set()
    }

    sessions.set(sessionId, session)
    logger?.info?.(sessionId, "VOICE_SESSION_CREATED", {
      userId: session.userId,
      locale: session.locale
    })
    return toPublicSession(session)
  }

  function getInternalSession(sessionId) {
    cleanupExpiredSessions()
    return sessions.get(String(sessionId || "").trim()) || null
  }

  function getSession(sessionId) {
    return toPublicSession(getInternalSession(sessionId))
  }

  function listSessions(limit = 50) {
    cleanupExpiredSessions()
    return Array.from(sessions.values())
      .sort((left, right) => Date.parse(right.lastActivityAt || right.updatedAt || 0) - Date.parse(left.lastActivityAt || left.updatedAt || 0))
      .slice(0, Math.max(1, Math.min(Number(limit || 50) || 50, 200)))
      .map((session) => ({
        ...toPublicSession(session),
        eventCount: session.events.length
      }))
  }

  function touchSession(sessionId) {
    const session = getInternalSession(sessionId)
    if (!session) {
      throw buildVoiceError("Sessao realtime nao encontrada", "REALTIME_SESSION_NOT_FOUND", 404)
    }
    session.lastActivityAt = new Date().toISOString()
    session.updatedAt = session.lastActivityAt
    return toPublicSession(session)
  }

  function appendEvent(sessionId, input = {}) {
    const session = getInternalSession(sessionId)
    if (!session) {
      throw buildVoiceError("Sessao realtime nao encontrada", "REALTIME_SESSION_NOT_FOUND", 404)
    }

    const event = {
      id: buildRuntimeId("voiceevt"),
      type: String(input.type || "voice.event"),
      direction: String(input.direction || "system"),
      requestId: input.requestId ? String(input.requestId) : null,
      traceId: input.traceId ? String(input.traceId) : null,
      createdAt: new Date().toISOString(),
      final: Boolean(input.final),
      text: input.text ? String(input.text).trim().slice(0, 2_000) : null,
      payload: sanitizeValue(input.payload || {})
    }

    pushBounded(session.events, event, maxEventsPerSession)
    session.lastActivityAt = event.createdAt
    session.updatedAt = event.createdAt

    for (const subscriber of session.subscribers) {
      try {
        subscriber(event)
      } catch {
        // noop
      }
    }

    logger?.info?.(session.sessionId, "VOICE_EVENT_APPENDED", {
      type: event.type,
      direction: event.direction,
      final: event.final
    })
    return toPublicEvent(event)
  }

  function getEvents(sessionId, limit = 50) {
    const session = getInternalSession(sessionId)
    if (!session) {
      throw buildVoiceError("Sessao realtime nao encontrada", "REALTIME_SESSION_NOT_FOUND", 404)
    }

    return session.events
      .slice(-Math.max(1, Math.min(Number(limit || 50) || 50, maxEventsPerSession)))
      .map((event) => toPublicEvent(event))
  }

  function subscribe(sessionId, listener) {
    const session = getInternalSession(sessionId)
    if (!session) {
      throw buildVoiceError("Sessao realtime nao encontrada", "REALTIME_SESSION_NOT_FOUND", 404)
    }

    session.subscribers.add(listener)
    return () => {
      session.subscribers.delete(listener)
    }
  }

  function closeSession(sessionId, reason = "client_closed") {
    const session = getInternalSession(sessionId)
    if (!session) {
      throw buildVoiceError("Sessao realtime nao encontrada", "REALTIME_SESSION_NOT_FOUND", 404)
    }

    session.status = "closed"
    session.updatedAt = new Date().toISOString()
    session.lastActivityAt = session.updatedAt
    appendEvent(sessionId, {
      type: "session.closed",
      direction: "system",
      final: true,
      payload: {
        reason
      }
    })
    return toPublicSession(session)
  }

  function getSummary() {
    const values = Array.from(sessions.values())
    const totalEvents = values.reduce((sum, session) => sum + session.events.length, 0)

    return {
      activeSessions: values.filter((session) => session.status === "active").length,
      closedSessions: values.filter((session) => session.status === "closed").length,
      totalSessions: values.length,
      totalEvents
    }
  }

  return {
    appendEvent,
    closeSession,
    createSession,
    getEvents,
    getInternalSession,
    getSession,
    getSummary,
    listSessions,
    subscribe,
    touchSession
  }
}
