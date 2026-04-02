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

export function registerEnterprisePublicRoutes(app, deps) {
  const {
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
    listCapabilityHighlights
  } = deps

  app.get("/", (_req, res) => {
    res.json({
      name: AI_ENTERPRISE_NAME,
      status: "ok",
      version: process.env.npm_package_version ?? "1.0.0",
      endpoints: ["/health", "/ask", "/config", "/capabilities", "/v1/models"]
    })
  })

  app.get("/config", async (_req, res) => {
    const knowledgeStats = await grootAdvancedRAG.getAdvancedStats()
    const capabilityMatrix = buildRuntimeCapabilityMatrix()
    const runtimeResearchCapabilities = getResearchCapabilities()
    const liveResearchRuntime = getLiveResearchRuntime()
    const imageGenerationEnabled = isImageGenerationEnabled()
    const liveWebEnabled = isLiveWebEnabled(runtimeResearchCapabilities, liveResearchRuntime)

    res.json({
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
      capabilityMatrix,
      documentFormats: documentGenerationFormats
    })
  })

  app.get("/capabilities", (_req, res) => {
    res.json(buildRuntimeCapabilityMatrix())
  })
}