import fs from "fs/promises"
import {
  uploadOfficeTextLimit,
  uploadTextLimit,
  uploadZipFileLimit,
  uploadZipTextLimit
} from "./enterpriseAssetsRuntime.js"
import {
  buildFailedExtraction,
  cleanExtractedText,
  decodeTextBuffer,
  finalizeTextExtraction,
  getFileExtension,
  isTextLike
} from "./enterpriseUploadsRuntime.js"
import { decodeXmlEntities } from "./enterpriseTextRuntime.js"

export async function extractTextFromDocx(filePath: string): Promise<any> {
  try {
    const mammothModule: any = await import("mammoth")
    const mammoth = mammothModule.default || mammothModule
    const parsed = await mammoth.extractRawText({ path: filePath })

    return finalizeTextExtraction(parsed?.value || "", {
      kind: "docx",
      method: "mammoth",
      limit: uploadOfficeTextLimit
    })
  } catch (error: any) {
    console.error("❌ Leitura de DOCX falhou:", error?.message)
    return buildFailedExtraction("docx", "mammoth", "falha ao ler o DOCX")
  }
}

export async function extractTextFromPlainFile(filePath: string, fileName = ""): Promise<any> {
  try {
    const raw = await fs.readFile(filePath)
    return finalizeTextExtraction(decodeTextBuffer(raw), {
      kind: "text",
      method: `text:${getFileExtension(fileName) || "plain"}`,
      limit: uploadTextLimit
    })
  } catch {
    return buildFailedExtraction("text", `text:${getFileExtension(fileName) || "plain"}`, "erro ao ler o arquivo")
  }
}

export async function extractTextFromSpreadsheet(filePath: string): Promise<any> {
  try {
    const exceljsModule: any = await import("exceljs")
    const ExcelJS = exceljsModule.default || exceljsModule
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(filePath)
    const sections = workbook.worksheets.slice(0, 4).map((worksheet: any) => {
      const rows: string[] = []
      worksheet.eachRow({ includeEmpty: false }, (row: any, rowNumber: number) => {
        if (rowNumber > 30) return
        const cells = Array.isArray(row.values)
          ? row.values.slice(1).map((cell: any) => {
            if (cell == null) return ""
            if (typeof cell === "object" && cell.text) return String(cell.text).trim()
            if (typeof cell === "object" && cell.result != null) return String(cell.result).trim()
            return String(cell).trim()
          }).filter(Boolean)
          : []
        if (cells.length > 0) {
          rows.push(cells.join(" | "))
        }
      })

      const body = rows.join("\n")

      if (!body) {
        return `Planilha: ${worksheet.name}\n(sem texto tabular util)`
      }

      return `Planilha: ${worksheet.name}\n${body}`
    }).filter(Boolean)

    return finalizeTextExtraction(sections.join("\n\n"), {
      kind: "spreadsheet",
      method: "exceljs",
      limit: uploadOfficeTextLimit
    })
  } catch (error: any) {
    console.error("❌ Leitura de XLSX falhou:", error?.message)
    return buildFailedExtraction("spreadsheet", "exceljs", "falha ao ler a planilha")
  }
}

async function extractSlideTextsFromPptx(filePath: string): Promise<Array<{ fileName: string; xml: string }>> {
  const yauzlModule: any = await import("yauzl")
  const yauzl = yauzlModule.default || yauzlModule

  return await new Promise((resolve, reject) => {
    const slideChunks: Array<{ fileName: string; xml: string }> = []

    yauzl.open(filePath, { lazyEntries: true }, (openError: any, zipfile: any) => {
      if (openError) {
        reject(openError)
        return
      }

      zipfile.readEntry()

      zipfile.on("entry", (entry: any) => {
        if (!/^ppt\/slides\/slide\d+\.xml$/i.test(entry.fileName)) {
          zipfile.readEntry()
          return
        }

        zipfile.openReadStream(entry, (streamError: any, stream: any) => {
          if (streamError) {
            reject(streamError)
            return
          }

          const chunks: Buffer[] = []
          stream.on("data", (chunk: Buffer) => chunks.push(chunk))
          stream.on("end", () => {
            slideChunks.push({
              fileName: entry.fileName,
              xml: Buffer.concat(chunks).toString("utf8")
            })
            zipfile.readEntry()
          })
          stream.on("error", reject)
        })
      })

      zipfile.on("end", () => resolve(slideChunks))
      zipfile.on("error", reject)
    })
  })
}

export async function extractTextFromPptx(filePath: string): Promise<any> {
  try {
    const slides = await extractSlideTextsFromPptx(filePath)
    const sections = slides
      .sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true }))
      .slice(0, 20)
      .map((slide, index) => {
        const text = Array.from(slide.xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g))
          .map((match) => decodeXmlEntities(match[1]))
          .map((value) => value.trim())
          .filter(Boolean)
          .join("\n")

        if (!text) {
          return null
        }

        return `Slide ${index + 1}\n${text}`
      })
      .filter(Boolean)

    return finalizeTextExtraction(sections.join("\n\n"), {
      kind: "presentation",
      method: "pptx-xml",
      limit: uploadOfficeTextLimit
    })
  } catch (error: any) {
    console.error("❌ Leitura de PPTX falhou:", error?.message)
    return buildFailedExtraction("presentation", "pptx-xml", "falha ao ler a apresentacao")
  }
}

export async function extractTextFromZipArchive(filePath: string): Promise<any> {
  try {
    const yauzlModule: any = await import("yauzl")
    const yauzl = yauzlModule.default || yauzlModule

    return await new Promise((resolve, reject) => {
      const textEntries: string[] = []
      const skippedEntries: string[] = []
      let totalChars = 0
      let settled = false

      yauzl.open(filePath, { lazyEntries: true }, (openError: any, zipfile: any) => {
        if (openError) {
          reject(openError)
          return
        }

        const finish = () => {
          if (settled) return
          settled = true
          const textBlock = textEntries.length > 0
            ? textEntries.join("\n\n")
            : "(nenhum arquivo textual util foi extraido do ZIP)"
          const skippedBlock = skippedEntries.length > 0
            ? `\n\nEntradas nao lidas como texto:\n- ${skippedEntries.slice(0, 8).join("\n- ")}`
            : ""
          resolve(finalizeTextExtraction(`ZIP analisado.\n\nConteudo extraido:\n${textBlock}${skippedBlock}`, {
            kind: "zip",
            method: "yauzl",
            limit: uploadZipTextLimit
          }))
        }

        const fail = (error: any) => {
          if (settled) return
          settled = true
          reject(error)
        }

        zipfile.on("entry", (entry: any) => {
          if (entry.fileName.endsWith("/")) {
            zipfile.readEntry()
            return
          }

          if ((textEntries.length + skippedEntries.length) >= uploadZipFileLimit || totalChars >= uploadZipTextLimit) {
            zipfile.close()
            finish()
            return
          }

          if (!isTextLike(entry.fileName, "")) {
            skippedEntries.push(entry.fileName)
            zipfile.readEntry()
            return
          }

          zipfile.openReadStream(entry, (streamError: any, readStream: any) => {
            if (streamError) {
              skippedEntries.push(entry.fileName)
              zipfile.readEntry()
              return
            }

            const chunks: Buffer[] = []
            readStream.on("data", (chunk: Buffer) => {
              if (totalChars >= uploadZipTextLimit) return
              chunks.push(chunk)
            })
            readStream.on("error", () => {
              skippedEntries.push(entry.fileName)
              zipfile.readEntry()
            })
            readStream.on("end", () => {
              const raw = cleanExtractedText(decodeTextBuffer(Buffer.concat(chunks)))
              if (raw) {
                const remaining = Math.max(0, uploadZipTextLimit - totalChars)
                const clipped = raw.slice(0, Math.min(remaining, 3000))
                totalChars += clipped.length
                textEntries.push(`Arquivo: ${entry.fileName}\n${clipped}${raw.length > clipped.length ? "\n... (truncado)" : ""}`)
              } else {
                skippedEntries.push(entry.fileName)
              }
              zipfile.readEntry()
            })
          })
        })

        zipfile.on("end", finish)
        zipfile.on("close", finish)
        zipfile.on("error", fail)
        zipfile.readEntry()
      })
    })
  } catch (error: any) {
    console.error("❌ Leitura de ZIP falhou:", error?.message)
    return buildFailedExtraction("zip", "yauzl", "falha ao ler o ZIP")
  }
}
