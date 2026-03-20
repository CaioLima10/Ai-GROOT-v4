// GROOT MEMORY SYSTEM - Supabase Integration
// Sistema de memória persistente para GROOT

import { createClient } from '@supabase/supabase-js'

// Configuração Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'placeholder-key'

export class GrootMemory {
  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseKey)
    this.userId = 'default_user' // TODO: Implementar sistema de usuários
  }

  // 🧠 SALVAR CONVERSA
  async saveConversation(userMessage, aiResponse, metadata = {}) {
    try {
      const { data, error } = await this.supabase
        .from('conversations')
        .insert({
          user_id: this.userId,
          user_message: userMessage,
          ai_response: aiResponse,
          metadata: {
            timestamp: new Date().toISOString(),
            style: metadata.userStyle,
            confidence: metadata.confidence,
            provider: metadata.provider
          }
        })
        .select()

      if (error) throw error
      console.log('✅ Conversa salva na memória')
      return data[0]
    } catch (error) {
      console.error('❌ Erro ao salvar conversa:', error)
      return null
    }
  }

  // 📚 BUSCAR HISTÓRICO RECENTE
  async getRecentHistory(limit = 10) {
    try {
      const { data, error } = await this.supabase
        .from('conversations')
        .select('*')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data.reverse() // Mais antigo primeiro
    } catch (error) {
      console.error('❌ Erro ao buscar histórico:', error)
      return []
    }
  }

  // 👤 ATUALIZAR PERFIL DO USUÁRIO
  async updateUserProfile(preferences) {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .upsert({
          user_id: this.userId,
          preferences: preferences,
          updated_at: new Date().toISOString()
        })
        .select()

      if (error) throw error
      console.log('✅ Perfil do usuário atualizado')
      return data[0]
    } catch (error) {
      console.error('❌ Erro ao atualizar perfil:', error)
      return null
    }
  }

  // 🎯 BUSCAR PERFIL DO USUÁRIO
  async getUserProfile() {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', this.userId)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data || { preferences: { style: 'natural' } }
    } catch (error) {
      console.error('❌ Erro ao buscar perfil:', error)
      return { preferences: { style: 'natural' } }
    }
  }

  // 🧠 APRENDER COM INTERAÇÃO
  async learnFromInteraction(userMessage, aiResponse, metadata) {
    // Salvar conversa
    await this.saveConversation(userMessage, aiResponse, metadata)
    
    // Atualizar perfil baseado no estilo detectado
    if (metadata.userStyle) {
      const profile = await this.getUserProfile()
      const currentStyle = profile.preferences.style || 'natural'
      
      // Se o estilo mudar, atualizar perfil
      if (metadata.userStyle !== currentStyle) {
        await this.updateUserProfile({
          ...profile.preferences,
          style: metadata.userStyle,
          last_interaction: new Date().toISOString()
        })
      }
    }
  }

  // 🔍 BUSCAR CONTEXTO PARA PROMPT
  async getContextForPrompt() {
    const history = await this.getRecentHistory(5)
    const profile = await this.getUserProfile()
    
    return {
      history: history.map(h => ({
        user: h.user_message,
        ai: h.ai_response,
        timestamp: h.created_at
      })),
      userProfile: profile.preferences,
      contextSummary: this.generateContextSummary(history)
    }
  }

  // 📝 GERAR RESUMO DE CONTEXTO
  generateContextSummary(history) {
    if (history.length === 0) return 'Início de conversa'
    
    const topics = history.map(h => {
      // Extrair palavras-chave das mensagens
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
export const grootMemory = new GrootMemory()
