import { Logger } from "./Logger.js"

export class CacheManager {
  constructor() {
    this.cache = new Map()
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0
    }
    this.maxSize = 1000
    this.defaultTTL = 3600000 // 1 hora em ms
    this.logger = new Logger()
  }

  async get(key) {
    const item = this.cache.get(key)

    if (!item) {
      this.stats.misses++
      return null
    }

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key)
      this.stats.evictions++
      this.logger.debug('CACHE_EXPIRED', { key })
      return null
    }

    // Atualizar LRU
    item.lastAccessed = Date.now()
    this.stats.hits++

    return item.value
  }

  async set(key, value, ttl = this.defaultTTL) {
    // Se cache cheio, remover item mais antigo
    if (this.cache.size >= this.maxSize) {
      this.evictLRU()
    }

    const item = {
      value,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      expiresAt: Date.now() + ttl,
      ttl
    }

    this.cache.set(key, item)
    this.stats.sets++

    this.logger.debug('CACHE_SET', { key, ttl })
  }

  async evictLRU() {
    let oldestKey = null
    let oldestTime = Date.now()

    for (const [key, item] of this.cache.entries()) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
      this.stats.evictions++
      this.logger.debug('CACHE_EVICT_LRU', { key: oldestKey })
    }
  }

  async invalidate(pattern) {
    const regex = new RegExp(pattern)
    let deleted = 0

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
        deleted++
      }
    }

    this.logger.info('CACHE_INVALIDATE', { pattern, deleted })
    return deleted
  }

  async clear() {
    const size = this.cache.size
    this.cache.clear()
    this.stats.evictions += size

    this.logger.info('CACHE_CLEAR', { items: size })
    return size
  }

  async getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: `${hitRate}%`,
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      evictions: this.stats.evictions
    }
  }

  // Cache warming para respostas comuns
  async warmCache() {
    const commonQueries = [
      'como debuggar node.js',
      'erro de dependência npm',
      'react hooks explained',
      'typescript setup',
      'express middleware'
    ]

    for (const query of commonQueries) {
      const key = this.generateCacheKey(query)
      if (!this.cache.has(key)) {
        // Pré-carregar com respostas genéricas
        await this.set(key, {
          type: 'warming',
          query,
          response: 'Resposta pré-carregada para performance'
        }, 1800000) // 30 min
      }
    }

    this.logger.info('CACHE_WARMED', { queries: commonQueries.length })
  }

  async generateCacheKey(query) {
    const crypto = await import('crypto')
    const hash = await crypto.webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(query))
    const hashArray = Array.from(new Uint8Array(hash))
    return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('')
  }
}
