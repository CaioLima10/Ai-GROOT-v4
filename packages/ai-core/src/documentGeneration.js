import { Buffer } from "buffer"
import PDFDocument from "pdfkit"
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx"
import ExcelJS from "exceljs"
import PptxGenJS from "pptxgenjs"

const DOCUMENT_FORMATS = {
  txt: {
    format: "txt",
    label: "Plain text",
    extension: "txt",
    mimeType: "text/plain"
  },
  md: {
    format: "md",
    label: "Markdown",
    extension: "md",
    mimeType: "text/markdown"
  },
  html: {
    format: "html",
    label: "HTML",
    extension: "html",
    mimeType: "text/html"
  },
  json: {
    format: "json",
    label: "JSON",
    extension: "json",
    mimeType: "application/json"
  },
  svg: {
    format: "svg",
    label: "SVG",
    extension: "svg",
    mimeType: "image/svg+xml"
  },
  pdf: {
    format: "pdf",
    label: "PDF",
    extension: "pdf",
    mimeType: "application/pdf"
  },
  docx: {
    format: "docx",
    label: "DOCX",
    extension: "docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  },
  xlsx: {
    format: "xlsx",
    label: "XLSX",
    extension: "xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  },
  pptx: {
    format: "pptx",
    label: "PPTX",
    extension: "pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  }
}

function sanitizeFilenameSegment(value = "", fallback = "giom-document") {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()

  return normalized || fallback
}

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function escapeXml(value = "") {
  return escapeHtml(value)
}

function normalizeDocumentText(content = "") {
  return String(content || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function removeCodeFences(content = "") {
  const text = String(content || "").trim()
  const fencedMatch = text.match(/^```(?:[a-z0-9_-]+)?\n([\s\S]*?)```$/i)
  return fencedMatch?.[1] ? fencedMatch[1].trim() : text
}

function normalizeJsonDocument(title = "", content = "") {
  const raw = removeCodeFences(content)
  if (!raw) {
    return JSON.stringify({
      title,
      sections: []
    }, null, 2)
  }

  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return JSON.stringify({
      title,
      content: raw
    }, null, 2)
  }
}

function splitParagraphs(content = "") {
  return normalizeDocumentText(content)
    .split(/\n{2,}/g)
    .map((part) => part.trim())
    .filter(Boolean)
}

function splitLines(content = "") {
  return normalizeDocumentText(content)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function wrapPlainText(input = "", lineLength = 84) {
  const words = String(input || "").trim().split(/\s+/g).filter(Boolean)
  if (words.length === 0) return ""

  const lines = []
  let currentLine = ""

  words.forEach((word) => {
    if (!currentLine) {
      currentLine = word
      return
    }

    if (`${currentLine} ${word}`.length > lineLength) {
      lines.push(currentLine)
      currentLine = word
      return
    }

    currentLine = `${currentLine} ${word}`
  })

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines.join("\n")
}

function extractStructuredRows(content = "") {
  const lines = splitLines(content)

  const markdownRows = lines
    .filter((line) => line.includes("|"))
    .map((line) => line.split("|").map((cell) => cell.trim()).filter(Boolean))
    .filter((row) => row.length > 1)

  if (markdownRows.length >= 2) {
    return markdownRows.filter((row) => !row.every((cell) => /^:?-{3,}:?$/.test(cell)))
  }

  const csvRows = lines
    .filter((line) => line.includes(","))
    .map((line) => line.split(",").map((cell) => cell.trim()))
    .filter((row) => row.length > 1)

  if (csvRows.length >= 2) {
    return csvRows
  }

  const bulletRows = lines
    .filter((line) => /^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line))
    .map((line) => [line.replace(/^[-*]\s+/, "").replace(/^\d+[.)]\s+/, "").trim()])

  if (bulletRows.length > 0) {
    return [["Item"], ...bulletRows]
  }

  return [["Conteudo"], ...lines.map((line) => [line])]
}

function buildSlideChunks(title = "", content = "") {
  const paragraphs = splitParagraphs(content)
  if (paragraphs.length === 0) {
    return [{
      title: title || "Documento GIOM",
      bullets: ["Sem conteudo adicional."]
    }]
  }

  return paragraphs.slice(0, 6).map((paragraph, index) => {
    const lines = paragraph
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)

    const firstLine = lines[0] || `Slide ${index + 1}`
    const bullets = lines.slice(1)
      .flatMap((line) => line.split(/(?<=[.;:])\s+/g))
      .map((line) => line.replace(/^[-*]\s+/, "").trim())
      .filter(Boolean)

    return {
      title: firstLine.length > 70 ? `Slide ${index + 1}` : firstLine,
      bullets: bullets.length > 0
        ? bullets.slice(0, 6)
        : wrapPlainText(paragraph, 80).split("\n").slice(0, 6)
    }
  })
}

async function generatePdfBuffer(title = "", content = "", metadata = {}) {
  return new Promise((resolve, reject) => {
    const chunks = []
    const doc = new PDFDocument({
      size: "A4",
      margin: 54,
      compress: false,
      pdfVersion: "1.4",
      info: {
        Title: title,
        Author: "GIOM",
        Subject: metadata.subject || "GIOM generated document"
      }
    })

    doc.on("data", (chunk) => chunks.push(chunk))
    doc.on("error", reject)
    doc.on("end", () => resolve(Buffer.concat(chunks)))

    doc.font("Helvetica-Bold").fontSize(20).text(title || "Documento GIOM")
    doc.moveDown(0.6)
    doc.font("Helvetica").fontSize(10).fillColor("#666666")
    doc.text(`Gerado por GIOM em ${new Date().toISOString()}`)
    doc.moveDown(1)
    doc.fillColor("#111111").fontSize(11)

    splitParagraphs(content).forEach((paragraph) => {
      doc.text(paragraph, {
        align: "left",
        lineGap: 3
      })
      doc.moveDown(0.9)
    })

    doc.end()
  })
}

async function generateDocxBuffer(title = "", content = "") {
  const paragraphs = splitParagraphs(content)
  const document = new Document({
    sections: [{
      children: [
        new Paragraph({
          text: title || "Documento GIOM",
          heading: HeadingLevel.TITLE
        }),
        ...paragraphs.flatMap((paragraph) => [
          new Paragraph({
            children: paragraph
              .split("\n")
              .filter(Boolean)
              .map((line, index) => new TextRun({
                text: line,
                break: index > 0 ? 1 : 0
              }))
          })
        ])
      ]
    }]
  })

  return Packer.toBuffer(document)
}

async function generateXlsxBuffer(title = "", content = "") {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "GIOM"
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet(sanitizeFilenameSegment(title, "document").slice(0, 28) || "Document")
  const rows = extractStructuredRows(content)

  rows.forEach((row, index) => {
    const addedRow = worksheet.addRow(row)
    if (index === 0) {
      addedRow.font = { bold: true }
      addedRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE8EEF8" }
      }
    }
  })

  worksheet.columns.forEach((column) => {
    let maxLength = 12
    column.eachCell({ includeEmpty: true }, (cell) => {
      const value = String(cell.value || "")
      maxLength = Math.max(maxLength, Math.min(value.length + 2, 42))
    })
    column.width = maxLength
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

async function generatePptxBuffer(title = "", content = "") {
  const pptx = new PptxGenJS()
  pptx.layout = "LAYOUT_WIDE"
  pptx.author = "GIOM"
  pptx.company = "GIOM Studio"
  pptx.subject = "GIOM generated presentation"
  pptx.title = title || "Apresentacao GIOM"

  const slides = buildSlideChunks(title, content)
  slides.forEach((chunk, index) => {
    const slide = pptx.addSlide()
    slide.background = { color: "0F172A" }
    slide.addText(index === 0 ? (title || chunk.title) : chunk.title, {
      x: 0.5,
      y: 0.4,
      w: 12.2,
      h: 0.6,
      fontFace: "Arial",
      fontSize: 24,
      bold: true,
      color: "F8FAFC"
    })

    slide.addText(chunk.bullets.map((bullet) => ({ text: bullet, options: { bullet: { indent: 18 } } })), {
      x: 0.8,
      y: 1.3,
      w: 11.4,
      h: 4.8,
      fontFace: "Arial",
      fontSize: 16,
      color: "E2E8F0",
      breakLine: true,
      valign: "top"
    })

    slide.addText("Gerado por GIOM", {
      x: 0.8,
      y: 6.6,
      w: 3,
      h: 0.3,
      fontFace: "Arial",
      fontSize: 10,
      color: "93C5FD"
    })
  })

  const buffer = await pptx.write({ outputType: "nodebuffer" })
  return Buffer.from(buffer)
}

function generateSvgBuffer(title = "", content = "") {
  const header = escapeXml(title || "Documento GIOM")
  const bodyLines = splitParagraphs(content)
    .flatMap((paragraph) => wrapPlainText(paragraph, 60).split("\n"))
    .slice(0, 14)

  const lineMarkup = bodyLines.map((line, index) => {
    const y = 150 + (index * 34)
    return `<text x="72" y="${y}" font-size="22" fill="#d8dee9" font-family="IBM Plex Sans, Arial, sans-serif">${escapeXml(line)}</text>`
  }).join("")

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900" role="img" aria-labelledby="title desc">
  <title id="title">${header}</title>
  <desc id="desc">Documento gerado pelo GIOM</desc>
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#111827" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
  </defs>
  <rect width="1400" height="900" rx="42" fill="url(#bg)" />
  <rect x="42" y="42" width="1316" height="816" rx="30" fill="rgba(15,23,42,0.52)" stroke="#334155" />
  <text x="72" y="102" font-size="44" font-weight="700" fill="#f8fafc" font-family="Space Grotesk, Arial, sans-serif">${header}</text>
  ${lineMarkup}
  <text x="72" y="846" font-size="18" fill="#93c5fd" font-family="IBM Plex Sans, Arial, sans-serif">Gerado por GIOM</text>
</svg>`

  return Buffer.from(svg, "utf8")
}

function generateHtmlBuffer(title = "", content = "") {
  const paragraphs = splitParagraphs(content)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("\n")

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title || "Documento GIOM")}</title>
  <style>
    body { font-family: "IBM Plex Sans", Arial, sans-serif; margin: 48px; color: #111827; background: #f8fafc; }
    main { max-width: 860px; margin: 0 auto; background: white; padding: 48px; border-radius: 24px; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12); }
    h1 { font-family: "Space Grotesk", Arial, sans-serif; margin-top: 0; }
    p { line-height: 1.7; margin: 0 0 16px; }
    .meta { color: #475569; font-size: 14px; margin-bottom: 24px; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title || "Documento GIOM")}</h1>
    <div class="meta">Gerado por GIOM em ${new Date().toISOString()}</div>
    ${paragraphs}
  </main>
</body>
</html>`

  return Buffer.from(html, "utf8")
}

function buildPreview(text = "", limit = 600) {
  const normalized = normalizeDocumentText(removeCodeFences(text))
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, limit)}\n... (truncado)`
}

export function listDocumentFormats() {
  return Object.values(DOCUMENT_FORMATS).map((entry) => ({ ...entry }))
}

export function normalizeDocumentFormat(input = "") {
  const normalized = String(input || "").trim().toLowerCase().replace(/^\./, "")
  return DOCUMENT_FORMATS[normalized] ? normalized : null
}

export async function generateStructuredDocument({
  format,
  title = "Documento GIOM",
  content = "",
  fileNameBase = "",
  metadata = {}
}) {
  const normalizedFormat = normalizeDocumentFormat(format)
  if (!normalizedFormat) {
    throw new Error(`Formato de documento não suportado: ${format}`)
  }

  const formatConfig = DOCUMENT_FORMATS[normalizedFormat]
  const normalizedTitle = String(title || "Documento GIOM").trim()
  const textContent = normalizeDocumentText(removeCodeFences(content))
  const previewText = buildPreview(
    normalizedFormat === "json" ? normalizeJsonDocument(normalizedTitle, textContent) : textContent
  )
  const fileName = `${sanitizeFilenameSegment(fileNameBase || normalizedTitle)}.${formatConfig.extension}`

  let buffer
  switch (normalizedFormat) {
    case "txt":
    case "md":
      buffer = Buffer.from(textContent || normalizedTitle, "utf8")
      break
    case "html":
      buffer = generateHtmlBuffer(normalizedTitle, textContent || normalizedTitle)
      break
    case "json":
      buffer = Buffer.from(normalizeJsonDocument(normalizedTitle, textContent), "utf8")
      break
    case "svg":
      buffer = generateSvgBuffer(normalizedTitle, textContent || normalizedTitle)
      break
    case "pdf":
      buffer = await generatePdfBuffer(normalizedTitle, textContent || normalizedTitle, metadata)
      break
    case "docx":
      buffer = await generateDocxBuffer(normalizedTitle, textContent || normalizedTitle)
      break
    case "xlsx":
      buffer = await generateXlsxBuffer(normalizedTitle, textContent || normalizedTitle)
      break
    case "pptx":
      buffer = await generatePptxBuffer(normalizedTitle, textContent || normalizedTitle)
      break
    default:
      throw new Error(`Formato de documento não implementado: ${normalizedFormat}`)
  }

  return {
    ...formatConfig,
    fileName,
    size: buffer.length,
    base64: buffer.toString("base64"),
    previewText
  }
}
