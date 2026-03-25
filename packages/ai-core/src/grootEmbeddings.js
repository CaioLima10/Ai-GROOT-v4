import axios from "axios"
import dotenv from "dotenv"
import { grootFreeEmbeddings } from "./grootFreeEmbeddings.js"
import {
  getLocalEmbeddingDimensions,
  getOllamaEmbeddingDimensions,
  getOpenAIEmbeddingDimensions
} from "../../shared-config/src/embeddings.js"

dotenv.config()

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "")
const EMBEDDINGS_PROVIDER = (process.env.EMBEDDINGS_PROVIDER || "auto").toLowerCase()

export class GrootEmbeddings {
  constructor() {
    this.openaiClient = null
    this.provider = this.resolveProvider()
    this.dimensions = this.resolveDimensions(this.provider)
  }

  resolveProvider() {
    const ollamaPreferred =
      process.env.OLLAMA_ENABLED === "true" ||
      EMBEDDINGS_PROVIDER === "ollama" ||
      (process.env.GROOT_AI_PROVIDER || "").toLowerCase() === "ollama"

    if (EMBEDDINGS_PROVIDER === "local") return "local"
    if (EMBEDDINGS_PROVIDER === "openai") return process.env.OPENAI_API_KEY ? "openai" : "local"
    if (ollamaPreferred) return "ollama"
    if (EMBEDDINGS_PROVIDER === "auto") return "local"
    return "local"
  }

  resolveDimensions(provider) {
    if (provider === "openai") return getOpenAIEmbeddingDimensions()
    if (provider === "ollama") return getOllamaEmbeddingDimensions()
    return getLocalEmbeddingDimensions()
  }

  async getOpenAIClient() {
    if (this.openaiClient) return this.openaiClient

    const sdk = await import("openai")
    this.openaiClient = new sdk.OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined
    })
    return this.openaiClient
  }

  async generateEmbedding(text) {
    this.provider = this.resolveProvider()
    this.dimensions = this.resolveDimensions(this.provider)

    try {
      if (this.provider === "openai") {
        return await this.generateOpenAIEmbedding(text)
      }

      if (this.provider === "ollama") {
        return await this.generateOllamaEmbedding(text)
      }

      return await grootFreeEmbeddings.generateEmbedding(text)
    } catch (error) {
      console.warn(`⚠️ Embeddings ${this.provider} falharam, usando fallback local:`, error.message)
      this.provider = "local"
      this.dimensions = grootFreeEmbeddings.dimensions
      return await grootFreeEmbeddings.generateEmbedding(text)
    }
  }

  async generateOpenAIEmbedding(text) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY nao configurada")
    }

    const client = await this.getOpenAIClient()
    const response = await client.embeddings.create({
      model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
      input: text,
      encoding_format: "float"
    })

    const embedding = response?.data?.[0]?.embedding
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("Embedding invalido do OpenAI")
    }

    return embedding
  }

  async generateOllamaEmbedding(text) {
    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/embed`,
      {
        model: process.env.OLLAMA_EMBEDDING_MODEL || "embeddinggemma",
        input: text
      },
      {
        headers: {
          "Content-Type": "application/json",
          ...(process.env.OLLAMA_API_KEY ? { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` } : {})
        },
        timeout: Number(process.env.OLLAMA_EMBEDDING_TIMEOUT_MS || 120000)
      }
    )

    const embedding = response?.data?.embeddings?.[0]
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("Embedding invalido do Ollama")
    }

    return embedding
  }

  async generateBatchEmbeddings(texts) {
    const embeddings = []

    for (const text of texts) {
      try {
        const embedding = await this.generateEmbedding(text)
        embeddings.push({ text, embedding })
      } catch (error) {
        console.error(`❌ Erro no texto: ${String(text).substring(0, 50)}...`, error.message)
      }
    }

    return embeddings
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

  getStatus() {
    return {
      provider: this.provider,
      dimensions: this.dimensions,
      model: this.provider === "ollama"
        ? (process.env.OLLAMA_EMBEDDING_MODEL || "embeddinggemma")
        : (this.provider === "openai"
            ? (process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small")
            : `giom-local-${this.dimensions}`),
      freeFirst: this.provider !== "openai"
    }
  }
}

export const grootEmbeddings = new GrootEmbeddings()
