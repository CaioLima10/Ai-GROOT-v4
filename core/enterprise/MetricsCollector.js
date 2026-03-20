import { Logger } from "./Logger.js"

export class MetricsCollector {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        avgResponseTime: 0
      },
      providers: new Map(),
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0
      },
      users: new Map(),
      errors: new Map(),
      performance: {
        p50: 0,
        p95: 0,
        p99: 0
      }
    }
    this.responseTimes = []
    this.logger = new Logger()
  }

  recordRequest(requestId, responseTime, success = true, provider = null) {
    this.metrics.requests.total++
    
    if (success) {
      this.metrics.requests.successful++
    } else {
      this.metrics.requests.failed++
    }

    // Atualizar tempo médio de resposta
    this.responseTimes.push(responseTime)
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000) // Manter últimos 1000
    }
    
    this.updatePerformanceMetrics()
    this.metrics.requests.avgResponseTime = this.calculateAverage(responseTime)

    // Registrar métricas do provider
    if (provider) {
      if (!this.metrics.providers.has(provider)) {
        this.metrics.providers.set(provider, {
          requests: 0,
          successful: 0,
          avgResponseTime: 0
        })
      }
      
      const providerMetrics = this.metrics.providers.get(provider)
      providerMetrics.requests++
      if (success) providerMetrics.successful++
    }

    this.logger.debug('METRICS_RECORDED', {
      requestId,
      responseTime,
      success,
      provider
    })
  }

  recordCacheHit(requestId) {
    this.metrics.cache.hits++
    this.updateCacheHitRate()
  }

  recordCacheMiss(requestId) {
    this.metrics.cache.misses++
    this.updateCacheHitRate()
  }

  recordUserActivity(userId, action, metadata = {}) {
    if (!this.metrics.users.has(userId)) {
      this.metrics.users.set(userId, {
        requests: 0,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        actions: new Map()
      })
    }

    const userMetrics = this.metrics.users.get(userId)
    userMetrics.requests++
    userMetrics.lastSeen = Date.now()

    if (!userMetrics.actions.has(action)) {
      userMetrics.actions.set(action, 0)
    }
    userMetrics.actions.set(action, userMetrics.actions.get(action) + 1)

    this.logger.debug('USER_ACTIVITY', { userId, action, metadata })
  }

  recordError(errorType, error, context = {}) {
    if (!this.metrics.errors.has(errorType)) {
      this.metrics.errors.set(errorType, {
        count: 0,
        lastOccurrence: null,
        samples: []
      })
    }

    const errorMetrics = this.metrics.errors.get(errorType)
    errorMetrics.count++
    errorMetrics.lastOccurrence = Date.now()
    
    // Manter últimas 5 amostras de erro
    errorMetrics.samples.push({
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack,
      context
    })
    
    if (errorMetrics.samples.length > 5) {
      errorMetrics.samples = errorMetrics.samples.slice(-5)
    }

    this.logger.error('ERROR_RECORDED', { errorType, error: error.message })
  }

  updateCacheHitRate() {
    const total = this.metrics.cache.hits + this.metrics.cache.misses
    this.metrics.cache.hitRate = total > 0 
      ? (this.metrics.cache.hits / total * 100).toFixed(2)
      : 0
  }

  updatePerformanceMetrics() {
    if (this.responseTimes.length === 0) return

    const sorted = [...this.responseTimes].sort((a, b) => a - b)
    this.metrics.performance.p50 = this.getPercentile(sorted, 50)
    this.metrics.performance.p95 = this.getPercentile(sorted, 95)
    this.metrics.performance.p99 = this.getPercentile(sorted, 99)
  }

  getPercentile(sortedArray, percentile) {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1
    return sortedArray[Math.max(0, index)]
  }

  calculateAverage(responseTime) {
    if (this.responseTimes.length === 0) return 0
    
    const sum = this.responseTimes.reduce((acc, time) => acc + time, 0)
    return Math.round(sum / this.responseTimes.length)
  }

  getSummary() {
    return {
      ...this.metrics,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    }
  }

  getProviderStats() {
    const stats = {}
    for (const [provider, metrics] of this.metrics.providers.entries()) {
      stats[provider] = {
        ...metrics,
        successRate: metrics.requests > 0 
          ? (metrics.successful / metrics.requests * 100).toFixed(2)
          : 0
      }
    }
    return stats
  }

  getTopUsers(limit = 10) {
    const users = Array.from(this.metrics.users.entries())
      .map(([userId, metrics]) => ({
        userId,
        ...metrics,
        totalActions: Array.from(metrics.actions.values())
          .reduce((sum, count) => sum + count, 0)
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, limit)

    return users
  }

  getErrorSummary() {
    const errors = {}
    for (const [type, metrics] of this.metrics.errors.entries()) {
      errors[type] = {
        count: metrics.count,
        lastOccurrence: metrics.lastOccurrence,
        recentSample: metrics.samples[metrics.samples.length - 1]
      }
    }
    return errors
  }

  exportMetrics(format = 'json') {
    const summary = this.getSummary()
    
    if (format === 'prometheus') {
      return this.convertToPrometheusFormat(summary)
    }
    
    return summary
  }

  convertToPrometheusFormat(metrics) {
    const lines = []
    
    // Request metrics
    lines.push(`# HELP ai_groot_requests_total Total number of requests`)
    lines.push(`# TYPE ai_groot_requests_total counter`)
    lines.push(`ai_groot_requests_total ${metrics.requests.total}`)
    
    // Success rate
    lines.push(`# HELP ai_groot_success_rate Success rate percentage`)
    lines.push(`# TYPE ai_groot_success_rate gauge`)
    const successRate = metrics.requests.total > 0 
      ? (metrics.requests.successful / metrics.requests.total * 100).toFixed(2)
      : 0
    lines.push(`ai_groot_success_rate ${successRate}`)
    
    // Response time
    lines.push(`# HELP ai_groot_response_time_ms Average response time in milliseconds`)
    lines.push(`# TYPE ai_groot_response_time_ms gauge`)
    lines.push(`ai_groot_response_time_ms ${metrics.requests.avgResponseTime}`)
    
    // Cache hit rate
    lines.push(`# HELP ai_groot_cache_hit_rate Cache hit rate percentage`)
    lines.push(`# TYPE ai_groot_cache_hit_rate gauge`)
    lines.push(`ai_groot_cache_hit_rate ${metrics.cache.hitRate}`)
    
    return lines.join('\n')
  }

  reset() {
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        avgResponseTime: 0
      },
      providers: new Map(),
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0
      },
      users: new Map(),
      errors: new Map(),
      performance: {
        p50: 0,
        p95: 0,
        p99: 0
      }
    }
    this.responseTimes = []
    
    this.logger.info('METRICS_RESET')
  }
}
