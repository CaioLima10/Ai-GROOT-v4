// GROOT RAG SYSTEM - Retrieval Augmented Generation
// Sistema de aprendizado e busca de conhecimento

import { grootMemoryConnector } from './grootMemoryConnector.js'

export class GrootRAG {
  constructor() {
    this.knowledgeBase = new Map()
    this.embeddingsCache = new Map()
  }

  // 📚 ADICIONAR CONHECIMENTO
  async addKnowledge(title, content, category = 'general', metadata = {}) {
    const knowledge = {
      id: Date.now().toString(),
      title,
      content,
      category,
      metadata: {
        ...metadata,
        created_at: new Date().toISOString(),
        source: 'manual',
        embedding: await this.generateEmbedding(content)
      }
    }

    this.knowledgeBase.set(knowledge.id, knowledge)
    console.log(`📚 Conhecimento adicionado: ${title}`)
    return knowledge
  }

  // 🔍 BUSCAR CONHECIMENTO RELEVANTE
  async searchKnowledge(query, limit = 5) {
    const queryEmbedding = await this.generateEmbedding(query)
    const results = []

    for (const [id, knowledge] of this.knowledgeBase) {
      const similarity = this.calculateSimilarity(
        queryEmbedding,
        knowledge.metadata.embedding
      )

      if (similarity > 0.3) {
        results.push({
          ...knowledge,
          similarity,
          id
        })
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
  }

  // 🧠 GERAR EMBEDDINGS (SIMPLIFICADO)
  async generateEmbedding(text) {
    // Embedding baseado em TF-IDF simplificado
    const words = text.toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 2)

    const wordFreq = {}
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1
    })

    // Vetor simplificado de 100 dimensões
    const embedding = new Array(100).fill(0)
    words.forEach((word, index) => {
      const hash = this.simpleHash(word)
      embedding[hash % 100] += wordFreq[word] / (words.length || 1)
    })

    return embedding
  }

  // 🔢 HASH SIMPLES PARA EMBEDDINGS
  simpleHash(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash)
  }

  // 📏 CALCULAR SIMILARIDADE (COSINE SIMILARITY)
  calculateSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2) return 0

    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i]
      norm1 += embedding1[i] * embedding1[i]
      norm2 += embedding2[i] * embedding2[i]
    }

    norm1 = Math.sqrt(norm1)
    norm2 = Math.sqrt(norm2)

    if (norm1 === 0 || norm2 === 0) return 0

    return dotProduct / (norm1 * norm2)
  }

  // 🎯 ENRIQUECER PERGUNTA COM CONHECIMENTO
  async enrichQuery(query) {
    const relevantKnowledge = await this.searchKnowledge(query)

    if (relevantKnowledge.length === 0) {
      return {
        query,
        context: '',
        knowledge: []
      }
    }

    const context = relevantKnowledge
      .map(k => `**${k.title}**: ${k.content}`)
      .join('\n\n')

    return {
      query,
      context,
      knowledge: relevantKnowledge
    }
  }

  // 🧪 APRENDER COM INTERAÇÕES
  async learnFromInteraction(userMessage, aiResponse, metadata = {}) {
    // Extrair conceitos da interação
    const concepts = this.extractConcepts(userMessage, aiResponse)

    concepts.forEach(concept => {
      this.addKnowledge(
        concept.title,
        concept.content,
        concept.category,
        {
          source: 'interaction',
          confidence: concept.confidence,
          user_message: userMessage,
          ai_response: aiResponse
        }
      )
    })

    console.log(`🧪 Aprendido ${concepts.length} conceitos da interação`)
  }

  // 📝 EXTRAIR CONCEITOS
  extractConcepts(userMessage, aiResponse) {
    const concepts = []

    // Padrões para extrair conceitos técnicos
    const patterns = [
      {
        regex: /(\w+)\s*(?:é|funciona como|serve para)/gi,
        category: 'definition'
      },
      {
        regex: /(?:crie|implemente|desenvolva)\s*(\w+)/gi,
        category: 'implementation'
      },
      {
        regex: /(?:erro|problema|bug)\s*(?:em|no)?\s*(\w+)/gi,
        category: 'debugging'
      },
      {
        regex: /(?:otimize|melhore)\s*(\w+)/gi,
        category: 'optimization'
      }
    ]

    patterns.forEach(pattern => {
      const matches = [...userMessage.matchAll(pattern.regex)]
      matches.forEach(match => {
        if (match[1]) {
          concepts.push({
            title: match[1],
            content: aiResponse.substring(0, 200),
            category: pattern.category,
            confidence: 0.8
          })
        }
      })
    })

    return concepts
  }

  // 📊 OBTER ESTATÍSTICAS DE APRENDIZADO
  getLearningStats() {
    const categories = {}
    let totalKnowledge = 0

    for (const [id, knowledge] of this.knowledgeBase) {
      totalKnowledge++
      categories[knowledge.category] = (categories[knowledge.category] || 0) + 1
    }

    return {
      totalKnowledge,
      categories,
      topCategories: Object.entries(categories)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([cat, count]) => ({ category: cat, count }))
    }
  }
}

// Exportar instância global
export const grootRAG = new GrootRAG()
