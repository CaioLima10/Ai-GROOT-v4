import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { existsSync } from "fs"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs/promises"
import crypto from "crypto"
import { askGroot } from "../../../core/aiBrain.js"
import { aiGateway } from "../../../core/enterprise/AIGateway.js"
import { streamingGateway } from "../../../core/enterprise/StreamingAIGateway.js"
import { aiProviders } from "../../../core/aiProviders.js"
import {
  AI_ENTERPRISE_NAME,
  AI_KNOWLEDGE_SERVICE_SLUG,
  AI_MODEL_OWNER,
  AI_SERVICE_SLUG,
  getResearchCapabilities,
  listAssistantProfiles,
  listBibleStudyModules,
  listCompatModels,
  listDomainModules,
  listEvaluationDimensions,
  listEvaluationPacks,
  listPromptPacks,
  resolveCompatModel
} from "../../../packages/shared-config/src/index.js"
import {
  buildAssistantPromptContext,
  evaluateConversationTurn,
  grootAdvancedRAG,
  grootEmbeddings,
  grootMemoryConnector,
  runConversationBenchmark
} from "../../../packages/ai-core/src/index.js"
import { fetchBiblePassage } from "../../../core/bibleApi.js"
import { buildSafetyResponse, detectSafetyRisk } from "../../../core/safetyGuard.js"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import slowDown from "express-slow-down"
import hpp from "hpp"
import compression from "compression"

dotenv.config()

const app = express()
app.disable("x-powered-by")
app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false)

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean)

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (allowedOrigins.length === 0) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    return callback(new Error("Not allowed by CORS"))
  },
  credentials: true
}

// Middleware enterprise
app.use(cors(corsOptions))
app.use(hpp())
app.use(compression({
  filter: (req, res) => {
    if (req.path === "/ask/stream") return false
    return compression.filter(req, res)
  }
}))

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", process.env.SUPABASE_URL || ""].filter(Boolean),
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}))

app.use((req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()")
  next()
})

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_GLOBAL || 600),
  standardHeaders: true,
  legacyHeaders: false
})

const askLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_ASK || 60),
  standardHeaders: true,
  legacyHeaders: false
})

const askSlowDown = slowDown({
  windowMs: 60 * 1000,
  delayAfter: Number(process.env.SLOWDOWN_AFTER || 30),
  delayMs: () => Number(process.env.SLOWDOWN_DELAY_MS || 350)
})

app.use(globalLimiter)
app.use(express.json({ limit: process.env.REQUEST_LIMIT || "4mb", strict: true }))

// Corrige __dirname no ESModules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const WEB_PUBLIC_DIR = existsSync(path.resolve(__dirname, "../../web/public"))
  ? path.resolve(__dirname, "../../web/public")
  : path.resolve(__dirname, "../../../ui")

const UPLOAD_DIR = path.join(process.cwd(), "tmp_uploads")
const uploads = new Map()
const uploadTtlMinutes = Number(process.env.UPLOAD_TTL_MINUTES || 10)
const uploadMaxBytes = Number(process.env.UPLOAD_MAX_BYTES || 2_000_000)
const uploadTextLimit = Number(process.env.UPLOAD_TEXT_LIMIT || 12000)
const uploadOcrEnabled = process.env.UPLOAD_OCR_ENABLED === "true"
const uploadOcrLang = process.env.OCR_LANG || "eng"
const uploadOcrTextLimit = Number(process.env.OCR_TEXT_LIMIT || 8000)
const uploadPdfTextLimit = Number(process.env.UPLOAD_PDF_TEXT_LIMIT || uploadTextLimit)
const imageGenerationModel = process.env.HUGGINGFACE_IMAGE_MODEL || "black-forest-labs/FLUX.1-schnell"
const SUPPORTED_UPLOAD_ACCEPT = [
  "image/*",
  ".pdf",
  ".txt",
  ".md",
  ".json",
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".html",
  ".css",
  ".csv",
  ".sql"
]

function getImageGenerationToken() {
  return process.env.HUGGINGFACE_API_KEY ||
    process.env.HF_API_KEY ||
    process.env.HUGGINGFACEHUB_API_TOKEN ||
    null
}

function isImageGenerationEnabled() {
  return Boolean(getImageGenerationToken())
}

function getUploadCapabilities() {
  return {
    accept: SUPPORTED_UPLOAD_ACCEPT,
    supportedKinds: [
      "text",
      "code",
      "pdf",
      uploadOcrEnabled ? "image_ocr" : "image"
    ],
    supports: {
      text: true,
      code: true,
      pdf: true,
      image: true,
      ocr: uploadOcrEnabled
    }
  }
}

async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
  } catch (error) {
    console.error("❌ Falha ao criar pasta de uploads:", error.message)
  }
}

function scheduleUploadCleanup(id) {
  const entry = uploads.get(id)
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

function safeFilename(name) {
  return String(name || "upload")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120)
}

function isTextLike(name, type) {
  if (type && type.startsWith("text/")) return true
  const lower = String(name || "").toLowerCase()
  return [
    ".txt", ".md", ".json", ".yaml", ".yml", ".csv", ".log",
    ".js", ".ts", ".tsx", ".jsx", ".py", ".java", ".go", ".rs",
    ".c", ".cpp", ".h", ".cs", ".php", ".rb", ".sql", ".xml", ".html", ".css"
  ].some(ext => lower.endsWith(ext))
}

function isImageLike(name, type) {
  if (type && type.startsWith("image/")) return true
  const lower = String(name || "").toLowerCase()
  return [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"].some(ext => lower.endsWith(ext))
}

function isPdfLike(name, type) {
  if (type === "application/pdf") return true
  const lower = String(name || "").toLowerCase()
  return lower.endsWith(".pdf")
}

async function extractTextFromImage(filePath) {
  if (!uploadOcrEnabled) return null
  try {
    const { createWorker } = await import("tesseract.js")
    const worker = await createWorker({ logger: () => {} })
    await worker.loadLanguage(uploadOcrLang)
    await worker.initialize(uploadOcrLang)
    const { data } = await worker.recognize(filePath)
    await worker.terminate()

    const text = String(data?.text || "").trim()
    if (!text) return null

    if (text.length > uploadOcrTextLimit) {
      return `${text.slice(0, uploadOcrTextLimit)}\n... (truncado)`
    }

    return text
  } catch (error) {
    console.error("❌ OCR falhou:", error.message)
    return null
  }
}

async function extractTextFromPdf(filePath) {
  try {
    const pdfParseModule = await import("pdf-parse")
    const pdfParse = pdfParseModule.default || pdfParseModule
    const buffer = await fs.readFile(filePath)
    const parsed = await pdfParse(buffer)
    const text = String(parsed?.text || "")
      .replace(/\u0000/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()

    if (!text) return null

    if (text.length > uploadPdfTextLimit) {
      return `${text.slice(0, uploadPdfTextLimit)}\n... (truncado)`
    }

    return text
  } catch (error) {
    console.error("❌ Leitura de PDF falhou:", error.message)
    return null
  }
}

async function generateImageWithProvider(prompt, options = {}) {
  const token = getImageGenerationToken()
  if (!token) {
    const error = new Error("Geração de imagens não configurada. Defina HUGGINGFACE_API_KEY no ambiente.")
    error.statusCode = 503
    error.code = "IMAGE_GENERATION_DISABLED"
    throw error
  }

  const { HfInference } = await import("@huggingface/inference")
  const client = new HfInference(token)
  const image = await client.textToImage({
    model: imageGenerationModel,
    inputs: prompt,
    parameters: {
      negative_prompt: options.negativePrompt || "blurry, deformed, low quality, watermark, unreadable text"
    }
  })

  const mimeType = image?.type || "image/png"
  const buffer = Buffer.from(await image.arrayBuffer())

  return {
    mimeType,
    base64: buffer.toString("base64"),
    model: imageGenerationModel
  }
}

function flattenMessageContent(content) {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""

  return content
    .map(item => {
      if (typeof item === "string") return item
      if (item?.text) return item.text
      if (item?.type === "input_text" && item?.text) return item.text
      return ""
    })
    .filter(Boolean)
    .join("\n")
}

function buildQuestionFromMessages(messages = []) {
  if (!Array.isArray(messages) || messages.length === 0) return ""

  const transcript = messages
    .map(message => {
      const content = flattenMessageContent(message?.content)
      if (!content) return ""
      return `${message.role || "user"}: ${content}`
    })
    .filter(Boolean)
    .join("\n")

  const lastUserMessage = [...messages]
    .reverse()
    .find(message => message?.role === "user")

  const lastUserText = flattenMessageContent(lastUserMessage?.content)
  if (!transcript) return lastUserText

  return [
    "Considere o historico abaixo e responda a ultima mensagem do usuario.",
    transcript,
    "",
    "Ultima mensagem do usuario:",
    lastUserText || transcript
  ].join("\n")
}

function buildQuestionFromGeminiContents(contents = []) {
  if (typeof contents === "string") return contents
  if (!Array.isArray(contents)) return ""

  const lines = contents.map(item => {
    const parts = Array.isArray(item?.parts) ? item.parts : []
    const text = parts
      .map(part => part?.text || "")
      .filter(Boolean)
      .join("\n")

    if (!text) return ""
    return `${item?.role || "user"}: ${text}`
  }).filter(Boolean)

  return lines.join("\n")
}

function getCompatContext(modelId, extras = {}) {
  const preset = resolveCompatModel(modelId)
  return {
    assistantProfile: preset.profile,
    activeModules: preset.modules,
    bibleStudyModules: preset.bibleStudyModules || [],
    ...extras
  }
}

function estimateUsage(text = "") {
  const outputTokens = Math.max(1, Math.ceil(String(text || "").length / 4))
  return {
    prompt_tokens: 0,
    completion_tokens: outputTokens,
    total_tokens: outputTokens
  }
}

function normalizeAnswerText(answer) {
  const responseText = typeof answer === "string"
    ? answer
    : (answer?.response ?? answer?.answer ?? "")

  return String(responseText || "").trim()
}

async function askGiom(question, context = {}) {
  const answer = await askGroot(question, context)
  const responseText = normalizeAnswerText(answer)

  if (!responseText) {
    throw new Error("Resposta vazia da IA")
  }

  return responseText
}

async function persistEvaluationArtifacts(userId, requestId, evaluation, metadata = {}) {
  await grootMemoryConnector.saveEvaluation(userId, requestId, evaluation)
  await grootMemoryConnector.saveLearningPattern(
    userId,
    "conversation_eval",
    {
      requestId,
      score: evaluation.score,
      status: evaluation.status,
      issues: evaluation.issues,
      dimensions: evaluation.dimensions,
      metadata
    },
    evaluation.score
  )
}

function writeSSE(res, event, payload) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

async function buildPreparedAskPayload(req, requestId) {
  const { question, context = {} } = req.body || {}

  if (!question) {
    const error = new Error("Pergunta vazia")
    error.statusCode = 400
    error.code = "EMPTY_QUESTION"
    throw error
  }

  if (question.length > 50000) {
    const error = new Error("Pergunta muito longa (máx 50.000 caracteres)")
    error.statusCode = 400
    error.code = "QUESTION_TOO_LONG"
    throw error
  }

  let finalQuestion = question
  const uploadId = context?.uploadId
  const uploadEntry = uploadId ? uploads.get(uploadId) : null
  if (uploadEntry) {
    const label = `\n\n[Arquivo enviado: ${uploadEntry.name} | tipo: ${uploadEntry.type}]`
    if (isTextLike(uploadEntry.name, uploadEntry.type)) {
      try {
        const raw = await fs.readFile(uploadEntry.path, "utf8")
        const snippet = raw.length > uploadTextLimit
          ? `${raw.slice(0, uploadTextLimit)}\n... (truncado)`
          : raw
        finalQuestion += `${label}\n${snippet}`
      } catch {
        finalQuestion += `${label}\n(erro ao ler o arquivo)`
      }
    } else if (isPdfLike(uploadEntry.name, uploadEntry.type)) {
      const pdfText = await extractTextFromPdf(uploadEntry.path)
      if (pdfText) {
        finalQuestion += `${label}\nTexto extraído do PDF:\n${pdfText}`
      } else {
        finalQuestion += `${label}\n(PDF recebido, mas não consegui extrair texto útil)`
      }
    } else if (isImageLike(uploadEntry.name, uploadEntry.type)) {
      const ocrText = await extractTextFromImage(uploadEntry.path)
      if (ocrText) {
        finalQuestion += `${label}\nTexto extraído (OCR):\n${ocrText}`
      } else {
        finalQuestion += `${label}\n(Imagem recebida, OCR desativado ou sem texto)`
      }
    } else {
      finalQuestion += `${label}\n(Leitura de imagens/arquivos binários ainda não habilitada)`
    }

    if (finalQuestion.length > 50000) {
      finalQuestion = finalQuestion.slice(0, 50000)
    }
  }

  const userId = req.get("X-User-Id") || req.ip || "default_user"
  const enhancedContext = {
    ...context,
    userAgent: req.get("User-Agent"),
    ip: req.ip,
    userId,
    researchCapabilities: getResearchCapabilities(context?.researchCapabilities || {}),
    timestamp: new Date().toISOString(),
    requestId
  }

  return {
    question,
    finalQuestion,
    enhancedContext,
    userId,
    uploadEntry
  }
}

async function buildStreamingPromptPackage(question, context = {}) {
  return buildAssistantPromptContext(question, context, {
    limit: 6,
    userStyle: "natural"
  })
}

// Servir interface da IA
app.use(express.static(WEB_PUBLIC_DIR))

// Config público para o frontend (somente chaves seguras)
app.get("/config", async (req, res) => {
  const knowledgeStats = await grootAdvancedRAG.getAdvancedStats()

  res.json({
    service: AI_SERVICE_SLUG,
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    adminProtected: !!process.env.ADMIN_DASH_KEY,
    features: {
      auth: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
      localModels: process.env.OLLAMA_ENABLED === "true",
      futureOpenAIReady: true,
      streaming: true,
      pdfParsing: true,
      imageGeneration: isImageGenerationEnabled()
    },
    ai: {
      providerMode: process.env.GROOT_AI_PROVIDER || "auto",
      modelTier: process.env.GROOT_MODEL_TIER || "balanced",
      providers: aiProviders.getProviderSummary(),
      embeddings: grootEmbeddings.getStatus(),
      assistantProfiles: listAssistantProfiles(),
      domainModules: listDomainModules(),
      bibleStudyModules: listBibleStudyModules(),
      compatModels: listCompatModels(),
      promptPacks: listPromptPacks(),
      imageGeneration: {
        enabled: isImageGenerationEnabled(),
        provider: isImageGenerationEnabled() ? "huggingface" : "disabled",
        model: imageGenerationModel
      }
    },
    research: getResearchCapabilities(),
    safety: {
      explicitSexualContentBlocked: true,
      crimesBlocked: true,
      cyberAbuseBlocked: true,
      selfHarmSupport: true
    },
    evaluation: {
      dimensions: listEvaluationDimensions(),
      packs: listEvaluationPacks(),
      note: "Consciencia operacional mede autodescricao correta de capacidades e limites, nao sentiencia real."
    },
    knowledge: {
      statusEndpoint: "/knowledge/status",
      localKnowledge: knowledgeStats.localKnowledge,
      localBugs: knowledgeStats.localBugs,
      remoteEnabled: knowledgeStats.remoteEnabled
    },
    uploads: {
      enabled: true,
      maxBytes: uploadMaxBytes,
      ttlMinutes: uploadTtlMinutes,
      ...getUploadCapabilities()
    }
  })
})

app.get("/knowledge/status", async (_req, res) => {
  try {
    const stats = await grootAdvancedRAG.getAdvancedStats()
    res.json({
      service: AI_KNOWLEDGE_SERVICE_SLUG,
      stats,
      bibleStudyModules: listBibleStudyModules()
    })
  } catch (error) {
    res.status(500).json({
      error: "Falha ao obter status da base de conhecimento",
      details: process.env.NODE_ENV === "development" ? error.message : undefined
    })
  }
})

app.get("/v1/models", (_req, res) => {
  res.json({
    object: "list",
    data: listCompatModels().map(model => ({
      id: model.id,
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: AI_MODEL_OWNER
    }))
  })
})

app.post("/v1/chat/completions", async (req, res) => {
  try {
    const { model = "groot-1-free", messages = [] } = req.body || {}
    const preset = resolveCompatModel(model)
    const question = buildQuestionFromMessages(messages)

    if (!question) {
      return res.status(400).json({ error: { message: "messages vazio", type: "invalid_request_error" } })
    }

    const answer = await askGroot(question, getCompatContext(model, {
      requestId: `compat_${Date.now()}`,
      assistantProfile: preset.profile,
      activeModules: preset.modules
    }))

    const responseText = typeof answer === "string"
      ? answer
      : (answer?.response ?? answer?.answer ?? "")

    res.json({
      id: `chatcmpl_${crypto.randomUUID()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: responseText
          },
          finish_reason: "stop"
        }
      ],
      usage: estimateUsage(responseText)
    })
  } catch (error) {
    res.status(500).json({
      error: {
        message: error.message,
        type: "server_error"
      }
    })
  }
})

app.post("/v1/responses", async (req, res) => {
  try {
    const { model = "groot-1-free", input = "", instructions = "" } = req.body || {}
    const preset = resolveCompatModel(model)
    const question = Array.isArray(input)
      ? input
          .map(item => typeof item === "string" ? item : flattenMessageContent(item?.content || item?.text || ""))
          .join("\n")
      : String(input || "")

    if (!question.trim()) {
      return res.status(400).json({ error: { message: "input vazio", type: "invalid_request_error" } })
    }

    const answer = await askGroot(question, getCompatContext(model, {
      requestId: `resp_${Date.now()}`,
      assistantProfile: preset.profile,
      activeModules: preset.modules,
      instructions
    }))

    const responseText = typeof answer === "string"
      ? answer
      : (answer?.response ?? answer?.answer ?? "")

    res.json({
      id: `resp_${crypto.randomUUID()}`,
      object: "response",
      created_at: Math.floor(Date.now() / 1000),
      status: "completed",
      model,
      output_text: responseText,
      output: [
        {
          id: `msg_${crypto.randomUUID()}`,
          type: "message",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: responseText,
              annotations: []
            }
          ]
        }
      ],
      usage: estimateUsage(responseText)
    })
  } catch (error) {
    res.status(500).json({
      error: {
        message: error.message,
        type: "server_error"
      }
    })
  }
})

app.post(/^\/v1beta\/models\/([^:]+):generateContent$/, async (req, res) => {
  try {
    const model = req.params[0] || "groot-1-free"
    const question = buildQuestionFromGeminiContents(req.body?.contents || [])
    const systemInstruction = Array.isArray(req.body?.systemInstruction?.parts)
      ? req.body.systemInstruction.parts.map(part => part?.text || "").filter(Boolean).join("\n")
      : ""

    if (!question.trim()) {
      return res.status(400).json({ error: { message: "contents vazio", status: "INVALID_ARGUMENT" } })
    }

    const answer = await askGroot(question, getCompatContext(model, {
      requestId: `gem_${Date.now()}`,
      instructions: systemInstruction
    }))

    const responseText = typeof answer === "string"
      ? answer
      : (answer?.response ?? answer?.answer ?? "")

    res.json({
      candidates: [
        {
          index: 0,
          content: {
            role: "model",
            parts: [{ text: responseText }]
          },
          finishReason: "STOP"
        }
      ],
      usageMetadata: {
        promptTokenCount: 0,
        candidatesTokenCount: Math.max(1, Math.ceil(responseText.length / 4)),
        totalTokenCount: Math.max(1, Math.ceil(responseText.length / 4))
      },
      modelVersion: model
    })
  } catch (error) {
    res.status(500).json({
      error: {
        message: error.message,
        status: "INTERNAL"
      }
    })
  }
})

const requireAdmin = (req, res, next) => {
  const adminKey = process.env.ADMIN_DASH_KEY
  if (!adminKey) return next()
  const provided = req.get('X-Admin-Key') || req.query.key
  if (provided && provided === adminKey) return next()
  return res.status(401).json({ error: "Unauthorized", code: "ADMIN_REQUIRED" })
}

// Health check enterprise
app.get("/health", async (req, res) => {
  try {
    const health = await aiGateway.getHealthStatus()
    const knowledge = await grootAdvancedRAG.getAdvancedStats()
    res.json({
      status: 'healthy',
      service: AI_SERVICE_SLUG,
      version: '2.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      knowledge,
      ...health
    })
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    })
  }
})

// Metrics endpoint (Prometheus compatible)
app.get("/metrics", requireAdmin, async (req, res) => {
  try {
    const metrics = aiGateway.metrics.exportMetrics('prometheus')
    res.set('Content-Type', 'text/plain')
    res.send(metrics)
  } catch (error) {
    res.status(500).json({ error: 'Failed to get metrics' })
  }
})

app.get("/metrics/json", requireAdmin, (req, res) => {
  try {
    res.json({
      summary: aiGateway.metrics.getSummary(),
      providers: aiGateway.metrics.getProviderStats(),
      errors: aiGateway.metrics.getErrorSummary(),
      topUsers: aiGateway.metrics.getTopUsers(5)
    })
  } catch (error) {
    res.status(500).json({ error: "Failed to get metrics" })
  }
})

// Logs endpoint
app.get("/logs", requireAdmin, (req, res) => {
  try {
    const filter = {
      level: req.query.level,
      requestId: req.query.requestId,
      event: req.query.event,
      since: req.query.since,
      until: req.query.until
    }
    
    const logs = aiGateway.logger.getLogs(filter)
    res.json({ logs, summary: aiGateway.logger.getLogSummary() })
  } catch (error) {
    res.status(500).json({ error: 'Failed to get logs' })
  }
})

// Admin dashboard
app.get("/admin", requireAdmin, (req, res) => {
  res.sendFile(path.join(WEB_PUBLIC_DIR, "admin.html"))
})

// Upload temporário (armazenamento local, auto-delete)
app.post("/upload", async (req, res) => {
  try {
    const { name, type, data } = req.body || {}
    if (!name || !data) {
      return res.status(400).json({ error: "Arquivo inválido", code: "INVALID_UPLOAD" })
    }

    const buffer = Buffer.from(String(data), "base64")
    if (!buffer || !buffer.length) {
      return res.status(400).json({ error: "Conteúdo vazio", code: "EMPTY_UPLOAD" })
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
    const filePath = path.join(UPLOAD_DIR, `${id}_${safeName}`)

    await fs.writeFile(filePath, buffer)

    const expiresAt = Date.now() + uploadTtlMinutes * 60 * 1000
    uploads.set(id, {
      id,
      name: safeName,
      type: type || "application/octet-stream",
      path: filePath,
      size: buffer.length,
      expiresAt
    })
    scheduleUploadCleanup(id)

    res.json({
      id,
      name: safeName,
      type: type || "application/octet-stream",
      size: buffer.length,
      expiresAt
    })
  } catch (error) {
    console.error("❌ Falha no upload:", error.message)
    res.status(500).json({ error: "Falha ao salvar arquivo", code: "UPLOAD_FAILED" })
  }
})

app.post("/generate/image", askLimiter, askSlowDown, async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim()
    const style = String(req.body?.style || "").trim()
    const locale = String(req.body?.locale || "pt-BR")

    if (!prompt) {
      return res.status(400).json({ error: "Prompt de imagem vazio", code: "EMPTY_IMAGE_PROMPT" })
    }

    const safety = detectSafetyRisk(prompt)
    if (safety.triggered) {
      return res.status(400).json({
        error: buildSafetyResponse(safety, { locale }),
        code: "IMAGE_PROMPT_BLOCKED",
        safety
      })
    }

    const fullPrompt = [prompt, style ? `Style guidance: ${style}` : ""]
      .filter(Boolean)
      .join("\n")

    const image = await generateImageWithProvider(fullPrompt)

    res.json({
      success: true,
      image
    })
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.message || "Falha ao gerar imagem",
      code: error.code || "IMAGE_GENERATION_FAILED"
    })
  }
})

// API principal com contexto enterprise
app.post("/ask", askLimiter, askSlowDown, async (req, res) => {
  const requestId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()
  
  try {
    const {
      question,
      finalQuestion,
      enhancedContext,
      userId
    } = await buildPreparedAskPayload(req, requestId)

    aiGateway.logger.info(requestId, 'REQUEST_STARTED', { 
      questionLength: question.length,
      context: Object.keys(enhancedContext)
    })

    const answer = await askGroot(finalQuestion, enhancedContext)
    const responseText = typeof answer === 'string'
      ? answer
      : (answer?.response ?? answer?.answer ?? '')

    if (!responseText) {
      throw new Error("Resposta vazia da IA")
    }

    aiGateway.logger.info(requestId, 'REQUEST_COMPLETED', { 
      responseLength: responseText.length 
    })

    aiGateway.metrics.recordRequest(requestId, Date.now() - startTime, true)
    aiGateway.metrics.recordUserActivity(userId, "ask", {
      length: question.length
    })

    res.json({
      success: true,
      data: {
        response: responseText
      },
      response: responseText,
      answer: responseText,
      requestId,
      metadata: {
        processingTime: Date.now() - startTime,
        version: '2.0.0'
      }
    })

  } catch (error) {
    aiGateway.logger.error(requestId, 'REQUEST_FAILED', { 
      error: error.message,
      stack: error.stack
    })

    aiGateway.metrics.recordRequest(requestId, Date.now() - startTime, false)
    aiGateway.metrics.recordError("ask_error", error, { requestId })

    const statusCode = error.statusCode || error.response?.status || 500
    const errorCode = error.code || "INTERNAL_ERROR"

    res.status(statusCode).json({
      error: "Erro ao processar sua pergunta",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
      code: errorCode,
      requestId
    })
  }
})

app.post("/ask/stream", askLimiter, askSlowDown, async (req, res) => {
  const requestId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()
  let hasCompleted = false

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8")
  res.setHeader("Cache-Control", "no-cache, no-transform")
  res.setHeader("Connection", "keep-alive")
  res.setHeader("X-Accel-Buffering", "no")
  res.flushHeaders?.()

  try {
    const {
      question,
      finalQuestion,
      enhancedContext,
      userId
    } = await buildPreparedAskPayload(req, requestId)

    const { promptPackage } = await buildStreamingPromptPackage(finalQuestion, enhancedContext)

    aiGateway.logger.info(requestId, "STREAM_REQUEST_STARTED", {
      questionLength: question.length,
      context: Object.keys(enhancedContext)
    })

    writeSSE(res, "meta", {
      requestId,
      providerMode: process.env.GROOT_AI_PROVIDER || "auto"
    })

    await streamingGateway.askStreaming(
      finalQuestion,
      {
        systemPrompt: promptPackage.systemPrompt
      },
      (payload) => {
        writeSSE(res, "chunk", payload)
      },
      async (payload) => {
        hasCompleted = true
        const responseText = String(payload?.fullText || "").trim()

        if (!responseText) {
          writeSSE(res, "error", {
            requestId,
            error: "Resposta vazia da IA"
          })
          res.end()
          return
        }

        await grootMemoryConnector.saveConversation(userId, question, responseText, {
          provider: payload?.provider || "streaming_gateway",
          requestId,
          assistantProfile: promptPackage.profileId,
          activeModules: promptPackage.activeModules,
          bibleStudyModules: promptPackage.bibleStudyModules,
          promptPacks: promptPackage.promptPacks,
          streaming: true
        })

        aiGateway.metrics.recordRequest(requestId, Date.now() - startTime, true)
        aiGateway.metrics.recordUserActivity(userId, "ask_stream", {
          length: question.length
        })

        aiGateway.logger.info(requestId, "STREAM_REQUEST_COMPLETED", {
          responseLength: responseText.length
        })

        writeSSE(res, "complete", {
          requestId,
          response: responseText,
          metadata: {
            processingTime: Date.now() - startTime,
            provider: payload?.provider || "streaming_gateway"
          }
        })
        res.end()
      },
      (payload) => {
        aiGateway.metrics.recordRequest(requestId, Date.now() - startTime, false)
        aiGateway.metrics.recordError("ask_stream_error", new Error(payload?.error || "streaming_error"), { requestId })
        writeSSE(res, "error", {
          requestId,
          error: payload?.error || "Falha no streaming"
        })
        res.end()
      }
    )
  } catch (error) {
    if (!hasCompleted) {
      aiGateway.logger.error(requestId, "STREAM_REQUEST_FAILED", {
        error: error.message,
        stack: error.stack
      })
      writeSSE(res, "error", {
        requestId,
        error: error.message || "Falha ao processar streaming",
        code: error.code || "STREAM_FAILED"
      })
      res.end()
    }
  }
})

// Feedback explícito do usuário
app.post("/feedback", async (req, res) => {
  try {
    const { requestId, rating, comment } = req.body || {}
    if (!requestId || typeof rating !== "number") {
      return res.status(400).json({ error: "Feedback inválido", code: "INVALID_FEEDBACK" })
    }

    const userId = req.get('X-User-Id') || req.ip || 'default_user'
    await grootMemoryConnector.saveFeedback(userId, requestId, rating, comment)

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: "Falha ao salvar feedback" })
  }
})

app.get("/evaluation/packs", requireAdmin, (_req, res) => {
  res.json({
    dimensions: listEvaluationDimensions(),
    packs: listEvaluationPacks(),
    note: "Consciencia operacional avalia honestidade sobre capacidades e limites, sem alegar consciencia real."
  })
})

app.post("/evaluation/conversation", requireAdmin, async (req, res) => {
  const requestId = `eval_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  try {
    const { message, context = {}, history = [], tags = [], sessionId } = req.body || {}

    if (!message || !String(message).trim()) {
      return res.status(400).json({
        error: "Mensagem obrigatoria para avaliacao",
        code: "EVAL_MESSAGE_REQUIRED"
      })
    }

    const evaluationUserId = String(sessionId || req.get("X-User-Id") || req.ip || "evaluation_user")
    const researchCapabilities = getResearchCapabilities(context?.researchCapabilities || {})
    const preparedContext = {
      ...context,
      userId: evaluationUserId,
      requestId,
      evaluationMode: true,
      conversationHistory: Array.isArray(history) ? history : [],
      researchCapabilities
    }

    const responseText = await askGiom(String(message), preparedContext)
    const evaluation = evaluateConversationTurn({
      userMessage: String(message),
      aiResponse: responseText,
      history: Array.isArray(history) ? history : [],
      researchCapabilities,
      tags: Array.isArray(tags) ? tags : []
    })

    await persistEvaluationArtifacts(evaluationUserId, requestId, evaluation, {
      mode: "conversation_lab",
      contextKeys: Object.keys(context || {}),
      tags: Array.isArray(tags) ? tags : []
    })

    res.json({
      success: true,
      requestId,
      sessionId: evaluationUserId,
      response: responseText,
      evaluation,
      capabilities: {
        research: researchCapabilities
      }
    })
  } catch (error) {
    aiGateway.logger.error(requestId, "EVALUATION_CONVERSATION_FAILED", {
      error: error.message
    })
    res.status(500).json({
      error: "Falha ao avaliar conversa",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
      code: "EVALUATION_FAILED",
      requestId
    })
  }
})

app.post("/evaluation/run", requireAdmin, async (req, res) => {
  const benchmarkId = `benchmark_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  try {
    const { packId = "core_diagnostics" } = req.body || {}
    const benchmarkUserId = `${benchmarkId}_user`

    const benchmark = await runConversationBenchmark({
      packId,
      researchCapabilities: getResearchCapabilities(),
      requestTurn: async ({ scenario, turn, history }) => {
        const requestId = `bench_${scenario.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const context = {
          ...(turn.context || {}),
          userId: benchmarkUserId,
          requestId,
          evaluationMode: true,
          evaluationScenario: scenario.id,
          conversationHistory: history,
          researchCapabilities: getResearchCapabilities(turn.context?.researchCapabilities || {})
        }

        const answer = await askGiom(turn.question, context)
        return {
          answer,
          requestId
        }
      }
    })

    for (const turn of benchmark.turns) {
      const evaluationRequestId = turn.metadata?.requestId || `${benchmarkId}_${turn.scenarioId}`
      await persistEvaluationArtifacts(benchmarkUserId, evaluationRequestId, turn.evaluation, {
        mode: "benchmark_turn",
        packId,
        scenarioId: turn.scenarioId
      })
    }

    await grootMemoryConnector.saveLearningPattern(
      benchmarkUserId,
      "conversation_benchmark_summary",
      {
        benchmarkId,
        packId,
        summary: benchmark.summary,
        turns: benchmark.turns.map((turn) => ({
          scenarioId: turn.scenarioId,
          score: turn.evaluation.score,
          issues: turn.evaluation.issues
        }))
      },
      benchmark.summary.score
    )

    res.json({
      success: true,
      benchmarkId,
      sessionId: benchmarkUserId,
      ...benchmark
    })
  } catch (error) {
    aiGateway.logger.error(benchmarkId, "BENCHMARK_FAILED", {
      error: error.message
    })
    res.status(500).json({
      error: "Falha ao rodar benchmark do GIOM",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
      code: "BENCHMARK_FAILED",
      benchmarkId
    })
  }
})

// Endpoints avançados para developers
app.post("/analyze", async (req, res) => {
  const requestId = `analyze_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    const { code, language, type = 'general' } = req.body

    if (!code) {
      return res.status(400).json({ error: "Código não fornecido" })
    }

    const context = {
      fileInfo: {
        language,
        type
      },
      analysis: true
    }

    const question = `Analise este código ${language}: ${code.substring(0, 10000)}`
    const answer = await askGroot(question, context)

    res.json({ 
      analysis: answer,
      requestId,
      metadata: {
        codeLength: code.length,
        language,
        type
      }
    })

  } catch (error) {
    aiGateway.logger.error(requestId, 'ANALYSIS_FAILED', { error: error.message })
    res.status(500).json({ error: "Falha na análise" })
  }
})

// Code review endpoint
app.post("/review", async (req, res) => {
  const requestId = `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    const { code, language, guidelines = [] } = req.body

    if (!code) {
      return res.status(400).json({ error: "Código não fornecido" })
    }

    const context = {
      fileInfo: {
        language,
        type: 'review'
      },
      review: true,
      guidelines
    }

    const question = `Faça um code review deste código ${language}, seguindo estas diretrizes: ${guidelines.join(', ')}\n\nCódigo:\n${code}`
    const answer = await askGroot(question, context)

    res.json({ 
      review: answer,
      requestId,
      metadata: {
        codeLength: code.length,
        language,
        guidelinesCount: guidelines.length
      }
    })

  } catch (error) {
    aiGateway.logger.error(requestId, 'REVIEW_FAILED', { error: error.message })
    res.status(500).json({ error: "Falha no code review" })
  }
})

// Bible API (YouVersion Platform) - requer YVP_APP_KEY
app.get("/bible/passage", async (req, res) => {
  const requestId = `bible_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    const passage = String(req.query.passage || '').trim()
    const bibleId = String(req.query.bibleId || '').trim()
    const bibleCode = String(req.query.bibleCode || '').trim()

    if (!passage) {
      return res.status(400).json({
        error: "Passagem não informada. Use ?passage=JHN.3.16",
        code: "MISSING_PASSAGE",
        requestId
      })
    }

    const data = await fetchBiblePassage({ bibleId, bibleCode, passage })

    res.json({
      data,
      source: "youversion",
      requestId
    })
  } catch (error) {
    res.status(500).json({
      error: "Falha ao consultar a Bíblia",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
      code: "BIBLE_API_ERROR",
      requestId
    })
  }
})

const PORT = process.env.PORT || 3000

const server = app.listen(PORT, () => {
  console.log(`🚀 ${AI_ENTERPRISE_NAME} rodando em http://localhost:${PORT}`)
  console.log(`📊 Metrics: http://localhost:${PORT}/metrics`)
  console.log(`📋 Logs: http://localhost:${PORT}/logs`)
  console.log(`🔧 Admin: http://localhost:${PORT}/admin`)
})

// Graceful shutdown enterprise
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM recebido, encerrando servidor enterprise...')
  server.close(() => {
    console.log('✅ Servidor encerrado')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('\n🔄 SIGINT recebido, encerrando servidor enterprise...')
  server.close(() => {
    console.log('✅ Servidor encerrado')
    process.exit(0)
  })
})

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
  process.exit(1)
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Porta ${PORT} já está em uso.`)
    console.error(`   Tente: npx kill-port ${PORT}`)
  } else {
    console.error('❌ Erro no servidor:', error)
  }
  process.exit(1)
})
