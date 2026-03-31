import path from "path"

export const UPLOAD_DIR = path.join(process.cwd(), "tmp_uploads")
export const uploads = new Map<string, Record<string, any>>()
export const uploadTtlMinutes = Number(process.env.UPLOAD_TTL_MINUTES || 10)
export const uploadMaxBytes = Number(process.env.UPLOAD_MAX_BYTES || 2_000_000)
export const uploadTextLimit = Number(process.env.UPLOAD_TEXT_LIMIT || 12000)
export const uploadOcrEnabled = process.env.UPLOAD_OCR_ENABLED === "true"
export const uploadDefaultOcrLangPath = path.join(process.cwd(), "assets", "tessdata")
export const uploadOcrLang = process.env.OCR_LANG || "por+eng"
export const uploadOcrTextLimit = Number(process.env.OCR_TEXT_LIMIT || 8000)
export const uploadPdfTextLimit = Number(process.env.UPLOAD_PDF_TEXT_LIMIT || uploadTextLimit)
export const uploadOfficeTextLimit = Number(process.env.UPLOAD_OFFICE_TEXT_LIMIT || uploadTextLimit)
export const uploadZipTextLimit = Number(process.env.UPLOAD_ZIP_TEXT_LIMIT || 16000)
export const uploadZipFileLimit = Number(process.env.UPLOAD_ZIP_FILE_LIMIT || 12)
export const uploadOcrCachePath = process.env.OCR_CACHE_PATH
  ? path.resolve(process.cwd(), process.env.OCR_CACHE_PATH)
  : path.join(process.cwd(), ".cache", "tesseract")
export const uploadOcrLangPath = process.env.OCR_LANG_PATH
  ? path.resolve(process.cwd(), process.env.OCR_LANG_PATH)
  : uploadDefaultOcrLangPath
export const uploadPdfOcrEnabled = process.env.UPLOAD_PDF_OCR_ENABLED !== "false"
export const uploadPdfOcrPageLimit = Math.max(1, Math.min(8, Number(process.env.UPLOAD_PDF_OCR_PAGE_LIMIT || 4)))
export const uploadPdfOcrScale = Math.max(1, Math.min(3, Number(process.env.UPLOAD_PDF_OCR_SCALE || 2)))
export const uploadPdfOcrTempDir = process.env.UPLOAD_PDF_OCR_TEMP_DIR
  ? path.resolve(process.cwd(), process.env.UPLOAD_PDF_OCR_TEMP_DIR)
  : path.join(process.cwd(), ".cache", "pdf-ocr")
export const uploadExternalReaderEnabled = process.env.UPLOAD_EXTERNAL_READER_ENABLED === "true"
export const uploadExternalReaderUrl = String(process.env.UPLOAD_EXTERNAL_READER_URL || "http://127.0.0.1:8090").trim()
export const uploadExternalReaderTimeoutMs = Math.max(1000, Number(process.env.UPLOAD_EXTERNAL_READER_TIMEOUT_MS || 20000))
export const uploadExternalReaderApiKey = String(process.env.UPLOAD_EXTERNAL_READER_API_KEY || "").trim()
export const uploadQuotaWindowHours = Math.max(1, Number(process.env.UPLOAD_QUOTA_WINDOW_HOURS || 24))
export const uploadQuotaAnonPerWindow = Math.max(0, Number(process.env.UPLOAD_QUOTA_ANON_PER_WINDOW || 5))
export const uploadQuotaAuthPerWindow = Math.max(0, Number(process.env.UPLOAD_QUOTA_AUTH_PER_WINDOW || 9))
export const uploadQuotaPaidPerWindow = Math.max(0, Number(process.env.UPLOAD_QUOTA_PAID_PER_WINDOW || 120))
export const imageQuotaWindowHours = Math.max(1, Number(process.env.IMAGE_QUOTA_WINDOW_HOURS || uploadQuotaWindowHours))
export const imageQuotaAnonPerWindow = Math.max(0, Number(process.env.IMAGE_QUOTA_ANON_PER_WINDOW || 2))
export const imageQuotaAuthPerWindow = Math.max(0, Number(process.env.IMAGE_QUOTA_AUTH_PER_WINDOW || 4))
export const imageQuotaPaidPerWindow = Math.max(0, Number(process.env.IMAGE_QUOTA_PAID_PER_WINDOW || 80))
export const imageGenerationModel = process.env.HUGGINGFACE_IMAGE_MODEL || "black-forest-labs/FLUX.1-schnell"
export const imageGenerationMinDimension = Number(process.env.IMAGE_MIN_DIMENSION || 512)
export const imageGenerationMaxDimension = Number(process.env.IMAGE_MAX_DIMENSION || 1536)
export const imageGenerationDefaultSteps = Number(process.env.IMAGE_INFERENCE_STEPS_DEFAULT || 28)
export const imageGenerationMaxSteps = Number(process.env.IMAGE_INFERENCE_STEPS_MAX || 50)
export const imageGenerationDefaultGuidance = Number(process.env.IMAGE_GUIDANCE_SCALE_DEFAULT || 4)
export const IMAGE_STYLE_PRESETS = Object.freeze({
  editorial: "Editorial product render, polished lighting, premium composition, crisp details, commercial design quality.",
  cinematic: "Cinematic lighting, atmospheric depth, dramatic framing, realistic materials, premium post-production look.",
  ui: "Product design showcase, modern interface composition, readable panels, premium SaaS art direction.",
  dracula: "Dark dracula-inspired palette, neon accents, elegant contrast, clean futuristic composition.",
  illustration: "High-end illustration, stylized but readable, balanced colors, refined shapes, professional finish.",
  logo: "Minimal brand concept, vector-friendly silhouette, clean negative space, strong contrast, presentation-ready.",
  diagram: "Structured infographic composition, clear hierarchy, presentation-friendly layout, minimal clutter."
} as const)
export const IMAGE_RATIO_DIMENSIONS = Object.freeze({
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1344, height: 768 },
  "9:16": { width: 768, height: 1344 },
  "4:3": { width: 1152, height: 864 },
  "3:4": { width: 864, height: 1152 },
  "3:2": { width: 1216, height: 832 },
  "2:3": { width: 832, height: 1216 }
} as const)
export const SUPPORTED_UPLOAD_ACCEPT = [
  "image/*", ".pdf", ".zip", ".docx", ".xlsx", ".pptx", ".txt", ".md", ".svg", ".json", ".jsonl", ".js", ".ts", ".tsx", ".jsx", ".py", ".java", ".go", ".rs", ".c", ".cpp", ".h", ".cs", ".php", ".rb", ".html", ".css", ".xml", ".yml", ".yaml", ".log", ".tsv", ".csv", ".sql"
] as const

export function getImageGenerationToken(): string | null {
  return process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY || process.env.HUGGINGFACEHUB_API_TOKEN || null
}

export function isImageGenerationEnabled(): boolean {
  return Boolean(getImageGenerationToken())
}

export function clampImageNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, numeric))
}

export function normalizeImageDimension(value: unknown, fallback: number): number {
  const clamped = clampImageNumber(value, imageGenerationMinDimension, imageGenerationMaxDimension, fallback)
  return Math.round(clamped / 64) * 64
}

export function normalizeImageStylePreset(value = ""): string {
  const normalized = String(value || "").trim().toLowerCase()
  return Object.prototype.hasOwnProperty.call(IMAGE_STYLE_PRESETS, normalized) ? normalized : ""
}

export function normalizeImageAspectRatio(value = ""): string {
  const normalized = String(value || "").trim()
  return Object.prototype.hasOwnProperty.call(IMAGE_RATIO_DIMENSIONS, normalized) ? normalized : ""
}

export function normalizeImageSeed(value: unknown): number | null {
  if (value == null || value === "") return null
  const numeric = Math.trunc(Number(value))
  return Number.isFinite(numeric) ? Math.max(0, numeric) : null
}

export function resolveImageDimensions({ width, height, aspectRatio }: { width?: unknown, height?: unknown, aspectRatio?: unknown } = {}) {
  const normalizedRatio = normalizeImageAspectRatio(String(aspectRatio || "")) || "1:1"
  const preset = IMAGE_RATIO_DIMENSIONS[normalizedRatio as keyof typeof IMAGE_RATIO_DIMENSIONS] || IMAGE_RATIO_DIMENSIONS["1:1"]
  return {
    aspectRatio: normalizedRatio,
    width: normalizeImageDimension(width, preset.width),
    height: normalizeImageDimension(height, preset.height)
  }
}

export function buildImageStylePresetPrompt(stylePreset = ""): string {
  return IMAGE_STYLE_PRESETS[stylePreset as keyof typeof IMAGE_STYLE_PRESETS] || ""
}

export function parseImageGenerationRequest(body: Record<string, any> = {}) {
  const stylePreset = normalizeImageStylePreset(body?.stylePreset)
  const negativePrompt = String(body?.negativePrompt || "").trim().slice(0, 400)
  const guidanceScale = clampImageNumber(body?.guidanceScale, 1, 20, imageGenerationDefaultGuidance)
  const numInferenceSteps = Math.trunc(clampImageNumber(body?.numInferenceSteps, 12, imageGenerationMaxSteps, imageGenerationDefaultSteps))
  const seed = normalizeImageSeed(body?.seed)
  const dimensions = resolveImageDimensions({ width: body?.width, height: body?.height, aspectRatio: body?.aspectRatio })
  return {
    style: String(body?.style || "").trim(),
    stylePreset,
    negativePrompt,
    guidanceScale,
    numInferenceSteps,
    seed,
    ...dimensions
  }
}

export function getUploadCapabilities() {
  return {
    accept: SUPPORTED_UPLOAD_ACCEPT,
    supportedKinds: ["text", "code", "svg", "pdf", "zip", "docx", "xlsx", "pptx", uploadOcrEnabled ? "image_ocr" : "image"],
    supports: {
      text: true,
      code: true,
      svg: true,
      markdown: true,
      json: true,
      csv: true,
      pdf: true,
      zip: true,
      docx: true,
      xlsx: true,
      pptx: true,
      image: true,
      ocr: uploadOcrEnabled,
      externalReader: uploadExternalReaderEnabled,
      officeBinaryDocuments: true,
      genericBinaryInspection: false,
      mimeSignatureValidation: true
    },
    quotas: {
      windowHours: uploadQuotaWindowHours,
      anonymousUploads: uploadQuotaAnonPerWindow,
      authenticatedUploads: uploadQuotaAuthPerWindow,
      paidUploads: uploadQuotaPaidPerWindow,
      imageWindowHours: imageQuotaWindowHours,
      anonymousImages: imageQuotaAnonPerWindow,
      authenticatedImages: imageQuotaAuthPerWindow,
      paidImages: imageQuotaPaidPerWindow
    }
  }
}
