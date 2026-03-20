import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs/promises"
import crypto from "crypto"
import { askGroot } from "../core/aiBrain.js"
import { aiGateway } from "../core/enterprise/AIGateway.js"
import { fetchBiblePassage } from "../core/bibleApi.js"
import { grootMemoryConnector } from "../core/grootMemoryConnector.js"
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
app.use(compression())

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
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
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
  delayMs: Number(process.env.SLOWDOWN_DELAY_MS || 350)
})

app.use(globalLimiter)
app.use(express.json({ limit: process.env.REQUEST_LIMIT || "4mb", strict: true }))

// Corrige __dirname no ESModules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const UPLOAD_DIR = path.join(process.cwd(), "tmp_uploads")
const uploads = new Map()
const uploadTtlMinutes = Number(process.env.UPLOAD_TTL_MINUTES || 10)
const uploadMaxBytes = Number(process.env.UPLOAD_MAX_BYTES || 2_000_000)
const uploadTextLimit = Number(process.env.UPLOAD_TEXT_LIMIT || 12000)
const uploadOcrEnabled = process.env.UPLOAD_OCR_ENABLED === "true"
const uploadOcrLang = process.env.OCR_LANG || "eng"
const uploadOcrTextLimit = Number(process.env.OCR_TEXT_LIMIT || 8000)

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

// Servir interface da IA
app.use(express.static(path.join(__dirname, "../ui")))

// Config público para o frontend (somente chaves seguras)
app.get("/config", (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    adminProtected: !!process.env.ADMIN_DASH_KEY,
    features: {
      auth: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
    }
  })
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
    res.json({
      status: 'healthy',
      service: 'ai-groot-enterprise',
      version: '2.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
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
  res.sendFile(path.join(__dirname, "../ui/admin.html"))
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

// API principal com contexto enterprise
app.post("/ask", askLimiter, askSlowDown, async (req, res) => {
  const requestId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()
  
  try {
    const { question, context = {} } = req.body

    if (!question) {
      return res.status(400).json({ 
        error: "Pergunta vazia",
        code: "EMPTY_QUESTION",
        requestId
      })
    }

    if (question.length > 50000) {
      return res.status(400).json({ 
        error: "Pergunta muito longa (máx 50.000 caracteres)",
        code: "QUESTION_TOO_LONG",
        requestId
      })
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
        } catch (error) {
          finalQuestion += `${label}\n(erro ao ler o arquivo)`
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

    // Extrair headers de contexto
    const userId = req.get('X-User-Id') || req.ip || 'default_user'

    const enhancedContext = {
      ...context,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId,
      timestamp: new Date().toISOString(),
      requestId
    }

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
      response: responseText,
      answer: responseText,
      requestId,
      metadata: {
        processingTime: Date.now(),
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

    const statusCode = error.response?.status || 500
    const errorCode = error.code || "INTERNAL_ERROR"

    res.status(statusCode).json({
      error: "Erro ao processar sua pergunta",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
      code: errorCode,
      requestId
    })
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
  console.log(`🚀 Ai-GROOT Enterprise rodando em http://localhost:${PORT}`)
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
