import fs from "fs/promises"
import path from "path"
import dotenv from "dotenv"
import pdfParse from "pdf-parse/lib/pdf-parse.js"
import {
  buildBibleBookHeaderMatchers,
  normalizeBibleText
} from "../packages/shared-config/src/bibleReferences.js"

dotenv.config()

const DEFAULT_INPUT_DIR = path.join(process.env.USERPROFILE || "C:/Users/GabeG", "Desktop", "BIBLIAS PDF")
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), "knowledge", "imported", "bible-reference-library")

const TRANSLATION_CATALOG = [
  {
    code: "NAA",
    label: "Nova Almeida Atualizada (NAA) 2017",
    language: "pt",
    aliases: ["NAA", "SBB_NAA", "ALMEIDA_ATUALIZADA"],
    minVerseCount: 28000,
    fileHints: ["nova almeida atualizada naa 2017"]
  },
  {
    code: "ARC",
    label: "Almeida Revista e Corrigida (ARC) 1995",
    language: "pt",
    aliases: ["ARC", "ALMEIDA_REVISTA_CORRIGIDA"],
    minVerseCount: 28000,
    fileHints: ["almeida revista e corrigida por joao ferreira de almeida arc 1995"]
  },
  {
    code: "ACF",
    label: "Almeida Corrigida Fiel (ACF) 2023",
    language: "pt",
    aliases: ["ACF", "ALMEIDA_CORRIGIDA_FIEL"],
    minVerseCount: 28000,
    fileHints: ["almeida corrigida fiel versao trinitariana acf 2023"]
  },
  {
    code: "BJ",
    label: "Biblia de Jerusalem",
    language: "pt",
    aliases: ["BJ", "JERUSALEM", "BIBLIA_DE_JERUSALEM"],
    minVerseCount: 20000,
    fileHints: ["biblia de jerusalem completa"]
  },
  {
    code: "BHEB",
    label: "Biblia Hebraica",
    language: "pt",
    aliases: ["BHEB", "BIBLIA_HEBRAICA", "HEBRAICA"],
    minVerseCount: 18000,
    fileHints: ["biblia hebraica tora pentateuco profetas e escritos"]
  }
]

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function parseArgs() {
  const args = process.argv.slice(2)
  return {
    inputDir: DEFAULT_INPUT_DIR,
    outputDir: DEFAULT_OUTPUT_DIR,
    dryRun: args.includes("--dry-run"),
    failFast: args.includes("--fail-fast"),
    codes: (() => {
      const index = args.indexOf("--codes")
      if (index < 0 || !args[index + 1]) return []
      return String(args[index + 1]).split(",").map((item) => item.trim().toUpperCase()).filter(Boolean)
    })()
  }
}

function cleanPdfText(text = "") {
  return String(text || "")
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
}

function sanitizeBibleVerseText(text = "", expectedVerse = null) {
  let value = String(text || "")
    .replace(/\u0000/g, " ")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/[†‡¶§¤]/g, "")
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

async function listPdfFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && /\.pdf$/i.test(entry.name))
    .map((entry) => path.join(dir, entry.name))
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }))
}

function resolveTargetTranslations(files = [], selectedCodes = []) {
  const normalizedFiles = files.map((filePath) => ({
    filePath,
    normalized: normalizeBibleText(path.basename(filePath))
  }))

  return TRANSLATION_CATALOG
    .filter((translation) => selectedCodes.length === 0 || selectedCodes.includes(translation.code))
    .map((translation) => {
      const matched = normalizedFiles.find((file) =>
        translation.fileHints.some((hint) => file.normalized.includes(normalizeBibleText(hint)))
      )

      return matched ? {
        ...translation,
        filePath: matched.filePath,
        fileName: path.basename(matched.filePath)
      } : null
    })
    .filter(Boolean)
}

function detectBookChapterHeader(line = "", matchers = []) {
  const normalized = normalizeBibleText(line)
  if (!normalized) {
    return null
  }

  for (const matcher of matchers) {
    for (const alias of matcher.headerAliases) {
      const regex = new RegExp(`^${escapeRegex(alias)}\\s+(\\d{1,3})$`)
      const match = normalized.match(regex)
      if (match) {
        return {
          bookId: matcher.id,
          bookName: matcher.name,
          chapter: Number(match[1])
        }
      }
    }
  }

  return null
}

function isIgnorableBibleLine(line = "", translation = null) {
  const normalized = normalizeBibleText(line)
  if (!normalized) {
    return true
  }

  const translationName = normalizeBibleText(translation?.label || "")
  const ignoredFragments = [
    translationName,
    "sociedade biblica do brasil",
    "portugues all bible",
    "portugues",
    "velho testamento",
    "novo testamento",
    "old testament",
    "new testament",
    "o primeiro livro de moises chamado",
    "pagina",
    "contents"
  ].filter(Boolean)

  if (ignoredFragments.some((fragment) => fragment && normalized.includes(fragment))) {
    return true
  }

  if (/^@\s*\d{4}/.test(normalized)) {
    return true
  }

  return false
}

function detectVerseNumber(line = "", previousVerse = null) {
  const normalized = normalizeBibleText(line)
  const match = normalized.match(/^(\d{1,3})$/)
  if (!match) {
    return null
  }

  const nextVerse = Number(match[1])
  if (!Number.isFinite(nextVerse)) {
    return null
  }

  if (previousVerse == null) {
    return nextVerse === 1 ? nextVerse : null
  }

  if (nextVerse > previousVerse && nextVerse <= previousVerse + 4) {
    return nextVerse
  }

  return null
}

function buildVerseIndexFromText(text = "", translation = null) {
  const lines = cleanPdfText(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const matchers = buildBibleBookHeaderMatchers()
  const verses = {}
  const bookCounts = {}
  let currentBook = null
  let currentChapter = null
  let currentVerse = null
  let verseBuffer = []

  const commitVerse = () => {
    if (!currentBook || !currentChapter || !currentVerse || verseBuffer.length === 0) {
      verseBuffer = []
      return
    }

    const key = `${currentBook}.${currentChapter}.${currentVerse}`
    const value = sanitizeBibleVerseText(verseBuffer.join(" "), currentVerse)
    if (value) {
      verses[key] = value
      bookCounts[currentBook] = (bookCounts[currentBook] || 0) + 1
    }
    verseBuffer = []
  }

  for (const line of lines) {
    const header = detectBookChapterHeader(line, matchers)
    if (header) {
      commitVerse()
      currentBook = header.bookId
      currentChapter = header.chapter
      currentVerse = null
      continue
    }

    const nextVerse = detectVerseNumber(line, currentVerse)
    if (nextVerse != null) {
      commitVerse()
      currentVerse = nextVerse
      continue
    }

    if (isIgnorableBibleLine(line, translation)) {
      continue
    }

    if (currentBook && currentChapter && currentVerse != null) {
      verseBuffer.push(line)
    }
  }

  commitVerse()

  return {
    verses,
    verseCount: Object.keys(verses).length,
    bookCounts
  }
}

async function extractPdfText(filePath) {
  const buffer = await fs.readFile(filePath)
  const parsed = await pdfParse(buffer)
  return cleanPdfText(parsed?.text || "")
}

async function ensureOutputDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

async function buildBibleReferenceIndex() {
  const config = parseArgs()
  const files = await listPdfFiles(config.inputDir)
  const targets = resolveTargetTranslations(files, config.codes)

  if (!targets.length) {
    throw new Error("Nenhuma traducao-base encontrada para montar o indice biblico.")
  }

  console.log(`📚 Traducoes alvo: ${targets.length}`)
  await ensureOutputDir(config.outputDir)

  const manifest = {
    generatedAt: new Date().toISOString(),
    inputDir: config.inputDir,
    translations: [],
    failures: []
  }

  for (const translation of targets) {
    try {
      console.log(`\n📖 Indexando ${translation.code}: ${translation.fileName}`)
      const extracted = await extractPdfText(translation.filePath)
      const index = buildVerseIndexFromText(extracted, translation)
      if (index.verseCount === 0) {
        throw new Error(`nenhum versiculo detectado em ${translation.code}; revise o parser antes de aceitar este indice`)
      }
      if (index.verseCount < Number(translation.minVerseCount || 1)) {
        throw new Error(`cobertura insuficiente em ${translation.code}: ${index.verseCount} versiculos detectados, abaixo do minimo esperado de ${translation.minVerseCount}`)
      }

      const outputFile = path.join(config.outputDir, `${translation.code.toLowerCase()}.json`)
      const payload = {
        generatedAt: new Date().toISOString(),
        translation: {
          code: translation.code,
          label: translation.label,
          language: translation.language,
          aliases: translation.aliases
        },
        verseCount: index.verseCount,
        bookCounts: index.bookCounts,
        verses: index.verses
      }

      if (!config.dryRun) {
        await fs.writeFile(outputFile, JSON.stringify(payload), "utf8")
      }

      manifest.translations.push({
        code: translation.code,
        label: translation.label,
        language: translation.language,
        aliases: translation.aliases,
        fileName: translation.fileName,
        filePath: path.relative(process.cwd(), outputFile).replace(/\\/g, "/"),
        verseCount: index.verseCount
      })

      console.log(`✅ ${translation.code}: ${index.verseCount} versiculos indexados`)
    } catch (error) {
      manifest.failures.push({
        code: translation.code,
        fileName: translation.fileName,
        error: error.message
      })
      console.error(`❌ Falha em ${translation.code}: ${error.message}`)
      if (config.failFast) {
        throw error
      }
    }
  }

  const manifestPath = path.join(config.outputDir, "manifest.json")
  if (!config.dryRun) {
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8")
  }

  console.log(`\n✅ Indice biblico local concluido`)
  console.log(`Traducoes indexadas: ${manifest.translations.length}`)
  console.log(`Falhas: ${manifest.failures.length}`)
  console.log(`Manifesto: ${manifestPath}`)
}

buildBibleReferenceIndex().catch((error) => {
  console.error("❌ Falha ao montar indice biblico local:", error.message)
  process.exit(1)
})
