import type { Express, RequestHandler } from "express"

type RuntimeResearchCapabilities = {
  weatherForecast?: boolean
  google?: boolean
  sportsSchedule?: boolean
}

type WeatherLocation = {
  latitude: number
  longitude: number
  timezone?: string
  forecastDays?: number
  label?: string | null
  city?: string | null
  region?: string | null
  country?: string | null
  countryCode?: string | null
  locationType?: string | null
  sourceType?: string | null
}

type GoogleSearchPayload = {
  provider: string
  searchType: string
  items: unknown
}

type SportsEndpointDefinition = {
  key: string
  category: string
  callInterval: string
  requiredParams: string[]
}

type RuntimeErrorLike = {
  message?: string
  code?: string
  details?: unknown
  statusCode?: number
}

type EnterpriseResearchRouteDeps = {
  askLimiter: RequestHandler
  getResearchCapabilities: () => RuntimeResearchCapabilities
  hasGoogleCustomSearchConfigured: () => boolean
  sanitizeWeatherLocationQuery: (query: string) => string
  resolveWeatherLocationByQuery: (query: string, forecastDays: number, input: Record<string, unknown>) => Promise<WeatherLocation | null>
  getVerifiedRuntimeClock: (timezone: string) => Promise<unknown>
  fetchWeatherForecastPayload: (location: WeatherLocation) => Promise<unknown>
  buildWeatherSnapshot: (payload: unknown, location: WeatherLocation, clock: unknown) => unknown
  performGoogleCustomSearch: (query: string, input: Record<string, unknown>) => Promise<GoogleSearchPayload>
  resolveNextFixtureFromQuestion: (query: string) => Promise<unknown>
  listSportsDataIoEndpoints: () => SportsEndpointDefinition[]
  resolveSportsDataIoEndpoint: (endpointKey: string) => SportsEndpointDefinition | null
  fetchSportsDataIo: (
    endpointKey: string,
    pathParams: Record<string, unknown>,
    queryParams: Record<string, unknown>
  ) => Promise<unknown>
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function getErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as RuntimeErrorLike).code || "")
    : ""
}

function getErrorDetails(error: unknown) {
  return typeof error === "object" && error !== null && "details" in error
    ? (error as RuntimeErrorLike).details
    : undefined
}

function getErrorStatusCode(error: unknown) {
  return typeof error === "object" && error !== null && "statusCode" in error
    ? Number((error as RuntimeErrorLike).statusCode || 0)
    : 0
}

export function registerEnterpriseResearchRoutes(app: Express, deps: EnterpriseResearchRouteDeps) {
  const {
    askLimiter,
    getResearchCapabilities,
    hasGoogleCustomSearchConfigured,
    sanitizeWeatherLocationQuery,
    resolveWeatherLocationByQuery,
    getVerifiedRuntimeClock,
    fetchWeatherForecastPayload,
    buildWeatherSnapshot,
    performGoogleCustomSearch,
    resolveNextFixtureFromQuestion,
    listSportsDataIoEndpoints,
    resolveSportsDataIoEndpoint,
    fetchSportsDataIo
  } = deps

  app.get("/research/weather", askLimiter, async (req, res) => {
    const runtimeResearchCapabilities = getResearchCapabilities()
    if (!runtimeResearchCapabilities.weatherForecast) {
      return res.status(503).json({
        error: "Consulta de clima ao vivo nao habilitada nesta execucao.",
        code: "WEATHER_FORECAST_DISABLED"
      })
    }

    const latitude = Number(req.query.latitude ?? req.query.lat)
    const longitude = Number(req.query.longitude ?? req.query.lon)
    const timezone = String(req.query.timezone || "auto")
    const forecastDays = Math.max(1, Math.min(Number(req.query.days || 7) || 7, 7))
    const cityQuery = sanitizeWeatherLocationQuery(String(req.query.city || req.query.name || req.query.q || ""))
    let resolvedLocation: WeatherLocation | null = null

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      resolvedLocation = {
        latitude,
        longitude,
        timezone,
        forecastDays
      }
    } else if (cityQuery) {
      try {
        resolvedLocation = await resolveWeatherLocationByQuery(cityQuery, forecastDays, { question: cityQuery })
        if (!resolvedLocation) {
          return res.status(404).json({
            error: `Nao encontrei a localidade ${cityQuery}.`,
            code: "WEATHER_LOCATION_NOT_FOUND"
          })
        }
      } catch (error) {
        return res.status(502).json({
          error: getErrorMessage(error) || "Falha ao localizar a cidade informada.",
          code: getErrorCode(error) || "WEATHER_GEOCODING_FAILED",
          details: process.env.NODE_ENV === "development" ? (getErrorDetails(error) || getErrorMessage(error)) : undefined
        })
      }
    } else {
      return res.status(400).json({
        error: "Informe latitude/longitude validas ou uma cidade para consultar a previsao.",
        code: "WEATHER_COORDINATES_REQUIRED"
      })
    }

    try {
      const weatherClock = await getVerifiedRuntimeClock(resolvedLocation.timezone || timezone || "Etc/UTC")
      const payload = await fetchWeatherForecastPayload(resolvedLocation)
      return res.json({
        success: true,
        provider: "open-meteo",
        coordinates: {
          latitude: resolvedLocation.latitude,
          longitude: resolvedLocation.longitude
        },
        forecastDays,
        timezone: resolvedLocation.timezone || timezone,
        location: {
          label: resolvedLocation.label || null,
          city: resolvedLocation.city || null,
          region: resolvedLocation.region || null,
          country: resolvedLocation.country || null,
          countryCode: resolvedLocation.countryCode || null,
          locationType: resolvedLocation.locationType || null,
          sourceType: resolvedLocation.sourceType || null
        },
        data: buildWeatherSnapshot(payload, resolvedLocation, weatherClock)
      })
    } catch (error) {
      return res.status(getErrorCode(error) === "WEATHER_PROVIDER_FAILED" ? 502 : 500).json({
        error: getErrorMessage(error) || "Falha ao obter previsao do tempo.",
        code: getErrorCode(error) || "WEATHER_LOOKUP_FAILED",
        details: process.env.NODE_ENV === "development" ? (getErrorDetails(error) || getErrorMessage(error)) : undefined
      })
    }
  })

  app.get("/research/search", askLimiter, async (req, res) => {
    const runtimeResearchCapabilities = getResearchCapabilities()
    if (!runtimeResearchCapabilities.google || !hasGoogleCustomSearchConfigured()) {
      return res.status(503).json({
        error: "Pesquisa Google ao vivo nao habilitada nesta execucao.",
        code: "GOOGLE_SEARCH_DISABLED"
      })
    }

    const query = String(req.query.q || req.query.query || "").trim()
    const searchType = String(req.query.type || req.query.searchType || "").trim().toLowerCase() === "image"
      ? "image"
      : "web"
    const num = Math.max(1, Math.min(Number(req.query.num || 5) || 5, 10))

    if (!query) {
      return res.status(400).json({
        error: "Informe um termo de busca em q ou query.",
        code: "SEARCH_QUERY_REQUIRED"
      })
    }

    try {
      const payload = await performGoogleCustomSearch(query, {
        num,
        searchType,
        hl: String(req.query.hl || "pt-BR"),
        gl: String(req.query.gl || "br")
      })

      return res.json({
        success: true,
        provider: payload.provider,
        searchType: payload.searchType,
        items: payload.items
      })
    } catch (error) {
      return res.status(502).json({
        error: getErrorMessage(error) || "Falha ao consultar pesquisa Google.",
        code: getErrorCode(error) || "GOOGLE_SEARCH_FAILED",
        details: process.env.NODE_ENV === "development" ? getErrorDetails(error) || null : undefined
      })
    }
  })

  app.get("/research/sports", askLimiter, async (req, res) => {
    const runtimeResearchCapabilities = getResearchCapabilities()
    if (!runtimeResearchCapabilities.sportsSchedule) {
      return res.status(503).json({
        error: "Consulta esportiva ao vivo nao habilitada nesta execucao.",
        code: "SPORTS_SCHEDULE_DISABLED"
      })
    }

    const query = String(req.query.q || req.query.query || "").trim()
    if (!query) {
      return res.status(400).json({
        error: "Informe um time, selecao ou pergunta esportiva em q ou query.",
        code: "SPORTS_QUERY_REQUIRED"
      })
    }

    try {
      const fixture = await resolveNextFixtureFromQuestion(query)
      if (!fixture) {
        return res.status(404).json({
          error: "Nao encontrei agenda esportiva para a consulta informada.",
          code: "SPORTS_LOOKUP_EMPTY"
        })
      }

      return res.json({
        success: true,
        provider: typeof fixture === "object" && fixture !== null && "provider" in fixture
          ? String((fixture as Record<string, unknown>).provider || "thesportsdb")
          : "thesportsdb",
        data: fixture
      })
    } catch (error) {
      return res.status(502).json({
        error: getErrorMessage(error) || "Falha ao consultar agenda esportiva.",
        code: getErrorCode(error) || "SPORTS_LOOKUP_FAILED",
        details: process.env.NODE_ENV === "development" ? getErrorDetails(error) || null : undefined
      })
    }
  })

  app.get("/research/soccer/endpoints", askLimiter, (_req, res) => {
    return res.json({
      success: true,
      provider: "sportsdataio",
      auth: {
        header: "Ocp-Apim-Subscription-Key",
        queryParam: "key"
      },
      endpoints: listSportsDataIoEndpoints()
    })
  })

  app.get("/research/soccer/:endpointKey", askLimiter, async (req, res) => {
    const runtimeResearchCapabilities = getResearchCapabilities()
    if (!runtimeResearchCapabilities.sportsSchedule) {
      return res.status(503).json({
        error: "Consulta esportiva ao vivo nao habilitada nesta execucao.",
        code: "SPORTS_SCHEDULE_DISABLED"
      })
    }

    const endpointKey = String(req.params.endpointKey || "").trim()
    const endpointDefinition = resolveSportsDataIoEndpoint(endpointKey)
    if (!endpointDefinition) {
      return res.status(400).json({
        error: "Endpoint de futebol nao permitido para consulta.",
        code: "SPORTSDATA_ENDPOINT_NOT_ALLOWED",
        allowedEndpoints: listSportsDataIoEndpoints().map((entry) => entry.key)
      })
    }

    const pathParams: Record<string, unknown> = {}
    for (const key of endpointDefinition.requiredParams) {
      pathParams[key] = req.query[key]
    }

    const queryParams = { ...req.query } as Record<string, unknown>
    delete queryParams.key

    try {
      const payload = await fetchSportsDataIo(endpointKey, pathParams, queryParams)
      return res.json({
        success: true,
        provider: "sportsdataio",
        endpoint: endpointKey,
        category: endpointDefinition.category,
        callInterval: endpointDefinition.callInterval,
        requiredParams: endpointDefinition.requiredParams,
        data: payload
      })
    } catch (error) {
      return res.status(getErrorStatusCode(error) || 502).json({
        error: getErrorMessage(error) || "Falha ao consultar SportsDataIO.",
        code: getErrorCode(error) || "SPORTSDATA_REQUEST_FAILED",
        details: process.env.NODE_ENV === "development" ? getErrorDetails(error) || null : undefined
      })
    }
  })
}