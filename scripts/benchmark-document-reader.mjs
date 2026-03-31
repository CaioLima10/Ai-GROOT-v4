#!/usr/bin/env node

import fs from "fs/promises"
import path from "path"

const ROOT = process.cwd()
const REPORT_FILE = path.join(ROOT, "reports", "document-reader-benchmark.json")

function parseArgs() {
  const args = process.argv.slice(2)
  const cfg = {
    dataset: "benchmarks/document-reader/dataset-template.csv",
    baseUrl: String(process.env.UPLOAD_EXTERNAL_READER_URL || "http://127.0.0.1:8090").replace(/\/$/, ""),
    apiKey: String(process.env.UPLOAD_EXTERNAL_READER_API_KEY || "").trim(),
    limit: 12000
  }

  const dsIdx = args.indexOf("--dataset")
  if (dsIdx >= 0 && args[dsIdx + 1]) cfg.dataset = args[dsIdx + 1]

  const urlIdx = args.indexOf("--url")
  if (urlIdx >= 0 && args[urlIdx + 1]) cfg.baseUrl = String(args[urlIdx + 1]).replace(/\/$/, "")

  const limIdx = args.indexOf("--limit")
  if (limIdx >= 0 && args[limIdx + 1]) cfg.limit = Math.max(1000, Number(args[limIdx + 1]) || 12000)

  return cfg
}

function parseCsvLine(line) {
  const out = []
  let current = ""
  let quote = false

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (quote && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        quote = !quote
      }
      continue
    }

    if (ch === "," && !quote) {
      out.push(current)
      current = ""
      continue
    }

    current += ch
  }
  out.push(current)
  return out.map((v) => String(v || "").trim())
}

async function loadDataset(filePath) {
  const raw = await fs.readFile(path.resolve(ROOT, filePath), "utf8")
  const lines = raw.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line)
    const row = {}
    headers.forEach((key, idx) => {
      row[key] = cols[idx] ?? ""
    })
    return row
  })
}

function levenshteinWords(a, b) {
  const aw = String(a || "").trim().split(/\s+/).filter(Boolean)
  const bw = String(b || "").trim().split(/\s+/).filter(Boolean)

  if (!bw.length) return aw.length ? 1 : 0

  const dp = Array.from({ length: aw.length + 1 }, () => Array(bw.length + 1).fill(0))
  for (let i = 0; i <= aw.length; i += 1) dp[i][0] = i
  for (let j = 0; j <= bw.length; j += 1) dp[0][j] = j

  for (let i = 1; i <= aw.length; i += 1) {
    for (let j = 1; j <= bw.length; j += 1) {
      const cost = aw[i - 1] === bw[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
    }
  }

  return dp[aw.length][bw.length] / bw.length
}

async function fileExists(target) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

async function runCase(entry, cfg) {
  const filePath = path.resolve(ROOT, entry.file_path || "")
  if (!(await fileExists(filePath))) {
    return { id: entry.doc_id || "unknown", status: "missing-file", ok: false }
  }

  const buffer = await fs.readFile(filePath)
  const form = new FormData()
  form.append("kind", String(entry.kind || "auto"))
  form.append("limit", String(cfg.limit))
  form.append("file", new Blob([buffer]), path.basename(filePath))

  const headers = {}
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`

  const startedAt = Date.now()
  const response = await fetch(`${cfg.baseUrl}/v1/extract`, {
    method: "POST",
    body: form,
    headers
  })

  if (!response.ok) {
    return {
      id: entry.doc_id || "unknown",
      status: "http-error",
      httpStatus: response.status,
      ok: false,
      latencyMs: Date.now() - startedAt
    }
  }

  const payload = await response.json()
  const extractedText = String(payload?.text || "")
  const fullLength = Number(payload?.fullTextLength || extractedText.length || 0)

  let wer = null
  const gtPath = String(entry.ground_truth_path || "").trim()
  if (gtPath) {
    const absGt = path.resolve(ROOT, gtPath)
    if (await fileExists(absGt)) {
      const gt = await fs.readFile(absGt, "utf8")
      wer = Number(levenshteinWords(extractedText, gt).toFixed(4))
    }
  }

  return {
    id: entry.doc_id || "unknown",
    filePath: entry.file_path || "",
    kind: entry.kind || "auto",
    ok: Boolean(payload?.ok),
    quality: String(payload?.quality || "unknown"),
    method: String(payload?.method || "unknown"),
    fullTextLength: fullLength,
    truncated: Boolean(payload?.truncated),
    warnings: Array.isArray(payload?.warnings) ? payload.warnings : [],
    wer,
    latencyMs: Date.now() - startedAt,
    status: "ok"
  }
}

async function main() {
  const cfg = parseArgs()
  const dataset = await loadDataset(cfg.dataset)
  if (!dataset.length) {
    throw new Error(`dataset vazio: ${cfg.dataset}`)
  }

  const results = []
  for (const entry of dataset) {
    // sequencial para evitar overload durante benchmark inicial
    const row = await runCase(entry, cfg)
    results.push(row)
    console.log(`CASE ${row.id} ${row.status} quality=${row.quality || "n/a"} latencyMs=${row.latencyMs || 0}`)
  }

  const total = results.length
  const okRows = results.filter((r) => r.ok)
  const highRows = results.filter((r) => r.quality === "high")
  const noneRows = results.filter((r) => r.quality === "none")
  const avgLatency = total ? Number((results.reduce((s, r) => s + Number(r.latencyMs || 0), 0) / total).toFixed(2)) : 0
  const wers = results.map((r) => r.wer).filter((v) => Number.isFinite(v))
  const avgWer = wers.length ? Number((wers.reduce((s, v) => s + Number(v), 0) / wers.length).toFixed(4)) : null

  const summary = {
    generatedAt: new Date().toISOString(),
    dataset: cfg.dataset,
    total,
    ok: okRows.length,
    successRate: total ? Number((okRows.length / total).toFixed(4)) : 0,
    qualityHigh: highRows.length,
    qualityNone: noneRows.length,
    avgLatencyMs: avgLatency,
    avgWer,
    gtCompared: wers.length
  }

  await fs.mkdir(path.join(ROOT, "reports"), { recursive: true })
  await fs.writeFile(REPORT_FILE, `${JSON.stringify({ summary, results }, null, 2)}\n`, "utf8")

  console.log(`BENCHMARK_OK ${REPORT_FILE}`)
  console.log(`TOTAL ${summary.total}`)
  console.log(`SUCCESS_RATE ${summary.successRate}`)
  console.log(`QUALITY_NONE ${summary.qualityNone}`)
  console.log(`AVG_LATENCY_MS ${summary.avgLatencyMs}`)
  console.log(`AVG_WER ${summary.avgWer ?? "n/a"}`)
}

main().catch((error) => {
  console.error(`BENCHMARK_ERROR ${error.message}`)
  process.exit(1)
})
