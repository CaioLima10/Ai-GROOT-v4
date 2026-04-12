import supabase from "../db/supabase.js"

export { SupabaseMemory }

export default class SupabaseMemory {
  constructor() {
    this.supabase = supabase
    this.tableName = 'memory'
    console.log('🗄️ SupabaseMemory initialized')
  }

  async save(text, type = "interaction", metadata = null) {
    try {
      console.log('💾 Saving to Supabase:', text.substring(0, 50) + '...')
      
      const { error } = await this.supabase
        .from(this.tableName)
        .insert([
          {
            text,
            type,
            metadata,
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
      
      // Usar busca manual (mais robusta que ilike)
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .limit(100) // Buscar mais registros

      if (error) {
        console.error('❌ Supabase search error:', error.message)
        return { success: false, error: error.message, data: [] }
      }

      // Filtrar manualmente (método mais robusto)
      const filtered = (data || []).filter(record => {
        if (!record.text || typeof record.text !== 'string') return false
        return record.text.toLowerCase().includes(query.toLowerCase())
      }).slice(0, limit)

      console.log(`✅ Supabase search: ${filtered.length} results`)
      return { success: true, data: filtered }

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
