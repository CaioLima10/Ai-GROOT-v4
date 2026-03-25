// Ingestão de conteúdo curado com validação de licença
import fs from 'fs/promises'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CURATED_DIR = path.resolve(__dirname, '..', 'knowledge', 'curated')
const SOURCES_FILE = path.join(CURATED_DIR, 'sources.json')

function parseFrontMatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/i)
  if (!match) return { metadata: {}, body: text }
  const lines = match[1].split(/\r?\n/)
  const metadata = {}
  for (const line of lines) {
    const [key, ...rest] = line.split(':')
    if (!key || rest.length === 0) continue
    const normalizedKey = key.trim()
    const value = rest.join(':').trim()
    if (['categories', 'modules', 'bibleStudyModules', 'keywords', 'tags'].includes(normalizedKey)) {
      metadata[normalizedKey] = value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
      continue
    }
    metadata[normalizedKey] = value
  }
  const body = text.slice(match[0].length)
  return { metadata, body }
}

async function loadSources() {
  try {
    const raw = await fs.readFile(SOURCES_FILE, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    console.error('❌ Não foi possível ler sources.json:', error.message)
    return []
  }
}

function isSourceAllowed(sourceUrl, sources) {
  if (!sourceUrl) return false
  try {
    const domain = new URL(sourceUrl).hostname
    return sources.some(source => source.allowed && domain.endsWith(source.domain))
  } catch (error) {
    return false
  }
}

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listFiles(full))
      continue
    }
    if (entry.name.toLowerCase().endsWith('.md')) files.push(full)
  }

  return files
}

async function ingest() {
  const { grootAdvancedRAG } = await import('../packages/ai-core/src/index.js')
  const sources = await loadSources()
  if (sources.length === 0) {
    console.log('⚠️ Nenhuma fonte aprovada encontrada.')
  }

  const files = await listFiles(CURATED_DIR)
  if (files.length === 0) {
    console.log('⚠️ Nenhum arquivo curado encontrado.')
    return
  }

  let total = 0
  for (const file of files) {
    const raw = await fs.readFile(file, 'utf8')
    const { metadata, body } = parseFrontMatter(raw)

    if (!metadata.source || !isSourceAllowed(metadata.source, sources)) {
      console.log(`⏭️ Ignorado (fonte não aprovada): ${path.basename(file)}`)
      continue
    }

    const content = body.trim()
    if (!content) continue

    await grootAdvancedRAG.upsertKnowledge(content, {
      source: metadata.source,
      category: metadata.category || 'curated',
      categories: metadata.categories || [],
      language: metadata.language || 'pt',
      title: metadata.title || path.basename(file, '.md'),
      license: metadata.license || 'unknown',
      curated: true,
      modules: metadata.modules || [],
      bibleStudyModules: metadata.bibleStudyModules || []
    })

    total++
  }

  console.log(`✅ Sincronização curada finalizada. Itens: ${total}`)
}

ingest().catch(error => {
  console.error('❌ Falha na ingestão curada:', error.message)
  process.exit(1)
})
