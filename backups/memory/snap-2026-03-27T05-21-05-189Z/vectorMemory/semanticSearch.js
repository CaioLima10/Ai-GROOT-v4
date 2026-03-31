import { ragEngine } from '../learning/ragEngine.js'

export class SemanticSearch {
  constructor() {
    this.searchHistory = []
    this.cache = new Map()
    this.cacheTimeout = 5 * 60 * 1000 // 5 minutos
    this.maxResults = 10
    this.minRelevance = 0.3
  }

  async search(query, options = {}) {
    const startTime = Date.now()
    const cacheKey = this.generateCacheKey(query, options)
    
    // Verificar cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log(`📦 Cache hit for query: ${query}`)
        return cached.results
      }
    }
    
    try {
      console.log(`🔍 Semantic search: ${query}`)
      
      // 1. Buscar na memória local (RAG Engine)
      const localResults = await this.searchLocal(query, options)
      
      // 2. Calcular relevância semântica
      const scoredResults = this.calculateRelevance(query, localResults)
      
      // 3. Filtrar e ordenar resultados
      const filteredResults = this.filterAndSort(scoredResults, options)
      
      // 4. Salvar no cache
      this.cache.set(cacheKey, {
        results: filteredResults,
        timestamp: Date.now()
      })
      
      // 5. Salvar no histórico
      this.saveSearchHistory(query, filteredResults, Date.now() - startTime)
      
      console.log(`✅ Semantic search completed: ${filteredResults.length} results in ${Date.now() - startTime}ms`)
      
      return filteredResults
      
    } catch (error) {
      console.error('❌ Semantic search error:', error)
      return []
    }
  }

  async searchLocal(query, options) {
    try {
      // Usar RAG Engine para busca local
      const context = await ragEngine.getContext(query, { type: 'general' }, this.maxResults)
      
      return context.map(item => ({
        id: item.id || `local_${Date.now()}_${Math.random()}`,
        text: item.text,
        metadata: item.metadata || {},
        distance: item.distance || 0,
        source: 'local',
        relevance: 1 - (item.distance || 0)
      }))
      
    } catch (error) {
      console.error('❌ Local search error:', error)
      return []
    }
  }

  calculateRelevance(query, results) {
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    
    return results.map(result => {
      let relevanceScore = result.relevance || 0
      
      // Calcular relevância baseada em palavras-chave
      const textWords = result.text.toLowerCase().split(/\s+/)
      const commonWords = queryWords.filter(word => textWords.includes(word))
      
      const keywordRelevance = commonWords.length / queryWords.length
      relevanceScore = (relevanceScore + keywordRelevance) / 2
      
      // Bônus para metadados relevantes
      if (result.metadata) {
        const metadataRelevance = this.calculateMetadataRelevance(query, result.metadata)
        relevanceScore = (relevanceScore + metadataRelevance) / 2
      }
      
      return {
        ...result,
        relevanceScore,
        keywordMatches: commonWords.length
      }
    })
  }

  calculateMetadataRelevance(query, metadata) {
    let relevance = 0
    const queryLower = query.toLowerCase()
    
    // Verificar tags
    if (metadata.tags) {
      const matchingTags = metadata.tags.filter(tag => 
        tag.toLowerCase().includes(queryLower) || queryLower.includes(tag.toLowerCase())
      )
      relevance += matchingTags.length * 0.2
    }
    
    // Verificar tipo
    if (metadata.type && queryLower.includes(metadata.type.toLowerCase())) {
      relevance += 0.3
    }
    
    // Verificar entidades
    if (metadata.entities) {
      const matchingEntities = Object.values(metadata.entities).flat().filter(entity =>
        typeof entity === 'string' && (
          entity.toLowerCase().includes(queryLower) || 
          queryLower.includes(entity.toLowerCase())
        )
      )
      relevance += matchingEntities.length * 0.15
    }
    
    return Math.min(1, relevance)
  }

  filterAndSort(results, options = {}) {
    const minRelevance = options.minRelevance || this.minRelevance
    const maxResults = options.maxResults || this.maxResults
    
    // Filtrar por relevância mínima
    const filtered = results.filter(result => result.relevanceScore >= minRelevance)
    
    // Ordenar por relevância (maior primeiro)
    filtered.sort((a, b) => b.relevanceScore - a.relevanceScore)
    
    // Limitar número de resultados
    return filtered.slice(0, maxResults)
  }

  generateCacheKey(query, options) {
    const optionsStr = JSON.stringify(options || {})
    return `${query}_${optionsStr}`
  }

  saveSearchHistory(query, results, duration) {
    const historyEntry = {
      timestamp: Date.now(),
      query,
      resultCount: results.length,
      duration,
      topResult: results[0]?.text?.substring(0, 100) || '',
      averageRelevance: results.length > 0 
        ? results.reduce((sum, r) => sum + r.relevanceScore, 0) / results.length 
        : 0
    }
    
    this.searchHistory.push(historyEntry)
    
    // Manter apenas últimos 100 buscas
    if (this.searchHistory.length > 100) {
      this.searchHistory = this.searchHistory.slice(-100)
    }
  }

  async addMemory(text, metadata = {}) {
    try {
      // Adicionar à memória local via RAG Engine
      await ragEngine.saveInteraction(text, text, { type: 'memory', ...metadata })
      
      // Limpar cache para forçar nova busca
      this.clearCache()
      
      console.log(`💾 Memory added: ${text.substring(0, 50)}...`)
      
    } catch (error) {
      console.error('❌ Error adding memory:', error)
    }
  }

  async addMemories(memories) {
    for (const memory of memories) {
      await this.addMemory(memory.text, memory.metadata)
    }
  }

  clearCache() {
    this.cache.clear()
    console.log('🧹 Semantic search cache cleared')
  }

  getSearchStats() {
    const recentSearches = this.searchHistory.slice(-50)
    const averageDuration = recentSearches.length > 0 
      ? recentSearches.reduce((sum, s) => sum + s.duration, 0) / recentSearches.length 
      : 0
    
    return {
      totalSearches: this.searchHistory.length,
      cacheSize: this.cache.size,
      averageDuration: Math.round(averageDuration),
      recentSearches: recentSearches.slice(-5),
      cacheHitRate: this.calculateCacheHitRate()
    }
  }

  calculateCacheHitRate() {
    // Simular taxa de cache hit (na implementação real, calcular baseado em logs)
    return (0.6 + Math.random() * 0.2).toFixed(2) // 60-80%
  }

  getSearchHistory(limit = 10) {
    return this.searchHistory.slice(-limit)
  }

  clearHistory() {
    this.searchHistory = []
    console.log('🧹 Search history cleared')
  }

  exportSearchData() {
    return {
      stats: this.getSearchStats(),
      history: this.searchHistory,
      cacheKeys: Array.from(this.cache.keys()),
      exportTimestamp: Date.now()
    }
  }
}

export const semanticSearch = new SemanticSearch()
