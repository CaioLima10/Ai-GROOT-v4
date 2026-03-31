import fs from "fs"
import pdfParse from "pdf-parse/lib/pdf-parse.js"

const inputPath = process.argv[2]
const outputLength = Number(process.argv[3] || 5000)

if (!inputPath) {
  console.error("Uso: node scripts/inspect-bible-pdf-sample.mjs <pdfPath> [chars]")
  process.exit(1)
}

const buffer = fs.readFileSync(inputPath)
const parsed = await pdfParse(buffer)
const text = String(parsed?.text || "")
  .replace(/\u0000/g, " ")
  .replace(/[ \t]+\n/g, "\n")
  .replace(/\n{3,}/g, "\n\n")
  .replace(/[ \t]{2,}/g, " ")

console.log(text.slice(0, outputLength))
