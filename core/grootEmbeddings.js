// GROOT EMBEDDINGS PROFISSIONAIS - OpenAI Integration
import { OpenAI } from 'openai'

export class GrootEmbeddings {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
    this.dimensions = 1536
  }

  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
        encoding_format: "float"
      })
      
      return response.data[0].embedding
    } catch (error) {
      console.error('❌ Erro ao gerar embedding:', error.message)
      throw error
    }
  }

  async generateBatchEmbeddings(texts) {
    const embeddings = []
    
    for (const text of texts) {
      try {
        const embedding = await this.generateEmbedding(text)
        embeddings.push({ text, embedding })
      } catch (error) {
        console.error(`❌ Erro no texto: ${text.substring(0, 50)}...`)
      }
    }
    
    return embeddings
  }

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
}

export const grootEmbeddings = new GrootEmbeddings()
