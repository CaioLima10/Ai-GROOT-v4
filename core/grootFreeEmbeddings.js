// GROOT EMBEDDINGS GRÁTITOS - Versão Local (100% funcional)
export class GrootFreeEmbeddings {
  constructor() {
    // Usar apenas embeddings locais (sem dependências externas)
    this.useLocal = true
    this.dimensions = 384
  }

  async generateEmbedding(text) {
    try {
      return this.generateLocalEmbedding(text)
    } catch (error) {
      console.error('❌ Erro ao gerar embedding:', error.message)
      throw error
    }
  }

  // EMBEDDING LOCAL (TF-IDF MELHORADO)
  generateLocalEmbedding(text) {
    const words = this.preprocessText(text)
    const wordFreq = {}

    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1
    })

    // Vetor de 384 dimensões (compatível com HuggingFace)
    const embedding = new Array(384).fill(0)

    words.forEach((word, index) => {
      const hash = this.advancedHash(word)
      const position = hash % 384
      embedding[position] += wordFreq[word] / words.length
    })

    // Normalizar
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    return embedding.map(val => val / norm)
  }

  preprocessText(text) {
    return text.toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 2)
      .filter(word => !this.isStopWord(word))
  }

  isStopWord(word) {
    const stopWords = ['o', 'a', 'os', 'as', 'de', 'do', 'da', 'em', 'para', 'com', 'sem', 'por', 'que', 'um', 'uma']
    return stopWords.includes(word)
  }

  advancedHash(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash)
  }

  calculateSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2) return 0

    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let i = 0; i < Math.min(embedding1.length, embedding2.length); i++) {
      dotProduct += embedding1[i] * embedding2[i]
      norm1 += embedding1[i] * embedding1[i]
      norm2 += embedding2[i] * embedding2[i]
    }

    norm1 = Math.sqrt(norm1)
    norm2 = Math.sqrt(norm2)

    if (norm1 === 0 || norm2 === 0) return 0

    return dotProduct / (norm1 * norm2)
  }
}

export const grootFreeEmbeddings = new GrootFreeEmbeddings()
