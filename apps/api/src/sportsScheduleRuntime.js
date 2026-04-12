// @ts-check

import {
  dedupeFixtures,
  isLiveFixtureStatus,
  isRecentFixtureCandidate,
  isUpcomingFixtureCandidate,
  normalizeFixtureEvent,
  sortUpcomingFixtures
} from "./sportsFixtures.js"

/** @typedef {import("../../../packages/ai-core/src/aiContracts").FixtureSourceLink} FixtureSourceLink */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").LiveFixtureEntry} LiveFixtureEntry */

const SPORTS_SEARCH_ALLOWED_HOSTS = [
  "ge.globo.com",
  "globoesporte.globo.com",
  "msn.com",
  "www.msn.com"
]

function normalizeLooseText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function hasFixtureLookupCue(question = "") {
  return /\b(proximo jogo|próximo jogo|quando joga|proximo confronto|próximo confronto|agenda esportiva|agenda de jogos|local do jogo|local da partida|horario do jogo|horario da partida|resultado do jogo|escalacao)\b/i.test(String(question || ""))
}

function hasFixtureSubjectCue(question = "") {
  return /\b(brasil|bahia|santos|sao paulo|argentina|botafogo|flamengo|palmeiras|corinthians|gremio|internacional|vasco|cruzeiro|time|clube|selecao)\b/i.test(normalizeLooseText(question))
}

export function isHistoryQuestion(question = "") {
  return /\b(historico|histórico|retrospecto|ultimos jogos|últimos jogos|ultimas partidas|últimas partidas|ultimos resultados|últimos resultados|jogos anteriores|resultados anteriores)\b/i.test(String(question || ""))
}

export function isNextFixtureQuestion(question = "") {
  if (/\b(?:responda|responde|retorne|diga)\s+(?:apenas|s[oó]|somente)\b/i.test(String(question || ""))) {
    return false
  }

  return hasFixtureLookupCue(question) && hasFixtureSubjectCue(question)
}

/**
 * @param {Record<string, unknown>} [event]
 * @returns {boolean}
 */
export function isSoccerEvent(event = {}) {
  const sport = normalizeLooseText(String(event?.strSport || event?.strSportAlternate || ""))
  return !sport || sport === "soccer"
}

/**
 * @param {Record<string, unknown>} [event]
 * @param {string[]} [teamTerms]
 * @returns {boolean}
 */
export function doesEventMatchTeam(event = {}, teamTerms = []) {
  const home = normalizeLooseText(String(event?.strHomeTeam || ""))
  const away = normalizeLooseText(String(event?.strAwayTeam || ""))
  if (!home && !away) return false

  return teamTerms.some((term) =>
    home === term ||
    away === term ||
    home.includes(term) ||
    away.includes(term)
  )
}

/**
 * @param {Record<string, unknown>} [team]
 * @returns {string[]}
 */
export function buildFixtureSeasonCandidates(team = {}) {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1
  const leagueFingerprint = [
    team?.strLeague,
    team?.strLeague2,
    team?.strLeague3,
    team?.strLeague4
  ]
    .map((value) => normalizeLooseText(String(value || "")))
    .join(" ")
  const country = normalizeLooseText(String(team?.strCountry || ""))

  const crossYearCompetition = /\b(premier league|championship|league one|league two|la liga|bundesliga|ligue 1|serie a(?! brasileira)|eredivisie|champions league|europa league|conference league|copa del rey|dfb pokal|taça de portugal)\b/.test(leagueFingerprint)
  const singleYearCompetition = /\b(brasileirao|brasileirao serie a|campeonato brasileiro|copa do brasil|libertadores|sudamericana|mls|copa america|copa américa|argentina|uruguay|uruguai|mexico|méxico|j league|j-league)\b/.test(leagueFingerprint)
    || /\b(brazil|argentina|uruguay|mexico|japan|usa|united states)\b/.test(country)

  const rollingSeason = month >= 7
    ? `${year}-${year + 1}`
    : `${year - 1}-${year}`
  const previousRollingSeason = month >= 7
    ? `${year - 1}-${year}`
    : `${year - 2}-${year - 1}`

  return [
    crossYearCompetition && !singleYearCompetition ? rollingSeason : String(year),
    crossYearCompetition && !singleYearCompetition ? previousRollingSeason : String(year - 1),
    rollingSeason,
    previousRollingSeason,
    String(year),
    String(year - 1)
  ].filter((value, index, array) => value && array.indexOf(value) === index)
}

/**
 * @param {Record<string, unknown>} [team]
 * @returns {string[]}
 */
export function collectLeagueIds(team = {}) {
  return [
    team?.idLeague,
    team?.idLeague2,
    team?.idLeague3,
    team?.idLeague4,
    team?.idLeague5,
    team?.idLeague6,
    team?.idLeague7
  ]
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
}

/**
 * @param {string} [leagueId]
 * @param {Record<string, unknown>} [team]
 * @param {string[]} [teamTerms]
 * @param {{ fetchSportsDbJson?: ((pathname: string, searchParams?: Record<string, string>) => Promise<Record<string, unknown> | null>) | null }} [options]
 * @returns {Promise<{ events: Record<string, unknown>[], season: string }>}
 */
export async function fetchSeasonFixturesForLeague(leagueId = "", team = {}, teamTerms = [], options = {}) {
  const fetchSportsDbJson = typeof options?.fetchSportsDbJson === "function" ? options.fetchSportsDbJson : null
  const normalizedLeagueId = String(leagueId || "").trim()
  if (!normalizedLeagueId || !fetchSportsDbJson) {
    return { events: [], season: "" }
  }

  const seasonCandidates = buildFixtureSeasonCandidates(team)
  for (const season of seasonCandidates) {
    const payload = await fetchSportsDbJson("eventsseason.php", { id: normalizedLeagueId, s: season }).catch(() => null)
    const events = Array.isArray(payload?.events) ? payload.events : []
    if (!events.length) continue

    const filtered = events
      .filter((event) => isSoccerEvent(event))
      .filter((event) => doesEventMatchTeam(event, teamTerms))

    if (filtered.length) {
      return { events: filtered, season }
    }
  }

  const fallbackPayload = await fetchSportsDbJson("eventsseason.php", { id: normalizedLeagueId }).catch(() => null)
  const fallbackEvents = Array.isArray(fallbackPayload?.events) ? fallbackPayload.events : []
  if (!fallbackEvents.length) {
    return { events: [], season: "" }
  }

  return {
    events: fallbackEvents
      .filter((event) => isSoccerEvent(event))
      .filter((event) => doesEventMatchTeam(event, teamTerms)),
    season: ""
  }
}

/**
 * @param {Record<string, unknown>} [team]
 * @param {string[]} [teamTerms]
 * @param {number} [referenceNowMs]
 * @param {{ fetchSportsDbJson?: ((pathname: string, searchParams?: Record<string, string>) => Promise<Record<string, unknown> | null>) | null }} [options]
 * @returns {Promise<{ nextMatches: LiveFixtureEntry[], recentMatches: LiveFixtureEntry[], liveMatches: LiveFixtureEntry[], usedSeasonSchedule: boolean }>}
 */
export async function fetchStructuredFixtureCollections(team = {}, teamTerms = [], referenceNowMs = Date.now(), options = {}) {
  const fetchSportsDbJson = typeof options?.fetchSportsDbJson === "function" ? options.fetchSportsDbJson : null
  const teamId = String(team?.idTeam || "").trim()
  if (!teamId || !fetchSportsDbJson) {
    return { nextMatches: [], recentMatches: [], liveMatches: [], usedSeasonSchedule: false }
  }

  const leagueIds = collectLeagueIds(team)
  const requests = [
    { key: "team_next", promise: fetchSportsDbJson("eventsnext.php", { id: teamId }) },
    { key: "team_last", promise: fetchSportsDbJson("eventslast.php", { id: teamId }) },
    ...leagueIds.flatMap((leagueId) => ([
      { key: `league_next:${leagueId}`, promise: fetchSportsDbJson("eventsnextleague.php", { id: leagueId }) },
      { key: `league_last:${leagueId}`, promise: fetchSportsDbJson("eventspastleague.php", { id: leagueId }) }
    ]))
  ]

  const seasonPayloads = []
  for (const leagueId of leagueIds.slice(0, 2)) {
    const seasonPayload = await fetchSeasonFixturesForLeague(leagueId, team, teamTerms, { fetchSportsDbJson }).catch(() => ({ events: [], season: "" }))
    if (Array.isArray(seasonPayload?.events) && seasonPayload.events.length > 0) {
      seasonPayloads.push(seasonPayload)
    }
  }

  const settled = await Promise.allSettled(requests.map((entry) => entry.promise))
  /** @type {LiveFixtureEntry[]} */
  const nextEvents = []
  /** @type {LiveFixtureEntry[]} */
  const recentEvents = []

  settled.forEach((result, index) => {
    if (result.status !== "fulfilled") return

    const key = requests[index]?.key || ""
    const events = Array.isArray(result.value?.events) ? result.value.events : []
    if (!events.length) return

    const filteredEvents = events
      .filter((event) => isSoccerEvent(event))
      .filter((event) => key.startsWith("league_") ? doesEventMatchTeam(event, teamTerms) : true)
      .map((event) => normalizeFixtureEvent(
        event,
        key.startsWith("league_") ? "thesportsdb_league" : "thesportsdb",
        referenceNowMs
      ))

    if (key.includes("_next")) {
      nextEvents.push(...filteredEvents)
    } else {
      recentEvents.push(...filteredEvents)
    }
  })

  const seasonEvents = dedupeFixtures(
    seasonPayloads
      .flatMap((payload) => Array.isArray(payload?.events) ? payload.events : [])
      .map((event) => normalizeFixtureEvent(event, "thesportsdb_season", referenceNowMs))
  )
  const liveMatches = seasonEvents
    .filter((entry) => isLiveFixtureStatus(entry.status))
    .sort(sortUpcomingFixtures)
  const seasonUpcoming = seasonEvents
    .filter((entry) => !isLiveFixtureStatus(entry.status))
    .filter((entry) => isUpcomingFixtureCandidate(entry, referenceNowMs))
  const seasonRecent = seasonEvents
    .filter((entry) => isRecentFixtureCandidate(entry, referenceNowMs))

  return {
    nextMatches: dedupeFixtures([...liveMatches, ...nextEvents, ...seasonUpcoming])
      .filter((entry) => isUpcomingFixtureCandidate(entry, referenceNowMs))
      .sort(sortUpcomingFixtures),
    recentMatches: dedupeFixtures([...recentEvents, ...seasonRecent])
      .filter((entry) => isRecentFixtureCandidate(entry, referenceNowMs))
      .sort((left, right) => (right.timestampMs || 0) - (left.timestampMs || 0))
      .slice(0, 8),
    liveMatches,
    usedSeasonSchedule: seasonEvents.length > 0
  }
}

export function buildSportsSearchQuery(teamName = "", question = "") {
  const wantsHistory = isHistoryQuestion(question)
  const wantsNext = isNextFixtureQuestion(question) || !wantsHistory
  const focus = [wantsNext ? "proximo jogo" : "", wantsHistory ? "ultimos jogos" : ""]
    .filter(Boolean)
    .join(" ")

  return `${teamName} ${focus} futebol ge globo msn`.trim()
}

/**
 * @param {string} [teamName]
 * @param {string} [question]
 * @param {{
 *   hasGoogleCustomSearchConfigured?: (() => boolean) | null;
 *   performGoogleCustomSearch?: ((query: string, options?: Record<string, unknown>) => Promise<{ items?: Array<Record<string, unknown>> }>) | null;
 *   safeUrlHostname?: ((value: string) => string) | null;
 * }} [options]
 * @returns {Promise<FixtureSourceLink[]>}
 */
export async function resolveSportsSourceLinks(teamName = "", question = "", options = {}) {
  const hasGoogleCustomSearchConfigured = typeof options?.hasGoogleCustomSearchConfigured === "function"
    ? options.hasGoogleCustomSearchConfigured
    : null
  const performGoogleCustomSearch = typeof options?.performGoogleCustomSearch === "function"
    ? options.performGoogleCustomSearch
    : null
  const safeUrlHostname = typeof options?.safeUrlHostname === "function"
    ? options.safeUrlHostname
    : (value) => value

  if (!hasGoogleCustomSearchConfigured || !performGoogleCustomSearch || hasGoogleCustomSearchConfigured() !== true) {
    return []
  }

  const searchQuery = buildSportsSearchQuery(teamName, question)
  if (!searchQuery) return []

  const payload = await performGoogleCustomSearch(searchQuery, {
    num: 6,
    hl: "pt-BR",
    gl: "br",
    allowedHosts: SPORTS_SEARCH_ALLOWED_HOSTS
  })

  const items = Array.isArray(payload?.items) ? payload.items : []
  return items.slice(0, 4).map((item) => ({
    title: String(item?.title || ""),
    link: String(item?.link || ""),
    source: String(item?.displayLink || safeUrlHostname(String(item?.link || "")))
  }))
}
