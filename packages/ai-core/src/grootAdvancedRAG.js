import fs from "fs/promises"
import path from "path"
import { detectSafetyRisk } from "../../../core/safetyGuard.js"
import { grootEmbeddings } from "./grootEmbeddings.js"
import { grootMemoryConnector } from "./grootMemoryConnector.js"
import { resolveCategoriesFromModules } from "../../shared-config/src/knowledgeCategories.js"

const KNOWLEDGE_DIRS = [
  path.resolve(process.cwd(), "knowledge", "curated")
]

function parseFrontMatter(text) {
  const match = String(text || "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/i)
  if (!match) {
    return { metadata: {}, body: String(text || "") }
  }

  const metadata = {}
  match[1].split(/\r?\n/).forEach(line => {
    const [key, ...rest] = line.split(":")
    if (!key || rest.length === 0) return
    const normalizedKey = key.trim()
    const value = rest.join(":").trim()

    if (["categories", "modules", "bibleStudyModules", "keywords", "tags"].includes(normalizedKey)) {
      metadata[normalizedKey] = value
        .split(",")
        .map(item => item.trim())
        .filter(Boolean)
      return
    }

    metadata[normalizedKey] = value
  })

  return {
    metadata,
    body: String(text || "").slice(match[0].length)
  }
}

function chunkText(text, maxLen = 900) {
  const input = String(text || "").trim()
  if (!input) return []

  const chunks = []
  let buffer = ""

  input.split("\n").forEach(line => {
    const next = `${buffer}${buffer ? "\n" : ""}${line}`
    if (next.length > maxLen && buffer.trim()) {
      chunks.push(buffer.trim())
      buffer = line
      return
    }
    buffer = next
  })

  if (buffer.trim()) {
    chunks.push(buffer.trim())
  }

  return chunks
}

function normalizeSearchOptions(languageOrOptions = null, limit = 5) {
  if (typeof languageOrOptions === "object" && languageOrOptions !== null) {
    return {
      language: languageOrOptions.language || null,
      limit: Number(languageOrOptions.limit || limit || 5),
      categories: Array.isArray(languageOrOptions.categories) ? languageOrOptions.categories : [],
      modules: Array.isArray(languageOrOptions.modules) ? languageOrOptions.modules : [],
      bibleStudyModules: Array.isArray(languageOrOptions.bibleStudyModules) ? languageOrOptions.bibleStudyModules : [],
      includeBugs: languageOrOptions.includeBugs !== false
    }
  }

  return {
    language: languageOrOptions,
    limit: Number(limit || 5),
    categories: [],
    modules: [],
    bibleStudyModules: [],
    includeBugs: true
  }
}

function recordMatchesLanguage(record, language) {
  if (!language) return true
  return String(record.language || "").toLowerCase() === String(language).toLowerCase()
}

function recordMatchesCategories(record, categories = []) {
  if (!Array.isArray(categories) || categories.length === 0) return true

  const recordCategories = new Set([
    String(record.category || "").toLowerCase(),
    ...(Array.isArray(record.categories) ? record.categories.map(category => String(category || "").toLowerCase()) : []),
    ...(Array.isArray(record.metadata?.categories) ? record.metadata.categories.map(category => String(category || "").toLowerCase()) : [])
  ].filter(Boolean))
  const categorySet = new Set(categories.map(category => String(category || "").toLowerCase()))

  return Array.from(recordCategories).some(category => categorySet.has(category))
}

function similarityScore(embedding1, embedding2) {
  if (!embedding1 || !embedding2) return 0

  let dotProduct = 0
  let norm1 = 0
  let norm2 = 0

  for (let index = 0; index < Math.min(embedding1.length, embedding2.length); index += 1) {
    dotProduct += embedding1[index] * embedding2[index]
    norm1 += embedding1[index] * embedding1[index]
    norm2 += embedding2[index] * embedding2[index]
  }

  norm1 = Math.sqrt(norm1)
  norm2 = Math.sqrt(norm2)

  if (!norm1 || !norm2) return 0
  return dotProduct / (norm1 * norm2)
}

function canSearchDeveloperBugs(categories = []) {
  if (!categories.length) return true

  const developerSignals = new Set([
    "developer",
    "code",
    "programming",
    "debugging",
    "architecture",
    "backend",
    "frontend",
    "database",
    "mobile",
    "security",
    "performance"
  ])

  return categories.some(category => developerSignals.has(String(category || "").toLowerCase()))
}

function buildKnowledgePayload(content, metadata = {}) {
  return {
    content,
    source: metadata.source || "manual",
    category: metadata.category || "general",
    language: metadata.language || "pt",
    metadata: {
      ...metadata,
      created_at: new Date().toISOString()
    }
  }
}

function shouldSkipLearning(userMessage = "", aiResponse = "", metadata = {}) {
  const userSafety = detectSafetyRisk(userMessage)
  const responseSafety = detectSafetyRisk(aiResponse)

  if (userSafety.triggered || responseSafety.triggered) {
    return true
  }

  if (typeof metadata.qualityScore === "number" && metadata.qualityScore < 0.55) {
    return true
  }

  const text = String(aiResponse || "").toLowerCase()
  if (
    text.includes("modo de contingencia") ||
    text.includes("tente novamente em alguns instantes") ||
    text.includes("resposta vazia")
  ) {
    return true
  }

  return false
}

function matchesKnowledgeRecord(record, payload) {
  return String(record.content || "") === String(payload.content || "") &&
    String(record.source || "") === String(payload.source || "") &&
    String(record.category || "") === String(payload.category || "") &&
    String(record.language || "") === String(payload.language || "")
}

export class GrootAdvancedRAG {
  constructor() {
    this.supabase = grootMemoryConnector.supabase
    this.embeddings = grootEmbeddings
    this.enabled = !!this.supabase
    this.localKnowledge = []
    this.localBugKnowledge = []
    this.bootstrapPromise = this.bootstrapLocalKnowledge()

    if (!this.enabled) {
      console.warn("⚠️ RAG avançado sem Supabase remoto. Usando base local curada.")
    }
  }

  async listKnowledgeFiles(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      const files = []

      for (const entry of entries) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          files.push(...await this.listKnowledgeFiles(full))
          continue
        }

        if (/\.(md|txt)$/i.test(entry.name)) {
          files.push(full)
        }
      }

      return files
    } catch {
      return []
    }
  }

  async bootstrapLocalKnowledge() {
    try {
      const files = []
      for (const dir of KNOWLEDGE_DIRS) {
        files.push(...await this.listKnowledgeFiles(dir))
      }

      for (const file of files) {
        const raw = await fs.readFile(file, "utf8")
        const { metadata, body } = parseFrontMatter(raw)
        const category = metadata.category || metadata.categories?.[0] || path.basename(path.dirname(file)) || "general"
        const language = metadata.language || "pt"
        const chunks = chunkText(body, 900)

        for (const chunk of chunks) {
          const embedding = await this.embeddings.generateEmbedding(chunk)
          this.localKnowledge.push({
            id: `local_${this.localKnowledge.length + 1}`,
            content: chunk,
            source: metadata.source || "internal.local",
            category,
            categories: Array.isArray(metadata.categories) && metadata.categories.length > 0
              ? metadata.categories
              : [category],
            language,
            metadata: {
              ...metadata,
              file: path.basename(file),
              local: true
            },
            embedding
          })
        }
      }
    } catch (error) {
      console.warn("⚠️ Falha ao carregar base local curada:", error.message)
    }
  }

  async ensureBootstrap() {
    if (!this.bootstrapPromise) return
    await this.bootstrapPromise
  }

  async searchRemoteKnowledge(queryEmbedding, options) {
    if (!this.enabled || !this.supabase) return []

    try {
      const requestedCount = Math.max(options.limit * 4, 12)
      const { data, error } = await this.supabase.rpc("search_knowledge", {
        query_embedding: queryEmbedding,
        match_threshold: 0.3,
        match_count: requestedCount
      })

      if (error) throw error

      return (data || [])
        .filter(item => recordMatchesLanguage(item, options.language))
        .filter(item => recordMatchesCategories(item, options.categories))
        .slice(0, options.limit)
    } catch (error) {
      console.error("❌ Erro na busca semântica remota:", error)
      return []
    }
  }

  async searchRemoteBugs(queryEmbedding, options) {
    if (!this.enabled || !this.supabase || !options.includeBugs || !canSearchDeveloperBugs(options.categories)) {
      return []
    }

    try {
      const { data, error } = await this.supabase.rpc("search_bugs", {
        query_embedding: queryEmbedding,
        language_param: options.language,
        match_threshold: 0.3,
        match_count: 4
      })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error("❌ Erro na busca de bugs remota:", error)
      return []
    }
  }

  async searchLocalKnowledge(queryEmbedding, options) {
    await this.ensureBootstrap()

    return this.localKnowledge
      .filter(record => recordMatchesCategories(record, options.categories))
      .filter(record => recordMatchesLanguage(record, options.language))
      .map(record => ({
        ...record,
        similarity: similarityScore(queryEmbedding, record.embedding)
      }))
      .filter(record => record.similarity > 0.26)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, options.limit)
      .map(({ embedding, ...record }) => record)
  }

  async searchLocalBugs(queryEmbedding, options) {
    if (!options.includeBugs || !canSearchDeveloperBugs(options.categories)) {
      return []
    }

    return this.localBugKnowledge
      .filter(record => recordMatchesLanguage(record, options.language))
      .map(record => ({
        ...record,
        similarity: similarityScore(queryEmbedding, record.embedding)
      }))
      .filter(record => record.similarity > 0.26)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .map(({ embedding, ...record }) => record)
  }

  async searchKnowledge(query, languageOrOptions = null, limit = 5) {
    const options = normalizeSearchOptions(languageOrOptions, limit)
    const moduleCategories = resolveCategoriesFromModules(options.modules, options.bibleStudyModules)
    const mergedCategories = Array.from(new Set([...(options.categories || []), ...moduleCategories]))
    const normalizedOptions = {
      ...options,
      categories: mergedCategories
    }

    try {
      const queryEmbedding = await this.embeddings.generateEmbedding(query)

      const [remoteKnowledge, remoteBugs, localKnowledge, localBugs] = await Promise.all([
        this.searchRemoteKnowledge(queryEmbedding, normalizedOptions),
        this.searchRemoteBugs(queryEmbedding, normalizedOptions),
        this.searchLocalKnowledge(queryEmbedding, normalizedOptions),
        this.searchLocalBugs(queryEmbedding, normalizedOptions)
      ])

      const knowledge = [...remoteKnowledge]
      localKnowledge.forEach(item => {
        const exists = knowledge.some(existing => existing.content === item.content)
        if (!exists) knowledge.push(item)
      })
      knowledge.sort((a, b) => (b.similarity || 0) - (a.similarity || 0))

      const bugs = [...remoteBugs]
      localBugs.forEach(item => {
        const exists = bugs.some(existing => existing.error_message === item.error_message)
        if (!exists) bugs.push(item)
      })

      return {
        knowledge: knowledge.slice(0, normalizedOptions.limit),
        bugs: bugs.slice(0, 3),
        queryEmbedding,
        totalFound: knowledge.length + bugs.length,
        categoriesUsed: normalizedOptions.categories
      }
    } catch (error) {
      console.error("❌ Erro na busca semântica:", error)
      return {
        knowledge: [],
        bugs: [],
        queryEmbedding: null,
        totalFound: 0,
        categoriesUsed: []
      }
    }
  }

  async persistKnowledgePayload(payload, metadata = {}, mode = "insert") {
    const embedding = await this.embeddings.generateEmbedding(payload.content)
    const payloadWithEmbedding = {
      ...payload,
      embedding
    }

    if (!this.enabled || !this.supabase) {
      const existingIndex = this.localKnowledge.findIndex(record => matchesKnowledgeRecord(record, payload))
      const localRecord = {
        id: existingIndex >= 0 ? this.localKnowledge[existingIndex].id : `local_runtime_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        ...payloadWithEmbedding
      }

      if (!Array.isArray(localRecord.categories)) {
        localRecord.categories = [localRecord.category]
      }

      if (existingIndex >= 0) {
        this.localKnowledge[existingIndex] = localRecord
      } else {
        this.localKnowledge.push(localRecord)
      }

      return localRecord
    }

    if (mode === "upsert") {
      const { data: existing, error: selectError } = await this.supabase
        .from("knowledge_embeddings")
        .select("id")
        .eq("content", payload.content)
        .eq("source", payload.source)
        .eq("category", payload.category)
        .eq("language", payload.language)
        .limit(1)

      if (selectError) throw selectError

      if (existing?.[0]?.id) {
        let { data, error } = await this.supabase
          .from("knowledge_embeddings")
          .update({
            ...payloadWithEmbedding,
            version: metadata.version || 1,
            is_active: metadata.is_active ?? true
          })
          .eq("id", existing[0].id)
          .select()

        if (error && error.message?.includes("column")) {
          const fallback = await this.supabase
            .from("knowledge_embeddings")
            .update(payloadWithEmbedding)
            .eq("id", existing[0].id)
            .select()

          data = fallback.data
          error = fallback.error
        }

        if (error) throw error
        return data?.[0] || { id: existing[0].id, ...payloadWithEmbedding }
      }
    }

    let { data, error } = await this.supabase
      .from("knowledge_embeddings")
      .insert({
        ...payloadWithEmbedding,
        version: metadata.version || 1,
        is_active: metadata.is_active ?? true
      })
      .select()

    if (error && error.message?.includes("column")) {
      const retry = await this.supabase
        .from("knowledge_embeddings")
        .insert(payloadWithEmbedding)
        .select()

      data = retry.data
      error = retry.error
    }

    if (error) throw error
    return data?.[0] || null
  }

  async addKnowledge(content, metadata = {}) {
    try {
      return await this.persistKnowledgePayload(buildKnowledgePayload(content, metadata), metadata, "insert")
    } catch (error) {
      console.error("❌ Erro ao adicionar conhecimento:", error)
      return null
    }
  }

  async upsertKnowledge(content, metadata = {}) {
    try {
      return await this.persistKnowledgePayload(buildKnowledgePayload(content, metadata), metadata, "upsert")
    } catch (error) {
      console.error("❌ Erro ao sincronizar conhecimento:", error)
      return null
    }
  }

  async deprecateKnowledge(knowledgeId) {
    if (!this.enabled || !this.supabase) {
      return null
    }

    try {
      const { data, error } = await this.supabase
        .from("knowledge_embeddings")
        .update({ is_active: false })
        .eq("id", knowledgeId)
        .select()

      if (error && error.message?.includes("column")) {
        return null
      }

      if (error) throw error
      return data?.[0] || null
    } catch (error) {
      console.error("❌ Erro ao desativar conhecimento:", error)
      return null
    }
  }

  async saveKnowledgeVersion(knowledgeId, content, metadata = {}) {
    if (!this.enabled || !this.supabase) {
      return null
    }

    try {
      const { data, error } = await this.supabase
        .from("knowledge_versions")
        .insert({
          knowledge_id: knowledgeId,
          content,
          metadata,
          version: metadata.version || 1,
          created_at: new Date().toISOString()
        })
        .select()

      if (error) throw error
      return data?.[0] || null
    } catch (error) {
      console.error("❌ Erro ao salvar versão:", error)
      return null
    }
  }

  async rollbackKnowledge(knowledgeId, versionContent) {
    if (!this.enabled || !this.supabase) {
      return null
    }

    try {
      const embedding = await this.embeddings.generateEmbedding(versionContent)
      const { data, error } = await this.supabase
        .from("knowledge_embeddings")
        .update({
          content: versionContent,
          embedding,
          is_active: true
        })
        .eq("id", knowledgeId)
        .select()

      if (error && error.message?.includes("column")) {
        const fallback = await this.supabase
          .from("knowledge_embeddings")
          .update({
            content: versionContent,
            embedding
          })
          .eq("id", knowledgeId)
          .select()
        return fallback.data?.[0] || null
      }

      if (error) throw error
      return data?.[0] || null
    } catch (error) {
      console.error("❌ Erro ao fazer rollback:", error)
      return null
    }
  }

  async addBugSolution(errorMessage, solution, metadata = {}) {
    try {
      const content = `Error: ${errorMessage}\nSolution: ${solution}`
      const embedding = await this.embeddings.generateEmbedding(content)

      if (!this.enabled || !this.supabase) {
        const localBug = {
          id: `local_bug_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          error_message: errorMessage,
          solution,
          language: metadata.language || "javascript",
          framework: metadata.framework || "",
          confidence: metadata.confidence || 0.8,
          metadata: {
            ...metadata,
            created_at: new Date().toISOString()
          },
          embedding
        }
        this.localBugKnowledge.push(localBug)
        return localBug
      }

      const { data, error } = await this.supabase
        .from("bugs_knowledge")
        .insert({
          error_message: errorMessage,
          stack_trace: metadata.stackTrace || "",
          solution,
          language: metadata.language || "javascript",
          framework: metadata.framework || "",
          embedding,
          confidence: metadata.confidence || 0.8,
          metadata: {
            ...metadata,
            created_at: new Date().toISOString()
          }
        })
        .select()

      if (error) throw error
      return data?.[0] || null
    } catch (error) {
      console.error("❌ Erro ao adicionar bug:", error)
      return null
    }
  }

  async rebuildKnowledgeEmbeddings(batchSize = 25) {
    return this.rebuildEmbeddingsForTable({
      table: "knowledge_embeddings",
      selectColumns: "id, content",
      batchSize,
      buildContent: row => row.content
    })
  }

  async rebuildBugEmbeddings(batchSize = 25) {
    return this.rebuildEmbeddingsForTable({
      table: "bugs_knowledge",
      selectColumns: "id, error_message, solution",
      batchSize,
      buildContent: row => `Error: ${row.error_message || ""}\nSolution: ${row.solution || ""}`
    })
  }

  async rebuildCodeEmbeddings(batchSize = 25) {
    return this.rebuildEmbeddingsForTable({
      table: "code_knowledge",
      selectColumns: "id, content",
      batchSize,
      buildContent: row => row.content
    })
  }

  async rebuildEmbeddingsForTable({ table, selectColumns, buildContent, batchSize = 25 }) {
    if (!this.enabled || !this.supabase) {
      return {
        table,
        processed: 0,
        skipped: 0,
        remoteEnabled: false
      }
    }

    let offset = 0
    let processed = 0
    let skipped = 0

    while (true) {
      const { data, error } = await this.supabase
        .from(table)
        .select(selectColumns)
        .order("id", { ascending: true })
        .range(offset, offset + batchSize - 1)

      if (error) throw error
      if (!data || data.length === 0) break

      for (const row of data) {
        const content = String(buildContent(row) || "").trim()
        if (!content) {
          skipped += 1
          continue
        }

        const embedding = await this.embeddings.generateEmbedding(content)
        const { error: updateError } = await this.supabase
          .from(table)
          .update({ embedding })
          .eq("id", row.id)

        if (updateError) throw updateError
        processed += 1
      }

      offset += data.length
    }

    return {
      table,
      processed,
      skipped,
      remoteEnabled: true
    }
  }

  async rebuildRemoteEmbeddings(batchSize = 25) {
    try {
      const [knowledge, bugs, code] = await Promise.all([
        this.rebuildKnowledgeEmbeddings(batchSize),
        this.rebuildBugEmbeddings(batchSize),
        this.rebuildCodeEmbeddings(batchSize)
      ])

      return {
        knowledge,
        bugs,
        code,
        remoteEnabled: true
      }
    } catch (error) {
      console.error("❌ Erro ao reconstruir embeddings remotos:", error)
      return {
        knowledge: null,
        bugs: null,
        code: null,
        remoteEnabled: false,
        error: error.message
      }
    }
  }

  async enrichQueryAdvanced(query, languageOrOptions = null, limit = 5) {
    const searchOptions = normalizeSearchOptions(languageOrOptions, limit)
    const searchResults = await this.searchKnowledge(query, searchOptions, searchOptions.limit)

    if (searchResults.totalFound === 0) {
      return {
        query,
        context: "",
        knowledge: [],
        bugs: [],
        enriched: false,
        categoriesUsed: searchResults.categoriesUsed || []
      }
    }

    const knowledgeContext = searchResults.knowledge
      .map(item => `📚 ${item.category}: ${item.content} (Fonte: ${item.source})`)
      .join("\n\n")

    const bugsContext = searchResults.bugs
      .map(item => `🐛 ${item.language}: ${item.error_message}\n💡 Solução: ${item.solution}`)
      .join("\n\n")

    return {
      query,
      context: [knowledgeContext, bugsContext].filter(Boolean).join("\n\n"),
      knowledge: searchResults.knowledge,
      bugs: searchResults.bugs,
      enriched: true,
      totalFound: searchResults.totalFound,
      categoriesUsed: searchResults.categoriesUsed || []
    }
  }

  async learnFromInteractionAdvanced(userMessage, aiResponse, metadata = {}) {
    if (shouldSkipLearning(userMessage, aiResponse, metadata)) {
      return {
        skipped: true,
        reason: "unsafe_or_low_quality"
      }
    }

    const contentType = this.detectContentType(userMessage, aiResponse)

    switch (contentType) {
      case "bug_solution":
        await this.extractAndSaveBug(userMessage, aiResponse, metadata)
        break
      case "code_knowledge":
        await this.extractAndSaveCode(userMessage, aiResponse, metadata)
        break
      default:
        await this.addKnowledge(aiResponse, {
          source: "interaction",
          category: metadata.category || "learned",
          language: metadata.language || "pt",
          userMessage
        })
        break
    }
  }

  detectContentType(userMessage, aiResponse) {
    const message = String(userMessage || "").toLowerCase()

    if (message.includes("erro") || message.includes("bug") || message.includes("problema")) {
      return "bug_solution"
    }

    if (message.includes("código") || message.includes("codigo") || message.includes("função") || message.includes("implementar")) {
      return "code_knowledge"
    }

    return "general_knowledge"
  }

  async extractAndSaveBug(userMessage, aiResponse, metadata) {
    const errorMatch = String(userMessage || "").match(/(erro|bug|problema)[\s:]+(.+)/i)
    const solutionMatch = String(aiResponse || "").match(/(solução|fix|correção|correcao)[\s:]+(.+)/i)

    if (errorMatch && solutionMatch) {
      await this.addBugSolution(errorMatch[2].trim(), solutionMatch[2].trim(), {
        language: metadata.language || "javascript",
        stackTrace: "",
        confidence: 0.7
      })
    }
  }

  async extractAndSaveCode(userMessage, aiResponse, metadata) {
    const codeBlocks = String(aiResponse || "").match(/```[\s\S]*?```/g) || []

    for (const block of codeBlocks) {
      const code = block.replace(/```[\w]*\n/, "").replace(/```$/, "")
      await this.addKnowledge(code, {
        source: "interaction",
        category: "code",
        language: metadata.language || "javascript",
        userMessage
      })
    }
  }

  async getAdvancedStats() {
    await this.ensureBootstrap()

    if (!this.enabled || !this.supabase) {
      return {
        totalKnowledge: this.localKnowledge.length,
        totalBugs: this.localBugKnowledge.length,
        localKnowledge: this.localKnowledge.length,
        localBugs: this.localBugKnowledge.length,
        remoteEnabled: false,
        lastUpdated: new Date().toISOString()
      }
    }

    try {
      const [knowledgeCount, bugsCount] = await Promise.all([
        this.supabase.from("knowledge_embeddings").select("count", { count: "exact" }),
        this.supabase.from("bugs_knowledge").select("count", { count: "exact" })
      ])

      return {
        totalKnowledge: knowledgeCount.count || 0,
        totalBugs: bugsCount.count || 0,
        localKnowledge: this.localKnowledge.length,
        localBugs: this.localBugKnowledge.length,
        remoteEnabled: true,
        lastUpdated: new Date().toISOString()
      }
    } catch (error) {
      console.error("❌ Erro ao buscar estatísticas:", error)
      return {
        totalKnowledge: this.localKnowledge.length,
        totalBugs: this.localBugKnowledge.length,
        localKnowledge: this.localKnowledge.length,
        localBugs: this.localBugKnowledge.length,
        remoteEnabled: false,
        lastUpdated: new Date().toISOString()
      }
    }
  }
}

export const grootAdvancedRAG = new GrootAdvancedRAG()
