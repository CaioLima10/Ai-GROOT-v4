import { AI_ENTERPRISE_NAME, isLikelyWeatherQuestion } from "../../../packages/shared-config/src/index.js"
import { buildClockVerificationMeta, formatDateInTimeZone } from "./runtimeClock.js"
import { readTimedCache, writeTimedCache } from "./weatherCache.js"
import type {
  LiveWeatherClientMetadata,
  LiveWeatherSnapshot,
  PromptBuilderRuntimeContext,
  RuntimeClock,
  WeatherForecastProviderPayload,
  WeatherLocationResolution
} from "../../../packages/ai-core/src/aiContracts.js"
import {
  buildResolvedWeatherLocation as geoBuildResolvedWeatherLocation,
  buildWeatherGeocodingSearchQuery as geoBuildWeatherGeocodingSearchQuery,
  sanitizeWeatherLocationQuery as geoSanitizeWeatherLocationQuery,
  selectPreferredWeatherLocationResult as geoSelectPreferredWeatherLocationResult,
  shouldRestrictWeatherLookupToBrazil as geoShouldRestrictWeatherLookupToBrazil
} from "./weatherGeocoding.js"
import {
  describeUvIndexLevel,
  describeWeatherCode,
  describeWeatherLocationSource,
  describeWeatherProviderLabel,
  formatWeatherWeekday
} from "./weatherPresentation.js"

type WeatherRuntimeError = Error & { code?: string, details?: string }

interface GeocodingResult {
  name?: string
  admin1?: string
  country?: string
  country_code?: string
  feature_code?: string
  featureCode?: string
  latitude?: number
  longitude?: number
  timezone?: string
}

interface GeocodingPayload {
  results?: GeocodingResult[]
}

type GenericContext = Record<string, any>

async function getGrootMemoryConnector() {
  const aiCoreRuntimePath = ["..", "..", "..", "packages", "ai-core", "src", "index.js"].join("/")
  const aiCoreModule = (await import(aiCoreRuntimePath)) as {
    grootMemoryConnector: { getRecentHistory: (userId: string, limit?: number) => Promise<Array<Record<string, unknown>>> }
  }
  return aiCoreModule.grootMemoryConnector
}

const WEATHER_GEOCODING_API_BASE_URL = String(
  process.env.WEATHER_GEOCODING_API_BASE_URL || "https://geocoding-api.open-meteo.com/v1/search"
).replace(/\/$/, "")
const WEATHER_CACHE_TTL_MS = Math.max(60_000, Number(process.env.WEATHER_CACHE_TTL_MS || 5 * 60 * 1000))
const weatherGeocodeCache = new Map<string, { value: GeocodingPayload, expiresAt: number }>()
const weatherForecastCache = new Map<string, { value: WeatherForecastProviderPayload, expiresAt: number }>()

function normalizeWeatherText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeWeatherLookupKey(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9,\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function refineWeatherLocationCandidate(value = ""): string {
  const input = String(value || "").trim()
  if (!input) {
    return ""
  }

  const trailingLocationMatch = input.match(/(?:^|.*\b)(?:em|na|no|para)\s+([a-zà-ú0-9'.\s,-]{2,80})$/i)
  if (trailingLocationMatch?.[1]) {
    return String(trailingLocationMatch[1] || "").trim()
  }

  return input
}

export function isWeatherQuestion(question = "") {
  return isLikelyWeatherQuestion(question)
}

export function inferWeatherForecastDays(question = "") {
  const normalized = normalizeWeatherText(question)
  if (/\b(semana|sete dias|7 dias|previsao semanal|previsao da semana|proximos dias)\b/.test(normalized)) return 7
  if (/\b(amanha|depois de amanha|proximos 5 dias)\b/.test(normalized)) return 5
  return 7
}

export function shouldPreferRecentWeatherMemory(question = "") {
  return !/\b(aqui|minha cidade|minha localizacao|meu local|onde estou|perto de mim)\b/.test(normalizeWeatherLookupKey(question))
}

async function fetchWeatherGeocodingPayload(query = "", question = "") {
  const searchQuery = geoBuildWeatherGeocodingSearchQuery(query, question)
  const normalizedQuery = normalizeWeatherLookupKey(searchQuery)
  if (!normalizedQuery) {
    return null
  }

  const cached = readTimedCache(weatherGeocodeCache, normalizedQuery)
  if (cached) {
    return cached
  }

  const url = new URL(WEATHER_GEOCODING_API_BASE_URL)
  url.searchParams.set("name", searchQuery)
  url.searchParams.set("count", "8")
  url.searchParams.set("language", "pt")
  url.searchParams.set("format", "json")
  if (geoShouldRestrictWeatherLookupToBrazil(query, question)) {
    url.searchParams.set("countryCode", "BR")
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": `${AI_ENTERPRISE_NAME}/weather-geocoding`
    }
  })

  if (!response.ok) {
    const details = await response.text().catch(() => "")
    const error = new Error("Falha ao localizar a cidade informada.") as WeatherRuntimeError
    error.code = "WEATHER_GEOCODING_FAILED"
    error.details = details.slice(0, 400)
    throw error
  }

  const payload = await response.json()
  return writeTimedCache(weatherGeocodeCache, normalizedQuery, payload, WEATHER_CACHE_TTL_MS)
}

/**
 * @param {string} [query]
 * @param {number} [forecastDays]
 * @param {{ question?: string }} [options]
 * @returns {Promise<WeatherLocationResolution | null>}
 */
export async function resolveWeatherLocationByQuery(query = "", forecastDays = 7, options = {}) {
  const safeOptions = options as { question?: string }
  const geocoding = await fetchWeatherGeocodingPayload(query, safeOptions.question || "")
  const results = Array.isArray(geocoding?.results) ? geocoding.results : []
  if (!results.length) {
    return null
  }

  const bestResult = geoSelectPreferredWeatherLocationResult(results, {
    query,
    question: safeOptions.question || ""
  })

  return bestResult ? geoBuildResolvedWeatherLocation(bestResult, query, forecastDays, safeOptions.question || "") : null
}

export function extractWeatherLocationQuery(question = "") {
  const source = String(question || "").trim()
  if (!source || !isWeatherQuestion(source)) {
    return ""
  }

  const patterns = [
    /\b(?:estado|cidade|municipio|pais|regiao|localidade)\s+(?:de|da|do)\s+(.+)$/i,
    /\b(?:clima|tempo|temperatura|previs[aã]o(?:\s+(?:do\s+tempo|da\s+semana|semanal))?|chuva|uv)\s+(?:em|de|para|na|no)\s+(.+)$/i,
    /\b(?:em|de|para|na|no)\s+([A-Za-zÀ-ÿ0-9'.\s,-]{1,80})\s*(?:[?!.,]|$)/i
  ]

  for (const pattern of patterns) {
    const match = source.match(pattern)
    if (!match?.[1]) continue
    const candidate = geoSanitizeWeatherLocationQuery(refineWeatherLocationCandidate(match[1]))
    if (candidate) return candidate
  }

  return ""
}


export function isWeatherCardPreferred(question = "", context: GenericContext = {}) {
  const preferredVariant = String(context?.preferredResponseVariant || "").trim().toLowerCase()
  if (preferredVariant === "weather") {
    return true
  }
  return Boolean(context?.agroWeather) && (isWeatherQuestion(question) || isWeatherFollowUpCue(question))
}

function isWeatherFollowUpCue(question = ""): boolean {
  const normalized = normalizeWeatherText(question)
  return /\b(na mesma cidade|na mesma regiao|no mesmo lugar|no mesmo local|mesma cidade|mesmo lugar|mesmo local|amanha|depois de amanha|fim de semana|proximos dias)\b/.test(normalized)
}

function buildWeatherCalendarSnapshot(clock: Record<string, unknown> | null, fallbackTimezone = "Etc/UTC") {
  if (!clock || clock.verified !== true) return null
  const rawNowUtc = String(clock.nowUtc || "").trim()
  const rawFetchedAt = String(clock.fetchedAt || "").trim()
  const timezone = String(clock.timezone || fallbackTimezone || "Etc/UTC").trim() || "Etc/UTC"
  const parsedNowMs = Date.parse(rawNowUtc)
  const parsedFetchedAtMs = Date.parse(rawFetchedAt)
  if (!Number.isFinite(parsedNowMs) || !Number.isFinite(parsedFetchedAtMs)) {
    return null
  }

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(new Date(parsedNowMs))
    const year = parts.find((part) => part.type === "year")?.value
    const month = parts.find((part) => part.type === "month")?.value
    const day = parts.find((part) => part.type === "day")?.value
    const hour = parts.find((part) => part.type === "hour")?.value
    const minute = parts.find((part) => part.type === "minute")?.value
    const second = parts.find((part) => part.type === "second")?.value

    if (!(year && month && day && hour && minute && second)) {
      return null
    }

    return {
      verified: true,
      source: String(clock.source || "worldtimeapi"),
      timezone,
      nowUtc: rawNowUtc,
      fetchedAt: rawFetchedAt,
      date: `${year}-${month}-${day}`,
      year: Number(year),
      month: Number(month),
      day: Number(day),
      hour: Number(hour),
      minute: Number(minute),
      second: Number(second)
    }
  } catch {
    return null
  }
}

export function buildWeatherCardResponse(question = "", context: GenericContext = {}) {
  const weather = context?.agroWeather
  if (!weather || (!weather.current && !Array.isArray(weather.daily))) {
    return null
  }

  const weatherCalendar = buildWeatherCalendarSnapshot(
    weather.timeVerification && typeof weather.timeVerification === "object"
      ? weather.timeVerification as Record<string, unknown>
      : null,
    String(weather.timezone || "Etc/UTC")
  )
  if (!weatherCalendar) {
    return null
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(weather.referenceDate || ""))) {
    return null
  }

  const normalizedQuestion = normalizeWeatherText(question)
  const targetDayIndex = /\bdepois de amanha\b/.test(normalizedQuestion) ? 2 : /\bamanha\b/.test(normalizedQuestion) ? 1 : 0
  const daily = Array.isArray(weather.daily) ? weather.daily : []
  const todayIndex = Math.max(0, Math.min(Number(weather.todayIndex || 0) || 0, Math.max(daily.length - 1, 0)))
  const currentDay = daily[todayIndex] || daily[0] || null
  const focusIndex = Math.min(todayIndex + targetDayIndex, Math.max(daily.length - 1, 0))
  const focusDay = daily[focusIndex] || currentDay || null
  const currentWeatherCode = weather.current?.weatherCode ?? currentDay?.weatherCode
  const uvIndex = currentDay?.uvIndexMax ?? null

  const noteParts = []
  const uvNote = describeUvIndexLevel(uvIndex)
  if (uvNote) noteParts.push(uvNote)
  if (weather.current?.windSpeed != null) noteParts.push(`Vento ${weather.current.windSpeed} km/h`)
  if (currentDay?.precipitationProbability != null) noteParts.push(`Chuva ${currentDay.precipitationProbability}%`)

  const days = daily.slice(0, 7).map((entry: any, index: number) => {
    const dateValue = String(entry.date || "")
    const relativeIndex = index - todayIndex
    return {
      label: formatWeatherWeekday(dateValue, relativeIndex),
      shortLabel: relativeIndex === 0 ? "Hoje" : formatWeatherWeekday(dateValue, relativeIndex),
      isoDate: dateValue,
      calendar: /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
        ? {
          year: Number(dateValue.slice(0, 4)),
          month: Number(dateValue.slice(5, 7)),
          day: Number(dateValue.slice(8, 10))
        }
        : null,
      dayNumber: new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(new Date(`${dateValue}T12:00:00`)),
      temperature: entry.tempMax ?? entry.tempMin ?? "--",
      high: entry.tempMax ?? "--",
      low: entry.tempMin ?? "--",
      weatherCode: entry.weatherCode ?? null,
      condition: describeWeatherCode(entry.weatherCode),
      precipitationProbability: entry.precipitationProbability ?? null,
      precipitationSum: entry.precipitationSum ?? null,
      uvIndex: entry.uvIndexMax ?? null,
      isToday: index === todayIndex
    }
  })

  return JSON.stringify({
    type: "data",
    content: {
      location: weather.locationLabel || "Local atual",
      city: weather.city || null,
      region: weather.region || null,
      country: weather.country || null,
      countryCode: weather.countryCode || null,
      locationType: weather.locationType || null,
      requestedQuery: weather.requestedQuery || null,
      coordinates: weather.coordinates || null,
      forecastDays: weather.forecastDays || null,
      calendar: weatherCalendar,
      dateLabel: "Hoje",
      date: weatherCalendar.date,
      year: weatherCalendar.year,
      month: weatherCalendar.month,
      day: weatherCalendar.day,
      hour: weatherCalendar.hour,
      minute: weatherCalendar.minute,
      second: weatherCalendar.second,
      temperature: weather.current?.temperature ?? currentDay?.tempMax ?? "--",
      unit: "C",
      condition: describeWeatherCode(currentWeatherCode),
      high: currentDay?.tempMax ?? weather.current?.temperature ?? "--",
      low: currentDay?.tempMin ?? "--",
      note: noteParts.join(" | "),
      fetchedAt: weather.fetchedAt || null,
      observedAt: weather.current?.observedAt || null,
      timezone: weather.timezone || "auto",
      referenceDate: weather.referenceDate || null,
      timeVerification: weather.timeVerification || null,
      provider: weather.provider || "open-meteo",
      providerLabel: describeWeatherProviderLabel(weather.provider),
      locationSource: weather.resolutionSource || null,
      locationSourceLabel: describeWeatherLocationSource(weather.resolutionSource),
      focusIndex,
      current: {
        dateLabel: "Hoje",
        temperature: weather.current?.temperature ?? currentDay?.tempMax ?? "--",
        unit: "C",
        condition: describeWeatherCode(currentWeatherCode),
        weatherCode: currentWeatherCode ?? null,
        high: currentDay?.tempMax ?? weather.current?.temperature ?? "--",
        low: currentDay?.tempMin ?? "--",
        windSpeed: weather.current?.windSpeed ?? null,
        precipitation: weather.current?.precipitation ?? null,
        precipitationProbability: currentDay?.precipitationProbability ?? null,
        uvIndex,
        isDay: weather.current?.isDay ?? true,
        note: noteParts.join(" | "),
        fetchedAt: weather.fetchedAt || null,
        observedAt: weather.current?.observedAt || null,
        calendar: weatherCalendar,
        timezone: weather.timezone || "auto",
        referenceDate: weather.referenceDate || null,
        timeVerification: weather.timeVerification || null,
        providerLabel: describeWeatherProviderLabel(weather.provider),
        locationSourceLabel: describeWeatherLocationSource(weather.resolutionSource),
        city: weather.city || null,
        region: weather.region || null,
        country: weather.country || null,
        countryCode: weather.countryCode || null,
        locationType: weather.locationType || null
      },
      weekly: {
        title: "Previsao da semana",
        days,
        focusIndex,
        focusLabel: focusDay ? formatWeatherWeekday(focusDay.date, focusIndex - todayIndex) : "Hoje"
      },
      days
    },
    meta: {
      variant: "weather",
      provider: weather.provider || "open-meteo"
    }
  })
}

export function buildWeatherIntentFallback(context: GenericContext = {}) {
  const locationQuery = String(context?.weatherLocationQuery || "")
    .replace(/^(?:em|na|no|para|de|do|da)\s+/i, "")
    .trim()

  if (locationQuery && context?.weatherLocationError === "WEATHER_LOCATION_NOT_FOUND") {
    return `Nao encontrei a localidade ${locationQuery}. Para eu conferir o clima com seguranca, envie cidade, estado ou pais de forma completa, como "Sao Paulo, Brasil" ou "Bahia, Brasil".`
  }
  if (locationQuery) {
    return `Nao consegui localizar ${locationQuery} agora. Para evitar clima errado, tente novamente em instantes ou envie cidade, estado ou pais com mais contexto.`
  }
  if (context?.weatherLocation?.latitude != null && context?.weatherLocation?.longitude != null) {
    return "Nao consegui consultar o clima ao vivo agora. Para evitar informacao errada, tente novamente em instantes."
  }
  return "Para eu conferir o clima com seguranca, me diga sua cidade ou ative a localizacao para eu montar o card do dia e a semana."
}

export function isAgroWeatherRelevant(question = "", context: GenericContext = {}) {
  const input = normalizeWeatherText(question)
  const activeModules = Array.isArray(context?.activeModules) ? context.activeModules : []
  if (activeModules.includes("agribusiness")) return true
  if (context?.agroWeather && isWeatherFollowUpCue(input)) return true
  if (isWeatherQuestion(input)) return true
  return /\b(agro|agric|soja|safra|talhao|colheita|plantio|pulverizacao|gps agricola|rtk|telemetria|armazenagem|secagem|fila de descarga|clima|chuva|janela operacional|fazenda)\b/.test(input)
}

export function buildWeatherConversationLocationMetadata(weather: any = null, resolvedLocation: any = null) {
  const source: any = weather || resolvedLocation || null
  if (!source) return null
  const latitude = Number(source?.coordinates?.latitude ?? source?.latitude)
  const longitude = Number(source?.coordinates?.longitude ?? source?.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  return {
    label: String(source.locationLabel || source.label || "").trim() || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`,
    latitude,
    longitude,
    timezone: String(source.timezone || "auto"),
    forecastDays: Math.max(1, Math.min(Number(source.forecastDays || 7) || 7, 7)),
    city: String(source.city || "").trim(),
    region: String(source.region || "").trim(),
    country: String(source.country || "").trim(),
    countryCode: String(source.countryCode || "").trim(),
    sourceType: String(source.resolutionSource || source.sourceType || source.source || "recent_weather_memory").trim() || "recent_weather_memory",
    locationType: String(source.locationType || "").trim(),
    accuracyMeters: Number(source.accuracyMeters),
    capturedAt: String(source.capturedAt || "").trim() || null,
    fetchedAt: String(source.fetchedAt || "").trim() || null,
    requestedQuery: String(source.requestedQuery || "").trim() || null
  }
}

function extractWeatherLocationFromStructuredResponse(responseText = "", forecastDays = 7): WeatherLocationResolution | null {
  const payload = (() => {
    try {
      return JSON.parse(String(responseText || ""))
    } catch {
      return null
    }
  })()

  const metaVariant = String(payload?.meta?.variant || "").trim().toLowerCase()
  if (metaVariant !== "weather") {
    return null
  }

  const content = payload?.content && typeof payload.content === "object" ? payload.content : {}
  const coordinates = content?.coordinates && typeof content.coordinates === "object" ? content.coordinates : {}
  const latitude = Number(coordinates.latitude)
  const longitude = Number(coordinates.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }

  return {
    label: String(content.location || "").trim() || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`,
    latitude,
    longitude,
    timezone: String(content.timezone || content.current?.timezone || "auto"),
    forecastDays: Math.max(1, Math.min(Number(content.forecastDays || forecastDays || 7) || 7, 7)),
    city: String(content.city || "").trim(),
    region: String(content.region || "").trim(),
    country: String(content.country || "").trim(),
    countryCode: String(content.countryCode || "").trim(),
    sourceType: String(content.locationSource || "recent_weather_memory").trim(),
    locationType: String(content.locationType || content.current?.locationType || "").trim(),
    requestedQuery: String(content.requestedQuery || "").trim() || null
  }
}

/**
 * @param {string} [userId]
 * @param {number} [forecastDays]
 * @returns {Promise<WeatherLocationResolution | null>}
 */
export async function resolveRecentWeatherLocationFromMemory(userId = "", forecastDays = 7) {
  const safeUserId = String(userId || "").trim()
  if (!safeUserId) {
    return null
  }

  const grootMemoryConnector = await getGrootMemoryConnector()
  const recentHistory = await grootMemoryConnector.getRecentHistory(safeUserId, 8).catch(() => [])
  const rows: Array<Record<string, any>> = Array.isArray(recentHistory) ? (recentHistory as Array<Record<string, any>>) : []

  for (const row of rows) {
    const metadataLocation = buildWeatherConversationLocationMetadata(null, row?.metadata?.weatherLocation || null)
    if (metadataLocation) {
      return {
        ...metadataLocation,
        forecastDays: Math.max(1, Math.min(Number(forecastDays || metadataLocation.forecastDays || 7) || 7, 7)),
        sourceType: "recent_weather_memory"
      }
    }

    const structuredLocation = extractWeatherLocationFromStructuredResponse(row?.ai_response || "", forecastDays)
    if (structuredLocation) {
      return {
        ...structuredLocation,
        forecastDays: Math.max(1, Math.min(Number(forecastDays || structuredLocation.forecastDays || 7) || 7, 7)),
        sourceType: "recent_weather_memory"
      }
    }
  }

  return null
}

export function resolveWeatherLocationContext(context: GenericContext = {}) {
  const source = context?.weatherLocation || context?.agroWeather || {}
  if (source?.enabled === false || source?.auto === false) return null
  const latitude = Number(source.latitude ?? source.lat)
  const longitude = Number(source.longitude ?? source.lon)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  return {
    label: String(source.label || source.name || "").trim(),
    latitude,
    longitude,
    forecastDays: Math.max(1, Math.min(Number(source.days || source.forecastDays || 7) || 7, 7)),
    timezone: String(source.timezone || "auto"),
    city: String(source.city || source.name || "").trim(),
    region: String(source.region || source.admin1 || "").trim(),
    country: String(source.country || "").trim(),
    countryCode: String(source.countryCode || source.country_code || "").trim(),
    sourceType: String(source.sourceType || source.source || "").trim(),
    locationType: String(source.locationType || "").trim(),
    accuracyMeters: Number(source.accuracyMeters),
    requestedQuery: String(source.requestedQuery || "").trim()
  }
}

/**
 * @param {{
 *   latitude?: number;
 *   longitude?: number;
 *   timezone?: string;
 *   forecastDays?: number;
 * }} [input]
 * @returns {Promise<WeatherForecastProviderPayload>}
 */
export async function fetchWeatherForecastPayload(
  { latitude, longitude, timezone = "auto", forecastDays = 7 }: { latitude?: number, longitude?: number, timezone?: string, forecastDays?: number } = {}
) {
  const numericLatitude = Number(latitude)
  const numericLongitude = Number(longitude)
  const safeForecastDays = Math.max(1, Math.min(Number(forecastDays || 7) || 7, 7))
  if (!Number.isFinite(numericLatitude) || !Number.isFinite(numericLongitude)) {
    const error = new Error("Coordenadas invalidas para consulta de clima.") as WeatherRuntimeError
    error.code = "WEATHER_COORDINATES_REQUIRED"
    throw error
  }

  const cacheKey = [numericLatitude.toFixed(4), numericLongitude.toFixed(4), String(timezone || "auto"), safeForecastDays].join(":")
  const cached = readTimedCache(weatherForecastCache, cacheKey)
  if (cached) return cached

  const url = new URL(process.env.WEATHER_API_BASE_URL || "https://api.open-meteo.com/v1/forecast")
  url.searchParams.set("latitude", String(numericLatitude))
  url.searchParams.set("longitude", String(numericLongitude))
  url.searchParams.set("timezone", timezone)
  url.searchParams.set("forecast_days", String(safeForecastDays))
  url.searchParams.set("current", "temperature_2m,precipitation,weather_code,wind_speed_10m,is_day")
  url.searchParams.set("hourly", "temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m")
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset")

  const response = await fetch(url, {
    headers: { "User-Agent": `${AI_ENTERPRISE_NAME}/weather` }
  })

  if (!response.ok) {
    const details = await response.text().catch(() => "")
    const error = new Error("Falha ao consultar o provedor de clima.") as WeatherRuntimeError
    error.code = "WEATHER_PROVIDER_FAILED"
    error.details = details.slice(0, 400)
    throw error
  }

  const payload = await response.json()
  return writeTimedCache(weatherForecastCache, cacheKey, payload, WEATHER_CACHE_TTL_MS)
}

/**
 * @param {WeatherForecastProviderPayload} [payload]
 * @param {Partial<WeatherLocationResolution>} [weatherLocation]
 * @param {RuntimeClock | null} [referenceClock]
 * @returns {LiveWeatherSnapshot}
 */
export function buildWeatherSnapshot(
  payload: WeatherForecastProviderPayload = {},
  weatherLocation: Partial<WeatherLocationResolution> = {},
  referenceClock: RuntimeClock | null = null
) {
  const timezone = payload?.timezone || weatherLocation.timezone || "auto"
  const referenceNowMs = Number(referenceClock?.nowMs || Date.now())
  const fetchedAt = referenceClock?.utcIso || new Date(referenceNowMs).toISOString()
  const current = payload?.current ? {
    temperature: payload.current.temperature_2m ?? null,
    precipitation: payload.current.precipitation ?? null,
    windSpeed: payload.current.wind_speed_10m ?? null,
    weatherCode: payload.current.weather_code ?? null,
    isDay: payload.current.is_day === 0 ? false : true,
    observedAt: payload.current.time || null
  } : null

  const forecastDays = Math.max(1, Math.min(Number(weatherLocation.forecastDays || 7) || 7, 7))
  const dailyPayload = payload?.daily || null
  const daily = Array.isArray(dailyPayload?.time) ? dailyPayload.time.slice(0, forecastDays).map((date: string, index: number) => ({
    date,
    tempMax: dailyPayload?.temperature_2m_max?.[index] ?? null,
    tempMin: dailyPayload?.temperature_2m_min?.[index] ?? null,
    precipitationProbability: dailyPayload?.precipitation_probability_max?.[index] ?? null,
    precipitationSum: dailyPayload?.precipitation_sum?.[index] ?? null,
    windSpeedMax: dailyPayload?.wind_speed_10m_max?.[index] ?? null,
    weatherCode: dailyPayload?.weather_code?.[index] ?? null,
    uvIndexMax: dailyPayload?.uv_index_max?.[index] ?? null
  })) : []

  const referenceDate = formatDateInTimeZone(referenceNowMs, timezone)
  const todayIndex = Math.max(0, daily.findIndex((entry: any) => String(entry?.date || "") === referenceDate))
  const todayEntry = daily[todayIndex] || daily[0] || null
  const tomorrowEntry = daily[todayIndex + 1] || null
  const dayAfterEntry = daily[todayIndex + 2] || null
  const locationLatitude = Number(weatherLocation.latitude)
  const locationLongitude = Number(weatherLocation.longitude)
  const hasLocationCoordinates = Number.isFinite(locationLatitude) && Number.isFinite(locationLongitude)
  const locationLabel = weatherLocation.label || (hasLocationCoordinates
    ? `${locationLatitude.toFixed(3)}, ${locationLongitude.toFixed(3)}`
    : "Local atual")

  return {
    provider: "open-meteo",
    providerLabel: describeWeatherProviderLabel("open-meteo"),
    locationLabel,
    forecastDays,
    timezone,
    fetchedAt,
    referenceDate,
    todayIndex,
    timeVerification: buildClockVerificationMeta(referenceClock),
    city: weatherLocation.city || null,
    region: weatherLocation.region || null,
    country: weatherLocation.country || null,
    countryCode: weatherLocation.countryCode || null,
    locationType: weatherLocation.locationType || null,
    resolutionSource: weatherLocation.sourceType || weatherLocation.source || null,
    locationSourceLabel: describeWeatherLocationSource(weatherLocation.sourceType || weatherLocation.source),
    requestedQuery: weatherLocation.requestedQuery || null,
    accuracyMeters: Number.isFinite(Number(weatherLocation.accuracyMeters)) ? Math.round(Number(weatherLocation.accuracyMeters)) : null,
    coordinates: {
      latitude: hasLocationCoordinates ? locationLatitude : 0,
      longitude: hasLocationCoordinates ? locationLongitude : 0
    },
    current,
    daily,
    summary: [
      `Local de referencia: ${locationLabel}.`,
      current ? `Agora: ${current.temperature ?? "?"} C, chuva ${current.precipitation ?? 0} mm e vento ${current.windSpeed ?? "?"} km/h.` : null,
      todayEntry ? `Hoje: max ${todayEntry.tempMax ?? "?"} C, min ${todayEntry.tempMin ?? "?"} C, chance de chuva ${todayEntry.precipitationProbability ?? "?"}% e acumulado ${todayEntry.precipitationSum ?? 0} mm. ${describeUvIndexLevel(todayEntry.uvIndexMax)}` : null,
      tomorrowEntry ? `Amanha: max ${tomorrowEntry.tempMax ?? "?"} C, min ${tomorrowEntry.tempMin ?? "?"} C, chance de chuva ${tomorrowEntry.precipitationProbability ?? "?"}% e acumulado ${tomorrowEntry.precipitationSum ?? 0} mm.` : null,
      dayAfterEntry ? `Dia seguinte: max ${dayAfterEntry.tempMax ?? "?"} C, min ${dayAfterEntry.tempMin ?? "?"} C, chance de chuva ${dayAfterEntry.precipitationProbability ?? "?"}% e acumulado ${dayAfterEntry.precipitationSum ?? 0} mm.` : null
    ].filter(Boolean).join("\n")
  }
}

export function buildWeatherClientMetadata(agroWeather: any = null): LiveWeatherClientMetadata | null {
  if (!agroWeather?.summary) return null
  return {
    provider: agroWeather.provider || "open-meteo",
    providerLabel: agroWeather.providerLabel || describeWeatherProviderLabel(agroWeather.provider),
    locationLabel: agroWeather.locationLabel || null,
    locationSourceLabel: agroWeather.locationSourceLabel || null,
    locationType: agroWeather.locationType || null,
    forecastDays: agroWeather.forecastDays || null,
    fetchedAt: agroWeather.fetchedAt || null,
    referenceDate: agroWeather.referenceDate || null,
    timeVerification: agroWeather.timeVerification || null,
    coordinates: agroWeather.coordinates || null,
    summary: agroWeather.summary,
    error: agroWeather.error || null
  }
}
