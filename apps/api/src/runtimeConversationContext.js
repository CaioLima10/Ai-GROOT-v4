// @ts-check

/** @typedef {import("../../../packages/ai-core/src/aiContracts").ConversationHistoryTurn} ConversationHistoryTurn */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").EnhancedRuntimeConversationContext} EnhancedRuntimeConversationContext */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").GoogleCustomSearchPayload} GoogleCustomSearchPayload */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").LiveFixtureSummary} LiveFixtureSummary */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").LiveWeatherSnapshot} LiveWeatherSnapshot */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").PromptBuilderRuntimeContext} PromptBuilderRuntimeContext */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").ResearchCapabilitiesSnapshot} ResearchCapabilitiesSnapshot */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").RuntimeClock} RuntimeClock */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").RuntimeClockMeta} RuntimeClockMeta */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").WeatherForecastProviderPayload} WeatherForecastProviderPayload */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").WeatherLocationResolution} WeatherLocationResolution */
/** @typedef {Error & { code?: string }} RuntimeConversationContextError */

/**
 * @typedef {object} RuntimeConversationContextDeps
 * @property {() => Record<string, unknown>} buildRuntimeCapabilityMatrix
 * @property {(input?: Record<string, unknown>) => ResearchCapabilitiesSnapshot} getResearchCapabilities
 * @property {(question?: string) => number} inferWeatherForecastDays
 * @property {(question?: string) => string} extractWeatherLocationQuery
 * @property {(question?: string, context?: PromptBuilderRuntimeContext) => boolean} isAgroWeatherRelevant
 * @property {(query?: string, forecastDays?: number, options?: { question?: string }) => Promise<WeatherLocationResolution | null>} resolveWeatherLocationByQuery
 * @property {(question?: string) => boolean} isWeatherQuestion
 * @property {(question?: string) => boolean} shouldPreferRecentWeatherMemory
 * @property {(userId?: string, forecastDays?: number) => Promise<WeatherLocationResolution | null>} resolveRecentWeatherLocationFromMemory
 * @property {(context?: PromptBuilderRuntimeContext) => WeatherLocationResolution | null} resolveWeatherLocationContext
 * @property {(ip?: string) => Promise<WeatherLocationResolution | null>} resolveApproximateLocationByIp
 * @property {(timezone?: string) => Promise<RuntimeClock>} getVerifiedRuntimeClock
 * @property {(input?: { latitude?: number; longitude?: number; timezone?: string; forecastDays?: number }) => Promise<WeatherForecastProviderPayload>} fetchWeatherForecastPayload
 * @property {(payload?: WeatherForecastProviderPayload, weatherLocation?: WeatherLocationResolution, referenceClock?: RuntimeClock | null) => LiveWeatherSnapshot} buildWeatherSnapshot
 * @property {(clock?: RuntimeClock | null) => RuntimeClockMeta | null} buildClockVerificationMeta
 * @property {(question?: string, context?: PromptBuilderRuntimeContext) => boolean} isSportsScheduleRelevant
 * @property {(question?: string) => Promise<LiveFixtureSummary | null>} resolveNextFixtureFromQuestion
 * @property {(question?: string, context?: PromptBuilderRuntimeContext) => boolean} shouldInjectGoogleLiveSearch
 * @property {(query: string, options?: Record<string, unknown>) => Promise<GoogleCustomSearchPayload>} performGoogleCustomSearch
 * @property {(payload?: GoogleCustomSearchPayload) => string} summarizeGoogleSearchResults
 * @property {(question?: string) => { canonical?: string } | null} parseBibleReference
 * @property {(question?: string) => boolean} isBibleFollowUpQuestion
 * @property {(history?: ConversationHistoryTurn[]) => { canonical?: string; bibleCode?: string } | null} extractRecentBibleContextFromHistory
 * @property {(text?: string) => string} inferMinistryFocusFromText
 * @property {(history?: ConversationHistoryTurn[]) => { preferredBibleCode?: string; ministryFocus?: string } | null} extractBibleConversationPreferencesFromHistory
 * @property {(input?: { bibleCode?: string; passage?: string }) => Promise<{ content?: string; reference?: string; bibleCode?: string } | null>} fetchBiblePassage
 * @property {(base?: string, extra?: string) => string} mergeRuntimeInstructions
 * @property {(question?: string, context?: PromptBuilderRuntimeContext) => Promise<Record<string, unknown> | null>} enrichLanguageRuntimeContext
 */

/**
 * @param {string} question
 * @param {PromptBuilderRuntimeContext} context
 * @param {Record<string, unknown>} extras
 * @param {RuntimeConversationContextDeps} deps
 * @returns {Promise<EnhancedRuntimeConversationContext>}
 */
export async function buildRuntimeConversationContext(question = "", context = {}, extras = {}, deps) {
  const capabilityMatrix = deps.buildRuntimeCapabilityMatrix()
  const researchCapabilities = deps.getResearchCapabilities(context?.researchCapabilities || {})
  const conversationHistory = Array.isArray(extras?.conversationHistory)
    ? /** @type {ConversationHistoryTurn[]} */ (extras.conversationHistory)
    : Array.isArray(context?.conversationHistory)
      ? /** @type {ConversationHistoryTurn[]} */ (context.conversationHistory)
      : []

  /** @type {EnhancedRuntimeConversationContext} */
  const enhancedContext = {
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
    timestamp: String(extras?.timestamp || new Date().toISOString())
  }

  const historyBiblePreferences = deps.extractBibleConversationPreferencesFromHistory(conversationHistory) || {}
  const inferredMinistryFocus = deps.inferMinistryFocusFromText(question)

  const forecastDays = deps.inferWeatherForecastDays(question)
  const explicitWeatherLocationQuery = deps.extractWeatherLocationQuery(question)
  const requestedWeatherWidget = String(context?.preferredResponseVariant || "").trim().toLowerCase() === "weather"
  /** @type {WeatherLocationResolution | null} */
  let weatherLocation = null

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
      const runtimeError = /** @type {RuntimeConversationContextError} */ (error)
      enhancedContext.weatherLocationError = runtimeError.code || "WEATHER_GEOCODING_FAILED"
    }
  }

  if (!weatherLocation && !explicitWeatherLocationQuery && deps.isWeatherQuestion(question) && deps.shouldPreferRecentWeatherMemory(question)) {
    weatherLocation = await deps.resolveRecentWeatherLocationFromMemory(
      String(extras?.userId || context?.userId || ""),
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
      weatherLocation = await deps.resolveApproximateLocationByIp(String(extras?.ip || context?.ip || ""))
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
      const runtimeError = /** @type {RuntimeConversationContextError} */ (error)
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
      const runtimeError = /** @type {RuntimeConversationContextError} */ (error)
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
      const runtimeError = /** @type {RuntimeConversationContextError} */ (error)
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
      const runtimeError = /** @type {RuntimeConversationContextError} */ (error)
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
      if (languageRuntime.instructions) {
        enhancedContext.instructions = deps.mergeRuntimeInstructions(
          enhancedContext.instructions,
          String(languageRuntime.instructions)
        )
      }
    }
  } catch (error) {
    const runtimeError = /** @type {RuntimeConversationContextError} */ (error)
    enhancedContext.languageRuntime = {
      error: runtimeError.code || runtimeError.message || "LANGUAGE_RUNTIME_FAILED"
    }
  }

  return enhancedContext
}
