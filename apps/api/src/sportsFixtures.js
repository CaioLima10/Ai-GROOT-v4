// @ts-check

import { buildClockVerificationMeta } from "./runtimeClock.js"

/** @typedef {import("../../../packages/ai-core/src/aiContracts").FixtureVerification} FixtureVerification */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").FixtureSourceLink} FixtureSourceLink */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").LiveFixtureEntry} LiveFixtureEntry */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").RuntimeClock} RuntimeClock */

const SPORTS_UPCOMING_GRACE_MS = Math.max(
  0,
  Number(process.env.SPORTS_UPCOMING_GRACE_MS || 15 * 60 * 1000)
)
const SPORTS_LIVE_LOOKBACK_MS = Math.max(
  60 * 60 * 1000,
  Number(process.env.SPORTS_LIVE_LOOKBACK_MS || 4 * 60 * 60 * 1000)
)
const SPORTS_STALE_SCHEDULE_LOOKBACK_MS = Math.max(
  SPORTS_UPCOMING_GRACE_MS,
  Number(process.env.SPORTS_STALE_SCHEDULE_LOOKBACK_MS || 6 * 60 * 60 * 1000)
)

function normalizeLooseText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

export function formatFixtureDateLabel(date = "", time = "", timestamp = "") {
  const explicitTimestamp = String(timestamp || "").trim()
  if (explicitTimestamp) {
    const explicitDate = new Date(explicitTimestamp)
    if (!Number.isNaN(explicitDate.getTime())) {
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short"
      }).format(explicitDate)
    }
  }

  const normalizedDate = String(date || "").trim()
  const normalizedTime = String(time || "").trim()
  if (!normalizedDate) return "Em breve"

  const iso = normalizedTime
    ? `${normalizedDate}T${normalizedTime.replace(" ", "")}`
    : `${normalizedDate}T12:00:00`

  const fixtureDate = new Date(iso)
  if (Number.isNaN(fixtureDate.getTime())) {
    return normalizedDate
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short"
  }).format(fixtureDate)
}

export function formatFixtureKickoff(date = "", time = "", timestamp = "") {
  const explicitTimestamp = String(timestamp || "").trim()
  if (explicitTimestamp) {
    const explicitDate = new Date(explicitTimestamp)
    if (!Number.isNaN(explicitDate.getTime())) {
      return new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      }).format(explicitDate)
    }
  }

  const normalizedDate = String(date || "").trim()
  const normalizedTime = String(time || "").trim()
  if (!normalizedDate || !normalizedTime) return normalizedTime || "--:--"

  const fixtureDate = new Date(`${normalizedDate}T${normalizedTime.replace(" ", "")}`)
  if (Number.isNaN(fixtureDate.getTime())) {
    return normalizedTime
  }

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(fixtureDate)
}

function extractEventDateParts(event = {}) {
  const timestamp = String(event?.strTimestamp || "").trim()
  if (timestamp) {
    const stamp = new Date(timestamp)
    if (!Number.isNaN(stamp.getTime())) {
      const iso = stamp.toISOString()
      return {
        date: iso.slice(0, 10),
        time: iso.slice(11, 16)
      }
    }
  }

  return {
    date: String(event?.dateEvent || "").slice(0, 10),
    time: String(event?.strTime || "").trim().slice(0, 5)
  }
}

function buildFixtureTimestamp(date = "", time = "", timestamp = "") {
  const explicit = String(timestamp || "").trim()
  if (explicit) {
    const parsed = new Date(explicit)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime()
    }
  }

  if (!date) return 0
  const parsed = new Date(`${date}T${time || "12:00"}`)
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

export function normalizeFixtureStatus(rawStatus = "", timestampMs = 0, hasExplicitTimestamp = false, referenceNowMs = Date.now()) {
  const normalized = normalizeLooseText(rawStatus)
  if (/^(match finished|finished|ft|after extra time|after penalties)$/.test(normalized)) return "encerrado"
  if (/(live|in play|halftime|first half|second half|paused|extra time|penalties)/.test(normalized)) return "ao vivo"
  if (/(postponed|cancelled|canceled|suspended)/.test(normalized)) return "adiado"
  if (/(not started|ns|scheduled|timed|time to be defined)/.test(normalized)) return "agendado"
  if (hasExplicitTimestamp && timestampMs && timestampMs < referenceNowMs - SPORTS_STALE_SCHEDULE_LOOKBACK_MS) return "encerrado"
  return "agendado"
}

export function isLiveFixtureStatus(value = "") {
  return normalizeLooseText(value) === "ao vivo"
}

function isClosedFixtureStatus(value = "") {
  return /^(encerrado|adiado)$/.test(normalizeLooseText(value))
}

export function isUpcomingFixtureCandidate(entry = {}, referenceNowMs = Date.now()) {
  const timestampMs = Number(entry?.timestampMs || 0)
  if (isLiveFixtureStatus(entry?.status)) {
    return timestampMs === 0 || timestampMs >= referenceNowMs - SPORTS_LIVE_LOOKBACK_MS
  }
  if (isClosedFixtureStatus(entry?.status)) {
    return false
  }
  if (timestampMs === 0) {
    return true
  }
  return timestampMs >= referenceNowMs - SPORTS_UPCOMING_GRACE_MS
}

export function isRecentFixtureCandidate(entry = {}, referenceNowMs = Date.now()) {
  const timestampMs = Number(entry?.timestampMs || 0)
  if (isClosedFixtureStatus(entry?.status)) {
    return true
  }
  if (isLiveFixtureStatus(entry?.status)) {
    return false
  }
  if (timestampMs === 0) {
    return false
  }
  return timestampMs < referenceNowMs - SPORTS_UPCOMING_GRACE_MS
}

export function sortUpcomingFixtures(left = {}, right = {}) {
  const leftLive = isLiveFixtureStatus(left?.status)
  const rightLive = isLiveFixtureStatus(right?.status)
  if (leftLive !== rightLive) {
    return leftLive ? -1 : 1
  }

  const leftStamp = Number(left?.timestampMs || 0)
  const rightStamp = Number(right?.timestampMs || 0)
  const safeLeft = leftStamp > 0 ? leftStamp : Number.MAX_SAFE_INTEGER
  const safeRight = rightStamp > 0 ? rightStamp : Number.MAX_SAFE_INTEGER
  return safeLeft - safeRight
}

/**
 * @param {Record<string, unknown>} [event]
 * @param {string} [provider]
 * @param {number} [referenceNowMs]
 * @returns {LiveFixtureEntry}
 */
export function normalizeFixtureEvent(event = {}, provider = "thesportsdb", referenceNowMs = Date.now()) {
  const { date, time } = extractEventDateParts(event)
  const explicitTimestamp = String(event?.strTimestamp || "").trim()
  const rawStatus = typeof event?.strStatus === "string" ? event.strStatus : String(event?.strStatus || "")
  const hasExplicitTimestamp = explicitTimestamp.length > 0
  const timestampMs = buildFixtureTimestamp(date, time, explicitTimestamp)
  const dateLabel = formatFixtureDateLabel(date, time, explicitTimestamp)
  const kickoff = formatFixtureKickoff(date, time, explicitTimestamp)
  const status = normalizeFixtureStatus(rawStatus, timestampMs, hasExplicitTimestamp, referenceNowMs)

  return {
    id: String(event?.idEvent || `${event?.strHomeTeam || "home"}-${event?.strAwayTeam || "away"}-${date || "date"}`),
    provider,
    league: String(event?.strLeague || event?.strLeagueAlternate || "Agenda esportiva"),
    homeTeam: String(event?.strHomeTeam || "Mandante"),
    awayTeam: String(event?.strAwayTeam || "Visitante"),
    homeScore: event?.intHomeScore != null ? Number(event.intHomeScore) : null,
    awayScore: event?.intAwayScore != null ? Number(event.intAwayScore) : null,
    kickoff,
    dateLabel,
    status,
    venue: String(event?.strVenue || "").trim(),
    timestampMs,
    timeAuthority: hasExplicitTimestamp ? "explicit_utc" : (time ? "provider_local" : "date_only"),
    summary: [
      `Competicao: ${String(event?.strLeague || event?.strLeagueAlternate || "Agenda esportiva")}.`,
      `Partida: ${String(event?.strHomeTeam || "Mandante")} x ${String(event?.strAwayTeam || "Visitante")}.`,
      `Data: ${dateLabel}.`,
      kickoff && kickoff !== "--:--" ? `Horario: ${kickoff}.` : null,
      event?.strVenue ? `Local: ${String(event.strVenue).trim()}.` : null
    ].filter(Boolean).join(" ")
  }
}

/**
 * @param {{
 *   nextMatches?: LiveFixtureEntry[];
 *   recentMatches?: LiveFixtureEntry[];
 *   liveMatches?: LiveFixtureEntry[];
 *   sourceLinks?: FixtureSourceLink[];
 *   usedSeasonSchedule?: boolean;
 *   referenceClock?: RuntimeClock | null;
 * }} [context]
 * @returns {FixtureVerification}
 */
export function buildFixtureVerification(context = {}) {
  const nextMatches = Array.isArray(context?.nextMatches) ? context.nextMatches : []
  const recentMatches = Array.isArray(context?.recentMatches) ? context.recentMatches : []
  const liveMatches = Array.isArray(context?.liveMatches) ? context.liveMatches : []
  const sourceLinks = Array.isArray(context?.sourceLinks) ? context.sourceLinks : []
  const usedSeasonSchedule = Boolean(context?.usedSeasonSchedule)
  const referenceClock = context?.referenceClock && typeof context.referenceClock === "object"
    ? context.referenceClock
    : null

  let status = "safe"
  let label = "modo seguro"
  if (usedSeasonSchedule && (nextMatches.length > 0 || recentMatches.length > 0)) {
    status = "checked"
    label = "dados conferidos"
  } else if (nextMatches.length > 0 || recentMatches.length > 0) {
    status = "partial"
    label = "validacao parcial"
  }

  const note = [
    usedSeasonSchedule ? "Calendario completo da temporada consultado." : "Sem calendario completo da temporada nesta consulta.",
    liveMatches.length > 0 ? "Jogo em andamento identificado." : null,
    recentMatches.length > 0 ? `Ultimos jogos disponiveis: ${Math.min(5, recentMatches.length)}.` : null,
    sourceLinks.length > 0 ? `Fontes externas adicionais: ${Math.min(2, sourceLinks.length)}.` : null,
    referenceClock?.verified
      ? "Horario UTC conferido em fonte externa de tempo."
      : "Horario UTC baseado no relogio local desta execucao."
  ].filter(Boolean).join(" ")

  return {
    status,
    label,
    note,
    checkedAt: referenceClock?.utcIso || new Date().toISOString(),
    clock: buildClockVerificationMeta(referenceClock),
    providerChain: [
      "TheSportsDB",
      usedSeasonSchedule ? "TheSportsDB season schedule" : null,
      referenceClock?.verified ? "WorldTimeAPI" : "system_clock",
      sourceLinks.length > 0 ? "Google Custom Search" : null
    ].filter(Boolean)
  }
}

/**
 * @param {LiveFixtureEntry[]} [items]
 * @returns {LiveFixtureEntry[]}
 */
export function dedupeFixtures(items = []) {
  const unique = new Map()
  for (const item of items) {
    const key = String(item?.id || item?.summary || "")
    if (!key || unique.has(key)) continue
    unique.set(key, item)
  }
  return Array.from(unique.values())
}
