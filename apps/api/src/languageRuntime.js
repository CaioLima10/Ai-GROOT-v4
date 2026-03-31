import crypto from "crypto"
import fs from "fs/promises"
import path from "path"

const REQUEST_TIMEOUT_MS = 8000
const MAX_REMOTE_TEXT_LENGTH = 2000
const LANGUAGE_RUNTIME_CACHE_TTL_MS = Math.max(
  60_000,
  Number(process.env.LANGUAGE_RUNTIME_CACHE_TTL_MS || 6 * 60 * 60 * 1000)
)
const LANGUAGE_RUNTIME_CACHE_DIR = process.env.LANGUAGE_RUNTIME_CACHE_DIR
  ? path.resolve(process.cwd(), process.env.LANGUAGE_RUNTIME_CACHE_DIR)
  : path.join(process.cwd(), ".cache", "language-runtime")
const languageRuntimeCache = new Map()
const languageRuntimeStats = {
  totalRequests: 0,
  cacheHits: {
    memory: 0,
    disk: 0,
    miss: 0
  },
  modeUsage: {},
  providerUsage: {},
  fallbackCount: 0,
  errorCount: 0,
  lastAccessAt: null,
  lastCleanupAt: null
}

const LANGUAGE_NAME_TO_CODE = new Map([
  ["pt", "pt"],
  ["pt-br", "pt"],
  ["portugues", "pt"],
  ["portuguese", "pt"],
  ["ingles", "en"],
  ["english", "en"],
  ["en", "en"],
  ["es", "es"],
  ["espanhol", "es"],
  ["spanish", "es"],
  ["fr", "fr"],
  ["frances", "fr"],
  ["french", "fr"],
  ["it", "it"],
  ["italiano", "it"],
  ["italian", "it"],
  ["de", "de"],
  ["alemao", "de"],
  ["german", "de"]
])

const PORTUGUESE_HINTS = [" de ", " que ", " para ", " nao ", " você", " voce", " traduz", " corrija", " explique"]
const ENGLISH_HINTS = [" the ", " and ", " what ", " translate", " grammar", " meaning", " please "]
const SPANISH_HINTS = [" que ", " para ", " traduc", " correg", " significado", " por favor"]

function buildCacheKey(namespace = "default", payload = {}) {
  const serialized = JSON.stringify(payload)
  const hash = crypto.createHash("sha1").update(`${namespace}:${serialized}`).digest("hex")
  return `${namespace}-${hash}`
}

function incrementBucket(container = {}, key = "unknown") {
  const safeKey = String(key || "unknown")
  container[safeKey] = (container[safeKey] || 0) + 1
}

function noteCacheHit(kind = "miss") {
  if (kind === "memory" || kind === "disk" || kind === "miss") {
    languageRuntimeStats.cacheHits[kind] += 1
  }
}

function noteProvider(provider = "") {
  if (provider) {
    incrementBucket(languageRuntimeStats.providerUsage, provider)
  }
}

function readMemoryCache(cacheKey = "") {
  const cached = languageRuntimeCache.get(cacheKey)
  if (!cached) return null
  if (cached.expiresAt <= Date.now()) {
    languageRuntimeCache.delete(cacheKey)
    return null
  }
  return cached.value
}

function writeMemoryCache(cacheKey = "", value = null, ttlMs = LANGUAGE_RUNTIME_CACHE_TTL_MS) {
  languageRuntimeCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + Math.max(1_000, ttlMs)
  })
  return value
}

async function readDiskCache(cacheKey = "") {
  try {
    const filePath = path.join(LANGUAGE_RUNTIME_CACHE_DIR, `${cacheKey}.json`)
    const raw = await fs.readFile(filePath, "utf8")
    const parsed = JSON.parse(raw)
    if (!parsed || Number(parsed.expiresAt) <= Date.now()) {
      await fs.unlink(filePath).catch(() => { })
      return null
    }
    writeMemoryCache(cacheKey, parsed.value, Number(parsed.expiresAt) - Date.now())
    return parsed.value
  } catch {
    return null
  }
}

async function writeDiskCache(cacheKey = "", value = null, ttlMs = LANGUAGE_RUNTIME_CACHE_TTL_MS) {
  try {
    await fs.mkdir(LANGUAGE_RUNTIME_CACHE_DIR, { recursive: true })
    const filePath = path.join(LANGUAGE_RUNTIME_CACHE_DIR, `${cacheKey}.json`)
    await fs.writeFile(filePath, JSON.stringify({
      expiresAt: Date.now() + Math.max(1_000, ttlMs),
      value
    }), "utf8")
  } catch {
    // cache should never break runtime enrichment
  }
}

async function getOrSetCache(namespace = "default", payload = {}, compute, ttlMs = LANGUAGE_RUNTIME_CACHE_TTL_MS) {
  const cacheKey = buildCacheKey(namespace, payload)
  const memoryValue = readMemoryCache(cacheKey)
  if (memoryValue) {
    noteCacheHit("memory")
    return {
      value: {
        ...memoryValue,
        cacheHit: "memory"
      },
      cacheHit: "memory"
    }
  }

  const diskValue = await readDiskCache(cacheKey)
  if (diskValue) {
    noteCacheHit("disk")
    return {
      value: {
        ...diskValue,
        cacheHit: "disk"
      },
      cacheHit: "disk"
    }
  }

  const computedValue = await compute()
  noteCacheHit("miss")
  writeMemoryCache(cacheKey, computedValue, ttlMs)
  await writeDiskCache(cacheKey, computedValue, ttlMs)
  return {
    value: {
      ...computedValue,
      cacheHit: "miss"
    },
    cacheHit: "miss"
  }
}

async function listCacheFiles() {
  try {
    await fs.mkdir(LANGUAGE_RUNTIME_CACHE_DIR, { recursive: true })
    const entries = await fs.readdir(LANGUAGE_RUNTIME_CACHE_DIR, { withFileTypes: true })
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
  } catch {
    return []
  }
}

export async function cleanupLanguageRuntimeCache() {
  let removedMemoryEntries = 0
  let removedDiskEntries = 0

  for (const [cacheKey, cached] of languageRuntimeCache.entries()) {
    if (!cached || Number(cached.expiresAt) <= Date.now()) {
      languageRuntimeCache.delete(cacheKey)
      removedMemoryEntries += 1
    }
  }

  for (const entry of await listCacheFiles()) {
    const filePath = path.join(LANGUAGE_RUNTIME_CACHE_DIR, entry.name)
    try {
      const raw = await fs.readFile(filePath, "utf8")
      const parsed = JSON.parse(raw)
      if (!parsed || Number(parsed.expiresAt) <= Date.now()) {
        await fs.unlink(filePath).catch(() => { })
        removedDiskEntries += 1
      }
    } catch {
      await fs.unlink(filePath).catch(() => { })
      removedDiskEntries += 1
    }
  }

  languageRuntimeStats.lastCleanupAt = new Date().toISOString()

  return {
    removedMemoryEntries,
    removedDiskEntries,
    memoryEntriesAfterCleanup: languageRuntimeCache.size,
    cacheDir: LANGUAGE_RUNTIME_CACHE_DIR,
    lastCleanupAt: languageRuntimeStats.lastCleanupAt
  }
}

export async function getLanguageRuntimeStatus() {
  const diskEntries = await listCacheFiles()
  return {
    cache: {
      ttlMs: LANGUAGE_RUNTIME_CACHE_TTL_MS,
      dir: LANGUAGE_RUNTIME_CACHE_DIR,
      memoryEntries: languageRuntimeCache.size,
      diskEntries: diskEntries.length
    },
    stats: {
      ...languageRuntimeStats,
      cacheHits: { ...languageRuntimeStats.cacheHits },
      modeUsage: { ...languageRuntimeStats.modeUsage },
      providerUsage: { ...languageRuntimeStats.providerUsage }
    }
  }
}

function normalizeText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function createTimeoutSignal(ms) {
  return AbortSignal.timeout(ms)
}

function countHints(text = "", hints = []) {
  return hints.reduce((total, hint) => total + (text.includes(hint) ? 1 : 0), 0)
}

function normalizeLanguageToken(token = "") {
  return String(token || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z-]/g, "")
}

function inferLanguageCode(question = "", preferredLocale = "") {
  const normalizedQuestion = ` ${normalizeText(question).toLowerCase()} `
  const normalizedLocale = normalizeLanguageToken(String(preferredLocale || "").split(/[_.]/)[0])

  if (normalizedLocale && LANGUAGE_NAME_TO_CODE.has(normalizedLocale)) {
    return LANGUAGE_NAME_TO_CODE.get(normalizedLocale)
  }

  const scores = [
    ["pt", countHints(normalizedQuestion, PORTUGUESE_HINTS)],
    ["en", countHints(normalizedQuestion, ENGLISH_HINTS)],
    ["es", countHints(normalizedQuestion, SPANISH_HINTS)]
  ].sort((left, right) => right[1] - left[1])

  if (scores[0][1] > 0) {
    return scores[0][0]
  }

  return "pt"
}

function detectLanguageIntent(question = "") {
  const normalized = normalizeText(question).toLowerCase()

  if (/(^|\s)(traduza|traduzir|traducao|tradução|translate|translation)(\s|$)/.test(normalized)) {
    return "translation"
  }

  if (/(^|\s)(corrija|corrigir|correcao|correção|gramatica|gramática|ortografia|revise|rewrite|proofread)(\s|$)/.test(normalized)) {
    return "correction"
  }

  if (/(o que significa|qual o significado|meaning of|define|definition|idiom|idiomatic|expressao idiomatica|expressão idiomática|sinonimo|sinônimo)/.test(normalized)) {
    return "lexical"
  }

  return "general"
}

function extractQuotedSegments(question = "") {
  const matches = [...String(question || "").matchAll(/["“”'`´]([^"“”'`´]{1,300})["“”'`´]/g)]
  return matches.map((match) => normalizeText(match[1])).filter(Boolean)
}

function extractTailAfterMarker(question = "", markers = []) {
  const normalized = String(question || "")
  for (const marker of markers) {
    const index = normalized.toLowerCase().indexOf(marker)
    if (index >= 0) {
      return normalizeText(normalized.slice(index + marker.length))
    }
  }
  return ""
}

function extractTargetText(question = "", mode = "general") {
  const quoted = extractQuotedSegments(question)
  if (quoted.length) return quoted[0]

  if (mode === "translation") {
    const tail = extractTailAfterMarker(question, ["traduza", "traduzir", "translate", "translation of"])
    return tail.split(/\b(para|to|into|em)\b/i)[0].trim()
  }

  if (mode === "correction") {
    const tail = extractTailAfterMarker(question, ["corrija", "corrigir", "revise", "rewrite", "proofread"])
    return tail || normalizeText(question)
  }

  if (mode === "lexical") {
    const tail = extractTailAfterMarker(question, ["o que significa", "qual o significado", "meaning of", "define", "definition of"])
    return tail.split(/[?.!]/)[0].trim()
  }

  return ""
}

function resolveLanguageName(token = "") {
  const normalized = normalizeLanguageToken(token)
  return LANGUAGE_NAME_TO_CODE.get(normalized) || null
}

function inferTranslationPair(question = "", detectedLanguage = "pt", targetText = "") {
  const normalized = normalizeText(question).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  const fromMatch = normalized.match(/(?:de|from)\s+([a-z-]+)\s+(?:para|to|into)\s+([a-z-]+)/)
  if (fromMatch) {
    return {
      source: resolveLanguageName(fromMatch[1]) || detectedLanguage,
      target: resolveLanguageName(fromMatch[2]) || (detectedLanguage === "pt" ? "en" : "pt")
    }
  }

  const toMatch = normalized.match(/(?:para|to|into)\s+([a-z-]+)/)
  if (toMatch) {
    const inferredTarget = resolveLanguageName(toMatch[1]) || (detectedLanguage === "pt" ? "en" : "pt")
    const inferredSource = inferLanguageCode(targetText || question, detectedLanguage)
    return {
      source: inferredSource === inferredTarget ? (inferredTarget === "pt" ? "en" : "pt") : inferredSource,
      target: inferredTarget
    }
  }

  const inferredSource = inferLanguageCode(targetText || question, detectedLanguage)
  return {
    source: inferredSource === detectedLanguage ? (detectedLanguage === "pt" ? "en" : "pt") : inferredSource,
    target: detectedLanguage === "pt" ? "en" : "pt"
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: options.signal || createTimeoutSignal(REQUEST_TIMEOUT_MS)
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return response.json()
}

async function fetchTranslation(text, pair) {
  return getOrSetCache("translation", { text, pair }, async () => {
    try {
      const query = new URLSearchParams({
        q: text,
        langpair: `${pair.source}|${pair.target}`
      })

      const payload = await fetchJson(`https://api.mymemory.translated.net/get?${query.toString()}`)
      const translatedText = normalizeText(payload?.responseData?.translatedText || "")
      if (!translatedText || /PLEASE SELECT TWO DISTINCT LANGUAGES/i.test(translatedText)) {
        throw new Error("MYMEMORY_EMPTY_TRANSLATION")
      }

      return {
        provider: "mymemory",
        sourceLanguage: pair.source,
        targetLanguage: pair.target,
        translatedText,
        confidence: Number(payload?.responseData?.match || 0)
      }
    } catch (primaryError) {
      const payload = await fetchJson("https://libretranslate.com/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          q: text,
          source: pair.source,
          target: pair.target,
          format: "text"
        }),
        signal: createTimeoutSignal(12_000)
      })

      return {
        provider: "libretranslate",
        sourceLanguage: pair.source,
        targetLanguage: pair.target,
        translatedText: normalizeText(payload?.translatedText || ""),
        confidence: 0,
        fallbackFrom: primaryError?.message || "mymemory"
      }
    }
  }).then((entry) => entry.value)
}

async function fetchCorrection(text, language = "en-US") {
  return getOrSetCache("correction", { text, language }, async () => {
    const body = new URLSearchParams({
      text,
      language
    })

    const payload = await fetchJson("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body,
      signal: createTimeoutSignal(12000)
    })

    return {
      provider: "languagetool",
      language: payload?.language?.detectedLanguage?.code || language,
      detectedLanguage: payload?.language?.detectedLanguage?.name || null,
      matchesCount: Array.isArray(payload?.matches) ? payload.matches.length : 0,
      topMatches: Array.isArray(payload?.matches)
        ? payload.matches.slice(0, 3).map((match) => ({
          message: match.message,
          replacements: Array.isArray(match.replacements) ? match.replacements.slice(0, 3).map((item) => item.value) : []
        }))
        : []
    }
  }).then((entry) => entry.value)
}

async function fetchLexicalDefinition(term, detectedLanguage = "en") {
  return getOrSetCache("lexical", { term, detectedLanguage }, async () => {
    const normalizedTerm = encodeURIComponent(term)

    if (detectedLanguage === "en" && /^[a-zA-Z-]{1,40}$/.test(term)) {
      try {
        const payload = await fetchJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${normalizedTerm}`)
        const firstMeaning = payload?.[0]?.meanings?.[0]
        const definition = firstMeaning?.definitions?.[0]?.definition || null
        if (definition) {
          return {
            provider: "dictionaryapi",
            term,
            partOfSpeech: firstMeaning?.partOfSpeech || null,
            definition,
            example: firstMeaning?.definitions?.[0]?.example || null
          }
        }
      } catch {
        // fall through to wiktionary/datamuse
      }
    }

    try {
      const wiki = detectedLanguage === "pt" ? "pt.wiktionary.org" : "en.wiktionary.org"
      const query = new URLSearchParams({
        action: "query",
        prop: "extracts",
        format: "json",
        titles: term,
        explaintext: "1",
        redirects: "1"
      })
      const payload = await fetchJson(`https://${wiki}/w/api.php?${query.toString()}`)
      const firstPage = Object.values(payload?.query?.pages || {})[0]
      const extractPreview = normalizeText(String(firstPage?.extract || "").slice(0, 280))
      if (extractPreview) {
        return {
          provider: "wiktionary",
          term,
          extractPreview
        }
      }
    } catch {
      // fall through to datamuse
    }

    const datamusePayload = await fetchJson(`https://api.datamuse.com/words?ml=${normalizedTerm}&max=5`)
    return {
      provider: "datamuse",
      term,
      relatedWords: Array.isArray(datamusePayload) ? datamusePayload.slice(0, 5).map((entry) => entry.word) : []
    }
  }).then((entry) => entry.value)
}

function buildClarificationHints(question, mode, targetText, detectedLanguage) {
  const hints = []
  const normalized = normalizeText(question)

  if (mode === "translation" && !targetText) {
    hints.push("pedido de traducao sem trecho explicito")
  }

  if (mode === "lexical" && (!targetText || targetText.split(/\s+/).length > 8)) {
    hints.push("pedido lexical sem termo curto claramente delimitado")
  }

  if (/[A-Za-z]/.test(normalized) && /[Á-ÿ]/.test(normalized) && detectedLanguage === "pt") {
    hints.push("mensagem com mistura de idiomas")
  }

  return hints
}

function buildInstructions(runtime) {
  const instructions = []

  if (runtime.detectedLanguage) {
    instructions.push(`Idioma principal inferido nesta entrada: ${runtime.detectedLanguage}.`)
  }

  if (runtime.mode === "translation" && runtime.translation?.translatedText) {
    instructions.push(`Trate como pedido de traducao de ${runtime.translation.sourceLanguage} para ${runtime.translation.targetLanguage}. Use a traducao candidata "${runtime.translation.translatedText}" como apoio e, se responder, apresente a traducao primeiro e depois uma explicacao curta.`)
  }

  if (runtime.mode === "correction" && runtime.correction?.matchesCount > 0) {
    instructions.push("Trate como revisao linguistica. Corrija primeiro, depois explique os principais ajustes sem inventar regras.")
  }

  if (runtime.mode === "lexical" && (runtime.lexical?.definition || runtime.lexical?.extractPreview)) {
    instructions.push("Trate como explicacao lexical. Defina o termo de forma direta, depois acrescente nuance de uso e exemplo curto.")
  }

  if (Array.isArray(runtime.clarificationHints) && runtime.clarificationHints.length > 0) {
    instructions.push("Se a intencao ainda estiver ambigua, faca uma pergunta de esclarecimento curta antes de assumir significado, idioma-alvo ou tom.")
  }

  return instructions.join(" ")
}

function buildSummary(runtime) {
  const parts = []
  parts.push(`idioma=${runtime.detectedLanguage || "pt"}`)
  parts.push(`modo=${runtime.mode || "general"}`)

  if (runtime.translation?.translatedText) {
    parts.push(`traducao=${runtime.translation.translatedText}`)
  }

  if (runtime.correction?.matchesCount) {
    parts.push(`correcoes=${runtime.correction.matchesCount}`)
  }

  if (runtime.lexical?.definition) {
    parts.push(`definicao=${runtime.lexical.definition.slice(0, 80)}`)
  }

  if (Array.isArray(runtime.lexical?.relatedWords) && runtime.lexical.relatedWords.length) {
    parts.push(`relacionadas=${runtime.lexical.relatedWords.slice(0, 3).join(",")}`)
  }

  if (Array.isArray(runtime.servicesUsed) && runtime.servicesUsed.length) {
    parts.push(`servicos=${runtime.servicesUsed.join(",")}`)
  }

  if (runtime.clarificationHints?.length) {
    parts.push(`ambiguidades=${runtime.clarificationHints.length}`)
  }

  return parts.join(" | ")
}

export async function enrichLanguageRuntimeContext(question = "", context = {}) {
  languageRuntimeStats.totalRequests += 1
  languageRuntimeStats.lastAccessAt = new Date().toISOString()

  const normalizedQuestion = normalizeText(question)
  const detectedLanguage = inferLanguageCode(normalizedQuestion, context?.locale)
  const mode = detectLanguageIntent(normalizedQuestion)
  const targetText = extractTargetText(normalizedQuestion, mode)
  incrementBucket(languageRuntimeStats.modeUsage, mode)

  const runtime = {
    detectedLanguage,
    mode,
    targetText: targetText || null,
    servicesUsed: [],
    clarificationHints: buildClarificationHints(normalizedQuestion, mode, targetText, detectedLanguage)
  }

  if (mode === "translation" && targetText && targetText.length <= MAX_REMOTE_TEXT_LENGTH) {
    try {
      runtime.translation = await fetchTranslation(targetText, inferTranslationPair(normalizedQuestion, detectedLanguage, targetText))
      runtime.servicesUsed.push(runtime.translation.provider)
      noteProvider(runtime.translation.provider)
      if (runtime.translation.fallbackFrom) {
        languageRuntimeStats.fallbackCount += 1
      }
    } catch (error) {
      runtime.translationError = error?.message || String(error)
      languageRuntimeStats.errorCount += 1
    }
  }

  if (mode === "correction" && targetText && targetText.length <= MAX_REMOTE_TEXT_LENGTH) {
    try {
      const correctionLanguage = detectedLanguage === "pt" ? "pt-BR" : detectedLanguage === "es" ? "es" : "en-US"
      runtime.correction = await fetchCorrection(targetText, correctionLanguage)
      runtime.servicesUsed.push(runtime.correction.provider)
      noteProvider(runtime.correction.provider)
    } catch (error) {
      runtime.correctionError = error?.message || String(error)
      languageRuntimeStats.errorCount += 1
    }
  }

  if (mode === "lexical" && targetText && targetText.length <= 120) {
    try {
      runtime.lexical = await fetchLexicalDefinition(targetText, detectedLanguage)
      runtime.servicesUsed.push(runtime.lexical.provider)
      noteProvider(runtime.lexical.provider)
    } catch (error) {
      runtime.lexicalError = error?.message || String(error)
      languageRuntimeStats.errorCount += 1
    }
  }

  runtime.instructions = buildInstructions(runtime)
  runtime.summary = buildSummary(runtime)
  return runtime
}

export function buildLanguageClientMetadata(languageRuntime = null) {
  if (!languageRuntime || typeof languageRuntime !== "object") {
    return {
      enabled: false,
      summary: "language_runtime_disabled"
    }
  }

  return {
    enabled: true,
    detectedLanguage: languageRuntime.detectedLanguage || null,
    mode: languageRuntime.mode || "general",
    servicesUsed: Array.isArray(languageRuntime.servicesUsed) ? languageRuntime.servicesUsed : [],
    clarificationHints: Array.isArray(languageRuntime.clarificationHints) ? languageRuntime.clarificationHints : [],
    cacheHit: languageRuntime.translation?.cacheHit || languageRuntime.correction?.cacheHit || languageRuntime.lexical?.cacheHit || null,
    summary: languageRuntime.summary || "language_runtime_active"
  }
}