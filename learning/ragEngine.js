// RAG Engine simplificado sem dependências externas
export class RAGEngine {
  constructor() {
    this.memory = new Map()
    this.cache = new Map()
  }

  async getContext(query, intent, maxResults = 5) {
    try {
      // Buscar na memória local
      const results = this.searchMemory(query, maxResults)

      const context = results.map(result => ({
        text: result.content,
        metadata: result.metadata,
        distance: result.distance || 0
      }))

      console.log(`📚 RAG: Encontrados ${context.length} contextos relevantes`)
      return context

    } catch (error) {
      console.error('❌ RAG Engine: Erro ao buscar contexto:', error)
      return []
    }
  }

  async saveInteraction(query, response, intent, metadata = {}) {
    try {
      const document = {
        id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: query,
        response: response.substring(0, 500),
        metadata: {
          intent_type: intent.type || 'general',
          confidence: intent.confidence || 0.8,
          timestamp: Date.now(),
          hasCode: intent.hasCode || false,
          entities: intent.entities || {},
          ...metadata
        }
      }

      // Salvar na memória local
      this.memory.set(document.id, document)

      // Manter apenas últimos 1000 documentos
      if (this.memory.size > 1000) {
        const entries = Array.from(this.memory.entries())
        const toKeep = entries.slice(-1000)
        this.memory.clear()
        toKeep.forEach(([key, value]) => this.memory.set(key, value))
      }

      console.log('💾 RAG: Interação salva na memória')

    } catch (error) {
      console.error('❌ RAG Engine: Erro ao salvar interação:', error)
    }
  }

  searchMemory(query, maxResults = 5) {
    const queryWords = query.toLowerCase().split(' ')
    const results = []

    // Busca simples por palavras-chave
    for (const [id, doc] of this.memory.entries()) {
      const docWords = doc.text.toLowerCase().split(' ')
      const matches = queryWords.filter(word => docWords.includes(word)).length

      if (matches > 0) {
        results.push({
          id,
          text: doc.text,
          metadata: doc.metadata,
          distance: 1 - (matches / queryWords.length),
          matches
        })
      }
    }

    // Ordenar por relevância
    return results
      .sort((a, b) => b.distance - a.distance)
      .slice(0, maxResults)
  }

  async search(query, filters = {}) {
    return this.searchMemory(query, 10)
  }

  async getMemoryStats() {
    return {
      totalDocuments: this.memory.size,
      type: 'local',
      lastUpdated: Date.now()
    }
  }

  async clearOldMemories(daysOld = 30) {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000)

    let removedCount = 0

    for (const [id, doc] of this.memory.entries()) {
      if (doc.metadata.timestamp < cutoffTime) {
        this.memory.delete(id)
        removedCount++
      }
    }

    console.log(`🗑️ RAG: Removidas ${removedCount} memórias antigas (${daysOld} dias)`)
  }
}

export const ragEngine = new RAGEngine()
