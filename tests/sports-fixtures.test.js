import test from "node:test"
import assert from "node:assert/strict"

import {
  buildFixtureVerification,
  dedupeFixtures,
  formatFixtureDateLabel,
  formatFixtureKickoff,
  isLiveFixtureStatus,
  isRecentFixtureCandidate,
  isUpcomingFixtureCandidate,
  normalizeFixtureEvent,
  normalizeFixtureStatus,
  sortUpcomingFixtures
} from "../apps/api/src/sportsFixtures.js"

const REFERENCE_NOW_MS = Date.parse("2026-03-29T15:00:00.000Z")

test("sports fixture formatters and status normalization stay stable", () => {
  const dateLabel = formatFixtureDateLabel("2026-03-29", "18:30")
  assert.match(dateLabel, /29/i)
  assert.match(dateLabel, /mar/i)
  assert.equal(formatFixtureKickoff("2026-03-29", "18:30"), "18:30")

  assert.equal(normalizeFixtureStatus("Match Finished"), "encerrado")
  assert.equal(normalizeFixtureStatus("LIVE"), "ao vivo")
  assert.equal(normalizeFixtureStatus("Postponed"), "adiado")
  assert.equal(normalizeFixtureStatus("Scheduled"), "agendado")
  assert.equal(
    normalizeFixtureStatus(
      "",
      Date.parse("2026-03-29T06:00:00.000Z"),
      true,
      REFERENCE_NOW_MS
    ),
    "encerrado"
  )
})

test("sports fixture normalization preserves provider metadata", () => {
  const fixture = normalizeFixtureEvent({
    idEvent: "fixture-1",
    strLeague: "Brasileirao",
    strHomeTeam: "Goias",
    strAwayTeam: "Vila Nova",
    intHomeScore: "2",
    intAwayScore: "1",
    dateEvent: "2026-03-29",
    strTime: "18:30",
    strStatus: "Scheduled",
    strVenue: "Serrinha"
  }, "thesportsdb_league", REFERENCE_NOW_MS)

  assert.equal(fixture.id, "fixture-1")
  assert.equal(fixture.provider, "thesportsdb_league")
  assert.equal(fixture.homeTeam, "Goias")
  assert.equal(fixture.awayTeam, "Vila Nova")
  assert.equal(fixture.homeScore, 2)
  assert.equal(fixture.awayScore, 1)
  assert.equal(fixture.status, "agendado")
  assert.equal(fixture.kickoff, "18:30")
  assert.equal(fixture.venue, "Serrinha")
  assert.equal(fixture.timeAuthority, "provider_local")
  assert.match(fixture.summary, /Goias x Vila Nova/)
  assert.match(fixture.summary, /Brasileirao/)
})

test("sports fixture candidate filters separate live upcoming and recent matches", () => {
  const liveFixture = {
    id: "live",
    status: "ao vivo",
    timestampMs: REFERENCE_NOW_MS - (30 * 60 * 1000)
  }
  const upcomingFixture = {
    id: "upcoming",
    status: "agendado",
    timestampMs: REFERENCE_NOW_MS + (2 * 60 * 60 * 1000)
  }
  const recentFixture = {
    id: "recent",
    status: "encerrado",
    timestampMs: REFERENCE_NOW_MS - (8 * 60 * 60 * 1000)
  }

  assert.equal(isLiveFixtureStatus(liveFixture.status), true)
  assert.equal(isUpcomingFixtureCandidate(liveFixture, REFERENCE_NOW_MS), true)
  assert.equal(isUpcomingFixtureCandidate(upcomingFixture, REFERENCE_NOW_MS), true)
  assert.equal(isUpcomingFixtureCandidate(recentFixture, REFERENCE_NOW_MS), false)

  assert.equal(isRecentFixtureCandidate(liveFixture, REFERENCE_NOW_MS), false)
  assert.equal(isRecentFixtureCandidate(upcomingFixture, REFERENCE_NOW_MS), false)
  assert.equal(isRecentFixtureCandidate(recentFixture, REFERENCE_NOW_MS), true)
})

test("sports fixture sorting and dedupe remain deterministic", () => {
  const fixtures = [
    { id: "future", status: "agendado", timestampMs: REFERENCE_NOW_MS + 7200000 },
    { id: "live", status: "ao vivo", timestampMs: REFERENCE_NOW_MS - 600000 },
    { id: "future-late", status: "agendado", timestampMs: REFERENCE_NOW_MS + 10800000 }
  ]

  fixtures.sort(sortUpcomingFixtures)
  assert.deepEqual(fixtures.map((entry) => entry.id), ["live", "future", "future-late"])

  const deduped = dedupeFixtures([
    { id: "a", summary: "A" },
    { id: "a", summary: "A duplicado" },
    { summary: "sem-id" },
    { summary: "sem-id" }
  ])
  assert.deepEqual(deduped, [
    { id: "a", summary: "A" },
    { summary: "sem-id" }
  ])
})

test("sports fixture verification reflects data confidence", () => {
  const verification = buildFixtureVerification({
    nextMatches: [{ id: "next-1" }],
    recentMatches: [{ id: "recent-1" }],
    liveMatches: [{ id: "live-1" }],
    sourceLinks: [{ link: "https://example.com/game" }],
    usedSeasonSchedule: true,
    referenceClock: {
      nowMs: REFERENCE_NOW_MS,
      unixTime: Math.trunc(REFERENCE_NOW_MS / 1000),
      utcIso: "2026-03-29T15:00:00.000Z",
      localIso: "2026-03-29T12:00:00.000-03:00",
      timezone: "America/Sao_Paulo",
      utcOffset: "-03:00",
      source: "worldtimeapi",
      verified: true,
      fetchedAt: "2026-03-29T15:00:01.000Z"
    }
  })

  assert.equal(verification.status, "checked")
  assert.equal(verification.label, "dados conferidos")
  assert.equal(verification.checkedAt, "2026-03-29T15:00:00.000Z")
  assert.match(verification.note, /Calendario completo da temporada consultado/i)
  assert.match(verification.note, /Jogo em andamento identificado/i)
  assert.match(verification.note, /Horario UTC conferido/i)
  assert.deepEqual(verification.providerChain, [
    "TheSportsDB",
    "TheSportsDB season schedule",
    "WorldTimeAPI",
    "Google Custom Search"
  ])
})
