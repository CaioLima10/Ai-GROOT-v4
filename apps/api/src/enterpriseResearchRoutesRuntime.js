export function registerEnterpriseResearchRoutes(app, deps) {
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
    let resolvedLocation = null

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
          error: error.message || "Falha ao localizar a cidade informada.",
          code: error.code || "WEATHER_GEOCODING_FAILED",
          details: process.env.NODE_ENV === "development" ? (error.details || error.message) : undefined
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
      return res.status(error.code === "WEATHER_PROVIDER_FAILED" ? 502 : 500).json({
        error: error.message || "Falha ao obter previsao do tempo.",
        code: error.code || "WEATHER_LOOKUP_FAILED",
        details: process.env.NODE_ENV === "development" ? (error.details || error.message) : undefined
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
        error: error.message || "Falha ao consultar pesquisa Google.",
        code: error.code || "GOOGLE_SEARCH_FAILED",
        details: process.env.NODE_ENV === "development" ? error.details || null : undefined
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
        provider: fixture.provider || "thesportsdb",
        data: fixture
      })
    } catch (error) {
      return res.status(502).json({
        error: error.message || "Falha ao consultar agenda esportiva.",
        code: error.code || "SPORTS_LOOKUP_FAILED",
        details: process.env.NODE_ENV === "development" ? error.details || null : undefined
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

    const pathParams = {}
    for (const key of endpointDefinition.requiredParams) {
      pathParams[key] = req.query[key]
    }

    const queryParams = { ...req.query }
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
      return res.status(error.statusCode || 502).json({
        error: error.message || "Falha ao consultar SportsDataIO.",
        code: error.code || "SPORTSDATA_REQUEST_FAILED",
        details: process.env.NODE_ENV === "development" ? error.details || null : undefined
      })
    }
  })
}