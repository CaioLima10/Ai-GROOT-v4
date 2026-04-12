import { parseRuntimeConfigPayload } from "../../../packages/shared-config/src/runtimeSchemas.js"

function isLiveWebEnabled(runtimeResearchCapabilities, liveResearchRuntime) {
  return Boolean(
    runtimeResearchCapabilities.liveWeb ||
    runtimeResearchCapabilities.google ||
    runtimeResearchCapabilities.bing ||
    runtimeResearchCapabilities.yahoo ||
    runtimeResearchCapabilities.scholar ||
    runtimeResearchCapabilities.news ||
    runtimeResearchCapabilities.codeSearch ||
    runtimeResearchCapabilities.browserAutomation ||
    liveResearchRuntime.googleSearch
  )
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {}
}

function resolveMemoryUserId(req) {
  const candidate = String(
    req.get("X-User-Id")
    || req.query.userId
    || req.body?.userId
    || req.ip
    || "anonymous"
  ).trim()

  return candidate || "anonymous"
}

export function registerEnterprisePublicRoutes(app, deps) {
  const {
    askLimiter,
    AI_ENTERPRISE_NAME,
    AI_SERVICE_SLUG,
    grootAdvancedRAG,
    buildRuntimeCapabilityMatrix,
    getResearchCapabilities,
    getLiveResearchRuntime,
    aiProviders,
    grootEmbeddings,
    listAssistantProfiles,
    listDomainModules,
    listModuleEnhancementPlans,
    listPlannedModules,
    listBibleStudyModules,
    listCompatModels,
    listPromptPacks,
    isImageGenerationEnabled,
    imageGenerationModel,
    IMAGE_STYLE_PRESETS,
    IMAGE_RATIO_DIMENSIONS,
    imageGenerationMinDimension,
    imageGenerationMaxDimension,
    documentGenerationFormats,
    uploadOcrEnabled,
    uploadTtlMinutes,
    listEvaluationDimensions,
    listEvaluationPacks,
    SUPPORTED_UPLOAD_ACCEPT,
    getUploadCapabilities,
    uploadMaxBytes,
    listCapabilityHighlights,
    traceStore,
    toolRegistry,
    jobManager,
    voiceRuntime,
    longMemoryRuntime,
    localVoiceRuntime
  } = deps

  app.get("/", (_req, res) => {
    res.json({
      name: AI_ENTERPRISE_NAME,
      status: "ok",
      version: process.env.npm_package_version ?? "1.0.0",
      endpoints: ["/health", "/ask", "/config", "/capabilities", "/runtime/tools", "/memory/profile", "/memory/session-summary", "/v1/models", "/v1/realtime/sessions"]
    })
  })

  app.get("/config", async (_req, res) => {
    const knowledgeStats = await grootAdvancedRAG.getAdvancedStats()
    const capabilityMatrix = buildRuntimeCapabilityMatrix()
    const runtimeResearchCapabilities = getResearchCapabilities()
    const liveResearchRuntime = getLiveResearchRuntime()
    const imageGenerationEnabled = isImageGenerationEnabled()
    const liveWebEnabled = isLiveWebEnabled(runtimeResearchCapabilities, liveResearchRuntime)
    const toolSummary = toolRegistry?.getSummary?.() || null
    const jobSummary = jobManager?.getSummary?.() || null
    const traceSummary = traceStore?.getSummary?.() || null
    const voiceSummary = voiceRuntime?.getSummary?.() || null
    const longMemorySummary = longMemoryRuntime?.getSummary?.() || null
    const voiceProviders = localVoiceRuntime?.getStatus?.() || null
    const voicePersonas = localVoiceRuntime?.getPersonas?.() || []

    const configPayload = parseRuntimeConfigPayload({
      service: AI_SERVICE_SLUG,
      supabaseUrl: process.env.SUPABASE_URL || null,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
      adminProtected: !!process.env.ADMIN_DASH_KEY,
      features: {
        auth: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
        localModels: process.env.OLLAMA_ENABLED === "true",
        futureOpenAIReady: true,
        streaming: true,
        pdfParsing: true,
        officeSuiteBasic: true,
        docxParsing: true,
        spreadsheetParsing: true,
        presentationParsing: true,
        imageOcr: uploadOcrEnabled,
        imageGeneration: imageGenerationEnabled,
        documentGeneration: true,
        serverPdfGeneration: true,
        voiceRealtime: true,
        audioTranscriptions: true,
        audioSpeech: true,
        browserVad: true,
        serverAudioTranscriptions: Boolean(localVoiceRuntime?.hasServerTranscriptions?.()),
        serverAudioSpeech: Boolean(localVoiceRuntime?.hasServerSpeech?.()),
        serverVad: Boolean(localVoiceRuntime?.getStatus?.()?.vad?.available),
        weatherForecast: Boolean(runtimeResearchCapabilities.weatherForecast),
        sportsSchedule: Boolean(runtimeResearchCapabilities.sportsSchedule || liveResearchRuntime.sportsSchedule),
        googleSearch: Boolean(liveResearchRuntime.googleSearch),
        googleImageSearch: Boolean(liveResearchRuntime.googleImageSearch)
      },
      ai: {
        providerMode: process.env.GROOT_AI_PROVIDER || "auto",
        modelTier: process.env.GROOT_MODEL_TIER || "balanced",
        providers: aiProviders.getProviderSummary(),
        embeddings: grootEmbeddings.getStatus(),
        assistantProfiles: listAssistantProfiles(),
        domainModules: listDomainModules(),
        moduleEnhancements: listModuleEnhancementPlans(),
        plannedModules: listPlannedModules(),
        bibleStudyModules: listBibleStudyModules(),
        compatModels: listCompatModels(),
        promptPacks: listPromptPacks(),
        imageGeneration: {
          enabled: imageGenerationEnabled,
          provider: imageGenerationEnabled ? "huggingface" : "disabled",
          model: imageGenerationModel,
          stylePresets: Object.keys(IMAGE_STYLE_PRESETS),
          aspectRatios: Object.keys(IMAGE_RATIO_DIMENSIONS),
          minDimension: imageGenerationMinDimension,
          maxDimension: imageGenerationMaxDimension
        },
        documentGeneration: {
          enabled: true,
          formats: documentGenerationFormats
        }
      },
      research: runtimeResearchCapabilities,
      liveResearch: liveResearchRuntime,
      privacy: {
        sensitiveDataRedaction: true,
        sensitiveLearningBlocked: true,
        temporaryUploadStorage: true,
        uploadTtlMinutes,
        piiEchoProtection: true
      },
      safety: {
        explicitSexualContentBlocked: true,
        crimesBlocked: true,
        cyberAbuseBlocked: true,
        selfHarmSupport: true,
        violenceBlocked: true,
        terrorismBlocked: true,
        youthHarmInfluenceBlocked: true,
        preventionAndModerationGuidanceAllowed: true
      },
      evaluation: {
        dimensions: listEvaluationDimensions(),
        packs: listEvaluationPacks(),
        note: "Consciencia operacional mede autodescricao correta de capacidades e limites, nao sentiencia real."
      },
      knowledge: {
        statusEndpoint: "/knowledge/status",
        localKnowledge: knowledgeStats.localKnowledge,
        localBugs: knowledgeStats.localBugs,
        remoteEnabled: knowledgeStats.remoteEnabled
      },
      capabilities: listCapabilityHighlights({
        uploadAccept: SUPPORTED_UPLOAD_ACCEPT,
        ocrEnabled: uploadOcrEnabled,
        docxEnabled: true,
        xlsxEnabled: true,
        pptxEnabled: true,
        imageGenerationEnabled: imageGenerationEnabled,
        imageGenerationProvider: imageGenerationEnabled ? "huggingface" : "disabled",
        imageControlsEnabled: true,
        visualImageUnderstanding: uploadOcrEnabled,
        imageEditingEnabled: false,
        liveWebEnabled,
        weatherForecastEnabled: Boolean(runtimeResearchCapabilities.weatherForecast),
        browserPdfExport: true,
        privacyRedaction: true,
        sensitiveLearningBlocked: true,
        temporaryUploads: true
      }),
      uploads: {
        enabled: true,
        maxBytes: uploadMaxBytes,
        ttlMinutes: uploadTtlMinutes,
        ...getUploadCapabilities()
      },
      runtime: {
        contracts: {
          boundaryValidation: true,
          engine: "zod-shared"
        },
        observability: {
          requestTracing: true,
          recentTraceInspection: true,
          otelReadyFields: true,
          traceSummary
        },
        tools: {
          registry: true,
          schemaValidated: true,
          timeoutEnforced: true,
          groundingAnnotated: true,
          summary: toolSummary
        },
        jobs: {
          asyncExecution: true,
          summary: jobSummary
        },
        memory: {
          longSessionMemory: true,
          userProfiles: true,
          sessionCompaction: true,
          summary: longMemorySummary
        },
        voice: {
          realtimeSessions: true,
          audioTranscriptions: true,
          audioSpeech: true,
          browserAssisted: true,
          bargeIn: true,
          defaultPersona: voicePersonas.find((persona) => persona.serverAudioAvailable)?.id || "giom",
          personas: voicePersonas,
          providers: voiceProviders,
          summary: voiceSummary
        }
      },
      capabilityMatrix,
      documentFormats: documentGenerationFormats
    })

    res.json(configPayload)
  })

  app.get("/capabilities", (_req, res) => {
    res.json(buildRuntimeCapabilityMatrix())
  })

  app.get("/memory/profile", async (req, res) => {
    const userId = resolveMemoryUserId(req)

    try {
      const snapshot = await longMemoryRuntime.getProfileSnapshot(userId, {
        sessionId: req.query.sessionId ? String(req.query.sessionId) : null
      })

      res.json(snapshot)
    } catch (error) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || "Falha ao consultar perfil de memoria",
        code: error.code || "MEMORY_PROFILE_GET_FAILED"
      })
    }
  })

  app.post("/memory/profile", askLimiter, async (req, res) => {
    const userId = resolveMemoryUserId(req)
    const body = normalizeObject(req.body)
    const profilePatch = normalizeObject(body.profile)

    try {
      const updated = await longMemoryRuntime.updateProfile(userId, {
        ...profilePatch,
        activeModules: Array.isArray(body.activeModules) ? body.activeModules : profilePatch.activeModules,
        bibleStudyModules: Array.isArray(body.bibleStudyModules) ? body.bibleStudyModules : profilePatch.bibleStudyModules,
        promptPacks: Array.isArray(body.promptPacks) ? body.promptPacks : profilePatch.promptPacks
      })

      res.json(updated)
    } catch (error) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || "Falha ao atualizar perfil de memoria",
        code: error.code || "MEMORY_PROFILE_UPDATE_FAILED"
      })
    }
  })

  app.get("/memory/session-summary", async (req, res) => {
    const userId = resolveMemoryUserId(req)
    const sessionId = String(req.query.sessionId || "").trim()
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Informe sessionId para consultar o resumo da sessao.",
        code: "MEMORY_SESSION_ID_REQUIRED"
      })
    }

    try {
      const summary = await longMemoryRuntime.getSessionSummary(userId, sessionId, {
        refresh: String(req.query.refresh || "false").toLowerCase() === "true"
      })

      res.json(summary)
    } catch (error) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || "Falha ao consultar resumo da sessao",
        code: error.code || "MEMORY_SESSION_SUMMARY_FAILED"
      })
    }
  })

  app.post("/memory/compact", askLimiter, async (req, res) => {
            const bibleLearningTracks = typeof listBibleLearningTracks === "function" ? listBibleLearningTracks() : []
            const bibleStudyModules = typeof listBibleStudyModules === "function" ? listBibleStudyModules() : []
    const userId = resolveMemoryUserId(req)
    const body = normalizeObject(req.body)
    const sessionId = String(body.sessionId || "").trim()
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Informe sessionId para compactar a memoria da sessao.",
        code: "MEMORY_COMPACT_SESSION_REQUIRED"
      })
    }

    try {
      const result = await longMemoryRuntime.compactSession({
        userId,
        sessionId,
        question: body.question || "",
        responseText: body.responseText || "",
        conversationHistory: Array.isArray(body.conversationHistory) ? body.conversationHistory : [],
        metadata: {
          requestId: body.requestId || null,
          provider: body.provider || "manual_compaction",
          assistantProfile: body.assistantProfile || null,
          activeModules: Array.isArray(body.activeModules) ? body.activeModules : [],
          bibleStudyModules: Array.isArray(body.bibleStudyModules) ? body.bibleStudyModules : [],
          promptPacks: Array.isArray(body.promptPacks) ? body.promptPacks : [],
          locale: body.locale || null
        }
      })

      res.json(result)
    } catch (error) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || "Falha ao compactar memoria da sessao",
        code: error.code || "MEMORY_COMPACTION_FAILED"
      })
    }
  })

  app.get("/runtime/tools", (_req, res) => {
    res.json({
                bibleLearningTracks,
                bibleStudyModules,
      summary: toolRegistry?.getSummary?.() || null
    })
  })

  app.post("/runtime/tools/:toolId/execute", askLimiter, async (req, res) => {
    const requestTrace = traceStore?.getRequestContext?.(req) || {}
    const requestId = String(requestTrace.requestId || `tool_${Date.now()}`)

    try {
      const input = req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? req.body
        : {}
      const result = await toolRegistry.executeTool(req.params.toolId, input, {
        requestId,
        traceId: requestTrace.traceId || null,
        userId: req.get("X-User-Id") || req.ip || "anonymous"
      })

      res.json(result)
    } catch (error) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || "Falha ao executar tool",
        code: error.code || "TOOL_EXECUTION_FAILED",
        details: process.env.NODE_ENV === "development" ? error.details || error.message : undefined,
        requestId
      })
    }
  })
}
