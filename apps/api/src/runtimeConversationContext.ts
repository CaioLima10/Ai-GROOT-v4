import type {
  ConversationHistoryTurn,
  EnhancedRuntimeConversationContext,
  GoogleCustomSearchPayload,
  LiveFixtureSummary,
  LiveWeatherSnapshot,
  PromptBuilderRuntimeContext,
  ResearchCapabilitiesSnapshot,
  RuntimeClock,
  RuntimeClockMeta,
  WeatherForecastProviderPayload,
  WeatherLocationResolution
} from "../../../packages/ai-core/src/aiContracts.js"

type RuntimeConversationContextError = Error & { code?: string }

type RuntimeConversationContextDeps = {
  buildRuntimeCapabilityMatrix: () => Record<string, unknown>
  getResearchCapabilities: (input?: Record<string, unknown>) => ResearchCapabilitiesSnapshot
  inferWeatherForecastDays: (question?: string) => number
  extractWeatherLocationQuery: (question?: string) => string
  isAgroWeatherRelevant: (question?: string, context?: PromptBuilderRuntimeContext) => boolean
  resolveWeatherLocationByQuery: (query?: string, forecastDays?: number, options?: { question?: string }) => Promise<WeatherLocationResolution | null>
  isWeatherQuestion: (question?: string) => boolean
  shouldPreferRecentWeatherMemory: (question?: string) => boolean
  resolveRecentWeatherLocationFromMemory: (userId?: string, forecastDays?: number) => Promise<WeatherLocationResolution | null>
  resolveWeatherLocationContext: (context?: PromptBuilderRuntimeContext) => WeatherLocationResolution | null
  resolveApproximateLocationByIp: (ip?: string) => Promise<WeatherLocationResolution | null>
  getVerifiedRuntimeClock: (timezone?: string) => Promise<RuntimeClock>
  fetchWeatherForecastPayload: (input?: { latitude?: number; longitude?: number; timezone?: string; forecastDays?: number }) => Promise<WeatherForecastProviderPayload>
  buildWeatherSnapshot: (payload?: WeatherForecastProviderPayload, weatherLocation?: WeatherLocationResolution, referenceClock?: RuntimeClock | null) => LiveWeatherSnapshot
  buildClockVerificationMeta: (clock?: RuntimeClock | null) => RuntimeClockMeta | null
  isSportsScheduleRelevant: (question?: string, context?: PromptBuilderRuntimeContext) => boolean
  resolveNextFixtureFromQuestion: (question?: string) => Promise<LiveFixtureSummary | null>
  shouldInjectGoogleLiveSearch: (question?: string, context?: PromptBuilderRuntimeContext) => boolean
  performGoogleCustomSearch: (query: string, options?: Record<string, unknown>) => Promise<GoogleCustomSearchPayload>
  summarizeGoogleSearchResults: (payload?: GoogleCustomSearchPayload) => string
  parseBibleReference: (question?: string) => { canonical?: string } | null
  isBibleFollowUpQuestion: (question?: string) => boolean
  extractRecentBibleContextFromHistory: (history?: ConversationHistoryTurn[]) => { canonical?: string; bibleCode?: string } | null
  inferMinistryFocusFromText: (text?: string) => string
  extractBibleConversationPreferencesFromHistory: (history?: ConversationHistoryTurn[]) => { preferredBibleCode?: string; ministryFocus?: string } | null
  fetchBiblePassage: (input?: { bibleCode?: string; passage?: string }) => Promise<{ content?: string; reference?: string; bibleCode?: string } | null>
  mergeRuntimeInstructions: (base?: string, extra?: string) => string
  enrichLanguageRuntimeContext: (question?: string, context?: PromptBuilderRuntimeContext) => Promise<Record<string, unknown> | null>
}

type MutableEnhancedRuntimeConversationContext = EnhancedRuntimeConversationContext & Record<string, any>

function normalizeExplicitWeatherLocationQuery(value = ""): string {
  return String(value || "")
    .trim()
    .replace(/^(?:\s*(?:em|na|no|para)\s+)+/i, "")
    .trim()
}

export async function buildRuntimeConversationContext(
  question = "",
  context: PromptBuilderRuntimeContext = {},
  extras: Record<string, unknown> = {},
  deps: RuntimeConversationContextDeps
): Promise<EnhancedRuntimeConversationContext> {
  const capabilityMatrix = deps.buildRuntimeCapabilityMatrix()
  const researchCapabilities = deps.getResearchCapabilities((context as Record<string, any>)?.researchCapabilities || {})
  const extrasRecord = extras as Record<string, any>
  const contextRecord = context as Record<string, any>
  const conversationHistory = Array.isArray(extrasRecord?.conversationHistory)
    ? (extrasRecord.conversationHistory as ConversationHistoryTurn[])
    : Array.isArray(contextRecord?.conversationHistory)
      ? (contextRecord.conversationHistory as ConversationHistoryTurn[])
      : []

  const enhancedContext: MutableEnhancedRuntimeConversationContext = {
    ...context,
    ...extras,
    conversationHistory,
    researchCapabilities,
    capabilityMatrix,
    privacyCapabilities: {
      sensitiveDataRedaction: true,
      sensitiveLearningBlocked: true,
      temporaryUploadStorage: true
    },
    timestamp: String(extrasRecord?.timestamp || new Date().toISOString())
  }

  const historyBiblePreferences = deps.extractBibleConversationPreferencesFromHistory(conversationHistory) || {}
  const inferredMinistryFocus = deps.inferMinistryFocusFromText(question)

  const forecastDays = deps.inferWeatherForecastDays(question)
  const explicitWeatherLocationQuery = normalizeExplicitWeatherLocationQuery(deps.extractWeatherLocationQuery(question))
  const requestedWeatherWidget = String(contextRecord?.preferredResponseVariant || "").trim().toLowerCase() === "weather"
  let weatherLocation: WeatherLocationResolution | null = null

  if (explicitWeatherLocationQuery) {
    enhancedContext.weatherLocationQuery = explicitWeatherLocationQuery
  }

  if (researchCapabilities.weatherForecast && deps.isAgroWeatherRelevant(question, context) && explicitWeatherLocationQuery) {
    try {
      weatherLocation = await deps.resolveWeatherLocationByQuery(explicitWeatherLocationQuery, forecastDays, { question })
      if (weatherLocation) {
        enhancedContext.weatherLocation = weatherLocation
      } else {
        enhancedContext.weatherLocationError = "WEATHER_LOCATION_NOT_FOUND"
      }
    } catch (error) {
      const runtimeError = error as RuntimeConversationContextError
      enhancedContext.weatherLocationError = runtimeError.code || "WEATHER_GEOCODING_FAILED"
    }
  }

  if (!weatherLocation && !explicitWeatherLocationQuery && deps.isWeatherQuestion(question) && deps.shouldPreferRecentWeatherMemory(question)) {
    weatherLocation = await deps.resolveRecentWeatherLocationFromMemory(
      String(extrasRecord?.userId || contextRecord?.userId || ""),
      forecastDays
    ).catch(() => null)

    if (weatherLocation) {
      weatherLocation = {
        ...weatherLocation,
        forecastDays
      }
      enhancedContext.weatherLocation = weatherLocation
    }
  }

  if (!weatherLocation && !explicitWeatherLocationQuery) {
    weatherLocation = deps.resolveWeatherLocationContext(context)
    if (weatherLocation) {
      weatherLocation = {
        ...weatherLocation,
        forecastDays
      }
      enhancedContext.weatherLocation = weatherLocation
    }
  }

  if (!weatherLocation && !explicitWeatherLocationQuery && !requestedWeatherWidget && researchCapabilities.weatherForecast && deps.isAgroWeatherRelevant(question, context)) {
    try {
      weatherLocation = await deps.resolveApproximateLocationByIp(String(extrasRecord?.ip || contextRecord?.ip || ""))
      if (weatherLocation) {
        weatherLocation = {
          ...weatherLocation,
          forecastDays,
          sourceType: "ip_approximate"
        }
        enhancedContext.weatherLocation = weatherLocation
      }
    } catch {
      // graceful fallback if IP geolocation is unavailable
    }
  }

  if (researchCapabilities.weatherForecast && weatherLocation && deps.isAgroWeatherRelevant(question, context)) {
    const weatherClock = await deps.getVerifiedRuntimeClock(weatherLocation.timezone || "Etc/UTC")
    try {
      const weatherPayload = await deps.fetchWeatherForecastPayload(weatherLocation)
      enhancedContext.agroWeather = deps.buildWeatherSnapshot(weatherPayload, weatherLocation, weatherClock)
      enhancedContext.weatherForecastData = enhancedContext.agroWeather
    } catch (error) {
      const runtimeError = error as RuntimeConversationContextError
      enhancedContext.agroWeather = {
        provider: "open-meteo",
        locationLabel: weatherLocation.label || `${weatherLocation.latitude.toFixed(3)}, ${weatherLocation.longitude.toFixed(3)}`,
        forecastDays: weatherLocation.forecastDays,
        fetchedAt: weatherClock?.utcIso || new Date().toISOString(),
        timeVerification: deps.buildClockVerificationMeta(weatherClock),
        locationType: weatherLocation.locationType || null,
        coordinates: {
          latitude: Number(weatherLocation.latitude),
          longitude: Number(weatherLocation.longitude)
        },
        error: runtimeError.code || "WEATHER_LOOKUP_FAILED",
        summary: `Local de referencia: ${weatherLocation.label || `${weatherLocation.latitude.toFixed(3)}, ${weatherLocation.longitude.toFixed(3)}`}. Falha ao obter clima ao vivo nesta execucao; trate a resposta como plano tecnico sem confirmacao meteorologica externa.`
      }
      enhancedContext.weatherForecastData = enhancedContext.agroWeather
    }
  }

  if (researchCapabilities.sportsSchedule && deps.isSportsScheduleRelevant(question, context)) {
    try {
      const liveFixture = await deps.resolveNextFixtureFromQuestion(question)
      if (liveFixture) {
        enhancedContext.liveFixture = liveFixture
      }
    } catch (error) {
      const runtimeError = error as RuntimeConversationContextError
      enhancedContext.liveFixture = {
        error: runtimeError.code || "SPORTS_SCHEDULE_FAILED",
        summary: "Falha ao consultar agenda esportiva ao vivo nesta execucao."
      }
    }
  }

  if (researchCapabilities.google && deps.shouldInjectGoogleLiveSearch(question, context)) {
    try {
      const liveSearch = await deps.performGoogleCustomSearch(question, { num: 4 })
      const liveSummary = deps.summarizeGoogleSearchResults(liveSearch)
      if (liveSummary) {
        enhancedContext.liveSearch = {
          provider: liveSearch.provider,
          items: liveSearch.items
        }
        enhancedContext.liveSearchSummary = liveSummary
      }
    } catch (error) {
      const runtimeError = error as RuntimeConversationContextError
      enhancedContext.liveSearch = {
        error: runtimeError.code || "GOOGLE_CUSTOM_SEARCH_FAILED"
      }
    }
  }

  const parsedBibleReference = deps.parseBibleReference(question)
  const recentBibleContext = !parsedBibleReference && deps.isBibleFollowUpQuestion(question)
    ? deps.extractRecentBibleContextFromHistory(conversationHistory)
    : null

  const preferredBibleCode = String(
    enhancedContext?.preferredBibleCode ||
    enhancedContext?.bibleCode ||
    historyBiblePreferences.preferredBibleCode ||
    recentBibleContext?.bibleCode ||
    ""
  ).trim()

  const ministryFocus = String(
    enhancedContext?.ministryFocus ||
    inferredMinistryFocus ||
    historyBiblePreferences.ministryFocus ||
    ""
  ).trim()

  const requestedBibleReference = parsedBibleReference?.canonical || recentBibleContext?.canonical || ""
  const requestedBibleCode = preferredBibleCode

  if (preferredBibleCode) {
    enhancedContext.preferredBibleCode = preferredBibleCode
  }

  if (ministryFocus) {
    enhancedContext.ministryFocus = ministryFocus
  }

  if (requestedBibleReference) {
    try {
      const biblePassage = await deps.fetchBiblePassage({
        bibleCode: requestedBibleCode,
        passage: requestedBibleReference
      })
      if (biblePassage?.content) {
        enhancedContext.biblePassage = biblePassage
        enhancedContext.preferredBibleCode = biblePassage.bibleCode || requestedBibleCode || enhancedContext.preferredBibleCode
        enhancedContext.biblePassageContextFromHistory = Boolean(recentBibleContext && !parsedBibleReference)
        enhancedContext.instructions = deps.mergeRuntimeInstructions(
          enhancedContext.instructions,
          `Use ${biblePassage.reference} (${biblePassage.bibleCode}) como texto-base desta resposta biblica. Preserve a mesma traducao e explique primeiro o sentido do texto antes de ampliar para contexto, aplicacao ou teologia.`
        )
      }
    } catch (error) {
      const runtimeError = error as RuntimeConversationContextError
      enhancedContext.biblePassageError = runtimeError.code || "BIBLE_PASSAGE_LOOKUP_FAILED"
    }
  }

  if (enhancedContext.preferredBibleCode) {
    enhancedContext.instructions = deps.mergeRuntimeInstructions(
      enhancedContext.instructions,
      `Quando a conversa for biblica, priorize a traducao ${enhancedContext.preferredBibleCode}, salvo pedido em contrario.`
    )
  }

  if (enhancedContext.ministryFocus === "new_believers") {
    enhancedContext.instructions = deps.mergeRuntimeInstructions(
      enhancedContext.instructions,
      "Mantenha foco pastoral acolhedor, claro e fiel ao evangelho para novos convertidos."
    )
  }

  if (enhancedContext.uploadExtraction?.quality) {
    enhancedContext.instructions = deps.mergeRuntimeInstructions(
      enhancedContext.instructions,
      "Quando a resposta depender de arquivo enviado, use apenas o conteudo realmente extraido. Se a extracao estiver baixa, parcial ou sem OCR confiavel, diga isso claramente e nao invente detalhes ausentes."
    )
    enhancedContext.instructions = deps.mergeRuntimeInstructions(
      enhancedContext.instructions,
      "Se o anexo for imagem, screenshot ou interface, descreva apenas textos e elementos realmente visiveis ou extraidos. Nao conclua que e login, cadastro, promocao, erro, home ou fluxo de app sem evidencia textual clara na propria imagem."
    )
  }

  try {
    const languageRuntime = await deps.enrichLanguageRuntimeContext(question, enhancedContext)
    if (languageRuntime) {
      enhancedContext.languageRuntime = languageRuntime
      if ((languageRuntime as Record<string, any>).instructions) {
        enhancedContext.instructions = deps.mergeRuntimeInstructions(
          enhancedContext.instructions,
          String((languageRuntime as Record<string, any>).instructions)
        )
      }
    }
  } catch (error) {
    const runtimeError = error as RuntimeConversationContextError
    enhancedContext.languageRuntime = {
      error: runtimeError.code || runtimeError.message || "LANGUAGE_RUNTIME_FAILED"
    }
  }

  return enhancedContext
}
