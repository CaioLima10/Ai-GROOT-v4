import { AI_SERVICE_SLUG } from "../../packages/shared-config/src/brand.js"

export class Logger {
  constructor() {
    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    }
    this.currentLevel = this.levels.INFO
    this.logs = []
    this.maxLogs = 1000
  }

  setLevel(level) {
    this.currentLevel = this.levels[level] || this.levels.INFO
  }

  shouldLog(level) {
    return this.levels[level] <= this.currentLevel
  }

  formatMessage(level, requestId, event, metadata = {}) {
    const timestamp = new Date().toISOString()
    const metadataStr = Object.keys(metadata).length > 0 
      ? ` | ${JSON.stringify(metadata)}` 
      : ''
    
    return `[${timestamp}] ${level} [${requestId}] ${event}${metadataStr}`
  }

  log(level, requestId, event, metadata = {}) {
    if (!this.shouldLog(level)) return

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      requestId,
      event,
      metadata,
      message: this.formatMessage(level, requestId, event, metadata)
    }

    this.logs.push(logEntry)
    
    // Manter apenas os logs mais recentes
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    // Output para console
    console.log(logEntry.message)
  }

  error(requestId, event, metadata = {}) {
    this.log('ERROR', requestId, event, metadata)
  }

  warn(requestId, event, metadata = {}) {
    this.log('WARN', requestId, event, metadata)
  }

  info(requestId, event, metadata = {}) {
    this.log('INFO', requestId, event, metadata)
  }

  debug(requestId, event, metadata = {}) {
    this.log('DEBUG', requestId, event, metadata)
  }

  // Logs estruturados para sistemas de monitoring
  structured(level, requestId, event, metadata = {}) {
    const logEntry = {
      '@timestamp': new Date().toISOString(),
      '@level': level.toLowerCase(),
      '@request_id': requestId,
      '@event': event,
      '@service': AI_SERVICE_SLUG,
      '@version': '2.0.0',
      ...metadata
    }

    this.logs.push({
      ...logEntry,
      message: JSON.stringify(logEntry)
    })

    if (this.shouldLog(level.toUpperCase())) {
      console.log(JSON.stringify(logEntry))
    }
  }

  // Query logs
  getLogs(filter = {}) {
    let filtered = [...this.logs]

    if (filter.level) {
      filtered = filtered.filter(log => log.level === filter.level)
    }

    if (filter.requestId) {
      filtered = filtered.filter(log => log.requestId === filter.requestId)
    }

    if (filter.event) {
      filtered = filtered.filter(log => log.event.includes(filter.event))
    }

    if (filter.since) {
      const since = new Date(filter.since)
      filtered = filtered.filter(log => new Date(log.timestamp) >= since)
    }

    if (filter.until) {
      const until = new Date(filter.until)
      filtered = filtered.filter(log => new Date(log.timestamp) <= until)
    }

    return filtered.sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    )
  }

  // Análise de logs
  getLogSummary() {
    const summary = {
      total: this.logs.length,
      byLevel: {},
      byEvent: {},
      recentErrors: [],
      topRequestIds: {}
    }

    for (const log of this.logs) {
      // Contagem por nível
      summary.byLevel[log.level] = (summary.byLevel[log.level] || 0) + 1
      
      // Contagem por evento
      summary.byEvent[log.event] = (summary.byEvent[log.event] || 0) + 1
      
      // Top request IDs
      summary.topRequestIds[log.requestId] = (summary.topRequestIds[log.requestId] || 0) + 1
      
      // Erros recentes
      if (log.level === 'ERROR') {
        summary.recentErrors.push({
          timestamp: log.timestamp,
          requestId: log.requestId,
          event: log.event,
          metadata: log.metadata
        })
      }
    }

    // Ordenar top request IDs
    summary.topRequestIds = Object.entries(summary.topRequestIds)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .reduce((obj, [id, count]) => ({ ...obj, [id]: count }), {})

    // Limitar erros recentes
    summary.recentErrors = summary.recentErrors.slice(0, 10)

    return summary
  }

  // Export logs
  export(format = 'json') {
    if (format === 'csv') {
      const headers = ['timestamp', 'level', 'requestId', 'event', 'metadata']
      const rows = this.logs.map(log => [
        log.timestamp,
        log.level,
        log.requestId,
        log.event,
        JSON.stringify(log.metadata)
      ])
      
      return [headers, ...rows].map(row => row.join(',')).join('\n')
    }

    return this.logs
  }

  // Limpar logs antigos
  cleanup(maxAge = 24 * 60 * 60 * 1000) { // 24 horas
    const cutoff = Date.now() - maxAge
    const before = this.logs.length
    
    this.logs = this.logs.filter(log => 
      new Date(log.timestamp).getTime() > cutoff
    )
    
    const removed = before - this.logs.length
    if (removed > 0) {
      console.log(`Cleaned up ${removed} old log entries`)
    }
    
    return removed
  }

  // Alertas automáticos
  checkAlerts() {
    const alerts = []
    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000

    // Taxa de erro alta
    const recentLogs = this.logs.filter(log => 
      new Date(log.timestamp).getTime() > oneHourAgo
    )
    
    const errorRate = recentLogs.filter(log => log.level === 'ERROR').length / recentLogs.length
    
    if (errorRate > 0.1) { // Mais de 10% de erro
      alerts.push({
        type: 'HIGH_ERROR_RATE',
        severity: 'critical',
        message: `Error rate is ${(errorRate * 100).toFixed(2)}% in the last hour`,
        threshold: 10,
        current: errorRate * 100
      })
    }

    // Muitos logs de um mesmo request
    const requestCounts = {}
    for (const log of recentLogs) {
      requestCounts[log.requestId] = (requestCounts[log.requestId] || 0) + 1
    }

    for (const [requestId, count] of Object.entries(requestCounts)) {
      if (count > 100) { // Mais de 100 logs por request
        alerts.push({
          type: 'EXCESSIVE_LOGGING',
          severity: 'warning',
          message: `Request ${requestId} generated ${count} log entries`,
          requestId,
          count
        })
      }
    }

    return alerts
  }
}
