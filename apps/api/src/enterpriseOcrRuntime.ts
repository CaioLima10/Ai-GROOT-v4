import fs from "fs/promises"
import {
  uploadOcrCachePath,
  uploadOcrEnabled,
  uploadOcrLang,
  uploadOcrLangPath,
  uploadPdfOcrEnabled
} from "./enterpriseAssetsRuntime.js"

type UploadExtractionLike = {
  quality?: string
  fullTextLength?: number
}

export async function createUploadOcrWorker(): Promise<any> {
  const { createWorker } = await import("tesseract.js")
  await fs.mkdir(uploadOcrCachePath, { recursive: true }).catch(() => { })
  let resolvedLangPath = uploadOcrLangPath
  if (resolvedLangPath) {
    try {
      await fs.access(resolvedLangPath)
    } catch {
      resolvedLangPath = ""
    }
  }

  const options: Record<string, unknown> = {
    logger: () => { },
    cachePath: uploadOcrCachePath
  }

  if (resolvedLangPath) {
    options.langPath = resolvedLangPath
  }

  return await createWorker(uploadOcrLang, 1, options)
}

export function shouldApplyPdfOcrFallback(extraction?: UploadExtractionLike | null): boolean {
  if (!uploadOcrEnabled || !uploadPdfOcrEnabled) {
    return false
  }

  if (!extraction) {
    return true
  }

  if (extraction.quality === "none") {
    return true
  }

  return extraction.quality === "low" && Number(extraction.fullTextLength || 0) < 600
}