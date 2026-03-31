#!/usr/bin/env node

const baseUrl = String(process.env.UPLOAD_EXTERNAL_READER_URL || "http://127.0.0.1:8090").replace(/\/$/, "")
const apiKey = String(process.env.UPLOAD_EXTERNAL_READER_API_KEY || "").trim()

async function main() {
  const headers = {}
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  const response = await fetch(`${baseUrl}/metrics`, { headers })
  if (!response.ok) {
    throw new Error(`metrics endpoint failed: HTTP ${response.status}`)
  }

  const m = await response.json()
  console.log("DOC_READER_METRICS_OK")
  console.log(`SYNC_REQUESTS ${m?.counters?.syncRequests ?? 0}`)
  console.log(`ASYNC_SUBMITTED ${m?.counters?.asyncSubmitted ?? 0}`)
  console.log(`ASYNC_COMPLETED ${m?.counters?.asyncCompleted ?? 0}`)
  console.log(`ASYNC_FAILED ${m?.counters?.asyncFailed ?? 0}`)
  console.log(`RETRIES_SCHEDULED ${m?.counters?.retriesScheduled ?? 0}`)
  console.log(`ERRORS ${m?.counters?.totalErrors ?? 0}`)
  console.log(`LATENCY_AVG_MS ${m?.latency?.avgMs ?? 0}`)
  console.log(`LATENCY_P95_MS ${m?.latency?.p95Ms ?? 0}`)
  console.log(`QUEUE_SIZE ${m?.queue?.size ?? 0}`)
}

main().catch((error) => {
  console.error(`DOC_READER_METRICS_ERROR ${error.message}`)
  process.exit(1)
})
