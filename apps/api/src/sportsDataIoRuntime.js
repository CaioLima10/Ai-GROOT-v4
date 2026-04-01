import { buildRequestHeaders } from "./liveWebRuntime.js"

class SportsDataIoError extends Error {
  constructor(message, code, details, statusCode = 502) {
    super(message)
    this.name = "SportsDataIoError"
    this.code = code
    this.details = details
    this.statusCode = statusCode
  }
}

const SOCCER_BASE_URL_DEFAULT = "https://api.sportsdata.io/v4/soccer"

const SPORTS_DATA_IO_ENDPOINTS = {
  areas: {
    category: "coverage",
    path: "/scores/json/Areas",
    requiredParams: [],
    callInterval: "4 Hours"
  },
  competitions: {
    category: "coverage",
    path: "/scores/json/Competitions",
    requiredParams: [],
    callInterval: "1 Hour"
  },
  standings: {
    category: "coverage",
    path: "/scores/json/Standings/{competition}/{season}",
    requiredParams: ["competition", "season"],
    callInterval: "5 Minutes"
  },
  activeMemberships: {
    category: "teamsPlayers",
    path: "/scores/json/ActiveMemberships/{competition}",
    requiredParams: ["competition"],
    callInterval: "1 Day"
  },
  canceledMemberships: {
    category: "teamsPlayers",
    path: "/scores/json/CanceledMemberships",
    requiredParams: [],
    callInterval: "1 Day"
  },
  recentlyChangedMemberships: {
    category: "teamsPlayers",
    path: "/scores/json/RecentlyChangedMemberships/{competition}/{days}",
    requiredParams: ["competition", "days"],
    callInterval: "1 Hour"
  },
  playersByTeamBasic: {
    category: "teamsPlayers",
    path: "/scores/json/PlayersByTeamBasic/{competition}/{teamid}",
    requiredParams: ["competition", "teamid"],
    callInterval: "5 Minutes"
  },
  teamsByCompetition: {
    category: "teamsPlayers",
    path: "/scores/json/Teams/{competition}",
    requiredParams: ["competition"],
    callInterval: "4 Hours"
  },
  seasonTeams: {
    category: "teamsPlayers",
    path: "/scores/json/SeasonTeams/{competition}/{seasonid}",
    requiredParams: ["competition", "seasonid"],
    callInterval: "4 Hours"
  },
  venues: {
    category: "venuesOfficials",
    path: "/scores/json/Venues",
    requiredParams: [],
    callInterval: "4 Hours"
  },
  bettingMetadata: {
    category: "utility",
    path: "/odds/json/BettingMetadata",
    requiredParams: [],
    callInterval: "15 Minutes"
  },
  activeSportsbooks: {
    category: "utility",
    path: "/odds/json/ActiveSportsbooks",
    requiredParams: [],
    callInterval: "1 Hour"
  },
  schedule: {
    category: "eventFeeds",
    path: "/scores/json/Schedule/{competition}/{season}",
    requiredParams: ["competition", "season"],
    callInterval: "5 Minutes"
  },
  schedulesBasic: {
    category: "eventFeeds",
    path: "/scores/json/SchedulesBasic/{competition}/{season}",
    requiredParams: ["competition", "season"],
    callInterval: "5 Minutes"
  },
  competitionDetails: {
    category: "scores",
    path: "/scores/json/CompetitionDetails/{competition}",
    requiredParams: ["competition"],
    callInterval: "1 Hour"
  },
  gamesByDate: {
    category: "scores",
    path: "/scores/json/GamesByDate/{competition}/{date}",
    requiredParams: ["competition", "date"],
    callInterval: "5 Seconds"
  },
  gamesByDateFinal: {
    category: "scores",
    path: "/scores/json/GamesByDateFinal/{competition}/{date}",
    requiredParams: ["competition", "date"],
    callInterval: "5 Seconds"
  },
  scoresBasic: {
    category: "scores",
    path: "/scores/json/ScoresBasic/{competition}/{date}",
    requiredParams: ["competition", "date"],
    callInterval: "5 Seconds"
  },
  scoresBasicFinal: {
    category: "scores",
    path: "/scores/json/ScoresBasicFinal/{competition}/{date}",
    requiredParams: ["competition", "date"],
    callInterval: "5 Seconds"
  },
  boxScore: {
    category: "stats",
    path: "/stats/json/BoxScore/{competition}/{gameid}",
    requiredParams: ["competition", "gameid"],
    callInterval: "1 Minute"
  },
  boxScoreFinal: {
    category: "stats",
    path: "/stats/json/BoxScoreFinal/{competition}/{gameid}",
    requiredParams: ["competition", "gameid"],
    callInterval: "1 Minute"
  },
  boxScoresByDate: {
    category: "stats",
    path: "/stats/json/BoxScoresByDate/{competition}/{date}",
    requiredParams: ["competition", "date"],
    callInterval: "1 Minute"
  },
  boxScoresFinal: {
    category: "stats",
    path: "/stats/json/BoxScoresFinal/{competition}/{date}",
    requiredParams: ["competition", "date"],
    callInterval: "1 Minute"
  },
  playerSeasonStats: {
    category: "stats",
    path: "/stats/json/PlayerSeasonStats/{competition}/{season}",
    requiredParams: ["competition", "season"],
    callInterval: "15 Minutes"
  },
  teamSeasonStats: {
    category: "stats",
    path: "/scores/json/TeamSeasonStats/{competition}/{season}",
    requiredParams: ["competition", "season"],
    callInterval: "5 Minutes"
  },
  lineupsByDate: {
    category: "playerFeeds",
    path: "/stats/json/LineupsByDate/{competition}/{date}",
    requiredParams: ["competition", "date"],
    callInterval: "5 Minutes"
  },
  injuredPlayers: {
    category: "playerFeeds",
    path: "/projections/json/InjuredPlayers/{competition}",
    requiredParams: ["competition"],
    callInterval: "3 Minutes"
  },
  playersByTeam: {
    category: "playerFeeds",
    path: "/scores/json/PlayersByTeam/{competition}/{teamid}",
    requiredParams: ["competition", "teamid"],
    callInterval: "1 Hour"
  },
  liveGameOddsByDate: {
    category: "bettingGameLines",
    path: "/odds/json/LiveGameOddsByDate/{competition}/{date}",
    requiredParams: ["competition", "date"],
    callInterval: "5 Seconds"
  },
  gameOddsByDate: {
    category: "bettingGameLines",
    path: "/odds/json/GameOddsByDate/{competition}/{date}",
    requiredParams: ["competition", "date"],
    callInterval: "30 Seconds"
  },
  bettingEventsByDate: {
    category: "bettingProps",
    path: "/odds/json/BettingEventsByDate/{competition}/{date}",
    requiredParams: ["competition", "date"],
    callInterval: "10 Minutes"
  },
  bettingMarketsByGameId: {
    category: "bettingProps",
    path: "/odds/json/BettingMarketsByGameID/{competition}/{gameid}",
    requiredParams: ["competition", "gameid"],
    callInterval: "10 Minutes"
  },
  bettingPlayerPropsByGameId: {
    category: "bettingProps",
    path: "/odds/json/BettingPlayerPropsByGameID/{competition}/{gameId}",
    requiredParams: ["competition", "gameId"],
    callInterval: "10 Minutes"
  },
  playerGameProjectionStatsByDate: {
    category: "fantasy",
    path: "/projections/json/PlayerGameProjectionStatsByDate/{competition}/{date}",
    requiredParams: ["competition", "date"],
    callInterval: "5 Minutes"
  },
  fantasyGameStatsByDate: {
    category: "fantasy",
    path: "/stats/json/FantasyGameStatsByDate/{competition}/{date}",
    requiredParams: ["competition", "date"],
    callInterval: "5 Minutes"
  },
  dfsSlatesByDate: {
    category: "fantasy",
    path: "/projections/json/DfsSlatesByDate/{competition}/{date}",
    requiredParams: ["competition", "date"],
    callInterval: "15 Minutes"
  },
  upcomingDfsSlatesByCompetition: {
    category: "fantasy",
    path: "/projections/json/UpcomingDfsSlatesByCompetition/{competition}",
    requiredParams: ["competition"],
    callInterval: "15 Minutes"
  }
}

function sanitizeTemplateValue(value = "") {
  return encodeURIComponent(String(value).trim())
}

function buildPathFromTemplate(pathTemplate = "", pathParams = {}) {
  return pathTemplate.replace(/\{([^}]+)\}/g, (_match, key) => sanitizeTemplateValue(pathParams?.[key] || ""))
}

function removeUndefinedValues(input = {}) {
  return Object.entries(input).reduce((acc, [key, value]) => {
    if (value == null || value === "") return acc
    acc[key] = String(value)
    return acc
  }, {})
}

function parseSportsDataIoErrorBody(rawBody = "") {
  const body = String(rawBody || "")
  try {
    const parsed = JSON.parse(body)
    if (typeof parsed?.message === "string" && parsed.message) {
      return parsed.message
    }
    return JSON.stringify(parsed).slice(0, 600)
  } catch {
    return body.slice(0, 600)
  }
}

export function listSportsDataIoEndpoints() {
  return Object.entries(SPORTS_DATA_IO_ENDPOINTS).map(([key, endpoint]) => ({
    key,
    category: endpoint.category,
    path: endpoint.path,
    requiredParams: endpoint.requiredParams,
    callInterval: endpoint.callInterval
  }))
}

export function resolveSportsDataIoEndpoint(endpointKey = "") {
  return SPORTS_DATA_IO_ENDPOINTS[String(endpointKey || "").trim()] || null
}

export function buildSportsDataIoRequest(endpointKey = "", pathParams = {}, queryParams = {}, options = {}) {
  const endpoint = resolveSportsDataIoEndpoint(endpointKey)
  if (!endpoint) {
    throw new SportsDataIoError(
      "Endpoint de futebol nao permitido.",
      "SPORTSDATA_ENDPOINT_NOT_ALLOWED",
      `endpointKey=${endpointKey}`,
      400
    )
  }

  const missing = endpoint.requiredParams.filter((param) => {
    const value = pathParams?.[param]
    return value == null || String(value).trim() === ""
  })

  if (missing.length) {
    throw new SportsDataIoError(
      "Parametros obrigatorios ausentes para endpoint de futebol.",
      "SPORTSDATA_MISSING_PARAMS",
      `missing=${missing.join(",")}`,
      400
    )
  }

  const baseUrl = String(options?.baseUrl || SOCCER_BASE_URL_DEFAULT).replace(/\/$/, "")
  const includeApiKeyQuery = Boolean(options?.includeApiKeyQuery)
  const apiKey = String(options?.apiKey || "").trim()
  const path = buildPathFromTemplate(endpoint.path, pathParams)
  const url = new URL(`${baseUrl}${path}`)

  const query = removeUndefinedValues(queryParams)
  for (const [key, value] of Object.entries(query)) {
    if (key === "key") continue
    url.searchParams.set(key, value)
  }

  if (includeApiKeyQuery && apiKey) {
    url.searchParams.set("key", apiKey)
  }

  return {
    endpointKey,
    endpoint,
    method: "GET",
    url
  }
}

export function createSportsDataIoFetch(env = process.env, fetchImpl = fetch) {
  const apiKey = String(env.SPORTSDATAIO_API_KEY || env.SPORTSDATA_IO_API_KEY || "").trim()
  const baseUrl = String(env.SPORTSDATAIO_API_BASE_URL || SOCCER_BASE_URL_DEFAULT)
  const includeApiKeyQuery = String(env.SPORTSDATAIO_INCLUDE_KEY_QUERY || "false").toLowerCase() === "true"

  return async function fetchSportsDataIo(endpointKey = "", pathParams = {}, queryParams = {}) {
    if (!apiKey) {
      throw new SportsDataIoError(
        "SPORTSDATAIO_API_KEY nao configurada.",
        "SPORTSDATA_KEY_MISSING",
        "Configure SPORTSDATAIO_API_KEY no ambiente.",
        503
      )
    }

    const request = buildSportsDataIoRequest(endpointKey, pathParams, queryParams, {
      apiKey,
      baseUrl,
      includeApiKeyQuery
    })

    const response = await fetchImpl(request.url, {
      method: "GET",
      headers: {
        ...buildRequestHeaders(),
        "Ocp-Apim-Subscription-Key": apiKey
      }
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new SportsDataIoError(
        "Falha ao consultar SportsDataIO.",
        "SPORTSDATA_REQUEST_FAILED",
        parseSportsDataIoErrorBody(body),
        response.status
      )
    }

    return response.json()
  }
}
