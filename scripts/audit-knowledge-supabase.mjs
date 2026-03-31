import crypto from "crypto"
import fs from "fs/promises"
import path from "path"
import dotenv from "dotenv"
import { createClient } from "@supabase/supabase-js"

dotenv.config()

const WORKSPACE_ROOT = process.cwd()
const USERPROFILE = process.env.USERPROFILE || "C:/Users/GabeG"

const DEFAULT_BUCKET = process.env.GIOM_PRIVATE_LIBRARY_BUCKET || "giom-private-library"
const PRIVATE_PREFIXES = ["private-library", "preaching-library"]
const BIBLE_PREFIX = "bible-pdfs"

const LIVROS_DIR = path.join(USERPROFILE, "Desktop", "LIVROS")
const BIBLES_DIR = path.join(USERPROFILE, "Desktop", "BIBLIAS PDF")

const PRIVATE_SUPPORTED_EXTENSIONS = new Set([
  ".pdf", ".txt", ".md", ".json", ".jsonl", ".csv", ".tsv", ".html", ".xml", ".yml", ".yaml", ".svg",
  ".docx", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"
])

const PDF_ONLY_EXTENSIONS = new Set([".pdf"])

function getExt(filePath = "") {
  return path.extname(filePath).toLowerCase()
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

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function listFiles(rootDir, extensionSet) {
  const output = []

  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }

      if (entry.isFile() && extensionSet.has(getExt(fullPath))) {
        output.push(fullPath)
      }
    }
  }

  if (!(await fileExists(rootDir))) {
    return output
  }

  await walk(rootDir)
  return output
}

async function buildSourceVariants(filePath, bucket, prefixes = []) {
  const buffer = await fs.readFile(filePath)
  const hash = crypto.createHash("sha1").update(buffer).digest("hex").slice(0, 12)
  const name = path.basename(filePath)
  const storageName = `${hash}-${slugifyFileName(name)}`
  const textName = storageName.replace(/\.[^.]+$/i, ".txt")

  return prefixes.map(prefix => `supabase://${bucket}/${prefix}/${textName}`)
}

async function fetchAllKnowledgeRows(client) {
  const pageSize = 1000
  let from = 0
  const rows = []

  for (let i = 0; i < 500; i += 1) {
    const to = from + pageSize - 1
    const { data, error } = await client
      .from("knowledge_embeddings")
      .select("source,category,language,created_at")
      .order("id", { ascending: true })
      .range(from, to)

    if (error) {
      throw new Error(`Falha ao consultar knowledge_embeddings: ${error.message}`)
    }

    const page = data || []
    rows.push(...page)
    if (page.length < pageSize) break
    from += pageSize
  }

  return rows
}

function summarizeRows(rows) {
  const sourceCounts = new Map()
  const categoryCounts = new Map()
  const languageCounts = new Map()

  let oldest = null
  let newest = null
  let supabaseSourceRows = 0
  let interactionRows = 0
  let localRows = 0

  for (const row of rows) {
    const source = String(row.source || "unknown")
    const category = String(row.category || "unknown")
    const language = String(row.language || "unknown")

    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1)
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1)
    languageCounts.set(language, (languageCounts.get(language) || 0) + 1)

    if (source.startsWith("supabase://")) supabaseSourceRows += 1
    if (source === "interaction") interactionRows += 1
    if (source === "local") localRows += 1

    if (row.created_at) {
      const dt = new Date(row.created_at)
      if (!oldest || dt < oldest) oldest = dt
      if (!newest || dt > newest) newest = dt
    }
  }

  const distinctSupabaseSources = [...sourceCounts.keys()].filter(item => item.startsWith("supabase://"))

  return {
    totalRows: rows.length,
    uniqueSourceDocuments: [...sourceCounts.keys()].length,
    uniqueSupabaseSourceDocuments: distinctSupabaseSources.length,
    supabaseSourceRows,
    interactionRows,
    localRows,
    oldestCreatedAt: oldest ? oldest.toISOString() : null,
    newestCreatedAt: newest ? newest.toISOString() : null,
    topSources: [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20),
    topCategories: [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20),
    topLanguages: [...languageCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20),
    sourceSet: new Set(sourceCounts.keys())
  }
}

async function compareLocalCoverage(sourceSet, options = {}) {
  const bucket = options.bucket || DEFAULT_BUCKET

  const books = await listFiles(LIVROS_DIR, PRIVATE_SUPPORTED_EXTENSIONS)
  const bibles = await listFiles(BIBLES_DIR, PDF_ONLY_EXTENSIONS)

  const livrosCoverage = []
  for (const filePath of books) {
    const variants = await buildSourceVariants(filePath, bucket, PRIVATE_PREFIXES)
    const injectedSource = variants.find(candidate => sourceSet.has(candidate)) || null
    livrosCoverage.push({
      file: filePath,
      injected: Boolean(injectedSource),
      injectedSource,
      expectedSourceVariants: variants
    })
  }

  const bibleCoverage = []
  for (const filePath of bibles) {
    const variants = await buildSourceVariants(filePath, bucket, [BIBLE_PREFIX])
    const injectedSource = variants.find(candidate => sourceSet.has(candidate)) || null
    bibleCoverage.push({
      file: filePath,
      injected: Boolean(injectedSource),
      injectedSource,
      expectedSourceVariants: variants
    })
  }

  const pendingBooks = livrosCoverage.filter(item => !item.injected)
  const pendingBibles = bibleCoverage.filter(item => !item.injected)

  return {
    bucket,
    folders: {
      livrosDir: LIVROS_DIR,
      biblesDir: BIBLES_DIR
    },
    livros: {
      totalFiles: livrosCoverage.length,
      injectedFiles: livrosCoverage.length - pendingBooks.length,
      pendingFiles: pendingBooks.length,
      pendingExamples: pendingBooks.slice(0, 30)
    },
    biblePdfs: {
      totalFiles: bibleCoverage.length,
      injectedFiles: bibleCoverage.length - pendingBibles.length,
      pendingFiles: pendingBibles.length,
      pendingExamples: pendingBibles.slice(0, 30)
    }
  }
}

async function main() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error("SUPABASE_URL/SUPABASE_SERVICE_KEY ausentes no ambiente")
  }

  const client = createClient(url, key, { auth: { persistSession: false } })

  const knowledgeVersions = await client
    .from("knowledge_versions")
    .select("*", { head: true, count: "exact" })

  const rows = await fetchAllKnowledgeRows(client)
  const summary = summarizeRows(rows)
  const coverage = await compareLocalCoverage(summary.sourceSet, { bucket: DEFAULT_BUCKET })

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalRows: summary.totalRows,
      uniqueSourceDocuments: summary.uniqueSourceDocuments,
      uniqueSupabaseSourceDocuments: summary.uniqueSupabaseSourceDocuments,
      supabaseSourceRows: summary.supabaseSourceRows,
      interactionRows: summary.interactionRows,
      localRows: summary.localRows,
      knowledgeVersionsCount: knowledgeVersions.count ?? 0,
      oldestCreatedAt: summary.oldestCreatedAt,
      newestCreatedAt: summary.newestCreatedAt
    },
    point1_unique_docs_vs_chunks: {
      uniqueSupabaseSourceDocuments: summary.uniqueSupabaseSourceDocuments,
      totalRowsInKnowledgeEmbeddings: summary.totalRows,
      avgChunksPerSupabaseDocument: summary.uniqueSupabaseSourceDocuments
        ? Number((summary.supabaseSourceRows / summary.uniqueSupabaseSourceDocuments).toFixed(2))
        : 0
    },
    point2_local_pending_files: coverage,
    point3_incremental_command: {
      recommended: "npm run knowledge:private-library -- --dir \"C:/Users/GabeG/Desktop/LIVROS\" --prefix preaching-library --index-mode full --skip-upload --rights user_provided_or_public_domain --continue-on-error",
      note: "Use --prefix bible-pdfs para PDFs bíblicos e mantenha --skip-upload para evitar reenvio desnecessário ao Storage."
    },
    topSources: summary.topSources,
    topCategories: summary.topCategories,
    topLanguages: summary.topLanguages
  }

  await fs.mkdir(path.join(WORKSPACE_ROOT, "reports"), { recursive: true })
  const outputPath = path.join(WORKSPACE_ROOT, "reports", "knowledge-audit.json")
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")

  console.log(`AUDIT_OK ${outputPath}`)
  console.log(`TOTAL_ROWS ${report.summary.totalRows}`)
  console.log(`UNIQUE_SUPABASE_SOURCES ${report.summary.uniqueSupabaseSourceDocuments}`)
  console.log(`PENDING_LIVROS ${report.point2_local_pending_files.livros.pendingFiles}`)
  console.log(`PENDING_BIBLES ${report.point2_local_pending_files.biblePdfs.pendingFiles}`)
}

main().catch((error) => {
  console.error(`AUDIT_ERROR ${error.message}`)
  process.exit(1)
})
