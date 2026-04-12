interface SportsAliasEntry {
  query: string
  aliases: string[]
  candidates?: string[]
  entityType?: string
  preferredCountry?: string
  geographyAmbiguous?: boolean
}

export interface TeamVisualProfile {
  name: string
  shortName: string
  badge: string
  stadium: string
  country: string
}

interface TeamLike extends Record<string, unknown> {
  idTeam?: string
  strTeam?: string
  strAlternate?: string
  strTeamShort?: string
  strKeywords?: string
  strCountry?: string
  strSport?: string
  strLeague?: string
  strBadge?: string
  strLogo?: string
  strStadium?: string
  __searchCandidate?: string
}

export interface ResolvedTeamContext {
  teamQuery: string
  aliasEntry: SportsAliasEntry | null
  team: TeamLike
  teamName: string
  teamTerms: string[]
}

interface ResolveTeamFromQuestionOptions {
  searchTeamsByQuery?: ((query: string) => Promise<TeamLike[]>) | null
}

interface ResolveTeamVisualProfileOptions {
  cache?: Map<string, TeamVisualProfile | null>
  fetchTeamsByQuery?: ((query: string) => Promise<TeamLike[]>) | null
}

interface EnrichFixturesWithVisualsOptions {
  resolveTeamVisualProfile?: ((teamName: string) => Promise<TeamVisualProfile | null>) | null
}

type FixtureLike = Record<string, unknown> & {
  id?: string | number
  homeTeam?: string
  awayTeam?: string
  homeBadge?: string | null
  awayBadge?: string | null
  homeShortName?: string
  awayShortName?: string
}

const TEAM_SEARCH_ALIASES: SportsAliasEntry[] = [
  { query: "Brazil", aliases: ["brasil", "selecao brasileira", "selecao do brasil", "selecao", "brazil"], candidates: ["Brazil", "Brazil National Team", "Brazil National Football Team", "Selecao Brasileira"], entityType: "national_team", preferredCountry: "Brazil", geographyAmbiguous: true },
  { query: "Argentina", aliases: ["argentina", "selecao argentina", "seleção argentina", "selecao da argentina", "seleção da argentina"], candidates: ["Argentina", "Argentina National Team", "Argentina National Football Team"], entityType: "national_team", preferredCountry: "Argentina" },
  { query: "Portugal", aliases: ["portugal", "selecao de portugal", "seleção de portugal", "selecao portuguesa", "seleção portuguesa"], candidates: ["Portugal", "Portugal National Team", "Portugal National Football Team"], entityType: "national_team", preferredCountry: "Portugal" },
  { query: "France", aliases: ["franca", "frança", "selecao da franca", "seleção da frança", "france"], candidates: ["France", "France National Team", "France National Football Team"], entityType: "national_team", preferredCountry: "France" },
  { query: "Spain", aliases: ["espanha", "selecao da espanha", "seleção da espanha", "spain"], candidates: ["Spain", "Spain National Team", "Spain National Football Team"], entityType: "national_team", preferredCountry: "Spain" },
  { query: "Germany", aliases: ["alemanha", "selecao da alemanha", "seleção da alemanha", "germany"], candidates: ["Germany", "Germany National Team", "Germany National Football Team"], entityType: "national_team", preferredCountry: "Germany" },
  { query: "England", aliases: ["inglaterra", "selecao da inglaterra", "seleção da inglaterra", "england"], candidates: ["England", "England National Team", "England National Football Team"], entityType: "national_team", preferredCountry: "England" },
  { query: "Italy", aliases: ["italia", "itália", "selecao da italia", "seleção da itália", "italy"], candidates: ["Italy", "Italy National Team", "Italy National Football Team"], entityType: "national_team", preferredCountry: "Italy" },
  { query: "Netherlands", aliases: ["holanda", "paises baixos", "países baixos", "netherlands", "selecao da holanda", "seleção da holanda"], candidates: ["Netherlands", "Netherlands National Team", "Netherlands National Football Team"], entityType: "national_team", preferredCountry: "Netherlands" },
  { query: "Uruguay", aliases: ["uruguai", "uruguay", "selecao do uruguai", "seleção do uruguai"], candidates: ["Uruguay", "Uruguay National Team", "Uruguay National Football Team"], entityType: "national_team", preferredCountry: "Uruguay" },
  { query: "Mexico", aliases: ["mexico", "méxico", "selecao do mexico", "seleção do méxico"], candidates: ["Mexico", "Mexico National Team", "Mexico National Football Team"], entityType: "national_team", preferredCountry: "Mexico" },
  { query: "United States", aliases: ["estados unidos", "eua", "usa", "selecao dos estados unidos", "seleção dos estados unidos"], candidates: ["United States", "USA", "United States National Team", "United States National Soccer Team"], entityType: "national_team", preferredCountry: "United States" },
  { query: "Flamengo", aliases: ["flamengo", "mengao", "mengão", "cr flamengo"], candidates: ["Flamengo", "CR Flamengo"], entityType: "club", preferredCountry: "Brazil" },
  { query: "Botafogo", aliases: ["botafogo", "fogao", "fogão", "botafogo fr", "botafogo rj"], candidates: ["Botafogo", "Botafogo RJ", "Botafogo FR"], entityType: "club", preferredCountry: "Brazil" },
  { query: "Palmeiras", aliases: ["palmeiras", "verdao", "verdão", "se palmeiras"], candidates: ["Palmeiras", "SE Palmeiras"], entityType: "club", preferredCountry: "Brazil" },
  { query: "Corinthians", aliases: ["corinthians", "timao", "timão", "sc corinthians paulista"], candidates: ["Corinthians", "SC Corinthians Paulista"], entityType: "club", preferredCountry: "Brazil" },
  { query: "Bahia", aliases: ["bahia", "ec bahia", "bahia ec", "esporte clube bahia"], candidates: ["Bahia", "EC Bahia", "Esporte Clube Bahia"], entityType: "club", preferredCountry: "Brazil", geographyAmbiguous: true },
  { query: "Sao Paulo", aliases: ["sao paulo", "são paulo", "sao paulo fc", "são paulo fc", "spfc"], candidates: ["Sao Paulo", "Sao Paulo FC", "Sao Paulo Futebol Clube"], entityType: "club", preferredCountry: "Brazil", geographyAmbiguous: true },
  { query: "Santos", aliases: ["santos", "santos fc", "santos futebol clube", "peixe"], candidates: ["Santos", "Santos FC", "Santos Futebol Clube"], entityType: "club", preferredCountry: "Brazil", geographyAmbiguous: true },
  { query: "Gremio", aliases: ["gremio", "grêmio", "gremio fbpa", "grêmio fbpa"], candidates: ["Gremio", "Gremio FBPA"], entityType: "club", preferredCountry: "Brazil" },
  { query: "Internacional", aliases: ["internacional", "inter", "sc internacional"], candidates: ["Internacional", "SC Internacional"], entityType: "club", preferredCountry: "Brazil" }
]

const TEAM_TERM_STOPWORDS = new Set(["a", "as", "clube", "club", "da", "das", "de", "do", "dos", "ec", "esporte", "fc", "futebol", "o", "os", "sc", "soccer"])
const defaultFixtureVisualCache = new Map<string, TeamVisualProfile | null>()

function normalizeLooseText(value = ""): string {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

function escapeRegExp(value = ""): string {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function toTitleCaseLabel(value = ""): string {
  return normalizeLooseText(value)
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function hasSportsContextCue(question = ""): boolean {
  return /\b(jogo|jogos|partida|partidas|placar|agenda(?: esportiva)?|confronto|campeonato|rodada|tabela|quando joga|proximo jogo|próximo jogo|proximos jogos|próximos jogos|historico|histórico|retrospecto|ultimos jogos|últimos jogos|ultimos resultados|últimos resultados|ultimo jogo|último jogo|horario|horário|estadio|estádio|ao vivo|futebol|ultimos 5|últimos 5)\b/i.test(String(question || ""))
}

function hasNationalTeamCue(question = ""): boolean {
  return /\b(selecao|seleção|national team|time nacional|pais|país)\b/i.test(String(question || ""))
}

function hasClubContextCue(question = ""): boolean {
  return /\b(clube|time|fc|ec|futebol clube|futebol club|saf)\b/i.test(String(question || ""))
}

function matchAliasInQuestion(question = "", alias = ""): boolean {
  const normalizedQuestion = normalizeLooseText(question).replace(/[^\w\s-]/g, " ")
  const normalizedAlias = normalizeLooseText(alias).replace(/[^\w\s-]/g, " ")
  if (!normalizedQuestion || !normalizedAlias) return false
  return new RegExp(`(^|\\s)${escapeRegExp(normalizedAlias)}(?=\\s|$)`, "i").test(normalizedQuestion)
}

function cleanSportsSubjectLabel(value = ""): string {
  const cleaned = normalizeLooseText(value)
    .replace(/\b(?:futebol|ao vivo|agora|hoje|amanha|amanhã|informacoes|informações|dados|detalhes|agenda|esportiva|historico|histórico|retrospecto|resultado|resultados|placar|horario|horário|local|estadio|estádio)\b/g, " ")
    .replace(/[?.,!:/\\|(){}\[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return cleaned ? toTitleCaseLabel(cleaned) : ""
}

function extractSportsSubjectPhrase(question = ""): string {
  const normalized = normalizeLooseText(question).replace(/\s+/g, " ").trim()
  if (!normalized) return ""

  const patterns = [
    /(?:quando joga(?: o| a)?|proximo(?:s)? jogo(?:s)?(?: do| da| de)?|próximo(?:s)? jogo(?:s)?(?: do| da| de)?|jogo(?:s)?(?: do| da| de)?|partida(?:s)?(?: do| da| de)?|historico(?: do| da| de)?|histórico(?: do| da| de)?|retrospecto(?: do| da| de)?|ultim(?:o|os|a|as)(?:\s+5)?\s+(?:jogo|jogos|partida|partidas|resultado|resultados)(?: do| da| de)?|placar(?: do| da| de)?|informacoes(?: do| da| de)?|informações(?: do| da| de)?|dados(?: do| da| de)?|detalhes(?: do| da| de)?)(.+)$/i,
    /(?:selecao|seleção)(?: nacional)?(?: do| da| de)?(.+)$/i,
    /(?:clube|time)(?: do| da| de)?(.+)$/i
  ]

  for (const pattern of patterns) {
    const captured = normalized.match(pattern)
    if (!captured?.[1]) continue
    const cleaned = cleanSportsSubjectLabel(captured[1])
    if (cleaned) return cleaned
  }

  return ""
}

export function looksLikeNationalTeam(team: TeamLike = {}): boolean {
  const fingerprint = [team?.strTeam, team?.strAlternate, team?.strKeywords, team?.strLeague]
    .map((value) => normalizeLooseText(value as string))
    .join(" ")

  return /\b(national|selecao|seleção)\b/.test(fingerprint)
}

function looksLikeYouthOrReserveTeam(team: TeamLike = {}): boolean {
  const fingerprint = [team?.strTeam, team?.strAlternate, team?.strKeywords]
    .map((value) => normalizeLooseText(value as string))
    .join(" ")

  return /\b(women|femin|femenino|u ?17|u ?20|u ?21|u ?23|sub ?17|sub ?20|sub ?23|reserves|reserve|ii|b team|under)\b/.test(fingerprint)
}

function sanitizeMediaUrl(value = ""): string {
  const url = String(value || "").trim()
  return /^https?:\/\//i.test(url) ? url : ""
}

export function extractTeamSearchQuery(question = ""): string | null {
  const directSubject = extractSportsSubjectPhrase(question)
  if (directSubject) {
    const directAlias = resolveTeamAliasEntry(directSubject)
    if (directAlias?.query) {
      return directAlias.query
    }

    const embeddedAlias = TEAM_SEARCH_ALIASES
      .flatMap((entry) => entry.aliases.map((alias) => ({ entry, alias })))
      .sort((left, right) => right.alias.length - left.alias.length)
      .find((candidate) => matchAliasInQuestion(directSubject, candidate.alias))

    return embeddedAlias?.entry?.query || directSubject
  }

  const sortedAliases = TEAM_SEARCH_ALIASES
    .flatMap((entry) => entry.aliases.map((alias) => ({ entry, alias })))
    .sort((left, right) => right.alias.length - left.alias.length)

  const hasSportsCue = hasSportsContextCue(question)
  const hasClubCue = hasClubContextCue(question)
  const hasSelectionCue = hasNationalTeamCue(question)

  for (const candidate of sortedAliases) {
    if (!matchAliasInQuestion(question, candidate.alias)) continue
    if (candidate.entry.geographyAmbiguous && !hasSportsCue && !hasClubCue && !hasSelectionCue) continue
    return candidate.entry.query
  }

  return null
}

export function resolveTeamAliasEntry(teamQuery = ""): SportsAliasEntry | null {
  const normalizedQuery = normalizeLooseText(teamQuery)
  if (!normalizedQuery) return null

  return TEAM_SEARCH_ALIASES.find((entry) => (
    normalizeLooseText(entry.query) === normalizedQuery ||
    entry.aliases.some((alias) => normalizeLooseText(alias) === normalizedQuery)
  )) || null
}

export function resolveTeamQueryCandidates(teamQuery = ""): string[] {
  const normalizedQuery = normalizeLooseText(teamQuery)
  if (!normalizedQuery) return []

  const aliasEntry = resolveTeamAliasEntry(teamQuery)
  const candidates = [teamQuery, aliasEntry?.query, ...(Array.isArray(aliasEntry?.candidates) ? aliasEntry.candidates : [])]
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)

  return candidates.filter((value, index, array) =>
    array.findIndex((candidate) => normalizeLooseText(candidate) === normalizeLooseText(value)) === index
  )
}

export function scoreTeamMatch(team: TeamLike = {}, query = "", options: { aliasEntry?: SportsAliasEntry | null, question?: string } = {}): number {
  const normalizedQuery = normalizeLooseText(query)
  const teamName = normalizeLooseText(String(team?.strTeam || ""))
  const alternateName = normalizeLooseText(String(team?.strAlternate || ""))
  const shortName = normalizeLooseText(String(team?.strTeamShort || ""))
  const keywords = normalizeLooseText(String(team?.strKeywords || ""))
  const country = normalizeLooseText(String(team?.strCountry || ""))
  const sport = normalizeLooseText(String(team?.strSport || ""))
  const searchCandidate = normalizeLooseText(String(team?.__searchCandidate || ""))
  const aliasEntry = options.aliasEntry || resolveTeamAliasEntry(query)
  const nationalTeam = looksLikeNationalTeam(team)
  const youthOrReserve = looksLikeYouthOrReserveTeam(team)
  const nationalTeamCue = hasNationalTeamCue(options.question || "")
  const clubCue = hasClubContextCue(options.question || "")
  const normalizedQuestion = normalizeLooseText(options.question || "")

  let score = 0
  if (sport === "soccer") score += 8
  if (teamName === normalizedQuery) score += 16
  if (alternateName === normalizedQuery) score += 14
  if (shortName === normalizedQuery) score += 12
  if (searchCandidate && searchCandidate === teamName) score += 8
  if (searchCandidate && searchCandidate === alternateName) score += 6
  if (keywords.includes(normalizedQuery)) score += 4
  if (teamName.includes(normalizedQuery)) score += 6
  if (alternateName.includes(normalizedQuery)) score += 5
  if (shortName.includes(normalizedQuery)) score += 4
  if (aliasEntry?.preferredCountry && normalizeLooseText(aliasEntry.preferredCountry) === country) score += 8
  if (aliasEntry?.preferredCountry && normalizeLooseText(aliasEntry.preferredCountry) !== country) score -= 3
  if (aliasEntry?.entityType === "national_team" && nationalTeam) score += 16
  if (aliasEntry?.entityType === "club" && !nationalTeam) score += 8
  if (nationalTeamCue && nationalTeam) score += 14
  if (nationalTeamCue && !nationalTeam) score -= 12
  if (clubCue && nationalTeam) score -= 10
  if (!clubCue && !nationalTeamCue && aliasEntry?.entityType === "club" && nationalTeam) score -= 8
  if (!clubCue && !nationalTeamCue && aliasEntry?.entityType === "national_team" && !nationalTeam) score -= 6
  if (normalizedQuery === "brazil" && country === "brazil") score += 6
  if (youthOrReserve && !/\b(sub|u ?17|u ?20|u ?21|u ?23|women|femin|reserva|reserve|b team|ii)\b/.test(normalizedQuestion)) score -= 14
  return score
}

export function extractTeamTerms(team: TeamLike = {}, query = ""): string[] {
  const values = [team?.strTeam, team?.strAlternate, team?.strTeamShort, team?.strKeywords, query]
  const terms = new Set<string>()

  for (const value of values) {
    const normalized = normalizeLooseText(value as string).replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim()
    if (!normalized) continue
    if (normalized.length >= 3) terms.add(normalized)

    normalized
      .split(" ")
      .map((part) => part.trim())
      .filter((part) => part.length >= 3 && !TEAM_TERM_STOPWORDS.has(part))
      .forEach((part) => terms.add(part))
  }

  return Array.from(terms).sort((left, right) => right.length - left.length)
}

export async function resolveTeamFromQuestion(question = "", options: ResolveTeamFromQuestionOptions = {}): Promise<ResolvedTeamContext | null> {
  const searchTeamsByQuery = typeof options?.searchTeamsByQuery === "function" ? options.searchTeamsByQuery : null
  const teamQuery = extractTeamSearchQuery(question)
  if (!teamQuery || !searchTeamsByQuery) return null

  const aliasEntry = resolveTeamAliasEntry(teamQuery)
  const queryCandidates = resolveTeamQueryCandidates(teamQuery)
  const collectedTeams: TeamLike[] = []

  for (const queryCandidate of queryCandidates) {
    const teams = await searchTeamsByQuery(queryCandidate).catch(() => [])
    if (!Array.isArray(teams) || !teams.length) continue

    collectedTeams.push(
      ...teams.map((entry) => ({
        ...entry,
        __searchCandidate: queryCandidate
      }))
    )
  }

  const teams = collectedTeams.filter((entry, index, array) => (
    array.findIndex((candidate) => String(candidate?.idTeam || "") === String(entry?.idTeam || "")) === index
  ))
  if (!teams.length) return null

  const team = teams
    .map((entry) => ({ entry, score: scoreTeamMatch(entry, teamQuery, { question, aliasEntry }) }))
    .sort((left, right) => right.score - left.score)[0]?.entry

  if (!team?.idTeam) return null

  return {
    teamQuery,
    aliasEntry,
    team,
    teamName: String(team?.strTeam || teamQuery),
    teamTerms: extractTeamTerms(team, teamQuery)
  }
}

export function buildResolvedTeamVisualProfile(team: TeamLike = {}): TeamVisualProfile {
  return {
    name: String(team?.strTeam || "").trim(),
    shortName: String(team?.strTeamShort || team?.strTeam || "").trim(),
    badge: sanitizeMediaUrl(String(team?.strBadge || team?.strLogo || "")),
    stadium: String(team?.strStadium || "").trim(),
    country: String(team?.strCountry || "").trim()
  }
}

export async function resolveTeamVisualProfile(teamName = "", options: ResolveTeamVisualProfileOptions = {}): Promise<TeamVisualProfile | null> {
  const normalizedName = normalizeLooseText(teamName)
  const cache = options?.cache instanceof Map ? options.cache : defaultFixtureVisualCache
  const fetchTeamsByQuery = typeof options?.fetchTeamsByQuery === "function" ? options.fetchTeamsByQuery : null
  if (!normalizedName || !fetchTeamsByQuery) return null

  if (cache.has(normalizedName)) {
    return cache.get(normalizedName) || null
  }

  const teams = await fetchTeamsByQuery(teamName).catch(() => [])
  if (!Array.isArray(teams) || !teams.length) {
    cache.set(normalizedName, null)
    return null
  }

  const aliasEntry = resolveTeamAliasEntry(teamName)
  const team = teams
    .map((entry) => ({ entry, score: scoreTeamMatch(entry, teamName, { aliasEntry, question: `time ${teamName}` }) }))
    .sort((left, right) => right.score - left.score)[0]?.entry

  if (!team) {
    cache.set(normalizedName, null)
    return null
  }

  const profile = buildResolvedTeamVisualProfile(team)
  cache.set(normalizedName, profile)
  return profile
}

export async function enrichFixturesWithVisuals(
  fixtures: FixtureLike[] = [],
  resolvedTeam: ResolvedTeamContext | null = null,
  options: EnrichFixturesWithVisualsOptions = {}
): Promise<FixtureLike[]> {
  const resolveVisualProfile = typeof options?.resolveTeamVisualProfile === "function" ? options.resolveTeamVisualProfile : null
  const resolvedProfile = resolvedTeam?.team ? buildResolvedTeamVisualProfile(resolvedTeam.team) : null
  const visualMap = new Map<string, TeamVisualProfile>()

  if (resolvedProfile?.name) {
    const knownTeamLabels = [
      resolvedTeam?.teamName,
      resolvedTeam?.team?.strTeam,
      resolvedTeam?.team?.strAlternate,
      resolvedTeam?.team?.strTeamShort
    ]
      .map((entry) => normalizeLooseText(String(entry || "")))
      .filter(Boolean)

    for (const label of knownTeamLabels) {
      visualMap.set(label, resolvedProfile)
    }
  }

  const teamNames = fixtures
    .flatMap((fixture) => [fixture?.homeTeam, fixture?.awayTeam])
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)

  if (resolveVisualProfile) {
    for (const teamName of teamNames) {
      const normalizedName = normalizeLooseText(teamName)
      if (!normalizedName || visualMap.has(normalizedName)) continue
      const profile = await resolveVisualProfile(teamName)
      if (profile) {
        visualMap.set(normalizedName, profile)
      }
    }
  }

  return fixtures.map((fixture) => {
    const homeProfile = visualMap.get(normalizeLooseText(String(fixture?.homeTeam || "")))
    const awayProfile = visualMap.get(normalizeLooseText(String(fixture?.awayTeam || "")))

    return {
      ...fixture,
      homeBadge: homeProfile?.badge || null,
      awayBadge: awayProfile?.badge || null,
      homeShortName: homeProfile?.shortName || fixture?.homeTeam || "",
      awayShortName: awayProfile?.shortName || fixture?.awayTeam || ""
    }
  })
}
