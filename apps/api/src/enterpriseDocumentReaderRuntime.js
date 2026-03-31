import fs from "fs/promises"
import path from "path"
import {
  uploadExternalReaderApiKey,
  uploadExternalReaderEnabled,
  uploadExternalReaderTimeoutMs,
  uploadExternalReaderUrl,
  uploadPdfTextLimit,
  uploadOcrTextLimit
} from "./enterpriseAssetsRuntime.js"
import { finalizeTextExtraction } from "./enterpriseUploadsRuntime.js"

export async function extractTextWithExternalReader(filePath, options = {}) {
  if (!uploadExternalReaderEnabled) {
    return null
  }

  const kind = String(options.kind || "auto").trim().toLowerCase() || "auto"
  const limit = Number(options.limit || (kind === "pdf" ? uploadPdfTextLimit : uploadOcrTextLimit))
  const fileName = String(options.fileName || path.basename(filePath || "upload.bin"))

  try {
    const buffer = await fs.readFile(filePath)
    const form = new FormData()
    form.append("kind", kind)
    form.append("limit", String(limit))
    form.append("file", new Blob([buffer]), fileName)

    const headers = {}
    if (uploadExternalReaderApiKey) {
      headers.Authorization = `Bearer ${uploadExternalReaderApiKey}`
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), uploadExternalReaderTimeoutMs)

    let response
    try {
      response = await fetch(`${uploadExternalReaderUrl.replace(/\/$/, "")}/v1/extract`, {
        method: "POST",
        body: form,
        headers,
        signal: controller.signal
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      return null
    }

    const payload = await response.json().catch(() => null)
    const extractedText = String(payload?.text || "")
    if (!extractedText.trim()) {
      return null
    }

    return finalizeTextExtraction(extractedText, {
      kind: payload?.kind || kind,
      method: `external-reader:${String(payload?.method || "unknown")}`,
      pages: Number(payload?.pages || 0) || null,
      limit,
      warnings: Array.isArray(payload?.warnings)
        ? payload.warnings.slice(0, 4)
        : []
    })
  } catch {
    return null
  }
}
