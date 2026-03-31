import type {
  LiveFixtureEntry,
  LiveFixtureSummary,
  LiveResearchRuntime
} from "../../../packages/ai-core/src/aiContracts.js"
import { buildClockVerificationMeta, getVerifiedRuntimeClock } from "./runtimeClock.js"
import {
  buildFixtureVerification as runtimeBuildFixtureVerification,
  dedupeFixtures as runtimeDedupeFixtures
} from "./sportsFixtures.js"
import {
  buildResolvedTeamVisualProfile as runtimeBuildResolvedTeamVisualProfile,
  enrichFixturesWithVisuals as runtimeEnrichFixturesWithVisuals,
  looksLikeNationalTeam as runtimeLooksLikeNationalTeam,
  resolveTeamFromQuestion as runtimeResolveTeamFromQuestion,
  resolveTeamVisualProfile as runtimeResolveTeamVisualProfile
} from "./sportsTeamsRuntime.js"
import {
  fetchStructuredFixtureCollections as runtimeFetchStructuredFixtureCollections,
  isHistoryQuestion,
  isNextFixtureQuestion,
  resolveSportsSourceLinks as runtimeResolveSportsSourceLinks
} from "./sportsScheduleRuntime.js"
import {
  hasGoogleCustomSearchConfigured,
  performGoogleCustomSearch,
  resolveApproximateLocationByIp,
  safeUrlHostname,
  summarizeGoogleSearchResults
} from "./liveWebRuntime.js"
import { createSportsDbFetch } from "./sportsDbClient.js"

const fixtureVisualCache = new Map()

export { hasGoogleCustomSearchConfigured, performGoogleCustomSearch, resolveApproximateLocationByIp, summarizeGoogleSearchResults }

export function getLiveResearchRuntime(): LiveResearchRuntime {
  return {
    googleSearch: hasGoogleCustomSearchConfigured(),
    googleImageSearch: hasGoogleCustomSearchConfigured(),
    liveWeb: hasGoogleCustomSearchConfigured(),
    ipGeolocation: true,
    sportsSchedule: true,
    sportsProvider: "thesportsdb_verified"
  }
}

export async function resolveNextFixtureFromQuestion(question = ""): Promise<LiveFixtureSummary | null> {
  const fetchSportsDbJson = createSportsDbFetch()
  const searchTeamsByQuery = async (query: string) => {
    const payload = await fetchSportsDbJson("searchteams.php", { t: query }).catch(() => null)
    return Array.isArray(payload?.teams) ? payload.teams as Array<Record<string, unknown>> : []
  }
  const resolvedTeam = await runtimeResolveTeamFromQuestion(question, { searchTeamsByQuery })
  if (!resolvedTeam) return null

  const wantsHistory = isHistoryQuestion(question)
  const wantsNext = isNextFixtureQuestion(question) || !wantsHistory
  const referenceClock = await getVerifiedRuntimeClock("Etc/UTC")
  const referenceNowMs = referenceClock.nowMs
  const structured = await runtimeFetchStructuredFixtureCollections(
    resolvedTeam.team,
    resolvedTeam.teamTerms,
    referenceNowMs,
    {
      fetchSportsDbJson
    }
  )
  const sourceLinks = await runtimeResolveSportsSourceLinks(resolvedTeam.teamName, question, {
    hasGoogleCustomSearchConfigured,
    performGoogleCustomSearch,
    safeUrlHostname
  }).catch(() => [])

  let nextMatches: LiveFixtureEntry[] = structured.nextMatches.slice(0, 6)
  let recentMatches: LiveFixtureEntry[] = structured.recentMatches.slice(0, 5)
  let liveMatches: LiveFixtureEntry[] = Array.isArray(structured.liveMatches) ? structured.liveMatches.slice(0, 2) : []
  const visualizedFixtures = await runtimeEnrichFixturesWithVisuals(
    runtimeDedupeFixtures([...liveMatches, ...nextMatches, ...recentMatches]),
    resolvedTeam,
    {
      resolveTeamVisualProfile: async (teamName) => runtimeResolveTeamVisualProfile(teamName, {
        cache: fixtureVisualCache,
        fetchTeamsByQuery: searchTeamsByQuery
      })
    }
  )
  const visualMap = new Map(visualizedFixtures.map((entry) => [String(entry?.id || ""), entry]))
  nextMatches = nextMatches.map((entry) => visualMap.get(String(entry?.id || "")) || entry)
  recentMatches = recentMatches.map((entry) => visualMap.get(String(entry?.id || "")) || entry)
  liveMatches = liveMatches.map((entry) => visualMap.get(String(entry?.id || "")) || entry)

  const nextMatch = liveMatches[0] || nextMatches[0] || null

  if (!nextMatch && !recentMatches.length && !sourceLinks.length) {
    return null
  }

  const verification = runtimeBuildFixtureVerification({
    nextMatches,
    recentMatches,
    liveMatches,
    sourceLinks,
    usedSeasonSchedule: structured.usedSeasonSchedule,
    referenceClock
  })
  const teamProfile = runtimeBuildResolvedTeamVisualProfile(resolvedTeam.team)

  const fallbackLeague = String(
    nextMatch?.league ||
    recentMatches[0]?.league ||
    resolvedTeam.team?.strLeague ||
    resolvedTeam.team?.strLeague2 ||
    "Agenda esportiva"
  )

  const noteParts: string[] = []
  if (nextMatch?.venue) {
    noteParts.push(`Local: ${nextMatch.venue}.`)
  }
  if (!nextMatch && wantsNext) {
    noteParts.push("Nao encontrei um proximo confronto confirmado nesta fonte estruturada agora.")
  }
  if (recentMatches.length) {
    noteParts.push(`Historico recente disponivel com ${recentMatches.length} partida${recentMatches.length > 1 ? "s" : ""}.`)
  }

  return {
    provider: sourceLinks.length ? "thesportsdb_verified_hybrid" : "thesportsdb_verified",
    teamQuery: resolvedTeam.teamQuery,
    teamName: resolvedTeam.teamName,
    subjectType: runtimeLooksLikeNationalTeam(resolvedTeam.team) ? "national_team" : "club",
    league: fallbackLeague,
    homeTeam: nextMatch?.homeTeam || resolvedTeam.teamName,
    awayTeam: nextMatch?.awayTeam || "",
    homeScore: nextMatch?.homeScore ?? null,
    awayScore: nextMatch?.awayScore ?? null,
    homeBadge: nextMatch?.homeBadge || null,
    awayBadge: nextMatch?.awayBadge || null,
    kickoff: nextMatch?.kickoff || "--:--",
    dateLabel: nextMatch?.dateLabel || "Em breve",
    status: nextMatch?.status || (wantsHistory ? "historico" : "sem confirmacao"),
    venue: nextMatch?.venue || "",
    teamBadge: teamProfile.badge || null,
    teamCountry: teamProfile.country || "",
    teamVenue: teamProfile.stadium || "",
    summary: [nextMatch?.summary, ...noteParts].filter(Boolean).join(" ").trim(),
    nextMatches,
    recentMatches,
    liveMatches,
    verification,
    timeVerification: buildClockVerificationMeta(referenceClock),
    sourceLinks,
    hasUpcomingFixture: liveMatches.length > 0 || nextMatches.length > 0,
    wantsHistory,
    wantsNext
  }
}
