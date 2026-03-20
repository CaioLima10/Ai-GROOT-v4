// Supabase Client Configuration
// Note: You need to install @supabase/supabase-js first
// npm install @supabase/supabase-js

let supabaseClient = null

export function initializeSupabase() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY

    // Check if environment variables are available
    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️ Supabase environment variables not found (SUPABASE_URL / SUPABASE_ANON_KEY). Using mock client.')
      return createMockClient()
    }

    // Dynamic import to handle optional dependency
    import('@supabase/supabase-js').then(({ createClient }) => {
      supabaseClient = createClient(supabaseUrl, supabaseKey)
      console.log('✅ Supabase client initialized')
    }).catch(error => {
      console.warn('⚠️ Supabase not available, using mock client:', error.message)
      supabaseClient = createMockClient()
    })

  } catch (error) {
    console.error('❌ Error initializing Supabase:', error)
    return createMockClient()
  }
}

function createMockClient() {
  const mockData = new Map()

  return {
    from: (table) => ({
      insert: async (data) => {
        const records = Array.isArray(data) ? data : [data]
        const inserted = records.map(record => ({
          ...record,
          id: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          created_at: new Date().toISOString()
        }))

        if (!mockData.has(table)) {
          mockData.set(table, [])
        }
        mockData.get(table).push(...inserted)

        console.log(`📝 Mock insert: ${table} (${inserted.length} records)`)

        return { data: inserted, error: null }
      },

      select: async (columns = '*') => {
        const tableData = mockData.get(table) || []
        console.log(`📖 Mock select: ${table} (${tableData.length} records)`)

        return {
          data: tableData,
          error: null
        }
      },

      update: async (updates) => ({
        eq: async (column, value) => {
          const tableData = mockData.get(table) || []
          const updated = tableData.map(record =>
            record[column] === value ? { ...record, ...updates, updated_at: new Date().toISOString() } : record
          )
          mockData.set(table, updated)

          console.log(`✏️ Mock update: ${table} (${updated.filter(r => r[column] === value).length} records)`)

          return { data: updated.filter(r => r[column] === value), error: null }
        }
      }),

      delete: async () => ({
        eq: async (column, value) => {
          const tableData = mockData.get(table) || []
          const deleted = tableData.filter(record => record[column] === value)
          const remaining = tableData.filter(record => record[column] !== value)
          mockData.set(table, remaining)

          console.log(`🗑️ Mock delete: ${table} (${deleted.length} records)`)

          return { data: deleted, error: null }
        }
      }),

      limit: async (limit) => {
        const tableData = mockData.get(table) || []
        const limited = tableData.slice(0, limit)
        console.log(`📊 Mock limit: ${table} (${limited.length} records)`)

        return { data: limited, error: null }
      },

      order: async (column, { ascending = true } = {}) => {
        const tableData = mockData.get(table) || []
        const sorted = [...tableData].sort((a, b) => {
          const aVal = a[column]
          const bVal = b[column]
          if (aVal < bVal) return ascending ? -1 : 1
          if (aVal > bVal) return ascending ? 1 : -1
          return 0
        })

        console.log(`📈 Mock order: ${table} (${sorted.length} records)`)

        return { data: sorted, error: null }
      },

      ilike: async (column, value) => {
        const tableData = mockData.get(table) || []
        const filtered = tableData.filter(record => {
          const fieldValue = record[column]
          if (typeof fieldValue !== 'string') return false
          return fieldValue.toLowerCase().includes(value.toLowerCase().replace(/%/g, ''))
        })

        console.log(`🔍 Mock ilike: ${table} (${filtered.length} records)`)

        return {
          data: filtered,
          error: null,
          limit: async (limit) => {
            const limited = filtered.slice(0, limit)
            console.log(`📊 Mock limit: ${table} (${limited.length} records)`)
            return { data: limited, error: null }
          },
          order: async (column, { ascending = true } = {}) => {
            const sorted = [...filtered].sort((a, b) => {
              const aVal = a[column]
              const bVal = b[column]
              if (aVal < bVal) return ascending ? -1 : 1
              if (aVal > bVal) return ascending ? 1 : -1
              return 0
            })
            console.log(`📈 Mock order: ${table} (${sorted.length} records)`)
            return { data: sorted, error: null }
          }
        }
      }
    })
  }
}

// Initialize on import
const supabase = initializeSupabase()

export default supabase
