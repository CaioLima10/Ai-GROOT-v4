import test from "node:test"
import assert from "node:assert/strict"

import {
  buildFixtureSeasonCandidates,
  buildSportsSearchQuery,
  collectLeagueIds,
  doesEventMatchTeam,
  fetchSeasonFixturesForLeague,
  fetchStructuredFixtureCollections,
  isSoccerEvent,
  resolveSportsSourceLinks
} from "../apps/api/src/sportsScheduleRuntime.js"

const REFERENCE_NOW_MS = Date.parse("2026-03-29T15:00:00.000Z")

test("sports schedule helpers keep sport and team filtering predictable", () => {
  assert.equal(isSoccerEvent({ strSport: "Soccer" }), true)
  assert.equal(isSoccerEvent({ strSport: "Basketball" }), false)
  assert.equal(
    doesEventMatchTeam({ strHomeTeam: "EC Bahia", strAwayTeam: "Santos FC" }, ["bahia", "esporte clube bahia"]),
    true
  )
  assert.equal(
    doesEventMatchTeam({ strHomeTeam: "Flamengo", strAwayTeam: "Palmeiras" }, ["bahia"]),
    false
  )
  assert.deepEqual(
    collectLeagueIds({ idLeague: "100", idLeague2: "100", idLeague3: "200", idLeague4: "" }),
    ["100", "200"]
  )
})

test("sports season candidates adapt to league fingerprint", () => {
  const crossYear = buildFixtureSeasonCandidates({
    strLeague: "Premier League",
    strCountry: "England"
  })
  const singleYear = buildFixtureSeasonCandidates({
    strLeague: "Campeonato Brasileiro Serie A",
    strCountry: "Brazil"
  })

  assert.ok(crossYear.some((entry) => entry.includes("-")))
  assert.equal(singleYear[0], String(new Date().getUTCFullYear()))
})

test("sports season fixture fetch keeps the best matching payload", async () => {
  const calls = []
  const payload = await fetchSeasonFixturesForLeague(
    "100",
    { strLeague: "Premier League", strCountry: "England" },
    ["arsenal"],
    {
      fetchSportsDbJson: async (pathname, searchParams) => {
        calls.push(`${pathname}:${searchParams?.s || "fallback"}`)
        if (pathname !== "eventsseason.php") return { events: [] }
        if (searchParams?.s === "fallback") {
          return {
            events: [
              { idEvent: "fallback-1", strSport: "Soccer", strHomeTeam: "Arsenal", strAwayTeam: "Chelsea" }
            ]
          }
        }
        if (String(searchParams?.s).includes("-")) {
          return {
            events: [
              { idEvent: "season-1", strSport: "Soccer", strHomeTeam: "Arsenal", strAwayTeam: "Liverpool" },
              { idEvent: "season-2", strSport: "Basketball", strHomeTeam: "Arsenal", strAwayTeam: "Liverpool" }
            ]
          }
        }
        return { events: [] }
      }
    }
  )

  assert.equal(payload.season.includes("-"), true)
  assert.equal(payload.events.length, 1)
  assert.equal(payload.events[0].idEvent, "season-1")
  assert.ok(calls.length >= 1)
})

test("sports structured fixture collections preserve live upcoming and recent buckets", async () => {
  const payload = await fetchStructuredFixtureCollections(
    {
      idTeam: "10",
      idLeague: "100",
      strLeague: "Premier League",
      strCountry: "England"
    },
    ["arsenal"],
    REFERENCE_NOW_MS,
    {
      fetchSportsDbJson: async (pathname, searchParams) => {
        if (pathname === "eventsnext.php") {
          return {
            events: [
              {
                idEvent: "team-next",
                strSport: "Soccer",
                strHomeTeam: "Arsenal",
                strAwayTeam: "Chelsea",
                dateEvent: "2026-03-30",
                strTime: "18:00",
                strStatus: "Scheduled"
              }
            ]
          }
        }
        if (pathname === "eventslast.php") {
          return {
            events: [
              {
                idEvent: "team-last",
                strSport: "Soccer",
                strHomeTeam: "Arsenal",
                strAwayTeam: "Liverpool",
                strTimestamp: "2026-03-28T18:00:00.000Z",
                strStatus: "Match Finished"
              }
            ]
          }
        }
        if (pathname === "eventsnextleague.php") {
          return {
            events: [
              {
                idEvent: "league-next",
                strSport: "Soccer",
                strHomeTeam: "Arsenal",
                strAwayTeam: "Tottenham",
                dateEvent: "2026-03-31",
                strTime: "21:00",
                strStatus: "Scheduled"
              },
              {
                idEvent: "league-unrelated",
                strSport: "Soccer",
                strHomeTeam: "Chelsea",
                strAwayTeam: "Liverpool",
                dateEvent: "2026-03-31",
                strTime: "20:00",
                strStatus: "Scheduled"
              }
            ]
          }
        }
        if (pathname === "eventspastleague.php") {
          return { events: [] }
        }
        if (pathname === "eventsseason.php") {
          return {
            events: [
              {
                idEvent: "season-live",
                strSport: "Soccer",
                strHomeTeam: "Arsenal",
                strAwayTeam: "Everton",
                strTimestamp: "2026-03-29T14:00:00.000Z",
                strStatus: "Live"
              },
              {
                idEvent: "season-recent",
                strSport: "Soccer",
                strHomeTeam: "Arsenal",
                strAwayTeam: "West Ham",
                strTimestamp: "2026-03-27T18:00:00.000Z",
                strStatus: "Match Finished"
              }
            ]
          }
        }
        return { events: [] }
      }
    }
  )

  assert.equal(payload.usedSeasonSchedule, true)
  assert.equal(payload.liveMatches[0]?.id, "season-live")
  assert.equal(payload.nextMatches[0]?.id, "season-live")
  assert.ok(payload.nextMatches.some((entry) => entry.id === "team-next"))
  assert.ok(payload.nextMatches.some((entry) => entry.id === "league-next"))
  assert.ok(payload.recentMatches.some((entry) => entry.id === "team-last"))
  assert.ok(payload.recentMatches.some((entry) => entry.id === "season-recent"))
})

test("sports source links keep query shape and source mapping stable", async () => {
  const calls = []
  const links = await resolveSportsSourceLinks("Flamengo", "quando joga o Flamengo hoje?", {
    hasGoogleCustomSearchConfigured: () => true,
    performGoogleCustomSearch: async (query, options) => {
      calls.push({ query, options })
      return {
        items: [
          { title: "GE", link: "https://ge.globo.com/futebol/flamengo", displayLink: "ge.globo.com" },
          { title: "MSN", link: "https://www.msn.com/pt-br/esportes" }
        ]
      }
    },
    safeUrlHostname: (value) => new URL(value).hostname
  })

  assert.equal(calls[0]?.query, "Flamengo proximo jogo futebol ge globo msn")
  assert.deepEqual(links, [
    { title: "GE", link: "https://ge.globo.com/futebol/flamengo", source: "ge.globo.com" },
    { title: "MSN", link: "https://www.msn.com/pt-br/esportes", source: "www.msn.com" }
  ])
  assert.equal(buildSportsSearchQuery("Bahia", "ultimos jogos do Bahia"), "Bahia ultimos jogos futebol ge globo msn")
})
