import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { askGroot } from "../core/aiBrain.js"
import { aiGateway } from "../core/enterprise/AIGateway.js"
import { fetchBiblePassage } from "../core/bibleApi.js"

dotenv.config()

const app = express()

// Middleware enterprise
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}))

app.use(express.json({ limit: '10mb' })) // Aumentar limite para uploads

// Rate limiting por IP
const ipRequests = new Map()
app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress
  const now = Date.now()
  const window = ipRequests.get(ip) || { start: now, count: 0 }
  
  if (now - window.start > 60000) { // Reset a cada minuto
    ipRequests.set(ip, { start: now, count: 1 })
  } else {
    window.count++
    if (window.count > 1000) { // 1000 req/min por IP
      return res.status(429).json({ 
        error: "Too many requests",
        code: "IP_RATE_LIMIT"
      })
    }
  }
  
  next()
})

// Corrige __dirname no ESModules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Servir interface da IA
app.use(express.static(path.join(__dirname, "../ui")))

// Config público para o frontend (somente chaves seguras)
app.get("/config", (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    features: {
      auth: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
    }
  })
})

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
app.get("/metrics", async (req, res) => {
  try {
    const metrics = aiGateway.metrics.exportMetrics('prometheus')
    res.set('Content-Type', 'text/plain')
    res.send(metrics)
  } catch (error) {
    res.status(500).json({ error: 'Failed to get metrics' })
  }
})

// Logs endpoint
app.get("/logs", (req, res) => {
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
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "../ui/admin.html"))
})

// API principal com contexto enterprise
app.post("/ask", async (req, res) => {
  const requestId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
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

    const answer = await askGroot(question, enhancedContext)
    const responseText = typeof answer === 'string'
      ? answer
      : (answer?.response ?? answer?.answer ?? '')

    if (!responseText) {
      throw new Error("Resposta vazia da IA")
    }

    aiGateway.logger.info(requestId, 'REQUEST_COMPLETED', { 
      responseLength: responseText.length 
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

    if (!passage) {
      return res.status(400).json({
        error: "Passagem não informada. Use ?passage=JHN.3.16",
        code: "MISSING_PASSAGE",
        requestId
      })
    }

    const data = await fetchBiblePassage({ bibleId, passage })

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
