import dotenv from "dotenv"
import { createClient } from "@supabase/supabase-js"

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY
const hasSupabaseConfig = !!(supabaseUrl && supabaseKey)
const usingServiceKey = !!process.env.SUPABASE_SERVICE_KEY

function normalizeHistoryOptions(limitOrOptions = 10, maybeOptions = {}) {
  if (typeof limitOrOptions === "object" && limitOrOptions !== null) {
    return {
      limit: Number(limitOrOptions.limit || 10),
      activeModules: Array.isArray(limitOrOptions.activeModules) ? limitOrOptions.activeModules : [],
      bibleStudyModules: Array.isArray(limitOrOptions.bibleStudyModules) ? limitOrOptions.bibleStudyModules : []
    }
  }

  return {
    limit: Number(limitOrOptions || 10),
    activeModules: Array.isArray(maybeOptions.activeModules) ? maybeOptions.activeModules : [],
    bibleStudyModules: Array.isArray(maybeOptions.bibleStudyModules) ? maybeOptions.bibleStudyModules : []
  }
}

function matchesSelections(metadata = {}, activeModules = [], bibleStudyModules = []) {
  const hasModuleFilter = Array.isArray(activeModules) && activeModules.length > 0
  const hasBibleFilter = Array.isArray(bibleStudyModules) && bibleStudyModules.length > 0
  if (!hasModuleFilter && !hasBibleFilter) return true

  const recordModules = Array.isArray(metadata?.activeModules) ? metadata.activeModules : []
  const recordBibleModules = Array.isArray(metadata?.bibleStudyModules) ? metadata.bibleStudyModules : []

  const moduleMatch = !hasModuleFilter || recordModules.length === 0 || recordModules.some(moduleId => activeModules.includes(moduleId))
  if (!moduleMatch) return false

  if (!hasBibleFilter) {
    return true
  }

  return recordBibleModules.length === 0 || recordBibleModules.some(moduleId => bibleStudyModules.includes(moduleId))
}

export class GrootMemoryConnector {
  constructor() {
    this.supabase = hasSupabaseConfig ? createClient(supabaseUrl, supabaseKey) : null
    this.isConnected = false
    this.localMemory = new Map()

    if (!hasSupabaseConfig) {
      console.warn("⚠️ Supabase não configurado (SUPABASE_URL / SUPABASE_ANON_KEY). Usando memória local.")
    } else {
      if (!usingServiceKey) {
        console.warn("⚠️ Usando SUPABASE_ANON_KEY. Se o RLS estiver ativo, inserts podem falhar.")
        console.warn("   Recomendo usar SUPABASE_SERVICE_KEY no backend.")
      }

      this.testConnection().catch(error => {
        console.warn("⚠️ Falha na conexão inicial com Supabase:", error.message)
      })
    }
  }

  async testConnection() {
    if (!this.supabase) {
      return false
    }

    try {
      const { error } = await this.supabase
        .from("conversations")
        .select("count")
        .limit(1)

      if (error) {
        console.error("❌ Erro na conexão Supabase:", error)
        return false
      }

      console.log("✅ Conexão Supabase estabelecida!")
      this.isConnected = true
      return true
    } catch (error) {
      console.error("❌ Falha ao conectar Supabase:", error)
      return false
    }
  }

  async saveConversation(userId, userMessage, aiResponse, metadata = {}) {
    if (!this.isConnected || !this.supabase) {
      console.warn("⚠️ Supabase não conectado - usando fallback local")
      return this.saveLocalFallback(userId, userMessage, aiResponse, metadata)
    }

    try {
      const { data, error } = await this.supabase
        .from("conversations")
        .insert({
          user_id: userId,
          user_message: userMessage,
          ai_response: aiResponse,
          metadata: {
            timestamp: new Date().toISOString(),
            style: metadata.userStyle,
            confidence: metadata.confidence,
            provider: metadata.provider,
            session_id: metadata.sessionId,
            request_id: metadata.requestId
          }
        })
        .select()

      if (error) throw error
      console.log("✅ Conversa salva na Supabase")
      return data[0]
    } catch (error) {
      console.error("❌ Erro ao salvar conversa:", error)
      return this.saveLocalFallback(userId, userMessage, aiResponse, metadata)
    }
  }

  async getRecentHistory(userId, limitOrOptions = 10, maybeOptions = {}) {
    const options = normalizeHistoryOptions(limitOrOptions, maybeOptions)

    if (!this.isConnected || !this.supabase) {
      console.warn("⚠️ Supabase não conectado - usando fallback local")
      return this.getLocalFallback(userId, options)
    }

    try {
      const fetchLimit = options.activeModules.length > 0 || options.bibleStudyModules.length > 0
        ? Math.max(options.limit * 5, 30)
        : options.limit

      const { data, error } = await this.supabase
        .from("conversations")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(fetchLimit)

      if (error) throw error
      return (data || [])
        .filter(entry => matchesSelections(entry.metadata, options.activeModules, options.bibleStudyModules))
        .slice(0, options.limit)
        .reverse()
    } catch (error) {
      console.error("❌ Erro ao buscar histórico:", error)
      return this.getLocalFallback(userId, options)
    }
  }

  async updateUserProfile(userId, preferences) {
    if (!this.isConnected || !this.supabase) {
      console.warn("⚠️ Supabase não conectado - usando fallback local")
      return this.updateLocalProfile(userId, preferences)
    }

    try {
      const { data, error } = await this.supabase
        .from("user_profiles")
        .upsert({
          user_id: userId,
          preferences,
          updated_at: new Date().toISOString()
        })
        .select()

      if (error) throw error
      console.log("✅ Perfil atualizado na Supabase")
      return data[0]
    } catch (error) {
      console.error("❌ Erro ao atualizar perfil:", error)
      return this.updateLocalProfile(userId, preferences)
    }
  }

  async getUserProfile(userId) {
    if (!this.isConnected || !this.supabase) {
      console.warn("⚠️ Supabase não conectado - usando fallback local")
      return this.getLocalProfile(userId)
    }

    try {
      const { data, error } = await this.supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .single()

      if (error && error.code !== "PGRST116") throw error
      return data || { preferences: { style: "natural" } }
    } catch (error) {
      console.error("❌ Erro ao buscar perfil:", error)
      return this.getLocalProfile(userId)
    }
  }

  async saveSummary(userId, summary, metadata = {}) {
    if (!this.isConnected || !this.supabase) {
      return this.saveLocalSummary(userId, summary, metadata)
    }

    try {
      const { data, error } = await this.supabase
        .from("conversation_summaries")
        .insert({
          user_id: userId,
          summary,
          metadata,
          created_at: new Date().toISOString()
        })
        .select()

      if (error) throw error
      return data[0]
    } catch (error) {
      console.error("❌ Erro ao salvar resumo:", error)
      return this.saveLocalSummary(userId, summary, metadata)
    }
  }

  async getLatestSummary(userId) {
    if (!this.isConnected || !this.supabase) {
      return this.getLocalSummary(userId)
    }

    try {
      const { data, error } = await this.supabase
        .from("conversation_summaries")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)

      if (error) throw error
      return data?.[0] || null
    } catch (error) {
      console.error("❌ Erro ao buscar resumo:", error)
      return this.getLocalSummary(userId)
    }
  }

  async saveFeedback(userId, requestId, rating, comment = null) {
    if (!this.isConnected || !this.supabase) {
      return this.saveLocalFeedback(userId, requestId, rating, comment)
    }

    try {
      const { data, error } = await this.supabase
        .from("interaction_feedback")
        .insert({
          user_id: userId,
          request_id: requestId,
          rating,
          comment,
          created_at: new Date().toISOString()
        })
        .select()

      if (error) throw error
      return data[0]
    } catch (error) {
      console.error("❌ Erro ao salvar feedback:", error)
      return this.saveLocalFeedback(userId, requestId, rating, comment)
    }
  }

  async saveEvaluation(userId, requestId, evaluation) {
    if (!this.isConnected || !this.supabase) {
      return this.saveLocalEvaluation(userId, requestId, evaluation)
    }

    try {
      const { data, error } = await this.supabase
        .from("learning_evaluations")
        .insert({
          user_id: userId,
          request_id: requestId,
          score: evaluation.score,
          issues: evaluation.issues,
          created_at: new Date().toISOString()
        })
        .select()

      if (error) throw error
      return data[0]
    } catch (error) {
      console.error("❌ Erro ao salvar avaliação:", error)
      return this.saveLocalEvaluation(userId, requestId, evaluation)
    }
  }

  async saveLearningPattern(userId, patternType, patternData, confidence = 0.5) {
    if (!this.isConnected || !this.supabase) {
      console.warn("⚠️ Supabase não conectado - salvando padrão localmente")
      return this.saveLocalLearningPattern(userId, patternType, patternData, confidence)
    }

    try {
      const { data, error } = await this.supabase
        .from("learning_patterns")
        .insert({
          user_id: userId,
          pattern_type: patternType,
          pattern_data: patternData,
          confidence,
          created_at: new Date().toISOString()
        })
        .select()

      if (error) throw error
      console.log("✅ Padrão de aprendizado salvo na Supabase")
      return data[0]
    } catch (error) {
      console.error("❌ Erro ao salvar padrão de aprendizado:", error)
      return this.saveLocalLearningPattern(userId, patternType, patternData, confidence)
    }
  }

  async getLearningPatterns(userId, limit = 10) {
    if (!this.isConnected || !this.supabase) {
      return this.getLocalLearningPatterns(userId, limit)
    }

    try {
      const { data, error } = await this.supabase
        .from("learning_patterns")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error("❌ Erro ao buscar padrões de aprendizado:", error)
      return this.getLocalLearningPatterns(userId, limit)
    }
  }

  saveLocalFallback(userId, userMessage, aiResponse, metadata) {
    const storageKey = `groot_conversation_${userId}`
    const existing = this.localMemory.get(storageKey) || []

    existing.push({
      user_message: userMessage,
      ai_response: aiResponse,
      metadata,
      created_at: new Date().toISOString()
    })

    this.localMemory.set(storageKey, existing.slice(-50))
    console.log("✅ Conversa salva localmente (fallback)")
  }

  getLocalFallback(userId, limitOrOptions = 10, maybeOptions = {}) {
    const options = normalizeHistoryOptions(limitOrOptions, maybeOptions)
    const storageKey = `groot_conversation_${userId}`
    const data = this.localMemory.get(storageKey) || []

    return data
      .filter(entry => matchesSelections(entry.metadata, options.activeModules, options.bibleStudyModules))
      .slice(-options.limit)
      .reverse()
  }

  updateLocalProfile(userId, preferences) {
    const storageKey = `groot_profile_${userId}`
    const existing = this.localMemory.get(storageKey) || {}

    this.localMemory.set(storageKey, {
      ...existing,
      preferences,
      updated_at: new Date().toISOString()
    })

    console.log("✅ Perfil atualizado localmente (fallback)")
    return { preferences }
  }

  getLocalProfile(userId) {
    const storageKey = `groot_profile_${userId}`
    const data = this.localMemory.get(storageKey) || {}
    return data || { preferences: { style: "natural" } }
  }

  saveLocalSummary(userId, summary, metadata) {
    const storageKey = `groot_summary_${userId}`
    const payload = {
      summary,
      metadata,
      created_at: new Date().toISOString()
    }

    this.localMemory.set(storageKey, payload)
    return payload
  }

  getLocalSummary(userId) {
    const storageKey = `groot_summary_${userId}`
    return this.localMemory.get(storageKey) || null
  }

  saveLocalFeedback(userId, requestId, rating, comment) {
    const storageKey = `groot_feedback_${userId}`
    const existing = this.localMemory.get(storageKey) || []
    const payload = {
      request_id: requestId,
      rating,
      comment,
      created_at: new Date().toISOString()
    }

    existing.push(payload)
    this.localMemory.set(storageKey, existing.slice(-50))
    return payload
  }

  saveLocalEvaluation(userId, requestId, evaluation) {
    const storageKey = `groot_evaluations_${userId}`
    const existing = this.localMemory.get(storageKey) || []
    const payload = {
      request_id: requestId,
      ...evaluation,
      created_at: new Date().toISOString()
    }

    existing.push(payload)
    this.localMemory.set(storageKey, existing.slice(-50))
    return payload
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

  async getContextForPrompt(userId = "default_user", options = {}) {
    try {
      const [history, profile, summary] = await Promise.all([
        this.getRecentHistory(userId, {
          limit: options.limit || 5,
          activeModules: options.activeModules || [],
          bibleStudyModules: options.bibleStudyModules || []
        }),
        this.getUserProfile(userId),
        this.getLatestSummary(userId)
      ])

      return {
        history: history.map(item => ({
          user: item.user_message,
          ai: item.ai_response,
          timestamp: item.created_at
        })),
        userProfile: profile.preferences,
        contextSummary: this.generateContextSummary(history, options),
        summary: summary?.summary || ""
      }
    } catch (error) {
      console.error("❌ Erro ao buscar contexto:", error)
      return {
        history: [],
        userProfile: { style: "natural" },
        contextSummary: "Início de conversa",
        summary: ""
      }
    }
  }

  generateContextSummary(history, options = {}) {
    if (history.length === 0) return "Início de conversa"

    const topics = history.map(item => {
      const keywords = item.user_message
        .toLowerCase()
        .split(" ")
        .filter(word => word.length > 3)
        .slice(0, 3)

      return keywords.join(", ")
    }).filter(Boolean)

    const moduleSummary = Array.isArray(options.activeModules) && options.activeModules.length > 0
      ? ` | Módulos: ${options.activeModules.join(", ")}`
      : ""
    const bibleSummary = Array.isArray(options.bibleStudyModules) && options.bibleStudyModules.length > 0
      ? ` | Bíblia: ${options.bibleStudyModules.join(", ")}`
      : ""

    return `Tópicos discutidos: ${topics.slice(0, 5).join(" | ")}${moduleSummary}${bibleSummary}`
  }
}

export const grootMemoryConnector = new GrootMemoryConnector()
