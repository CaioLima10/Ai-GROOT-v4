// GROOT QUANTUM MEMORY - NÚCLEO DE MEMÓRIA DIVINO
// Superior a qualquer sistema de memória existente

import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

class QuantumMemory {
  constructor() {
    this.memoryPath = path.join(process.cwd(), '.groot-memory')
    this.sessionId = crypto.randomUUID()
    this.conversationHistory = []
    this.longTermMemory = new Map()
    this.episodicMemory = new Map()
    this.userProfile = new Map()
    this.knowledgeGraph = new Map()
    this.learningMetrics = {
      interactions: 0,
      successRate: 0,
      adaptationScore: 0
    }

    this.initialize()
  }

  async initialize() {
    try {
      await fs.mkdir(this.memoryPath, { recursive: true })
      await this.loadMemory()
      console.log('🧠 Quantum Memory inicializado')
      console.log(`📊 Sessão: ${this.sessionId}`)
      console.log(`💾 Memória carregada: ${this.longTermMemory.size} entidades`)
    } catch (error) {
      console.error('❌ Erro ao inicializar Quantum Memory:', error)
    }
  }

  // Carregar memória persistente
  async loadMemory() {
    try {
      const files = await fs.readdir(this.memoryPath)

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(this.memoryPath, file), 'utf-8')
          const data = JSON.parse(content)

          if (file === 'long-term.json') {
            this.longTermMemory = new Map(data)
          } else if (file === 'episodic.json') {
            this.episodicMemory = new Map(data)
          } else if (file === 'profile.json') {
            this.userProfile = new Map(data)
          } else if (file === 'knowledge.json') {
            this.knowledgeGraph = new Map(data)
          }
        }
      }
    } catch (error) {
      console.log('📝 Criando nova memória...')
    }
  }

  // Salvar memória persistente
  async saveMemory() {
    try {
      await fs.writeFile(
        path.join(this.memoryPath, 'long-term.json'),
        JSON.stringify([...this.longTermMemory])
      )

      await fs.writeFile(
        path.join(this.memoryPath, 'episodic.json'),
        JSON.stringify([...this.episodicMemory])
      )

      await fs.writeFile(
        path.join(this.memoryPath, 'profile.json'),
        JSON.stringify([...this.userProfile])
      )

      await fs.writeFile(
        path.join(this.memoryPath, 'knowledge.json'),
        JSON.stringify([...this.knowledgeGraph])
      )

      console.log('💾 Memória quântica salva')
    } catch (error) {
      console.error('❌ Erro ao salvar memória:', error)
    }
  }

  // Armazenar informação com contexto quântico
  async store(key, value, context = {}) {
    const quantumEntry = {
      value,
      context,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      importance: this.calculateImportance(value, context),
      connections: this.findConnections(key, value)
    }

    this.longTermMemory.set(key, quantumEntry)
    this.updateKnowledgeGraph(key, value)

    await this.saveMemory()
    return quantumEntry
  }

  // Recuperar informação com contexto completo
  async retrieve(key) {
    const entry = this.longTermMemory.get(key)

    if (entry) {
      // Atualizar acesso
      entry.lastAccessed = Date.now()
      entry.accessCount = (entry.accessCount || 0) + 1

      // Buscar conexões relacionadas
      const connections = this.findRelatedEntries(key)

      return {
        ...entry,
        connections,
        relevance: this.calculateRelevance(entry)
      }
    }

    return null
  }

  // Adicionar ao histórico conversacional
  async addToHistory(message, response, metadata = {}) {
    const entry = {
      message,
      response,
      metadata,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      sentiment: this.analyzeSentiment(message),
      intent: this.extractIntent(message),
      entities: this.extractEntities(message)
    }

    this.conversationHistory.push(entry)

    // Manter apenas últimas 100 conversações na memória volátil
    if (this.conversationHistory.length > 100) {
      this.conversationHistory.shift()
    }

    // Armazenar episódio importante
    if (entry.importance > 0.7) {
      const episodeKey = `episode_${Date.now()}`
      this.episodicMemory.set(episodeKey, entry)
    }

    await this.saveMemory()
  }

  // Buscar contexto conversacional
  getContext(depth = 5) {
    return this.conversationHistory.slice(-depth)
  }

  // Atualizar perfil do usuário
  async updateProfile(preferences, behaviors) {
    const currentProfile = this.userProfile.get('default') || {}

    const updatedProfile = {
      ...currentProfile,
      preferences: { ...currentProfile.preferences, ...preferences },
      behaviors: { ...currentProfile.behaviors, ...behaviors },
      lastUpdate: Date.now(),
      interactionCount: (currentProfile.interactionCount || 0) + 1
    }

    this.userProfile.set('default', updatedProfile)
    await this.saveMemory()

    return updatedProfile
  }

  // Análise sentimental avançada
  analyzeSentiment(text) {
    const positiveWords = ['bom', 'ótimo', 'excelente', 'perfeito', 'amazing', 'great', 'good']
    const negativeWords = ['ruim', 'péssimo', 'horrível', 'terrível', 'awful', 'terrible', 'bad']

    const words = text.toLowerCase().split(' ')
    let score = 0

    words.forEach(word => {
      if (positiveWords.includes(word)) score += 1
      if (negativeWords.includes(word)) score -= 1
    })

    return {
      score: score / words.length,
      sentiment: score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral',
      confidence: Math.abs(score) / words.length
    }
  }

  // Extração de intenção
  extractIntent(text) {
    const intents = {
      question: ['?', 'como', 'o que', 'qual', 'por que', 'where', 'what', 'how', 'why'],
      command: ['faça', 'crie', 'execute', 'run', 'create', 'make', 'do'],
      request: ['por favor', 'preciso', 'gostaria', 'please', 'need', 'would like'],
      problem: ['erro', 'problema', 'bug', 'issue', 'error', 'problem'],
      learning: ['aprender', 'ensine', 'explain', 'learn', 'teach', 'explain']
    }

    const lowerText = text.toLowerCase()

    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return intent
      }
    }

    return 'general'
  }

  // Extração de entidades
  extractEntities(text) {
    const entities = []

    // Detectar linguagens de programação
    const languages = ['javascript', 'python', 'java', 'c++', 'c#', 'ruby', 'php', 'go', 'rust', 'swift']
    languages.forEach(lang => {
      if (text.toLowerCase().includes(lang)) {
        entities.push({ type: 'language', value: lang })
      }
    })

    // Detectar tecnologias
    const technologies = ['react', 'vue', 'angular', 'node', 'express', 'docker', 'kubernetes', 'aws', 'azure', 'gcp']
    technologies.forEach(tech => {
      if (text.toLowerCase().includes(tech)) {
        entities.push({ type: 'technology', value: tech })
      }
    })

    return entities
  }

  // Calcular importância da informação
  calculateImportance(value, context) {
    let importance = 0.5

    // Aumenta importância se tiver entidades
    if (context.entities && context.entities.length > 0) {
      importance += 0.2
    }

    // Aumenta importância se for problema técnico
    if (context.intent === 'problem') {
      importance += 0.3
    }

    // Aumenta importância se tiver sentimento forte
    if (context.sentiment && Math.abs(context.sentiment.score) > 0.5) {
      importance += 0.2
    }

    return Math.min(importance, 1.0)
  }

  // Encontrar conexões entre informações
  findConnections(key, value) {
    const connections = []

    for (const [existingKey, entry] of this.longTermMemory) {
      if (existingKey !== key) {
        // Simular detecção de conexões semânticas
        const similarity = this.calculateSimilarity(key, existingKey)
        if (similarity > 0.7) {
          connections.push({
            key: existingKey,
            similarity,
            strength: similarity * entry.importance
          })
        }
      }
    }

    return connections.sort((a, b) => b.strength - a.strength)
  }

  // Calcular similaridade simplificada
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1

    if (longer.length === 0) return 1.0

    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  // Distância de Levenshtein
  levenshteinDistance(str1, str2) {
    const matrix = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  // Encontrar entradas relacionadas
  findRelatedEntries(key) {
    const related = []

    for (const [entryKey, entry] of this.longTermMemory) {
      if (entryKey !== key) {
        const similarity = this.calculateSimilarity(key, entryKey)
        if (similarity > 0.5) {
          related.push({
            key: entryKey,
            entry,
            similarity
          })
        }
      }
    }

    return related.sort((a, b) => b.similarity - a.similarity).slice(0, 5)
  }

  // Calcular relevância
  calculateRelevance(entry) {
    const now = Date.now()
    const age = now - entry.timestamp
    const dayInMs = 24 * 60 * 60 * 1000

    // Fator de tempo (informações recentes mais relevantes)
    const timeFactor = Math.exp(-age / (30 * dayInMs))

    // Fator de acesso (mais acessados mais relevantes)
    const accessFactor = Math.log((entry.accessCount || 0) + 1)

    // Fator de importância
    const importanceFactor = entry.importance || 0.5

    return (timeFactor * 0.3 + accessFactor * 0.3 + importanceFactor * 0.4)
  }

  // Atualizar grafo de conhecimento
  updateKnowledgeGraph(key, value) {
    if (!this.knowledgeGraph.has(key)) {
      this.knowledgeGraph.set(key, {
        value,
        connections: [],
        lastUpdated: Date.now(),
        category: this.categorizeKnowledge(key, value)
      })
    }
  }

  // Categorizar conhecimento
  categorizeKnowledge(key, value) {
    const categories = {
      programming: ['code', 'function', 'class', 'method', 'algorithm'],
      database: ['sql', 'query', 'table', 'database', 'schema'],
      web: ['html', 'css', 'javascript', 'react', 'vue', 'angular'],
      mobile: ['ios', 'android', 'react native', 'flutter'],
      devops: ['docker', 'kubernetes', 'ci/cd', 'deployment'],
      security: ['authentication', 'authorization', 'encryption', 'security']
    }

    const text = `${key} ${value}`.toLowerCase()

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category
      }
    }

    return 'general'
  }

  // Obter estatísticas da memória
  getStats() {
    return {
      sessionId: this.sessionId,
      longTermEntries: this.longTermMemory.size,
      episodicEntries: this.episodicMemory.size,
      conversationHistory: this.conversationHistory.length,
      userProfileEntries: this.userProfile.size,
      knowledgeGraphEntries: this.knowledgeGraph.size,
      learningMetrics: this.learningMetrics,
      uptime: Date.now() - (this.startTime || Date.now())
    }
  }

  // Reset de memória (apenas para desenvolvimento)
  async reset() {
    try {
      await fs.rmdir(this.memoryPath, { recursive: true })
      this.longTermMemory.clear()
      this.episodicMemory.clear()
      this.userProfile.clear()
      this.knowledgeGraph.clear()
      this.conversationHistory = []

      await this.initialize()
      console.log('🧹 Memória quântica resetada')
    } catch (error) {
      console.error('❌ Erro ao resetar memória:', error)
    }
  }
}

export default QuantumMemory
