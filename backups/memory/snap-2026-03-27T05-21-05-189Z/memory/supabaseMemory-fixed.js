import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"

dotenv.config()

export default class SupabaseMemory {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
      process.env.SUPABASE_KEY || 'placeholder-key'
    )
    this.tableName = 'memory'
    console.log('🗄️ SupabaseMemory initialized')
  }

  async save(text, type = "interaction") {
    try {
      console.log('💾 Saving to Supabase:', text.substring(0, 50) + '...')
      
      const { error } = await this.supabase
        .from(this.tableName)
        .insert([
          {
            text,
            type,
            created_at: new Date().toISOString()
          }
        ])

      if (error) {
        console.error('❌ Supabase save error:', error.message)
        return { success: false, error: error.message }
      }

      console.log('✅ Saved to Supabase successfully')
      return { success: true }

    } catch (error) {
      console.error('❌ Error saving to Supabase:', error.message)
      return { success: false, error: error.message }
    }
  }

  async search(query, limit = 10) {
    try {
      console.log('🔍 Searching Supabase for:', query)
      
      // MÉTODO CORRETO: Usar textSearch (se disponível) ou fallback para select
      let result
      
      try {
        // Tentar usar textSearch se disponível (Supabase v2)
        result = await this.supabase
          .from(this.tableName)
          .select('*')
          .textSearch('text', query, { 
            type: 'websearch',
            config: 'portuguese' 
          })
          .limit(limit)

        console.log('✅ Using textSearch method')
        
      } catch (textSearchError) {
        console.log('⚠️ textSearch not available, using fallback')
        
        // Fallback: buscar tudo e filtrar manualmente
        const { data, error } = await this.supabase
          .from(this.tableName)
          .select('*')
          .limit(100) // Limitar para não sobrecarregar

        if (error) {
          throw error
        }

        // Filtrar manualmente
        const filtered = (data || []).filter(record => {
          if (!record.text || typeof record.text !== 'string') return false
          return record.text.toLowerCase().includes(query.toLowerCase())
        }).slice(0, limit)

        console.log(`✅ Manual search: ${filtered.length} results`)
        return { success: true, data: filtered }
      }

      if (result.error) {
        throw new Error(result.error.message)
      }

      console.log(`✅ Supabase search: ${result.data?.length || 0} results`)
      return { success: true, data: result.data || [] }

    } catch (error) {
      console.error('❌ Error searching Supabase:', error.message)
      return { success: false, error: error.message, data: [] }
    }
  }

  async load(limit = 50) {
    try {
      console.log('📖 Loading from Supabase...')
      
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('❌ Error loading from Supabase:', error.message)
        return { success: false, error: error.message, data: [] }
      }

      console.log(`✅ Loaded ${data?.length || 0} records from Supabase`)
      return { success: true, data: data || [] }

    } catch (error) {
      console.error('❌ Error loading from Supabase:', error.message)
      return { success: false, error: error.message, data: [] }
    }
  }

  async getStats() {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('type')

      if (error) {
        console.error('❌ Error getting stats:', error.message)
        return { totalRecords: 0, typeCounts: {} }
      }

      const typeCounts = {}
      ;(data || []).forEach(record => {
        typeCounts[record.type] = (typeCounts[record.type] || 0) + 1
      })

      return {
        totalRecords: data?.length || 0,
        typeCounts
      }

    } catch (error) {
      console.error('❌ Error getting stats:', error.message)
      return { totalRecords: 0, typeCounts: {} }
    }
  }
}
