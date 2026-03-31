import crypto from "crypto"
import fs from "fs/promises"
import path from "path"
import dotenv from "dotenv"
import { createClient } from "@supabase/supabase-js"

dotenv.config()

const DEFAULT_INPUT_DIR = path.join(process.env.USERPROFILE || "C:/Users/GabeG", "Desktop", "LIVROS")
const DEFAULT_BUCKET = process.env.GIOM_PRIVATE_LIBRARY_BUCKET || "giom-private-library"
const DEFAULT_PREFIX = process.env.GIOM_PRIVATE_LIBRARY_PREFIX || "private-library"
const DEFAULT_TOPICS_FILE = path.join(process.cwd(), "knowledge", "docs", "private-library-topics.json")
const DEFAULT_CHUNK_CHARS = Number(process.env.GIOM_PRIVATE_LIBRARY_CHUNK_CHARS || 1800)
const DEFAULT_INDEX_MODE = (process.env.GIOM_PRIVATE_LIBRARY_INDEX_MODE || "catalog").toLowerCase()
const DEFAULT_MAX_OBJECT_BYTES = Number(process.env.GIOM_PRIVATE_LIBRARY_MAX_OBJECT_BYTES || (45 * 1024 * 1024))
const DEFAULT_INSERT_BATCH_SIZE = Number(process.env.GIOM_PRIVATE_LIBRARY_INSERT_BATCH_SIZE || 48)
const DEFAULT_OCR_LANG = process.env.OCR_LANG || "por+eng"
const DEFAULT_RIGHTS_DECLARATION = process.env.GIOM_PRIVATE_LIBRARY_RIGHTS || "user_provided_or_public_domain"
const SUPPORTED_EXTENSIONS = new Set([
  ".pdf",
  ".txt",
  ".md",
  ".json",
  ".jsonl",
  ".csv",
  ".tsv",
  ".html",
  ".xml",
  ".yml",
  ".yaml",
  ".svg",
  ".docx",
  ".xlsx",
  ".pptx",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff"
])
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"])
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".json", ".jsonl", ".csv", ".tsv", ".html", ".xml", ".yml", ".yaml", ".svg"])
const DOCX_EXTENSIONS = new Set([".docx"])
const XLSX_EXTENSIONS = new Set([".xlsx"])
const PPTX_EXTENSIONS = new Set([".pptx"])

const LIBRARY_PRESETS = {
  preaching_core: [
    "500-esbocos.pdf",
    "mil-esbocos-biblicos.pdf",
    "charles-haddon-spurgeon-sermoes-devocionais.pdf",
    "esbocos-biblicos-volume-1-charles-h-spurgeon.pdf",
    "spurgeon, charles. diante da porta estreita.pdf"
  ],
  family_and_devotion: [
    "a familia abencoada - pregacao no salmo 128.pdf",
    "esboco salmo 133.pdf",
    "o exemplo de amor e dedicacao das maes.txt",
    "uma mae aos pes do salvador.txt",
    "uma mae segundo o coracao de deus.txt",
    "dadiva de ser mae - esboco de pregacao para maes.txt",
    "por isso sou grato a deus! pregacao sobre gratidao.txt"
  ]
}

let ragClientPromise = null

function parseArgs() {
  const args = process.argv.slice(2)
  const config = {
    dir: DEFAULT_INPUT_DIR,
    bucket: DEFAULT_BUCKET,
    prefix: DEFAULT_PREFIX,
    chunkChars: DEFAULT_CHUNK_CHARS,
    indexMode: DEFAULT_INDEX_MODE,
    insertBatchSize: DEFAULT_INSERT_BATCH_SIZE,
    match: null,
    preset: null,
    skipUpload: args.includes("--skip-upload"),
    continueOnError: true,
    dryRun: args.includes("--dry-run"),
    limit: null,
    recursive: !args.includes("--no-recursive"),
    ocrLang: DEFAULT_OCR_LANG,
    enableOcr: args.includes("--ocr"),
    topicsFile: DEFAULT_TOPICS_FILE,
    rights: DEFAULT_RIGHTS_DECLARATION
  }

  const dirIndex = args.indexOf("--dir")
  if (dirIndex >= 0 && args[dirIndex + 1]) {
    config.dir = path.resolve(process.cwd(), args[dirIndex + 1])
  }

  const bucketIndex = args.indexOf("--bucket")
  if (bucketIndex >= 0 && args[bucketIndex + 1]) {
    config.bucket = String(args[bucketIndex + 1]).trim()
  }

  const prefixIndex = args.indexOf("--prefix")
  if (prefixIndex >= 0 && args[prefixIndex + 1]) {
    config.prefix = String(args[prefixIndex + 1]).trim()
  }

  const chunkIndex = args.indexOf("--chunk-chars")
  if (chunkIndex >= 0 && args[chunkIndex + 1]) {
    config.chunkChars = Number(args[chunkIndex + 1]) || DEFAULT_CHUNK_CHARS
  }

  const indexModeIndex = args.indexOf("--index-mode")
  if (indexModeIndex >= 0 && args[indexModeIndex + 1]) {
    config.indexMode = String(args[indexModeIndex + 1]).trim().toLowerCase()
  }

  const insertBatchSizeIndex = args.indexOf("--insert-batch-size")
  if (insertBatchSizeIndex >= 0 && args[insertBatchSizeIndex + 1]) {
    config.insertBatchSize = Number(args[insertBatchSizeIndex + 1]) || DEFAULT_INSERT_BATCH_SIZE
  }

  const matchIndex = args.indexOf("--match")
  if (matchIndex >= 0 && args[matchIndex + 1]) {
    config.match = String(args[matchIndex + 1]).trim().toLowerCase()
  }

  const presetIndex = args.indexOf("--preset")
  if (presetIndex >= 0 && args[presetIndex + 1]) {
    config.preset = String(args[presetIndex + 1]).trim().toLowerCase()
  }

  const limitIndex = args.indexOf("--limit")
  if (limitIndex >= 0 && args[limitIndex + 1]) {
    config.limit = Number(args[limitIndex + 1]) || null
  }

  const ocrLangIndex = args.indexOf("--ocr-lang")
  if (ocrLangIndex >= 0 && args[ocrLangIndex + 1]) {
    config.ocrLang = String(args[ocrLangIndex + 1]).trim() || DEFAULT_OCR_LANG
  }

  const topicsFileIndex = args.indexOf("--topics-file")
  if (topicsFileIndex >= 0 && args[topicsFileIndex + 1]) {
    config.topicsFile = path.resolve(process.cwd(), args[topicsFileIndex + 1])
  }

  const rightsIndex = args.indexOf("--rights")
  if (rightsIndex >= 0 && args[rightsIndex + 1]) {
    config.rights = String(args[rightsIndex + 1]).trim() || DEFAULT_RIGHTS_DECLARATION
  }

  if (args.includes("--fail-fast")) {
    config.continueOnError = false
  }

  return config
}

function slugifyFileName(name = "") {
  const ext = path.extname(name || "").toLowerCase()
  const base = path.basename(name || "documento", ext)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()

  return `${base || "documento"}${ext || ".txt"}`
}

function normalizeFileName(name = "") {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function normalizeForMatch(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

async function loadTopicProfiles(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8")
    const parsed = JSON.parse(raw)
    const topics = Array.isArray(parsed?.topics) ? parsed.topics : []
    return topics
      .map((topic) => ({
        id: String(topic?.id || "").trim(),
        category: String(topic?.category || "general").trim() || "general",
        categories: Array.isArray(topic?.categories) ? topic.categories.map((item) => String(item).trim()).filter(Boolean) : [],
        modules: Array.isArray(topic?.modules) ? topic.modules.map((item) => String(item).trim()).filter(Boolean) : [],
        bibleStudyModules: Array.isArray(topic?.bibleStudyModules) ? topic.bibleStudyModules.map((item) => String(item).trim()).filter(Boolean) : [],
        keywords: Array.isArray(topic?.keywords) ? topic.keywords.map((item) => normalizeForMatch(item)).filter(Boolean) : []
      }))
      .filter((topic) => topic.id && topic.keywords.length > 0)
  } catch {
    return []
  }
}

function getFileExtension(fileName = "") {
  return path.extname(String(fileName || "")).toLowerCase()
}

function isSupportedFile(fileName = "") {
  return SUPPORTED_EXTENSIONS.has(getFileExtension(fileName))
}

function chunkText(text = "", maxLen = DEFAULT_CHUNK_CHARS) {
  const input = String(text || "").trim()
  if (!input) return []

  const sections = input
    .split(/\n{2,}/)
    .map(section => section.trim())
    .filter(Boolean)

  const chunks = []
  let buffer = ""

  for (const section of sections) {
    const candidate = `${buffer}${buffer ? "\n\n" : ""}${section}`
    if (candidate.length > maxLen && buffer.trim()) {
      chunks.push(buffer.trim())
      buffer = section
      continue
    }
    buffer = candidate
  }

  if (buffer.trim()) {
    chunks.push(buffer.trim())
  }

  return chunks
}

function cleanExtractedText(text = "") {
  return String(text || "")
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

function decodeTextBuffer(buffer) {
  const utf8 = buffer.toString("utf8")
  const replacementCount = (utf8.match(/\uFFFD/g) || []).length
  if (replacementCount <= 2) {
    return utf8
  }

  return buffer.toString("latin1")
}

function buildCatalogContent(fileName, extracted, metadata) {
  const excerpt = String(extracted?.text || "")
    .slice(0, 3200)
    .trim()

  return [
    `Documento privado do GIOM: ${fileName}.`,
    `Tipo detectado: ${extracted?.kind || "documento"}.`,
    `Metodo de leitura: ${extracted?.method || "nao informado"}.`,
    `Paginas detectadas: ${extracted?.pages || "nao informado"}.`,
    `Categorias: ${(metadata.categories || []).join(", ") || "bible"}.`,
    `Modulos: ${(metadata.modules || []).join(", ") || "bible"}.`,
    `Submodulos biblicos: ${(metadata.bibleStudyModules || []).join(", ") || "nenhum"}.`,
    `Temas: ${(metadata.themeKeywords || []).join(", ") || "nenhum identificado"}.`,
    "Trecho inicial para identificacao e busca:",
    excerpt
  ].join("\n")
}

function buildSyntheticLibraryStub(fileName, metadata = {}, extracted = {}) {
  return [
    `Documento privado do GIOM detectado: ${fileName}.`,
    `Tipo detectado: ${extracted?.kind || "documento"}.`,
    `Metodo de leitura: ${extracted?.method || "nao informado"}.`,
    "Observacao: nao houve texto util extraido automaticamente nesta execucao.",
    `Categorias inferidas: ${(metadata.categories || []).join(", ") || "bible"}.`,
    `Submodulos biblicos inferidos: ${(metadata.bibleStudyModules || []).join(", ") || "nenhum"}.`,
    `Temas inferidos: ${(metadata.themeKeywords || []).join(", ") || "nenhum identificado"}.`,
    "Use este registro como catalogo do documento e, se necessario, reforce a leitura manual ou OCR em uma proxima etapa."
  ].join("\n")
}

function buildKnowledgePayload(content, metadata = {}) {
  return {
    content,
    source: metadata.source || "manual",
    category: metadata.category || "general",
    language: metadata.language || "pt",
    metadata: {
      ...metadata,
      created_at: new Date().toISOString()
    }
  }
}

function splitBuffer(buffer, maxBytes = DEFAULT_MAX_OBJECT_BYTES) {
  const parts = []
  for (let start = 0; start < buffer.length; start += maxBytes) {
    parts.push(buffer.subarray(start, Math.min(buffer.length, start + maxBytes)))
  }
  return parts
}

function pushKeyword(target, value) {
  if (value) {
    target.add(value)
  }
}

function inferLibraryKnowledgeMetadata(fileName = "", contentPreview = "", topicProfiles = []) {
  const normalized = normalizeForMatch(`${fileName} ${String(contentPreview || "").slice(0, 2400)}`)

  const categories = new Set(["private_library"])
  const modules = new Set(["research"])
  const bibleStudyModules = new Set()
  const themeKeywords = new Set()
  const matchedTopicIds = []

  for (const topic of topicProfiles) {
    if (!Array.isArray(topic?.keywords) || topic.keywords.length === 0) continue
    const matched = topic.keywords.some((keyword) => keyword && normalized.includes(keyword))
    if (!matched) continue

    matchedTopicIds.push(topic.id)
    categories.add(topic.category || "general")
    for (const value of topic.categories || []) categories.add(value)
    for (const value of topic.modules || []) modules.add(value)
    for (const value of topic.bibleStudyModules || []) bibleStudyModules.add(value)
  }

  if (matchedTopicIds.length === 0) {
    categories.add("bible")
    modules.add("bible")
  }

  if (/\b(esboco|esbocos|pregacao|pregacoes|sermao|sermoes|devocional)\b/.test(normalized)) {
    categories.add("preaching")
    categories.add("pastoral_theology")
    bibleStudyModules.add("homiletics_preaching")
    bibleStudyModules.add("devotional_practice")
  }

  if (/\b(spurgeon|charles haddon|porta estreita)\b/.test(normalized)) {
    categories.add("church_history")
    categories.add("pastoral_theology")
    bibleStudyModules.add("protestant_preaching_traditions")
    bibleStudyModules.add("church_history")
    pushKeyword(themeKeywords, "spurgeon")
  }

  if (/\b(biografia|biografias|personagens biblicos|personagens biblicos)\b/.test(normalized)) {
    categories.add("biblical_history")
    bibleStudyModules.add("biblical_history")
    bibleStudyModules.add("sunday_school_curriculum")
    pushKeyword(themeKeywords, "personagens_biblicos")
  }

  if (/\b(decisoes|decisoes|tomar decisoes|decisao|decisão)\b/.test(normalized)) {
    categories.add("pastoral_theology")
    bibleStudyModules.add("pastoral_theology")
    pushKeyword(themeKeywords, "decisoes")
  }

  if (/\b(acontecimentos futuros|apocalipse|escatolog|primeiro amor)\b/.test(normalized)) {
    categories.add("theology")
    bibleStudyModules.add("systematic_theology")
    bibleStudyModules.add("biblical_periods")
    pushKeyword(themeKeywords, "escatologia")
  }

  if (/\b(pascoa|pascoa|exodo|tabernaculo)\b/.test(normalized)) {
    categories.add("biblical_history")
    categories.add("theology")
    bibleStudyModules.add("biblical_periods")
    bibleStudyModules.add("biblical_history")
    pushKeyword(themeKeywords, "redencao")
  }

  if (/\b(familia|familia abencoada|salmo 128|salmo 133|mae|maes)\b/.test(normalized)) {
    categories.add("pastoral_theology")
    bibleStudyModules.add("pastoral_theology")
    bibleStudyModules.add("devotional_practice")
    pushKeyword(themeKeywords, "familia")
  }

  if (/\b(gratidao|gratidão|grato)\b/.test(normalized)) {
    categories.add("pastoral_theology")
    bibleStudyModules.add("devotional_practice")
    pushKeyword(themeKeywords, "gratidao")
  }

  if (/\b(coracao endurecido|dureza de coracao|mao mirrada)\b/.test(normalized)) {
    categories.add("pastoral_theology")
    bibleStudyModules.add("homiletics_preaching")
    pushKeyword(themeKeywords, "arrependimento")
  }

  if (/\b(palavra de deus)\b/.test(normalized)) {
    categories.add("theology")
    bibleStudyModules.add("study_methods_hermeneutics")
    pushKeyword(themeKeywords, "palavra_de_deus")
  }

  let category = "general"
  if (categories.has("theology_protestant") || categories.has("church_history") || categories.has("bible")) {
    category = "bible"
  } else if (categories.has("languages")) {
    category = "language"
  } else if (categories.has("science") || categories.has("astronomy") || categories.has("gps_satellites")) {
    category = "math_science"
  } else if (categories.has("games_logic")) {
    category = "games"
  }

  return {
    category,
    categories: Array.from(categories),
    modules: Array.from(modules),
    bibleStudyModules: Array.from(bibleStudyModules),
    themeKeywords: Array.from(themeKeywords),
    matchedTopicIds,
    language: "pt"
  }
}

async function ensureBucket(client, bucketName) {
  const { data: buckets, error: listError } = await client.storage.listBuckets()
  if (listError) {
    throw new Error(`Falha ao listar buckets: ${listError.message}`)
  }

  const exists = (buckets || []).some(bucket => bucket.name === bucketName)
  if (exists) {
    return
  }

  const { error: createError } = await client.storage.createBucket(bucketName, {
    public: false
  })

  if (createError && !/already exists/i.test(createError.message || "")) {
    throw new Error(`Falha ao criar bucket ${bucketName}: ${createError.message}`)
  }
}

async function uploadToStorage(client, bucketName, objectPath, body, contentType) {
  const { error } = await client.storage
    .from(bucketName)
    .upload(objectPath, body, {
      upsert: true,
      contentType
    })

  if (error) {
    throw new Error(`Falha no upload para ${bucketName}/${objectPath}: ${error.message}`)
  }
}

async function uploadLargeObject(client, bucketName, objectPath, body, contentType) {
  if (body.length <= DEFAULT_MAX_OBJECT_BYTES) {
    await uploadToStorage(client, bucketName, objectPath, body, contentType)
    return {
      multipart: false,
      objectPaths: [objectPath],
      manifestPath: null
    }
  }

  const parts = splitBuffer(body, DEFAULT_MAX_OBJECT_BYTES)
  const objectPaths = []

  for (let index = 0; index < parts.length; index += 1) {
    const partPath = `${objectPath}.part${String(index + 1).padStart(3, "0")}`
    await uploadToStorage(client, bucketName, partPath, parts[index], "application/octet-stream")
    objectPaths.push(partPath)
  }

  const manifestPath = `${objectPath}.parts.json`
  const multipartManifest = {
    originalPath: objectPath,
    contentType,
    sizeBytes: body.length,
    partCount: parts.length,
    partSizeBytes: DEFAULT_MAX_OBJECT_BYTES,
    parts: objectPaths
  }

  await uploadToStorage(
    client,
    bucketName,
    manifestPath,
    Buffer.from(JSON.stringify(multipartManifest, null, 2), "utf8"),
    "application/json; charset=utf-8"
  )

  return {
    multipart: true,
    objectPaths,
    manifestPath
  }
}

async function extractPdfText(buffer) {
  const pdfParseModule = await import("pdf-parse/lib/pdf-parse.js")
  const pdfParse = pdfParseModule.default || pdfParseModule
  const parsed = await pdfParse(buffer)

  return {
    text: cleanExtractedText(parsed?.text || ""),
    pages: Number(parsed?.numpages || 0) || null,
    method: "pdf-parse",
    kind: "pdf"
  }
}

async function extractPlainText(buffer, fileName = "") {
  return {
    text: cleanExtractedText(decodeTextBuffer(buffer)),
    pages: null,
    method: `text:${getFileExtension(fileName) || "plain"}`,
    kind: "text"
  }
}

async function extractDocxText(buffer) {
  const mammoth = await import("mammoth")
  const result = await mammoth.extractRawText({ buffer })
  return {
    text: cleanExtractedText(result?.value || ""),
    pages: null,
    method: "mammoth",
    kind: "docx"
  }
}

async function extractXlsxText(buffer) {
  const exceljs = await import("exceljs")
  const workbook = new exceljs.Workbook()
  await workbook.xlsx.load(buffer)

  const lines = []
  for (const worksheet of workbook.worksheets) {
    lines.push(`# Sheet: ${worksheet.name}`)
    worksheet.eachRow((row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : []
      const text = values
        .map((item) => (item == null ? "" : String(item).trim()))
        .filter(Boolean)
        .join(" | ")
      if (text) {
        lines.push(text)
      }
    })
  }

  return {
    text: cleanExtractedText(lines.join("\n")),
    pages: workbook.worksheets.length || null,
    method: "exceljs",
    kind: "xlsx"
  }
}

async function extractPptxText(buffer) {
  const yauzl = await import("yauzl")

  const openZip = () => new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zipFile) => {
      if (error) return reject(error)
      resolve(zipFile)
    })
  })

  const textParts = []
  const zipFile = await openZip()

  await new Promise((resolve, reject) => {
    zipFile.readEntry()
    zipFile.on("entry", (entry) => {
      if (!/^ppt\/slides\/slide\d+\.xml$/i.test(entry.fileName)) {
        zipFile.readEntry()
        return
      }

      zipFile.openReadStream(entry, (streamError, stream) => {
        if (streamError) {
          zipFile.close()
          reject(streamError)
          return
        }

        const chunks = []
        stream.on("data", (chunk) => chunks.push(chunk))
        stream.on("end", () => {
          const xml = Buffer.concat(chunks).toString("utf8")
          const slideText = xml
            .replace(/<a:br\s*\/?\s*>/gi, "\n")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
          if (slideText) {
            textParts.push(slideText)
          }
          zipFile.readEntry()
        })
        stream.on("error", reject)
      })
    })

    zipFile.on("end", resolve)
    zipFile.on("error", reject)
  })

  return {
    text: cleanExtractedText(textParts.join("\n\n")),
    pages: textParts.length || null,
    method: "pptx-xml",
    kind: "pptx"
  }
}

async function extractImageTextFromOpenAI(filePath) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  try {
    const imageBuffer = await fs.readFile(filePath)
    const mimeByExt = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".bmp": "image/bmp",
      ".tif": "image/tiff",
      ".tiff": "image/tiff"
    }
    const ext = getFileExtension(filePath)
    const mime = mimeByExt[ext] || "image/png"
    const imageData = imageBuffer.toString("base64")

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia TODO o texto visível desta imagem exatamente como está. Não resuma." },
              { type: "image_url", image_url: { url: `data:${mime};base64,${imageData}` } }
            ]
          }
        ]
      })
    })

    if (!response.ok) return null
    const data = await response.json()
    const text = cleanExtractedText(data?.choices?.[0]?.message?.content || "")
    if (!text) return null
    return {
      text,
      pages: null,
      method: "openai-vision",
      kind: "image"
    }
  } catch {
    return null
  }
}

async function extractImageText(filePath, ocrLang = DEFAULT_OCR_LANG) {
  const openAiResult = await extractImageTextFromOpenAI(filePath)
  if (openAiResult?.text) {
    return openAiResult
  }

  const { createWorker } = await import("tesseract.js")
  const worker = await createWorker(ocrLang)
  try {
    const { data } = await worker.recognize(filePath)
    return {
      text: cleanExtractedText(data?.text || ""),
      pages: null,
      method: `tesseract:${ocrLang}`,
      kind: "image"
    }
  } finally {
    await worker.terminate().catch(() => { })
  }
}

async function tryPdfOcrFallback(filePath, ocrLang = DEFAULT_OCR_LANG) {
  try {
    return await extractImageText(filePath, ocrLang)
  } catch {
    return {
      text: "",
      pages: null,
      method: `pdf-ocr-unavailable:${ocrLang}`,
      kind: "pdf"
    }
  }
}

async function extractDocumentText(filePath, buffer, options = {}) {
  const ext = getFileExtension(filePath)

  if (ext === ".pdf") {
    try {
      return await extractPdfText(buffer)
    } catch (error) {
      return {
        text: "",
        pages: null,
        method: `pdf-parse-failed:${String(error?.message || "unknown_error").slice(0, 80)}`,
        kind: "pdf"
      }
    }
  }

  if (TEXT_EXTENSIONS.has(ext)) {
    return await extractPlainText(buffer, filePath)
  }

  if (DOCX_EXTENSIONS.has(ext)) {
    return await extractDocxText(buffer)
  }

  if (XLSX_EXTENSIONS.has(ext)) {
    return await extractXlsxText(buffer)
  }

  if (PPTX_EXTENSIONS.has(ext)) {
    return await extractPptxText(buffer)
  }

  if (IMAGE_EXTENSIONS.has(ext)) {
    if (!options.enableOcr) {
      return {
        text: "",
        pages: null,
        method: "image-ocr-disabled",
        kind: "image"
      }
    }
    return await extractImageText(filePath, options.ocrLang || DEFAULT_OCR_LANG)
  }

  return {
    text: "",
    pages: null,
    method: "unsupported",
    kind: ext.replace(/^\./, "") || "unknown"
  }
}

async function getRagClient() {
  if (!ragClientPromise) {
    ragClientPromise = import("../packages/ai-core/src/index.js")
      .then(module => module.grootAdvancedRAG)
  }

  return await ragClientPromise
}

async function ensurePrivateLibraryClient() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL e SUPABASE_SERVICE_KEY sao obrigatorios para subir a biblioteca privada.")
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })
}

async function listLibraryFiles(dir, recursive = true) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (recursive) {
        files.push(...await listLibraryFiles(fullPath, recursive))
      }
      continue
    }

    if (entry.isFile() && isSupportedFile(entry.name)) {
      files.push(fullPath)
    }
  }

  return files.sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }))
}

async function writeManifest(records) {
  const outDir = path.join(process.cwd(), "knowledge", "imported")
  await fs.mkdir(outDir, { recursive: true })

  const genericOutFile = path.join(outDir, "private-library-manifest.json")
  const legacyOutFile = path.join(outDir, "private-pdf-library-manifest.json")
  const content = JSON.stringify(records, null, 2)

  await fs.writeFile(genericOutFile, content, "utf8")
  await fs.writeFile(legacyOutFile, content, "utf8")

  return {
    outFile: genericOutFile,
    legacyOutFile,
    content
  }
}

async function prepareKnowledgeRows(ragClient, entries = [], logLabel = "") {
  const rows = []

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    const payload = buildKnowledgePayload(entry.content, entry.metadata)
    const embedding = await ragClient.embeddings.generateEmbedding(payload.content)
    rows.push({
      ...payload,
      embedding
    })

    if ((index + 1) % 250 === 0 || index === entries.length - 1) {
      console.log(`🧠 ${logLabel}: embeddings ${index + 1}/${entries.length}`)
    }
  }

  return rows
}

async function replaceRemoteKnowledgeRows(client, rows = [], options = {}) {
  if (!rows.length) {
    return 0
  }

  const normalizedBatchSize = Number(options.batchSize || DEFAULT_INSERT_BATCH_SIZE) || DEFAULT_INSERT_BATCH_SIZE
  const source = String(options.source || rows[0]?.source || "").trim()
  const logLabel = String(options.logLabel || "biblioteca privada")

  if (!source) {
    throw new Error(`Fonte de conhecimento ausente para sincronizacao em lote: ${logLabel}`)
  }

  const { error: deleteError } = await client
    .from("knowledge_embeddings")
    .delete()
    .eq("source", source)

  if (deleteError) {
    throw new Error(`Falha ao limpar conhecimento anterior de ${logLabel}: ${deleteError.message}`)
  }

  const totalBatches = Math.ceil(rows.length / normalizedBatchSize)
  let inserted = 0

  for (let offset = 0; offset < rows.length; offset += normalizedBatchSize) {
    const batch = rows.slice(offset, offset + normalizedBatchSize)
    const { error: insertError } = await client
      .from("knowledge_embeddings")
      .insert(batch)

    if (insertError) {
      throw new Error(`Falha ao inserir lote ${Math.floor(offset / normalizedBatchSize) + 1}/${totalBatches} de ${logLabel}: ${insertError.message}`)
    }

    inserted += batch.length
    console.log(`☁️ ${logLabel}: lote ${Math.floor(offset / normalizedBatchSize) + 1}/${totalBatches} sincronizado (${inserted}/${rows.length})`)
  }

  return inserted
}

async function syncKnowledgeEntries(client, ragClient, entries = [], options = {}) {
  if (!entries.length) {
    return 0
  }

  const logLabel = String(options.logLabel || "biblioteca privada")
  const rows = await prepareKnowledgeRows(ragClient, entries, logLabel)
  return await replaceRemoteKnowledgeRows(client, rows, {
    source: rows[0]?.source,
    batchSize: options.batchSize,
    logLabel
  })
}

async function ingestPrivateLibrary() {
  const config = parseArgs()
  const topicProfiles = await loadTopicProfiles(config.topicsFile)
  const files = await listLibraryFiles(config.dir, config.recursive)

  if (files.length === 0) {
    throw new Error(`Nenhum documento suportado encontrado em ${config.dir}`)
  }

  const presetEntries = config.preset && Array.isArray(LIBRARY_PRESETS[config.preset])
    ? LIBRARY_PRESETS[config.preset]
    : null

  const filteredFiles = files.filter(file => {
    const normalizedBaseName = normalizeFileName(path.basename(file))

    if (presetEntries && !presetEntries.includes(normalizedBaseName)) {
      return false
    }

    if (config.match && !normalizedBaseName.includes(normalizeFileName(config.match))) {
      return false
    }

    return true
  })

  const selectedFiles = config.limit ? filteredFiles.slice(0, config.limit) : filteredFiles
  if (selectedFiles.length === 0) {
    throw new Error("Nenhum documento corresponde ao filtro informado.")
  }

  console.log(`📚 Biblioteca privada detectada: ${selectedFiles.length} documentos`)
  console.log(`🧭 Modo de indexacao: ${config.indexMode}`)
  console.log(`🗂️ Topicos carregados: ${topicProfiles.length} (${config.topicsFile})`)
  console.log(`⚖️ Declaracao de direitos: ${config.rights}`)
  console.log(`🧠 OCR de imagem: ${config.enableOcr ? `ativo (${config.ocrLang})` : "desativado no pipeline de ingestao"}`)
  if (config.preset) {
    console.log(`🎯 Preset ativo: ${config.preset}`)
  }
  if (config.skipUpload) {
    console.log("⏭️ Reupload desativado: usando objetos ja salvos no bucket")
  }

  let client = null
  let ragClient = null
  if (!config.dryRun) {
    client = await ensurePrivateLibraryClient()
    if (!config.skipUpload) {
      await ensureBucket(client, config.bucket)
    }
    if (config.indexMode !== "none") {
      ragClient = await getRagClient()
    }
  }

  const manifest = []
  let totalChunks = 0
  const failures = []

  for (const filePath of selectedFiles) {
    const fileName = path.basename(filePath)
    console.log(`\n📄 Processando: ${fileName}`)

    try {
      const buffer = await fs.readFile(filePath)
      const fileHash = crypto.createHash("sha1").update(buffer).digest("hex").slice(0, 12)
      const storageName = `${fileHash}-${slugifyFileName(fileName)}`
      const fileObjectPath = `${config.prefix}/${storageName}`
      const textObjectPath = `${config.prefix}/${storageName.replace(/\.[^.]+$/i, ".txt")}`

      let extracted = await extractDocumentText(filePath, buffer, {
        ocrLang: config.ocrLang,
        enableOcr: config.enableOcr
      })
      const ext = getFileExtension(fileName)
      if (!extracted.text && ext === ".pdf" && config.enableOcr) {
        const ocrFallback = await tryPdfOcrFallback(filePath, config.ocrLang)
        if (ocrFallback.text) {
          extracted = ocrFallback
        }
      }

      const metadata = inferLibraryKnowledgeMetadata(fileName, extracted.text, topicProfiles)
      const finalText = extracted.text || buildSyntheticLibraryStub(fileName, metadata, extracted)
      const textRecoveredFromStub = !extracted.text
      const extractedForCatalog = {
        ...extracted,
        text: finalText
      }
      if (textRecoveredFromStub) {
        console.warn(`⚠️ Documento sem texto útil extraído automaticamente: ${fileName}. Registrando catalogo sintético para nao perder a obra.`)
      }

      const chunks = chunkText(finalText, config.chunkChars)
      totalChunks += config.indexMode === "full" ? chunks.length : (config.indexMode === "catalog" ? 1 : 0)

      let fileUpload = {
        multipart: false,
        objectPaths: [fileObjectPath],
        manifestPath: null
      }
      let textUpload = {
        multipart: false,
        objectPaths: [textObjectPath],
        manifestPath: null
      }

      if (!config.dryRun) {
        if (!config.skipUpload) {
          const contentType = extracted.kind === "pdf"
            ? "application/pdf"
            : IMAGE_EXTENSIONS.has(getFileExtension(fileName))
              ? "application/octet-stream"
              : "text/plain; charset=utf-8"
          fileUpload = await uploadLargeObject(client, config.bucket, fileObjectPath, buffer, contentType)
          textUpload = await uploadLargeObject(client, config.bucket, textObjectPath, Buffer.from(finalText, "utf8"), "text/plain; charset=utf-8")
        }

        if (config.indexMode !== "none" && ragClient) {
          const knowledgeSource = `supabase://${config.bucket}/${textObjectPath}`
          const sharedKnowledgeMetadata = {
            source: knowledgeSource,
            category: metadata.category,
            categories: metadata.categories,
            language: metadata.language,
            title: fileName,
            file: fileName,
            modules: metadata.modules,
            bibleStudyModules: metadata.bibleStudyModules,
            themeKeywords: metadata.themeKeywords,
            storageBucket: config.bucket,
            storagePath: fileObjectPath,
            storageTextPath: textObjectPath,
            storageObjectPaths: fileUpload.objectPaths,
            storageTextObjectPaths: textUpload.objectPaths,
            storageManifestPath: fileUpload.manifestPath,
            storageTextManifestPath: textUpload.manifestPath,
            storageMultipart: fileUpload.multipart || textUpload.multipart,
            privateLibrary: true,
            rightsDeclaration: config.rights,
            pages: extracted.pages,
            checksum: fileHash,
            extractionMethod: extracted.method,
            fileKind: extracted.kind
          }

          if (config.indexMode === "catalog") {
            await syncKnowledgeEntries(client, ragClient, [{
              content: buildCatalogContent(fileName, extractedForCatalog, metadata),
              metadata: {
                ...sharedKnowledgeMetadata,
                chunkIndex: 1,
                chunkTotal: 1,
                indexMode: "catalog",
                extractedFromStub: textRecoveredFromStub
              }
            }], {
              batchSize: config.insertBatchSize,
              logLabel: fileName
            })
          } else {
            const knowledgeEntries = chunks.map((chunk, index) => ({
              content: `[Biblioteca privada: ${fileName}]\n${chunk}`,
              metadata: {
                ...sharedKnowledgeMetadata,
                chunkIndex: index + 1,
                chunkTotal: chunks.length,
                indexMode: "full",
                extractedFromStub: textRecoveredFromStub
              }
            }))

            await syncKnowledgeEntries(client, ragClient, knowledgeEntries, {
              batchSize: config.insertBatchSize,
              logLabel: fileName
            })
          }
        }
      }

      manifest.push({
        id: fileHash,
        fileName,
        kind: extracted.kind,
        extractionMethod: extracted.method,
        bucket: config.bucket,
        fileObjectPath,
        textObjectPath,
        fileObjectPaths: fileUpload.objectPaths,
        textObjectPaths: textUpload.objectPaths,
        fileManifestPath: fileUpload.manifestPath,
        textManifestPath: textUpload.manifestPath,
        multipartStored: fileUpload.multipart || textUpload.multipart,
        pages: extracted.pages,
        sizeBytes: buffer.length,
        extractedChars: finalText.length,
        extractedFromStub: textRecoveredFromStub,
        chunkCount: config.indexMode === "full" ? chunks.length : (config.indexMode === "catalog" ? 1 : 0),
        indexMode: config.indexMode,
        rightsDeclaration: config.rights,
        importedAt: new Date().toISOString(),
        ...metadata
      })

      console.log(`✅ ${fileName}: ${config.indexMode === "full" ? chunks.length : (config.indexMode === "catalog" ? 1 : 0)} registros indexados`)
    } catch (error) {
      failures.push({
        fileName,
        error: error.message
      })
      console.error(`❌ Falha em ${fileName}: ${error.message}`)
      if (!config.continueOnError) {
        throw error
      }
    }
  }

  const manifestResult = await writeManifest(manifest)
  if (!config.dryRun && client) {
    await uploadToStorage(
      client,
      config.bucket,
      `${config.prefix}/private-library-manifest.json`,
      Buffer.from(manifestResult.content, "utf8"),
      "application/json; charset=utf-8"
    )
  }

  console.log(`\n✅ Biblioteca privada concluida`)
  console.log(`Arquivos processados: ${manifest.length}`)
  console.log(`Chunks indexados: ${totalChunks}`)
  console.log(`Manifesto local: ${manifestResult.outFile}`)
  if (failures.length > 0) {
    console.log(`Falhas: ${failures.length}`)
    failures.forEach(item => {
      console.log(`- ${item.fileName}: ${item.error}`)
    })
  }
}

ingestPrivateLibrary().catch(error => {
  console.error("❌ Falha na ingestao da biblioteca privada:", error.message)
  process.exit(1)
})
