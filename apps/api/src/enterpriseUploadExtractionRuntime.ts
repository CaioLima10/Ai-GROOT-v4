import {
  buildFailedExtraction,
  isDocxLike,
  isImageLike,
  isPdfLike,
  isPresentationLike,
  isSpreadsheetLike,
  isTextLike,
  isZipLike
} from "./enterpriseUploadsRuntime.js"
import { extractTextFromImage } from "./enterpriseImageOcrRuntime.js"
import {
  extractTextFromDocx,
  extractTextFromPlainFile,
  extractTextFromPptx,
  extractTextFromSpreadsheet,
  extractTextFromZipArchive
} from "./enterpriseOfficeRuntime.js"
import { extractTextFromPdf } from "./enterprisePdfRuntime.js"

type UploadEntryLike = {
  extraction?: any
  extractedAt?: string
  name?: string
  path?: string
  type?: string
}

export async function resolveUploadExtraction(uploadEntry: UploadEntryLike | null | undefined): Promise<any> {
  if (!uploadEntry) return null
  if (uploadEntry.extraction) {
    return uploadEntry.extraction
  }

  let extraction: any = null

  if (isTextLike(uploadEntry.name, uploadEntry.type)) {
    extraction = await extractTextFromPlainFile(String(uploadEntry.path || ""), String(uploadEntry.name || ""))
  } else if (isPdfLike(uploadEntry.name, uploadEntry.type)) {
    extraction = await extractTextFromPdf(String(uploadEntry.path || ""))
  } else if (isDocxLike(uploadEntry.name, uploadEntry.type)) {
    extraction = await extractTextFromDocx(String(uploadEntry.path || ""))
  } else if (isSpreadsheetLike(uploadEntry.name, uploadEntry.type)) {
    extraction = await extractTextFromSpreadsheet(String(uploadEntry.path || ""))
  } else if (isPresentationLike(uploadEntry.name, uploadEntry.type)) {
    extraction = await extractTextFromPptx(String(uploadEntry.path || ""))
  } else if (isZipLike(uploadEntry.name, uploadEntry.type)) {
    extraction = await extractTextFromZipArchive(String(uploadEntry.path || ""))
  } else if (isImageLike(uploadEntry.name, uploadEntry.type)) {
    extraction = await extractTextFromImage(String(uploadEntry.path || ""))
  } else {
    extraction = buildFailedExtraction("binary", "unsupported", "leitura binaria generica ainda nao habilitada")
  }

  uploadEntry.extraction = extraction
  uploadEntry.extractedAt = new Date().toISOString()
  return extraction
}
