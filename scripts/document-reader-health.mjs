#!/usr/bin/env node

const baseUrl = String(process.env.UPLOAD_EXTERNAL_READER_URL || "http://127.0.0.1:8090").replace(/\/$/, "")
const apiKey = String(process.env.UPLOAD_EXTERNAL_READER_API_KEY || "").trim()

async function main() {
  const headers = {}
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  const response = await fetch(`${baseUrl}/health`, { headers })
  if (!response.ok) {
    throw new Error(`health endpoint failed: HTTP ${response.status}`)
  }

  const payload = await response.json()
  console.log("DOC_READER_HEALTH_OK")
  console.log(`SERVICE ${payload.service || "unknown"}`)
  console.log(`VERSION ${payload.version || "unknown"}`)
  console.log(`OCR ${payload.ocr || "unknown"}`)
  console.log(`AUTH_REQUIRED ${payload.auth ? 1 : 0}`)
}

main().catch((error) => {
  console.error(`DOC_READER_HEALTH_ERROR ${error.message}`)
  process.exit(1)
})
