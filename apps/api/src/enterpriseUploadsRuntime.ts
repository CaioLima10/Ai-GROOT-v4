import fs from "fs/promises"
import {
  SUPPORTED_UPLOAD_ACCEPT,
  UPLOAD_DIR,
  uploads,
  uploadTextLimit,
  uploadTtlMinutes
} from "./enterpriseAssetsRuntime.js"

type UploadRecord = {
  path: string
  timeout?: ReturnType<typeof setTimeout>
}

type ExtractionQuality = "none" | "low" | "medium" | "high"

type ExtractionStats = {
  charCount: number
  wordCount: number
  replacementCount: number
  lineCount: number
  alphaRatio: number
}

type ExtractionResult = {
  text: string
  fullTextLength: number
  kind: string
  method: string
  pages: number | null
  truncated: boolean
  quality: ExtractionQuality
  warnings: string[]
  stats: ExtractionStats
}

type AnalysisResult = {
  quality: ExtractionQuality
  warnings: string[]
  stats: ExtractionStats
}

type TextPreview = {
  text: string
  truncated: boolean
}

type FinalizeExtractionOptions = {
  kind?: string
  method?: string
  pages?: number | null
  limit?: number
  warnings?: string[]
}

type UploadEntryLike = {
  name?: string
  type?: string
}

type UploadExtractionLike = {
  text?: string
  kind?: string
  method?: string
  quality?: string
  pages?: number | null
  truncated?: boolean
  warnings?: string[]
}

export async function ensureUploadDir(): Promise<void> {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("❌ Falha ao criar pasta de uploads:", message)
  }
}

export function scheduleUploadCleanup(id: string): void {
  const entry = uploads.get(id) as UploadRecord | undefined
  if (!entry) return
  const ttlMs = uploadTtlMinutes * 60 * 1000
  entry.timeout = setTimeout(async () => {
    try {
      await fs.unlink(entry.path)
    } catch {
      // ignore
    }
    uploads.delete(id)
  }, ttlMs)
}

export function safeFilename(name: unknown): string {
  return String(name || "upload")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120)
}

export function getFileExtension(name = ""): string {
  const normalized = String(name || "").toLowerCase()
  const parts = normalized.split(".")
  return parts.length > 1 ? `.${parts.pop()}` : ""
}

export function parseBase64Payload(input = ""): Buffer | null {
  const value = String(input || "").trim()
  const stripped = value.startsWith("data:")
    ? (value.split(",")[1] || "")
    : value

  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(stripped)) {
    return null
  }

  try {
    const buffer = Buffer.from(stripped, "base64")
    return buffer.length ? buffer : null
  } catch {
    return null
  }
}

export function detectMimeFromMagic(buffer: Buffer, fileName = ""): string | null {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null

  const signature = buffer.subarray(0, 16)
  const startsWith = (...bytes: number[]) => bytes.every((byte, index) => signature[index] === byte)

  if (startsWith(0x25, 0x50, 0x44, 0x46)) return "application/pdf"
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png"
  if (startsWith(0xff, 0xd8, 0xff)) return "image/jpeg"
  if (startsWith(0x47, 0x49, 0x46, 0x38)) return "image/gif"
  if (startsWith(0x52, 0x49, 0x46, 0x46) && signature[8] === 0x57 && signature[9] === 0x45 && signature[10] === 0x42 && signature[11] === 0x50) {
    return "image/webp"
  }
  if (startsWith(0x50, 0x4b, 0x03, 0x04)) {
    const ext = getFileExtension(fileName)
    if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    if (ext === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    if (ext === ".pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    return "application/zip"
  }

  return null
}

export function normalizeUploadMime(fileName = "", declaredType = "", detectedType = ""): string {
  const ext = getFileExtension(fileName)
  const declared = String(declaredType || "").trim().toLowerCase()
  const detected = String(detectedType || "").trim().toLowerCase()

  if (detected) {
    return detected
  }

  if (declared) {
    return declared
  }

  const extensionMimeMap: Record<string, string> = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".zip": "application/zip",
    ".svg": "image/svg+xml",
    ".json": "application/json",
    ".jsonl": "application/x-ndjson",
    ".csv": "text/csv",
    ".tsv": "text/tab-separated-values",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".xml": "application/xml",
    ".yml": "text/yaml",
    ".yaml": "text/yaml",
    ".sql": "text/plain"
  }

  return extensionMimeMap[ext] || "application/octet-stream"
}

export function isAllowedUploadByAccept(fileName = "", mimeType = ""): boolean {
  const ext = getFileExtension(fileName)
  const normalizedMime = String(mimeType || "").toLowerCase()
  return SUPPORTED_UPLOAD_ACCEPT.some((rule) => {
    const normalizedRule = String(rule || "").toLowerCase().trim()
    if (!normalizedRule) return false
    if (normalizedRule.endsWith("/*")) {
      return normalizedMime.startsWith(normalizedRule.slice(0, -1))
    }
    if (normalizedRule.startsWith(".")) {
      return ext === normalizedRule
    }
    return normalizedMime === normalizedRule
  })
}

export function isMimeCompatibleWithExtension(fileName = "", mimeType = ""): boolean {
  const ext = getFileExtension(fileName)
  const normalizedMime = String(mimeType || "").toLowerCase()
  if (!ext || !normalizedMime) return true

  const extensionCompatibilityMap: Record<string, string[]> = {
    ".pdf": ["application/pdf"],
    ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"],
    ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip"],
    ".pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/zip"],
    ".zip": ["application/zip", "application/x-zip-compressed"],
    ".png": ["image/png"],
    ".jpg": ["image/jpeg"],
    ".jpeg": ["image/jpeg"],
    ".gif": ["image/gif"],
    ".webp": ["image/webp"],
    ".svg": ["image/svg+xml", "text/xml", "application/xml", "text/plain"]
  }

  const allowed = extensionCompatibilityMap[ext]
  if (!allowed) return true
  return allowed.includes(normalizedMime)
}

export function isTextLike(name: unknown, type: unknown): boolean {
  if (typeof type === "string" && type.startsWith("text/")) return true
  const lower = String(name || "").toLowerCase()
  return [
    ".txt", ".md", ".json", ".yaml", ".yml", ".csv", ".log",
    ".svg", ".jsonl", ".tsv", ".ini", ".toml", ".env", ".sh", ".bat", ".ps1",
    ".js", ".ts", ".tsx", ".jsx", ".py", ".java", ".go", ".rs",
    ".c", ".cpp", ".h", ".cs", ".php", ".rb", ".sql", ".xml", ".html", ".css"
  ].some((ext) => lower.endsWith(ext))
}

export function isImageLike(name: unknown, type: unknown): boolean {
  if (typeof type === "string" && type.startsWith("image/")) return true
  const lower = String(name || "").toLowerCase()
  return [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"].some((ext) => lower.endsWith(ext))
}

export function isPdfLike(name: unknown, type: unknown): boolean {
  if (type === "application/pdf") return true
  const lower = String(name || "").toLowerCase()
  return lower.endsWith(".pdf")
}

export function isDocxLike(name: unknown, type: unknown): boolean {
  if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return true
  const lower = String(name || "").toLowerCase()
  return lower.endsWith(".docx")
}

export function isSpreadsheetLike(name: unknown, type: unknown): boolean {
  if (type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return true
  const lower = String(name || "").toLowerCase()
  return lower.endsWith(".xlsx")
}

export function isPresentationLike(name: unknown, type: unknown): boolean {
  if (type === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return true
  const lower = String(name || "").toLowerCase()
  return lower.endsWith(".pptx")
}

export function isZipLike(name: unknown, type: unknown): boolean {
  if (type === "application/zip" || type === "application/x-zip-compressed") return true
  const lower = String(name || "").toLowerCase()
  return lower.endsWith(".zip")
}

export function cleanExtractedText(text = ""): string {
  return String(text || "")
    .replace(/\u0000/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

export function decodeTextBuffer(buffer: Buffer | string): string {
  const utf8 = Buffer.isBuffer(buffer) ? buffer.toString("utf8") : String(buffer || "")
  const replacementCount = (utf8.match(/\uFFFD/g) || []).length
  if (replacementCount <= 2) {
    return utf8
  }

  return Buffer.isBuffer(buffer) ? buffer.toString("latin1") : utf8
}

export function buildFailedExtraction(kind = "document", method = "unknown", warning = ""): ExtractionResult {
  return {
    text: "",
    fullTextLength: 0,
    kind,
    method,
    pages: null,
    truncated: false,
    quality: "none",
    warnings: warning ? [warning] : [],
    stats: {
      charCount: 0,
      wordCount: 0,
      replacementCount: 0,
      lineCount: 0,
      alphaRatio: 0
    }
  }
}

export function analyzeExtractedText(text = ""): AnalysisResult {
  const normalized = String(text || "").trim()
  const replacementCount = (normalized.match(/\uFFFD/g) || []).length
  const charCount = normalized.replace(/\s+/g, "").length
  const wordCount = (normalized.match(/[A-Za-zÀ-ÿ0-9]{2,}/g) || []).length
  const lineCount = normalized ? normalized.split(/\n+/).filter(Boolean).length : 0
  const alphaCount = (normalized.match(/[A-Za-zÀ-ÿ]/g) || []).length
  const alphaRatio = charCount > 0 ? alphaCount / charCount : 0
  const warnings: string[] = []

  if (!normalized) {
    warnings.push("nenhum texto util extraido")
  }
  if (replacementCount > 6) {
    warnings.push("caracteres corrompidos detectados")
  }
  if (normalized && (charCount < 120 || wordCount < 24)) {
    warnings.push("conteudo extraido curto ou parcial")
  }
  if (normalized && alphaRatio < 0.45) {
    warnings.push("texto extraido com muito ruido")
  }

  let quality: ExtractionQuality = "high"
  if (!normalized) {
    quality = "none"
  } else if (warnings.length >= 2) {
    quality = "low"
  } else if (warnings.length === 1) {
    quality = "medium"
  }

  return {
    quality,
    warnings,
    stats: {
      charCount,
      wordCount,
      replacementCount,
      lineCount,
      alphaRatio: Number(alphaRatio.toFixed(2))
    }
  }
}

export function buildTextPreview(text = "", limit = uploadTextLimit): TextPreview {
  const cleaned = String(text || "").trim()
  if (!cleaned) {
    return {
      text: "",
      truncated: false
    }
  }

  if (cleaned.length <= limit) {
    return {
      text: cleaned,
      truncated: false
    }
  }

  if (limit < 1200) {
    return {
      text: `${cleaned.slice(0, limit)}\n... (truncado)`,
      truncated: true
    }
  }

  const omittedLabel = "\n\n... (trecho intermediario omitido)\n\n"
  const headChars = Math.max(Math.floor(limit * 0.72), Math.min(6000, limit - 420))
  const tailChars = Math.max(limit - headChars - omittedLabel.length, 220)

  return {
    text: `${cleaned.slice(0, headChars).trimEnd()}${omittedLabel}${cleaned.slice(-tailChars).trimStart()}`,
    truncated: true
  }
}

export function finalizeTextExtraction(rawText = "", options: FinalizeExtractionOptions = {}): ExtractionResult {
  const cleaned = cleanExtractedText(rawText)
  const analysis = analyzeExtractedText(cleaned)

  if (!cleaned) {
    return buildFailedExtraction(
      options.kind || "document",
      options.method || "unknown",
      Array.isArray(options.warnings) && options.warnings.length > 0
        ? options.warnings[0]
        : "nenhum texto util extraido"
    )
  }

  const preview = buildTextPreview(cleaned, Number(options.limit || uploadTextLimit))
  const mergedWarnings = Array.from(new Set([
    ...(Array.isArray(options.warnings) ? options.warnings.filter(Boolean) : []),
    ...analysis.warnings
  ]))

  return {
    text: preview.text,
    fullTextLength: cleaned.length,
    kind: options.kind || "document",
    method: options.method || "unknown",
    pages: options.pages || null,
    truncated: preview.truncated,
    quality: analysis.quality,
    warnings: mergedWarnings.slice(0, 4),
    stats: analysis.stats
  }
}

export function formatExtractionQualityLabel(quality = ""): string {
  switch (String(quality || "").trim().toLowerCase()) {
    case "high":
      return "alta"
    case "medium":
      return "media"
    case "low":
      return "baixa"
    default:
      return "indisponivel"
  }
}

export function buildUploadExtractionBlock(uploadEntry: UploadEntryLike, extraction?: UploadExtractionLike | null): string {
  const label = `\n\n[Arquivo enviado: ${uploadEntry.name} | tipo: ${uploadEntry.type}]`
  const kindLabelMap: Record<string, string> = {
    text: "Conteudo extraido do arquivo:",
    pdf: "Texto extraido do PDF:",
    docx: "Texto extraido do DOCX:",
    spreadsheet: "Conteudo extraido da planilha:",
    presentation: "Texto extraido da apresentacao:",
    zip: "Conteudo extraido do ZIP:",
    image: "Texto extraido da imagem:"
  }
  const kindLabel = kindLabelMap[extraction?.kind || ""] || "Conteudo extraido do arquivo:"
  const lines = [
    label,
    `Metodo de leitura: ${extraction?.method || "desconhecido"}.`,
    `Qualidade da extracao: ${formatExtractionQualityLabel(extraction?.quality)}.`
  ]

  if (Number.isFinite(Number(extraction?.pages)) && Number(extraction?.pages) > 0) {
    lines.push(`Paginas detectadas: ${Number(extraction?.pages)}.`)
  }

  if (extraction?.truncated) {
    lines.push("Observacao: foi enviado um recorte representativo do conteudo para manter a resposta fluida.")
  }

  if (Array.isArray(extraction?.warnings) && extraction.warnings.length > 0) {
    lines.push(`Limites da leitura: ${extraction.warnings.join("; ")}.`)
  }

  if (extraction?.text) {
    lines.push(kindLabel)
    lines.push(extraction.text)
  } else if (extraction?.kind === "image") {
    lines.push("(Imagem recebida. Nao houve texto OCR confiavel nesta execucao; descreva o que deseja que eu analise.)")
  } else {
    lines.push("(Arquivo recebido, mas nao consegui extrair texto confiavel nesta execucao.)")
  }

  return lines.join("\n")
}