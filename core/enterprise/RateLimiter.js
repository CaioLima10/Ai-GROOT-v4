import { Logger } from "./Logger.js"

export class RateLimiter {
  constructor() {
    this.windows = new Map() // userId -> Window[]
    this.limits = {
      free: {
        requests: 100,
        windowMs: 60000, // 1 minuto
        dailyLimit: 1000
      },
      pro: {
        requests: 1000,
        windowMs: 60000, // 1 minuto
        dailyLimit: 10000
      },
      enterprise: {
        requests: 10000,
        windowMs: 60000, // 1 minuto
        dailyLimit: 100000
      }
    }
    this.logger = new Logger()
  }

  async checkLimit(userId, tier = 'free') {
    const now = Date.now()
    const limit = this.limits[tier]
    
    if (!this.windows.has(userId)) {
      this.windows.set(userId, [])
    }

    const userWindows = this.windows.get(userId)
    
    // Limpar janelas expiradas
    const validWindows = userWindows.filter(window => 
      now - window.startAt < limit.windowMs
    )
    this.windows.set(userId, validWindows)

    // Verificar limite da janela atual
    const currentWindow = validWindows[validWindows.length - 1]
    
    if (!currentWindow || now - currentWindow.startAt >= limit.windowMs) {
      // Nova janela
      validWindows.push({
        startAt: now,
        requests: 1
      })
      return { allowed: true, remaining: limit.requests - 1 }
    }

    if (currentWindow.requests >= limit.requests) {
      const resetTime = currentWindow.startAt + limit.windowMs
      this.logger.warn('RATE_LIMIT_EXCEEDED', { 
        userId, 
        tier, 
        requests: currentWindow.requests,
        limit: limit.requests,
        resetTime: new Date(resetTime).toISOString()
      })
      
      throw new RateLimitError('Rate limit exceeded', {
        resetTime,
        limit: limit.requests,
        windowMs: limit.windowMs
      })
    }

    currentWindow.requests++
    
    // Verificar limite diário
    const dailyTotal = validWindows.reduce((sum, w) => sum + w.requests, 0)
    if (dailyTotal > limit.dailyLimit) {
      throw new RateLimitError('Daily limit exceeded', {
        type: 'daily',
        limit: limit.dailyLimit
      })
    }

    return {
      allowed: true,
      remaining: limit.requests - currentWindow.requests,
      dailyUsed: dailyTotal,
      dailyLimit: limit.dailyLimit
    }
  }

  getStats(userId) {
    const userWindows = this.windows.get(userId) || []
    const now = Date.now()
    
    const validWindows = userWindows.filter(window => 
      now - window.startAt < 60000
    )

    const currentRequests = validWindows.reduce((sum, w) => sum + w.requests, 0)
    const dailyTotal = userWindows.reduce((sum, w) => sum + w.requests, 0)

    return {
      currentRequests,
      dailyTotal,
      windows: validWindows.length,
      lastReset: validWindows[0]?.startAt || now
    }
  }

  resetUser(userId) {
    this.windows.delete(userId)
    this.logger.info('RATE_LIMIT_RESET', { userId })
  }

  getGlobalStats() {
    const totalUsers = this.windows.size
    let totalRequests = 0
    let activeUsers = 0

    for (const [userId, windows] of this.windows.entries()) {
      const userTotal = windows.reduce((sum, w) => sum + w.requests, 0)
      totalRequests += userTotal
      
      if (userTotal > 0) activeUsers++
    }

    return {
      totalUsers,
      activeUsers,
      totalRequests,
      avgRequestsPerUser: activeUsers > 0 ? Math.round(totalRequests / activeUsers) : 0
    }
  }
}

class RateLimitError extends Error {
  constructor(message, metadata = {}) {
    super(message)
    this.name = 'RateLimitError'
    this.metadata = metadata
  }
}
