import fs from "fs/promises"
import { uploadPdfTextLimit } from "./enterpriseAssetsRuntime.js"
import {
  buildFailedExtraction,
  finalizeTextExtraction
} from "./enterpriseUploadsRuntime.js"
import { shouldApplyPdfOcrFallback } from "./enterpriseOcrRuntime.js"
import { extractTextFromPdfViaOcr } from "./enterprisePdfOcrRuntime.js"
import { extractTextWithExternalReader } from "./enterpriseDocumentReaderRuntime.js"

export async function extractTextFromPdf(filePath) {
  const externalExtraction = await extractTextWithExternalReader(filePath, {
    kind: "pdf",
    limit: uploadPdfTextLimit
  })

  if (externalExtraction?.quality && externalExtraction.quality !== "none") {
    return {
      ...externalExtraction,
      warnings: Array.from(new Set([
        ...(Array.isArray(externalExtraction.warnings) ? externalExtraction.warnings : []),
        "extracao via servico externo de leitura"
      ])).slice(0, 4)
    }
  }

  let buffer = null
  let directExtraction = null
  let pageCount = null

  try {
    let pdfParse = null
    try {
      const pdfParseModule = await import("pdf-parse")
      pdfParse = pdfParseModule.default || pdfParseModule
    } catch {
      const pdfParseModule = await import("pdf-parse/lib/pdf-parse.js")
      pdfParse = pdfParseModule.default || pdfParseModule
    }
    buffer = await fs.readFile(filePath)
    const parsed = await pdfParse(buffer)
    pageCount = Number(parsed?.numpages || 0) || null

    directExtraction = finalizeTextExtraction(parsed?.text || "", {
      kind: "pdf",
      method: "pdf-parse",
      pages: pageCount,
      limit: uploadPdfTextLimit
    })
  } catch (error) {
    console.error("❌ Leitura de PDF falhou:", error.message)
    directExtraction = buildFailedExtraction("pdf", "pdf-parse", "falha ao ler o PDF")
  }

  if (!shouldApplyPdfOcrFallback(directExtraction)) {
    return directExtraction
  }

  const ocrExtraction = await extractTextFromPdfViaOcr(filePath, {
    buffer,
    pageCount
  })

  if (ocrExtraction?.quality && ocrExtraction.quality !== "none") {
    return {
      ...ocrExtraction,
      warnings: Array.from(new Set([
        ...(Array.isArray(directExtraction?.warnings) ? directExtraction.warnings : []),
        ...(Array.isArray(ocrExtraction.warnings) ? ocrExtraction.warnings : []),
        "fallback OCR aplicado ao PDF"
      ])).slice(0, 4)
    }
  }

  if (directExtraction?.quality && directExtraction.quality !== "none") {
    return {
      ...directExtraction,
      warnings: Array.from(new Set([
        ...(Array.isArray(directExtraction.warnings) ? directExtraction.warnings : []),
        "fallback OCR do PDF nao encontrou texto adicional util"
      ])).slice(0, 4)
    }
  }

  return ocrExtraction || directExtraction
}
