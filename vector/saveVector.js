import supabase from '../db/supabase.js'
import { embedder } from '../embeddings/embedder.js'

export class VectorStore {
  constructor() {
    this.tableName = 'vector_memory'
    this.batchSize = 100
  }

  async saveVector(text, metadata = {}) {
    try {
      // Gerar embedding real
      const embedding = await embedder.embed(text)

      const record = {
        text,
        vector: embedding,
        type: metadata.type || 'general',
        metadata: {
          ...metadata,
          timestamp: Date.now(),
          dimensions: embedding.length,
          source: 'groot'
        }
      }

      // Salvar no Supabase
      const { data, error } = await supabase
        .from(this.tableName)
        .insert([record])

      if (error) {
        console.error('❌ Error saving vector:', error)
        return { success: false, error: error.message }
      }

      console.log(`💾 Vector saved: ${text.substring(0, 50)}... (${embedding.length} dimensions)`)

      return {
        success: true,
        data: data[0],
        embedding: embedding
      }

    } catch (error) {
      console.error('❌ Error in saveVector:', error)
      return { success: false, error: error.message }
    }
  }

  async saveBatch(texts, metadata = {}) {
    console.log(`💾 Saving batch vectors: ${texts.length} texts`)

    const results = []

    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize)

      const batchResults = await Promise.all(
        batch.map(text => this.saveVector(text, { ...metadata, batchIndex: i / this.batchSize }))
      )

      results.push(...batchResults)
    }

    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    console.log(`✅ Batch save completed: ${successful} successful, ${failed} failed`)

    return {
      total: texts.length,
      successful,
      failed,
      results
    }
  }

  async searchVectors(queryText, limit = 10, threshold = 0.7) {
    try {
      console.log(`🔍 Searching vectors: ${queryText.substring(0, 50)}...`)

      // Gerar embedding da query
      const queryEmbedding = await embedder.embed(queryText)

      // Buscar todos os vetores (em implementação real, usar busca vetorial do Supabase)
      const { data: vectors, error } = await supabase
        .from(this.tableName)
        .select('*')
        .limit(100) // Limitar para performance

      if (error) {
        console.error('❌ Error searching vectors:', error)
        return { success: false, error: error.message, results: [] }
      }

      // Calcular similaridade
      const scoredVectors = []

      for (const vector of vectors || []) {
        if (vector.vector && Array.isArray(vector.vector)) {
          const similarity = embedder.calculateSimilarity(queryEmbedding, vector.vector)

          if (similarity >= threshold) {
            scoredVectors.push({
              ...vector,
              similarity,
              distance: 1 - similarity
            })
          }
        }
      }

      // Ordenar por similaridade
      scoredVectors.sort((a, b) => b.similarity - a.similarity)

      const results = scoredVectors.slice(0, limit)

      console.log(`✅ Vector search completed: ${results.length} results (threshold: ${threshold})`)

      return {
        success: true,
        results,
        queryEmbedding: queryEmbedding,
        threshold,
        totalChecked: vectors?.length || 0
      }

    } catch (error) {
      console.error('❌ Error in searchVectors:', error)
      return { success: false, error: error.message, results: [] }
    }
  }

  async getVector(id) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        console.error('❌ Error getting vector:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data }

    } catch (error) {
      console.error('❌ Error in getVector:', error)
      return { success: false, error: error.message }
    }
  }

  async updateVector(id, updates) {
    try {
      let updateData = { ...updates }

      // Se o texto foi atualizado, gerar novo embedding
      if (updates.text) {
        const newEmbedding = await embedder.embed(updates.text)
        updateData.vector = newEmbedding
        updateData.metadata = {
          ...updates.metadata,
          updated_at: new Date().toISOString(),
          dimensions: newEmbedding.length
        }
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .update(updateData)
        .eq('id', id)

      if (error) {
        console.error('❌ Error updating vector:', error)
        return { success: false, error: error.message }
      }

      console.log(`✏️ Vector updated: ${id}`)
      return { success: true, data }

    } catch (error) {
      console.error('❌ Error in updateVector:', error)
      return { success: false, error: error.message }
    }
  }

  async deleteVector(id) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .delete()
        .eq('id', id)

      if (error) {
        console.error('❌ Error deleting vector:', error)
        return { success: false, error: error.message }
      }

      console.log(`🗑️ Vector deleted: ${id}`)
      return { success: true, data }

    } catch (error) {
      console.error('❌ Error in deleteVector:', error)
      return { success: false, error: error.message }
    }
  }

  async getStats() {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('id, type, metadata')

      if (error) {
        console.error('❌ Error getting stats:', error)
        return this.getOfflineStats()
      }

      const typeCounts = {}
      const dimensionCounts = {}

      if (data && Array.isArray(data)) {
        data.forEach(vector => {
          if (vector && vector.type) {
            typeCounts[vector.type] = (typeCounts[vector.type] || 0) + 1

            const dimensions = vector.metadata?.dimensions || 0
            dimensionCounts[dimensions] = (dimensionCounts[dimensions] || 0) + 1
          }
        })
      }

      return {
        totalVectors: data?.length || 0,
        typeCounts,
        dimensionCounts,
        embedderStats: embedder.getStats(),
        tableName: this.tableName
      }

    } catch (error) {
      console.error('❌ Error in getStats:', error)
      return this.getOfflineStats()
    }
  }

  getOfflineStats() {
    return {
      totalVectors: 0,
      typeCounts: {},
      dimensionCounts: {},
      embedderStats: embedder.getStats(),
      tableName: this.tableName,
      mode: 'offline'
    }
  }

  async createTable() {
    console.log('🔧 Creating vector table in Supabase...')

    // Nota: Esta tabela precisa ser criada manualmente no Supabase
    // SQL para criação:
    /*
    CREATE TABLE vector_memory (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      text TEXT NOT NULL,
      vector REAL[] NOT NULL,
      type TEXT DEFAULT 'general',
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    CREATE INDEX vector_memory_type_idx ON vector_memory(type);
    CREATE INDEX vector_memory_created_idx ON vector_memory(created_at);
    */

    console.log('📋 Vector table schema:')
    console.log(`
    CREATE TABLE vector_memory (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      text TEXT NOT NULL,
      vector REAL[] NOT NULL,
      type TEXT DEFAULT 'general',
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    `)

    return { success: true, message: 'Table schema provided' }
  }

  exportVectorData() {
    return {
      tableName: this.tableName,
      batchSize: this.batchSize,
      embedderStats: embedder.getStats(),
      exportTimestamp: Date.now()
    }
  }
}

export const vectorStore = new VectorStore()
