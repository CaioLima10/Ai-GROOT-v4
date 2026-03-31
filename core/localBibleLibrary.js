import fs from "fs/promises"
import path from "path"
import {
  parseBibleReference,
  normalizeBibleText
} from "../packages/shared-config/src/bibleReferences.js"

const INDEX_DIR = path.resolve(process.cwd(), "knowledge", "imported", "bible-reference-library")
const MANIFEST_PATH = path.join(INDEX_DIR, "manifest.json")
const DEFAULT_LOCAL_BIBLE_CODE = String(process.env.GIOM_LOCAL_BIBLE_DEFAULT || "NAA").trim().toUpperCase()

let manifestCache = null
const translationCache = new Map()

function normalizeBibleCode(code = "") {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
}

function sanitizeBibleVerseText(text = "", expectedVerse = null) {
  let value = String(text || "")
    .replace(/\u0000/g, " ")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/[†‡¶§¤]/g, "")
    .replace(/\b\d{1,4}\s+(?:Nova Almeida Atualizada\s*-\s*NAA|B[ií]blia Almeida[^.]+|Almeida Revista e Corrigida[^.]+|Sociedade B[ií]blica Trinitariana do Brasil)\b/gi, "")
    .replace(/\b(?:Nova Almeida Atualizada\s*-\s*NAA|Sociedade B[ií]blica Trinitariana do Brasil)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()

  if (Number.isFinite(expectedVerse)) {
    value = value.replace(new RegExp(`^${expectedVerse}(?:\\s*[-.:–—])?\\s+`), "")
  }

  return value
    .replace(/^\s*[-.:–—]+\s*/, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim()
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"))
}

export async function getLocalBibleLibraryManifest() {
  if (manifestCache) {
    return manifestCache
  }

  try {
    manifestCache = await readJson(MANIFEST_PATH)
    return manifestCache
  } catch {
    manifestCache = null
    return null
  }
}

function resolveTranslationRecord(manifest = null, bibleCode = "") {
  const translations = Array.isArray(manifest?.translations) ? manifest.translations : []
  if (!translations.length) {
    return null
  }

  const normalizedRequest = normalizeBibleCode(bibleCode || DEFAULT_LOCAL_BIBLE_CODE)
  if (normalizedRequest) {
    const exact = translations.find((translation) => {
      const aliases = Array.isArray(translation.aliases) ? translation.aliases : []
      const normalizedAliases = aliases.map((alias) => normalizeBibleCode(alias))
      return normalizeBibleCode(translation.code) === normalizedRequest || normalizedAliases.includes(normalizedRequest)
    })
    if (exact) {
      return exact
    }
  }

  return translations.find((translation) => normalizeBibleCode(translation.code) === DEFAULT_LOCAL_BIBLE_CODE) || translations[0]
}

async function loadTranslationIndex(translation = null) {
  if (!translation?.filePath) {
    return null
  }

  const cacheKey = String(translation.code || translation.filePath)
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)
  }

  const resolvedPath = path.isAbsolute(translation.filePath)
    ? translation.filePath
    : path.resolve(process.cwd(), translation.filePath)

  const payload = await readJson(resolvedPath)
  translationCache.set(cacheKey, payload)
  return payload
}

function collectChapterVerses(verses = {}, parsedReference = null, maxVerses = 24) {
  const prefix = `${parsedReference.bookId}.${parsedReference.chapter}.`
  const items = Object.entries(verses)
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, text]) => ({
      key,
      verse: Number(key.split(".")[2]),
      text: sanitizeBibleVerseText(text, Number(key.split(".")[2]))
    }))
    .filter((item) => Number.isFinite(item.verse) && item.text)
    .sort((left, right) => left.verse - right.verse)

  return {
    verses: items.slice(0, maxVerses),
    totalAvailable: items.length,
    truncated: items.length > maxVerses
  }
}

function collectVerseRange(verses = {}, parsedReference = null) {
  const start = Number(parsedReference.verseStart)
  const end = Number(parsedReference.verseEnd || parsedReference.verseStart)
  const items = []

  for (let verse = start; verse <= end; verse += 1) {
    const key = `${parsedReference.bookId}.${parsedReference.chapter}.${verse}`
    const text = sanitizeBibleVerseText(verses[key], verse)
    if (text) {
      items.push({
        key,
        verse,
        text
      })
    }
  }

  return {
    verses: items,
    totalAvailable: items.length,
    truncated: false
  }
}

function buildPassageContent(items = []) {
  return items
    .map((item) => `${item.verse} ${sanitizeBibleVerseText(item.text, item.verse)}`)
    .join("\n")
    .trim()
}

export async function lookupLocalBiblePassage({ passage, bibleCode, maxVerses = 24 } = {}) {
  const parsedReference = parseBibleReference(passage)
  if (!parsedReference) {
    return null
  }

  const manifest = await getLocalBibleLibraryManifest()
  const translation = resolveTranslationRecord(manifest, bibleCode)
  if (!translation) {
    return null
  }

  const translationIndex = await loadTranslationIndex(translation)
  const verses = translationIndex?.verses && typeof translationIndex.verses === "object"
    ? translationIndex.verses
    : {}

  const resolved = parsedReference.isChapterOnly
    ? collectChapterVerses(verses, parsedReference, maxVerses)
    : collectVerseRange(verses, parsedReference)

  if (!resolved.verses.length) {
    return null
  }

  const content = buildPassageContent(resolved.verses)
  return {
    provider: "local_bible_library",
    source: "local_bible_library",
    bibleCode: translation.code,
    bibleLabel: translation.label,
    language: translation.language || "pt",
    reference: parsedReference.human,
    canonicalReference: parsedReference.canonical,
    bookId: parsedReference.bookId,
    bookName: parsedReference.bookName,
    chapter: parsedReference.chapter,
    verseStart: parsedReference.verseStart,
    verseEnd: parsedReference.verseEnd,
    isChapterOnly: parsedReference.isChapterOnly,
    truncated: resolved.truncated,
    totalVerses: resolved.totalAvailable,
    content,
    verses: resolved.verses.map((item) => ({
      bookId: parsedReference.bookId,
      bookName: parsedReference.bookName,
      chapter: parsedReference.chapter,
      verse: item.verse,
      text: item.text
    })),
    summary: [
      `Passagem local: ${parsedReference.human} (${translation.code}).`,
      content,
      resolved.truncated ? `Observacao: exibindo os primeiros ${resolved.verses.length} versiculos deste capitulo.` : null
    ].filter(Boolean).join("\n")
  }
}

export async function getLocalBibleLibraryStatus() {
  const manifest = await getLocalBibleLibraryManifest()
  const translations = Array.isArray(manifest?.translations) ? manifest.translations : []

  return {
    enabled: translations.length > 0,
    defaultBibleCode: DEFAULT_LOCAL_BIBLE_CODE,
    translations: translations.map((translation) => ({
      code: translation.code,
      label: translation.label,
      language: translation.language || "pt",
      verseCount: translation.verseCount || 0
    }))
  }
}

export function looksLikeBibleReference(text = "") {
  const normalized = normalizeBibleText(text)
  if (!normalized) {
    return false
  }

  return Boolean(parseBibleReference(normalized))
}
