import { aiProfile } from '../config/aiProfile.js'
import { AI_ENTERPRISE_NAME } from "../packages/shared-config/src/brand.js"

/**
 * Sistema profissional de formatação de respostas
 * Garante que nunca retorne [object Object]
 */

export class ResponseFormatter {
  constructor() {
    this.formatErrors = []
    this.responseStats = {
      totalResponses: 0,
      successfulFormats: 0,
      failedFormats: 0
    }
  }

  /**
   * Normaliza qualquer tipo de resposta para string
   */
  normalizeResponse(res) {
    this.responseStats.totalResponses++
    
    try {
      // Caso 1: null ou undefined
      if (res === null || res === undefined) {
        return ""
      }
      
      // Caso 2: string (já está ok)
      if (typeof res === 'string') {
        this.responseStats.successfulFormats++
        return res
      }
      
      // Caso 3: number
      if (typeof res === 'number') {
        this.responseStats.successfulFormats++
        return String(res)
      }
      
      // Caso 4: boolean
      if (typeof res === 'boolean') {
        this.responseStats.successfulFormats++
        return res ? 'true' : 'false'
      }
      
      // Caso 5: Array
      if (Array.isArray(res)) {
        this.responseStats.successfulFormats++
        return res.map(item => this.normalizeResponse(item)).join(' ')
      }
      
      // Caso 6: Object (o problema principal)
      if (typeof res === 'object') {
        return this.extractFromObject(res)
      }
      
      // Caso 7: Function
      if (typeof res === 'function') {
        this.responseStats.successfulFormats++
        return "[Function]"
      }
      
      // Caso padrão: converter para string
      this.responseStats.successfulFormats++
      return String(res)
      
    } catch (error) {
      this.responseStats.failedFormats++
      this.formatErrors.push({
        timestamp: Date.now(),
        error: error.message,
        type: res?.constructor?.name || 'unknown'
      })
      
      return `[Format Error: ${error.message}]`
    }
  }

  /**
   * Extrai conteúdo de objetos de resposta de IA
   */
  extractFromObject(obj) {
    try {
      // Prioridade 1: propriedades comuns de resposta
      const textProps = ['text', 'content', 'message', 'response', 'answer']
      for (const prop of textProps) {
        if (obj[prop] && typeof obj[prop] === 'string') {
          this.responseStats.successfulFormats++
          return obj[prop]
        }
      }
      
      // Prioridade 2: choices (comum em APIs de IA)
      if (obj.choices && Array.isArray(obj.choices) && obj.choices.length > 0) {
        const choice = obj.choices[0]
        
        // Tentar extrair de diferentes formatos de choices
        if (choice.message?.content) {
          this.responseStats.successfulFormats++
          return choice.message.content
        }
        
        if (choice.text) {
          this.responseStats.successfulFormats++
          return choice.text
        }
        
        if (choice.message) {
          this.responseStats.successfulFormats++
          return choice.message
        }
        
        if (choice.content) {
          this.responseStats.successfulFormats++
          return choice.content
        }
      }
      
      // Prioridade 3: data ou result
      if (obj.data) {
        const dataText = this.extractFromObject(obj.data)
        if (dataText) {
          this.responseStats.successfulFormats++
          return dataText
        }
      }
      
      if (obj.result) {
        const resultText = this.extractFromObject(obj.result)
        if (resultText) {
          this.responseStats.successfulFormats++
          return resultText
        }
      }
      
      // Prioridade 4: output
      if (obj.output) {
        const outputText = this.extractFromObject(obj.output)
        if (outputText) {
          this.responseStats.successfulFormats++
          return outputText
        }
      }
      
      // Prioridade 5: converter objeto para JSON formatado
      this.responseStats.successfulFormats++
      return JSON.stringify(obj, null, 2)
      
    } catch (error) {
      this.responseStats.failedFormats++
      return `[Object Extraction Error: ${error.message}]`
    }
  }

  /**
   * Adiciona prefixo personalizado do GIOM
   */
  addGrootPrefix(text) {
    if (!text || text.trim() === '') {
      return aiProfile.description || `🤖 ${AI_ENTERPRISE_NAME}`
    }
    
    return `🤖 ${AI_ENTERPRISE_NAME}\n\n${text}`
  }

  /**
   * Formata resposta completa com personalidade
   */
  formatCompleteResponse(text, context = {}) {
    const normalizedText = this.normalizeResponse(text)
    
    // Se já tiver prefixo, não duplicar
    if (normalizedText.includes(`🤖 ${AI_ENTERPRISE_NAME}`)) {
      return normalizedText
    }
    
    return this.addGrootPrefix(normalizedText)
  }

  /**
   * Formata resposta de erro
   */
  formatError(error, context = {}) {
    const errorText = this.normalizeResponse(error)
    
    return this.addGrootPrefix(`❌ Erro: ${errorText}`)
  }

  /**
   * Formata resposta de sucesso
   */
  formatSuccess(text, context = {}) {
    const successText = this.normalizeResponse(text)
    
    return this.addGrootPrefix(`✅ ${successText}`)
  }

  /**
   * Valida se uma resposta está formatada corretamente
   */
  validateResponse(response) {
    const issues = []
    
    if (response === null || response === undefined) {
      issues.push('Response is null or undefined')
    }
    
    if (typeof response === 'object' && !Array.isArray(response)) {
      issues.push('Response is an object (not string)')
    }
    
    if (typeof response === 'string' && response.includes('[object Object]')) {
      issues.push('Response contains [object Object]')
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      response
    }
  }

  /**
   * Limpa erros de formatação
   */
  clearFormatErrors() {
    this.formatErrors = []
    console.log('🧹 Erros de formatação limpos')
  }

  /**
   * Obtém estatísticas de formatação
   */
  getFormatStats() {
    return {
      ...this.responseStats,
      successRate: this.responseStats.totalResponses > 0 
        ? (this.responseStats.successfulFormats / this.responseStats.totalResponses * 100).toFixed(1) + '%'
        : '0%',
      errorRate: this.responseStats.totalResponses > 0
        ? (this.responseStats.failedFormats / this.responseStats.totalResponses * 100).toFixed(1) + '%'
        : '0%',
      recentErrors: this.formatErrors.slice(-5)
    }
  }

  /**
   * Exporta dados de formatação para debug
   */
  exportFormatData() {
    return {
      profile: aiProfile.name,
      stats: this.getFormatStats(),
      errors: this.formatErrors,
      timestamp: Date.now()
    }
  }
}

export const responseFormatter = new ResponseFormatter()
