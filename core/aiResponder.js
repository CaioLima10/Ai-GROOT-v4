import { askMultiAI } from './multiAI.js'
import { responseSelector } from './responseSelector.js'
import { responseFormatter } from './responseFormatter.js'

/**
 * Sistema unificado de resposta do Ai-GROOT
 * Garante que nunca retorne [object Object]
 */

export class AIResponder {
  constructor() {
    this.responseHistory = []
    this.personality = {
      name: "Ai-GROOT Enterprise",
      version: "2.1.0",
      description: "IA especialista em desenvolvimento com capacidades autônomas",
      capabilities: [
        "Geração de código",
        "Análise de projetos", 
        "Correção automática",
        "Aprendizado contínuo",
        "Operação autônoma",
        "Evolução genética"
      ]
    }
    
    this.performance = {
      totalResponses: 0,
      successfulResponses: 0,
      averageResponseTime: 0,
      errorRate: 0
    }
  }

  /**
   * Método principal de resposta
   * Garante resposta sempre como string formatada
   */
  async ask(question, context = {}) {
    const startTime = Date.now()
    this.performance.totalResponses++
    
    try {
      console.log(`🤖 AIResponder: Processando pergunta...`)
      
      // 1. Obter respostas de múltiplas fontes
      const answers = await this.getAllAnswers(question, context)
      
      // 2. Selecionar a melhor resposta
      const bestAnswer = responseSelector.selectBest(answers, {
        query: question,
        context,
        timestamp: Date.now()
      })
      
      // 3. Formatar resposta final
      const finalResponse = this.formatFinalResponse(bestAnswer, question, context)
      
      // 4. Atualizar performance
      const responseTime = Date.now() - startTime
      this.updatePerformance(true, responseTime)
      
      // 5. Salvar no histórico
      this.saveResponse(question, bestAnswer, finalResponse, responseTime)
      
      console.log(`✅ Resposta gerada em ${responseTime}ms`)
      
      return finalResponse
      
    } catch (error) {
      console.error('❌ Erro ao gerar resposta:', error)
      
      // Atualizar performance de erro
      this.updatePerformance(false, Date.now() - startTime)
      
      // Retornar erro formatado
      const errorResponse = responseFormatter.formatError(error, context)
      
      this.saveResponse(question, { error: error.message }, errorResponse, Date.now() - startTime)
      
      return errorResponse
    }
  }

  /**
   * Obtém respostas de todas as fontes de IA
   */
  async getAllAnswers(question, context) {
    console.log(`🔍 Buscando respostas de múltiplas fontes...`)
    
    const answers = []
    
    try {
      // Tentar obter respostas de múltiplos provedores
      const multiResponse = await askMultiAI(question)
      
      if (multiResponse && multiResponse.choices && Array.isArray(multiResponse.choices)) {
        answers.push(...multiResponse.choices)
        console.log(`📊 Obtidas ${multiResponse.choices.length} respostas do multiAI`)
      }
      
      // Se não houver choices, tentar formatos alternativos
      if (answers.length === 0 && multiResponse) {
        if (Array.isArray(multiResponse)) {
          answers.push(...multiResponse)
        } else if (typeof multiResponse === 'object') {
          answers.push(multiResponse)
        } else if (typeof multiResponse === 'string') {
          answers.push({ content: multiResponse, text: multiResponse })
        }
      }
      
    } catch (error) {
      console.error('❌ Erro ao obter respostas:', error)
      // Adicionar resposta de fallback
      answers.push({
        content: `Erro ao processar: ${error.message}`,
        text: `Desculpe, encontrei um erro: ${error.message}`,
        error: true
      })
    }
    
    // Garantir que temos pelo menos uma resposta
    if (answers.length === 0) {
      answers.push({
        content: "Desculpe, não consegui processar sua pergunta no momento.",
        text: "Desculpe, não consegui processar sua pergunta no momento.",
        error: true
      })
    }
    
    console.log(`📊 Total de respostas obtidas: ${answers.length}`)
    return answers
  }

  /**
   * Formata a resposta final garantindo que seja sempre string
   */
  formatFinalResponse(bestAnswer, question, context) {
    try {
      // 1. Normalizar a melhor resposta
      const normalizedAnswer = responseFormatter.normalizeResponse(bestAnswer)
      
      // 2. Adicionar personalidade do Ai-GROOT
      const personalityPrefix = this.getPersonalityPrefix()
      
      // 3. Formatar resposta completa
      let finalResponse = `${personalityPrefix}\n${normalizedAnswer}`
      
      // 4. Adicionar contexto se relevante
      if (context && context.showContext) {
        finalResponse += `\n\n---\n📋 Contexto: ${JSON.stringify(context, null, 2)}`
      }
      
      // 5. Validar resposta final
      const validation = responseFormatter.validateResponse(finalResponse)
      
      if (!validation.isValid) {
        console.warn('⚠️ Resposta final falhou na validação:', validation.issues)
        // Tentar corrigir
        finalResponse = this.fixResponseIssues(finalResponse, validation.issues)
      }
      
      return finalResponse
      
    } catch (error) {
      console.error('❌ Erro ao formatar resposta final:', error)
      
      // Retornar resposta de erro segura
      return responseFormatter.formatError(error, {
        question,
        fallback: true
      })
    }
  }

  /**
   * Gera o prefixo de personalidade do Ai-GROOT
   */
  getPersonalityPrefix() {
    return `🤖 ${this.personality.name} v${this.personality.version}

🚀 Sobre mim:
${this.personality.capabilities.map(cap => `• ${cap}`).join('\n')}

💡 Como posso ajudar hoje?`
  }

  /**
   * Corrige problemas de formatação na resposta
   */
  fixResponseIssues(response, issues) {
    let fixedResponse = response
    
    // Corrigir problemas comuns
    issues.forEach(issue => {
      switch (issue) {
        case 'Response is null or undefined':
          fixedResponse = "Desculpe, não consegui gerar uma resposta válida."
          break
          
        case 'Response is an object (not string)':
          if (typeof response === 'object') {
            fixedResponse = responseFormatter.normalizeResponse(response)
          }
          break
          
        case 'Response contains [object Object]':
          fixedResponse = response.replace(/\[object Object\]/g, '[Dados processados]')
          break
          
        default:
          // Para outros problemas, tentar normalizar
          fixedResponse = responseFormatter.normalizeResponse(response)
          break
      }
    })
    
    return fixedResponse
  }

  /**
   * Atualiza métricas de performance
   */
  updatePerformance(success, responseTime) {
    if (success) {
      this.performance.successfulResponses++
    }
    
    // Calcular média móvel de tempo de resposta
    const totalTime = this.performance.averageResponseTime * (this.performance.totalResponses - 1) + responseTime
    this.performance.averageResponseTime = totalTime / this.performance.totalResponses
    
    // Calcular taxa de erro
    this.performance.errorRate = ((this.performance.totalResponses - this.performance.successfulResponses) / this.performance.totalResponses * 100).toFixed(1)
  }

  /**
   * Salva resposta no histórico
   */
  saveResponse(question, answer, formattedResponse, responseTime) {
    const record = {
      timestamp: Date.now(),
      question,
      answer,
      formattedResponse,
      responseTime,
      success: !answer.error,
      responseLength: formattedResponse.length
    }
    
    this.responseHistory.push(record)
    
    // Manter apenas últimas 100 respostas
    if (this.responseHistory.length > 100) {
      this.responseHistory = this.responseHistory.slice(-100)
    }
  }

  /**
   * Obtém estatísticas de performance
   */
  getPerformanceStats() {
    return {
      ...this.performance,
      successRate: this.performance.totalResponses > 0 
        ? (this.performance.successfulResponses / this.performance.totalResponses * 100).toFixed(1) + '%'
        : '0%',
      averageResponseTime: Math.round(this.performance.averageResponseTime),
      recentResponses: this.responseHistory.slice(-10)
    }
  }

  /**
   * Obtém histórico de respostas
   */
  getResponseHistory(limit = 10) {
    return this.responseHistory.slice(-limit)
  }

  /**
   * Limpa histórico de respostas
   */
  clearHistory() {
    this.responseHistory = []
    this.performance = {
      totalResponses: 0,
      successfulResponses: 0,
      averageResponseTime: 0,
      errorRate: 0
    }
    console.log('🧹 Histórico de respostas limpo')
  }

  /**
   * Exporta dados para debug
   */
  exportResponseData() {
    return {
      personality: this.personality,
      performance: this.getPerformanceStats(),
      history: this.responseHistory,
      exportTimestamp: Date.now()
    }
  }
}

export const aiResponder = new AIResponder()
