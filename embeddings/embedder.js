// Embeddings reais com OpenAI API
let openaiClient = null

export class Embedder {
  constructor() {
    this.model = "text-embedding-3-small"
    this.dimensions = 1536
    this.cache = new Map()
    this.cacheTimeout = 30 * 60 * 1000 // 30 minutos
  }

  async initialize() {
    try {
      if (!process.env.OPENAI_API_KEY) {
        console.warn('⚠️ OpenAI API key not found. Using mock embedder.')
        return this.createMockEmbedder()
      }
      
      // Dynamic import
      const { default: OpenAI } = await import('openai')
      openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      })
      
      console.log('✅ OpenAI embedder initialized')
      return true
      
    } catch (error) {
      console.warn('⚠️ OpenAI not available, using mock embedder:', error.message)
      return this.createMockEmbedder()
    }
  }

  createMockEmbedder() {
    console.log('🔧 Using mock embedder for embeddings')
    openaiClient = {
      embeddings: {
        create: async (params) => ({
          data: [{
            embedding: this.generateMockEmbedding(params.input)
          }]
        })
      }
    }
    return true
  }

  async embed(text) {
    const cacheKey = this.generateCacheKey(text)
    
    // Verificar cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log(`📦 Cache hit for embedding: ${text.substring(0, 30)}...`)
        return cached.embedding
      }
    }
    
    try {
      console.log(`🔢 Generating embedding: ${text.substring(0, 30)}...`)
      
      const response = await openaiClient.embeddings.create({
        model: this.model,
        input: text,
        encoding_format: "float"
      })
      
      const embedding = response.data[0].embedding
      
      // Salvar no cache
      this.cache.set(cacheKey, {
        embedding,
        timestamp: Date.now()
      })
      
      // Manter cache limitado
      if (this.cache.size > 1000) {
        const entries = Array.from(this.cache.entries())
        const toKeep = entries.slice(-500)
        this.cache.clear()
        toKeep.forEach(([key, value]) => this.cache.set(key, value))
      }
      
      console.log(`✅ Embedding generated: ${embedding.length} dimensions`)
      return embedding
      
    } catch (error) {
      console.error('❌ Error generating embedding:', error)
      
      // Fallback para mock embedding
      return this.generateMockEmbedding(text)
    }
  }

  generateMockEmbedding(text) {
    // Gerar embedding simulada baseada no hash do texto
    const hash = this.simpleHash(text)
    const embedding = new Array(this.dimensions).fill(0)
    
    // Preencher com valores baseados no hash
    for (let i = 0; i < this.dimensions; i++) {
      embedding[i] = (Math.sin(hash + i) + 1) / 2 // Normalizado entre 0 e 1
    }
    
    // Normalizar vetor
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    return embedding.map(val => val / magnitude)
  }

  simpleHash(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash
  }

  generateCacheKey(text) {
    return text.substring(0, 100).replace(/\s+/g, '_')
  }

  async embedBatch(texts) {
    console.log(`🔢 Generating batch embeddings: ${texts.length} texts`)
    
    const embeddings = []
    
    for (const text of texts) {
      const embedding = await this.embed(text)
      embeddings.push(embedding)
    }
    
    console.log(`✅ Batch embeddings completed: ${embeddings.length} vectors`)
    return embeddings
  }

  calculateSimilarity(embedding1, embedding2) {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have same dimensions')
    }
    
    // Cosine similarity
    let dotProduct = 0
    let magnitude1 = 0
    let magnitude2 = 0
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i]
      magnitude1 += embedding1[i] * embedding1[i]
      magnitude2 += embedding2[i] * embedding2[i]
    }
    
    magnitude1 = Math.sqrt(magnitude1)
    magnitude2 = Math.sqrt(magnitude2)
    
    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0
    }
    
    return dotProduct / (magnitude1 * magnitude2)
  }

  getStats() {
    return {
      model: this.model,
      dimensions: this.dimensions,
      cacheSize: this.cache.size,
      cacheTimeout: this.cacheTimeout,
      isReal: !!process.env.OPENAI_API_KEY
    }
  }

  clearCache() {
    this.cache.clear()
    console.log('🧹 Embedding cache cleared')
  }
}

export const embedder = new Embedder()
