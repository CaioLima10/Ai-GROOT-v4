// @ts-check

/** @typedef {import("../../../packages/ai-core/src/aiContracts").GoogleCustomSearchOptions} GoogleCustomSearchOptions */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").GoogleCustomSearchPayload} GoogleCustomSearchPayload */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").WeatherLocationResolution} WeatherLocationResolution */
/** @typedef {Error & { code?: string, details?: string }} LiveResearchError */

/**
 * @typedef {object} LiveWebRuntimeConfig
 * @property {string} googleSearchApiKey
 * @property {string} googleSearchEngineId
 * @property {string} googleCustomSearchApiBaseUrl
 * @property {string} ipGeolocationApiBaseUrl
 * @property {string[]} blockedDomains
 * @property {string} userAgent
 */

function normalizeLooseText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

export function getLiveWebRuntimeConfig(env = process.env) {
  return {
    googleSearchApiKey: String(
      env.GOOGLE_SEARCH_API_KEY ||
      env.GOOGLE_CSE_API_KEY ||
      env.GOOGLE_API_KEY ||
      ""
    ).trim(),
    googleSearchEngineId: String(
      env.GOOGLE_SEARCH_ENGINE_ID ||
      env.GOOGLE_CSE_CX ||
      env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID ||
      ""
    ).trim(),
    googleCustomSearchApiBaseUrl: String(
      env.GOOGLE_CUSTOM_SEARCH_API_BASE_URL || "https://customsearch.googleapis.com/customsearch/v1"
    ).replace(/\/$/, ""),
    ipGeolocationApiBaseUrl: String(
      env.IP_GEOLOCATION_API_BASE_URL || "https://ipwho.is"
    ).replace(/\/$/, ""),
    blockedDomains: String(env.RESEARCH_BLOCKED_DOMAINS || "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
    userAgent: String(env.LIVE_RESEARCH_USER_AGENT || "GIOM-LiveResearch/1.0").trim() || "GIOM-LiveResearch/1.0"
  }
}

export function buildRequestHeaders(config = getLiveWebRuntimeConfig()) {
  return {
    "User-Agent": config.userAgent
  }
}

export function safeUrlHostname(value = "") {
  try {
    return new URL(value).hostname.toLowerCase()
  } catch {
    return ""
  }
}

/** @param {string} hostname @param {string[]} blockedDomains */
function isBlockedSearchHost(hostname = "", blockedDomains = []) {
  if (!hostname) return false
  return blockedDomains.some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`))
}

/** @param {string} hostname @param {string[]} allowedHosts */
function isAllowedSearchHost(hostname = "", allowedHosts = []) {
  if (!hostname || !Array.isArray(allowedHosts) || !allowedHosts.length) return true
  return allowedHosts.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`))
}

/**
 * @param {Record<string, unknown>[]} items
 * @param {{ blockedDomains?: string[] }} [options]
 */
export function sanitizeGoogleSearchItems(items = [], options = {}) {
  const blockedDomains = Array.isArray(options?.blockedDomains)
    ? options.blockedDomains.map((entry) => normalizeLooseText(entry)).filter(Boolean)
    : []

  return items
    .map((item) => ({
      title: String(item?.title || "").trim(),
      link: String(item?.link || "").trim(),
      snippet: String(item?.snippet || "").trim(),
      displayLink: String(item?.displayLink || "").trim(),
      mime: String(item?.mime || "").trim(),
      image: item?.image && typeof item.image === "object"
        ? {
          contextLink: String(/** @type {Record<string,unknown>} */(item.image).contextLink || "").trim(),
          thumbnailLink: String(/** @type {Record<string,unknown>} */(item.image).thumbnailLink || "").trim(),
          width: Number(/** @type {Record<string,unknown>} */(item.image).width || 0) || null,
          height: Number(/** @type {Record<string,unknown>} */(item.image).height || 0) || null
        }
        : null
    }))
    .filter((item) => item.title && item.link)
    .filter((item) => !isBlockedSearchHost(safeUrlHostname(item.link), blockedDomains))
}

export function hasGoogleCustomSearchConfigured(config = getLiveWebRuntimeConfig()) {
  return Boolean(config.googleSearchApiKey && config.googleSearchEngineId)
}

/**
 * @param {string} query
 * @param {GoogleCustomSearchOptions} [options]
 * @param {{ config?: LiveWebRuntimeConfig | null, fetchImpl?: typeof fetch }} [deps]
 * @returns {Promise<GoogleCustomSearchPayload>}
 */
export async function performGoogleCustomSearch(query, options = {}, deps = {}) {
  const config = deps?.config || getLiveWebRuntimeConfig()
  const fetchImpl = typeof deps?.fetchImpl === "function" ? deps.fetchImpl : fetch

  if (!hasGoogleCustomSearchConfigured(config)) {
    /** @type {LiveResearchError} */
    const error = new Error("Google Custom Search nao configurado nesta execucao.")
    error.code = "GOOGLE_CUSTOM_SEARCH_DISABLED"
    throw error
  }

  const url = new URL(config.googleCustomSearchApiBaseUrl)
  url.searchParams.set("key", config.googleSearchApiKey)
  url.searchParams.set("cx", config.googleSearchEngineId)
  url.searchParams.set("q", String(query || "").trim())
  url.searchParams.set("num", String(Math.max(1, Math.min(Number(options.num || 5) || 5, 10))))
  url.searchParams.set("safe", "active")
  url.searchParams.set("hl", String(options.hl || "pt-BR"))
  url.searchParams.set("gl", String(options.gl || "br"))

  if (options.searchType === "image") {
    url.searchParams.set("searchType", "image")
    url.searchParams.set("imgSize", String(options.imgSize || "large"))
  }

  if (options.siteSearch) {
    url.searchParams.set("siteSearch", String(options.siteSearch))
  }

  const response = await fetchImpl(url, {
    headers: buildRequestHeaders(config)
  })

  if (!response.ok) {
    const details = await response.text().catch(() => "")
    /** @type {LiveResearchError} */
    const error = new Error("Falha ao consultar o Google Custom Search.")
    error.code = "GOOGLE_CUSTOM_SEARCH_FAILED"
    error.details = details.slice(0, 400)
    throw error
  }

  const payload = await response.json()
  const sanitizedItems = sanitizeGoogleSearchItems(Array.isArray(payload?.items) ? payload.items : [], {
    blockedDomains: config.blockedDomains
  })
  const allowedHosts = Array.isArray(options.allowedHosts)
    ? options.allowedHosts.map((entry) => normalizeLooseText(entry)).filter(Boolean)
    : []

  return {
    provider: "google_custom_search",
    searchType: options.searchType === "image" ? "image" : "web",
    items: sanitizedItems.filter((item) => isAllowedSearchHost(safeUrlHostname(item.link), allowedHosts))
  }
}

/**
 * @param {GoogleCustomSearchPayload} [payload]
 * @returns {string}
 */
export function summarizeGoogleSearchResults(payload = { provider: "google_custom_search", items: [] }) {
  const items = Array.isArray(payload?.items) ? payload.items : []
  if (!items.length) return ""

  return items
    .slice(0, 5)
    .map((item, index) => {
      const source = item.displayLink || safeUrlHostname(item.link)
      return `${index + 1}. ${item.title}\nFonte: ${source}\nResumo: ${item.snippet}`
    })
    .join("\n\n")
}

function isPrivateOrLocalIp(value = "") {
  const ip = String(value || "").trim()
  if (!ip) return true
  return (
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    ip.startsWith("::ffff:127.0.0.1") ||
    ip.startsWith("::ffff:10.") ||
    ip.startsWith("::ffff:192.168.")
  )
}

/**
 * @param {string} [ip]
 * @param {{ config?: LiveWebRuntimeConfig | null, fetchImpl?: typeof fetch }} [deps]
 * @returns {Promise<WeatherLocationResolution | null>}
 */
export async function resolveApproximateLocationByIp(ip = "", deps = {}) {
  const config = deps?.config || getLiveWebRuntimeConfig()
  const fetchImpl = typeof deps?.fetchImpl === "function" ? deps.fetchImpl : fetch
  const sanitizedIp = String(ip || "")
    .replace(/^::ffff:/, "")
    .trim()

  const target = !sanitizedIp || isPrivateOrLocalIp(sanitizedIp)
    ? `${config.ipGeolocationApiBaseUrl}/`
    : `${config.ipGeolocationApiBaseUrl}/${sanitizedIp}`

  const response = await fetchImpl(target, {
    headers: buildRequestHeaders(config)
  })

  if (!response.ok) {
    /** @type {LiveResearchError} */
    const error = new Error("Falha ao consultar geolocalizacao por IP.")
    error.code = "IP_GEOLOCATION_FAILED"
    throw error
  }

  const payload = await response.json()
  if (payload?.success === false) {
    /** @type {LiveResearchError} */
    const error = new Error(String(payload?.message || "Geolocalizacao por IP indisponivel."))
    error.code = "IP_GEOLOCATION_FAILED"
    throw error
  }

  const latitude = Number(payload?.latitude)
  const longitude = Number(payload?.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }

  const label = [payload?.city, payload?.region, payload?.country]
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" - ")

  return {
    label: label || String(payload?.country || "Local aproximado"),
    latitude,
    longitude,
    forecastDays: 3,
    timezone: String(payload?.timezone?.id || payload?.timezone || "auto")
  }
}
