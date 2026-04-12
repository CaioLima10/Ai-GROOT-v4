import assert from "node:assert/strict"
import test from "node:test"

import { buildRuntimeConversationContext } from "../apps/api/src/runtimeConversationContext.js"

function createDeps(overrides = {}) {
  return {
    buildRuntimeCapabilityMatrix: () => ({}),
    getResearchCapabilities: () => ({
      weatherForecast: true,
      sportsSchedule: true,
      google: false
    }),
    inferWeatherForecastDays: () => 5,
    extractWeatherLocationQuery: () => "",
    isAgroWeatherRelevant: () => false,
    resolveWeatherLocationByQuery: async () => null,
    isWeatherQuestion: (question = "") => /\b(clima|tempo|temperatura|chuva|previsao)\b/i.test(String(question || "")),
    shouldPreferRecentWeatherMemory: () => true,
    resolveRecentWeatherLocationFromMemory: async () => ({
      label: "Sao Paulo, Brasil",
      latitude: -23.55,
      longitude: -46.63,
      forecastDays: 5,
      timezone: "America/Sao_Paulo",
      city: "Sao Paulo",
      region: "SP",
      country: "Brasil",
      countryCode: "BR",
      sourceType: "recent_weather_memory",
      locationType: "city",
      requestedQuery: "sao paulo, brasil"
    }),
    resolveWeatherLocationContext: () => null,
    resolveApproximateLocationByIp: async () => null,
    getVerifiedRuntimeClock: async (timezone = "America/Sao_Paulo") => ({
      verified: true,
      timezone,
      utcIso: "2026-04-04T12:00:00Z",
      nowUtc: "2026-04-04T12:00:00Z",
      fetchedAt: "2026-04-04T12:00:00Z"
    }),
    fetchWeatherForecastPayload: async () => ({
      current: {}
    }),
    buildWeatherSnapshot: (_payload, weatherLocation) => ({
      locationLabel: weatherLocation?.label || "",
      forecastDays: weatherLocation?.forecastDays || 5
    }),
    buildClockVerificationMeta: () => ({ verified: true }),
    isSportsScheduleRelevant: (question = "") => /\b(jogo|partida|campeonato|liga|horario|que horas)\b/i.test(String(question || "")),
    resolveNextFixtureFromQuestion: async () => ({ teamName: "Santos" }),
    shouldInjectGoogleLiveSearch: () => false,
    performGoogleCustomSearch: async () => ({ items: [], provider: "google" }),
    summarizeGoogleSearchResults: () => "",
    parseBibleReference: () => null,
    isBibleFollowUpQuestion: () => false,
    extractRecentBibleContextFromHistory: () => null,
    inferMinistryFocusFromText: () => "",
    extractBibleConversationPreferencesFromHistory: () => ({}),
    fetchBiblePassage: async () => null,
    mergeRuntimeInstructions: (base = "", extra = "") => [base, extra].filter(Boolean).join("\n"),
    enrichLanguageRuntimeContext: async () => null,
    ...overrides
  }
}

test("runtime conversation context reuses recent weather memory for weather follow-up", async () => {
  const context = await buildRuntimeConversationContext(
    "E amanha na mesma cidade, em 2 linhas curtas?",
    {},
    {
      userId: "user-1",
      conversationHistory: [
        { role: "user", content: "Qual clima de hoje em Sao Paulo, Brasil?" },
        { role: "assistant", content: "Hoje em Sao Paulo o clima esta firme." }
      ]
    },
    createDeps()
  )

  assert.equal(context.weatherLocation?.label, "Sao Paulo, Brasil")
  assert.equal(context.agroWeather?.locationLabel, "Sao Paulo, Brasil")
})

test("runtime conversation context restores the latest sports subject on follow-up", async () => {
  let capturedQuestion = ""
  await buildRuntimeConversationContext(
    "E qual horario dessa partida e qual campeonato?",
    {},
    {
      conversationHistory: [
        { role: "user", content: "Quando joga o Santos?" },
        { role: "assistant", content: "O proximo jogo do Santos sera em breve." }
      ]
    },
    createDeps({
      resolveNextFixtureFromQuestion: async (question = "") => {
        capturedQuestion = String(question || "")
        return { teamName: "Santos" }
      }
    })
  )

  assert.match(capturedQuestion, /Santos/i)
})

test("runtime conversation context normalizes explicit weather queries before lookup", async () => {
  const context = await buildRuntimeConversationContext(
    "Qual clima de hoje em Sao Paulo, Brasil?",
    {},
    {},
    createDeps({
      extractWeatherLocationQuery: () => "em sao paulo, brasil",
      isAgroWeatherRelevant: () => true,
      resolveWeatherLocationByQuery: async (query = "") => ({
        label: query,
        latitude: -23.55,
        longitude: -46.63,
        forecastDays: 5,
        timezone: "America/Sao_Paulo",
        city: "Sao Paulo",
        region: "SP",
        country: "Brasil",
        countryCode: "BR",
        sourceType: "named_query",
        locationType: "city",
        requestedQuery: query
      })
    })
  )

  assert.equal(context.weatherLocationQuery, "sao paulo, brasil")
  assert.equal(context.weatherLocation?.requestedQuery, "sao paulo, brasil")
})
