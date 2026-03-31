import type {
  GoogleSearchItem,
  GoogleCustomSearchOptions,
  GoogleCustomSearchPayload,
  WeatherLocationResolution
} from "../../../packages/ai-core/src/aiContracts.js"

interface LiveResearchError extends Error {
  code?: string
  details?: string
}

interface LiveWebRuntimeConfig {
  googleSearchApiKey: string
  googleSearchEngineId: string
  googleCustomSearchApiBaseUrl: string
  ipGeolocationApiBaseUrl: string
  blockedDomains: string[]
  userAgent: string
}

interface GoogleSearchItemImage {
  contextLink: string
  thumbnailLink: string
  width: number | null
  height: number | null
}

type SearchOptions = GoogleCustomSearchOptions & {
  imgSize?: string
  siteSearch?: string
}

function normalizeLooseText(value = ""): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

export function getLiveWebRuntimeConfig(env: NodeJS.ProcessEnv = process.env): LiveWebRuntimeConfig {
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

export function buildRequestHeaders(config: LiveWebRuntimeConfig = getLiveWebRuntimeConfig()): Record<string, string> {
  return {
    "User-Agent": config.userAgent
  }
}

export function safeUrlHostname(value = ""): string {
  try {
    return new URL(value).hostname.toLowerCase()
  } catch {
    return ""
  }
}

function isBlockedSearchHost(hostname = "", blockedDomains: string[] = []): boolean {
  if (!hostname) return false
  return blockedDomains.some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`))
}

function isAllowedSearchHost(hostname = "", allowedHosts: string[] = []): boolean {
  if (!hostname || !Array.isArray(allowedHosts) || !allowedHosts.length) return true
  return allowedHosts.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`))
}

export function sanitizeGoogleSearchItems(items: Array<Record<string, unknown>> = [], options: { blockedDomains?: string[] } = {}): GoogleSearchItem[] {
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
          contextLink: String((item.image as Record<string, unknown>).contextLink || "").trim(),
          thumbnailLink: String((item.image as Record<string, unknown>).thumbnailLink || "").trim(),
          width: Number((item.image as Record<string, unknown>).width || 0) || null,
          height: Number((item.image as Record<string, unknown>).height || 0) || null
        }
        : null
    }))
    .filter((item) => item.title && item.link)
    .filter((item) => !isBlockedSearchHost(safeUrlHostname(item.link), blockedDomains))
}

export function hasGoogleCustomSearchConfigured(config: LiveWebRuntimeConfig = getLiveWebRuntimeConfig()): boolean {
  return Boolean(config.googleSearchApiKey && config.googleSearchEngineId)
}

export async function performGoogleCustomSearch(
  query: string,
  options: SearchOptions = {},
  deps: { config?: LiveWebRuntimeConfig | null, fetchImpl?: typeof fetch } = {}
): Promise<GoogleCustomSearchPayload> {
  const config = deps?.config || getLiveWebRuntimeConfig()
  const fetchImpl = typeof deps?.fetchImpl === "function" ? deps.fetchImpl : fetch

  if (!hasGoogleCustomSearchConfigured(config)) {
    const error: LiveResearchError = new Error("Google Custom Search nao configurado nesta execucao.")
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
    const error: LiveResearchError = new Error("Falha ao consultar o Google Custom Search.")
    error.code = "GOOGLE_CUSTOM_SEARCH_FAILED"
    error.details = details.slice(0, 400)
    throw error
  }

  const payload = await response.json() as Record<string, unknown>
  const sanitizedItems = sanitizeGoogleSearchItems(Array.isArray(payload?.items) ? payload.items as Array<Record<string, unknown>> : [], {
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

export function summarizeGoogleSearchResults(payload: GoogleCustomSearchPayload = { provider: "google_custom_search", items: [] }): string {
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

function isPrivateOrLocalIp(value = ""): boolean {
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

export async function resolveApproximateLocationByIp(
  ip = "",
  deps: { config?: LiveWebRuntimeConfig | null, fetchImpl?: typeof fetch } = {}
): Promise<WeatherLocationResolution | null> {
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
    const error: LiveResearchError = new Error("Falha ao consultar geolocalizacao por IP.")
    error.code = "IP_GEOLOCATION_FAILED"
    throw error
  }

  const payload = await response.json() as Record<string, unknown>
  if (payload?.success === false) {
    const error: LiveResearchError = new Error(String(payload?.message || "Geolocalizacao por IP indisponivel."))
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

  const timezonePayload = payload?.timezone
  const timezone = typeof timezonePayload === "object" && timezonePayload
    ? String((timezonePayload as Record<string, unknown>).id || "auto")
    : String(timezonePayload || "auto")

  return {
    label: label || String(payload?.country || "Local aproximado"),
    latitude,
    longitude,
    forecastDays: 3,
    timezone
  }
}
