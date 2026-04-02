import type { Express, RequestHandler } from "express"

type RecordLike = Record<string, any>

type UploadQuotaStatus = {
  blocked?: boolean
} & RecordLike

type ImageQuotaStatus = {
  blocked?: boolean
} & RecordLike

type UploadEntry = {
  id: string
  name: string
  type: string
  path: string
  size: number
  expiresAt: number
}

type UploadsStore = Map<string, UploadEntry>

type ImageGenerationRequest = {
  style?: string
  stylePreset?: string
  aspectRatio?: string
  width?: number
  height?: number
  negativePrompt?: string
  guidanceScale?: number
  numInferenceSteps?: number
  seed?: number | null
} & RecordLike

type GeneratedImage = {
  controls?: RecordLike
} & RecordLike

type SafetyResult = {
  triggered?: boolean
} & RecordLike

type SanitizedAskContext = {
  activeModules?: unknown[]
  assistantProfile?: string
} & RecordLike

type GeneratedDocument = {
  fileName: string
  mimeType: string
  size: number
  previewText?: string
} & RecordLike

type GrootMemoryConnectorLike = {
  saveConversation: (
    userId: string,
    question: string,
    response: string,
    metadata: RecordLike
  ) => Promise<unknown>
}

type EnterpriseMediaRouteDeps = {
  askLimiter: RequestHandler
  askSlowDown: RequestHandler
  fs: {
    writeFile: (filePath: string, buffer: Buffer) => Promise<unknown>
  }
  path: {
    join: (...parts: string[]) => string
  }
  crypto: {
    randomUUID: () => string
  }
  UPLOAD_DIR: string
  uploads: UploadsStore
  uploadTtlMinutes: number
  uploadMaxBytes: number
  parseBase64Payload: (data: string) => Buffer
  ensureUploadDir: () => Promise<unknown>
  safeFilename: (name: string) => string
  detectMimeFromMagic: (buffer: Buffer, safeName: string) => string
  normalizeUploadMime: (safeName: string, providedType: string, detectedType: string) => string
  isAllowedUploadByAccept: (safeName: string, resolvedType: string) => boolean
  isMimeCompatibleWithExtension: (safeName: string, resolvedType: string) => boolean
  scheduleUploadCleanup: (id: string) => void
  resolveUploadExtraction: (uploadRef: UploadEntry) => Promise<unknown>
  resolveUploadQuotaContext: (req: unknown) => unknown
  getUploadQuotaStatus: (quotaContext: unknown) => UploadQuotaStatus
  consumeUploadQuota: (quotaContext: unknown) => UploadQuotaStatus
  resolveImageQuotaContext: (req: unknown) => unknown
  getImageQuotaStatus: (quotaContext: unknown) => ImageQuotaStatus
  consumeImageQuota: (quotaContext: unknown) => ImageQuotaStatus
  parseImageGenerationRequest: (body: unknown) => ImageGenerationRequest
  buildImageStylePresetPrompt: (stylePreset: unknown) => string
  generateImageWithProvider: (fullPrompt: string, imageRequest: ImageGenerationRequest) => Promise<GeneratedImage>
  detectSafetyRisk: (text: string) => SafetyResult
  buildSafetyResponse: (safety: SafetyResult, input: { locale: string; promptText: string }) => string
  normalizeDocumentFormat: (format: unknown) => string
  sanitizeDocumentTitle: (title: unknown, fallback: string) => string
  sanitizeAskContext: (context: unknown) => SanitizedAskContext
  buildDocumentDraftPrompt: (
    prompt: string,
    requestedFormat: string,
    input: {
      locale: string
      style: unknown
      activeModules: unknown[]
      title: string
    }
  ) => string
  documentGenerationFormatIds: unknown
  getResearchCapabilities: (capabilities?: unknown) => unknown
  buildRuntimeCapabilityMatrix: () => RecordLike
  askGiom: (message: string, context: RecordLike) => Promise<string>
  generateStructuredDocument: (input: {
    format: string
    title: string
    content: string
    fileNameBase: string
    metadata: RecordLike
  }) => Promise<GeneratedDocument>
  grootMemoryConnector: GrootMemoryConnectorLike
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function buildRequestId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function getErrorStatusCode(error: unknown) {
  return typeof error === "object" && error !== null && "statusCode" in error
    ? Number((error as RecordLike).statusCode || 0)
    : 0
}

function getErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as RecordLike).code || "")
    : ""
}

export function registerEnterpriseMediaRoutes(app: Express, deps: EnterpriseMediaRouteDeps) {
  const {
    askLimiter,
    askSlowDown,
    fs,
    path,
    crypto,
    UPLOAD_DIR,
    uploads,
    uploadTtlMinutes,
    uploadMaxBytes,
    parseBase64Payload,
    ensureUploadDir,
    safeFilename,
    detectMimeFromMagic,
    normalizeUploadMime,
    isAllowedUploadByAccept,
    isMimeCompatibleWithExtension,
    scheduleUploadCleanup,
    resolveUploadExtraction,
    resolveUploadQuotaContext,
    getUploadQuotaStatus,
    consumeUploadQuota,
    resolveImageQuotaContext,
    getImageQuotaStatus,
    consumeImageQuota,
    parseImageGenerationRequest,
    buildImageStylePresetPrompt,
    generateImageWithProvider,
    detectSafetyRisk,
    buildSafetyResponse,
    normalizeDocumentFormat,
    sanitizeDocumentTitle,
    sanitizeAskContext,
    buildDocumentDraftPrompt,
    documentGenerationFormatIds,
    getResearchCapabilities,
    buildRuntimeCapabilityMatrix,
    askGiom,
    generateStructuredDocument,
    grootMemoryConnector
  } = deps

  app.post("/upload", askLimiter, async (req, res) => {
    try {
      const quotaContext = resolveUploadQuotaContext(req)
      const quotaBefore = getUploadQuotaStatus(quotaContext)
      if (quotaBefore.blocked) {
        return res.status(429).json({
          error: "Limite diario de uploads atingido",
          code: "UPLOAD_QUOTA_EXCEEDED",
          quota: quotaBefore
        })
      }

      const { name, type, data } = req.body || {}
      if (!name || !data) {
        return res.status(400).json({ error: "Arquivo invalido", code: "INVALID_UPLOAD" })
      }

      const buffer = parseBase64Payload(data)
      if (!buffer || !buffer.length) {
        return res.status(400).json({ error: "Conteudo vazio", code: "EMPTY_UPLOAD" })
      }

      if (buffer.length > uploadMaxBytes) {
        return res.status(413).json({
          error: "Arquivo muito grande",
          code: "UPLOAD_TOO_LARGE",
          maxBytes: uploadMaxBytes
        })
      }

      await ensureUploadDir()
      const id = crypto.randomUUID()
      const safeName = safeFilename(name)
      const detectedType = detectMimeFromMagic(buffer, safeName)
      const resolvedType = normalizeUploadMime(safeName, type || "", detectedType)

      if (!isAllowedUploadByAccept(safeName, resolvedType)) {
        return res.status(415).json({
          error: "Tipo de arquivo nao suportado",
          code: "UPLOAD_UNSUPPORTED_TYPE",
          detectedType: resolvedType,
          name: safeName
        })
      }

      if (!isMimeCompatibleWithExtension(safeName, resolvedType)) {
        return res.status(415).json({
          error: "Arquivo com tipo inconsistente para a extensao",
          code: "UPLOAD_TYPE_MISMATCH",
          detectedType: resolvedType,
          name: safeName
        })
      }

      const filePath = path.join(UPLOAD_DIR, `${id}_${safeName}`)

      await fs.writeFile(filePath, buffer)

      const expiresAt = Date.now() + uploadTtlMinutes * 60 * 1000
      uploads.set(id, {
        id,
        name: safeName,
        type: resolvedType,
        path: filePath,
        size: buffer.length,
        expiresAt
      })
      scheduleUploadCleanup(id)
      const uploadRef = uploads.get(id)
      if (uploadRef) {
        Promise.resolve()
          .then(() => resolveUploadExtraction(uploadRef))
          .catch(() => { })
      }

      const quotaAfter = consumeUploadQuota(quotaContext)

      res.json({
        id,
        name: safeName,
        type: resolvedType,
        size: buffer.length,
        expiresAt,
        detectedType: detectedType || resolvedType,
        quota: quotaAfter
      })
    } catch (error) {
      console.error("Falha no upload:", getErrorMessage(error))
      res.status(500).json({ error: "Falha ao salvar arquivo", code: "UPLOAD_FAILED" })
    }
  })

  app.get("/upload/quota", (req, res) => {
    try {
      const quotaContext = resolveUploadQuotaContext(req)
      const quota = getUploadQuotaStatus(quotaContext)
      res.json({ success: true, quota })
    } catch {
      res.status(500).json({ success: false, error: "Falha ao consultar cota de upload", code: "UPLOAD_QUOTA_STATUS_FAILED" })
    }
  })

  app.get("/usage/limits", (req, res) => {
    try {
      const uploadContext = resolveUploadQuotaContext(req)
      const imageContext = resolveImageQuotaContext(req)
      res.json({
        success: true,
        limits: {
          upload: getUploadQuotaStatus(uploadContext),
          image: getImageQuotaStatus(imageContext)
        }
      })
    } catch {
      res.status(500).json({ success: false, error: "Falha ao consultar limites de uso", code: "USAGE_LIMITS_FAILED" })
    }
  })

  app.post("/generate/image", askLimiter, askSlowDown, async (req, res) => {
    try {
      const imageQuotaContext = resolveImageQuotaContext(req)
      const imageQuotaBefore = getImageQuotaStatus(imageQuotaContext)
      if (imageQuotaBefore.blocked) {
        return res.status(429).json({
          error: "Limite diario de geracao de imagem atingido",
          code: "IMAGE_QUOTA_EXCEEDED",
          quota: imageQuotaBefore
        })
      }

      const requestId = buildRequestId("img")
      const prompt = String(req.body?.prompt || "").trim()
      const locale = String(req.body?.locale || "pt-BR")
      const imageRequest = parseImageGenerationRequest(req.body)

      if (!prompt) {
        return res.status(400).json({ error: "Prompt de imagem vazio", code: "EMPTY_IMAGE_PROMPT" })
      }

      const safety = detectSafetyRisk(prompt)
      if (safety.triggered) {
        return res.status(400).json({
          error: buildSafetyResponse(safety, { locale, promptText: prompt }),
          code: "IMAGE_PROMPT_BLOCKED",
          safety
        })
      }

      const fullPrompt = [
        prompt,
        imageRequest.style ? `Style guidance: ${imageRequest.style}` : "",
        imageRequest.stylePreset ? `Style preset: ${imageRequest.stylePreset}` : "",
        buildImageStylePresetPrompt(imageRequest.stylePreset),
        imageRequest.aspectRatio ? `Requested aspect ratio: ${imageRequest.aspectRatio}` : "",
        imageRequest.width && imageRequest.height ? `Target size: ${imageRequest.width}x${imageRequest.height}` : ""
      ]
        .filter(Boolean)
        .join("\n")

      const image = await generateImageWithProvider(fullPrompt, imageRequest)
      const imageQuotaAfter = consumeImageQuota(imageQuotaContext)

      res.json({
        success: true,
        requestId,
        image,
        quota: imageQuotaAfter,
        controls: image.controls || {
          stylePreset: imageRequest.stylePreset || null,
          aspectRatio: imageRequest.aspectRatio,
          width: imageRequest.width,
          height: imageRequest.height,
          negativePrompt: imageRequest.negativePrompt || null,
          guidanceScale: imageRequest.guidanceScale,
          numInferenceSteps: imageRequest.numInferenceSteps,
          seed: imageRequest.seed ?? null
        }
      })
    } catch (error) {
      res.status(getErrorStatusCode(error) || 500).json({
        error: getErrorMessage(error) || "Falha ao gerar imagem",
        code: getErrorCode(error) || "IMAGE_GENERATION_FAILED"
      })
    }
  })

  app.post("/generate/document", askLimiter, askSlowDown, async (req, res) => {
    const requestId = buildRequestId("doc")

    try {
      const userId = req.get("X-User-Id") || req.ip || "default_user"
      const prompt = String(req.body?.prompt || "").trim()
      const providedContent = String(req.body?.content || "").trim()
      const requestedFormat = normalizeDocumentFormat(req.body?.format || "pdf")
      const locale = String(req.body?.locale || "pt-BR")
      const title = sanitizeDocumentTitle(req.body?.title || "", "Documento GIOM")
      const documentContext = sanitizeAskContext(req.body?.context)
      const activeModules = Array.isArray(documentContext.activeModules) ? documentContext.activeModules : []
      const assistantProfile = String(documentContext.assistantProfile || "auto")

      if (!requestedFormat) {
        return res.status(400).json({
          error: "Formato de documento nao suportado.",
          code: "UNSUPPORTED_DOCUMENT_FORMAT",
          supportedFormats: documentGenerationFormatIds
        })
      }

      if (!prompt && !providedContent) {
        return res.status(400).json({
          error: "Informe um prompt ou conteudo para gerar o documento.",
          code: "EMPTY_DOCUMENT_REQUEST"
        })
      }

      const safety = detectSafetyRisk(`${title}\n${prompt}\n${providedContent}`)
      if (safety.triggered) {
        return res.status(400).json({
          error: buildSafetyResponse(safety, { locale, promptText: prompt || providedContent }),
          code: "DOCUMENT_PROMPT_BLOCKED",
          safety
        })
      }

      const runtimeContext = {
        ...(req.body?.context || {}),
        locale,
        userId,
        requestId,
        assistantProfile,
        activeModules,
        researchCapabilities: getResearchCapabilities(req.body?.context?.researchCapabilities || {}),
        capabilityMatrix: buildRuntimeCapabilityMatrix(),
        privacyCapabilities: {
          sensitiveDataRedaction: true,
          sensitiveLearningBlocked: true,
          temporaryUploadStorage: true
        }
      }

      const documentContent = providedContent || await askGiom(
        buildDocumentDraftPrompt(prompt, requestedFormat, {
          locale,
          style: req.body?.context?.verbosity || "natural",
          activeModules,
          title
        }),
        runtimeContext
      )

      const document = await generateStructuredDocument({
        format: requestedFormat,
        title,
        content: documentContent,
        fileNameBase: title,
        metadata: {
          requestId,
          locale,
          assistantProfile
        }
      })

      await grootMemoryConnector.saveConversation(userId, prompt || `Gerar documento ${requestedFormat.toUpperCase()}`, `Documento ${document.fileName} gerado com sucesso.`, {
        provider: "document_generation",
        requestId,
        assistantProfile,
        activeModules,
        document: {
          format: requestedFormat,
          title,
          fileName: document.fileName,
          mimeType: document.mimeType,
          size: document.size
        }
      })

      res.json({
        success: true,
        requestId,
        document,
        content: documentContent,
        previewText: document.previewText
      })
    } catch (error) {
      res.status(getErrorStatusCode(error) || 500).json({
        error: getErrorMessage(error) || "Falha ao gerar documento",
        code: getErrorCode(error) || "DOCUMENT_GENERATION_FAILED"
      })
    }
  })
}