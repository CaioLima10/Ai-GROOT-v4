import test from "node:test"
import assert from "node:assert/strict"

import {
  buildResolvedTeamVisualProfile,
  enrichFixturesWithVisuals,
  extractTeamSearchQuery,
  extractTeamTerms,
  looksLikeNationalTeam,
  resolveTeamFromQuestion,
  resolveTeamQueryCandidates,
  resolveTeamVisualProfile,
  scoreTeamMatch
} from "../apps/api/src/sportsTeamsRuntime.js"

test("sports team intent keeps ambiguous geography out unless sports context exists", () => {
  assert.equal(extractTeamSearchQuery("quando joga o Flamengo?"), "Flamengo")
  assert.equal(extractTeamSearchQuery("proximo jogo da selecao da argentina"), "Argentina")
  assert.equal(extractTeamSearchQuery("Bahia"), null)
  assert.equal(extractTeamSearchQuery("quando joga o Bahia hoje?"), "Bahia")
})

test("sports team candidates and scoring stay stable", () => {
  assert.deepEqual(resolveTeamQueryCandidates("Santos"), ["Santos", "Santos FC", "Santos Futebol Clube"])

  const brazilNationalTeam = {
    strTeam: "Brazil National Team",
    strAlternate: "Selecao Brasileira",
    strKeywords: "national soccer",
    strCountry: "Brazil",
    strSport: "Soccer",
    strLeague: "International"
  }
  const brazilYouthTeam = {
    strTeam: "Brazil U20",
    strAlternate: "Selecao Brasileira Sub-20",
    strKeywords: "national soccer youth",
    strCountry: "Brazil",
    strSport: "Soccer"
  }

  assert.equal(looksLikeNationalTeam(brazilNationalTeam), true)
  assert.ok(
    scoreTeamMatch(brazilNationalTeam, "Brazil", { question: "quando joga a selecao do brasil?" }) >
    scoreTeamMatch(brazilYouthTeam, "Brazil", { question: "quando joga o Brasil?" })
  )

  const terms = extractTeamTerms(
    {
      strTeam: "Esporte Clube Bahia",
      strAlternate: "EC Bahia",
      strTeamShort: "Bahia",
      strKeywords: "tricolor de aco"
    },
    "Bahia"
  )

  assert.ok(terms.includes("esporte clube bahia"))
  assert.ok(terms.includes("ec bahia"))
  assert.ok(terms.includes("bahia"))
  assert.ok(terms.includes("tricolor"))
  assert.ok(terms.includes("aco"))
})

test("sports team resolution prefers the best matching team from search payloads", async () => {
  const resolved = await resolveTeamFromQuestion("quando joga o Bahia?", {
    searchTeamsByQuery: async (query) => {
      if (query === "Bahia") {
        return [
          {
            idTeam: "club-1",
            strTeam: "EC Bahia",
            strAlternate: "Esporte Clube Bahia",
            strTeamShort: "Bahia",
            strCountry: "Brazil",
            strSport: "Soccer",
            strKeywords: "tricolor"
          },
          {
            idTeam: "club-2",
            strTeam: "Bahia U20",
            strAlternate: "Bahia Sub-20",
            strCountry: "Brazil",
            strSport: "Soccer",
            strKeywords: "sub 20"
          }
        ]
      }
      if (query === "EC Bahia") {
        return [
          {
            idTeam: "club-1",
            strTeam: "EC Bahia",
            strAlternate: "Esporte Clube Bahia",
            strTeamShort: "Bahia",
            strCountry: "Brazil",
            strSport: "Soccer",
            strKeywords: "tricolor"
          }
        ]
      }
      return []
    }
  })

  assert.equal(resolved?.teamQuery, "Bahia")
  assert.equal(resolved?.teamName, "EC Bahia")
  assert.equal(resolved?.team?.idTeam, "club-1")
  assert.ok(resolved?.teamTerms.includes("bahia"))
})

test("sports visual profile resolution and enrichment stay deterministic", async () => {
  const visualProfile = await resolveTeamVisualProfile("Santos", {
    cache: new Map(),
    fetchTeamsByQuery: async () => [
      {
        idTeam: "santos-1",
        strTeam: "Santos FC",
        strTeamShort: "Santos",
        strCountry: "Brazil",
        strSport: "Soccer",
        strBadge: "https://cdn.example.com/santos.png",
        strLogo: "/local-logo.png",
        strStadium: "Vila Belmiro"
      }
    ]
  })

  assert.deepEqual(visualProfile, {
    name: "Santos FC",
    shortName: "Santos",
    badge: "https://cdn.example.com/santos.png",
    stadium: "Vila Belmiro",
    country: "Brazil"
  })

  const enriched = await enrichFixturesWithVisuals(
    [{ id: "fixture-1", homeTeam: "EC Bahia", awayTeam: "Santos FC" }],
    {
      teamQuery: "Bahia",
      aliasEntry: null,
      teamName: "EC Bahia",
      teamTerms: ["bahia"],
      team: {
        strTeam: "EC Bahia",
        strTeamShort: "Bahia",
        strBadge: "https://cdn.example.com/bahia.png",
        strCountry: "Brazil"
      }
    },
    {
      resolveTeamVisualProfile: async (teamName) => teamName === "Santos FC" ? visualProfile : null
    }
  )

  assert.deepEqual(enriched, [
    {
      id: "fixture-1",
      homeTeam: "EC Bahia",
      awayTeam: "Santos FC",
      homeBadge: "https://cdn.example.com/bahia.png",
      awayBadge: "https://cdn.example.com/santos.png",
      homeShortName: "Bahia",
      awayShortName: "Santos"
    }
  ])

  assert.deepEqual(
    buildResolvedTeamVisualProfile({
      strTeam: "Flamengo",
      strTeamShort: "FLA",
      strBadge: "https://cdn.example.com/fla.png",
      strStadium: "Maracana",
      strCountry: "Brazil"
    }),
    {
      name: "Flamengo",
      shortName: "FLA",
      badge: "https://cdn.example.com/fla.png",
      stadium: "Maracana",
      country: "Brazil"
    }
  )
})
