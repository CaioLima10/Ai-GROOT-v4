#!/usr/bin/env node

import fs from "fs/promises"
import os from "os"
import path from "path"

const baseUrl = String(process.env.UPLOAD_EXTERNAL_READER_URL || "http://127.0.0.1:8090").replace(/\/$/, "")
const apiKey = String(process.env.UPLOAD_EXTERNAL_READER_API_KEY || "").trim()

function buildHeaders() {
  const headers = {}
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  return headers
}

async function sleep(ms) {
  return await new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "doc-reader-async-smoke-"))
  const samplePath = path.join(tempDir, "sample-async.txt")
  const sampleText = [
    "CAPITULO 1",
    "Teste assíncrono do GIOM Document Reader.",
    "colunaA;colunaB;colunaC"
  ].join("\n")

  await fs.writeFile(samplePath, sampleText, "utf8")
  const buffer = await fs.readFile(samplePath)

  const form = new FormData()
  form.append("kind", "text")
  form.append("limit", "5000")
  form.append("file", new Blob([buffer]), "sample-async.txt")

  try {
    const acceptedRes = await fetch(`${baseUrl}/v1/extract/async`, {
      method: "POST",
      body: form,
      headers: buildHeaders()
    })

    if (!acceptedRes.ok) throw new Error(`async submit failed HTTP ${acceptedRes.status}`)
    const accepted = await acceptedRes.json()
    const jobId = String(accepted?.jobId || "")
    if (!jobId) throw new Error("missing jobId")

    let finalPayload = null
    for (let i = 0; i < 30; i += 1) {
      await sleep(300)
      const statusRes = await fetch(`${baseUrl}/v1/extract/jobs/${jobId}`, {
        headers: buildHeaders()
      })
      if (!statusRes.ok) throw new Error(`status failed HTTP ${statusRes.status}`)
      const status = await statusRes.json()

      if (status?.status === "failed") {
        throw new Error(`job failed: ${status?.error || "unknown"}`)
      }

      if (status?.status === "done") {
        finalPayload = status
        break
      }
    }

    if (!finalPayload?.result?.ok) {
      throw new Error("job did not complete with ok result")
    }

    const text = String(finalPayload.result.text || "")
    const sections = Array.isArray(finalPayload.result.sections) ? finalPayload.result.sections.length : 0
    const tableSignals = Array.isArray(finalPayload.result.tableSignals) ? finalPayload.result.tableSignals.length : 0

    if (!text.includes("GIOM Document Reader")) {
      throw new Error("expected content missing in async extraction")
    }

    console.log("DOC_READER_ASYNC_SMOKE_OK")
    console.log(`JOB ${finalPayload.jobId}`)
    console.log(`METHOD ${finalPayload.result.method || "unknown"}`)
    console.log(`SECTIONS ${sections}`)
    console.log(`TABLE_SIGNALS ${tableSignals}`)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => { })
  }
}

main().catch((error) => {
  console.error(`DOC_READER_ASYNC_SMOKE_ERROR ${error.message}`)
  process.exit(1)
})
