import test from "node:test"
import assert from "node:assert/strict"

import {
  buildWeatherIntentFallback,
  buildWeatherClientMetadata,
  buildWeatherConversationLocationMetadata,
  buildWeatherSnapshot,
  extractWeatherLocationQuery,
  inferWeatherForecastDays,
  isAgroWeatherRelevant,
  isWeatherCardPreferred,
  isWeatherQuestion,
  resolveWeatherLocationContext,
  shouldPreferRecentWeatherMemory
} from "../apps/api/src/weatherRuntime.js"

test("weather helpers normalize intent and location context", () => {
  assert.equal(isWeatherQuestion("Vai chover em Goiania hoje?"), true)
  assert.equal(inferWeatherForecastDays("previsao da semana"), 7)
  assert.equal(extractWeatherLocationQuery("clima em Sao Paulo, Brasil hoje"), "sao paulo, brasil")
  assert.equal(extractWeatherLocationQuery("Qual clima de hoje em Sao Paulo, Brasil?"), "sao paulo, brasil")
  assert.equal(extractWeatherLocationQuery("Como esta o tempo no Brasil hoje?"), "brasil")
  assert.equal(isAgroWeatherRelevant("janela operacional do plantio", {}), true)
  assert.equal(isWeatherCardPreferred("clima em Goiania", { preferredResponseVariant: "weather" }), true)
  assert.equal(
    isWeatherCardPreferred("E amanha na mesma cidade, em 2 linhas curtas?", {
      agroWeather: {
        current: {
          temperature: 25
        }
      }
    }),
    true
  )
  assert.equal(shouldPreferRecentWeatherMemory("qual o clima aqui agora?"), false)
  assert.equal(shouldPreferRecentWeatherMemory("qual o clima em Goiania?"), true)
  assert.equal(
    isWeatherQuestion("Boa pergunta, creio que jesus cristo voltara sobre as nuvens e ao fim deste tempo vira o Senhor com o juizo final."),
    false
  )
  assert.equal(
    extractWeatherLocationQuery("Boa pergunta, creio que jesus cristo voltara sobre as nuvens e ao fim deste tempo vira o Senhor com o juizo final."),
    ""
  )

  assert.deepEqual(resolveWeatherLocationContext({
    weatherLocation: {
      latitude: -16.68,
      longitude: -49.25,
      label: "Goiania",
      days: 5,
      timezone: "America/Sao_Paulo",
      country: "Brasil",
      countryCode: "BR"
    }
  }), {
    label: "Goiania",
    latitude: -16.68,
    longitude: -49.25,
    forecastDays: 5,
    timezone: "America/Sao_Paulo",
    city: "",
    region: "",
    country: "Brasil",
    countryCode: "BR",
    sourceType: "",
    locationType: "",
    accuracyMeters: Number.NaN,
    requestedQuery: ""
  })
})

test("weather snapshot metadata stays structured", () => {
  const snapshot = buildWeatherSnapshot({
    timezone: "America/Sao_Paulo",
    current: {
      time: "2026-03-29T12:00",
      temperature_2m: 28,
      precipitation: 0.4,
      weather_code: 1,
      wind_speed_10m: 12,
      is_day: 1
    },
    daily: {
      time: ["2026-03-29", "2026-03-30", "2026-03-31"],
      temperature_2m_max: [30, 29, 27],
      temperature_2m_min: [20, 19, 18],
      precipitation_probability_max: [35, 60, 70],
      precipitation_sum: [1.2, 3.4, 4.8],
      wind_speed_10m_max: [20, 18, 16],
      weather_code: [1, 61, 63],
      uv_index_max: [8, 6, 5]
    }
  }, {
    label: "Cidade: Goiania, Goias",
    latitude: -16.68,
    longitude: -49.25,
    forecastDays: 3,
    timezone: "America/Sao_Paulo",
    city: "Goiania",
    region: "Goias",
    country: "Brasil",
    countryCode: "BR",
    sourceType: "named_query",
    locationType: "city",
    requestedQuery: "goiania"
  }, {
    nowMs: Date.parse("2026-03-29T15:00:00.000Z"),
    unixTime: Math.trunc(Date.parse("2026-03-29T15:00:00.000Z") / 1000),
    utcIso: "2026-03-29T15:00:00.000Z",
    localIso: "2026-03-29T12:00:00.000-03:00",
    timezone: "America/Sao_Paulo",
    utcOffset: "-03:00",
    source: "system_clock",
    verified: false,
    fetchedAt: "2026-03-29T15:00:00.000Z"
  })

  assert.equal(snapshot.locationLabel, "Cidade: Goiania, Goias")
  assert.equal(snapshot.daily.length, 3)
  assert.match(snapshot.summary, /Local de referencia: Cidade: Goiania, Goias/)

  const clientMetadata = buildWeatherClientMetadata(snapshot)
  assert.equal(clientMetadata?.providerLabel, "Open-Meteo")

  const memoryMetadata = buildWeatherConversationLocationMetadata(snapshot, null)
  assert.equal(memoryMetadata?.label, "Cidade: Goiania, Goias")
  assert.equal(memoryMetadata?.timezone, "America/Sao_Paulo")
})

test("weather intent fallback sanitizes leading location prepositions", () => {
  const fallback = buildWeatherIntentFallback({
    weatherLocationQuery: "em Sao Paulo, Brasil",
    weatherLocationError: "WEATHER_LOCATION_NOT_FOUND"
  })

  assert.match(fallback, /localidade Sao Paulo, Brasil/i)
  assert.doesNotMatch(fallback, /localidade em Sao Paulo/i)
})
