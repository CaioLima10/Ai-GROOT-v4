// Ingestão de conhecimento local para o RAG avançado
import fs from 'fs/promises'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DEFAULT_DIR = path.resolve(__dirname, '..', 'knowledge')

function parseFrontMatter(text) {
  const match = String(text || '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/i)
  if (!match) return { metadata: {}, body: String(text || '') }

  const metadata = {}
  match[1].split(/\r?\n/).forEach(line => {
    const [key, ...rest] = line.split(':')
    if (!key || rest.length === 0) return
    const normalizedKey = key.trim()
    const value = rest.join(':').trim()
    if (['categories', 'modules', 'bibleStudyModules', 'keywords', 'tags'].includes(normalizedKey)) {
      metadata[normalizedKey] = value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
      return
    }
    metadata[normalizedKey] = value
  })

  return {
    metadata,
    body: String(text || '').slice(match[0].length)
  }
}

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

  const { metadata, body } = parseFrontMatter(raw)

  return [{
    title: metadata.title || path.basename(filePath, ext),
    content: body,
    category: metadata.category || path.basename(path.dirname(filePath)),
    language: metadata.language || 'pt',
    categories: metadata.categories || [],
    modules: metadata.modules || [],
    bibleStudyModules: metadata.bibleStudyModules || [],
    source: metadata.source || 'local'
  }]
}

async function ingest() {
  const { grootAdvancedRAG } = await import('../packages/ai-core/src/index.js')
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

        await grootAdvancedRAG.upsertKnowledge(chunk, {
          source: doc.source || 'local',
          category,
          categories: doc.categories || [],
          language: doc.language || 'pt',
          title: doc.title || path.basename(file),
          file: path.relative(config.dir, file),
          modules: doc.modules || [],
          bibleStudyModules: doc.bibleStudyModules || []
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
