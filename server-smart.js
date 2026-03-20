// SERVIDOR INTELIGENTE - SOLUÇÃO SÊNIOR
// Auto-detecção de porta, fallback automático, health check

import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { askGroot } from './grootCore.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuração inteligente de portas
const POSSIBLE_PORTS = [3000, 3001, 3002, 3003, 3004, 3005, 8080, 8081, 9000, 9001]
let currentPort = null
let server = null

// Função para encontrar porta disponível
async function findAvailablePort(startPort) {
  for (const port of POSSIBLE_PORTS) {
    if (port < startPort) continue
    
    try {
      console.log(`🔍 Testando porta ${port}...`)
      
      const testServer = express()
      
      await new Promise((resolve, reject) => {
        const tester = testServer.listen(port, '0.0.0.0', () => {
          tester.close(() => {
            console.log(`✅ Porta ${port} disponível`)
            resolve(port)
          })
        })
        
        tester.on('error', () => {
          console.log(`❌ Porta ${port} ocupada`)
          reject()
        })
        
        // Timeout rápido
        setTimeout(() => reject(), 100)
      })
      
      return port
    } catch (error) {
      continue
    }
  }
  
  throw new Error('Nenhuma porta disponível encontrada!')
}

// Criar aplicação Express
function createApp() {
  const app = express()
  
  // Middleware essencial
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true, limit: '10mb' }))
  
  // CORS para desenvolvimento
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
    next()
  })
  
  // Servir arquivos estáticos da UI
  app.use(express.static(path.join(__dirname, 'ui')))
  
  // Rota raiz - página principal
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'ui', 'index.html'))
  })
  
  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      port: currentPort,
      version: '9.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    })
  })
  
  // Status completo
  app.get('/status', async (req, res) => {
    try {
      const { getMemoryStats } = await import('./grootCore.js')
      res.json({
        success: true,
        data: {
          server: {
            port: currentPort,
            uptime: process.uptime(),
            memory: process.memoryUsage()
          },
          groot: getMemoryStats ? getMemoryStats() : { status: 'available' }
        }
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  })
  
  // Teste automático
  app.get('/test', async (req, res) => {
    try {
      const testPrompt = 'Teste automático do servidor inteligente'
      const response = await askGroot(testPrompt)
      
      res.json({
        success: true,
        test: {
          prompt: testPrompt,
          response: response,
          timestamp: new Date().toISOString(),
          server: {
            port: currentPort,
            version: '9.0.0'
          }
        }
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  })
  
  // Endpoint principal - API do GROOT
  app.post('/ask', async (req, res) => {
    try {
      const { question, prompt, context = {} } = req.body
      
      // Aceitar tanto 'question' quanto 'prompt'
      const userPrompt = question || prompt
      
      if (!userPrompt) {
        return res.status(400).json({
          success: false,
          error: 'Prompt é obrigatório',
          code: 'MISSING_PROMPT',
          example: { prompt: 'Olá GROOT!' }
        })
      }
      
      console.log(`🌳 [${new Date().toISOString()}] Request: ${userPrompt.substring(0, 100)}...`)
      
      const response = await askGroot(userPrompt, context)
      
      console.log(`✅ [${new Date().toISOString()}] Response: ${response.success ? 'SUCCESS' : 'FAILED'}`)
      
      res.json({
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
        server: {
          port: currentPort,
          version: '9.0.0'
        }
      })
      
    } catch (error) {
      console.error('❌ Server Error:', error)
      
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      })
    }
  })
  
  // Endpoint de informações
  app.get('/info', (req, res) => {
    res.json({
      name: 'GROOT 9.0 Professional',
      description: 'IA Profissional com Memória Avançada',
      version: '9.0.0',
      port: currentPort,
      endpoints: {
        root: 'GET /',
        health: 'GET /health',
        status: 'GET /status',
        test: 'GET /test',
        ask: 'POST /ask',
        info: 'GET /info'
      },
      usage: {
        example: 'POST /ask com {"prompt": "sua pergunta"}',
        note: 'Use curl, Postman ou navegador'
      },
      timestamp: new Date().toISOString()
    })
  })
  
  return app
}

// Iniciar servidor inteligente
async function startSmartServer() {
  console.log('🚀 INICIANDO SERVIDOR INTELIGENTE GROOT 9.0')
  console.log('=' .repeat(60))
  
  try {
    // Encontrar porta disponível
    const availablePort = await findAvailablePort(3000)
    currentPort = availablePort
    
    console.log(`🎯 Porta selecionada: ${currentPort}`)
    
    // Criar e iniciar servidor
    const app = createApp()
    
    server = app.listen(currentPort, '0.0.0.0', () => {
      console.log('='.repeat(60))
      console.log('🎉 SERVIDOR INTELIGENTE INICIADO COM SUCESSO!')
      console.log('='.repeat(60))
      console.log(`🌐 Servidor rodando em: http://localhost:${currentPort}`)
      console.log(`📋 Porta: ${currentPort}`)
      console.log(`🔗 Endpoints disponíveis:`)
      console.log(`   GET  /        - Página principal`)
      console.log(`   GET  /health  - Health check`)
      console.log(`   GET  /status  - Status completo`)
      console.log(`   GET  /test    - Teste automático`)
      console.log(`   GET  /info    - Informações do sistema`)
      console.log(`   POST /ask     - Perguntar ao GROOT`)
      console.log('='.repeat(60))
      console.log('🧠 GROOT Core Professional carregado!')
      console.log(`📊 Capacidades: Memória, Segurança, Processamento Inteligente`)
      console.log(`🔒 Segurança: Sanitização ativa, anti-XSS habilitado`)
      console.log('='.repeat(60))
      
      // Health check automático
      setTimeout(async () => {
        try {
          const response = await fetch(`http://localhost:${currentPort}/health`)
          const data = await response.json()
          console.log(`✅ Health Check: ${data.status}`)
        } catch (error) {
          console.log(`❌ Health Check falhou: ${error.message}`)
        }
      }, 1000)
    })
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('\n🔄 SIGTERM recebido, encerrando servidor...')
      server.close(() => {
        console.log('✅ Servidor encerrado')
        process.exit(0)
      })
    })
    
    process.on('SIGINT', () => {
      console.log('\n🔄 SIGINT recebido, encerrando servidor...')
      server.close(() => {
        console.log('✅ Servidor encerrado')
        process.exit(0)
      })
    })
    
    // Tratamento de erros do servidor
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Porta ${currentPort} já está em uso!`)
        console.error(`🔄 Tentando próxima porta disponível...`)
        startSmartServer() // Tentar próxima porta
      } else {
        console.error('❌ Erro no servidor:', error)
        process.exit(1)
      }
    })
    
  } catch (error) {
    console.error('💥 ERRO FATAL AO INICIAR SERVIDOR:', error)
    process.exit(1)
  }
}

// Iniciar se este arquivo for executado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  startSmartServer()
}

export { startSmartServer }
