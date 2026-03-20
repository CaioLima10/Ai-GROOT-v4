// GROOT MEMORY CONNECTOR - Conexão real com Supabase
import { createClient } from '@supabase/supabase-js'

// Configuração Supabase via variáveis de ambiente
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY
const hasSupabaseConfig = !!(supabaseUrl && supabaseKey)
const usingServiceKey = !!process.env.SUPABASE_SERVICE_KEY

export class GrootMemoryConnector {
  constructor() {
    this.supabase = hasSupabaseConfig ? createClient(supabaseUrl, supabaseKey) : null
    this.isConnected = false
    this.localMemory = new Map() // Memória local para Node.js

    if (!hasSupabaseConfig) {
      console.warn('⚠️ Supabase não configurado (SUPABASE_URL / SUPABASE_ANON_KEY). Usando memória local.')
    } else {
      if (!usingServiceKey) {
        console.warn('⚠️ Usando SUPABASE_ANON_KEY. Se o RLS estiver ativo, inserts podem falhar.')
        console.warn('   Recomendo usar SUPABASE_SERVICE_KEY no backend.')
      }
      // Tentativa inicial de conexão (não bloqueante)
      this.testConnection().catch(error => {
        console.warn('⚠️ Falha na conexão inicial com Supabase:', error.message)
      })
    }
  }

  async testConnection() {
    if (!this.supabase) {
      return false
    }
    try {
      const { data, error } = await this.supabase
        .from('conversations')
        .select('count')
        .limit(1)

      if (error) {
        console.error('❌ Erro na conexão Supabase:', error)
        return false
      }

      console.log('✅ Conexão Supabase estabelecida!')
      this.isConnected = true
      return true
    } catch (error) {
      console.error('❌ Falha ao conectar Supabase:', error)
      return false
    }
  }

  async saveConversation(userId, userMessage, aiResponse, metadata = {}) {
    if (!this.isConnected || !this.supabase) {
      console.warn('⚠️ Supabase não conectado - usando fallback local')
      return this.saveLocalFallback(userId, userMessage, aiResponse, metadata)
    }

    try {
      const { data, error } = await this.supabase
        .from('conversations')
        .insert({
          user_id: userId,
          user_message: userMessage,
          ai_response: aiResponse,
          metadata: {
            timestamp: new Date().toISOString(),
            style: metadata.userStyle,
            confidence: metadata.confidence,
            provider: metadata.provider,
            session_id: metadata.sessionId
          }
        })
        .select()

      if (error) throw error
      console.log('✅ Conversa salva na Supabase')
      return data[0]
    } catch (error) {
      console.error('❌ Erro ao salvar conversa:', error)
      return this.saveLocalFallback(userId, userMessage, aiResponse, metadata)
    }
  }

  async getRecentHistory(userId, limit = 10) {
    if (!this.isConnected || !this.supabase) {
      console.warn('⚠️ Supabase não conectado - usando fallback local')
      return this.getLocalFallback(userId, limit)
    }

    try {
      const { data, error } = await this.supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data.reverse()
    } catch (error) {
      console.error('❌ Erro ao buscar histórico:', error)
      return this.getLocalFallback(userId, limit)
    }
  }

  async updateUserProfile(userId, preferences) {
    if (!this.isConnected || !this.supabase) {
      console.warn('⚠️ Supabase não conectado - usando fallback local')
      return this.updateLocalProfile(userId, preferences)
    }

    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          preferences: preferences,
          updated_at: new Date().toISOString()
        })
        .select()

      if (error) throw error
      console.log('✅ Perfil atualizado na Supabase')
      return data[0]
    } catch (error) {
      console.error('❌ Erro ao atualizar perfil:', error)
      return this.updateLocalProfile(userId, preferences)
    }
  }

  async getUserProfile(userId) {
    if (!this.isConnected || !this.supabase) {
      console.warn('⚠️ Supabase não conectado - usando fallback local')
      return this.getLocalProfile(userId)
    }

    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data || { preferences: { style: 'natural' } }
    } catch (error) {
      console.error('❌ Erro ao buscar perfil:', error)
      return this.getLocalProfile(userId)
    }
  }

  async saveLearningPattern(userId, patternType, patternData, confidence = 0.5) {
    if (!this.isConnected || !this.supabase) {
      console.warn('⚠️ Supabase não conectado - salvando padrão localmente')
      return this.saveLocalLearningPattern(userId, patternType, patternData, confidence)
    }

    try {
      const { data, error } = await this.supabase
        .from('learning_patterns')
        .insert({
          user_id: userId,
          pattern_type: patternType,
          pattern_data: patternData,
          confidence,
          created_at: new Date().toISOString()
        })
        .select()

      if (error) throw error
      console.log('✅ Padrão de aprendizado salvo na Supabase')
      return data[0]
    } catch (error) {
      console.error('❌ Erro ao salvar padrão de aprendizado:', error)
      return this.saveLocalLearningPattern(userId, patternType, patternData, confidence)
    }
  }

  async getLearningPatterns(userId, limit = 10) {
    if (!this.isConnected || !this.supabase) {
      return this.getLocalLearningPatterns(userId, limit)
    }

    try {
      const { data, error } = await this.supabase
        .from('learning_patterns')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('❌ Erro ao buscar padrões de aprendizado:', error)
      return this.getLocalLearningPatterns(userId, limit)
    }
  }

  // Fallback local para quando Supabase não está disponível (Node.js compatible)
  saveLocalFallback(userId, userMessage, aiResponse, metadata) {
    const storageKey = `groot_conversation_${userId}`
    const existing = this.localMemory.get(storageKey) || []

    existing.push({
      user_message: userMessage,
      ai_response: aiResponse,
      metadata,
      created_at: new Date().toISOString()
    })

    this.localMemory.set(storageKey, existing.slice(-50)) // Últimas 50
    console.log('✅ Conversa salva localmente (fallback)')
  }

  getLocalFallback(userId, limit = 10) {
    const storageKey = `groot_conversation_${userId}`
    const data = this.localMemory.get(storageKey) || []
    return data.slice(-limit).reverse()
  }

  updateLocalProfile(userId, preferences) {
    const storageKey = `groot_profile_${userId}`
    const existing = this.localMemory.get(storageKey) || {}

    this.localMemory.set(storageKey, {
      ...existing,
      preferences,
      updated_at: new Date().toISOString()
    })

    console.log('✅ Perfil atualizado localmente (fallback)')
    return { preferences }
  }

  getLocalProfile(userId) {
    const storageKey = `groot_profile_${userId}`
    const data = this.localMemory.get(storageKey) || {}
    return data || { preferences: { style: 'natural' } }
  }

  saveLocalLearningPattern(userId, patternType, patternData, confidence) {
    const storageKey = `groot_learning_${userId}`
    const existing = this.localMemory.get(storageKey) || []

    existing.push({
      user_id: userId,
      pattern_type: patternType,
      pattern_data: patternData,
      confidence,
      created_at: new Date().toISOString()
    })

    this.localMemory.set(storageKey, existing.slice(-50))
    return existing[existing.length - 1]
  }

  getLocalLearningPatterns(userId, limit = 10) {
    const storageKey = `groot_learning_${userId}`
    const data = this.localMemory.get(storageKey) || []
    return data.slice(-limit).reverse()
  }

  async getContextForPrompt(userId = 'default_user') {
    try {
      const [history, profile] = await Promise.all([
        this.getRecentHistory(userId, 5),
        this.getUserProfile(userId)
      ])

      return {
        history: history.map(h => ({
          user: h.user_message,
          ai: h.ai_response,
          timestamp: h.created_at
        })),
        userProfile: profile.preferences,
        contextSummary: this.generateContextSummary(history)
      }
    } catch (error) {
      console.error('❌ Erro ao buscar contexto:', error)
      return {
        history: [],
        userProfile: { style: 'natural' },
        contextSummary: 'Início de conversa'
      }
    }
  }

  generateContextSummary(history) {
    if (history.length === 0) return 'Início de conversa'

    const topics = history.map(h => {
      const keywords = h.user_message
        .toLowerCase()
        .split(' ')
        .filter(word => word.length > 3)
        .slice(0, 3)

      return keywords.join(', ')
    }).filter(Boolean)

    return `Tópicos discutidos: ${topics.slice(0, 5).join(' | ')}`
  }
}

// Exportar instância global
export const grootMemoryConnector = new GrootMemoryConnector()
