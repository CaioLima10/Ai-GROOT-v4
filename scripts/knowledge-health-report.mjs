import fs from "fs/promises"
import path from "path"
import dotenv from "dotenv"
import { createClient } from "@supabase/supabase-js"

dotenv.config()

const WORKSPACE_ROOT = process.cwd()
const REPORT_FILE = path.join(WORKSPACE_ROOT, "reports", "knowledge-health-report.json")

function getModulesFromRow(row) {
  const modules = new Set()
  const category = String(row?.category || "").trim()
  if (category) modules.add(category)

  const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {}
  const candidates = [
    metadata.modules,
    metadata.bibleStudyModules,
    metadata.categories,
    metadata.tags
  ]

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    for (const item of candidate) {
      const value = String(item || "").trim().toLowerCase()
      if (value) modules.add(value)
    }
  }

  return [...modules]
}

async function fetchAllRows(client) {
  const rows = []
  let pageSize = 500
  let from = 0

  for (let i = 0; i < 5000; i += 1) {
    const to = from + pageSize - 1
    let data = null
    let error = null

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await client
        .from("knowledge_embeddings")
        .select("id,source,category,language,metadata,created_at")
        .order("id", { ascending: true })
        .range(from, to)

      data = response.data || null
      error = response.error || null
      if (!error) break

      const isTimeout = /statement timeout/i.test(String(error.message || ""))
      if (isTimeout && pageSize > 100) {
        pageSize = Math.max(100, Math.floor(pageSize / 2))
        continue
      }
      break
    }

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

function aggregate(rows) {
  const sourceCount = new Map()
  const moduleCount = new Map()
  const categoryCount = new Map()
  const languageCount = new Map()

  let giomGeneratedRows = 0
  let supabaseRows = 0

  for (const row of rows) {
    const source = String(row.source || "unknown")
    sourceCount.set(source, (sourceCount.get(source) || 0) + 1)

    const category = String(row.category || "unknown")
    categoryCount.set(category, (categoryCount.get(category) || 0) + 1)

    const language = String(row.language || "unknown")
    languageCount.set(language, (languageCount.get(language) || 0) + 1)

    if (source.startsWith("local.generated.")) giomGeneratedRows += 1
    if (source.startsWith("supabase://")) supabaseRows += 1

    const modules = getModulesFromRow(row)
    for (const moduleName of modules) {
      moduleCount.set(moduleName, (moduleCount.get(moduleName) || 0) + 1)
    }
  }

  return {
    totalRows: rows.length,
    uniqueSources: sourceCount.size,
    giomGeneratedRows,
    supabaseRows,
    topSources: [...sourceCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30),
    modules: [...moduleCount.entries()].sort((a, b) => b[1] - a[1]),
    categories: [...categoryCount.entries()].sort((a, b) => b[1] - a[1]),
    languages: [...languageCount.entries()].sort((a, b) => b[1] - a[1])
  }
}

async function evaluateGiomAccess() {
  try {
    const { grootAdvancedRAG } = await import("../packages/ai-core/src/index.js")
    const probe = await grootAdvancedRAG.searchKnowledge("qualquer conteúdo de teste", { limit: 3 })

    return {
      enabled: Boolean(grootAdvancedRAG?.enabled),
      connectedToSupabase: Boolean(grootAdvancedRAG?.supabase),
      knowledgeResults: Array.isArray(probe?.knowledge) ? probe.knowledge.length : 0,
      bugResults: Array.isArray(probe?.bugs) ? probe.bugs.length : 0,
      totalFound: Number(probe?.totalFound || 0)
    }
  } catch (error) {
    return {
      enabled: false,
      connectedToSupabase: false,
      error: error.message
    }
  }
}

async function main() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error("SUPABASE_URL e SUPABASE_SERVICE_KEY/SUPABASE_ANON_KEY sao obrigatorios")
  }

  const client = createClient(url, key, { auth: { persistSession: false } })
  const rows = await fetchAllRows(client)
  const stats = aggregate(rows)
  const giomAccess = await evaluateGiomAccess()

  const progressTo100k = Number(((stats.totalRows / 100000) * 100).toFixed(2))

  const report = {
    generatedAt: new Date().toISOString(),
    progressTo100k,
    stats,
    giomAccess
  }

  await fs.mkdir(path.join(WORKSPACE_ROOT, "reports"), { recursive: true })
  await fs.writeFile(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`, "utf8")

  console.log(`HEALTH_OK ${REPORT_FILE}`)
  console.log(`TOTAL_ROWS ${stats.totalRows}`)
  console.log(`UNIQUE_SOURCES ${stats.uniqueSources}`)
  console.log(`GIOM_GENERATED_ROWS ${stats.giomGeneratedRows}`)
  console.log(`SUPABASE_SOURCE_ROWS ${stats.supabaseRows}`)
  console.log(`PROGRESS_100K ${progressTo100k}`)
  console.log(`GIOM_ACCESS_ENABLED ${giomAccess.enabled ? 1 : 0}`)
  console.log(`GIOM_SUPABASE_CONNECTED ${giomAccess.connectedToSupabase ? 1 : 0}`)
  console.log(`MODULES_COUNT ${stats.modules.length}`)
}

main().catch((error) => {
  console.error(`HEALTH_ERROR ${error.message}`)
  process.exit(1)
})
