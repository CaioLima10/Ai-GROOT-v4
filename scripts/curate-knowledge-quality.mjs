import crypto from "crypto"
import fs from "fs/promises"
import path from "path"

const DEFAULT_INPUT_DIR = path.join(process.cwd(), "knowledge", "docs")
const DEFAULT_OUTPUT_FILE = path.join(process.cwd(), "reports", "knowledge-curation-report.json")

const SUPPORTED_EXT = new Set([".txt", ".md", ".json", ".jsonl", ".csv", ".tsv", ".html", ".xml", ".yml", ".yaml", ".svg"])

function parseArgs() {
  const args = process.argv.slice(2)
  const config = {
    dir: DEFAULT_INPUT_DIR,
    minChars: 700,
    maxNoiseRatio: 0.14,
    minScore: 70,
    output: DEFAULT_OUTPUT_FILE
  }

  const dirIdx = args.indexOf("--dir")
  if (dirIdx >= 0 && args[dirIdx + 1]) config.dir = path.resolve(process.cwd(), args[dirIdx + 1])

  const minCharsIdx = args.indexOf("--min-chars")
  if (minCharsIdx >= 0 && args[minCharsIdx + 1]) config.minChars = Number(args[minCharsIdx + 1]) || config.minChars

  const noiseIdx = args.indexOf("--max-noise")
  if (noiseIdx >= 0 && args[noiseIdx + 1]) config.maxNoiseRatio = Number(args[noiseIdx + 1]) || config.maxNoiseRatio

  const scoreIdx = args.indexOf("--min-score")
  if (scoreIdx >= 0 && args[scoreIdx + 1]) config.minScore = Number(args[scoreIdx + 1]) || config.minScore

  const outIdx = args.indexOf("--output")
  if (outIdx >= 0 && args[outIdx + 1]) config.output = path.resolve(process.cwd(), args[outIdx + 1])

  return config
}

async function listFiles(rootDir) {
  const files = []

  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }

      if (entry.isFile() && SUPPORTED_EXT.has(path.extname(entry.name).toLowerCase())) {
        files.push(full)
      }
    }
  }

  await walk(rootDir)
  return files
}

function readFrontMatter(raw) {
  const text = String(raw || "")
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) {
    return { metadata: {}, body: text }
  }

  const metadata = {}
  for (const line of match[1].split(/\r?\n/)) {
    const [k, ...rest] = line.split(":")
    if (!k || rest.length === 0) continue
    metadata[k.trim()] = rest.join(":").trim()
  }

  return {
    metadata,
    body: text.slice(match[0].length)
  }
}

function calcNoiseRatio(text) {
  if (!text) return 1
  const chars = Array.from(text)
  const noisy = chars.filter((ch) => /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffd]/.test(ch)).length
  return noisy / chars.length
}

function lexicalDiversity(text) {
  const words = String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return 0
  const unique = new Set(words)
  return unique.size / words.length
}

function sentenceCount(text) {
  return String(text || "").split(/[.!?]+/).map((x) => x.trim()).filter(Boolean).length
}

function qualityScore({ body, metadata, minChars, maxNoiseRatio }) {
  let score = 100
  const reasons = []

  const text = String(body || "").trim()
  const chars = text.length
  const noise = calcNoiseRatio(text)
  const diversity = lexicalDiversity(text)
  const sentences = sentenceCount(text)

  if (chars < minChars) {
    score -= 30
    reasons.push(`texto curto (${chars} chars)`)
  }

  if (noise > maxNoiseRatio) {
    score -= 35
    reasons.push(`ruido OCR alto (${noise.toFixed(3)})`)
  }

  if (diversity < 0.22) {
    score -= 20
    reasons.push(`baixa diversidade lexical (${diversity.toFixed(3)})`)
  }

  if (sentences < 8) {
    score -= 10
    reasons.push(`poucas sentencas (${sentences})`)
  }

  const rights = String(metadata.rights || metadata.license || "").toLowerCase()
  if (!rights) {
    score -= 15
    reasons.push("direitos/licenca ausentes")
  }

  if (rights && !(rights.includes("public") || rights.includes("user") || rights.includes("creative") || rights.includes("cc-"))) {
    score -= 20
    reasons.push(`direitos nao claros (${rights})`)
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    chars,
    noiseRatio: Number(noise.toFixed(4)),
    lexicalDiversity: Number(diversity.toFixed(4)),
    sentences,
    reasons
  }
}

async function main() {
  const config = parseArgs()
  const files = await listFiles(config.dir)

  const seenHashes = new Set()
  const accepted = []
  const rejected = []

  for (const file of files) {
    const raw = await fs.readFile(file, "utf8")
    const { metadata, body } = readFrontMatter(raw)

    const hash = crypto.createHash("sha1").update(body).digest("hex")
    const metrics = qualityScore({
      body,
      metadata,
      minChars: config.minChars,
      maxNoiseRatio: config.maxNoiseRatio
    })

    const relativeFile = path.relative(process.cwd(), file).replace(/\\/g, "/")

    if (seenHashes.has(hash)) {
      rejected.push({
        file: relativeFile,
        decision: "reject",
        score: 0,
        reasons: ["duplicado exato"],
        hash
      })
      continue
    }

    seenHashes.add(hash)

    const row = {
      file: relativeFile,
      decision: metrics.score >= config.minScore ? "accept" : "reject",
      score: metrics.score,
      metrics,
      metadata
    }

    if (row.decision === "accept") accepted.push(row)
    else rejected.push(row)
  }

  const report = {
    generatedAt: new Date().toISOString(),
    inputDir: config.dir,
    thresholds: {
      minChars: config.minChars,
      maxNoiseRatio: config.maxNoiseRatio,
      minScore: config.minScore
    },
    totals: {
      scanned: files.length,
      accepted: accepted.length,
      rejected: rejected.length,
      acceptanceRate: files.length ? Number((accepted.length / files.length).toFixed(4)) : 0
    },
    acceptedTop100: accepted.sort((a, b) => b.score - a.score).slice(0, 100),
    rejectedTop100: rejected.slice(0, 100),
    acceptedAll: accepted,
    rejectedAll: rejected
  }

  await fs.mkdir(path.dirname(config.output), { recursive: true })
  await fs.writeFile(config.output, `${JSON.stringify(report, null, 2)}\n`, "utf8")

  console.log(`CURATION_OK ${config.output}`)
  console.log(`SCANNED ${report.totals.scanned}`)
  console.log(`ACCEPTED ${report.totals.accepted}`)
  console.log(`REJECTED ${report.totals.rejected}`)
}

main().catch((error) => {
  console.error(`CURATION_ERROR ${error.message}`)
  process.exit(1)
})
