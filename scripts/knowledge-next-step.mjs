import path from "path"
import { fileURLToPath } from "url"
import { spawn } from "child_process"
import dotenv from "dotenv"

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const WORKSPACE_ROOT = path.resolve(__dirname, "..")

function parseArgs() {
  const args = process.argv.slice(2)

  const config = {
    dir: null,
    category: null,
    query: "Explique a doutrina da justificacao pela fe na perspectiva protestante.",
    topK: 5,
    skipCurated: false,
    dryRun: false
  }

  const dirIndex = args.indexOf("--dir")
  if (dirIndex >= 0 && args[dirIndex + 1]) {
    config.dir = args[dirIndex + 1]
  }

  const categoryIndex = args.indexOf("--category")
  if (categoryIndex >= 0 && args[categoryIndex + 1]) {
    config.category = args[categoryIndex + 1]
  }

  const queryIndex = args.indexOf("--query")
  if (queryIndex >= 0 && args[queryIndex + 1]) {
    config.query = args[queryIndex + 1]
  }

  const topKIndex = args.indexOf("--top-k")
  if (topKIndex >= 0 && args[topKIndex + 1]) {
    const parsed = Number(args[topKIndex + 1])
    if (Number.isFinite(parsed) && parsed > 0) {
      config.topK = Math.floor(parsed)
    }
  }

  config.skipCurated = args.includes("--skip-curated")
  config.dryRun = args.includes("--dry-run")

  return config
}

function runNodeScript(scriptName, args = []) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(WORKSPACE_ROOT, "scripts", scriptName)
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: WORKSPACE_ROOT,
      env: process.env,
      stdio: "inherit"
    })

    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`Script ${scriptName} finalizou com codigo ${code}`))
    })
  })
}

function summarizeKnowledge(results = [], topK = 5) {
  const top = results.slice(0, topK)
  const lines = []

  top.forEach((item, index) => {
    const category = String(item?.category || "unknown")
    const source = String(item?.source || "unknown")
    const title = String(item?.title || item?.sourceName || `item_${index + 1}`)
    const score = Number(item?.rankingScore ?? item?.similarity ?? 0)
    lines.push(`${index + 1}. [${category}] ${title} | fonte=${source} | score=${score.toFixed(4)}`)
  })

  return lines
}

async function runProbe(query, topK) {
  const { grootAdvancedRAG } = await import("../packages/ai-core/src/index.js")
  const response = await grootAdvancedRAG.searchKnowledge(query, {
    limit: Math.max(topK, 5)
  })

  const knowledge = Array.isArray(response?.knowledge) ? response.knowledge : []
  const bugs = Array.isArray(response?.bugs) ? response.bugs : []

  console.log("\n🔎 PROVA DE RECUPERACAO SEMANTICA")
  console.log(`QUERY: ${query}`)
  console.log(`TOTAL_ENCONTRADO: ${Number(response?.totalFound || 0)}`)
  console.log(`KNOWLEDGE_COUNT: ${knowledge.length}`)
  console.log(`BUG_COUNT: ${bugs.length}`)

  const lines = summarizeKnowledge(knowledge, topK)
  if (lines.length === 0) {
    console.log("TOP_RESULTS: nenhum resultado relevante retornado.")
    return
  }

  console.log("TOP_RESULTS:")
  lines.forEach(line => console.log(line))
}

async function main() {
  const config = parseArgs()
  const ingestArgs = []

  if (config.dir) {
    ingestArgs.push("--dir", config.dir)
  }
  if (config.category) {
    ingestArgs.push("--category", config.category)
  }
  if (config.dryRun) {
    ingestArgs.push("--dry-run")
  }

  console.log("🚀 PIPELINE NEXT-STEP INICIADO")
  console.log(`WORKSPACE: ${WORKSPACE_ROOT}`)
  console.log(`DRY_RUN: ${config.dryRun ? "SIM" : "NAO"}`)

  console.log("\n1/3 Ingestao local...")
  await runNodeScript("ingest-knowledge.js", ingestArgs)

  if (!config.skipCurated) {
    console.log("\n2/3 Ingestao curada...")
    await runNodeScript("ingest-curated.js")
  } else {
    console.log("\n2/3 Ingestao curada ignorada (--skip-curated).")
  }

  console.log("\n3/3 Probe de recuperacao...")
  await runProbe(config.query, config.topK)

  console.log("\n✅ PIPELINE NEXT-STEP CONCLUIDO")
}

main().catch((error) => {
  console.error(`\n❌ PIPELINE NEXT-STEP FALHOU: ${error.message}`)
  process.exit(1)
})
