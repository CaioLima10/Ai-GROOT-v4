#!/usr/bin/env node
/**
 * Scale Knowledge Base by module targets
 * Real flow: health -> generate(target module) -> curate -> ingest -> audit
 */

import { spawn } from "child_process"
import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE_ROOT = path.resolve(__dirname, "..")
const KNOWLEDGE_DOCS = path.join(WORKSPACE_ROOT, "knowledge", "docs")
const REPORTS = path.join(WORKSPACE_ROOT, "reports")

const DEFAULT_BATCH_SIZE = 5000
const DEFAULT_INGEST_CHUNK_SIZE = 200
const START_INDEX = 0
const MAX_ERROR_BATCHES = 3
const DEFAULT_MAX_BATCHES = 6000

const PRIORITY_TARGETS = {
  bible: 120000,
  language: 50000,
  agribusiness: 50000,
  finance: 50000,
  security: 50000,
  developer: 50000,
  research: 50000,
  education: 50000
}

const OTHERS_TARGET = 50000
const DEFAULT_MIN_SCORE = 76
const DEFAULT_MIN_CHARS = 850

function parseArgs() {
  const args = process.argv.slice(2)
  const cfg = {
    batchSize: DEFAULT_BATCH_SIZE,
    ingestChunkSize: DEFAULT_INGEST_CHUNK_SIZE,
    maxBatches: DEFAULT_MAX_BATCHES,
    minScore: DEFAULT_MIN_SCORE,
    minChars: DEFAULT_MIN_CHARS,
    othersTarget: OTHERS_TARGET
  }

  const batchIdx = args.indexOf("--batch-size")
  if (batchIdx >= 0 && args[batchIdx + 1]) {
    cfg.batchSize = Math.max(500, Number(args[batchIdx + 1]) || DEFAULT_BATCH_SIZE)
  }

  const maxIdx = args.indexOf("--max-batches")
  if (maxIdx >= 0 && args[maxIdx + 1]) {
    cfg.maxBatches = Math.max(1, Number(args[maxIdx + 1]) || DEFAULT_MAX_BATCHES)
  }

  const chunkIdx = args.indexOf("--ingest-chunk-size")
  if (chunkIdx >= 0 && args[chunkIdx + 1]) {
    cfg.ingestChunkSize = Math.max(50, Number(args[chunkIdx + 1]) || DEFAULT_INGEST_CHUNK_SIZE)
  }

  const scoreIdx = args.indexOf("--min-score")
  if (scoreIdx >= 0 && args[scoreIdx + 1]) {
    cfg.minScore = Math.max(1, Math.min(100, Number(args[scoreIdx + 1]) || DEFAULT_MIN_SCORE))
  }

  const charsIdx = args.indexOf("--min-chars")
  if (charsIdx >= 0 && args[charsIdx + 1]) {
    cfg.minChars = Math.max(200, Number(args[charsIdx + 1]) || DEFAULT_MIN_CHARS)
  }

  const othersIdx = args.indexOf("--others-target")
  if (othersIdx >= 0 && args[othersIdx + 1]) {
    cfg.othersTarget = Math.max(1000, Number(args[othersIdx + 1]) || OTHERS_TARGET)
  }

  return cfg
}

await fs.mkdir(REPORTS, { recursive: true })

function runNodeScript(scriptRelativePath, args = []) {
  const scriptPath = path.join(WORKSPACE_ROOT, scriptRelativePath)

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: WORKSPACE_ROOT,
      stdio: ["ignore", "pipe", "pipe"]
    })

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (chunk) => {
      const text = String(chunk)
      stdout += text
      process.stdout.write(text)
    })

    child.stderr.on("data", (chunk) => {
      const text = String(chunk)
      stderr += text
      process.stderr.write(text)
    })

    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ code, stdout, stderr })
      } else {
        reject(new Error(`Script failed (${scriptRelativePath}) code=${code}`))
      }
    })
  })
}

function parseMetric(output, key) {
  const match = String(output || "").match(new RegExp(`${key}\\s+([0-9]+)`, "i"))
  return match ? Number(match[1]) : null
}

function toCountMap(rows = []) {
  const map = {}
  for (const [name, count] of rows) {
    const key = String(name || "").trim().toLowerCase()
    if (!key) continue
    map[key] = Number(count || 0)
  }
  return map
}

function buildTargets(currentCounts = {}, othersTarget = OTHERS_TARGET) {
  const targets = { ...PRIORITY_TARGETS }

  for (const moduleName of Object.keys(currentCounts)) {
    if (targets[moduleName]) continue
    targets[moduleName] = othersTarget
  }

  return targets
}

function computeDeficits(targets = {}, currentCounts = {}) {
  const deficits = {}
  for (const [moduleName, target] of Object.entries(targets)) {
    const current = Number(currentCounts[moduleName] || 0)
    deficits[moduleName] = Math.max(0, Number(target) - current)
  }
  return deficits
}

function pickNextModule(deficits = {}) {
  const ranked = Object.entries(deficits)
    .filter(([, deficit]) => Number(deficit) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))

  if (!ranked.length) return null
  return ranked[0][0]
}

function summarizeDeficits(deficits = {}, topN = 10) {
  return Object.entries(deficits)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, topN)
    .map(([moduleName, value]) => `${moduleName}:${value}`)
    .join(" | ")
}

async function runHealth() {
  await runNodeScript("scripts/knowledge-health-report.mjs")
  const reportPath = path.join(REPORTS, "knowledge-health-report.json")
  const raw = await fs.readFile(reportPath, "utf8")
  return JSON.parse(raw)
}

async function generateBatch(batchNum, docsPerBatch, moduleName) {
  const batchDir = path.join(KNOWLEDGE_DOCS, `batch-${batchNum}`)
  await fs.rm(batchDir, { recursive: true, force: true }).catch(() => { })
  await fs.mkdir(batchDir, { recursive: true })
  const startIndex = START_INDEX + ((batchNum - 1) * docsPerBatch)

  console.log(`\n[generate] batch=${batchNum} docs=${docsPerBatch} startIndex=${startIndex} module=${moduleName}`)
  await runNodeScript("scripts/generate-giom-targeted-pack.mjs", [
    "--count", String(docsPerBatch),
    "--module", String(moduleName || "research"),
    "--start-index", String(startIndex),
    "--out-dir", batchDir
  ])

  const files = await fs.readdir(batchDir)
  const mdCount = files.filter((file) => file.endsWith(".md")).length
  console.log(`[generate] batch=${batchNum} generated=${mdCount}`)

  return { batchDir, generated: mdCount }
}

async function curateBatch(batchNum, batchDir, minChars, minScore) {
  const reportFile = path.join(REPORTS, `curation-batch-${String(batchNum).padStart(3, "0")}.json`)
  console.log(`\n[curate] batch=${batchNum}`)

  const result = await runNodeScript("scripts/curate-knowledge-quality.mjs", [
    "--dir", batchDir,
    "--min-chars", String(minChars),
    "--min-score", String(minScore),
    "--output", reportFile
  ])

  const accepted = parseMetric(result.stdout, "ACCEPTED") ?? 0
  const rejected = parseMetric(result.stdout, "REJECTED") ?? 0
  const scanned = parseMetric(result.stdout, "SCANNED") ?? (accepted + rejected)
  const acceptanceRate = scanned > 0 ? Number((accepted / scanned).toFixed(4)) : 0

  console.log(`[curate] batch=${batchNum} scanned=${scanned} accepted=${accepted} rejected=${rejected}`)
  return { reportFile, accepted, rejected, scanned, acceptanceRate }
}

async function ingestBatchInChunks(batchNum, batchDir, ingestChunkSize) {
  console.log(`\n[ingest] batch=${batchNum} chunkSize=${ingestChunkSize}`)

  const files = await fs.readdir(batchDir)
  const mdFiles = files.filter((file) => file.endsWith(".md")).sort()

  if (mdFiles.length === 0) {
    console.log(`[ingest] batch=${batchNum} no-files`)
    return { chunksProcessed: 0, chunksFailed: 0, estimatedRows: 0 }
  }

  const totalChunks = Math.ceil(mdFiles.length / ingestChunkSize)
  let chunksProcessed = 0
  let chunksFailed = 0
  let estimatedRows = 0

  async function ingestChunkFiles(chunkFiles, label, depth = 0) {
    const chunkDir = path.join(KNOWLEDGE_DOCS, `.ingest-batch-${batchNum}-chunk-${label}-d${depth}`)
    await fs.mkdir(chunkDir, { recursive: true })

    for (const fileName of chunkFiles) {
      await fs.copyFile(path.join(batchDir, fileName), path.join(chunkDir, fileName))
    }

    try {
      const result = await runNodeScript("scripts/ingest-knowledge.js", ["--dir", chunkDir])
      const rows = parseMetric(result.stdout, "Total de chunks")
      estimatedRows += Number(rows || 0)
      chunksProcessed += 1
      console.log(`[ingest] batch=${batchNum} chunk=${label} ok rows=${rows ?? 0} files=${chunkFiles.length}`)
      return true
    } catch (error) {
      const canSplit = chunkFiles.length >= 100 && depth < 4
      const timeoutLike = /statement timeout|code:\s*'57014'/i.test(String(error?.message || ""))

      if (canSplit || timeoutLike) {
        if (chunkFiles.length < 2 || depth >= 4) {
          chunksFailed += 1
          console.error(`[ingest] batch=${batchNum} chunk=${label} failed final: ${error.message}`)
          return false
        }

        const mid = Math.floor(chunkFiles.length / 2)
        const left = chunkFiles.slice(0, mid)
        const right = chunkFiles.slice(mid)
        console.warn(`[ingest] batch=${batchNum} chunk=${label} split depth=${depth + 1} files=${chunkFiles.length}`)
        const leftOk = await ingestChunkFiles(left, `${label}a`, depth + 1)
        const rightOk = await ingestChunkFiles(right, `${label}b`, depth + 1)
        return leftOk && rightOk
      }

      chunksFailed += 1
      console.error(`[ingest] batch=${batchNum} chunk=${label} failed final: ${error.message}`)
      return false
    } finally {
      await fs.rm(chunkDir, { recursive: true, force: true }).catch(() => { })
    }
  }

  for (let idx = 0; idx < totalChunks; idx += 1) {
    const start = idx * ingestChunkSize
    const end = Math.min(mdFiles.length, start + ingestChunkSize)
    const chunkFiles = mdFiles.slice(start, end)
    await ingestChunkFiles(chunkFiles, `${idx + 1}/${totalChunks}`, 0)
  }

  return { chunksProcessed, chunksFailed, estimatedRows }
}

async function auditAndReport(batchNum) {
  console.log(`\n[audit] batch=${batchNum}`)

  try {
    const result = await runNodeScript("scripts/audit-knowledge-supabase.mjs")
    const totalRows = parseMetric(result.stdout, "TOTAL_ROWS")
    const uniqueSupabaseSources = parseMetric(result.stdout, "UNIQUE_SUPABASE_SOURCES")
    const pendingLivros = parseMetric(result.stdout, "PENDING_LIVROS")
    const pendingBibles = parseMetric(result.stdout, "PENDING_BIBLES")
    const progress = totalRows ? Number(((totalRows / 100000) * 100).toFixed(2)) : 0

    const audit = {
      timestamp: new Date().toISOString(),
      totalRows: totalRows ?? 0,
      uniqueSupabaseSources: uniqueSupabaseSources ?? 0,
      pendingLivros: pendingLivros ?? 0,
      pendingBibles: pendingBibles ?? 0,
      progress
    }

    console.log(`[audit] rows=${audit.totalRows} sources=${audit.uniqueSupabaseSources} progress=${audit.progress}%`)
    return audit
  } catch (error) {
    console.warn(`[audit] failed: ${error.message}`)
    return null
  }
}

async function main() {
  const runtime = parseArgs()
  console.log("\n[scale] start module-target campaign")
  console.log(`[scale] batchSize=${runtime.batchSize} chunkSize=${runtime.ingestChunkSize} startIndex=${START_INDEX} maxBatches=${runtime.maxBatches}`)
  console.log(`[scale] priorityTargets=${JSON.stringify(PRIORITY_TARGETS)}`)
  console.log(`[scale] othersTarget=${runtime.othersTarget}`)

  const baselineHealth = await runHealth()
  const baselineCounts = toCountMap(baselineHealth?.stats?.modules || [])
  const targets = buildTargets(baselineCounts, runtime.othersTarget)
  let deficits = computeDeficits(targets, baselineCounts)

  const totalTargetRows = Object.values(targets).reduce((sum, value) => sum + Number(value || 0), 0)
  console.log(`[scale] targetModules=${Object.keys(targets).length} targetRows=${totalTargetRows}`)
  console.log(`[scale] initialDeficitTop=${summarizeDeficits(deficits, 12)}`)

  const scalingLog = {
    startedAt: new Date().toISOString(),
    targetRows: totalTargetRows,
    targets,
    batchSize: runtime.batchSize,
    ingestChunkSize: runtime.ingestChunkSize,
    startIndex: START_INDEX,
    minScore: runtime.minScore,
    minChars: runtime.minChars,
    othersTarget: runtime.othersTarget,
    batches: [],
    failedBatches: 0
  }

  for (let batchNum = 1; batchNum <= runtime.maxBatches; batchNum += 1) {
    const nextModule = pickNextModule(deficits)
    if (!nextModule) {
      console.log("[scale] all configured module targets reached")
      break
    }

    const batchLog = {
      batchNum,
      targetModule: nextModule,
      startedAt: new Date().toISOString(),
      steps: {}
    }

    try {
      const generated = await generateBatch(batchNum, runtime.batchSize, nextModule)
      batchLog.steps.generate = { status: "ok", ...generated }

      const curateResult = await curateBatch(batchNum, generated.batchDir, runtime.minChars, runtime.minScore)
      batchLog.steps.curate = { status: "ok", ...curateResult }

      const ingestResult = await ingestBatchInChunks(batchNum, generated.batchDir, runtime.ingestChunkSize)
      batchLog.steps.ingest = {
        status: ingestResult.chunksFailed > 0 ? "partial" : "ok",
        ...ingestResult
      }

      const auditResult = await auditAndReport(batchNum)
      batchLog.steps.audit = { status: auditResult ? "ok" : "failed", result: auditResult }

      const health = await runHealth()
      const moduleCounts = toCountMap(health?.stats?.modules || [])
      deficits = computeDeficits(targets, moduleCounts)
      const remaining = Object.values(deficits).reduce((sum, value) => sum + Number(value || 0), 0)
      batchLog.steps.health = {
        status: "ok",
        topDeficit: summarizeDeficits(deficits, 10),
        remaining
      }

      const progress = auditResult?.progress ?? "unknown"
      console.log(`\n[scale] batch=${batchNum}/${runtime.maxBatches} done progress=${progress}% targetModule=${nextModule}`)
      console.log(`[scale] deficitTop=${summarizeDeficits(deficits, 10)}`)

      await fs.rm(generated.batchDir, { recursive: true, force: true }).catch(() => { })
    } catch (error) {
      scalingLog.failedBatches += 1
      batchLog.error = error.message
      console.error(`\n[scale] batch=${batchNum} failed: ${error.message}`)

      if (scalingLog.failedBatches >= MAX_ERROR_BATCHES) {
        batchLog.terminated = true
        batchLog.completedAt = new Date().toISOString()
        scalingLog.batches.push(batchLog)
        console.error(`[scale] aborting after ${MAX_ERROR_BATCHES} failed batches`)
        break
      }
    }

    batchLog.completedAt = new Date().toISOString()
    scalingLog.batches.push(batchLog)

    if (batchNum < runtime.maxBatches) {
      console.log("[scale] wait=2s")
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }

  const finalAudit = await auditAndReport("final")
  scalingLog.finalAudit = finalAudit
  scalingLog.completedAt = new Date().toISOString()

  const logFile = path.join(REPORTS, "scaling-log-100k.json")
  await fs.writeFile(logFile, `${JSON.stringify(scalingLog, null, 2)}\n`, "utf8")
  console.log(`\n[scale] log=${path.relative(WORKSPACE_ROOT, logFile)}`)
  console.log("[scale] complete")
}

main().catch((error) => {
  console.error(`Fatal: ${error.message}`)
  process.exit(1)
})
