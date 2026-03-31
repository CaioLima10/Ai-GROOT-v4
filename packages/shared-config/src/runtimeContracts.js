// @ts-check

export const GIOM_MESSAGE_TYPES = Object.freeze([
  "text",
  "code",
  "document",
  "prompt",
  "checklist",
  "table",
  "timeline",
  "image",
  "video",
  "map",
  "data"
])

export const GIOM_DATA_VARIANTS = Object.freeze([
  "weather",
  "fixture",
  "stats"
])

export const ALLOWED_ASK_CONTEXT_KEYS = Object.freeze([
  "channel",
  "migrationStage",
  "uploadId",
  "uploadIds",
  "uploadName",
  "uploadNames",
  "uploadType",
  "plan",
  "source",
  "assistantProfile",
  "activeModules",
  "domain",
  "locale",
  "language",
  "instructions",
  "preferredResponseCard",
  "preferredResponseVariant",
  "weatherLocation",
  "domainSubmodules",
  "bibleStudyModules",
  "promptPacks",
  "researchCapabilities",
  "preferredBibleCode",
  "ministryFocus",
  "userStyle",
  "depthPreference",
  "ageGroup",
  "verbosity",
  "examples",
  "noEmojis",
  "safetyLevel",
  "evaluationMode",
  "evaluationScenario",
  "conversationHistory"
])

const DEFAULT_CONTEXT_LIMITS = Object.freeze({
  maxStringLength: 2000,
  maxArrayItems: 12,
  maxObjectEntries: 24
})

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

/**
 * @param {string} value
 * @returns {number}
 */
function measureUtf8Bytes(value) {
  const source = String(value || "")

  try {
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(source).length
    }
  } catch {
    // Ignore and use Buffer fallback below.
  }

  if (typeof Buffer !== "undefined") {
    return Buffer.byteLength(source, "utf8")
  }

  return source.length
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeGiomMessageType(value) {
  if (typeof value !== "string") return null

  const normalized = value.trim().toLowerCase()
  return GIOM_MESSAGE_TYPES.includes(normalized) ? normalized : null
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeGiomDataVariant(value) {
  if (typeof value !== "string") return null

  const normalized = value.trim().toLowerCase()
  return GIOM_DATA_VARIANTS.includes(normalized) ? normalized : null
}

/**
 * @param {unknown} value
 * @returns {value is string | Record<string, unknown> | unknown[]}
 */
export function isGiomRenderableContent(value) {
  return typeof value === "string" || Array.isArray(value) || isPlainObject(value)
}

/**
 * @param {unknown} value
 * @param {{ maxStringLength?: number, maxArrayItems?: number, maxObjectEntries?: number }} [limits]
 * @returns {unknown}
 */
export function sanitizeAskContextValue(value, limits = DEFAULT_CONTEXT_LIMITS) {
  const maxStringLength = Number(limits.maxStringLength || DEFAULT_CONTEXT_LIMITS.maxStringLength)
  const maxArrayItems = Number(limits.maxArrayItems || DEFAULT_CONTEXT_LIMITS.maxArrayItems)
  const maxObjectEntries = Number(limits.maxObjectEntries || DEFAULT_CONTEXT_LIMITS.maxObjectEntries)

  if (value == null) return value
  if (typeof value === "string") return value.slice(0, maxStringLength)
  if (typeof value === "number" || typeof value === "boolean") return value

  if (Array.isArray(value)) {
    return value
      .slice(0, maxArrayItems)
      .map((entry) => sanitizeAskContextValue(entry, limits))
      .filter((entry) => entry !== undefined)
  }

  if (isPlainObject(value)) {
    /** @type {Record<string, unknown>} */
    const output = {}

    for (const [key, entry] of Object.entries(value).slice(0, maxObjectEntries)) {
      const normalized = sanitizeAskContextValue(entry, limits)
      if (normalized !== undefined) {
        output[key] = normalized
      }
    }

    return output
  }

  return undefined
}

/**
 * @param {unknown} context
 * @returns {Record<string, unknown>}
 */
export function sanitizeAskContext(context = {}) {
  const input = isPlainObject(context) ? context : {}
  /** @type {Record<string, unknown>} */
  const output = {}

  for (const key of ALLOWED_ASK_CONTEXT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) {
      continue
    }

    const normalized = sanitizeAskContextValue(input[key], DEFAULT_CONTEXT_LIMITS)
    if (normalized !== undefined) {
      output[key] = normalized
    }
  }

  return output
}

/**
 * @param {unknown} context
 * @returns {{ contextKeys: string[], contextBytes: number, droppedKeys: string[], rawContextKeys: string[] }}
 */
export function getAskContextDiagnostics(context = {}) {
  const rawContext = isPlainObject(context) ? context : {}
  const sanitizedContext = sanitizeAskContext(rawContext)
  let contextBytes = 0

  try {
    contextBytes = measureUtf8Bytes(JSON.stringify(sanitizedContext || {}))
  } catch {
    contextBytes = -1
  }

  return {
    contextKeys: Object.keys(sanitizedContext).slice(0, 20),
    contextBytes,
    droppedKeys: Object.keys(rawContext)
      .filter((key) => !Object.prototype.hasOwnProperty.call(sanitizedContext, key))
      .slice(0, 20),
    rawContextKeys: Object.keys(rawContext).slice(0, 20)
  }
}
