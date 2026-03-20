// Servidor NOVO do GROOT 9.0 - Sem cache
import express from 'express'
import { askGroot } from './grootCore.js'

const app = express()
const PORT = process.env.PORT || 8080

// Corrigir encoding
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Headers para encoding correta
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  next()
})

// Rota raiz - página principal
app.get('/', (req, res) => {
  res.json({
    name: 'GROOT 9.0 Professional',
    status: 'online',
    version: '9.0.0',
    description: 'AI Profissional com Memória Avançada',
    endpoints: {
      health: 'GET /health',
      status: 'GET /status',
      test: 'GET /test',
      ask: 'POST /ask'
    },
    usage: {
      example: 'POST /ask com {"prompt": "sua pergunta"}',
      note: 'Use curl ou Postman para testar'
    },
    timestamp: new Date().toISOString()
  })
})

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '9.0.0',
    timestamp: new Date().toISOString()
  })
})

// Endpoint principal
app.post('/ask', async (req, res) => {
  try {
    const { prompt, context = {} } = req.body

    if (!prompt) {
      return res.status(400).json({
        error: 'Prompt is required',
        example: { prompt: 'Olá, como você está?' }
      })
    }

    console.log(`🌳 [${new Date().toISOString()}] Request: ${prompt.substring(0, 50)}...`)

    const response = await askGroot(prompt, context)

    console.log(`✅ [${new Date().toISOString()}] Response: ${response.success ? 'SUCCESS' : 'FAILED'}`)

    res.json({
      success: true,
      data: response
    })

  } catch (error) {
    console.error('❌ Server Error:', error)

    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// Status endpoint
app.get('/status', async (req, res) => {
  try {
    const { getStatus } = await import('./core/aiBrain.js')
    const status = await getStatus()

    res.json({
      success: true,
      data: status
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Test endpoint
app.get('/test', async (req, res) => {
  try {
    const testPrompt = 'Olá! Apresente-se brevemente.'
    const response = await askGroot(testPrompt)

    res.json({
      success: true,
      test: {
        prompt: testPrompt,
        response: response,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌳 GROOT 9.0 Server running on http://localhost:${PORT}`)
  console.log(`📋 Endpoints disponíveis:`)
  console.log(`   GET  /health  - Health check`)
  console.log(`   GET  /status  - System status`)
  console.log(`   GET  /test    - Test automatic`)
  console.log(`   POST /ask     - Ask GROOT`)
  console.log(`\n🚀 Para testar:`)
  console.log(`   curl http://localhost:${PORT}/test`)
  console.log(`   curl -X POST http://localhost:${PORT}/ask -H "Content-Type: application/json" -d '{"prompt":"Olá!"}'`)
})

export default app
