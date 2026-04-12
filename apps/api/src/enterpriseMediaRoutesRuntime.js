function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function buildRequestId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function extractBibleCodeHint(text = "") {
  return String(text || "").toUpperCase().match(/\b(NAA|ARC|ACF|AA|ARA|NVI|NVT|BJ|KJA|KJF)\b/)?.[1] || ""
}

function extractLooseBibleChapterReference(prompt = "") {
  const input = String(prompt || "").trim()
  if (!input) {
    return ""
  }

  const stopLookahead = String.raw`(?=\s+(?:da\s+b[ií]blia|na\s+b[ií]blia|b[ií]blia|sagrada|naa|arc|acf|aa|ara|nvi|nvt|bj|kja|kjf)\b|[.,!?]|$)`
  const ordinalPatterns = [
    { regex: new RegExp(String.raw`\bprimeiro\s+cap[ií]tulo\s+de\s+([a-z\u00c0-\u017f0-9 ]+?)${stopLookahead}`, "i"), chapter: "1" },
    { regex: new RegExp(String.raw`\bsegundo\s+cap[ií]tulo\s+de\s+([a-z\u00c0-\u017f0-9 ]+?)${stopLookahead}`, "i"), chapter: "2" },
    { regex: new RegExp(String.raw`\bterceiro\s+cap[ií]tulo\s+de\s+([a-z\u00c0-\u017f0-9 ]+?)${stopLookahead}`, "i"), chapter: "3" }
  ]

  for (const entry of ordinalPatterns) {
    const match = input.match(entry.regex)
    if (match?.[1]) {
      return `${match[1].trim()} ${entry.chapter}`.replace(/\s+/g, " ").trim()
    }
  }

  const numericMatch = input.match(new RegExp(String.raw`\bcap[ií]tulo\s+(\d+)\s+de\s+([a-z\u00c0-\u017f0-9 ]+?)${stopLookahead}`, "i"))
  if (numericMatch?.[1] && numericMatch?.[2]) {
    return `${numericMatch[2].trim()} ${numericMatch[1].trim()}`.replace(/\s+/g, " ").trim()
  }

  return ""
}

function normalizeLooseBibleDocumentPrompt(prompt = "") {
  return extractLooseBibleChapterReference(prompt) || String(prompt || "")
}

function shouldUseDeterministicBibleDocument(prompt = "", parseBibleReference) {
  if (typeof parseBibleReference !== "function") {
    return false
  }

  const input = normalizeLooseBibleDocumentPrompt(prompt)
  const parsedReference = parseBibleReference(input)
  if (!parsedReference) {
    return false
  }

  if (/\b(devocional|estudo|explic[ae]|explica[cç][aã]o|resum[ao]|prega[cç][aã]o|serm[aã]o|aplica[cç][aã]o|contexto|interpreta[cç][aã]o)\b/i.test(input)) {
    return false
  }

  return /\b(biblia|bíblia|capitulo|capítulo|versiculo|versículo|passagem|texto|leia|mostre|traga|livro de|evangelho|salmo|genesis|gênesis)\b/i.test(input)
}

async function resolveDeterministicBibleDocumentContent(prompt = "", title = "", context = {}, deps = {}) {
  const { parseBibleReference, fetchBiblePassage } = deps

  if (!shouldUseDeterministicBibleDocument(prompt, parseBibleReference) || typeof fetchBiblePassage !== "function") {
    return null
  }

  const normalizedPrompt = normalizeLooseBibleDocumentPrompt(prompt)
  const parsedReference = parseBibleReference(normalizedPrompt)
  const passageReference = parsedReference?.canonical || parsedReference?.human || String(prompt || "").trim()
  const bibleCode = extractBibleCodeHint(`${prompt}\n${title}`) || String(context?.preferredBibleCode || context?.bibleCode || "NAA").trim() || "NAA"

  let biblePassage
  try {
    biblePassage = await fetchBiblePassage({
      bibleCode,
      passage: passageReference
    })
  } catch (error) {
    const wrappedError = new Error(`Nao foi possivel buscar a passagem biblica solicitada: ${getErrorMessage(error)}`)
    wrappedError.statusCode = getErrorStatusCode(error) || 503
    wrappedError.code = getErrorCode(error) || "BIBLE_DOCUMENT_SOURCE_UNAVAILABLE"
    throw wrappedError
  }

  const resolvedReference = String(biblePassage?.reference || parsedReference?.human || passageReference).trim()
  const resolvedBibleCode = String(biblePassage?.bibleCode || bibleCode).trim() || "NAA"
  const passageContent = String(biblePassage?.content || "").trim()

  if (!passageContent) {
    const error = new Error("Nao foi possivel montar o conteudo biblico solicitado para o documento.")
    error.statusCode = 503
    error.code = "EMPTY_BIBLE_DOCUMENT_CONTENT"
    throw error
  }

  return [`${resolvedReference} (${resolvedBibleCode})`, "", passageContent].join("\n")
}

function buildMediaRouteError(message, code, statusCode = 400, details = null) {
  const error = new Error(message)
  error.code = code
  error.statusCode = statusCode
  if (details) {
    error.details = details
  }
  return error
}

function resolveRequesterId(req) {
  return String(req.get("X-User-Id") || req.ip || "default_user")
}

function isAdminRequest(req) {
  const adminKey = String(process.env.ADMIN_DASH_KEY || "").trim()
  if (!adminKey) {
    return false
  }
  return String(req.get("X-Admin-Key") || "").trim() === adminKey
}

function ensureAsyncJobAccess(req, job) {
  if (!job) {
    throw buildMediaRouteError("Job nao encontrado", "JOB_NOT_FOUND", 404)
  }

  if (job.ownerKey === resolveRequesterId(req) || isAdminRequest(req)) {
    return job
  }

  throw buildMediaRouteError("Voce nao possui acesso a este job", "JOB_ACCESS_DENIED", 403)
}

function getRawContext(body = {}) {
  return body?.context && typeof body.context === "object" && !Array.isArray(body.context)
    ? body.context
    : {}
}

async function buildDocumentGenerationInput(req, requestId, deps) {
  const {
    normalizeDocumentFormat,
    sanitizeDocumentTitle,
    sanitizeAskContext,
    detectSafetyRisk,
    buildSafetyResponse,
    getResearchCapabilities,
    buildRuntimeCapabilityMatrix,
    documentGenerationFormatIds
  } = deps

  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body
    : {}
  const userId = resolveRequesterId(req)
  const rawContext = getRawContext(body)
  const prompt = String(body.prompt || "").trim()
  const providedContent = String(body.content || "").trim()
  const requestedFormat = normalizeDocumentFormat(body.format || "pdf")
  const locale = String(body.locale || "pt-BR")
  const title = sanitizeDocumentTitle(body.title || "", "Documento GIOM")
  const documentContext = sanitizeAskContext(rawContext)
  const activeModules = Array.isArray(documentContext.activeModules) ? documentContext.activeModules : []
  const assistantProfile = String(documentContext.assistantProfile || "auto")

  if (!requestedFormat) {
    throw buildMediaRouteError(
      "Formato de documento nao suportado.",
      "UNSUPPORTED_DOCUMENT_FORMAT",
      400,
      { supportedFormats: documentGenerationFormatIds }
    )
  }

  if (!prompt && !providedContent) {
    throw buildMediaRouteError(
      "Informe um prompt ou conteudo para gerar o documento.",
      "EMPTY_DOCUMENT_REQUEST",
      400
    )
  }

  const safety = detectSafetyRisk(`${title}\n${prompt}\n${providedContent}`)
  if (safety.triggered) {
    const safetyError = buildMediaRouteError(
      buildSafetyResponse(safety, { locale, promptText: prompt || providedContent }),
      "DOCUMENT_PROMPT_BLOCKED",
      400
    )
    safetyError.safety = safety
    throw safetyError
  }

  return {
    requestId,
    userId,
    prompt,
    providedContent,
    requestedFormat,
    locale,
    title,
    documentContext,
    activeModules,
    assistantProfile,
    runtimeContext: {
      ...rawContext,
      locale,
      userId,
      requestId,
      assistantProfile,
      activeModules,
      researchCapabilities: getResearchCapabilities(rawContext.researchCapabilities || {}),
      capabilityMatrix: buildRuntimeCapabilityMatrix(),
      privacyCapabilities: {
        sensitiveDataRedaction: true,
        sensitiveLearningBlocked: true,
        temporaryUploadStorage: true
      }
    }
  }
}

async function generateDocumentArtifact(input, deps) {
  const {
    sanitizeGeneratedDocumentContent,
    buildDocumentDraftPrompt,
    parseBibleReference,
    fetchBiblePassage,
    askGiom,
    generateStructuredDocument,
    grootMemoryConnector
  } = deps
  const {
    userId,
    prompt,
    providedContent,
    requestedFormat,
    locale,
    title,
    activeModules,
    assistantProfile,
    runtimeContext,
    requestId
  } = input

  const deterministicBibleDocumentContent = providedContent
    ? null
    : await resolveDeterministicBibleDocumentContent(prompt, title, runtimeContext, {
      parseBibleReference,
      fetchBiblePassage
    })

  const rawDocumentContent = providedContent || deterministicBibleDocumentContent || await askGiom(
    buildDocumentDraftPrompt(prompt, requestedFormat, {
      locale,
      style: runtimeContext?.verbosity || "natural",
      activeModules,
      title
    }),
    runtimeContext
  )
  const documentContent = providedContent
    ? rawDocumentContent
    : sanitizeGeneratedDocumentContent(rawDocumentContent, prompt || title, requestedFormat, { title })

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

  return {
    success: true,
    requestId,
    document,
    content: documentContent,
    previewText: document.previewText
  }
}

export function registerEnterpriseMediaRoutes(app, deps) {
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
    sanitizeGeneratedDocumentContent,
    sanitizeAskContext,
    buildDocumentDraftPrompt,
    documentGenerationFormatIds,
    parseBibleReference,
    fetchBiblePassage,
    getResearchCapabilities,
    buildRuntimeCapabilityMatrix,
    askGiom,
    generateStructuredDocument,
    grootMemoryConnector,
    jobManager,
    traceStore
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
      res.status(error.statusCode || 500).json({
        error: error.message || "Falha ao gerar imagem",
        code: error.code || "IMAGE_GENERATION_FAILED"
      })
    }
  })

  app.post("/generate/document", askLimiter, askSlowDown, async (req, res) => {
    const requestId = buildRequestId("doc")

    try {
      const requestTrace = traceStore?.getRequestContext?.(req) || {}
      const input = await buildDocumentGenerationInput(req, requestId, deps)
      const payload = traceStore
        ? await traceStore.withTrace({
          requestId,
          traceId: requestTrace.traceId || null,
          kind: "media",
          name: "generate.document",
          timeoutMs: 120_000,
          metadata: {
            format: input.requestedFormat,
            title: input.title
          }
        }, () => generateDocumentArtifact(input, deps))
        : await generateDocumentArtifact(input, deps)

      res.json(payload)
    } catch (error) {
      res.status(error.statusCode || 500).json({
        error: error.message || "Falha ao gerar documento",
        code: error.code || "DOCUMENT_GENERATION_FAILED",
        details: process.env.NODE_ENV === "development" ? error.details || undefined : undefined,
        safety: error.safety || undefined,
        requestId
      })
    }
  })

  app.post("/generate/document/async", askLimiter, askSlowDown, async (req, res) => {
    const requestId = buildRequestId("docjob")

    try {
      const requestTrace = traceStore?.getRequestContext?.(req) || {}
      const input = await buildDocumentGenerationInput(req, requestId, deps)
      const job = jobManager.enqueue({
        requestId,
        traceId: requestTrace.traceId || null,
        ownerKey: input.userId,
        type: "document_generation",
        timeoutMs: 10 * 60 * 1000,
        metadata: {
          format: input.requestedFormat,
          title: input.title
        },
        handler: async () => generateDocumentArtifact(input, deps)
      })

      res.status(202).json({
        success: true,
        requestId,
        async: true,
        statusUrl: `/jobs/${job.jobId}`,
        job
      })
    } catch (error) {
      res.status(error.statusCode || 500).json({
        error: error.message || "Falha ao agendar geracao de documento",
        code: error.code || "DOCUMENT_GENERATION_ASYNC_FAILED",
        details: process.env.NODE_ENV === "development" ? error.details || undefined : undefined,
        safety: error.safety || undefined,
        requestId
      })
    }
  })

  app.post("/upload/extract/async", askLimiter, async (req, res) => {
    const requestId = buildRequestId("extract")

    try {
      const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? req.body
        : {}
      const uploadId = String(body.uploadId || "").trim()
      if (!uploadId) {
        return res.status(400).json({
          error: "Informe uploadId para processar o arquivo em background.",
          code: "UPLOAD_ID_REQUIRED",
          requestId
        })
      }

      const uploadRef = uploads.get(uploadId)
      if (!uploadRef) {
        return res.status(404).json({
          error: "Upload nao encontrado ou expirado.",
          code: "UPLOAD_NOT_FOUND",
          requestId
        })
      }

      const requestTrace = traceStore?.getRequestContext?.(req) || {}
      const ownerKey = resolveRequesterId(req)
      const job = jobManager.enqueue({
        requestId,
        traceId: requestTrace.traceId || null,
        ownerKey,
        type: "upload_extraction",
        timeoutMs: 5 * 60 * 1000,
        metadata: {
          uploadId,
          name: uploadRef.name,
          type: uploadRef.type
        },
        handler: async () => ({
          success: true,
          requestId,
          uploadId,
          file: {
            name: uploadRef.name,
            type: uploadRef.type,
            size: uploadRef.size
          },
          extraction: await resolveUploadExtraction(uploadRef)
        })
      })

      res.status(202).json({
        success: true,
        requestId,
        async: true,
        statusUrl: `/jobs/${job.jobId}`,
        job
      })
    } catch (error) {
      res.status(error.statusCode || 500).json({
        error: error.message || "Falha ao agendar extracao de upload",
        code: error.code || "UPLOAD_EXTRACTION_ASYNC_FAILED",
        requestId
      })
    }
  })

  app.get("/jobs/:jobId", async (req, res) => {
    const requestId = String(traceStore?.getRequestContext?.(req)?.requestId || buildRequestId("jobstatus"))

    try {
      const job = ensureAsyncJobAccess(req, jobManager.getJob(req.params.jobId))
      res.json({
        success: true,
        requestId,
        job
      })
    } catch (error) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || "Falha ao consultar job",
        code: error.code || "JOB_STATUS_FAILED",
        requestId
      })
    }
  })
}
