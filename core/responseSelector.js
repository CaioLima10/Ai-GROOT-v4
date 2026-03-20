import { responseFormatter } from './responseFormatter.js'

/**
 * Sistema inteligente de seleção da melhor resposta
 * Escolhe a melhor resposta entre múltiplas fontes de IA
 */

export class ResponseSelector {
  constructor() {
    this.selectionHistory = []
    this.selectionCriteria = {
      length: { weight: 0.2, min: 10 },
      clarity: { weight: 0.25, min: 0.6 },
      completeness: { weight: 0.2, min: 0.7 },
      relevance: { weight: 0.25, min: 0.7 },
      coherence: { weight: 0.1, min: 0.5 }
    }
  }

  /**
   * Seleciona a melhor resposta entre múltiplas opções
   */
  selectBest(answers, context = {}) {
    if (!answers || answers.length === 0) {
      return ""
    }
    
    if (answers.length === 1) {
      return responseFormatter.normalizeResponse(answers[0])
    }
    
    console.log(`🎯 Selecionando melhor resposta entre ${answers.length} opções`)
    
    try {
      // Calcular score para cada resposta
      const scoredAnswers = answers.map((answer, index) => {
        const score = this.calculateAnswerScore(answer, index, context)
        return {
          answer,
          index,
          score,
          normalized: responseFormatter.normalizeResponse(answer)
        }
      })
      
      // Ordenar por score (maior primeiro)
      scoredAnswers.sort((a, b) => b.score - a.score)
      
      const best = scoredAnswers[0]
      
      // Salvar no histórico
      this.saveSelection(best, scoredAnswers, context)
      
      console.log(`✅ Melhor resposta selecionada (score: ${best.score.toFixed(3)})`)
      
      return best.normalized
      
    } catch (error) {
      console.error('❌ Erro na seleção de resposta:', error)
      
      // Fallback: primeira resposta válida
      return responseFormatter.normalizeResponse(answers[0])
    }
  }

  /**
   * Calcula score para uma resposta específica
   */
  calculateAnswerScore(answer, index, context) {
    const normalized = responseFormatter.normalizeResponse(answer)
    
    let score = 0
    
    // Critério 1: Comprimento (ideal entre 50-500 caracteres)
    const length = normalized.length
    if (length >= this.selectionCriteria.length.min && length <= 500) {
      score += this.selectionCriteria.length.weight
    } else if (length > 0) {
      score += Math.max(0, this.selectionCriteria.length.weight * (1 - Math.abs(length - 100) / 400))
    }
    
    // Critério 2: Clareza (sem [object Object], sem erros)
    const clarity = this.calculateClarity(normalized)
    score += clarity * this.selectionCriteria.clarity.weight
    
    // Critério 3: Completude (não parece cortado)
    const completeness = this.calculateCompleteness(normalized)
    score += completeness * this.selectionCriteria.completeness.weight
    
    // Critério 4: Relevância (baseado no contexto)
    const relevance = this.calculateRelevance(normalized, context)
    score += relevance * this.selectionCriteria.relevance.weight
    
    // Critério 5: Coerência (estrutura lógica)
    const coherence = this.calculateCoherence(normalized)
    score += coherence * this.selectionCriteria.coherence.weight
    
    // Bônus para primeira resposta (prioridade para velocidade)
    if (index === 0) {
      score += 0.05
    }
    
    return Math.max(0, Math.min(1, score))
  }

  /**
   * Calcula clareza da resposta
   */
  calculateClarity(text) {
    let clarity = 1.0
    
    // Penalizar [object Object]
    if (text.includes('[object Object]')) {
      clarity -= 0.8
    }
    
    // Penalizar erros de formatação
    if (text.includes('[Format Error')) {
      clarity -= 0.6
    }
    
    // Penalizar respostas muito curtas
    if (text.length < 10) {
      clarity -= 0.3
    }
    
    // Penalizar respostas só com caracteres especiais
    if (/^[^\w\s]+$/i.test(text)) {
      clarity -= 0.2
    }
    
    return Math.max(0, clarity)
  }

  /**
   * Calcula completude da resposta
   */
  calculateCompleteness(text) {
    let completeness = 1.0
    
    // Penalizar respostas que parecem cortadas
    if (text.endsWith('...') || text.endsWith('…')) {
      completeness -= 0.4
    }
    
    // Penalizar respostas muito curtas
    if (text.length < 20) {
      completeness -= 0.3
    }
    
    // Penalizar respostas sem estrutura básica
    const hasStructure = /[.!?]/.test(text) || text.includes('\n')
    if (!hasStructure) {
      completeness -= 0.2
    }
    
    // Bônus para respostas bem estruturadas
    if (text.includes('\n') && /[.!?]/.test(text)) {
      completeness += 0.1
    }
    
    return Math.max(0, completeness)
  }

  /**
   * Calcula relevância da resposta para o contexto
   */
  calculateRelevance(text, context) {
    let relevance = 0.5 // base
    
    if (!context || !context.query) {
      return relevance
    }
    
    const query = context.query.toLowerCase()
    const textLower = text.toLowerCase()
    
    // Verificar se a resposta contém palavras-chave da query
    const queryWords = query.split(/\s+/).filter(word => word.length > 2)
    
    queryWords.forEach(word => {
      if (textLower.includes(word)) {
        relevance += 0.1
      }
    })
    
    // Bônus para respostas que endereçam diretamente a query
    if (textLower.includes(query)) {
      relevance += 0.2
    }
    
    return Math.max(0, Math.min(1, relevance))
  }

  /**
   * Calcula coerência da resposta
   */
  calculateCoherence(text) {
    let coherence = 0.5 // base
    
    // Verificar se a resposta tem estrutura lógica
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    
    if (sentences.length > 1) {
      coherence += 0.2 // múltiplas frases
    }
    
    // Verificar se há contradições óbvias
    const hasContradictions = this.detectContradictions(text)
    if (!hasContradictions) {
      coherence += 0.2
    }
    
    // Bônus para respostas bem formatadas
    if (text.includes('\n') && text.length > 50) {
      coherence += 0.1
    }
    
    return Math.max(0, Math.min(1, coherence))
  }

  /**
   * Detecta contradições simples no texto
   */
  detectContradictions(text) {
    const contradictions = [
      { pattern: /\b(não|sim)\b.*\b(sim|não)\b/i, description: 'não/sim' },
      { pattern: /\b(sempre|nunca)\b.*\b(nunca|sempre)\b/i, description: 'sempre/nunca' },
      { pattern: /\b(tudo|nada)\b.*\b(nada|tudo)\b/i, description: 'tudo/nada' }
    ]
    
    return contradictions.some(contradiction => contradiction.pattern.test(text))
  }

  /**
   * Salva seleção no histórico
   */
  saveSelection(best, allScores, context) {
    const selection = {
      timestamp: Date.now(),
      bestIndex: best.index,
      bestScore: best.score,
      totalAnswers: allScores.length,
      allScores: allScores.map(s => s.score),
      context,
      responseLength: best.normalized.length,
      hasIssues: responseFormatter.validateResponse(best.normalized).issues.length > 0
    }
    
    this.selectionHistory.push(selection)
    
    // Manter apenas últimos 50 seleções
    if (this.selectionHistory.length > 50) {
      this.selectionHistory = this.selectionHistory.slice(-50)
    }
  }

  /**
   * Obtém estatísticas de seleção
   */
  getSelectionStats() {
    if (this.selectionHistory.length === 0) {
      return {
        totalSelections: 0,
        averageScore: 0,
        firstChoiceRate: 0,
        averageResponseLength: 0
      }
    }
    
    const totalSelections = this.selectionHistory.length
    const averageScore = this.selectionHistory.reduce((sum, s) => sum + s.bestScore, 0) / totalSelections
    const firstChoiceRate = this.selectionHistory.filter(s => s.bestIndex === 0).length / totalSelections
    const averageResponseLength = this.selectionHistory.reduce((sum, s) => sum + s.responseLength, 0) / totalSelections
    
    return {
      totalSelections,
      averageScore: averageScore.toFixed(3),
      firstChoiceRate: (firstChoiceRate * 100).toFixed(1) + '%',
      averageResponseLength: Math.round(averageResponseLength),
      recentSelections: this.selectionHistory.slice(-5)
    }
  }

  /**
   * Limpa histórico de seleções
   */
  clearHistory() {
    this.selectionHistory = []
    console.log('🧹 Histórico de seleções limpo')
  }

  /**
   * Exporta dados de seleção para debug
   */
  exportSelectionData() {
    return {
      criteria: this.selectionCriteria,
      stats: this.getSelectionStats(),
      history: this.selectionHistory,
      timestamp: Date.now()
    }
  }
}

export const responseSelector = new ResponseSelector()
