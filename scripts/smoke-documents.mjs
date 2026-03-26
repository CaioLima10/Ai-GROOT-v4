import {
  generateStructuredDocument,
  listDocumentFormats
} from "../packages/ai-core/src/index.js"

const sampleContent = [
  "Resumo executivo",
  "",
  "1. Objetivo: validar geracao nativa de documentos no GIOM.",
  "2. Estado atual: PDF, DOCX, XLSX, PPTX, SVG, HTML, Markdown, TXT e JSON.",
  "3. Limite honesto: isso nao equivale a uma suite Office completa."
].join("\n")

const expectedFormats = ["pdf", "docx", "xlsx", "pptx", "svg", "html", "md", "txt", "json"]
const availableFormats = new Set(listDocumentFormats().map((entry) => entry.format))

for (const format of expectedFormats) {
  if (!availableFormats.has(format)) {
    throw new Error(`Formato ausente na lista de geracao: ${format}`)
  }

  const document = await generateStructuredDocument({
    format,
    title: `Smoke ${format.toUpperCase()}`,
    content: sampleContent
  })

  if (!document?.base64) {
    throw new Error(`Documento ${format} veio sem base64`)
  }

  if (!document?.mimeType) {
    throw new Error(`Documento ${format} veio sem mimeType`)
  }

  if (!document?.fileName?.endsWith(`.${document.extension}`)) {
    throw new Error(`Documento ${format} veio com extensao incorreta`)
  }

  if (!document?.size || document.size < 32) {
    throw new Error(`Documento ${format} veio pequeno demais para ser confiavel`)
  }

  console.log(`ok ${format}: ${document.fileName} (${document.size} bytes)`)
}

console.log("smoke-documents: success")
