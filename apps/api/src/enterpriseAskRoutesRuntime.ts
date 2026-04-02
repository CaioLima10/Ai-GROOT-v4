import type { Express, RequestHandler, Response } from "express"

type RecordLike = Record<string, any>

type RequestEnvelope = {
  userId: string
  requestId?: string
  sessionId?: string | null
} & RecordLike

type PreparedAskContext = {
  assistantProfile?: string | null
  activeModules?: unknown[]
  domainSubmodules?: RecordLike
  bibleStudyModules?: unknown[]
  promptPacks?: unknown[]
  agroWeather?: unknown
  ragSources?: unknown[]
  memoryContext?: unknown
  uploadName?: string | null
  uploadType?: string | null
} & RecordLike

type PreparedAskPayload = {
  normalizedQuestion: string
  preparedQuestion: string
  context: PreparedAskContext
  flags?: RecordLike
  enrichedData: {
    request: RequestEnvelope
  } & RecordLike
}

type AskDecision = {
  handlerName: string
  intent?: unknown
  routeType?: unknown
  requiresStreaming?: boolean
  decisionMs?: number
} & RecordLike

type RuntimeContextResult = {
  preparedPayload: PreparedAskPayload
  diagnostics: RecordLike
}

type PromptPackage = {
  systemPrompt?: string
  profileId?: string | null
  requestedProfileId?: string | null
  activeModules?: unknown[]
  domainSubmodules?: RecordLike
  bibleStudyModules?: unknown[]
  promptPacks?: unknown[]
} & RecordLike

type ShadowPlan = {
  error?: unknown
  strategy?: string
  intent?: {
    category?: string
  } & RecordLike
  finalPrompt?: string
} & RecordLike

type AskExecutionResult = {
  responseText: string
  evaluation?: unknown
  selfHealing?: unknown
  learning?: unknown
  handler?: unknown
  intent?: unknown
  routeType?: unknown
  trace: unknown[]
  ragSources?: unknown[]
} & RecordLike

type LearningResult = {
  shouldPersistMemory?: boolean
  memoryBoost?: number
  markedForRetraining?: boolean
  score?: number | null
} & RecordLike

type SelfHealingResult = {
  healed?: boolean
  issues?: unknown[]
  finalAnswer?: unknown
} & RecordLike

type AskProviderContext = {
  finalPrompt: string
  contextEnhancements?: PreparedAskContext & {
    promptPackage?: PromptPackage
  }
}

type StreamingGatewayPayload = {
  fullText?: unknown
  provider?: unknown
  error?: unknown
} & RecordLike

type RuntimeErrorLike = {
  message?: string
  stack?: string
  code?: string
  statusCode?: number
  response?: {
    status?: number
  }
} & RecordLike

type LoggerLike = {
  info: (requestId: string, event: string, payload: RecordLike) => void
  warn: (requestId: string, event: string, payload: RecordLike) => void
  error: (requestId: string, event: string, payload: RecordLike) => void
}

type MetricsLike = {
  recordResponseEvaluation: (requestId: string, evaluation: unknown, selfHealing: unknown) => void
  recordRequest: (requestId: string, durationMs: number, success: boolean) => void
  recordUserActivity: (userId: string, activity: string, payload: RecordLike) => void
  recordError: (eventName: string, error: unknown, payload: RecordLike) => void
}

type AiGatewayLike = {
  logger: LoggerLike
  metrics: MetricsLike
}

type MemoryContextMetricsLike = {
  record: (payload: {
    route: string
    requestId: string
    sessionId: string
    payloadId: string
    handlerId: string
    diagnostics: RecordLike
  }) => void
}

type AskGiomServiceLike = {
  (preparedPayload: PreparedAskPayload, options?: RecordLike): Promise<AskExecutionResult>
  decide: (preparedPayload: PreparedAskPayload, options: { mode: string }) => AskDecision
  execute: (preparedPayload: PreparedAskPayload, decision: AskDecision) => Promise<AskExecutionResult>
}

type StreamingGatewayLike = {
  askStreaming: (
    prompt: string,
    options: RecordLike,
    onChunk: (payload: unknown) => void,
    onComplete: (payload: StreamingGatewayPayload) => Promise<void>,
    onError: (payload: StreamingGatewayPayload) => Promise<void>
  ) => Promise<void>
}

type EnterpriseAskRouteDeps = {
  askLimiter: RequestHandler
  askSlowDown: RequestHandler
  getAskContextDiagnostics: (context: unknown) => unknown
  askGiomService: AskGiomServiceLike
  aiGateway: AiGatewayLike
  memoryContextMetrics: MemoryContextMetricsLike
  shouldUseFastDirectAnswer: (question: string, context: PreparedAskContext) => boolean
  buildFastDirectPromptPackage: (context: PreparedAskContext) => PromptPackage
  buildStreamingPromptPackage: (question: string, context: PreparedAskContext) => Promise<PromptPackage>
  buildShadowOrchestratorPlan: (question: string, context: PreparedAskContext) => Promise<ShadowPlan | null>
  buildOrchestratorShadowEnvelope: (plan: ShadowPlan | null, fastDirect: boolean) => unknown
  shouldPersistLearnedConversation: (payload: unknown) => boolean
  saveConversationNonBlocking: (
    userId: string,
    question: string,
    response: string,
    metadata: RecordLike,
    requestId: string
  ) => void
  appendConversationToStm: (
    userId: string,
    sessionId: string | null,
    question: string,
    response: string
  ) => void
  runtimeBuildWeatherClientMetadata: (agroWeather: unknown) => unknown
  buildLanguageRuntimeMetadata: (context: PreparedAskContext) => unknown
  buildOperationalContingencyResponse: (question: string, context: PreparedAskContext, errorMessage: string) => string
  writeSSE: (res: Response, event: string, payload: unknown) => void
  buildAskProviderContext: (question: string, context: PreparedAskContext) => Promise<AskProviderContext>
  buildFastDirectAiOptions: (context: PreparedAskContext) => RecordLike
  streamingGateway: StreamingGatewayLike
  postProcessAssistantResponse: (question: string, responseText: string, context: PreparedAskContext) => string
  evaluateResponse: (input: {
    question: string
    answer: string
    context: PreparedAskContext
    memoryContext: unknown
    intent: unknown
    handler: unknown
    latencyMs: number
  }) => Promise<unknown>
  selfHealResponse: (input: {
    evaluation: unknown
    question: string
    answer: string
    aiProvider: {
      ask: (repairQuestion: string, repairContext?: RecordLike) => Promise<string>
    }
    normalizeAnswer: (answer: unknown) => string
    threshold: number
    timeoutMs: number
  }) => Promise<SelfHealingResult>
  askGroot: (message: string, context: RecordLike) => Promise<string>
  normalizeAnswerText: (answer: unknown) => string
  processEvaluation: (
    evaluation: unknown,
    requestMeta: RecordLike,
    resultMeta: RecordLike
  ) => Promise<LearningResult>
  buildPreparedAskPayloadFromHttp: (input: {
    req: unknown
    requestId: string
    uploads: unknown
    resolveUploadExtraction: (uploadRef: unknown) => Promise<unknown>
    buildUploadExtractionBlock: (input: unknown) => unknown
  }) => Promise<PreparedAskPayload>
  uploads: unknown
  resolveUploadExtraction: (uploadRef: unknown) => Promise<unknown>
  buildUploadExtractionBlock: (input: unknown) => unknown
  buildRuntimeContext: (input: {
    preparedPayload: PreparedAskPayload
    decisionResult: AskDecision
    ports: {
      stm: unknown
      retrieval: unknown
      runtimeContext: {
        enrich: unknown
      }
    }
    limits: {
      maxConversationTurns: number
      maxMemorySummaryChars: number
      maxContextTokens: number
    }
  }) => Promise<RuntimeContextResult>
  runtimeSessionMemoryStore: unknown
  retrievalPort: unknown
  buildRuntimeConversationContext: unknown
}

function buildMemoryContextLimits() {
  return {
    maxConversationTurns: Number(process.env.MEMORY_CONTEXT_MAX_TURNS || 10),
    maxMemorySummaryChars: Number(process.env.MEMORY_CONTEXT_SUMMARY_MAX_CHARS || 450),
    maxContextTokens: Number(process.env.MEMORY_CONTEXT_MAX_TOKENS || 1800)
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function getErrorStack(error: unknown) {
  return error instanceof Error ? error.stack : undefined
}

function getErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as RuntimeErrorLike).code || "")
    : ""
}

function getErrorStatusCode(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return 0
  }

  const runtimeError = error as RuntimeErrorLike
  return Number(runtimeError.statusCode || runtimeError.response?.status || 0)
}

async function prepareAskRuntime({
  req,
  requestId,
  mode,
  route,
  deps
}: {
  req: unknown
  requestId: string
  mode: string
  route: string
  deps: EnterpriseAskRouteDeps
}) {
  const {
    buildPreparedAskPayloadFromHttp,
    uploads,
    resolveUploadExtraction,
    buildUploadExtractionBlock,
    askGiomService,
    buildRuntimeContext,
    runtimeSessionMemoryStore,
    retrievalPort,
    buildRuntimeConversationContext,
    aiGateway,
    memoryContextMetrics
  } = deps

  const preparedSeedPayload = await buildPreparedAskPayloadFromHttp({
    req,
    requestId,
    uploads,
    resolveUploadExtraction,
    buildUploadExtractionBlock
  })

  const decision = askGiomService.decide(preparedSeedPayload, { mode })

  const runtimeContextResult = await buildRuntimeContext({
    preparedPayload: preparedSeedPayload,
    decisionResult: decision,
    ports: {
      stm: runtimeSessionMemoryStore,
      retrieval: retrievalPort,
      runtimeContext: {
        enrich: buildRuntimeConversationContext
      }
    },
    limits: buildMemoryContextLimits()
  })

  aiGateway.logger.info(requestId, "MEMORY_CONTEXT_BUILT", {
    route,
    memoryContext: runtimeContextResult.diagnostics
  })

  memoryContextMetrics.record({
    route,
    requestId,
    sessionId: preparedSeedPayload?.enrichedData?.request?.sessionId || "",
    payloadId: preparedSeedPayload?.enrichedData?.request?.requestId || requestId,
    handlerId: decision?.handlerName || "",
    diagnostics: runtimeContextResult.diagnostics
  })

  return {
    decision,
    runtimeContextResult
  }
}

export function registerEnterpriseAskRoutes(app: Express, deps: EnterpriseAskRouteDeps) {
  const {
    askLimiter,
    askSlowDown,
    getAskContextDiagnostics,
    askGiomService,
    aiGateway,
    shouldUseFastDirectAnswer,
    buildFastDirectPromptPackage,
    buildStreamingPromptPackage,
    buildShadowOrchestratorPlan,
    buildOrchestratorShadowEnvelope,
    shouldPersistLearnedConversation,
    saveConversationNonBlocking,
    appendConversationToStm,
    runtimeBuildWeatherClientMetadata,
    buildLanguageRuntimeMetadata,
    buildOperationalContingencyResponse,
    writeSSE,
    buildAskProviderContext,
    buildFastDirectAiOptions,
    streamingGateway,
    postProcessAssistantResponse,
    evaluateResponse,
    selfHealResponse,
    askGroot,
    normalizeAnswerText,
    processEvaluation
  } = deps

  app.post("/ask", askLimiter, askSlowDown, async (req, res) => {
    const requestId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const startTime = Date.now()
    let preparedQuestion = ""
    let preparedContext: PreparedAskContext = {}

    const requestBodyShape = (() => {
      const body = req.body || {}
      const hasMessagesArray = Array.isArray(body.messages)
      const firstMessage = hasMessagesArray ? body.messages[0] : null
      return {
        hasQuestion: typeof body.question === "string" && !!body.question.trim(),
        hasMessage: typeof body.message === "string" && !!body.message.trim(),
        hasPrompt: typeof body.prompt === "string" && !!body.prompt.trim(),
        hasMessagesArray,
        firstMessageKeys: firstMessage && typeof firstMessage === "object" ? Object.keys(firstMessage).slice(0, 6) : [],
        hasInput: Boolean(body.input),
        hasContentsArray: Array.isArray(body.contents),
        hasContextObject: !!(body.context && typeof body.context === "object" && !Array.isArray(body.context))
      }
    })()

    const contextDiagnostics = getAskContextDiagnostics(req.body?.context)

    try {
      const {
        decision,
        runtimeContextResult
      } = await prepareAskRuntime({
        req,
        requestId,
        mode: "standard",
        route: "ask",
        deps
      })

      const preparedPayload = runtimeContextResult.preparedPayload
      const {
        normalizedQuestion,
        preparedQuestion: finalQuestion,
        context: enhancedContext,
        enrichedData
      } = preparedPayload
      const question = normalizedQuestion
      const userId = enrichedData.request.userId
      preparedQuestion = finalQuestion
      preparedContext = enhancedContext
      const useFastDirectRequest = decision.handlerName === "fallbackAIHandler"
        && shouldUseFastDirectAnswer(question, enhancedContext)
      const requestFastPath = useFastDirectRequest
        ? {
          enabled: true,
          strategy: "direct_provider"
        }
        : {
          enabled: false
        }

      const promptPackagePromise = useFastDirectRequest
        ? Promise.resolve(buildFastDirectPromptPackage(enhancedContext))
        : buildStreamingPromptPackage(finalQuestion, enhancedContext)
      const shadowPlanPromise = useFastDirectRequest
        ? Promise.resolve(null)
        : buildShadowOrchestratorPlan(finalQuestion, enhancedContext)

      aiGateway.logger.info(requestId, "REQUEST_STARTED", {
        questionLength: question.length,
        context: Object.keys(enhancedContext),
        contextDiagnostics,
        requestBodyShape,
        decision,
        fastPath: requestFastPath,
        memoryContext: runtimeContextResult.diagnostics,
        orchestratorShadow: buildOrchestratorShadowEnvelope(null, useFastDirectRequest)
      })

      const giomResult = await askGiomService.execute(preparedPayload, decision)
      const responseText = giomResult.responseText
      aiGateway.metrics.recordResponseEvaluation(requestId, giomResult.evaluation, giomResult.selfHealing)

      const [promptPackage, shadowPlan] = await Promise.all([
        promptPackagePromise,
        shadowPlanPromise
      ])

      if (!responseText) {
        throw new Error("Resposta vazia da IA")
      }

      aiGateway.logger.info(requestId, "REQUEST_COMPLETED", {
        responseLength: responseText.length,
        handler: giomResult.handler,
        intent: giomResult.intent,
        routeType: giomResult.routeType
      })

      if (shouldPersistLearnedConversation(giomResult)) {
        saveConversationNonBlocking(userId, question, responseText, {
          provider: "standard_gateway",
          requestId,
          sessionId: enrichedData.request.sessionId || null,
          assistantProfile: promptPackage.profileId || enhancedContext.assistantProfile || null,
          activeModules: promptPackage.activeModules || enhancedContext.activeModules || [],
          domainSubmodules: promptPackage.domainSubmodules || enhancedContext.domainSubmodules || {},
          bibleStudyModules: promptPackage.bibleStudyModules || enhancedContext.bibleStudyModules || [],
          promptPacks: promptPackage.promptPacks || enhancedContext.promptPacks || [],
          evaluation: giomResult.evaluation || null,
          selfHealing: giomResult.selfHealing || null,
          learning: giomResult.learning || null,
          askRoute: {
            handler: giomResult.handler,
            intent: giomResult.intent,
            routeType: giomResult.routeType
          },
          orchestratorShadow: shadowPlan && !shadowPlan.error
            ? {
              strategy: shadowPlan.strategy,
              intentCategory: shadowPlan.intent?.category || "unknown",
              finalPromptLength: String(shadowPlan.finalPrompt || "").length
            }
            : null,
          uploadName: enhancedContext.uploadName || null,
          uploadType: enhancedContext.uploadType || null,
          fastPath: requestFastPath.enabled ? requestFastPath : null
        }, requestId)
      }

      aiGateway.metrics.recordRequest(requestId, Date.now() - startTime, true)
      aiGateway.metrics.recordUserActivity(userId, "ask", {
        length: question.length
      })
      if (shouldPersistLearnedConversation(giomResult)) {
        appendConversationToStm(userId, enrichedData.request.sessionId || null, question, responseText)
      }

      res.json({
        success: true,
        data: {
          response: responseText
        },
        response: responseText,
        answer: responseText,
        requestId,
        metadata: {
          processingTime: Date.now() - startTime,
          version: "2.0.0",
          assistantProfile: promptPackage.profileId,
          requestedAssistantProfile: promptPackage.requestedProfileId || enhancedContext.assistantProfile || null,
          activeModules: promptPackage.activeModules,
          domainSubmodules: promptPackage.domainSubmodules || {},
          bibleStudyModules: promptPackage.bibleStudyModules || [],
          askRoute: {
            handler: giomResult.handler,
            intent: giomResult.intent,
            routeType: giomResult.routeType,
            traceLength: giomResult.trace.length
          },
          orchestratorShadow: buildOrchestratorShadowEnvelope(shadowPlan, useFastDirectRequest),
          fastPath: requestFastPath,
          weatherUsed: runtimeBuildWeatherClientMetadata(enhancedContext.agroWeather),
          languageUsed: buildLanguageRuntimeMetadata(enhancedContext),
          memoryContext: runtimeContextResult.diagnostics,
          evaluation: giomResult.evaluation || null,
          selfHealing: giomResult.selfHealing || null,
          learning: giomResult.learning || null
        }
      })
    } catch (error) {
      aiGateway.logger.error(requestId, "REQUEST_FAILED", {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        requestBodyShape
      })

      aiGateway.metrics.recordRequest(requestId, Date.now() - startTime, false)
      aiGateway.metrics.recordError("ask_error", error, { requestId })

      const statusCode = getErrorStatusCode(error) || 500
      const errorCode = getErrorCode(error) || "INTERNAL_ERROR"

      if (statusCode >= 500) {
        const fallbackResponse = buildOperationalContingencyResponse(
          preparedQuestion || req.body?.question || "",
          preparedContext,
          getErrorMessage(error)
        )

        return res.status(200).json({
          success: true,
          data: {
            response: fallbackResponse
          },
          response: fallbackResponse,
          answer: fallbackResponse,
          requestId,
          metadata: {
            processingTime: Date.now() - startTime,
            version: "2.0.0",
            fallback: true,
            fallbackReason: errorCode
          }
        })
      }

      res.status(statusCode).json({
        error: "Erro ao processar sua pergunta",
        details: process.env.NODE_ENV === "development" ? getErrorMessage(error) : undefined,
        code: errorCode,
        requestId
      })
    }
  })

  app.post("/ask/stream", askLimiter, askSlowDown, async (req, res) => {
    const requestId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const startTime = Date.now()
    let hasCompleted = false
    const sseHeartbeatMs = Math.max(2_500, Number(process.env.SSE_HEARTBEAT_MS || 10_000))

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8")
    res.setHeader("Cache-Control", "no-cache, no-transform")
    res.setHeader("Connection", "keep-alive")
    res.setHeader("X-Accel-Buffering", "no")
    res.flushHeaders?.()

    const heartbeat = setInterval(() => {
      if (hasCompleted || res.writableEnded) return
      writeSSE(res, "ping", {
        ts: Date.now()
      })
    }, sseHeartbeatMs)

    const clearHeartbeat = () => clearInterval(heartbeat)
    res.on("close", clearHeartbeat)
    res.on("finish", clearHeartbeat)

    try {
      const {
        decision: streamDecision,
        runtimeContextResult
      } = await prepareAskRuntime({
        req,
        requestId,
        mode: "stream",
        route: "ask_stream",
        deps
      })

      const preparedPayload = runtimeContextResult.preparedPayload
      const {
        normalizedQuestion: question,
        preparedQuestion: finalQuestion,
        context: enhancedContext,
        enrichedData
      } = preparedPayload
      const userId = enrichedData.request.userId
      const useFastDirectStream = streamDecision.handlerName === "fallbackAIHandler"
        && shouldUseFastDirectAnswer(question, enhancedContext)
      const streamFastPath = useFastDirectStream
        ? {
          enabled: true,
          strategy: "direct_provider"
        }
        : {
          enabled: false
        }

      aiGateway.logger.info(requestId, "STREAM_REQUEST_DECISION", {
        intent: streamDecision.intent,
        handlerName: streamDecision.handlerName,
        routeType: streamDecision.routeType,
        requiresStreaming: streamDecision.requiresStreaming,
        decisionMs: streamDecision.decisionMs,
        fastPath: streamFastPath,
        memoryContext: runtimeContextResult.diagnostics
      })

      if (!streamDecision.requiresStreaming) {
        const deterministicResult = await askGiomService.execute(
          {
            normalizedQuestion: question,
            preparedQuestion: finalQuestion,
            context: enhancedContext,
            flags: preparedPayload.flags,
            enrichedData
          },
          streamDecision
        )

        aiGateway.metrics.recordResponseEvaluation(requestId, deterministicResult.evaluation, deterministicResult.selfHealing)

        if (shouldPersistLearnedConversation(deterministicResult)) {
          saveConversationNonBlocking(userId, question, deterministicResult.responseText, {
            provider: "decision_router_direct",
            requestId,
            assistantProfile: enhancedContext.assistantProfile || null,
            activeModules: enhancedContext.activeModules || [],
            domainSubmodules: enhancedContext.domainSubmodules || {},
            bibleStudyModules: enhancedContext.bibleStudyModules || [],
            promptPacks: enhancedContext.promptPacks || [],
            evaluation: deterministicResult.evaluation || null,
            selfHealing: deterministicResult.selfHealing || null,
            learning: deterministicResult.learning || null,
            streaming: true,
            askRoute: {
              handler: deterministicResult.handler,
              intent: deterministicResult.intent,
              routeType: deterministicResult.routeType
            }
          }, requestId)
        }

        aiGateway.metrics.recordRequest(requestId, Date.now() - startTime, true)
        aiGateway.metrics.recordUserActivity(userId, "ask_stream", {
          length: question.length,
          routeType: deterministicResult.routeType,
          intent: deterministicResult.intent
        })
        if (shouldPersistLearnedConversation(deterministicResult)) {
          appendConversationToStm(userId, enrichedData.request.sessionId || null, question, deterministicResult.responseText)
        }

        writeSSE(res, "meta", {
          requestId,
          providerMode: process.env.GROOT_AI_PROVIDER || "auto",
          assistantProfile: enhancedContext.assistantProfile || null,
          requestedAssistantProfile: enhancedContext.assistantProfile || null,
          activeModules: enhancedContext.activeModules || [],
          domainSubmodules: enhancedContext.domainSubmodules || {},
          bibleStudyModules: enhancedContext.bibleStudyModules || [],
          askRoute: {
            handler: deterministicResult.handler,
            intent: deterministicResult.intent,
            routeType: deterministicResult.routeType,
            traceLength: deterministicResult.trace.length
          },
          weatherUsed: runtimeBuildWeatherClientMetadata(enhancedContext.agroWeather),
          languageUsed: buildLanguageRuntimeMetadata(enhancedContext)
        })

        writeSSE(res, "complete", {
          requestId,
          response: deterministicResult.responseText,
          metadata: {
            processingTime: Date.now() - startTime,
            provider: "decision_router_direct",
            assistantProfile: enhancedContext.assistantProfile || null,
            requestedAssistantProfile: enhancedContext.assistantProfile || null,
            activeModules: enhancedContext.activeModules || [],
            domainSubmodules: enhancedContext.domainSubmodules || {},
            bibleStudyModules: enhancedContext.bibleStudyModules || [],
            askRoute: {
              handler: deterministicResult.handler,
              intent: deterministicResult.intent,
              routeType: deterministicResult.routeType
            },
            weatherUsed: runtimeBuildWeatherClientMetadata(enhancedContext.agroWeather),
            languageUsed: buildLanguageRuntimeMetadata(enhancedContext),
            memoryContext: runtimeContextResult.diagnostics,
            evaluation: deterministicResult.evaluation || null,
            selfHealing: deterministicResult.selfHealing || null,
            learning: deterministicResult.learning || null
          }
        })
        clearHeartbeat()
        res.end()
        return
      }

      let streamProviderPrompt = finalQuestion
      let streamEnhancedContext = enhancedContext
      let promptPackage = buildFastDirectPromptPackage(enhancedContext)
      let shadowPlan: ShadowPlan | null = null
      let streamingOptions: RecordLike = {
        systemPrompt: promptPackage.systemPrompt
      }

      if (useFastDirectStream) {
        streamProviderPrompt = question
        streamEnhancedContext = {
          ...enhancedContext,
          fastPath: streamFastPath
        }
        promptPackage = buildFastDirectPromptPackage(enhancedContext)
        streamingOptions = buildFastDirectAiOptions(enhancedContext)
      } else {
        const streamProviderContext = await buildAskProviderContext(finalQuestion, enhancedContext)
        streamProviderPrompt = streamProviderContext.finalPrompt
        streamEnhancedContext = {
          ...enhancedContext,
          ...streamProviderContext.contextEnhancements
        }
        promptPackage = streamProviderContext.contextEnhancements?.promptPackage
          || await buildStreamingPromptPackage(finalQuestion, enhancedContext)
        shadowPlan = await buildShadowOrchestratorPlan(finalQuestion, enhancedContext)
        streamingOptions = {
          systemPrompt: promptPackage.systemPrompt
        }
      }

      aiGateway.logger.info(requestId, "STREAM_REQUEST_STARTED", {
        questionLength: question.length,
        context: Object.keys(enhancedContext),
        fastPath: streamFastPath
      })

      writeSSE(res, "meta", {
        requestId,
        providerMode: process.env.GROOT_AI_PROVIDER || "auto",
        assistantProfile: promptPackage.profileId,
        requestedAssistantProfile: promptPackage.requestedProfileId || enhancedContext.assistantProfile || null,
        activeModules: promptPackage.activeModules,
        domainSubmodules: promptPackage.domainSubmodules || {},
        bibleStudyModules: promptPackage.bibleStudyModules || [],
        askRoute: {
          handler: streamDecision.handlerName,
          intent: streamDecision.intent,
          routeType: streamDecision.routeType,
          decisionMs: streamDecision.decisionMs
        },
        orchestratorShadow: buildOrchestratorShadowEnvelope(shadowPlan, useFastDirectStream),
        fastPath: streamFastPath,
        weatherUsed: runtimeBuildWeatherClientMetadata(enhancedContext.agroWeather),
        languageUsed: buildLanguageRuntimeMetadata(enhancedContext),
        ragSources: streamEnhancedContext.ragSources || []
      })

      await streamingGateway.askStreaming(
        streamProviderPrompt,
        streamingOptions,
        (payload) => {
          writeSSE(res, "chunk", payload)
        },
        async (payload) => {
          hasCompleted = true
          const providerResponseText = postProcessAssistantResponse(question, String(payload?.fullText || "").trim(), streamEnhancedContext)
          let responseText = providerResponseText

          if (!responseText) {
            writeSSE(res, "complete", {
              requestId,
              response: buildOperationalContingencyResponse(question, streamEnhancedContext, "resposta vazia da IA"),
              metadata: {
                processingTime: Date.now() - startTime,
                provider: payload?.provider || "streaming_gateway",
                fallback: true
              }
            })
            clearHeartbeat()
            res.end()
            return
          }

          let evaluation: unknown = null
          let selfHealing: { applied: boolean; issues: unknown[] } = { applied: false, issues: [] }
          let learning: LearningResult = {
            shouldPersistMemory: true,
            memoryBoost: 1,
            markedForRetraining: false,
            score: null
          }

          const streamEvalEnabled = String(process.env.GIOM_EVAL_ENABLED || "true").toLowerCase() !== "false"
          const streamSelfHealEnabled = String(process.env.GIOM_SELF_HEAL_ENABLED || "true").toLowerCase() !== "false"
          const streamSelfHealThreshold = Number(process.env.GIOM_SELF_HEAL_THRESHOLD || 0.6)
          const streamSelfHealTimeoutMs = Number(process.env.GIOM_SELF_HEAL_TIMEOUT_MS || 3500)

          if (streamEvalEnabled && responseText) {
            try {
              evaluation = await evaluateResponse({
                question,
                answer: responseText,
                context: streamEnhancedContext,
                memoryContext: streamEnhancedContext?.memoryContext || null,
                intent: streamDecision.intent,
                handler: streamDecision.handlerName,
                latencyMs: Date.now() - startTime
              })

              if (streamSelfHealEnabled) {
                const healed = await selfHealResponse({
                  evaluation,
                  question,
                  answer: responseText,
                  aiProvider: {
                    ask: (repairQuestion, repairContext) => askGroot(repairQuestion, {
                      ...streamEnhancedContext,
                      ...(repairContext || {})
                    })
                  },
                  normalizeAnswer: normalizeAnswerText,
                  threshold: streamSelfHealThreshold,
                  timeoutMs: streamSelfHealTimeoutMs
                })

                selfHealing = {
                  applied: Boolean(healed?.healed),
                  issues: healed?.issues || []
                }

                if (healed?.healed && healed?.finalAnswer) {
                  responseText = postProcessAssistantResponse(question, String(healed.finalAnswer), streamEnhancedContext)
                  evaluation = await evaluateResponse({
                    question,
                    answer: responseText,
                    context: streamEnhancedContext,
                    memoryContext: streamEnhancedContext?.memoryContext || null,
                    intent: streamDecision.intent,
                    handler: streamDecision.handlerName,
                    latencyMs: Date.now() - startTime
                  })
                }
              }

              learning = await processEvaluation(
                evaluation,
                {
                  question,
                  normalizedQuestion: finalQuestion,
                  requestId,
                  intent: streamDecision.intent,
                  handler: streamDecision.handlerName
                },
                {
                  responseText,
                  handler: streamDecision.handlerName,
                  intent: streamDecision.intent,
                  routeType: streamDecision.routeType
                }
              )
            } catch (evaluationError) {
              aiGateway.logger.warn(requestId, "STREAM_EVALUATION_FAILED", {
                error: getErrorMessage(evaluationError) || "stream_evaluation_failed"
              })
            }
          }

          aiGateway.metrics.recordResponseEvaluation(requestId, evaluation, selfHealing)

          const streamLearningEnvelope = { learning }
          if (shouldPersistLearnedConversation(streamLearningEnvelope)) {
            saveConversationNonBlocking(userId, question, responseText, {
              provider: payload?.provider || "streaming_gateway",
              requestId,
              assistantProfile: promptPackage.profileId,
              activeModules: promptPackage.activeModules,
              domainSubmodules: promptPackage.domainSubmodules || {},
              bibleStudyModules: promptPackage.bibleStudyModules,
              promptPacks: promptPackage.promptPacks,
              evaluation: evaluation || null,
              selfHealing: selfHealing || null,
              learning: learning || null,
              orchestratorShadow: shadowPlan && !shadowPlan.error
                ? {
                  strategy: shadowPlan.strategy,
                  intentCategory: shadowPlan.intent?.category || "unknown",
                  finalPromptLength: String(shadowPlan.finalPrompt || "").length
                }
                : null,
              streaming: true,
              fastPath: streamFastPath.enabled ? streamFastPath : null
            }, requestId)
          }

          aiGateway.metrics.recordRequest(requestId, Date.now() - startTime, true)
          aiGateway.metrics.recordUserActivity(userId, "ask_stream", {
            length: question.length
          })
          if (shouldPersistLearnedConversation(streamLearningEnvelope)) {
            appendConversationToStm(userId, enrichedData.request.sessionId || null, question, responseText)
          }

          aiGateway.logger.info(requestId, "STREAM_REQUEST_COMPLETED", {
            responseLength: responseText.length
          })

          writeSSE(res, "complete", {
            requestId,
            response: responseText,
            metadata: {
              processingTime: Date.now() - startTime,
              provider: payload?.provider || "streaming_gateway",
              assistantProfile: promptPackage.profileId,
              requestedAssistantProfile: promptPackage.requestedProfileId || enhancedContext.assistantProfile || null,
              activeModules: promptPackage.activeModules,
              domainSubmodules: promptPackage.domainSubmodules || {},
              bibleStudyModules: promptPackage.bibleStudyModules || [],
              askRoute: {
                handler: streamDecision.handlerName,
                intent: streamDecision.intent,
                routeType: streamDecision.routeType,
                decisionMs: streamDecision.decisionMs
              },
              fastPath: streamFastPath,
              weatherUsed: runtimeBuildWeatherClientMetadata(enhancedContext.agroWeather),
              languageUsed: buildLanguageRuntimeMetadata(streamEnhancedContext),
              memoryContext: runtimeContextResult.diagnostics,
              evaluation: evaluation || null,
              selfHealing: selfHealing || null,
              learning: learning || null,
              ragSources: streamEnhancedContext.ragSources || []
            }
          })
          clearHeartbeat()
          res.end()
        },
        async (payload) => {
          const streamErrorMessage = String(payload?.error || "Falha no streaming")
          try {
            const fallbackResult = await askGiomService(preparedPayload, { mode: "standard" })
            const responseText = String(fallbackResult.responseText || "").trim()
              || buildOperationalContingencyResponse(question, enhancedContext, streamErrorMessage)

            hasCompleted = true

            aiGateway.metrics.recordResponseEvaluation(requestId, fallbackResult.evaluation, fallbackResult.selfHealing)

            if (shouldPersistLearnedConversation(fallbackResult)) {
              saveConversationNonBlocking(userId, question, responseText, {
                provider: "streaming_fallback_standard",
                requestId,
                assistantProfile: promptPackage.profileId,
                activeModules: promptPackage.activeModules,
                domainSubmodules: promptPackage.domainSubmodules || {},
                bibleStudyModules: promptPackage.bibleStudyModules,
                promptPacks: promptPackage.promptPacks,
                evaluation: fallbackResult.evaluation || null,
                selfHealing: fallbackResult.selfHealing || null,
                learning: fallbackResult.learning || null,
                streaming: false,
                fallbackFromStreaming: true,
                fastPath: streamFastPath.enabled ? streamFastPath : null,
                askRoute: {
                  handler: fallbackResult.handler,
                  intent: fallbackResult.intent,
                  routeType: fallbackResult.routeType
                }
              }, requestId)
            }

            aiGateway.metrics.recordRequest(requestId, Date.now() - startTime, true)
            aiGateway.metrics.recordUserActivity(userId, "ask_stream_fallback", {
              length: question.length,
              reason: "stream_provider_error"
            })
            if (shouldPersistLearnedConversation(fallbackResult)) {
              appendConversationToStm(userId, enrichedData.request.sessionId || null, question, responseText)
            }

            writeSSE(res, "complete", {
              requestId,
              response: responseText,
              metadata: {
                processingTime: Date.now() - startTime,
                provider: "standard_fallback",
                fallbackFromStreaming: true,
                assistantProfile: promptPackage.profileId,
                requestedAssistantProfile: promptPackage.requestedProfileId || enhancedContext.assistantProfile || null,
                activeModules: promptPackage.activeModules,
                domainSubmodules: promptPackage.domainSubmodules || {},
                bibleStudyModules: promptPackage.bibleStudyModules || [],
                askRoute: {
                  handler: fallbackResult.handler,
                  intent: fallbackResult.intent,
                  routeType: fallbackResult.routeType
                },
                fastPath: streamFastPath,
                weatherUsed: runtimeBuildWeatherClientMetadata(streamEnhancedContext.agroWeather),
                languageUsed: buildLanguageRuntimeMetadata(streamEnhancedContext),
                memoryContext: runtimeContextResult.diagnostics,
                evaluation: fallbackResult.evaluation || null,
                selfHealing: fallbackResult.selfHealing || null,
                learning: fallbackResult.learning || null,
                ragSources: fallbackResult.ragSources || streamEnhancedContext.ragSources || []
              }
            })
            clearHeartbeat()
            res.end()
            return
          } catch (fallbackError) {
            aiGateway.metrics.recordRequest(requestId, Date.now() - startTime, false)
            aiGateway.metrics.recordError("ask_stream_fallback_error", fallbackError, {
              requestId
            })
            writeSSE(res, "error", {
              requestId,
              error: getErrorMessage(fallbackError) || streamErrorMessage
            })
            clearHeartbeat()
            res.end()
            return
          }
        }
      )
    } catch (error) {
      if (!hasCompleted) {
        aiGateway.logger.error(requestId, "STREAM_REQUEST_FAILED", {
          error: getErrorMessage(error),
          stack: getErrorStack(error)
        })
        writeSSE(res, "error", {
          requestId,
          error: getErrorMessage(error) || "Falha ao processar streaming",
          code: getErrorCode(error) || "STREAM_FAILED"
        })
        clearHeartbeat()
        res.end()
      }
    }
  })
}