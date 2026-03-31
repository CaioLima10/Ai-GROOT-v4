import type { RuntimeClock, RuntimeClockMeta } from "../../../packages/ai-core/src/aiContracts.js"

interface RuntimeClockError extends Error {
  code?: string
}

interface ClockCacheEntry {
  value: RuntimeClock
  expiresAt: number
}

interface BuildClockPayloadInput {
  nowMs?: number
  timezone?: string
  source?: string
  verified?: boolean
  fetchedAt?: string | null
  utcIso?: string | null
  localIso?: string | null
  utcOffset?: string | null
  unixTime?: number | null
}

const TIME_VERIFICATION_ENABLED = process.env.TIME_VERIFICATION_ENABLED !== "false"
const TIME_VERIFICATION_API_BASE_URL = String(
  process.env.TIME_VERIFICATION_API_BASE_URL || "https://worldtimeapi.org/api/timezone"
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

const runtimeClockCache = new Map<string, ClockCacheEntry>()

function sanitizeTimeZone(value = ""): string {
  const normalized = String(value || "").trim()
  if (!normalized || normalized === "auto") {
    return TIME_VERIFICATION_DEFAULT_ZONE
  }
  return /^[A-Za-z0-9_+\-./]+$/.test(normalized) ? normalized : TIME_VERIFICATION_DEFAULT_ZONE
}

function buildZonePath(timezone = TIME_VERIFICATION_DEFAULT_ZONE): string {
  return sanitizeTimeZone(timezone)
    .split("/")
    .map((entry) => encodeURIComponent(entry))
    .join("/")
}

function readClockCache(key: string): RuntimeClock | null {
  const cached = runtimeClockCache.get(key)
  if (!cached) return null
  if (cached.expiresAt <= Date.now()) {
    runtimeClockCache.delete(key)
    return null
  }
  return cached.value
}

function writeClockCache(key: string, value: RuntimeClock, ttlMs = TIME_VERIFICATION_CACHE_TTL_MS): RuntimeClock {
  runtimeClockCache.set(key, {
    value,
    expiresAt: Date.now() + Math.max(1_000, ttlMs)
  })
  return value
}

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
}: BuildClockPayloadInput = {}): RuntimeClock {
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

function buildSystemClock(timezone = TIME_VERIFICATION_DEFAULT_ZONE, reason = ""): RuntimeClock {
  return buildClockPayload({
    nowMs: Date.now(),
    timezone,
    source: reason ? `system_clock:${reason}` : "system_clock",
    verified: false
  })
}

async function fetchClockFromWorldTimeApi(timezone = TIME_VERIFICATION_DEFAULT_ZONE): Promise<RuntimeClock> {
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
      const error: RuntimeClockError = new Error(`HTTP ${response.status}`)
      error.code = "TIME_VERIFICATION_HTTP_ERROR"
      throw error
    }

    const payload = await response.json() as Record<string, unknown>
    const explicitNowMs = Number(payload.unixtime) * 1000
    const parsedNowMs = Number.isFinite(explicitNowMs) && explicitNowMs > 0
      ? explicitNowMs
      : Date.parse(String(payload.utc_datetime || payload.datetime || ""))

    if (!Number.isFinite(parsedNowMs)) {
      const error: RuntimeClockError = new Error("Resposta de horario sem timestamp valido")
      error.code = "TIME_VERIFICATION_INVALID_PAYLOAD"
      throw error
    }

    return buildClockPayload({
      nowMs: parsedNowMs,
      timezone: String(payload.timezone || timezone || TIME_VERIFICATION_DEFAULT_ZONE),
      source: "worldtimeapi",
      verified: true,
      fetchedAt: new Date().toISOString(),
      utcIso: String(payload.utc_datetime || new Date(parsedNowMs).toISOString()),
      localIso: String(payload.datetime || payload.utc_datetime || new Date(parsedNowMs).toISOString()),
      utcOffset: payload.utc_offset != null ? String(payload.utc_offset) : null,
      unixTime: typeof payload.unixtime === "number" ? payload.unixtime : null
    })
  } finally {
    clearTimeout(timeout)
  }
}

export async function getVerifiedRuntimeClock(timezone = TIME_VERIFICATION_DEFAULT_ZONE): Promise<RuntimeClock> {
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
    const runtimeError = error as RuntimeClockError
    return writeClockCache(cacheKey, buildSystemClock(resolvedTimezone, runtimeError?.code || "fallback"))
  }
}

export function formatDateInTimeZone(timestampMs = Date.now(), timezone = TIME_VERIFICATION_DEFAULT_ZONE): string {
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

export function buildClockVerificationMeta(clock: RuntimeClock | null = null): RuntimeClockMeta | null {
  if (!clock || typeof clock !== "object") return null
  return {
    source: String(clock.source || "system_clock"),
    verified: Boolean(clock.verified),
    timezone: String(clock.timezone || TIME_VERIFICATION_DEFAULT_ZONE),
    nowUtc: String(clock.utcIso || ""),
    fetchedAt: String(clock.fetchedAt || "")
  }
}
