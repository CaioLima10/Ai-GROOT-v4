import {
  parseRealtimeSessionAudioRequestPayload,
  parseRealtimeSessionCreateRequestPayload,
  parseRealtimeSpeechRequestPayload,
  parseRealtimeTranscriptionRequestPayload,
  parseRealtimeVoiceRespondRequestPayload
} from "../../../packages/shared-config/src/runtimeSchemas.js"

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {}
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : []
}

function buildVoiceRequestId(prefix = "voice") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function isAdminRequest(req) {
  const adminKey = String(process.env.ADMIN_DASH_KEY || "").trim()
  if (!adminKey) {
    return false
  }
  return String(req.get("X-Admin-Key") || "").trim() === adminKey
}

function ensureVoiceSessionAccess(req, session) {
  if (!session) {
    const error = new Error("Sessao realtime nao encontrada")
    error.code = "REALTIME_SESSION_NOT_FOUND"
    error.statusCode = 404
    throw error
  }

  const requesterId = String(req.get("X-User-Id") || req.ip || "anonymous")
  if (session.userId === requesterId || isAdminRequest(req)) {
    return session
  }

  const error = new Error("Voce nao possui acesso a esta sessao realtime")
  error.code = "REALTIME_SESSION_ACCESS_DENIED"
  error.statusCode = 403
  throw error
}

function normalizeSegments(segments) {
  return normalizeArray(segments)
    .map((segment) => normalizeObject(segment))
    .map((segment, index) => ({
      id: String(segment.id || `segment_${index + 1}`),
      text: String(segment.text || "").trim(),
      startMs: Number(segment.startMs || segment.start || 0) || 0,
      endMs: Number(segment.endMs || segment.end || 0) || 0,
      confidence: Number(segment.confidence || 0) || null,
      final: segment.final !== false
    }))
    .filter((segment) => segment.text)
}

function buildSpeechManifest(body = {}) {
  const audio = normalizeObject(body.audio)
  const hasAudio = Boolean(audio.audioBase64 || audio.dataUrl)

  return {
    object: "speech",
    id: buildVoiceRequestId("speech"),
    provider: String(body.provider || "browser-speech-synthesis"),
    model: String(body.model || "browser-tts-local"),
    format: String(body.format || (hasAudio ? "audio_wav_base64" : "browser_speech_manifest")),
    text: String(body.input || body.text || "").trim(),
    voice: String(body.voice || body.outputVoice || "browser-default"),
    language: String(body.language || body.locale || "pt-BR"),
    rate: Math.max(0.6, Math.min(Number(body.rate || 1) || 1, 1.6)),
    pitch: Math.max(0.4, Math.min(Number(body.pitch || 1) || 1, 1.6)),
    autoPlay: body.autoPlay !== false,
    providerMode: String(body.providerMode || (hasAudio ? "server-local" : "browser-assisted")),
    audio: hasAudio ? {
      mimeType: String(audio.mimeType || "audio/wav"),
      format: String(audio.format || "wav"),
      audioBase64: String(audio.audioBase64 || "").trim() || undefined,
      dataUrl: String(audio.dataUrl || "").trim() || undefined,
      audioBytes: Number(audio.audioBytes || 0) || null,
      durationMs: Number(audio.durationMs || 0) || null
    } : null
  }
}

function splitRealtimeResponseText(text = "", maxChunkChars = 120) {
  const normalized = String(text || "").trim()
  if (!normalized) {
    return []
  }

  const sentenceLike = normalized.match(/[^.!?\n]+[.!?\n]?/g) || [normalized]
  const chunks = []
  let buffer = ""

  for (const sentence of sentenceLike) {
    const piece = String(sentence || "").trim()
    if (!piece) continue

    const candidate = buffer ? `${buffer} ${piece}` : piece
    if (candidate.length <= maxChunkChars) {
      buffer = candidate
      continue
    }

    if (buffer) {
      chunks.push(buffer)
      buffer = ""
    }

    if (piece.length <= maxChunkChars) {
      buffer = piece
      continue
    }

    const words = piece.split(/\s+/).filter(Boolean)
    let wordBuffer = ""
    for (const word of words) {
      const wordCandidate = wordBuffer ? `${wordBuffer} ${word}` : word
      if (wordCandidate.length <= maxChunkChars) {
        wordBuffer = wordCandidate
        continue
      }
      if (wordBuffer) {
        chunks.push(wordBuffer)
      }
      wordBuffer = word
    }
    if (wordBuffer) {
      buffer = wordBuffer
    }
  }

  if (buffer) {
    chunks.push(buffer)
  }

  return chunks
}

function buildRealtimeConversationHistory(events = []) {
  return events
    .map((event) => normalizeObject(event))
    .map((event) => {
      const type = String(event.type || "")
      const text = String(event.text || "").trim()
      if (!text) {
        return null
      }

      if (type === "transcription.final" || type === "transcription.appended" || type === "user.message") {
        return {
          role: "user",
          content: text
        }
      }

      if (type === "assistant.completed" || type === "assistant.message") {
        return {
          role: "assistant",
          content: text
        }
      }

      return null
    })
    .filter(Boolean)
    .slice(-10)
}

function emitAssistantResponseEvents(voiceRuntime, sessionId, responseText, requestId, options = {}) {
  const chunks = splitRealtimeResponseText(responseText, Number(options.maxChunkChars || 120) || 120)
  if (!chunks.length) {
    return
  }

  const chunkDelayMs = Math.max(40, Number(options.chunkDelayMs || 120) || 120)
  let assembled = ""

  chunks.forEach((chunk, index) => {
    const isLast = index === chunks.length - 1
    setTimeout(() => {
      try {
        assembled = assembled ? `${assembled} ${chunk}`.trim() : chunk
        voiceRuntime.appendEvent(sessionId, {
          type: isLast ? "assistant.completed" : "assistant.chunk",
          direction: "output",
          final: isLast,
          text: isLast ? responseText : assembled,
          requestId,
          payload: {
            delta: chunk,
            chunkIndex: index,
            chunkCount: chunks.length
          }
        })
      } catch {
        // session may have been closed between scheduling and emission
      }
    }, chunkDelayMs * index)
  })
}

function buildTranscriptionPayload(body = {}) {
  const directTranscript = String(body.transcript || body.text || "").trim()
  const segments = normalizeSegments(body.segments)
  const text = directTranscript || segments.map((segment) => segment.text).join(" ").trim()

  return {
    object: "transcription",
    id: buildVoiceRequestId("transcript"),
    provider: "browser-speech-recognition",
    model: "browser-stt-local",
    text,
    language: String(body.language || body.locale || "pt-BR"),
    durationMs: Number(body.durationMs || 0) || null,
    confidence: Number(body.confidence || 0) || null,
    final: body.final !== false,
    segments,
    source: String(body.source || "browser_microphone")
  }
}

function hasAudioPayload(body = {}) {
  return Boolean(String(body.audioBase64 || "").trim() || String(body.audioDataUrl || body.audio || "").trim())
}

function buildSpeechEventPayload(speech = {}) {
  const audio = normalizeObject(speech.audio)
  const hasAudio = Boolean(audio.audioBase64 || audio.dataUrl)

  return {
    ...speech,
    audio: hasAudio ? {
      mimeType: audio.mimeType || null,
      format: audio.format || null,
      audioBytes: Number(audio.audioBytes || 0) || null,
      durationMs: Number(audio.durationMs || 0) || null
    } : null
  }
}

function isAudioStreamEventType(type = "") {
  return /^(speech\.|transcription\.|assistant\.)/i.test(String(type || ""))
}

function listAudioStreamEvents(voiceRuntime, sessionId, limit = 20) {
  return voiceRuntime
    .getEvents(sessionId, limit)
    .filter((event) => isAudioStreamEventType(event.type))
}

async function runRealtimeTranscription({
  req,
  body,
  requestId,
  traceId,
  sessionId,
  voiceRuntime,
  localVoiceRuntime
}) {
  const shouldUseLocalAudio = hasAudioPayload(body)
  if (shouldUseLocalAudio && !localVoiceRuntime?.transcribe) {
    const error = new Error("Transcricao local server-side nao configurada nesta runtime.")
    error.code = "VOICE_STT_UNAVAILABLE"
    error.statusCode = 503
    throw error
  }

  const payload = shouldUseLocalAudio
    ? await localVoiceRuntime.transcribe({
      ...body,
      requestId,
      traceId,
      sessionId
    })
    : buildTranscriptionPayload(body)

  if (!payload.text) {
    const error = new Error("Informe transcript/text, segments ou audio para normalizar a transcricao.")
    error.code = "TRANSCRIPTION_TEXT_REQUIRED"
    error.statusCode = 400
    throw error
  }

  if (sessionId) {
    ensureVoiceSessionAccess(req, voiceRuntime.getSession(sessionId))
    voiceRuntime.appendEvent(sessionId, {
      type: payload.final ? "transcription.final" : "transcription.partial",
      direction: "input",
      final: payload.final,
      text: payload.text,
      requestId,
      traceId: traceId || null,
      payload
    })
  }

  return {
    success: true,
    ...payload,
    sessionId: sessionId || null
  }
}

async function executeRealtimeVoiceResponse({
  req,
  body,
  session,
  inputText,
  requestId,
  deps
}) {
  const {
    voiceRuntime,
    askGiom,
    buildRuntimeConversationContext,
    traceStore,
    longMemoryRuntime,
    localVoiceRuntime
  } = deps

  const traceContext = traceStore?.getRequestContext?.(req) || {}
  const appendInputEvent = body.appendInputEvent !== false
  const requestContext = body.context ? normalizeObject(body.context) : {}
  const requestConversationHistory = Array.isArray(requestContext.conversationHistory)
    ? requestContext.conversationHistory.filter((item) => item && typeof item === "object")
    : []

  if (appendInputEvent) {
    voiceRuntime.appendEvent(session.sessionId, {
      type: "user.message",
      direction: "input",
      final: true,
      text: inputText,
      requestId,
      traceId: traceContext.traceId || null,
      payload: {
        source: body.source || "realtime.respond"
      }
    })
  }

  const conversationHistory = [
    ...requestConversationHistory,
    ...buildRealtimeConversationHistory(voiceRuntime.getEvents(session.sessionId, 30))
  ].slice(-16)

  const context = await buildRuntimeConversationContext(inputText, {
    ...requestContext,
    channel: requestContext.channel || "voice-realtime",
    locale: body.language || body.locale || session.locale || requestContext.locale || "pt-BR",
    userId: session.userId,
    sessionId: session.sessionId,
    conversationHistory,
    realtimeVoice: {
      ...normalizeObject(requestContext.realtimeVoice),
      sessionId: session.sessionId,
      transport: session.transport,
      voice: session.voice,
      vad: session.vad
    }
  }, {
    userId: session.userId,
    requestId,
    conversationHistory
  })

  const responseText = traceStore
    ? await traceStore.withTrace({
      requestId,
      traceId: traceContext.traceId || null,
      name: "voice.realtime.respond",
      kind: "voice",
      timeoutMs: Math.max(5_000, Number(body.timeoutMs || 90_000) || 90_000),
      metadata: {
        sessionId: session.sessionId,
        transport: session.transport
      }
    }, () => askGiom(inputText, {
      ...context,
      requestId,
      userId: session.userId,
      sessionId: session.sessionId
    }))
    : await askGiom(inputText, {
      ...context,
      requestId,
      userId: session.userId,
      sessionId: session.sessionId
    })

  let localSpeech = null
  if (body.returnAudio !== false && localVoiceRuntime?.hasServerSpeech?.()) {
    localSpeech = await localVoiceRuntime.synthesize({
      text: responseText,
      language: body.language || body.locale || session.locale || "pt-BR",
      voice: body.voice || session.voice?.output || "browser-default",
      rate: body.rate || 1,
      pitch: body.pitch || 1,
      requestId,
      sessionId: session.sessionId
    }).catch(() => null)
  }

  const speech = buildSpeechManifest({
    input: responseText,
    language: body.language || body.locale || session.locale || "pt-BR",
    voice: body.voice || session.voice?.output || "browser-default",
    rate: body.rate || 1,
    pitch: body.pitch || 1,
    autoPlay: body.autoSpeak !== false,
    provider: localSpeech?.provider || "browser-speech-synthesis",
    model: localSpeech?.model || "browser-tts-local",
    format: localSpeech?.format || "browser_speech_manifest",
    providerMode: localSpeech ? "server-local" : "browser-assisted",
    audio: localSpeech ? {
      mimeType: localSpeech.mimeType,
      format: localSpeech.format,
      audioBase64: localSpeech.audioBase64,
      dataUrl: localSpeech.dataUrl,
      audioBytes: localSpeech.audioBytes,
      durationMs: localSpeech.durationMs
    } : null
  })

  voiceRuntime.appendEvent(session.sessionId, {
    type: "assistant.started",
    direction: "output",
    final: false,
    text: null,
    requestId,
    traceId: traceContext.traceId || null,
    payload: {
      inputLength: inputText.length
    }
  })

  emitAssistantResponseEvents(voiceRuntime, session.sessionId, responseText, requestId, {
    chunkDelayMs: body.chunkDelayMs,
    maxChunkChars: body.maxChunkChars
  })

  voiceRuntime.appendEvent(session.sessionId, {
    type: localSpeech ? "speech.generated" : "speech.requested",
    direction: "output",
    final: true,
    text: speech.text,
    requestId,
    traceId: traceContext.traceId || null,
    payload: buildSpeechEventPayload(speech)
  })

  void longMemoryRuntime?.updateFromConversation?.({
    userId: session.userId,
    sessionId: session.sessionId,
    question: inputText,
    responseText,
    conversationHistory,
    metadata: {
      requestId,
      provider: localSpeech ? "voice_realtime_local_audio" : "voice_realtime",
      assistantProfile: context?.assistantProfile || requestContext.assistantProfile || null,
      activeModules: Array.isArray(context?.activeModules) ? context.activeModules : [],
      domainSubmodules: normalizeObject(context?.domainSubmodules),
      bibleStudyModules: Array.isArray(context?.bibleStudyModules) ? context.bibleStudyModules : [],
      promptPacks: Array.isArray(context?.promptPacks) ? context.promptPacks : [],
      locale: body.language || body.locale || session.locale || requestContext.locale || "pt-BR",
      streaming: true,
      askRoute: {
        handler: "voice.realtime.respond",
        routeType: "voice",
        intent: context?.memoryIntent || null
      }
    }
  }).catch(() => { })

  return {
    success: true,
    requestId,
    session,
    response: {
      text: responseText
    },
    speech
  }
}

export function registerEnterpriseVoiceRoutes(app, deps) {
  const {
    askLimiter,
    voiceRuntime,
    writeSSE,
    askGiom,
    buildRuntimeConversationContext,
    traceStore,
    longMemoryRuntime,
    localVoiceRuntime
  } = deps

  app.post("/v1/realtime/sessions", askLimiter, (req, res) => {
    try {
      const body = parseRealtimeSessionCreateRequestPayload(req.body)
      const session = voiceRuntime.createSession({
        userId: req.get("X-User-Id") || req.ip || "anonymous",
        locale: body.locale || body.language || "pt-BR",
        voice: body.voice || body.outputVoice || "browser-default",
        transport: body.transport || "sse",
        metadata: body.metadata || {},
        vad: normalizeObject(body.vad)
      })

      res.status(201).json({
        success: true,
        session,
        endpoints: {
          transcriptions: "/v1/audio/transcriptions",
          speech: "/v1/audio/speech",
          audio: `/v1/realtime/sessions/${session.sessionId}/audio`,
          audioStream: `/v1/realtime/sessions/${session.sessionId}/audio/stream`,
          events: `/v1/realtime/sessions/${session.sessionId}/events`,
          eventsStream: `/v1/realtime/sessions/${session.sessionId}/events/stream`,
          keepalive: `/v1/realtime/sessions/${session.sessionId}/keepalive`,
          providers: "/v1/voice/providers/status"
        }
      })
    } catch (error) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || "Falha ao criar sessao realtime",
        code: error.code || "REALTIME_SESSION_CREATE_FAILED"
      })
    }
  })

  app.get("/v1/voice/providers/status", askLimiter, (_req, res) => {
    const providers = localVoiceRuntime?.getStatus?.() || null

    res.json({
      success: true,
      providers,
      browserAssisted: true,
      fallbackOrder: providers?.fallbackOrder || ["server-local", "browser-assisted", "text-only"]
    })
  })

  app.get("/v1/realtime/sessions/:sessionId", askLimiter, (req, res) => {
    try {
      const session = ensureVoiceSessionAccess(req, voiceRuntime.getSession(req.params.sessionId))
      res.json({
        success: true,
        session,
        events: voiceRuntime.getEvents(req.params.sessionId, Number(req.query.limit || 30) || 30)
      })
    } catch (error) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || "Falha ao consultar sessao realtime",
        code: error.code || "REALTIME_SESSION_STATUS_FAILED"
      })
    }
  })

  app.post("/v1/realtime/sessions/:sessionId/keepalive", askLimiter, (req, res) => {
    try {
      const session = ensureVoiceSessionAccess(req, voiceRuntime.touchSession(req.params.sessionId))
      res.json({
        success: true,
        session
      })
    } catch (error) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || "Falha ao manter sessao realtime ativa",
        code: error.code || "REALTIME_SESSION_KEEPALIVE_FAILED"
      })
    }
  })

  app.post("/v1/realtime/sessions/:sessionId/events", askLimiter, (req, res) => {
    try {
      const session = ensureVoiceSessionAccess(req, voiceRuntime.getSession(req.params.sessionId))
      const body = normalizeObject(req.body)
      const event = voiceRuntime.appendEvent(session.sessionId, {
        type: body.type || "voice.event",
        direction: body.direction || "client",
        final: body.final !== false,
        text: body.text || "",
        requestId: body.requestId || null,
        traceId: body.traceId || null,
        payload: body.payload || {}
      })

      res.status(201).json({
        success: true,
        event
      })
    } catch (error) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || "Falha ao registrar evento realtime",
        code: error.code || "REALTIME_EVENT_APPEND_FAILED"
      })
    }
  })

  app.get("/v1/realtime/sessions/:sessionId/events", askLimiter, (req, res) => {
    try {
      const session = ensureVoiceSessionAccess(req, voiceRuntime.getSession(req.params.sessionId))
      res.json({
        success: true,
        session,
        events: voiceRuntime.getEvents(session.sessionId, Number(req.query.limit || 50) || 50)
      })
    } catch (error) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || "Falha ao consultar eventos realtime",
        code: error.code || "REALTIME_EVENTS_LIST_FAILED"
      })
    }
  })

  app.get("/v1/realtime/sessions/:sessionId/events/stream", askLimiter, (req, res) => {
    let unsubscribe = null
    const heartbeatMs = Math.max(2_500, Number(process.env.VOICE_REALTIME_HEARTBEAT_MS || 10_000))

    try {
      const session = ensureVoiceSessionAccess(req, voiceRuntime.getSession(req.params.sessionId))
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8")
      res.setHeader("Cache-Control", "no-cache, no-transform")
      res.setHeader("Connection", "keep-alive")
      res.setHeader("X-Accel-Buffering", "no")
      res.flushHeaders?.()

      writeSSE(res, "session.meta", {
        session,
        events: voiceRuntime.getEvents(session.sessionId, Number(req.query.limit || 10) || 10)
      })

      const heartbeat = setInterval(() => {
        if (res.writableEnded) return
        writeSSE(res, "ping", {
          ts: Date.now(),
          sessionId: session.sessionId
        })
      }, heartbeatMs)

      unsubscribe = voiceRuntime.subscribe(session.sessionId, (event) => {
        if (res.writableEnded) return
        writeSSE(res, "session.event", event)
      })

      const cleanup = () => {
        clearInterval(heartbeat)
        if (unsubscribe) {
          unsubscribe()
          unsubscribe = null
        }
      }

      res.on("close", cleanup)
      res.on("finish", cleanup)
    } catch (error) {
      if (!res.headersSent) {
        res.status(error.statusCode || 500).json({
          success: false,
          error: error.message || "Falha ao abrir stream realtime",
          code: error.code || "REALTIME_EVENT_STREAM_FAILED"
        })
      }
      if (unsubscribe) {
        unsubscribe()
      }
    }
  })

  app.get("/v1/realtime/sessions/:sessionId/audio/stream", askLimiter, (req, res) => {
    let unsubscribe = null
    const heartbeatMs = Math.max(2_500, Number(process.env.VOICE_REALTIME_HEARTBEAT_MS || 10_000))

    try {
      const session = ensureVoiceSessionAccess(req, voiceRuntime.getSession(req.params.sessionId))
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8")
      res.setHeader("Cache-Control", "no-cache, no-transform")
      res.setHeader("Connection", "keep-alive")
      res.setHeader("X-Accel-Buffering", "no")
      res.flushHeaders?.()

      writeSSE(res, "audio.meta", {
        session,
        events: listAudioStreamEvents(voiceRuntime, session.sessionId, Number(req.query.limit || 12) || 12)
      })

      const heartbeat = setInterval(() => {
        if (res.writableEnded) return
        writeSSE(res, "ping", {
          ts: Date.now(),
          sessionId: session.sessionId
        })
      }, heartbeatMs)

      unsubscribe = voiceRuntime.subscribe(session.sessionId, (event) => {
        if (res.writableEnded || !isAudioStreamEventType(event.type)) {
          return
        }
        writeSSE(res, "audio.event", event)
      })

      const cleanup = () => {
        clearInterval(heartbeat)
        if (unsubscribe) {
          unsubscribe()
          unsubscribe = null
        }
      }

      res.on("close", cleanup)
      res.on("finish", cleanup)
    } catch (error) {
      if (!res.headersSent) {
        res.status(error.statusCode || 500).json({
          success: false,
          error: error.message || "Falha ao abrir audio stream realtime",
          code: error.code || "REALTIME_AUDIO_STREAM_FAILED"
        })
      }
      if (unsubscribe) {
        unsubscribe()
      }
    }
  })

  app.post("/v1/audio/transcriptions", askLimiter, async (req, res) => {
    try {
      const body = parseRealtimeTranscriptionRequestPayload(req.body)
      const sessionId = String(body.sessionId || "").trim()
      const payload = await runRealtimeTranscription({
        req,
        body,
        requestId: body.requestId || buildVoiceRequestId("transcript"),
        traceId: body.traceId || null,
        sessionId,
        voiceRuntime,
        localVoiceRuntime
      })

      res.json(payload)
    } catch (error) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || "Falha ao normalizar transcricao",
        code: error.code || "TRANSCRIPTION_FAILED"
      })
    }
  })

  app.post("/v1/audio/speech", askLimiter, async (req, res) => {
    try {
      const body = parseRealtimeSpeechRequestPayload(req.body)
      let localSpeech = null
      if (body.returnAudio !== false && localVoiceRuntime?.hasServerSpeech?.()) {
        localSpeech = await localVoiceRuntime.synthesize({
          text: body.input || body.text || "",
          language: body.language || body.locale || "pt-BR",
          voice: body.voice || body.outputVoice || "browser-default",
          rate: body.rate || 1,
          pitch: body.pitch || 1,
          requestId: body.requestId || buildVoiceRequestId("speech"),
          sessionId: body.sessionId || null
        }).catch(() => null)
      }

      const manifest = buildSpeechManifest({
        ...body,
        provider: localSpeech?.provider || undefined,
        model: localSpeech?.model || undefined,
        format: localSpeech?.format || undefined,
        providerMode: localSpeech ? "server-local" : "browser-assisted",
        audio: localSpeech ? {
          mimeType: localSpeech.mimeType,
          format: localSpeech.format,
          audioBase64: localSpeech.audioBase64,
          dataUrl: localSpeech.dataUrl,
          audioBytes: localSpeech.audioBytes,
          durationMs: localSpeech.durationMs
        } : null
      })

      if (!manifest.text) {
        return res.status(400).json({
          success: false,
          error: "Informe input/text para gerar o speech manifest.",
          code: "SPEECH_TEXT_REQUIRED"
        })
      }

      const sessionId = String(body.sessionId || "").trim()
      if (sessionId) {
        ensureVoiceSessionAccess(req, voiceRuntime.getSession(sessionId))
        voiceRuntime.appendEvent(sessionId, {
          type: localSpeech ? "speech.generated" : "speech.requested",
          direction: "output",
          final: true,
          text: manifest.text,
          requestId: body.requestId || null,
          traceId: body.traceId || null,
          payload: buildSpeechEventPayload(manifest)
        })
      }

      res.json({
        success: true,
        speech: manifest,
        audio: manifest.audio || null,
        sessionId: sessionId || null
      })
    } catch (error) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || "Falha ao preparar speech manifest",
        code: error.code || "SPEECH_MANIFEST_FAILED"
      })
    }
  })

  app.post("/v1/realtime/sessions/:sessionId/audio", askLimiter, async (req, res) => {
    const requestId = buildVoiceRequestId("vaudio")

    try {
      const session = ensureVoiceSessionAccess(req, voiceRuntime.getSession(req.params.sessionId))
      const body = parseRealtimeSessionAudioRequestPayload(req.body)
      const transcription = await runRealtimeTranscription({
        req,
        body: {
          ...body,
          sessionId: session.sessionId,
          final: true,
          source: body.source || "realtime_audio_upload"
        },
        requestId,
        traceId: traceStore?.getRequestContext?.(req)?.traceId || null,
        sessionId: session.sessionId,
        voiceRuntime,
        localVoiceRuntime
      })

      if (body.autoRespond === false) {
        return res.json({
          success: true,
          requestId,
          session,
          transcription,
          response: null,
          speech: null
        })
      }

      const responsePayload = await executeRealtimeVoiceResponse({
        req,
        body: {
          ...body,
          source: "realtime.audio"
        },
        session,
        inputText: String(transcription.text || "").trim(),
        requestId,
        deps: {
          voiceRuntime,
          askGiom,
          buildRuntimeConversationContext,
          traceStore,
          longMemoryRuntime,
          localVoiceRuntime
        }
      })

      res.json({
        ...responsePayload,
        transcription
      })
    } catch (error) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || "Falha ao processar audio da sessao realtime",
        code: error.code || "REALTIME_AUDIO_FAILED",
        requestId
      })
    }
  })

  app.post("/v1/realtime/sessions/:sessionId/respond", askLimiter, async (req, res) => {
    const requestId = buildVoiceRequestId("vresp")

    try {
      const session = ensureVoiceSessionAccess(req, voiceRuntime.getSession(req.params.sessionId))
      const body = parseRealtimeVoiceRespondRequestPayload(req.body)
      const inputText = String(body.input || body.text || body.transcript || "").trim()
      if (!inputText) {
        return res.status(400).json({
          success: false,
          error: "Informe input/text para responder pela sessao realtime.",
          code: "REALTIME_INPUT_REQUIRED",
          requestId
        })
      }

      const payload = await executeRealtimeVoiceResponse({
        req,
        body,
        session,
        inputText,
        requestId,
        deps: {
          voiceRuntime,
          askGiom,
          buildRuntimeConversationContext,
          traceStore,
          longMemoryRuntime,
          localVoiceRuntime
        }
      })

      res.json(payload)
    } catch (error) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || "Falha ao responder na sessao realtime",
        code: error.code || "REALTIME_RESPONSE_FAILED",
        requestId
      })
    }
  })
}
