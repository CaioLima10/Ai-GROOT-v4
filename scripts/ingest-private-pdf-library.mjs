import crypto from "crypto"
import fs from "fs/promises"
import path from "path"
import dotenv from "dotenv"
import { createClient } from "@supabase/supabase-js"

dotenv.config()

const DEFAULT_INPUT_DIR = path.join(process.env.USERPROFILE || "C:/Users/GabeG", "Desktop", "BIBLIAS PDF")
const DEFAULT_BUCKET = process.env.GIOM_PRIVATE_LIBRARY_BUCKET || "giom-private-library"
const DEFAULT_PREFIX = process.env.GIOM_PRIVATE_LIBRARY_PREFIX || "bible-pdfs"
const DEFAULT_CHUNK_CHARS = Number(process.env.GIOM_PRIVATE_LIBRARY_CHUNK_CHARS || 1800)
const DEFAULT_INDEX_MODE = (process.env.GIOM_PRIVATE_LIBRARY_INDEX_MODE || "catalog").toLowerCase()
const DEFAULT_MAX_OBJECT_BYTES = Number(process.env.GIOM_PRIVATE_LIBRARY_MAX_OBJECT_BYTES || (45 * 1024 * 1024))
const DEFAULT_INSERT_BATCH_SIZE = Number(process.env.GIOM_PRIVATE_LIBRARY_INSERT_BATCH_SIZE || 48)
let ragClientPromise = null

const LIBRARY_PRESETS = {
  core_base_translations: [
    "biblia sagrada - nova almeida atualizada (naa) 2017.pdf",
    "a biblia sagrada - almeida revista e corrigida por joao ferreira de almeida (arc) 1995.pdf",
    "biblia sagrada - almeida corrigida fiel - versao trinitariana (acf) 2023.pdf",
    "biblia sagrada king james fiel 1611 - 2025 edicao online (com a expressao em hebraico ani hu - eu sou ele).pdf",
    "biblia_de_jerusalem_completa.pdf",
    "biblia hebraica - tora (pentateuco), profetas e escritos - baseada no hebraico e a luz do talmud e das fontes judaicas [traducao david gorodovits e jairo fridlin] 2012.pdf"
  ],
  study_bibles_priority: [
    "534325679-biblia-de-estudo-naa.pdf",
    "855369215-amostra-biblia-de-estudo-patmos.pdf",
    "resumo-naa-biblia-de-estudo-nova-almeida-atualizada-varios-autores.pdf"
  ]
}

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
    limit: null
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

  if (args.includes("--fail-fast")) {
    config.continueOnError = false
  }

  const limitIndex = args.indexOf("--limit")
  if (limitIndex >= 0 && args[limitIndex + 1]) {
    config.limit = Number(args[limitIndex + 1]) || null
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

  return `${base || "documento"}${ext || ".pdf"}`
}

function normalizeFileName(name = "") {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
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

function cleanPdfText(text = "") {
  return String(text || "")
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

function buildCatalogContent(fileName, extracted, metadata) {
  const excerpt = String(extracted?.text || "")
    .slice(0, 3200)
    .trim()

  return [
    `Documento privado do GIOM: ${fileName}.`,
    `Paginas detectadas: ${extracted?.pages || "nao informado"}.`,
    `Categorias: ${(metadata.categories || []).join(", ") || "bible"}.`,
    `Modulos: ${(metadata.modules || []).join(", ") || "bible"}.`,
    `Submodulos biblicos: ${(metadata.bibleStudyModules || []).join(", ") || "nenhum"}.`,
    "Trecho inicial para identificacao e busca:",
    excerpt
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

function inferPdfKnowledgeMetadata(fileName = "") {
  const normalized = String(fileName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  const category = "bible"
  const categories = new Set(["bible", "private_library"])
  const modules = new Set(["bible"])
  const bibleStudyModules = new Set()

  if (/\b(estudo|study)\b/.test(normalized)) {
    categories.add("theology")
    bibleStudyModules.add("study_bibles_resources")
    bibleStudyModules.add("study_methods_hermeneutics")
  }

  if (/\b(cronolog|ordem cronologica)\b/.test(normalized)) {
    categories.add("biblical_history")
    bibleStudyModules.add("biblical_periods")
    bibleStudyModules.add("biblical_history")
  }

  if (/\b(arqueolog|qumran|mar morto)\b/.test(normalized)) {
    categories.add("biblical_archaeology")
    categories.add("biblical_history")
    modules.add("history_archaeology")
    bibleStudyModules.add("biblical_archaeology")
    bibleStudyModules.add("biblical_history")
  }

  if (/\b(jerusalem|jerusal[eé]m|patmos|thompson|genebra|naa)\b/.test(normalized)) {
    categories.add("theology")
    bibleStudyModules.add("study_bibles_resources")
  }

  if (/\b(judaismo nazareno|nazareno|yeshua|hamashiach)\b/.test(normalized)) {
    categories.add("church_history")
    categories.add("theology")
    bibleStudyModules.add("church_history")
    bibleStudyModules.add("systematic_theology")
  }

  if (/\b(strong|hebraic|hebraica|grego|torah|tora|profetas|escritos)\b/.test(normalized)) {
    categories.add("biblical_languages")
    bibleStudyModules.add("biblical_languages")
  }

  if (/\b(prega|sermao|sermao|devocional|igreja)\b/.test(normalized)) {
    categories.add("pastoral_theology")
    bibleStudyModules.add("homiletics_preaching")
    bibleStudyModules.add("devotional_practice")
  }

  const language = /\b(the holy bible|holy bible)\b/.test(normalized) ? "en" : "pt"

  return {
    category,
    categories: Array.from(categories),
    modules: Array.from(modules),
    bibleStudyModules: Array.from(bibleStudyModules),
    language
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
    text: cleanPdfText(parsed?.text || ""),
    pages: Number(parsed?.numpages || 0) || null
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

async function listPdfFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  return entries
    .filter(entry => entry.isFile() && /\.pdf$/i.test(entry.name))
    .map(entry => path.join(dir, entry.name))
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }))
}

async function writeManifest(records) {
  const outDir = path.join(process.cwd(), "knowledge", "imported")
  await fs.mkdir(outDir, { recursive: true })
  const outFile = path.join(outDir, "private-pdf-library-manifest.json")
  await fs.writeFile(outFile, JSON.stringify(records, null, 2), "utf8")
  return {
    outFile,
    content: JSON.stringify(records, null, 2)
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

async function ingestPrivatePdfLibrary() {
  const config = parseArgs()
  const files = await listPdfFiles(config.dir)

  if (files.length === 0) {
    throw new Error(`Nenhum PDF encontrado em ${config.dir}`)
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
    throw new Error("Nenhum PDF corresponde ao filtro informado.")
  }
  console.log(`📚 Biblioteca privada detectada: ${selectedFiles.length} PDFs`)
  console.log(`🧭 Modo de indexacao: ${config.indexMode}`)
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
      const pdfObjectPath = `${config.prefix}/${storageName}`
      const textObjectPath = `${config.prefix}/${storageName.replace(/\.pdf$/i, ".txt")}`
      const metadata = inferPdfKnowledgeMetadata(fileName)
      const extracted = await extractPdfText(buffer)
      let pdfUpload = {
        multipart: false,
        objectPaths: [pdfObjectPath],
        manifestPath: null
      }
      let textUpload = {
        multipart: false,
        objectPaths: [textObjectPath],
        manifestPath: null
      }

      if (!extracted.text) {
        console.warn(`⚠️ PDF sem texto útil extraído: ${fileName}`)
        continue
      }

      const chunks = chunkText(extracted.text, config.chunkChars)
      totalChunks += config.indexMode === "full" ? chunks.length : (config.indexMode === "catalog" ? 1 : 0)

      if (!config.dryRun) {
        if (!config.skipUpload) {
          pdfUpload = await uploadLargeObject(client, config.bucket, pdfObjectPath, buffer, "application/pdf")
          textUpload = await uploadLargeObject(client, config.bucket, textObjectPath, Buffer.from(extracted.text, "utf8"), "text/plain; charset=utf-8")
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
            storageBucket: config.bucket,
            storagePath: pdfObjectPath,
            storageTextPath: textObjectPath,
            storageObjectPaths: pdfUpload.objectPaths,
            storageTextObjectPaths: textUpload.objectPaths,
            storageManifestPath: pdfUpload.manifestPath,
            storageTextManifestPath: textUpload.manifestPath,
            storageMultipart: pdfUpload.multipart || textUpload.multipart,
            privateLibrary: true,
            pages: extracted.pages,
            checksum: fileHash
          }

          if (config.indexMode === "catalog") {
            await syncKnowledgeEntries(client, ragClient, [{
              content: buildCatalogContent(fileName, extracted, metadata),
              metadata: {
                ...sharedKnowledgeMetadata,
                chunkIndex: 1,
                chunkTotal: 1,
                indexMode: "catalog"
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
                indexMode: "full"
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
        bucket: config.bucket,
        pdfObjectPath,
        textObjectPath,
        pdfObjectPaths: pdfUpload.objectPaths,
        textObjectPaths: textUpload.objectPaths,
        pdfManifestPath: pdfUpload.manifestPath,
        textManifestPath: textUpload.manifestPath,
        multipartStored: pdfUpload.multipart || textUpload.multipart,
        pages: extracted.pages,
        sizeBytes: buffer.length,
        extractedChars: extracted.text.length,
        chunkCount: config.indexMode === "full" ? chunks.length : (config.indexMode === "catalog" ? 1 : 0),
        indexMode: config.indexMode,
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
      `${config.prefix}/private-pdf-library-manifest.json`,
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

ingestPrivatePdfLibrary().catch(error => {
  console.error("❌ Falha na ingestao da biblioteca privada:", error.message)
  process.exit(1)
})
