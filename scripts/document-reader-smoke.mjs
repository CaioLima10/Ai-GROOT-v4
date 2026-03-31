#!/usr/bin/env node

import fs from "fs/promises"
import os from "os"
import path from "path"

const baseUrl = String(process.env.UPLOAD_EXTERNAL_READER_URL || "http://127.0.0.1:8090").replace(/\/$/, "")
const apiKey = String(process.env.UPLOAD_EXTERNAL_READER_API_KEY || "").trim()

async function main() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "doc-reader-smoke-"))
  const samplePath = path.join(tempDir, "sample.txt")
  const sampleText = [
    "Teste GIOM Document Reader",
    "Linha 1: extração de texto funcionando.",
    "Linha 2: validação smoke test."
  ].join("\n")

  await fs.writeFile(samplePath, sampleText, "utf8")
  const buffer = await fs.readFile(samplePath)

  const form = new FormData()
  form.append("kind", "text")
  form.append("limit", "5000")
  form.append("file", new Blob([buffer]), "sample.txt")

  const headers = {}
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  try {
    const response = await fetch(`${baseUrl}/v1/extract`, {
      method: "POST",
      body: form,
      headers
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const payload = await response.json()
    const extracted = String(payload?.text || "")

    if (!payload?.ok || !extracted.includes("GIOM Document Reader")) {
      throw new Error("extract response does not contain expected content")
    }

    console.log("DOC_READER_SMOKE_OK")
    console.log(`METHOD ${payload?.method || "unknown"}`)
    console.log(`QUALITY ${payload?.quality || "unknown"}`)
    console.log(`LENGTH ${payload?.fullTextLength || 0}`)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => { })
  }
}

main().catch((error) => {
  console.error(`DOC_READER_SMOKE_ERROR ${error.message}`)
  process.exit(1)
})
