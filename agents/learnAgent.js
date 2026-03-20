import { ragEngine } from '../learning/ragEngine.js'

export class LearnAgent {
  constructor() {
    this.name = 'learnAgent'
    this.capabilities = [
      'acquire_knowledge',
      'store_patterns',
      'improve_responses',
      'track_progress',
      'adapt_behavior',
      'continuous_learning'
    ]
    
    this.knowledgeBase = new Map()
    this.learningHistory = []
    this.performanceMetrics = {
      totalLearned: 0,
      successfulApplications: 0,
      failureRate: 0
    }
  }

  async run(task, analysis, context = {}) {
    console.log(`🧠 LearnAgent: Processando tarefa de aprendizado: ${task}`)
    
    try {
      const learningType = this.identifyLearningType(task, analysis)
      
      switch (learningType) {
        case 'knowledge_acquisition':
          return await this.acquireKnowledge(task, context)
        case 'pattern_recognition':
          return await this.recognizePatterns(task, context)
        case 'behavior_adaptation':
          return await this.adaptBehavior(task, context)
        case 'performance_analysis':
          return await this.analyzePerformance(task, context)
        default:
          return await this.generalLearning(task, context)
      }
      
    } catch (error) {
      console.error(`❌ LearnAgent: Erro no aprendizado:`, error)
      return {
        success: false,
        error: error.message,
        suggestion: 'Tente fornecer mais contexto ou dados específicos'
      }
    }
  }

  identifyLearningType(task, analysis) {
    const lowerTask = task.toLowerCase()
    
    if (lowerTask.includes('aprender') || lowerTask.includes('estudar')) {
      return 'knowledge_acquisition'
    }
    
    if (lowerTask.includes('padrão') || lowerTask.includes('pattern')) {
      return 'pattern_recognition'
    }
    
    if (lowerTask.includes('adaptar') || lowerTask.includes('melhorar')) {
      return 'behavior_adaptation'
    }
    
    if (lowerTask.includes('performance') || lowerTask.includes('métrica')) {
      return 'performance_analysis'
    }
    
    return 'general_learning'
  }

  async acquireKnowledge(task, context) {
    console.log(`📚 Adquirindo conhecimento: ${task}`)
    
    const knowledge = {
      id: this.generateKnowledgeId(),
      content: task,
      source: context.source || 'user_input',
      category: this.categorizeKnowledge(task),
      timestamp: Date.now(),
      confidence: context.confidence || 0.8,
      tags: this.extractTags(task),
      relationships: []
    }
    
    // Buscar conhecimento relacionado
    const relatedKnowledge = await this.findRelatedKnowledge(knowledge)
    knowledge.relationships = relatedKnowledge.map(k => ({ id: k.id, type: 'related_to' }))
    
    // Salvar na base de conhecimento
    this.knowledgeBase.set(knowledge.id, knowledge)
    
    // Salvar também no RAG para busca vetorial
    await ragEngine.saveInteraction(
      task,
      `Conhecimento adquirido: ${task}`,
      { type: 'learning', confidence: knowledge.confidence },
      { knowledge_id: knowledge.id }
    )
    
    // Atualizar métricas
    this.updateMetrics('knowledge_acquired')
    
    const result = {
      success: true,
      type: 'knowledge_acquisition',
      knowledge,
      relatedKnowledge,
      insights: this.generateKnowledgeInsights(knowledge, relatedKnowledge),
      metadata: {
        acquisitionTime: Date.now(),
        category: knowledge.category,
        tagsCount: knowledge.tags.length
      }
    }
    
    console.log(`✅ Conhecimento adquirido: ${knowledge.category}`)
    return result
  }

  async recognizePatterns(task, context) {
    console.log(`🔍 Reconhecendo padrões em: ${task}`)
    
    // Analisar dados históricos para encontrar padrões
    const historicalData = this.getRelevantHistoricalData(task)
    const patterns = this.extractPatterns(historicalData)
    
    // Validar padrões encontrados
    const validatedPatterns = await this.validatePatterns(patterns)
    
    // Criar regras baseadas nos padrões
    const rules = this.createRulesFromPatterns(validatedPatterns)
    
    const patternResult = {
      success: true,
      type: 'pattern_recognition',
      task,
      patterns: validatedPatterns,
      rules,
      confidence: this.calculatePatternConfidence(validatedPatterns),
      insights: this.generatePatternInsights(validatedPatterns),
      metadata: {
        analysisTime: Date.now(),
        patternsFound: validatedPatterns.length,
        rulesCreated: rules.length
      }
    }
    
    // Salvar aprendizado de padrões
    await this.savePatternLearning(patternResult)
    
    console.log(`✅ ${validatedPatterns.length} padrões reconhecidos`)
    return patternResult
  }

  async adaptBehavior(task, context) {
    console.log(`🔄 Adaptando comportamento baseado em: ${task}`)
    
    // Analisar feedback e performance recente
    const recentPerformance = this.getRecentPerformance()
    const feedback = context.feedback || []
    
    // Identificar áreas de melhoria
    const improvements = this.identifyImprovements(recentPerformance, feedback)
    
    // Criar plano de adaptação
    const adaptationPlan = this.createAdaptationPlan(improvements)
    
    // Aplicar adaptações
    const adaptations = await this.applyAdaptations(adaptationPlan)
    
    const adaptationResult = {
      success: true,
      type: 'behavior_adaptation',
      improvements,
      adaptationPlan,
      adaptations,
      expectedImpact: this.calculateExpectedImpact(adaptations),
      metadata: {
        adaptationTime: Date.now(),
        adaptationsApplied: adaptations.length,
        expectedImprovement: this.calculateExpectedImprovement(adaptations)
      }
    }
    
    console.log(`✅ ${adaptations.length} adaptações aplicadas`)
    return adaptationResult
  }

  async analyzePerformance(task, context) {
    console.log(`📊 Analisando performance: ${task}`)
    
    const metrics = {
      responseTime: this.calculateAverageResponseTime(),
      accuracy: this.calculateAccuracy(),
      userSatisfaction: this.calculateUserSatisfaction(),
      learningRate: this.calculateLearningRate(),
      knowledgeGrowth: this.calculateKnowledgeGrowth()
    }
    
    const trends = this.identifyTrends(metrics)
    const recommendations = this.generatePerformanceRecommendations(metrics, trends)
    
    const performanceResult = {
      success: true,
      type: 'performance_analysis',
      metrics,
      trends,
      recommendations,
      insights: this.generatePerformanceInsights(metrics, trends),
      metadata: {
        analysisTime: Date.now(),
        metricsCount: Object.keys(metrics).length,
        recommendationsCount: recommendations.length
      }
    }
    
    console.log(`✅ Análise de performance concluída`)
    return performanceResult
  }

  async generalLearning(task, context) {
    console.log(`🎯 Aprendizado geral: ${task}`)
    
    // Combinar múltiplas estratégias de aprendizado
    const knowledgeResult = await this.acquireKnowledge(task, context)
    const patternResult = await this.recognizePatterns(task, context)
    
    // Integrar resultados
    const integratedLearning = this.integrateLearningResults([
      knowledgeResult,
      patternResult
    ])
    
    const generalResult = {
      success: true,
      type: 'general_learning',
      task,
      integratedLearning,
      confidence: this.calculateIntegratedConfidence(integratedLearning),
      nextSteps: this.generateNextSteps(integratedLearning),
      metadata: {
        learningTime: Date.now(),
        strategiesUsed: ['knowledge_acquisition', 'pattern_recognition'],
        integrationLevel: integratedLearning.level
      }
    }
    
    console.log(`✅ Aprendizado geral concluído`)
    return generalResult
  }

  // Métodos auxiliares
  categorizeKnowledge(content) {
    const categories = {
      'programming': ['código', 'função', 'classe', 'api', 'database'],
      'debugging': ['erro', 'bug', 'falha', 'exception'],
      'architecture': ['design', 'padrão', 'arquitetura', 'estrutura'],
      'performance': ['otimização', 'performance', 'velocidade', 'eficiência'],
      'security': ['segurança', 'vulnerabilidade', 'autenticação', 'criptografia'],
      'testing': ['teste', 'unit', 'integration', 'tdd'],
      'deployment': ['deploy', 'produção', 'servidor', 'cloud']
    }
    
    const lowerContent = content.toLowerCase()
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lowerContent.includes(keyword))) {
        return category
      }
    }
    
    return 'general'
  }

  extractTags(content) {
    const tags = []
    const words = content.toLowerCase().split(/\s+/)
    
    // Extrair palavras-chave relevantes
    const techKeywords = [
      'javascript', 'python', 'java', 'react', 'vue', 'angular',
      'node', 'express', 'django', 'flask', 'mongodb', 'mysql',
      'docker', 'kubernetes', 'aws', 'azure', 'gcp',
      'git', 'github', 'ci', 'cd', 'testing', 'tdd'
    ]
    
    words.forEach(word => {
      if (techKeywords.includes(word) && !tags.includes(word)) {
        tags.push(word)
      }
    })
    
    return tags
  }

  async findRelatedKnowledge(knowledge) {
    const related = []
    
    for (const [id, existingKnowledge] of this.knowledgeBase.entries()) {
      if (id !== knowledge.id) {
        const similarity = this.calculateSimilarity(knowledge, existingKnowledge)
        if (similarity > 0.7) {
          related.push(existingKnowledge)
        }
      }
    }
    
    return related.sort((a, b) => b.confidence - a.confidence).slice(0, 5)
  }

  calculateSimilarity(k1, k2) {
    // Similaridade simples baseada em tags e categoria
    if (k1.category === k2.category) {
      const commonTags = k1.tags.filter(tag => k2.tags.includes(tag))
      const totalTags = new Set([...k1.tags, ...k2.tags]).size
      return commonTags.length / totalTags
    }
    
    return 0.1 // Similaridade baixa para categorias diferentes
  }

  generateKnowledgeInsights(knowledge, related) {
    return {
      category: knowledge.category,
      connections: related.length,
      confidence: knowledge.confidence,
      recommendations: [
        `Explore mais sobre ${knowledge.category}`,
        related.length > 0 ? `Conectado com ${related.length} tópicos relacionados` : 'Primeiro conhecimento nesta área'
      ]
    }
  }

  getRelevantHistoricalData(task) {
    return this.learningHistory
      .filter(item => item.task && item.task.toLowerCase().includes(task.toLowerCase().substring(0, 5)))
      .slice(-20) // Últimas 20 interações
  }

  extractPatterns(data) {
    const patterns = []
    
    // Implementar extração de padrões simples
    const successPatterns = data.filter(item => item.success)
    const failurePatterns = data.filter(item => !item.success)
    
    if (successPatterns.length > 3) {
      patterns.push({
        type: 'success_pattern',
        description: 'Estratégias que levam ao sucesso',
        frequency: successPatterns.length,
        examples: successPatterns.slice(0, 3)
      })
    }
    
    if (failurePatterns.length > 2) {
      patterns.push({
        type: 'failure_pattern',
        description: 'Causas comuns de falha',
        frequency: failurePatterns.length,
        examples: failurePatterns.slice(0, 3)
      })
    }
    
    return patterns
  }

  async validatePatterns(patterns) {
    return patterns.filter(pattern => pattern.frequency >= 2)
  }

  createRulesFromPatterns(patterns) {
    return patterns.map(pattern => ({
      id: this.generateRuleId(),
      condition: pattern.type,
      action: pattern.description,
      confidence: Math.min(0.9, pattern.frequency / 10),
      examples: pattern.examples
    }))
  }

  calculatePatternConfidence(patterns) {
    if (patterns.length === 0) return 0
    
    const avgFrequency = patterns.reduce((sum, p) => sum + p.frequency, 0) / patterns.length
    return Math.min(0.9, avgFrequency / 5)
  }

  generatePatternInsights(patterns) {
    return {
      totalPatterns: patterns.length,
      dominantType: patterns.length > 0 ? patterns[0].type : 'none',
      reliability: patterns.length > 0 ? patterns[0].frequency : 0
    }
  }

  async savePatternLearning(result) {
    this.learningHistory.push({
      type: 'pattern_learning',
      timestamp: Date.now(),
      result
    })
  }

  getRecentPerformance() {
    return this.learningHistory
      .filter(item => item.type === 'performance_analysis')
      .slice(-10)
  }

  identifyImprovements(performance, feedback) {
    const improvements = []
    
    if (performance.some(p => p.metrics.accuracy < 0.8)) {
      improvements.push({
        area: 'accuracy',
        description: 'Melhorar precisão das respostas',
        priority: 'high'
      })
    }
    
    if (feedback.some(f => f.rating < 3)) {
      improvements.push({
        area: 'user_satisfaction',
        description: 'Aumentar satisfação do usuário',
        priority: 'high'
      })
    }
    
    return improvements
  }

  createAdaptationPlan(improvements) {
    return improvements.map(improvement => ({
      id: this.generateAdaptationId(),
      improvement,
      steps: this.generateAdaptationSteps(improvement),
      timeline: this.estimateAdaptationTimeline(improvement)
    }))
  }

  generateAdaptationSteps(improvement) {
    const stepsMap = {
      'accuracy': [
        'Analisar erros comuns',
        'Ajustar prompts',
        'Validar com testes'
      ],
      'user_satisfaction': [
        'Coletar feedback',
        'Personalizar respostas',
        'Melhorar comunicação'
      ]
    }
    
    return stepsMap[improvement.area] || ['Analisar', 'Planejar', 'Implementar']
  }

  estimateAdaptationTimeline(improvement) {
    const timelines = {
      'accuracy': '1-2 semanas',
      'user_satisfaction': '2-3 semanas'
    }
    
    return timelines[improvement.area] || '1 semana'
  }

  async applyAdaptations(plan) {
    const adaptations = []
    
    for (const item of plan) {
      // Simular aplicação de adaptações
      adaptations.push({
        id: item.id,
        area: item.improvement.area,
        status: 'applied',
        appliedAt: Date.now(),
        expectedImpact: item.improvement.priority === 'high' ? 0.8 : 0.5
      })
    }
    
    return adaptations
  }

  calculateExpectedImpact(adaptations) {
    const totalImpact = adaptations.reduce((sum, a) => sum + a.expectedImpact, 0)
    return (totalImpact / adaptations.length).toFixed(2)
  }

  calculateExpectedImprovement(adaptations) {
    const highPriorityCount = adaptations.filter(a => a.area === 'high').length
    return `${highPriorityCount} melhorias de alta prioridade aplicadas`
  }

  // Métodos de cálculo de métricas
  calculateAverageResponseTime() {
    const responseTimes = this.learningHistory
      .filter(item => item.responseTime)
      .map(item => item.responseTime)
    
    return responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0
  }

  calculateAccuracy() {
    const total = this.learningHistory.length
    const successful = this.learningHistory.filter(item => item.success).length
    
    return total > 0 ? (successful / total) : 0
  }

  calculateUserSatisfaction() {
    const feedbacks = this.learningHistory
      .filter(item => item.feedback)
      .map(item => item.feedback.rating || 3)
    
    return feedbacks.length > 0 
      ? feedbacks.reduce((sum, rating) => sum + rating, 0) / feedbacks.length
      : 3
  }

  calculateLearningRate() {
    const recentLearnings = this.learningHistory
      .filter(item => item.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000)
      .length
    
    return recentLearnings / 7 // Aprendizados por dia
  }

  calculateKnowledgeGrowth() {
    return this.knowledgeBase.size
  }

  identifyTrends(metrics) {
    const trends = []
    
    if (metrics.accuracy > 0.8) {
      trends.push({ metric: 'accuracy', direction: 'improving' })
    }
    
    if (metrics.responseTime < 1000) {
      trends.push({ metric: 'response_time', direction: 'improving' })
    }
    
    return trends
  }

  generatePerformanceRecommendations(metrics, trends) {
    const recommendations = []
    
    if (metrics.accuracy < 0.7) {
      recommendations.push({
        area: 'accuracy',
        action: 'Revisar fontes de conhecimento e validar respostas',
        priority: 'high'
      })
    }
    
    if (metrics.responseTime > 2000) {
      recommendations.push({
        area: 'performance',
        action: 'Otimizar processamento e cache',
        priority: 'medium'
      })
    }
    
    return recommendations
  }

  generatePerformanceInsights(metrics, trends) {
    return {
      overall_score: (metrics.accuracy + metrics.userSatisfaction / 5) / 2,
      strengths: trends.filter(t => t.direction === 'improving').map(t => t.metric),
      areas_for_improvement: Object.keys(metrics).filter(key => metrics[key] < 0.7)
    }
  }

  integrateLearningResults(results) {
    const integrated = {
      level: 'medium',
      insights: [],
      confidence: 0
    }
    
    results.forEach(result => {
      if (result.success) {
        integrated.insights.push(...(result.insights || []))
        integrated.confidence += result.confidence || 0.5
      }
    })
    
    integrated.confidence = Math.min(1.0, integrated.confidence / results.length)
    
    if (integrated.confidence > 0.8) {
      integrated.level = 'high'
    }
    
    return integrated
  }

  calculateIntegratedConfidence(integrated) {
    return integrated.confidence
  }

  generateNextSteps(integrated) {
    const steps = []
    
    if (integrated.level === 'high') {
      steps.push('Aplicar aprendizado em novos contextos')
      steps.push('Compartilhar conhecimento com outros agentes')
    } else {
      steps.push('Buscar mais dados para validação')
      steps.push('Refinar estratégias de aprendizado')
    }
    
    return steps
  }

  updateMetrics(type) {
    this.performanceMetrics.totalLearned++
    
    if (type === 'successful_application') {
      this.performanceMetrics.successfulApplications++
    }
    
    this.performanceMetrics.failureRate = 
      (this.performanceMetrics.totalLearned - this.performanceMetrics.successfulApplications) / 
      this.performanceMetrics.totalLearned
  }

  generateKnowledgeId() {
    return `knowledge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  generateRuleId() {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  generateAdaptationId() {
    return `adaptation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

export const learnAgent = new LearnAgent()
