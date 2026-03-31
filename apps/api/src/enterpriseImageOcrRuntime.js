import {
  uploadOcrEnabled,
  uploadOcrLang,
  uploadOcrLangPath,
  uploadOcrTextLimit
} from "./enterpriseAssetsRuntime.js"
import {
  buildFailedExtraction,
  finalizeTextExtraction
} from "./enterpriseUploadsRuntime.js"
import { createUploadOcrWorker } from "./enterpriseOcrRuntime.js"
import { extractTextWithExternalReader } from "./enterpriseDocumentReaderRuntime.js"

export async function extractTextFromImage(filePath) {
  const externalExtraction = await extractTextWithExternalReader(filePath, {
    kind: "image",
    limit: uploadOcrTextLimit
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

  if (!uploadOcrEnabled) {
    return buildFailedExtraction("image", "ocr-disabled", "ocr de imagem desativado nesta runtime")
  }

  let worker = null
  try {
    worker = await createUploadOcrWorker()
    const { data } = await worker.recognize(filePath)
    await worker.terminate().catch(() => { })
    worker = null

    return finalizeTextExtraction(data?.text || "", {
      kind: "image",
      method: uploadOcrLangPath ? `tesseract:${uploadOcrLang}:local` : `tesseract:${uploadOcrLang}`,
      limit: uploadOcrTextLimit
    })
  } catch (error) {
    console.error("❌ OCR falhou:", error.message)
    return buildFailedExtraction("image", `tesseract:${uploadOcrLang}`, "ocr indisponivel nesta execucao")
  } finally {
    if (worker) {
      await worker.terminate().catch(() => { })
    }
  }
}
