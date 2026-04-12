// @ts-check

/** @typedef {import("../../../packages/ai-core/src/aiContracts").RuntimeClock} RuntimeClock */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").RuntimeClockMeta} RuntimeClockMeta */
/** @typedef {Error & { code?: string }} RuntimeClockError */

const TIME_VERIFICATION_ENABLED = process.env.TIME_VERIFICATION_ENABLED !== "false"
const TIME_VERIFICATION_API_BASE_URL = String(
  process.env.TIME_VERIFICATION_API_BASE_URL || "https://worldtimeapi.org/api/timezone"
).replace(/\/$/, "")
const TIME_VERIFICATION_SECONDARY_API_BASE_URL = String(
  process.env.TIME_VERIFICATION_SECONDARY_API_BASE_URL || "https://timeapi.io/api/Time/current/zone"
).replace(/\/$/, "")
const TIME_VERIFICATION_DEFAULT_ZONE = String(process.env.TIME_VERIFICATION_DEFAULT_ZONE || "Etc/UTC").trim() || "Etc/UTC"
const TIME_VERIFICATION_TIMEOUT_MS = Math.max(
  500,
  Number(process.env.TIME_VERIFICATION_TIMEOUT_MS || 2500)
)
const TIME_VERIFICATION_CACHE_TTL_MS = Math.max(
  5_000,
  Number(process.env.TIME_VERIFICATION_CACHE_TTL_MS || 60_000)
)

const runtimeClockCache = new Map()

function sanitizeTimeZone(value = "") {
  const normalized = String(value || "").trim()
  if (!normalized || normalized === "auto") {
    return TIME_VERIFICATION_DEFAULT_ZONE
  }
  return /^[A-Za-z0-9_+\-./]+$/.test(normalized) ? normalized : TIME_VERIFICATION_DEFAULT_ZONE
}

function buildZonePath(timezone = TIME_VERIFICATION_DEFAULT_ZONE) {
  return sanitizeTimeZone(timezone)
    .split("/")
    .map((entry) => encodeURIComponent(entry))
    .join("/")
}

function readClockCache(key = "") {
  const cached = runtimeClockCache.get(key)
  if (!cached) return null
  if (cached.expiresAt <= Date.now()) {
    runtimeClockCache.delete(key)
    return null
  }
  return cached.value
}

function writeClockCache(key = "", value = null, ttlMs = TIME_VERIFICATION_CACHE_TTL_MS) {
  runtimeClockCache.set(key, {
    value,
    expiresAt: Date.now() + Math.max(1_000, ttlMs)
  })
  return value
}

/**
 * @param {{
 *   nowMs?: number;
 *   timezone?: string;
 *   source?: string;
 *   verified?: boolean;
 *   fetchedAt?: string | null;
 *   utcIso?: string | null;
 *   localIso?: string | null;
 *   utcOffset?: string | null;
 *   unixTime?: number | null;
 * }} [input]
 * @returns {RuntimeClock}
 */
function buildClockPayload({
  nowMs = Date.now(),
  timezone = TIME_VERIFICATION_DEFAULT_ZONE,
  source = "system_clock",
  verified = false,
  fetchedAt = null,
  utcIso = null,
  localIso = null,
  utcOffset = null,
  unixTime = null
} = {}) {
  const safeNowMs = Number(nowMs)
  const resolvedNowMs = Number.isFinite(safeNowMs) ? safeNowMs : Date.now()
  const resolvedUtcIso = String(utcIso || new Date(resolvedNowMs).toISOString())
  const resolvedTimezone = sanitizeTimeZone(timezone)

  return {
    nowMs: resolvedNowMs,
    unixTime: Number.isFinite(Number(unixTime)) ? Number(unixTime) : Math.floor(resolvedNowMs / 1000),
    utcIso: resolvedUtcIso,
    localIso: String(localIso || resolvedUtcIso),
    timezone: resolvedTimezone,
    utcOffset: utcOffset == null ? null : String(utcOffset),
    source: String(source || "system_clock"),
    verified: Boolean(verified),
    fetchedAt: String(fetchedAt || new Date().toISOString())
  }
}

/**
 * @param {string} [timezone]
 * @param {string} [reason]
 * @returns {RuntimeClock}
 */
function buildSystemClock(timezone = TIME_VERIFICATION_DEFAULT_ZONE, reason = "") {
  return buildClockPayload({
    nowMs: Date.now(),
    timezone,
    source: reason ? `system_clock:${reason}` : "system_clock",
    verified: false
  })
}

function parseUtcOffsetToMs(value) {
  const raw = String(value || "").trim()
  if (!raw) return null
  const match = raw.match(/^([+-])(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return null

  const sign = match[1] === "-" ? -1 : 1
  const hours = Number(match[2])
  const minutes = Number(match[3])
  const seconds = Number(match[4] || "0")
  if (![hours, minutes, seconds].every((entry) => Number.isFinite(entry))) {
    return null
  }

  return sign * (((hours * 60) + minutes) * 60 + seconds) * 1000
}

function parseTimeApiNowMs(payload = {}) {
  const unixSeconds = Number(payload?.unixTime || payload?.unixtime || payload?.unix || 0)
  if (Number.isFinite(unixSeconds) && unixSeconds > 0) {
    return unixSeconds > 10_000_000_000 ? unixSeconds : unixSeconds * 1000
  }

  const utcCandidates = [
    payload?.dateTimeUtc,
    payload?.utcDateTime,
    payload?.utc_datetime,
    payload?.datetime_utc
  ]
  for (const candidate of utcCandidates) {
    const parsed = Date.parse(String(candidate || ""))
    if (Number.isFinite(parsed)) return parsed
  }

  const localIso = String(
    payload?.dateTime || payload?.datetime || payload?.currentLocalTime || payload?.localDateTime || ""
  ).trim()
  if (localIso) {
    const hasOffset = /(?:Z|[+-]\d{2}:\d{2})$/i.test(localIso)
    if (hasOffset) {
      const parsed = Date.parse(localIso)
      if (Number.isFinite(parsed)) return parsed
    }

    const parsedLocalAsUtc = Date.parse(`${localIso}Z`)
    if (Number.isFinite(parsedLocalAsUtc)) {
      const offsetMs = parseUtcOffsetToMs(payload?.utcOffset || payload?.currentUtcOffset || payload?.utc_offset)
      if (Number.isFinite(offsetMs)) {
        return parsedLocalAsUtc - Number(offsetMs)
      }
    }
  }

  return Number.NaN
}

/**
 * @param {string} [timezone]
 * @returns {Promise<RuntimeClock>}
 */
async function fetchClockFromWorldTimeApi(timezone = TIME_VERIFICATION_DEFAULT_ZONE) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIME_VERIFICATION_TIMEOUT_MS)

  try {
    const response = await fetch(`${TIME_VERIFICATION_API_BASE_URL}/${buildZonePath(timezone)}`, {
      signal: controller.signal,
      headers: {
        "User-Agent": "GIOM-RuntimeClock/1.0"
      }
    })

    if (!response.ok) {
      /** @type {RuntimeClockError} */
      const error = new Error(`HTTP ${response.status}`)
      error.code = "TIME_VERIFICATION_HTTP_ERROR"
      throw error
    }

    const payload = await response.json()
    const explicitNowMs = Number(payload?.unixtime) * 1000
    const parsedNowMs = Number.isFinite(explicitNowMs) && explicitNowMs > 0
      ? explicitNowMs
      : Date.parse(String(payload?.utc_datetime || payload?.datetime || ""))

    if (!Number.isFinite(parsedNowMs)) {
      /** @type {RuntimeClockError} */
      const error = new Error("Resposta de horario sem timestamp valido")
      error.code = "TIME_VERIFICATION_INVALID_PAYLOAD"
      throw error
    }

    return buildClockPayload({
      nowMs: parsedNowMs,
      timezone: String(payload?.timezone || timezone || TIME_VERIFICATION_DEFAULT_ZONE),
      source: "worldtimeapi",
      verified: true,
      fetchedAt: new Date().toISOString(),
      utcIso: String(payload?.utc_datetime || new Date(parsedNowMs).toISOString()),
      localIso: String(payload?.datetime || payload?.utc_datetime || new Date(parsedNowMs).toISOString()),
      utcOffset: payload?.utc_offset || null,
      unixTime: payload?.unixtime
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchClockFromTimeApiIo(timezone = TIME_VERIFICATION_DEFAULT_ZONE) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIME_VERIFICATION_TIMEOUT_MS)

  try {
    const resolvedTimezone = sanitizeTimeZone(timezone)
    const url = `${TIME_VERIFICATION_SECONDARY_API_BASE_URL}?timeZone=${encodeURIComponent(resolvedTimezone)}`
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "GIOM-RuntimeClock/1.0"
      }
    })

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`)
      error.code = "TIME_VERIFICATION_SECONDARY_HTTP_ERROR"
      throw error
    }

    const payload = await response.json()
    const parsedNowMs = parseTimeApiNowMs(payload)
    if (!Number.isFinite(parsedNowMs)) {
      const error = new Error("Resposta TimeAPI sem timestamp valido")
      error.code = "TIME_VERIFICATION_SECONDARY_INVALID_PAYLOAD"
      throw error
    }

    return buildClockPayload({
      nowMs: parsedNowMs,
      timezone: String(payload?.timeZone || payload?.timezone || timezone || TIME_VERIFICATION_DEFAULT_ZONE),
      source: "timeapiio",
      verified: true,
      fetchedAt: new Date().toISOString(),
      utcIso: new Date(parsedNowMs).toISOString(),
      localIso: String(payload?.dateTime || payload?.datetime || payload?.currentLocalTime || new Date(parsedNowMs).toISOString()),
      utcOffset: payload?.utcOffset != null
        ? String(payload?.utcOffset)
        : (payload?.currentUtcOffset != null ? String(payload?.currentUtcOffset) : null),
      unixTime: Math.floor(parsedNowMs / 1000)
    })
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * @param {string} [timezone]
 * @returns {Promise<RuntimeClock>}
 */
export async function getVerifiedRuntimeClock(timezone = TIME_VERIFICATION_DEFAULT_ZONE) {
  const resolvedTimezone = sanitizeTimeZone(timezone)
  const cacheKey = resolvedTimezone
  const cached = readClockCache(cacheKey)
  if (cached) {
    return cached
  }

  if (!TIME_VERIFICATION_ENABLED) {
    return writeClockCache(cacheKey, buildSystemClock(resolvedTimezone, "disabled"))
  }

  try {
    const verifiedClock = await fetchClockFromWorldTimeApi(resolvedTimezone)
    return writeClockCache(cacheKey, verifiedClock)
  } catch (error) {
    const primaryError = /** @type {RuntimeClockError} */ (error)
    try {
      const secondaryClock = await fetchClockFromTimeApiIo(resolvedTimezone)
      return writeClockCache(cacheKey, secondaryClock)
    } catch (secondaryError) {
      const runtimeError = /** @type {RuntimeClockError} */ (secondaryError)
      return writeClockCache(
        cacheKey,
        buildSystemClock(resolvedTimezone, runtimeError?.code || primaryError?.code || "fallback")
      )
    }
  }
}

export function formatDateInTimeZone(timestampMs = Date.now(), timezone = TIME_VERIFICATION_DEFAULT_ZONE) {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: sanitizeTimeZone(timezone),
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    })
    const parts = formatter.formatToParts(new Date(timestampMs))
    const year = parts.find((part) => part.type === "year")?.value
    const month = parts.find((part) => part.type === "month")?.value
    const day = parts.find((part) => part.type === "day")?.value
    if (year && month && day) {
      return `${year}-${month}-${day}`
    }
  } catch {
    // ignore and use UTC fallback below
  }

  return new Date(timestampMs).toISOString().slice(0, 10)
}

/**
 * @param {RuntimeClock | null} [clock]
 * @returns {RuntimeClockMeta | null}
 */
export function buildClockVerificationMeta(clock = null) {
  if (!clock || typeof clock !== "object") return null
  return {
    source: String(clock.source || "system_clock"),
    verified: Boolean(clock.verified),
    timezone: String(clock.timezone || TIME_VERIFICATION_DEFAULT_ZONE),
    nowUtc: String(clock.utcIso || ""),
    fetchedAt: String(clock.fetchedAt || "")
  }
}
