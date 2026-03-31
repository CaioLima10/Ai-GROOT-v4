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

export async function resolveUploadExtraction(uploadEntry) {
  if (!uploadEntry) return null
  if (uploadEntry.extraction) {
    return uploadEntry.extraction
  }

  let extraction = null

  if (isTextLike(uploadEntry.name, uploadEntry.type)) {
    extraction = await extractTextFromPlainFile(uploadEntry.path, uploadEntry.name)
  } else if (isPdfLike(uploadEntry.name, uploadEntry.type)) {
    extraction = await extractTextFromPdf(uploadEntry.path)
  } else if (isDocxLike(uploadEntry.name, uploadEntry.type)) {
    extraction = await extractTextFromDocx(uploadEntry.path)
  } else if (isSpreadsheetLike(uploadEntry.name, uploadEntry.type)) {
    extraction = await extractTextFromSpreadsheet(uploadEntry.path)
  } else if (isPresentationLike(uploadEntry.name, uploadEntry.type)) {
    extraction = await extractTextFromPptx(uploadEntry.path)
  } else if (isZipLike(uploadEntry.name, uploadEntry.type)) {
    extraction = await extractTextFromZipArchive(uploadEntry.path)
  } else if (isImageLike(uploadEntry.name, uploadEntry.type)) {
    extraction = await extractTextFromImage(uploadEntry.path)
  } else {
    extraction = buildFailedExtraction("binary", "unsupported", "leitura binaria generica ainda nao habilitada")
  }

  uploadEntry.extraction = extraction
  uploadEntry.extractedAt = new Date().toISOString()
  return extraction
}
