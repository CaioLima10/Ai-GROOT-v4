import { ragEngine } from './ragEngine.js'
import { nlpProcessor } from '../nlp/nlpProcessor.js'
import brain from 'brain.js'

// Rede neural para aprendizado de padrões
const patternNetwork = new brain.recurrent.LSTM()

export class AutoLearner {
  constructor() {
    this.learningHistory = []
    this.patterns = new Map()
    this.successRate = 0
    this.totalInteractions = 0
    this.successfulInteractions = 0
  }
  
  async learn(question, response, intent, feedback = null) {
    const learningData = {
      id: `learn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      question,
      response,
      intent,
      feedback,
      timestamp: Date.now(),
      success: this.evaluateSuccess(question, response, feedback)
    }
    
    // Salvar na memória RAG
    await ragEngine.saveInteraction(question, response, intent, {
      learning_data: learningData,
      is_learning: true
    })
    
    // Atualizar estatísticas
    this.updateStats(learningData.success)
    
    // Detectar padrões
    await this.detectPatterns(learningData)
    
    // Treinar rede neural com novos padrões
    await this.trainPattern(learningData)
    
    console.log(`🧠 AutoLearner: Interação aprendida (sucesso: ${learningData.success})`)
    
    return learningData
  }
  
  async learnWithFeedback(question, answer, feedback) {
    const intent = await nlpProcessor.detectIntent(question)
    
    const improvedResponse = feedback.improved_response || answer
    
    // Se o feedback for negativo, gerar resposta melhorada
    if (feedback.score && feedback.score < 0.5) {
      const learning = {
        original_answer: answer,
        feedback_score: feedback.score,
        feedback_comment: feedback.comment,
        improved_answer: improvedResponse
      }
      
      await this.learn(question, improvedResponse, intent, learning)
      
      return {
        status: 'learned',
        improved_response: improvedResponse,
        learning_confidence: this.calculateLearningConfidence(learning)
      }
    }
    
    return { status: 'no_improvement_needed' }
  }
  
  evaluateSuccess(question, response, feedback) {
    // Avaliar sucesso baseado em múltiplos fatores
    let score = 0.5 // Base score
    
    // Feedback explícito
    if (feedback) {
      if (feedback.score) {
        score = feedback.score
      } else if (feedback.positive) {
        score += 0.3
      } else if (feedback.negative) {
        score -= 0.3
      }
    }
    
    // Qualidade da resposta
    if (response && response.length > 50) {
      score += 0.1
    }
    
    if (response && response.includes('```')) {
      score += 0.1 // Incluiu código
    }
    
    // Intenção correspondente
    const questionWords = question.toLowerCase().split(' ')
    const responseWords = response.toLowerCase().split(' ')
    const overlap = questionWords.filter(word => responseWords.includes(word)).length
    
    if (overlap > 0) {
      score += 0.1
    }
    
    return Math.max(0, Math.min(1, score))
  }
  
  updateStats(success) {
    this.totalInteractions++
    if (success > 0.5) {
      this.successfulInteractions++
    }
    this.successRate = this.successfulInteractions / this.totalInteractions
  }
  
  async detectPatterns(learningData) {
    const patternKey = this.generatePatternKey(learningData)
    
    if (!this.patterns.has(patternKey)) {
      this.patterns.set(patternKey, {
        type: learningData.intent.type,
        examples: [],
        successRate: 0,
        bestResponse: null
      })
    }
    
    const pattern = this.patterns.get(patternKey)
    pattern.examples.push(learningData)
    
    // Calcular taxa de sucesso do padrão
    const successful = pattern.examples.filter(ex => ex.success > 0.5).length
    pattern.successRate = successful / pattern.examples.length
    
    // Encontrar melhor resposta
    pattern.bestResponse = pattern.examples
      .sort((a, b) => b.success - a.success)[0]?.response
  }
  
  generatePatternKey(learningData) {
    // Gerar chave baseada em características da interação
    const intent = learningData.intent.type
    const hasCode = learningData.intent.hasCode || false
    const questionLength = learningData.question.length
    
    return `${intent}_${hasCode ? 'code' : 'text'}_${Math.floor(questionLength / 50)}`
  }
  
  async trainPattern(learningData) {
    // Preparar dados para treinamento da rede neural
    const inputData = this.prepareTrainingData(learningData)
    
    if (inputData.length > 0) {
      // Treinar com novos dados
      patternNetwork.train(inputData, {
        iterations: 20,
        log: (stats) => console.log('🧪 Training stats:', stats),
        errorThresh: 0.01
      })
    }
  }
  
  prepareTrainingData(learningData) {
    // Converter dados para formato de treinamento
    return [{
      input: this.extractFeatures(learningData.question),
      output: learningData.success
    }]
  }
  
  extractFeatures(text) {
    // Extrair características do texto para a rede neural
    const features = {
      length: text.length,
      words: text.split(' ').length,
      hasCode: text.includes('```') || text.includes('function'),
      hasQuestion: text.includes('?'),
      hasError: text.includes('erro') || text.includes('bug'),
      sentiment: 0.5 // Placeholder para análise de sentimento
    }
    
    return Object.values(features)
  }
  
  calculateLearningConfidence(learning) {
    // Calcular confiança no aprendizado baseado em múltiplos fatores
    let confidence = 0.5
    
    // Baseado no score de feedback
    if (learning.feedback_score) {
      confidence = learning.feedback_score
    }
    
    // Ajustar baseado no histórico
    confidence *= (0.5 + this.successRate)
    
    return Math.max(0, Math.min(1, confidence))
  }
  
  async predictResponse(question, intent) {
    // Prever melhor resposta baseada em padrões aprendidos
    const patternKey = this.generatePatternKey({ question, intent })
    const pattern = this.patterns.get(patternKey)
    
    if (pattern && pattern.bestResponse) {
      return {
        response: pattern.bestResponse,
        confidence: pattern.successRate,
        pattern: patternKey
      }
    }
    
    // Usar rede neural para predição
    const features = this.extractFeatures(question)
    const prediction = patternNetwork.run(features)
    
    return {
      response: null,
      confidence: prediction,
      pattern: null
    }
  }
  
  async adaptToUser(userId, preferences) {
    // Adaptar respostas baseadas em preferências do usuário
    const userProfile = {
      userId,
      preferences,
      learningHistory: this.getHistoryForUser(userId),
      adaptationLevel: 0
    }
    
    // Ajustar parâmetros baseados no perfil
    if (preferences.verbose) {
      userProfile.adaptationLevel += 0.2
    }
    
    if (preferences.codeExamples) {
      userProfile.adaptationLevel += 0.1
    }
    
    return userProfile
  }
  
  getHistoryForUser(userId) {
    // Obter histórico de aprendizado para usuário específico
    return this.learningHistory.filter(learning => learning.userId === userId)
  }
  
  async generateInsights() {
    // Gerar insights sobre o aprendizado
    const insights = {
      totalInteractions: this.totalInteractions,
      successRate: this.successRate,
      patternsLearned: this.patterns.size,
      topPatterns: this.getTopPatterns(5),
      improvementSuggestions: this.generateImprovementSuggestions()
    }
    
    return insights
  }
  
  getTopPatterns(count = 5) {
    return Array.from(this.patterns.entries())
      .sort(([, a], [, b]) => b.successRate - a.successRate)
      .slice(0, count)
      .map(([key, pattern]) => ({ key, ...pattern }))
  }
  
  generateImprovementSuggestions() {
    const suggestions = []
    
    if (this.successRate < 0.7) {
      suggestions.push('Taxa de sucesso baixa. Considere revisar as respostas geradas.')
    }
    
    if (this.patterns.size < 10) {
      suggestions.push('Poucos padrões aprendidos. Mais interações ajudarão a melhorar.')
    }
    
    const lowSuccessPatterns = Array.from(this.patterns.values())
      .filter(p => p.successRate < 0.5)
    
    if (lowSuccessPatterns.length > 0) {
      suggestions.push(`${lowSuccessPatterns.length} padrões com baixa taxa de sucesso precisam de atenção.`)
    }
    
    return suggestions
  }
  
  async exportLearningData() {
    // Exportar dados de aprendizado para backup
    return {
      learningHistory: this.learningHistory,
      patterns: Object.fromEntries(this.patterns),
      stats: {
        totalInteractions: this.totalInteractions,
        successRate: this.successRate,
        successfulInteractions: this.successfulInteractions
      },
      exportDate: new Date().toISOString()
    }
  }
  
  async importLearningData(data) {
    // Importar dados de aprendizado de backup
    this.learningHistory = data.learningHistory || []
    this.patterns = new Map(Object.entries(data.patterns || {}))
    this.totalInteractions = data.stats?.totalInteractions || 0
    this.successfulInteractions = data.stats?.successfulInteractions || 0
    this.successRate = this.totalInteractions > 0 ? this.successfulInteractions / this.totalInteractions : 0
    
    console.log('📥 AutoLearner: Dados importados com sucesso')
  }
}

export const autoLearner = new AutoLearner()
