// @ts-check

import { AI_ENTERPRISE_NAME, isLikelyWeatherQuestion } from "../../../packages/shared-config/src/index.js"
import { grootMemoryConnector } from "../../../packages/ai-core/src/index.js"
import { buildClockVerificationMeta, formatDateInTimeZone } from "./runtimeClock.js"

/** @typedef {import("../../../packages/ai-core/src/aiContracts").LiveWeatherClientMetadata} LiveWeatherClientMetadata */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").LiveWeatherSnapshot} LiveWeatherSnapshot */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").PromptBuilderRuntimeContext} PromptBuilderRuntimeContext */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").RuntimeClock} RuntimeClock */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").WeatherForecastProviderPayload} WeatherForecastProviderPayload */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").WeatherLocationResolution} WeatherLocationResolution */
/** @typedef {Error & { code?: string, details?: string }} WeatherRuntimeError */
/** @typedef {{ name: string, aliases: string[] }} BrazilStateEntry */
/** @typedef {{ name?: string, admin1?: string, country?: string, country_code?: string, feature_code?: string, featureCode?: string, latitude?: number, longitude?: number, timezone?: string }} GeocodingResult */

const WEATHER_GEOCODING_API_BASE_URL = String(
  process.env.WEATHER_GEOCODING_API_BASE_URL || "https://geocoding-api.open-meteo.com/v1/search"
).replace(/\/$/, "")
const WEATHER_CACHE_TTL_MS = Math.max(60_000, Number(process.env.WEATHER_CACHE_TTL_MS || 5 * 60 * 1000))
const weatherGeocodeCache = new Map()
const weatherForecastCache = new Map()
const BRAZIL_STATE_DEFINITIONS = [
  { name: "Acre", aliases: ["ac"] },
  { name: "Alagoas", aliases: ["al"] },
  { name: "Amapa", aliases: ["amapa", "ap"] },
  { name: "Amazonas", aliases: ["am"] },
  { name: "Bahia", aliases: ["ba"] },
  { name: "Ceara", aliases: ["ceara", "ce"] },
  { name: "Distrito Federal", aliases: ["df", "brasilia"] },
  { name: "Espirito Santo", aliases: ["espirito santo", "es", "espirito-santo"] },
  { name: "Goias", aliases: ["goias", "go"] },
  { name: "Maranhao", aliases: ["maranhao", "ma"] },
  { name: "Mato Grosso", aliases: ["mt"] },
  { name: "Mato Grosso do Sul", aliases: ["ms"] },
  { name: "Minas Gerais", aliases: ["mg"] },
  { name: "Para", aliases: ["para", "pa"] },
  { name: "Paraiba", aliases: ["paraiba", "pb"] },
  { name: "Parana", aliases: ["parana", "pr"] },
  { name: "Pernambuco", aliases: ["pe"] },
  { name: "Piaui", aliases: ["piaui", "pi"] },
  { name: "Rio de Janeiro", aliases: ["rj"] },
  { name: "Rio Grande do Norte", aliases: ["rn"] },
  { name: "Rio Grande do Sul", aliases: ["rs"] },
  { name: "Rondonia", aliases: ["rondonia", "ro"] },
  { name: "Roraima", aliases: ["rr"] },
  { name: "Santa Catarina", aliases: ["sc"] },
  { name: "Sao Paulo", aliases: ["sao paulo", "sp"] },
  { name: "Sergipe", aliases: ["se"] },
  { name: "Tocantins", aliases: ["to"] }
]

function readTimedCache(cache, key) {
  if (!cache || !key) return null
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key)
    return null
  }
  return entry.value
}

function writeTimedCache(cache, key, value, ttlMs = WEATHER_CACHE_TTL_MS) {
  if (!cache || !key) return value
  cache.set(key, { value, expiresAt: Date.now() + ttlMs })
  return value
}

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

export function isWeatherQuestion(question = "") {
  return isLikelyWeatherQuestion(question)
}

export function inferWeatherForecastDays(question = "") {
  const normalized = normalizeWeatherText(question)
  if (/\b(semana|sete dias|7 dias|previsao semanal|previsao da semana|proximos dias)\b/.test(normalized)) return 7
  if (/\b(amanha|depois de amanha|proximos 5 dias)\b/.test(normalized)) return 5
  return 7
}

function detectBrazilStateDefinition(value = "") {
  const normalized = normalizeWeatherLookupKey(value)
    .replace(/\b(?:estado|cidade|municipio|pais|regiao|localidade)\b/g, " ")
    .replace(/\b(?:de|da|do|dos|das)\b/g, " ")
    .replace(/\b(?:brasil|brazil)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!normalized) {
    return null
  }

  return BRAZIL_STATE_DEFINITIONS.find((entry) => {
    const aliases = [entry.name, ...(entry.aliases || [])]
      .map((alias) => normalizeWeatherLookupKey(alias))
      .filter(Boolean)
    return aliases.includes(normalized)
  }) || null
}

/** @param {BrazilStateEntry | null} [entry] */
function isAmbiguousBrazilStateName(entry = null) {
  const normalizedName = normalizeWeatherLookupKey(entry?.name || "")
  return normalizedName === "sao paulo" || normalizedName === "rio de janeiro"
}

function questionExplicitlyRequestsState(question = "") {
  return /\b(estado|uf)\b/.test(normalizeWeatherLookupKey(question))
}

function detectWeatherLocationScope(question = "", query = "") {
  const normalizedQuestion = normalizeWeatherLookupKey(question)
  const normalizedQuery = normalizeWeatherLookupKey(query)

  if (/\b(pais|country|nacao)\b/.test(normalizedQuestion)) {
    return "country"
  }

  if (/\b(estado|uf)\b/.test(normalizedQuestion)) {
    return "state"
  }

  if (/\b(cidade|municipio|capital)\b/.test(normalizedQuestion)) {
    return "city"
  }

  const stateDefinition = detectBrazilStateDefinition(normalizedQuery)
  if (stateDefinition && (!isAmbiguousBrazilStateName(stateDefinition) || questionExplicitlyRequestsState(question))) {
    return "state"
  }

  if (/^(brasil|brazil)$/.test(normalizedQuery)) {
    return "country"
  }

  return "place"
}

export function shouldPreferRecentWeatherMemory(question = "") {
  return !/\b(aqui|minha cidade|minha localizacao|meu local|onde estou|perto de mim)\b/.test(normalizeWeatherLookupKey(question))
}

/** @param {GeocodingResult} [result] */
function classifyWeatherLocationResult(result = {}) {
  const featureCode = normalizeWeatherLookupKey(result?.feature_code || result?.featureCode || "")
  if (/^(bay|gulf|sea|ocean|strait|channel|fjord|reef|shoal|lagoon|lake|reservoir|peninsula|cape|hill|mountain|peak|valley|plain|forest|desert|island|isthmus|waterfall|stream|river)$/.test(featureCode)) {
    return "natural_feature"
  }
  if (/^adm1$/.test(featureCode)) return "state"
  if (/^adm2$/.test(featureCode)) return "municipality"
  if (/^pcl/.test(featureCode)) return "country"
  if (/^ppl/.test(featureCode)) return "city"

  const name = normalizeWeatherLookupKey(result?.name || "")
  const admin1 = normalizeWeatherLookupKey(result?.admin1 || "")
  const country = normalizeWeatherLookupKey(result?.country || "")

  if (name && admin1 && name === admin1) return "state"
  if (name && country && name === country) return "country"
  if (name && admin1) return "city"
  if (name && !admin1 && country) return "place"
  return "place"
}

function buildWeatherLookupParts(query = "") {
  return String(query || "")
    .split(",")
    .map((entry) => normalizeWeatherLookupKey(entry))
    .filter(Boolean)
}

function sanitizeWeatherLocationQuery(value = "") {
  const cleaned = normalizeWeatherText(value)
    .replace(/[?!.,;:]+$/g, "")
    .replace(/\b(?:hoje|agora|amanha|depois de amanha|esta semana|essa semana|semana|proximos dias|previsao semanal|clima|tempo|temperatura|chuva|uv|vento|momento)\b/g, " ")
    .replace(/\b(?:estado|cidade|municipio|pais|regiao|localidade)\s+(?:de|da|do|dos|das)\b/g, " ")
    .replace(/\b(?:estado|cidade|municipio|pais|regiao|localidade)\b/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,/-]+|[\s,/-]+$/g, "")
    .trim()
  if (!cleaned || cleaned.split(/\s+/).length > 6) return ""
  if (/^(hoje|agora|amanha|semana|tempo real|localizacao|minha cidade|momento|aqui)$/.test(cleaned)) return ""
  return cleaned
}

function buildWeatherGeocodingSearchQuery(query = "", question = "") {
  const sanitizedQuery = sanitizeWeatherLocationQuery(query)
  const scopeHint = detectWeatherLocationScope(question, sanitizedQuery)
  const stateDefinition = detectBrazilStateDefinition(sanitizedQuery)
  const normalizedQuery = normalizeWeatherLookupKey(sanitizedQuery)

  if (stateDefinition && (!isAmbiguousBrazilStateName(stateDefinition) || questionExplicitlyRequestsState(question))) {
    return `${stateDefinition.name}, Brasil`
  }

  if (normalizedQuery.endsWith(" brasil")) {
    return sanitizedQuery.replace(/\s+brasil$/i, ", Brasil")
  }

  if (scopeHint === "country" && /^(brasil|brazil)$/i.test(sanitizedQuery)) {
    return "Brasil"
  }

  return sanitizedQuery
}

function shouldRestrictWeatherLookupToBrazil(query = "", question = "") {
  const normalizedQuery = normalizeWeatherLookupKey(query)
  if (/\b(brasil|brazil)\b/.test(normalizedQuery)) {
    return true
  }

  const stateDefinition = detectBrazilStateDefinition(query)
  if (stateDefinition && (!isAmbiguousBrazilStateName(stateDefinition) || questionExplicitlyRequestsState(question))) {
    return true
  }

  return false
}

/**
 * @param {GeocodingResult} [result]
 * @param {BrazilStateEntry | null} [stateDefinition]
 */
function matchesBrazilStateCandidate(result = {}, stateDefinition = null) {
  if (!stateDefinition) {
    return false
  }

  const resultType = classifyWeatherLocationResult(result)
  const stateName = normalizeWeatherLookupKey(stateDefinition.name)
  const name = normalizeWeatherLookupKey(result?.name || "")
  const admin1 = normalizeWeatherLookupKey(result?.admin1 || "")
  const countryCode = normalizeWeatherLookupKey(result?.country_code || "")

  return resultType === "state"
    && countryCode === "br"
    && (name === stateName || admin1 === stateName)
}

/** @param {GeocodingResult} [result] */
function buildWeatherLocationLabel(result = {}) {
  const name = String(result?.name || "").trim()
  const admin1 = String(result?.admin1 || "").trim()
  const country = String(result?.country || result?.country_code || "").trim()
  const normalizedName = normalizeWeatherLookupKey(name)
  const normalizedAdmin1 = normalizeWeatherLookupKey(admin1)

  if (!name) {
    return [admin1, country].filter(Boolean).join(", ").trim()
  }
  if (admin1 && normalizedAdmin1 && normalizedAdmin1 !== normalizedName) {
    return [name, admin1].filter(Boolean).join(", ").trim()
  }
  return [name, country].filter(Boolean).join(", ").trim()
}

/**
 * @param {GeocodingResult} [result]
 * @param {string} [query]
 * @param {string} [question]
 */
function buildWeatherLocationDisplayLabel(result = {}, query = "", question = "") {
  const locationType = classifyWeatherLocationResult(result)
  const stateDefinition = detectBrazilStateDefinition(query)
  const name = String(result?.name || "").trim()
  const admin1 = String(result?.admin1 || "").trim()
  const country = String(result?.country || result?.country_code || "").trim()

  if (locationType === "state" && stateDefinition && matchesBrazilStateCandidate(result, stateDefinition)) {
    return [`Estado: ${stateDefinition.name}`, country || "Brasil"].filter(Boolean).join(", ").trim()
  }

  if (locationType === "city" || locationType === "municipality") {
    return [`Cidade: ${name}`, admin1 || country].filter(Boolean).join(", ").trim()
  }

  if (locationType === "country" && name) {
    return `Pais: ${name}`
  }

  return buildWeatherLocationLabel(result) || sanitizeWeatherLocationQuery(query)
}

function scoreWeatherLocationCandidate(result = {}, { query = "", question = "" } = {}) {
  const normalizedQuery = normalizeWeatherLookupKey(query)
  const scopeHint = detectWeatherLocationScope(question, query)
  const stateDefinition = detectBrazilStateDefinition(query)
  const resultType = classifyWeatherLocationResult(result)
  const name = normalizeWeatherLookupKey(result?.name || "")
  const admin1 = normalizeWeatherLookupKey(result?.admin1 || "")
  const country = normalizeWeatherLookupKey(result?.country || "")
  const countryCode = normalizeWeatherLookupKey(result?.country_code || "")
  const queryParts = buildWeatherLookupParts(query)

  let score = 0
  if (resultType === "natural_feature") score -= 260

  if (name && name === normalizedQuery) score += 120
  if (admin1 && admin1 === normalizedQuery) score += 118
  if (country && country === normalizedQuery) score += 118
  if (name && normalizedQuery && name.includes(normalizedQuery)) score += 24
  if (admin1 && normalizedQuery && admin1.includes(normalizedQuery)) score += 20
  if (country && normalizedQuery && country.includes(normalizedQuery)) score += 12

  if (queryParts.length >= 2) {
    const [primary, secondary] = queryParts
    if (primary && (name === primary || admin1 === primary)) score += 36
    if (secondary && (admin1 === secondary || country === secondary || countryCode === secondary)) score += 28
    if (primary && secondary && name === primary && country === secondary) score += 18
  }

  if (scopeHint === "state" && resultType === "state") score += 100
  if (scopeHint === "state" && resultType !== "state") score -= 120
  if (scopeHint === "country" && resultType === "country") score += 100
  if (scopeHint === "country" && resultType !== "country") score -= 120
  if (scopeHint === "city" && (resultType === "city" || resultType === "municipality")) score += 82
  if (scopeHint === "city" && !["city", "municipality"].includes(resultType)) score -= 80
  if (scopeHint === "place" && resultType === "city") score += 18

  if (
    stateDefinition &&
    (!isAmbiguousBrazilStateName(stateDefinition) || questionExplicitlyRequestsState(question)) &&
    countryCode === "br" &&
    (name === normalizeWeatherLookupKey(stateDefinition.name) || admin1 === normalizeWeatherLookupKey(stateDefinition.name))
  ) {
    score += 130
  }

  if (/\bbrasil\b/.test(String(query || "").toLowerCase()) && countryCode === "br") {
    score += 16
  }

  if (stateDefinition && resultType === "natural_feature") {
    score -= 180
  }

  const latitude = Number(result?.latitude)
  const longitude = Number(result?.longitude)
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    score += 4
  }

  return score
}

function selectPreferredWeatherLocationResult(results = [], { query = "", question = "" } = {}) {
  const validResults = Array.isArray(results)
    ? results.filter((entry) => Number.isFinite(Number(entry?.latitude)) && Number.isFinite(Number(entry?.longitude)))
    : []

  if (!validResults.length) {
    return null
  }

  const scopeHint = detectWeatherLocationScope(question, query)
  const stateDefinition = detectBrazilStateDefinition(query)

  if (scopeHint === "state" && stateDefinition) {
    const stateMatches = validResults.filter((entry) => matchesBrazilStateCandidate(entry, stateDefinition))
    if (stateMatches.length) {
      return stateMatches
        .map((entry) => ({ entry, score: scoreWeatherLocationCandidate(entry, { query, question }) }))
        .sort((left, right) => right.score - left.score)[0]?.entry || null
    }
  }

  if (scopeHint === "country") {
    const countryMatches = validResults.filter((entry) => classifyWeatherLocationResult(entry) === "country")
    if (countryMatches.length) {
      return countryMatches
        .map((entry) => ({ entry, score: scoreWeatherLocationCandidate(entry, { query, question }) }))
        .sort((left, right) => right.score - left.score)[0]?.entry || null
    }
  }

  if (scopeHint === "city") {
    const cityMatches = validResults.filter((entry) => {
      const locationType = classifyWeatherLocationResult(entry)
      return locationType === "city" || locationType === "municipality"
    })
    if (cityMatches.length) {
      return cityMatches
        .map((entry) => ({ entry, score: scoreWeatherLocationCandidate(entry, { query, question }) }))
        .sort((left, right) => right.score - left.score)[0]?.entry || null
    }
  }

  return validResults
    .map((entry) => ({ entry, score: scoreWeatherLocationCandidate(entry, { query, question }) }))
    .sort((left, right) => right.score - left.score)[0]?.entry || null
}

function buildResolvedWeatherLocation(result = {}, query = "", forecastDays = 7, question = "") {
  const latitude = Number(result.latitude)
  const longitude = Number(result.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }

  const locationType = classifyWeatherLocationResult(result)
  return {
    label: buildWeatherLocationDisplayLabel(result, query, question) || sanitizeWeatherLocationQuery(query),
    latitude,
    longitude,
    forecastDays: Math.max(1, Math.min(Number(forecastDays || 7) || 7, 7)),
    timezone: String(result.timezone || "auto"),
    city: String(result.name || "").trim(),
    region: String(result.admin1 || "").trim(),
    country: String(result.country || "").trim(),
    countryCode: String(result.country_code || "").trim(),
    sourceType: "named_query",
    locationType,
    requestedQuery: sanitizeWeatherLocationQuery(query)
  }
}

async function fetchWeatherGeocodingPayload(query = "", question = "") {
  const searchQuery = buildWeatherGeocodingSearchQuery(query, question)
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
  if (shouldRestrictWeatherLookupToBrazil(query, question)) {
    url.searchParams.set("countryCode", "BR")
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": `${AI_ENTERPRISE_NAME}/weather-geocoding`
    }
  })

  if (!response.ok) {
    const details = await response.text().catch(() => "")
    /** @type {WeatherRuntimeError} */
    const error = new Error("Falha ao localizar a cidade informada.")
    error.code = "WEATHER_GEOCODING_FAILED"
    error.details = details.slice(0, 400)
    throw error
  }

  const payload = await response.json()
  return writeTimedCache(weatherGeocodeCache, normalizedQuery, payload)
}

/**
 * @param {string} [query]
 * @param {number} [forecastDays]
 * @param {{ question?: string }} [options]
 * @returns {Promise<WeatherLocationResolution | null>}
 */
export async function resolveWeatherLocationByQuery(query = "", forecastDays = 7, options = {}) {
  const geocoding = await fetchWeatherGeocodingPayload(query, options.question || "")
  const results = Array.isArray(geocoding?.results) ? geocoding.results : []
  if (!results.length) {
    return null
  }

  const bestResult = selectPreferredWeatherLocationResult(results, {
    query,
    question: options.question || ""
  })

  return bestResult ? buildResolvedWeatherLocation(bestResult, query, forecastDays, options.question || "") : null
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
    const candidate = sanitizeWeatherLocationQuery(match[1])
    if (candidate) return candidate
  }

  return ""
}

function describeUvIndexLevel(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return ""
  if (numeric >= 8) return "UV muito alto. Evite exposicao prolongada ao sol."
  if (numeric >= 6) return "UV alto. Reduza o tempo ao sol."
  if (numeric >= 3) return "UV moderado. Considere protecao ao sair."
  return "UV baixo no momento."
}

function describeWeatherProviderLabel(provider = "") {
  const normalized = String(provider || "").trim().toLowerCase()
  if (normalized === "open-meteo") return "Open-Meteo"
  if (!normalized) return "Consulta ao vivo"
  return String(provider || "").trim()
}

function describeWeatherLocationSource(sourceType = "") {
  const normalized = String(sourceType || "").trim().toLowerCase()
  if (normalized === "browser_geolocation") return "Localizacao confirmada no navegador"
  if (normalized === "city_query" || normalized === "named_query") return "Local confirmado na consulta"
  if (normalized === "recent_weather_memory") return "Local mantido da ultima consulta de clima"
  if (normalized === "ip_approximate") return "Local aproximado por rede"
  return ""
}

function formatWeatherWeekday(dateValue, relativeIndex) {
  if (relativeIndex === 0) return "Hoje"
  if (relativeIndex === 1) return "Amanha"
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(new Date(`${dateValue}T12:00:00`)).replace(/\.$/, "")
}

export function isWeatherCardPreferred(question = "", context = {}) {
  const preferredVariant = String(context?.preferredResponseVariant || "").trim().toLowerCase()
  if (preferredVariant === "weather") {
    return true
  }
  return Boolean(context?.agroWeather) && isWeatherQuestion(question)
}

function describeWeatherCode(code) {
  const numeric = Number(code)
  if (!Number.isFinite(numeric)) return "Tempo atual"
  if (numeric === 0) return "Ceu limpo"
  if ([1, 2, 3].includes(numeric)) return "Parcialmente nublado"
  if ([45, 48].includes(numeric)) return "Neblina"
  if ([51, 53, 55, 56, 57].includes(numeric)) return "Garoa"
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(numeric)) return "Chuva"
  if ([71, 73, 75, 77, 85, 86].includes(numeric)) return "Neve"
  if ([95, 96, 99].includes(numeric)) return "Tempestade"
  return "Condicoes variaveis"
}

export function buildWeatherCardResponse(question = "", context = {}) {
  const weather = context?.agroWeather
  if (!weather || (!weather.current && !Array.isArray(weather.daily))) {
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

  const days = daily.slice(0, 7).map((entry, index) => {
    const dateValue = String(entry.date || "")
    const relativeIndex = index - todayIndex
    return {
      label: formatWeatherWeekday(dateValue, relativeIndex),
      shortLabel: relativeIndex === 0 ? "Hoje" : formatWeatherWeekday(dateValue, relativeIndex),
      isoDate: dateValue,
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
      dateLabel: "Hoje",
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

export function buildWeatherIntentFallback(context = {}) {
  if (context?.weatherLocationQuery && context?.weatherLocationError === "WEATHER_LOCATION_NOT_FOUND") {
    return `Nao encontrei a localidade ${context.weatherLocationQuery}. Para eu conferir o clima com seguranca, envie cidade, estado ou pais de forma completa, como "Sao Paulo, Brasil" ou "Bahia, Brasil".`
  }
  if (context?.weatherLocationQuery) {
    return `Nao consegui localizar ${context.weatherLocationQuery} agora. Para evitar clima errado, tente novamente em instantes ou envie cidade, estado ou pais com mais contexto.`
  }
  if (context?.weatherLocation?.latitude != null && context?.weatherLocation?.longitude != null) {
    return "Nao consegui consultar o clima ao vivo agora. Para evitar informacao errada, tente novamente em instantes."
  }
  return "Para eu conferir o clima com seguranca, me diga sua cidade ou ative a localizacao para eu montar o card do dia e a semana."
}

export function isAgroWeatherRelevant(question = "", context = {}) {
  const input = normalizeWeatherText(question)
  const activeModules = Array.isArray(context?.activeModules) ? context.activeModules : []
  if (activeModules.includes("agribusiness")) return true
  if (isWeatherQuestion(input)) return true
  return /\b(agro|agric|soja|safra|talhao|colheita|plantio|pulverizacao|gps agricola|rtk|telemetria|armazenagem|secagem|fila de descarga|clima|chuva|janela operacional|fazenda)\b/.test(input)
}

export function buildWeatherConversationLocationMetadata(weather = null, resolvedLocation = null) {
  const source = weather || resolvedLocation || null
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

function extractWeatherLocationFromStructuredResponse(responseText = "", forecastDays = 7) {
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

  const recentHistory = await grootMemoryConnector.getRecentHistory(safeUserId, 8).catch(() => [])
  const rows = Array.isArray(recentHistory) ? recentHistory : []

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

export function resolveWeatherLocationContext(context = {}) {
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
export async function fetchWeatherForecastPayload({ latitude, longitude, timezone = "auto", forecastDays = 7 } = {}) {
  const numericLatitude = Number(latitude)
  const numericLongitude = Number(longitude)
  const safeForecastDays = Math.max(1, Math.min(Number(forecastDays || 7) || 7, 7))
  if (!Number.isFinite(numericLatitude) || !Number.isFinite(numericLongitude)) {
    /** @type {WeatherRuntimeError} */
    const error = new Error("Coordenadas invalidas para consulta de clima.")
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
    /** @type {WeatherRuntimeError} */
    const error = new Error("Falha ao consultar o provedor de clima.")
    error.code = "WEATHER_PROVIDER_FAILED"
    error.details = details.slice(0, 400)
    throw error
  }

  const payload = await response.json()
  return writeTimedCache(weatherForecastCache, cacheKey, payload)
}

/**
 * @param {WeatherForecastProviderPayload} [payload]
 * @param {Partial<WeatherLocationResolution>} [weatherLocation]
 * @param {RuntimeClock | null} [referenceClock]
 * @returns {LiveWeatherSnapshot}
 */
export function buildWeatherSnapshot(payload = {}, weatherLocation = {}, referenceClock = null) {
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
  const daily = Array.isArray(payload?.daily?.time) ? payload.daily.time.slice(0, forecastDays).map((date, index) => ({
    date,
    tempMax: payload.daily.temperature_2m_max?.[index] ?? null,
    tempMin: payload.daily.temperature_2m_min?.[index] ?? null,
    precipitationProbability: payload.daily.precipitation_probability_max?.[index] ?? null,
    precipitationSum: payload.daily.precipitation_sum?.[index] ?? null,
    windSpeedMax: payload.daily.wind_speed_10m_max?.[index] ?? null,
    weatherCode: payload.daily.weather_code?.[index] ?? null,
    uvIndexMax: payload.daily.uv_index_max?.[index] ?? null
  })) : []

  const referenceDate = formatDateInTimeZone(referenceNowMs, timezone)
  const todayIndex = Math.max(0, daily.findIndex((entry) => String(entry?.date || "") === referenceDate))
  const todayEntry = daily[todayIndex] || daily[0] || null
  const tomorrowEntry = daily[todayIndex + 1] || null
  const dayAfterEntry = daily[todayIndex + 2] || null
  const locationLabel = weatherLocation.label || `${weatherLocation.latitude.toFixed(3)}, ${weatherLocation.longitude.toFixed(3)}`

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
    coordinates: { latitude: Number(weatherLocation.latitude), longitude: Number(weatherLocation.longitude) },
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

export function buildWeatherClientMetadata(agroWeather = null) {
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
