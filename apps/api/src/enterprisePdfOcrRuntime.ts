import fs from "fs/promises"
import path from "path"
import crypto from "crypto"
import {
  uploadOcrEnabled,
  uploadOcrLang,
  uploadPdfOcrEnabled,
  uploadPdfOcrPageLimit,
  uploadPdfOcrScale,
  uploadPdfOcrTempDir,
  uploadPdfTextLimit
} from "./enterpriseAssetsRuntime.js"
import {
  buildFailedExtraction,
  cleanExtractedText,
  finalizeTextExtraction
} from "./enterpriseUploadsRuntime.js"
import { createUploadOcrWorker } from "./enterpriseOcrRuntime.js"

type PdfOcrOptions = {
  buffer?: Buffer
  pageCount?: number | null
}

export async function extractTextFromPdfViaOcr(filePath: string, options: PdfOcrOptions = {}): Promise<any> {
  if (!uploadOcrEnabled) {
    return buildFailedExtraction("pdf", "pdf-ocr-disabled", "ocr de PDF desativado nesta runtime")
  }

  if (!uploadPdfOcrEnabled) {
    return buildFailedExtraction("pdf", "pdf-ocr-disabled", "fallback OCR de PDF desativado nesta runtime")
  }

  const buffer = options.buffer || await fs.readFile(filePath)
  const pageCountHint = Math.max(1, Number(options.pageCount || 0) || 1)
  let worker: any = null
  let loadingTask: any = null

  try {
    const pdfjsModule: any = await import("pdfjs-dist/legacy/build/pdf.mjs")
    const canvasModule: any = await import("@napi-rs/canvas")
    const pdfjs = pdfjsModule.default || pdfjsModule
    const { createCanvas, DOMMatrix, ImageData, Path2D } = canvasModule

    if (DOMMatrix && !(globalThis as any).DOMMatrix) {
      ; (globalThis as any).DOMMatrix = DOMMatrix
    }
    if (ImageData && !(globalThis as any).ImageData) {
      ; (globalThis as any).ImageData = ImageData
    }
    if (Path2D && !(globalThis as any).Path2D) {
      ; (globalThis as any).Path2D = Path2D
    }

    const canvasFactory = {
      create(width: number, height: number) {
        const safeWidth = Math.max(1, Math.ceil(Number(width) || 0))
        const safeHeight = Math.max(1, Math.ceil(Number(height) || 0))
        const canvas = createCanvas(safeWidth, safeHeight)
        const context = canvas.getContext("2d")
        return { canvas, context }
      },
      reset(canvasAndContext: any, width: number, height: number) {
        canvasAndContext.canvas.width = Math.max(1, Math.ceil(Number(width) || 0))
        canvasAndContext.canvas.height = Math.max(1, Math.ceil(Number(height) || 0))
      },
      destroy(canvasAndContext: any) {
        if (canvasAndContext?.canvas) {
          canvasAndContext.canvas.width = 0
          canvasAndContext.canvas.height = 0
        }
      }
    }

    loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      disableWorker: true,
      useWorkerFetch: false,
      isEvalSupported: false,
      stopAtErrors: false,
      verbosity: 0
    })

    const pdfDocument = await loadingTask.promise
    const totalPages = Math.max(1, Number(pdfDocument.numPages || pageCountHint) || pageCountHint)
    const pageLimit = Math.min(totalPages, uploadPdfOcrPageLimit)
    const ocrSections: string[] = []
    const warnings: string[] = []

    if (pageLimit < totalPages) {
      warnings.push(`OCR aplicado apenas nas primeiras ${pageLimit} paginas do PDF`)
    }

    worker = await createUploadOcrWorker()
    await fs.mkdir(uploadPdfOcrTempDir, { recursive: true }).catch(() => { })

    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber)
      const viewport = page.getViewport({ scale: uploadPdfOcrScale })
      const canvasAndContext = canvasFactory.create(viewport.width, viewport.height)
      const tempImagePath = path.join(uploadPdfOcrTempDir, `pdf-ocr-${crypto.randomUUID()}-${pageNumber}.png`)

      try {
        await page.render({
          canvasContext: canvasAndContext.context,
          viewport,
          canvasFactory
        }).promise

        const pngBuffer = canvasAndContext.canvas.toBuffer("image/png")
        await fs.writeFile(tempImagePath, pngBuffer)

        const { data } = await worker.recognize(tempImagePath)
        const pageText = cleanExtractedText(data?.text || "")
        if (pageText) {
          ocrSections.push(`Pagina ${pageNumber}\n${pageText}`)
        }
      } finally {
        page.cleanup()
        canvasFactory.destroy(canvasAndContext)
        await fs.rm(tempImagePath, { force: true }).catch(() => { })
      }
    }

    await worker.terminate().catch(() => { })
    worker = null
    await loadingTask.destroy().catch(() => { })
    loadingTask = null

    return finalizeTextExtraction(ocrSections.join("\n\n"), {
      kind: "pdf",
      method: `pdf-ocr:tesseract:${uploadOcrLang}`,
      pages: totalPages,
      limit: uploadPdfTextLimit,
      warnings
    })
  } catch (error: any) {
    console.error("❌ OCR de PDF falhou:", error?.message)
    return buildFailedExtraction("pdf", `pdf-ocr:tesseract:${uploadOcrLang}`, "ocr do PDF indisponivel nesta execucao")
  } finally {
    if (worker) {
      await worker.terminate().catch(() => { })
    }
    if (loadingTask) {
      await loadingTask.destroy().catch(() => { })
    }
  }
}
