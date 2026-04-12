import type { FixtureSourceLink, LiveFixtureEntry } from "../../../packages/ai-core/src/aiContracts.js"
import {
  dedupeFixtures,
  isLiveFixtureStatus,
  isRecentFixtureCandidate,
  isUpcomingFixtureCandidate,
  normalizeFixtureEvent,
  sortUpcomingFixtures
} from "./sportsFixtures.js"

interface TeamLike extends Record<string, unknown> {
  idTeam?: string
  strLeague?: string
  strLeague2?: string
  strLeague3?: string
  strLeague4?: string
  strCountry?: string
  idLeague?: string
  idLeague2?: string
  idLeague3?: string
  idLeague4?: string
  idLeague5?: string
  idLeague6?: string
  idLeague7?: string
}

interface EventLike extends Record<string, unknown> {
  strSport?: string
  strSportAlternate?: string
  strHomeTeam?: string
  strAwayTeam?: string
}

type SportsDbFetch = (pathname: string, searchParams?: Record<string, string>) => Promise<Record<string, unknown> | null>

interface FetchSeasonFixturesOptions {
  fetchSportsDbJson?: SportsDbFetch | null
}

interface StructuredCollectionsOptions {
  fetchSportsDbJson?: SportsDbFetch | null
}

interface ResolveSourceLinksOptions {
  hasGoogleCustomSearchConfigured?: (() => boolean) | null
  performGoogleCustomSearch?: ((query: string, options?: Record<string, unknown>) => Promise<{ items?: Array<Record<string, unknown>> }>) | null
  safeUrlHostname?: ((value: string) => string) | null
}

const SPORTS_SEARCH_ALLOWED_HOSTS = [
  "ge.globo.com",
  "globoesporte.globo.com",
  "msn.com",
  "www.msn.com"
]

function normalizeLooseText(value = ""): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function hasFixtureLookupCue(question = ""): boolean {
  return /\b(proximo jogo|próximo jogo|quando joga|proximo confronto|próximo confronto|agenda esportiva|agenda de jogos|local do jogo|local da partida|horario do jogo|horario da partida|resultado do jogo|escalacao)\b/i.test(String(question || ""))
}

function hasFixtureSubjectCue(question = ""): boolean {
  return /\b(brasil|bahia|santos|sao paulo|argentina|botafogo|flamengo|palmeiras|corinthians|gremio|internacional|vasco|cruzeiro|time|clube|selecao)\b/i.test(normalizeLooseText(question))
}

export function isHistoryQuestion(question = ""): boolean {
  return /\b(historico|histórico|retrospecto|ultimos jogos|últimos jogos|ultimas partidas|últimas partidas|ultimos resultados|últimos resultados|jogos anteriores|resultados anteriores)\b/i.test(String(question || ""))
}

export function isNextFixtureQuestion(question = ""): boolean {
  if (/\b(?:responda|responde|retorne|diga)\s+(?:apenas|s[oó]|somente)\b/i.test(String(question || ""))) {
    return false
  }

  return hasFixtureLookupCue(question) && hasFixtureSubjectCue(question)
}

export function isSoccerEvent(event: EventLike = {}): boolean {
  const sport = normalizeLooseText(String(event?.strSport || event?.strSportAlternate || ""))
  return !sport || sport === "soccer"
}

export function doesEventMatchTeam(event: EventLike = {}, teamTerms: string[] = []): boolean {
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

export function buildFixtureSeasonCandidates(team: TeamLike = {}): string[] {
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

export function collectLeagueIds(team: TeamLike = {}): string[] {
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

export async function fetchSeasonFixturesForLeague(
  leagueId = "",
  team: TeamLike = {},
  teamTerms: string[] = [],
  options: FetchSeasonFixturesOptions = {}
): Promise<{ events: EventLike[], season: string }> {
  const fetchSportsDbJson = typeof options?.fetchSportsDbJson === "function" ? options.fetchSportsDbJson : null
  const normalizedLeagueId = String(leagueId || "").trim()
  if (!normalizedLeagueId || !fetchSportsDbJson) {
    return { events: [], season: "" }
  }

  const seasonCandidates = buildFixtureSeasonCandidates(team)
  for (const season of seasonCandidates) {
    const payload = await fetchSportsDbJson("eventsseason.php", { id: normalizedLeagueId, s: season }).catch(() => null)
    const events = Array.isArray(payload?.events) ? (payload.events as EventLike[]) : []
    if (!events.length) continue

    const filtered = events
      .filter((event) => isSoccerEvent(event))
      .filter((event) => doesEventMatchTeam(event, teamTerms))

    if (filtered.length) {
      return { events: filtered, season }
    }
  }

  const fallbackPayload = await fetchSportsDbJson("eventsseason.php", { id: normalizedLeagueId }).catch(() => null)
  const fallbackEvents = Array.isArray(fallbackPayload?.events) ? (fallbackPayload.events as EventLike[]) : []
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

export async function fetchStructuredFixtureCollections(
  team: TeamLike = {},
  teamTerms: string[] = [],
  referenceNowMs = Date.now(),
  options: StructuredCollectionsOptions = {}
): Promise<{ nextMatches: LiveFixtureEntry[], recentMatches: LiveFixtureEntry[], liveMatches: LiveFixtureEntry[], usedSeasonSchedule: boolean }> {
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

  const seasonPayloads: Array<{ events: EventLike[], season: string }> = []
  for (const leagueId of leagueIds.slice(0, 2)) {
    const seasonPayload = await fetchSeasonFixturesForLeague(leagueId, team, teamTerms, { fetchSportsDbJson }).catch(() => ({ events: [], season: "" }))
    if (Array.isArray(seasonPayload?.events) && seasonPayload.events.length > 0) {
      seasonPayloads.push(seasonPayload)
    }
  }

  const settled = await Promise.allSettled(requests.map((entry) => entry.promise))
  const nextEvents: LiveFixtureEntry[] = []
  const recentEvents: LiveFixtureEntry[] = []

  settled.forEach((result, index) => {
    if (result.status !== "fulfilled") return

    const key = requests[index]?.key || ""
    const events = Array.isArray(result.value?.events) ? (result.value.events as EventLike[]) : []
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
    .filter((entry) => isLiveFixtureStatus(String(entry.status || "")))
    .sort(sortUpcomingFixtures)
  const seasonUpcoming = seasonEvents
    .filter((entry) => !isLiveFixtureStatus(String(entry.status || "")))
    .filter((entry) => isUpcomingFixtureCandidate(entry, referenceNowMs))
  const seasonRecent = seasonEvents
    .filter((entry) => isRecentFixtureCandidate(entry, referenceNowMs))

  return {
    nextMatches: dedupeFixtures([...liveMatches, ...nextEvents, ...seasonUpcoming])
      .filter((entry) => isUpcomingFixtureCandidate(entry, referenceNowMs))
      .sort(sortUpcomingFixtures),
    recentMatches: dedupeFixtures([...recentEvents, ...seasonRecent])
      .filter((entry) => isRecentFixtureCandidate(entry, referenceNowMs))
      .sort((left, right) => (Number(right.timestampMs || 0) - Number(left.timestampMs || 0)))
      .slice(0, 8),
    liveMatches,
    usedSeasonSchedule: seasonEvents.length > 0
  }
}

export function buildSportsSearchQuery(teamName = "", question = ""): string {
  const wantsHistory = isHistoryQuestion(question)
  const wantsNext = isNextFixtureQuestion(question) || !wantsHistory
  const focus = [wantsNext ? "proximo jogo" : "", wantsHistory ? "ultimos jogos" : ""]
    .filter(Boolean)
    .join(" ")

  return `${teamName} ${focus} futebol ge globo msn`.trim()
}

export async function resolveSportsSourceLinks(teamName = "", question = "", options: ResolveSourceLinksOptions = {}): Promise<FixtureSourceLink[]> {
  const hasGoogleCustomSearchConfigured = typeof options?.hasGoogleCustomSearchConfigured === "function"
    ? options.hasGoogleCustomSearchConfigured
    : null
  const performGoogleCustomSearch = typeof options?.performGoogleCustomSearch === "function"
    ? options.performGoogleCustomSearch
    : null
  const safeUrlHostname = typeof options?.safeUrlHostname === "function"
    ? options.safeUrlHostname
    : (value: string) => value

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
