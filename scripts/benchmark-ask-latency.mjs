import fs from "node:fs/promises"
import path from "node:path"

const SERVER_URL = process.env.GIOM_BENCH_SERVER_URL || "http://127.0.0.1:3000"
const REPORT_PATH = path.join(process.cwd(), "reports", "ask-latency-benchmark.json")
const USER_ID = "ask_latency_benchmark"
const DEFAULT_RUNS = 5
const DEFAULT_TIMEOUT_MS = 45_000
const DEFAULT_QUESTION = "Responda em uma frase curta: o que e o GIOM?"

function parseArgs(argv) {
  const args = {
    runs: DEFAULT_RUNS,
    mode: "both",
    question: DEFAULT_QUESTION,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    warmup: true
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--runs") {
      args.runs = Number(argv[index + 1] || DEFAULT_RUNS)
      index += 1
      continue
    }

    if (arg.startsWith("--runs=")) {
      args.runs = Number(arg.split("=")[1] || DEFAULT_RUNS)
      continue
    }

    if (arg === "--ask-only") {
      args.mode = "ask"
      continue
    }

    if (arg === "--stream-only") {
      args.mode = "stream"
      continue
    }

    if (arg === "--no-warmup") {
      args.warmup = false
      continue
    }

    if (arg === "--question") {
      args.question = String(argv[index + 1] || DEFAULT_QUESTION)
      index += 1
      continue
    }

    if (arg.startsWith("--question=")) {
      args.question = String(arg.split("=").slice(1).join("=") || DEFAULT_QUESTION)
      continue
    }

    if (arg === "--timeout-ms") {
      args.timeoutMs = Number(argv[index + 1] || DEFAULT_TIMEOUT_MS)
      index += 1
      continue
    }

    if (arg.startsWith("--timeout-ms=")) {
      args.timeoutMs = Number(arg.split("=")[1] || DEFAULT_TIMEOUT_MS)
      continue
    }
  }

  if (!Number.isFinite(args.runs) || args.runs <= 0) {
    args.runs = DEFAULT_RUNS
  }

  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
    args.timeoutMs = DEFAULT_TIMEOUT_MS
  }

  return args
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.headers || {})
      }
    })
  } finally {
    clearTimeout(timer)
  }
}

async function waitForServer(timeoutMs = 15_000) {
  const startedAt = Date.now()
  const readinessChecks = [
    `${SERVER_URL}/capabilities`,
    `${SERVER_URL}/config`,
    `${SERVER_URL}/health`
  ]

  while (Date.now() - startedAt < timeoutMs) {
    for (const url of readinessChecks) {
      try {
        const response = await fetchWithTimeout(url, {}, 6_000)
        if (response.ok) {
          return
        }
      } catch {
        // tenta proximo endpoint de readiness
      }
    }

    await sleep(500)
  }

  throw new Error(`Servidor nao respondeu em ${timeoutMs}ms: ${SERVER_URL}`)
}

function nowMs() {
  return Number(process.hrtime.bigint() / 1_000_000n)
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function percentile(values, ratio) {
  if (!values.length) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))
  return sorted[index]
}

function buildContext(question) {
  return {
    channel: "latency-benchmark",
    migrationStage: 4,
    assistantProfile: "concise_operator",
    preferredResponseCard: "text",
    benchmark: true,
    instructions: "Responda em uma frase curta, objetiva e sem markdown.",
    history: [],
    questionLength: String(question || "").length
  }
}

function parseSSEPacket(packet) {
  const lines = String(packet || "").split(/\r?\n/)
  let event = "message"
  const dataLines = []

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim()
      continue
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim())
    }
  }

  if (!dataLines.length) return null

  try {
    return {
      event,
      data: JSON.parse(dataLines.join("\n"))
    }
  } catch {
    return null
  }
}

async function benchAsk(question, timeoutMs) {
  const startedAt = nowMs()
  const response = await fetchWithTimeout(`${SERVER_URL}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": USER_ID
    },
    body: JSON.stringify({
      question,
      context: buildContext(question)
    })
  }, timeoutMs)

  const headersAt = nowMs()
  const raw = await response.text()
  const finishedAt = nowMs()
  const payload = raw ? JSON.parse(raw) : {}

  if (!response.ok) {
    throw new Error(payload?.error || payload?.details || `Falha no /ask (${response.status})`)
  }

  const answer = String(payload?.data?.response || payload?.response || payload?.answer || "").trim()

  return {
    status: response.status,
    ttfbMs: headersAt - startedAt,
    totalMs: finishedAt - startedAt,
    responseLength: answer.length,
    answerPreview: answer.slice(0, 160)
  }
}

async function benchStream(question, timeoutMs) {
  const startedAt = nowMs()
  const response = await fetchWithTimeout(`${SERVER_URL}/ask/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": USER_ID
    },
    body: JSON.stringify({
      question,
      context: buildContext(question)
    })
  }, timeoutMs)

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "")
    throw new Error(text || `Falha no /ask/stream (${response.status})`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let firstChunkAt = 0
  let completeAt = 0
  let lastResponse = ""
  let chunkCount = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    if (!firstChunkAt && value?.length) {
      firstChunkAt = nowMs()
    }

    buffer += decoder.decode(value, { stream: true })
    const packets = buffer.split("\n\n")
    buffer = packets.pop() || ""

    for (const packet of packets) {
      const parsed = parseSSEPacket(packet)
      if (!parsed) continue

      if (parsed.event === "chunk") {
        chunkCount += 1
        const partial = String(parsed.data?.fullText || parsed.data?.chunk || "")
        if (partial) {
          lastResponse = partial
        }
      }

      if (parsed.event === "complete") {
        completeAt = nowMs()
        const finalResponse = String(parsed.data?.response || "")
        if (finalResponse) {
          lastResponse = finalResponse
        }
      }
    }
  }

  if (!firstChunkAt) {
    firstChunkAt = nowMs()
  }

  if (!completeAt) {
    completeAt = nowMs()
  }

  return {
    status: response.status,
    ttfbMs: firstChunkAt - startedAt,
    totalMs: completeAt - startedAt,
    responseLength: lastResponse.length,
    chunkCount,
    answerPreview: lastResponse.slice(0, 160)
  }
}

function summarizeRuns(name, runs) {
  const totals = runs.map((entry) => entry.totalMs)
  const ttfbs = runs.map((entry) => entry.ttfbMs)

  return {
    name,
    runs: runs.length,
    totalMs: {
      min: round(Math.min(...totals)),
      avg: round(totals.reduce((sum, value) => sum + value, 0) / totals.length),
      p50: round(percentile(totals, 0.5)),
      p95: round(percentile(totals, 0.95)),
      max: round(Math.max(...totals))
    },
    ttfbMs: {
      min: round(Math.min(...ttfbs)),
      avg: round(ttfbs.reduce((sum, value) => sum + value, 0) / ttfbs.length),
      p50: round(percentile(ttfbs, 0.5)),
      p95: round(percentile(ttfbs, 0.95)),
      max: round(Math.max(...ttfbs))
    },
    responseLength: {
      min: Math.min(...runs.map((entry) => entry.responseLength)),
      avg: round(runs.reduce((sum, entry) => sum + entry.responseLength, 0) / runs.length),
      max: Math.max(...runs.map((entry) => entry.responseLength))
    }
  }
}

async function runBenchmark(label, runs, fn) {
  const results = []

  for (let index = 0; index < runs; index += 1) {
    const measurement = await fn()
    results.push({ run: index + 1, ...measurement })
    console.log(`${label} run ${index + 1}/${runs}: total=${measurement.totalMs}ms ttfb=${measurement.ttfbMs}ms len=${measurement.responseLength}`)
    await sleep(250)
  }

  return results
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  await waitForServer()

  if (args.warmup) {
    console.log("Warmup /ask...")
    await benchAsk(args.question, args.timeoutMs)
    console.log("Warmup /ask/stream...")
    await benchStream(args.question, args.timeoutMs)
  }

  const report = {
    generatedAt: new Date().toISOString(),
    serverUrl: SERVER_URL,
    question: args.question,
    runs: args.runs,
    timeoutMs: args.timeoutMs,
    warmup: args.warmup,
    ask: null,
    stream: null
  }

  if (args.mode === "both" || args.mode === "ask") {
    const askRuns = await runBenchmark("/ask", args.runs, async () => await benchAsk(args.question, args.timeoutMs))
    report.ask = {
      summary: summarizeRuns("ask", askRuns),
      runs: askRuns
    }
  }

  if (args.mode === "both" || args.mode === "stream") {
    const streamRuns = await runBenchmark("/ask/stream", args.runs, async () => await benchStream(args.question, args.timeoutMs))
    report.stream = {
      summary: summarizeRuns("stream", streamRuns),
      runs: streamRuns
    }
  }

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true })
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8")

  console.log("\nResumo")
  if (report.ask?.summary) {
    console.log(`/ask total avg=${report.ask.summary.totalMs.avg}ms p50=${report.ask.summary.totalMs.p50}ms p95=${report.ask.summary.totalMs.p95}ms | ttfb avg=${report.ask.summary.ttfbMs.avg}ms`)
  }
  if (report.stream?.summary) {
    console.log(`/ask/stream total avg=${report.stream.summary.totalMs.avg}ms p50=${report.stream.summary.totalMs.p50}ms p95=${report.stream.summary.totalMs.p95}ms | ttfb avg=${report.stream.summary.ttfbMs.avg}ms`)
  }
  console.log(`Relatorio salvo em ${REPORT_PATH}`)
}

main().catch((error) => {
  console.error("Benchmark de latencia falhou:", error.message)
  process.exit(1)
})