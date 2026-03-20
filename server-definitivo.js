// SERVIDOR DEFINITIVO - VERSÃO MÁXIMA SIMPLIFICADA
// Sem dependências complexas, apenas o essencial

import express from 'express'
import cors from 'cors'
import { askGroot } from './groot-quantum.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log(' INICIANDO SERVIDOR DEFINITIVO GROOT 9.0')

const app = express()

// Middleware essencial
app.use(express.json({ limit: '10mb' }))
app.use(cors())
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Servir frontend estático - UI primeiro
app.use(express.static(path.join(__dirname, 'ui')))
app.use(express.static(path.join(__dirname, 'public')))

// Rota raiz - servir o frontend do ui
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'ui', 'index.html'))
})

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

// Config público para o frontend (Supabase keys)
app.get('/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    adminProtected: false
  })
})

// API do GROOT - VERSÃO SIMPLIFICADA COM FILTROS DE SEGURANÇA
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

    // FILTROS DE SEGURANÇA RIGOROSOS
    const dangerousPatterns = [
      // Conteúdo adulto explícito
      /\b(porn|sexo|nudez|naked|xxx|adulto explícito|conteúdo adulto)\b/gi,
      // Violência e crimes
      /\b(assassinar|matar|bombardear|terrorismo|drogas ilegais|tráfico de drogas|arma de fogo|fabricar arma)\b/gi,
      // Pirataria e crimes digitais
      /\b(pirataria|crackear|hackear|senha de|cartão de crédito|fraude|estelionato|phishing|malware|vírus)\b/gi,
      // Conteúdo perigoso
      /\b(cometer suicídio|automutilação|como morrer|envenenar|fazer bomba)\b/gi,
      // Atividades ilegais
      /\b(comprar drogas|vender drogas|prostituição|tráfico humano|lavar dinheiro|sonegar impostos)\b/gi
    ]

    const isDangerous = dangerousPatterns.some(pattern => pattern.test(userPrompt))

    if (isDangerous) {
      return res.json({
        success: true,
        response: "⚠️ **NÃO POSSO AJUDAR COM ISSO** ⚠️\n\nNão posso fornecer informações sobre:\n- Conteúdo adulto explícito\n- Atividades ilegais ou perigosas\n- Violência, crimes ou armas\n- Pirataria ou fraudes digitais\n- Qualquer tipo de atividade prejudicial\n\nSe você precisa de ajuda, procure autoridades competentes ou serviços de apoio especializados.",
        requestId: null
      })
    }

    // CONECTAR COM GROOT CORE INTELIGENTE
    const { askGroot } = await import('./groot-quantum.js')
    const grootResponse = await askGroot(userPrompt)

    console.log(`✅ Resposta GROOT: ${grootResponse.success ? 'SUCCESS' : 'FAILED'}`)

    res.json(grootResponse)

  } catch (error) {
    console.error('❌ Erro:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno',
      details: error.message
    })
  }
})

// Endpoint para upload de arquivos
app.post('/upload', async (req, res) => {
  try {
    const { file, name, type } = req.body

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'Arquivo é obrigatório'
      })
    }

    console.log(`📁 Upload recebido: ${name} (${type})`)

    // Salvar informações do arquivo
    const uploadData = {
      id: Date.now().toString(),
      name: name || 'arquivo',
      type: type || 'unknown',
      size: Math.round(file.length * 0.75), // Estimativa do tamanho original
      data: file,
      uploadedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hora
    }

    console.log(`✅ Upload processado: ${uploadData.name}`)

    res.json({
      success: true,
      ...uploadData
    })

  } catch (error) {
    console.error('❌ Erro no upload:', error)
    res.status(500).json({
      success: false,
      error: 'Erro no upload',
      details: error.message
    })
  }
})

// Iniciar servidor
const PORT = process.env.PORT || 3000

app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(50))
  console.log('🎉 SERVIDOR DEFINITIVO INICIADO COM SUCESSO!')
  console.log('='.repeat(50))
  console.log(`🌐 Servidor rodando em: http://localhost:${PORT}`)
  console.log(`📋 Porta: ${PORT}`)
  console.log(`🎯 Endpoints:`)
  console.log(`   GET  /        - Página principal`)
  console.log(`   GET  /health  - Health check`)
  console.log(`   POST /ask     - Perguntar ao GROOT`)
  console.log('='.repeat(50))
  console.log('🚀 GROOT 9.0 - IA Suprema pronta para uso!')
  console.log('='.repeat(50))
})
