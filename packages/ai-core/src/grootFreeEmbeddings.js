import { getLocalEmbeddingDimensions } from "../../shared-config/src/embeddings.js"

export class GrootFreeEmbeddings {
  constructor() {
    this.useLocal = true
    this.dimensions = getLocalEmbeddingDimensions()
  }

  async generateEmbedding(text) {
    try {
      this.dimensions = getLocalEmbeddingDimensions()
      return this.generateLocalEmbedding(text)
    } catch (error) {
      console.error("❌ Erro ao gerar embedding:", error.message)
      throw error
    }
  }

  generateLocalEmbedding(text) {
    const words = this.preprocessText(text)
    const wordFreq = {}

    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1
    })

    const dimensions = this.dimensions
    const embedding = new Array(dimensions).fill(0)
    if (words.length === 0) {
      return embedding
    }

    words.forEach(word => {
      const hash = this.advancedHash(word)
      const position = hash % dimensions
      embedding[position] += wordFreq[word] / words.length
    })

    const norm = Math.sqrt(embedding.reduce((sum, value) => sum + value * value, 0))
    if (!norm) {
      return embedding
    }

    return embedding.map(value => value / norm)
  }

  preprocessText(text) {
    return String(text || "")
      .toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 2)
      .filter(word => !this.isStopWord(word))
  }

  isStopWord(word) {
    const stopWords = ["o", "a", "os", "as", "de", "do", "da", "em", "para", "com", "sem", "por", "que", "um", "uma"]
    return stopWords.includes(word)
  }

  advancedHash(text) {
    let hash = 0
    for (let index = 0; index < text.length; index += 1) {
      const char = text.charCodeAt(index)
      hash = ((hash << 5) - hash) + char
      hash &= hash
    }
    return Math.abs(hash)
  }

  calculateSimilarity(embedding1, embedding2) {
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

    if (norm1 === 0 || norm2 === 0) return 0
    return dotProduct / (norm1 * norm2)
  }
}

export const grootFreeEmbeddings = new GrootFreeEmbeddings()
