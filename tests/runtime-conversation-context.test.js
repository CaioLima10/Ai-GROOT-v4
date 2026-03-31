import assert from "node:assert/strict"

import { buildRuntimeConversationContext } from "../apps/api/src/runtimeConversationContext.js"

const fakeClock = {
  nowMs: 1_700_000_000_000,
  unixTime: 1_700_000_000,
  utcIso: "2023-11-14T22:13:20.000Z",
  localIso: "2023-11-14T22:13:20.000Z",
  timezone: "Etc/UTC",
  utcOffset: "+00:00",
  source: "system_clock",
  verified: false,
  fetchedAt: "2023-11-14T22:13:20.000Z"
}

const runtimeConversationContextDeps = {
  buildRuntimeCapabilityMatrix: () => ({ runtime: true }),
  getResearchCapabilities: () => ({
    weatherForecast: true,
    sportsSchedule: true,
    google: true
  }),
  inferWeatherForecastDays: () => 3,
  extractWeatherLocationQuery: () => "Sorriso - MT",
  isAgroWeatherRelevant: () => true,
  resolveWeatherLocationByQuery: async () => ({
    label: "Sorriso - MT",
    latitude: -12.54,
    longitude: -55.72,
    forecastDays: 3,
    timezone: "Etc/UTC",
    locationType: "city"
  }),
  isWeatherQuestion: () => true,
  shouldPreferRecentWeatherMemory: () => false,
  resolveRecentWeatherLocationFromMemory: async () => null,
  resolveWeatherLocationContext: () => null,
  resolveApproximateLocationByIp: async () => null,
  getVerifiedRuntimeClock: async () => fakeClock,
  fetchWeatherForecastPayload: async () => ({
    timezone: "Etc/UTC",
    current: {
      temperature_2m: 28,
      precipitation: 0,
      weather_code: 1,
      wind_speed_10m: 10,
      is_day: 1,
      time: "2023-11-14T22:00:00Z"
    },
    daily: {
      time: ["2023-11-14"],
      temperature_2m_max: [31],
      temperature_2m_min: [22],
      precipitation_probability_max: [20],
      precipitation_sum: [0],
      wind_speed_10m_max: [14],
      weather_code: [1],
      uv_index_max: [7]
    }
  }),
  buildWeatherSnapshot: () => ({
    provider: "open-meteo",
    locationLabel: "Sorriso - MT",
    summary: "Clima operacional de teste."
  }),
  buildClockVerificationMeta: () => ({
    source: "system_clock",
    verified: false,
    timezone: "Etc/UTC",
    nowUtc: "2023-11-14T22:13:20.000Z",
    fetchedAt: "2023-11-14T22:13:20.000Z"
  }),
  isSportsScheduleRelevant: () => true,
  resolveNextFixtureFromQuestion: async () => ({
    provider: "sports_test",
    teamName: "Bahia",
    summary: "Agenda esportiva de teste."
  }),
  shouldInjectGoogleLiveSearch: () => true,
  performGoogleCustomSearch: async () => ({
    provider: "google_custom_search",
    items: [
      {
        title: "Resultado de teste",
        link: "https://example.com/teste",
        snippet: "Resumo de teste"
      }
    ]
  }),
  summarizeGoogleSearchResults: () => "1. Resultado de teste",
  parseBibleReference: () => ({ canonical: "JHN.3.16" }),
  isBibleFollowUpQuestion: () => false,
  extractRecentBibleContextFromHistory: () => null,
  inferMinistryFocusFromText: () => "new_believers",
  extractBibleConversationPreferencesFromHistory: () => ({ preferredBibleCode: "NAA" }),
  fetchBiblePassage: async () => ({
    reference: "Joao 3:16",
    bibleCode: "NAA",
    content: "Porque Deus amou o mundo de tal maneira...",
    summary: "Passagem de teste."
  }),
  mergeRuntimeInstructions: (base = "", extra = "") => [String(base || "").trim(), String(extra || "").trim()].filter(Boolean).join(" ")
}

const enhancedContext = await buildRuntimeConversationContext(
  "Qual o clima em Sorriso e me lembre de Joao 3:16?",
  {
    assistantProfile: "pastoral_companion"
  },
  {
    userId: "test_user",
    requestId: "req_test"
  },
  runtimeConversationContextDeps
)

assert.equal(enhancedContext.weatherLocation?.label, "Sorriso - MT")
assert.equal(enhancedContext.agroWeather?.summary, "Clima operacional de teste.")
assert.equal(enhancedContext.liveFixture?.summary, "Agenda esportiva de teste.")
assert.equal(enhancedContext.liveSearchSummary, "1. Resultado de teste")
assert.equal(enhancedContext.preferredBibleCode, "NAA")
assert.equal(enhancedContext.biblePassage?.reference, "Joao 3:16")
assert.ok(String(enhancedContext.instructions || "").includes("novos convertidos"))
assert.equal(enhancedContext.requestId, "req_test")
assert.deepEqual(enhancedContext.capabilityMatrix, { runtime: true })

console.log("runtime-conversation-context tests passed")
