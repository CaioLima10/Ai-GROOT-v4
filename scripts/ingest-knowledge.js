// Ingestão de conhecimento local para o RAG avançado
import fs from 'fs/promises'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DEFAULT_DIR = path.resolve(__dirname, '..', 'knowledge')

function parseArgs() {
  const args = process.argv.slice(2)
  const config = {
    dir: DEFAULT_DIR,
    dryRun: args.includes('--dry-run'),
    category: null
  }

  const dirIndex = args.indexOf('--dir')
  if (dirIndex >= 0 && args[dirIndex + 1]) {
    config.dir = path.resolve(process.cwd(), args[dirIndex + 1])
  }

  const catIndex = args.indexOf('--category')
  if (catIndex >= 0 && args[catIndex + 1]) {
    config.category = args[catIndex + 1]
  }

  return config
}

function chunkText(text, maxLen = 1200) {
  const chunks = []
  let buffer = ''

  for (const line of text.split('\n')) {
    if ((buffer + '\n' + line).length > maxLen) {
      if (buffer.trim()) chunks.push(buffer.trim())
      buffer = line
      continue
    }
    buffer += (buffer ? '\n' : '') + line
  }

  if (buffer.trim()) chunks.push(buffer.trim())
  return chunks
}

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listFiles(full))
    } else if (/\.(md|txt|json)$/i.test(entry.name)) {
      files.push(full)
    }
  }

  return files
}

async function loadDocument(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const raw = await fs.readFile(filePath, 'utf8')

  if (ext === '.json') {
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : [data]
  }

  return [{
    title: path.basename(filePath, ext),
    content: raw,
    category: path.basename(path.dirname(filePath))
  }]
}

async function ingest() {
  const { grootAdvancedRAG } = await import('../core/grootAdvancedRAG.js')
  const config = parseArgs()
  console.log(`📥 Ingestão iniciada em: ${config.dir}`)
  if (config.dryRun) console.log('🧪 Modo dry-run ativo (não grava no Supabase)')

  const files = await listFiles(config.dir)
  if (files.length === 0) {
    console.log('⚠️ Nenhum arquivo encontrado para ingestão.')
    return
  }

  let totalChunks = 0
  for (const file of files) {
    const docs = await loadDocument(file)
    for (const doc of docs) {
      const category = config.category || doc.category || 'general'
      const chunks = chunkText(doc.content || '')

      for (const chunk of chunks) {
        totalChunks++
        if (config.dryRun) continue

        await grootAdvancedRAG.addKnowledge(chunk, {
          source: 'local',
          category,
          language: 'pt',
          title: doc.title || path.basename(file),
          file: path.relative(config.dir, file)
        })
      }
    }
  }

  console.log(`✅ Ingestão finalizada. Total de chunks: ${totalChunks}`)
}

ingest().catch(error => {
  console.error('❌ Falha na ingestão:', error.message)
  process.exit(1)
})
