// GROOT ANALYTICS - Monitoramento e Métricas
import { grootMemoryConnector } from './grootMemoryConnector.js'

export class GrootAnalytics {
  constructor() {
    this.supabase = grootMemoryConnector.supabase
    this.metrics = new Map()
    this.enabled = !!this.supabase
    this.disabledReason = null
  }

  // 📊 REGISTRAR USO
  async trackUsage(userId, query, response, metadata = {}) {
    if (!this.enabled) {
      console.warn('⚠️ Analytics desativado: Supabase não configurado.')
      return null
    }
    try {
      const usageData = {
        user_id: userId,
        query,
        response,
        response_time: metadata.responseTime || 0,
        tokens_used: metadata.tokensUsed || 0,
        provider: metadata.provider || 'unknown',
        user_style: metadata.userStyle || 'natural',
        confidence: metadata.confidence || 0,
        success: metadata.success || true,
        error: metadata.error || null,
        knowledge_found: metadata.knowledgeFound || 0,
        bugs_found: metadata.bugsFound || 0,
        created_at: new Date().toISOString()
      }

      const { data, error } = await this.supabase
        .from('usage_analytics')
        .insert(usageData)
        .select()

      if (error) throw error

      // Atualizar métricas em tempo real
      this.updateRealTimeMetrics(userId, usageData)

      console.log(`📊 Uso registrado: ${userId}`)
      return data[0]
    } catch (error) {
      if (String(error?.message || '').includes("Could not find the table 'public.usage_analytics'")) {
        this.enabled = false
        this.disabledReason = 'missing_usage_analytics'
        console.warn('⚠️ Analytics desativado: tabela usage_analytics ausente no Supabase.')
        return null
      }
      console.error('❌ Erro ao registrar uso:', error.message)
      return null
    }
  }

  // 🔄 ATUALIZAR MÉTRICAS EM TEMPO REAL
  updateRealTimeMetrics(userId, usageData) {
    const today = new Date().toISOString().split('T')[0]
    
    if (!this.metrics.has(today)) {
      this.metrics.set(today, {
        totalQueries: 0,
        totalResponseTime: 0,
        totalTokens: 0,
        successRate: 0,
        errors: 0,
        users: new Set()
      })
    }

    const dayMetrics = this.metrics.get(today)
    dayMetrics.totalQueries++
    dayMetrics.totalResponseTime += usageData.response_time
    dayMetrics.totalTokens += usageData.tokens_used
    dayMetrics.users.add(userId)
    
    if (!usageData.success) {
      dayMetrics.errors++
    }
    
    dayMetrics.successRate = ((dayMetrics.totalQueries - dayMetrics.errors) / dayMetrics.totalQueries) * 100
  }

  // 📈 OBTER MÉTRICAS DO DIA
  async getDailyMetrics(date = null) {
    if (!this.enabled) {
      return this.getDefaultMetrics(date || null)
    }
    const targetDate = date || new Date().toISOString().split('T')[0]
    
    try {
      const { data, error } = await this.supabase
        .from('usage_analytics')
        .select('*')
        .gte('created_at', `${targetDate}T00:00:00Z`)
        .lt('created_at', `${targetDate}T23:59:59Z`)

      if (error) throw error

      const metrics = this.calculateMetrics(data || [])
      
      return {
        date: targetDate,
        ...metrics,
        cached: this.metrics.get(targetDate) || null
      }
    } catch (error) {
      console.error('❌ Erro ao obter métricas diárias:', error.message)
      return this.getDefaultMetrics(targetDate)
    }
  }

  // 🧮 CALCULAR MÉTRICAS
  calculateMetrics(usageData) {
    if (usageData.length === 0) {
      return this.getDefaultMetrics()
    }

    const totalQueries = usageData.length
    const totalResponseTime = usageData.reduce((sum, item) => sum + item.response_time, 0)
    const totalTokens = usageData.reduce((sum, item) => sum + item.tokens_used, 0)
    const successCount = usageData.filter(item => item.success).length
    const uniqueUsers = new Set(usageData.map(item => item.user_id)).size

    return {
      totalQueries,
      averageResponseTime: totalResponseTime / totalQueries,
      totalTokens,
      successRate: (successCount / totalQueries) * 100,
      uniqueUsers,
      errorsCount: totalQueries - successCount,
      topProviders: this.getTopProviders(usageData),
      topStyles: this.getTopStyles(usageData),
      averageConfidence: usageData.reduce((sum, item) => sum + item.confidence, 0) / totalQueries
    }
  }

  // 🏆 TOP PROVIDERS
  getTopProviders(usageData) {
    const providers = {}
    
    usageData.forEach(item => {
      providers[item.provider] = (providers[item.provider] || 0) + 1
    })

    return Object.entries(providers)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([provider, count]) => ({ provider, count }))
  }

  // 🎨 TOP STYLES
  getTopStyles(usageData) {
    const styles = {}
    
    usageData.forEach(item => {
      styles[item.user_style] = (styles[item.user_style] || 0) + 1
    })

    return Object.entries(styles)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([style, count]) => ({ style, count }))
  }

  // 📊 MÉTRICAS PADRÃO
  getDefaultMetrics(date = null) {
    return {
      date: date || new Date().toISOString().split('T')[0],
      totalQueries: 0,
      averageResponseTime: 0,
      totalTokens: 0,
      successRate: 0,
      uniqueUsers: 0,
      errorsCount: 0,
      topProviders: [],
      topStyles: [],
      averageConfidence: 0
    }
  }

  // 👤 MÉTRICAS DO USUÁRIO
  async getUserMetrics(userId, days = 7) {
    if (!this.enabled) {
      return this.getDefaultUserMetrics(userId, days)
    }
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const { data, error } = await this.supabase
        .from('usage_analytics')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())

      if (error) throw error

      const metrics = this.calculateMetrics(data || [])
      
      return {
        userId,
        period: `${days} days`,
        ...metrics,
        dailyBreakdown: this.getDailyBreakdown(data || [])
      }
    } catch (error) {
      console.error('❌ Erro ao obter métricas do usuário:', error.message)
      return this.getDefaultUserMetrics(userId, days)
    }
  }

  // 📅 BREAKDOWN DIÁRIO
  getDailyBreakdown(usageData) {
    const daily = {}
    
    usageData.forEach(item => {
      const date = item.created_at.split('T')[0]
      if (!daily[date]) {
        daily[date] = { queries: 0, responseTime: 0, tokens: 0 }
      }
      
      daily[date].queries++
      daily[date].responseTime += item.response_time
      daily[date].tokens += item.tokens_used
    })

    return Object.entries(daily)
      .map(([date, metrics]) => ({
        date,
        queries: metrics.queries,
        averageResponseTime: metrics.responseTime / metrics.queries,
        tokens: metrics.tokens
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  // 📊 MÉTRICAS PADRÃO DO USUÁRIO
  getDefaultUserMetrics(userId, days) {
    return {
      userId,
      period: `${days} days`,
      totalQueries: 0,
      averageResponseTime: 0,
      totalTokens: 0,
      successRate: 0,
      uniqueUsers: 1,
      errorsCount: 0,
      topProviders: [],
      topStyles: [],
      averageConfidence: 0,
      dailyBreakdown: []
    }
  }

  // 🚨 REGISTRAR ERRO
  async trackError(userId, error, context = {}) {
    if (!this.enabled) {
      return null
    }
    try {
      const errorData = {
        user_id: userId,
        error_message: error.message,
        error_stack: error.stack,
        context,
        created_at: new Date().toISOString()
      }

      const { data, error: insertError } = await this.supabase
        .from('error_logs')
        .insert(errorData)
        .select()

      if (insertError) throw insertError

      console.log(`🚨 Erro registrado: ${error.message}`)
      return data[0]
    } catch (logError) {
      console.error('❌ Erro ao registrar erro:', logError.message)
    }
  }

  // 📈 RELATÓRIO DE PERFORMANCE
  async getPerformanceReport(days = 7) {
    if (!this.enabled) {
      return null
    }
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const [usage, errors] = await Promise.all([
        this.supabase
          .from('usage_analytics')
          .select('*')
          .gte('created_at', startDate.toISOString()),
        
        this.supabase
          .from('error_logs')
          .select('*')
          .gte('created_at', startDate.toISOString())
      ])

      const usageMetrics = this.calculateMetrics(usage || [])
      
      return {
        period: `${days} days`,
        usage: usageMetrics,
        errors: {
          total: errors?.length || 0,
          topErrors: this.getTopErrors(errors || []),
          errorRate: ((errors?.length || 0) / (usage?.length || 1)) * 100
        },
        generated_at: new Date().toISOString()
      }
    } catch (error) {
      console.error('❌ Erro ao gerar relatório:', error.message)
      return null
    }
  }

  // 🔝 TOP ERROS
  getTopErrors(errors) {
    const errorCounts = {}
    
    errors.forEach(error => {
      const message = error.error_message.split('\n')[0] // Primeira linha apenas
      errorCounts[message] = (errorCounts[message] || 0) + 1
    })

    return Object.entries(errorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([message, count]) => ({ message, count }))
  }

  // 🎯 HEALTH CHECK
  async getHealthStatus() {
    try {
      const [lastHour, systemMetrics] = await Promise.all([
        this.getHourlyMetrics(),
        this.getSystemMetrics()
      ])

      return {
        status: 'healthy',
        lastHour,
        system: systemMetrics,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      }
    }
  }

  // 📊 MÉTRICAS DA ÚLTIMA HORA
  async getHourlyMetrics() {
    if (!this.enabled) {
      return this.getDefaultMetrics()
    }
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    
    try {
      const { data, error } = await this.supabase
        .from('usage_analytics')
        .select('*')
        .gte('created_at', oneHourAgo.toISOString())

      if (error) throw error

      return this.calculateMetrics(data || [])
    } catch (error) {
      console.error('❌ Erro ao obter métricas da última hora:', error)
      return this.getDefaultMetrics()
    }
  }

  // 💻 MÉTRICAS DO SISTEMA
  getSystemMetrics() {
    return {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform
    }
  }
}

export const grootAnalytics = new GrootAnalytics()
