#!/usr/bin/env node
/**
 * DLQ smoke test: submits a deliberately-invalid PDF to force extraction
 * failures, exhausts retries, and asserts the job lands in the dead-letter
 * queue (GET /v1/extract/dlq).
 *
 * Requires the Python reader to be running with DOC_READER_QUEUE_BACKEND=redis.
 * When the backend is "memory" the test is skipped (no persistence available).
 *
 * Max wait time before DLQ:
 *   attempt 1 → fails → retry after      800 ms
 *   attempt 2 → fails → retry after    1 600 ms
 *   attempt 3 → fails → sends to DLQ
 *   Total ≈ 3.5 – 6 s (plus worker latency)
 */

import { setTimeout as sleep } from "node:timers/promises"

const BASE_URL = String(
  process.env.UPLOAD_EXTERNAL_READER_URL || "http://127.0.0.1:8090"
).replace(/\/$/, "")

const API_KEY = String(process.env.UPLOAD_EXTERNAL_READER_API_KEY || "").trim()

const POLL_INTERVAL_MS = 400
const POLL_MAX_ATTEMPTS = 40   // 40 × 400 ms = 16 s ceiling
const DLQ_POLL_INTERVAL_MS = 600
const DLQ_POLL_MAX_ATTEMPTS = 20  // 20 × 600 ms = 12 s ceiling after job fails

// ── helpers ──────────────────────────────────────────────────────────────────

function buildHeaders(extra = {}) {
  const h = { ...extra }
  if (API_KEY) h.Authorization = `Bearer ${API_KEY}`
  return h
}

async function getMetrics() {
  const res = await fetch(`${BASE_URL}/metrics`, { headers: buildHeaders() })
  if (!res.ok) throw new Error(`/metrics HTTP ${res.status}`)
  return res.json()
}

async function submitPoisonJob() {
  // 8 bytes that are valid %PDF- header prefix but then garbage — PyMuPDF will
  // reject it as a corrupted document on every attempt.
  const poisonBytes = Buffer.from("%PDF-1.4\x00\x01\x02\x03INVALID_GROOT_DLQ_SMOKE", "utf8")

  const form = new FormData()
  form.append("kind", "auto")
  form.append("limit", "1000")
  form.append(
    "file",
    new Blob([poisonBytes], { type: "application/pdf" }),
    "groot-dlq-smoke-poison.pdf"
  )

  const res = await fetch(`${BASE_URL}/v1/extract/async`, {
    method: "POST",
    body: form,
    headers: buildHeaders()
  })

  if (!res.ok) throw new Error(`async submit HTTP ${res.status}`)
  const body = await res.json()
  const jobId = String(body?.jobId || "")
  if (!jobId) throw new Error("server did not return jobId")
  return jobId
}

async function pollJobUntilFailed(jobId) {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i += 1) {
    await sleep(POLL_INTERVAL_MS)
    const res = await fetch(`${BASE_URL}/v1/extract/jobs/${jobId}`, {
      headers: buildHeaders()
    })
    if (!res.ok) throw new Error(`/jobs/${jobId} HTTP ${res.status}`)
    const status = await res.json()
    const s = String(status?.status || "")

    if (s === "failed") return status
    if (s === "done") throw new Error("poison job unexpectedly succeeded — DLQ test invalid")
  }
  throw new Error(`job ${jobId} did not reach 'failed' within ${POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS} ms`)
}

async function pollDlqForJob(jobId) {
  for (let i = 0; i < DLQ_POLL_MAX_ATTEMPTS; i += 1) {
    await sleep(DLQ_POLL_INTERVAL_MS)
    const res = await fetch(`${BASE_URL}/v1/extract/dlq?limit=50`, {
      headers: buildHeaders()
    })
    if (!res.ok) throw new Error(`/v1/extract/dlq HTTP ${res.status}`)
    const body = await res.json()
    const items = Array.isArray(body?.items) ? body.items : []
    const found = items.find((it) => String(it?.jobId || "") === jobId)
    if (found) return { body, found }
  }
  throw new Error(`job ${jobId} not found in DLQ after ${DLQ_POLL_MAX_ATTEMPTS * DLQ_POLL_INTERVAL_MS} ms`)
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Check backend — skip gracefully when not Redis
  let metrics
  try {
    metrics = await getMetrics()
  } catch (err) {
    console.error(`DOC_READER_DLQ_SMOKE_ERROR cannot reach reader: ${err.message}`)
    process.exit(1)
  }

  const backend = String(metrics?.queue?.backend || metrics?.queueBackend || "memory").toLowerCase()
  if (backend !== "redis") {
    console.log("DOC_READER_DLQ_SMOKE_SKIP")
    console.log(`BACKEND ${backend} (Redis required for DLQ persistence)`)
    console.log("Start Docker, run: npm run bootstrap:runtime, then retry.")
    process.exit(0)
  }

  // 2. Submit poison job
  const jobId = await submitPoisonJob()
  console.log(`DOC_READER_DLQ_SMOKE_SUBMITTED ${jobId}`)

  // 3. Wait for job to exhaust retries → status=failed
  const failedJob = await pollJobUntilFailed(jobId)
  console.log(`DOC_READER_DLQ_SMOKE_JOB_FAILED attempts=${failedJob.attempts} error="${failedJob.error}"`)

  // 4. Assert job landed in DLQ
  const { body, found } = await pollDlqForJob(jobId)
  console.log("DOC_READER_DLQ_SMOKE_OK")
  console.log(`DLQ_BACKEND ${body.backend}`)
  console.log(`DLQ_TOTAL_ITEMS ${body.items.length}`)
  console.log(`DLQ_JOB ${found.jobId}`)
  console.log(`DLQ_ATTEMPTS ${found.attempts}`)
  console.log(`DLQ_KIND ${found.kind}`)
  console.log(`DLQ_FILE ${found.fileName}`)
  console.log(`DLQ_FAILED_AT ${found.failedAt}`)
}

main().catch((err) => {
  console.error(`DOC_READER_DLQ_SMOKE_ERROR ${err.message}`)
  process.exit(1)
})
