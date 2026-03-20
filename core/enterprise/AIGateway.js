import { aiProviders } from "../aiProviders.js"
import { CacheManager } from "./CacheManager.js"
import { RateLimiter } from "./RateLimiter.js"
import { MetricsCollector } from "./MetricsCollector.js"
import { Logger } from "./Logger.js"

export class AIGateway {
  constructor() {
    this.cache = new CacheManager()
    this.rateLimiter = new RateLimiter()
    this.metrics = new MetricsCollector()
    this.logger = new Logger()
  }

  async processRequest(requestId, userId, question, context = {}) {
    const startTime = Date.now()

    try {
      // 1. Rate Limiting
      await this.rateLimiter.checkLimit(userId)

      // 2. Cache Check
      const cacheKey = this.generateCacheKey(question, context)
      const cachedResponse = await this.cache.get(cacheKey)

      if (cachedResponse) {
        this.metrics.recordCacheHit(requestId)
        this.logger.info(requestId, 'CACHE_HIT', { userId, cacheKey })
        return cachedResponse
      }

      // 3. Process with AI Providers
      const response = await this.processWithProviders(requestId, question, context)

      // 4. Cache Response
      await this.cache.set(cacheKey, response, 3600) // 1 hora

      // 5. Record Metrics
      const processingTime = Date.now() - startTime
      this.metrics.recordRequest(requestId, processingTime, true)

      return response

    } catch (error) {
      const processingTime = Date.now() - startTime
      this.metrics.recordRequest(requestId, processingTime, false)
      this.logger.error(requestId, 'PROCESSING_ERROR', { error: error.message, userId })
      throw error
    }
  }

  async processWithProviders(requestId, question, context) {
    const enhancedPrompt = this.buildEnhancedPrompt(question, context)

    try {
      const response = await aiProviders.askMultiAI(enhancedPrompt)
      return this.formatResponse(response, context)
    } catch (error) {
      this.logger.error(requestId, 'PROVIDER_ERROR', { error: error.message })
      throw new Error('AI processing failed')
    }
  }

  buildEnhancedPrompt(question, context) {
    const systemPrompt = `
Você é Ai-GROOT Enterprise Edition - uma IA avançada de desenvolvimento de software.

CAPACIDADES ESPECIALIZADAS:
• Análise de código em 50+ linguagens
• Debugging avançado com stack traces
• Arquitetura de software e design patterns
• Performance optimization
• Security vulnerability assessment
• Code review automatizado
• Refactoring suggestions
• Test generation

CONTEXTO DA REQUISIÇÃO:
${context.fileInfo ? `Arquivo: ${context.fileInfo.path}\nLinguagem: ${context.fileInfo.language}` : ''}
${context.errorInfo ? `Erro: ${context.errorInfo.message}\nStack: ${context.errorInfo.stack}` : ''}
${context.frameworkInfo ? `Framework: ${context.frameworkInfo.name} v${context.frameworkInfo.version}` : ''}

PERGUNTA DO DESENVOLVEDOR:
${question}

INSTRUÇÕES:
1. Analise o contexto fornecido
2. Forneça soluções práticas e implementáveis
3. Inclua exemplos de código quando relevante
4. Explique o "porquê" por trás das soluções
5. Sugerir melhores práticas

Responda como um engenheiro sênior especialista.
`

    return systemPrompt
  }

  formatResponse(response, context) {
    return {
      id: this.generateResponseId(),
      timestamp: new Date().toISOString(),
      response: response,
      metadata: {
        provider: 'ai-groot-enterprise',
        version: '2.0.0',
        context: context,
        processingTime: Date.now()
      },
      capabilities: [
        'code-analysis',
        'debugging',
        'architecture',
        'optimization',
        'security'
      ]
    }
  }

  async generateCacheKey(question, context) {
    const crypto = await import('crypto')
    const hash = await crypto.webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ question, context })))
    const hashArray = Array.from(new Uint8Array(hash))
    const hashString = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('')
    return `ai-groot:${hashString}`
  }

  generateResponseId() {
    return `resp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  async getHealthStatus() {
    return {
      status: 'healthy',
      providers: aiProviders.providers.map(p => ({ name: p.name, enabled: p.enabled })),
      cache: await this.cache.getStats(),
      rateLimiter: this.rateLimiter.getStats(),
      metrics: this.metrics.getSummary()
    }
  }
}

export const aiGateway = new AIGateway()
