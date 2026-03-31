import { grootAdvancedRAG } from "../packages/ai-core/src/index.js"

export class MultimodalRAG {
  constructor() {
    this.enabled = Boolean(grootAdvancedRAG)
  }

  async addImageEmbedding(imageBuffer, metadata = {}) {
    try {
      const text = await this.extractImageText(imageBuffer)
      if (!text) {
        return { success: false, reason: "no_text_extracted", metadata }
      }

      const payload = {
        ...metadata,
        source: metadata.source || "multimodal.image",
        category: metadata.category || "multimodal",
        categories: metadata.categories || ["multimodal", "image"],
        modules: metadata.modules || ["vision", "reasoning"],
        extractionMethod: metadata.extractionMethod || "tesseract"
      }

      const row = await grootAdvancedRAG.upsertKnowledge(text, payload)
      return { success: Boolean(row), reason: row ? "ok" : "persist_failed", metadata: payload, textLength: text.length }
    } catch (error) {
      return { success: false, reason: error.message || "image_ingest_error", metadata }
    }
  }

  async addSnippetEmbedding(snippet, metadata = {}) {
    const content = String(snippet || "").trim()
    if (!content) {
      return { success: false, reason: "empty_snippet", metadata }
    }

    const payload = {
      ...metadata,
      source: metadata.source || "multimodal.snippet",
      category: metadata.category || "multimodal",
      categories: metadata.categories || ["multimodal", "snippet"],
      modules: metadata.modules || ["reasoning"]
    }

    const row = await grootAdvancedRAG.upsertKnowledge(content, payload)
    return { success: Boolean(row), reason: row ? "ok" : "persist_failed", metadata: payload }
  }

  async search(query, options = {}) {
    const response = await grootAdvancedRAG.searchKnowledge(query, {
      language: options.language || null,
      limit: Number(options.limit || 5),
      categories: Array.isArray(options.categories) ? options.categories : ["multimodal"]
    })

    return {
      results: response?.knowledge || [],
      query,
      options,
      enabled: this.enabled
    }
  }

  async extractImageText(imageBuffer) {
    const { createWorker } = await import("tesseract.js")
    const worker = await createWorker(process.env.OCR_LANG || "por+eng")
    try {
      const { data } = await worker.recognize(imageBuffer)
      return String(data?.text || "").trim()
    } finally {
      await worker.terminate().catch(() => { })
    }
  }
}

export const multimodalRAG = new MultimodalRAG()
