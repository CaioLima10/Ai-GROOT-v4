// RAG multimodal (placeholder) - pronto para expansão futura

export class MultimodalRAG {
  constructor() {
    this.enabled = false
  }

  async addImageEmbedding(imageBuffer, metadata = {}) {
    // Placeholder: conectar futuramente a um modelo de embeddings multimodal
    console.log('📷 MultimodalRAG: ingestão de imagem pendente')
    return { success: false, reason: 'not_implemented', metadata }
  }

  async addSnippetEmbedding(snippet, metadata = {}) {
    console.log('🧩 MultimodalRAG: ingestão de snippet pendente')
    return { success: false, reason: 'not_implemented', metadata }
  }

  async search(query, options = {}) {
    return {
      results: [],
      query,
      options,
      enabled: this.enabled
    }
  }
}

export const multimodalRAG = new MultimodalRAG()
