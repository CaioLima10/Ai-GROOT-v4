// SERVIDOR SIMPLES DIRETO - SOLUÇÃO DEFINITIVA
// Sem auto-detecção complexa, porta fixa com fallback

import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { askGroot } from './groot-quantum.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('🚀 INICIANDO SERVIDOR SIMPLES GROOT 9.0')

const app = express()

// Middleware essencial
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
  next()
})

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'ui')))

// Rota raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'ui', 'index.html'))
})

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '9.0.0',
    timestamp: new Date().toISOString()
  })
})

// API do GROOT
app.post('/ask', async (req, res) => {
  try {
    const { question, prompt } = req.body
    const userPrompt = question || prompt

    if (!userPrompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt é obrigatório'
      })
    }

    console.log(`🌳 Pergunta: ${userPrompt.substring(0, 100)}...`)

    const response = await askGroot(userPrompt)

    console.log(`✅ Resposta: ${response.success ? 'SUCCESS' : 'FAILED'}`)

    // Retornar a resposta completa do GROOT Quântico
    res.json(response)

  } catch (error) {
    console.error('❌ Erro:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno',
      details: error.message
    })
  }
})

// Tentar portas em ordem
const PORTS = [3000, 3001, 3002, 3003, 8080, 9000]

async function startServer() {
  for (const port of PORTS) {
    try {
      console.log(`🔍 Tentando porta ${port}...`)

      await new Promise((resolve, reject) => {
        const server = app.listen(port, '0.0.0.0', () => {
          console.log('='.repeat(50))
          console.log('🎉 SERVIDOR INICIADO COM SUCESSO!')
          console.log(`🌐 http://localhost:${port}`)
          console.log('='.repeat(50))
          resolve(server)
        })

        server.on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            console.log(`❌ Porta ${port} ocupada`)
            reject(error)
          } else {
            console.log(`💥 Erro na porta ${port}: ${error.message}`)
            reject(error)
          }
        })
      })

      break // Se conseguiu iniciar, sai do loop

    } catch (error) {
      console.log(`🔄 Tentando próxima porta...`)
      continue
    }
  }
}

startServer().catch(error => {
  console.error('💥 FALHA TOTAL AO INICIAR SERVIDOR:', error)
  process.exit(1)
})
