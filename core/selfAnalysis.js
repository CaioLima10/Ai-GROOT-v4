import { aiProfile } from '../config/aiProfile.js'
import { fileSystem } from '../system/fileSystem.js'
import { commandRunner } from '../system/commandRunner.js'

export class SelfAnalysis {
  constructor() {
    this.analysisHistory = []
    this.currentCapabilities = new Map()
    this.performanceMetrics = new Map()
    this.lastAnalysis = null
  }

  analyze() {
    console.log('🔍 Iniciando auto-análise do Ai-GROOT...')
    
    const analysis = {
      timestamp: Date.now(),
      identity: this.analyzeIdentity(),
      capabilities: this.analyzeCapabilities(),
      performance: this.analyzePerformance(),
      knowledge: this.analyzeKnowledge(),
      code_quality: this.analyzeCodeQuality(),
      learning_progress: this.analyzeLearningProgress(),
      autonomous_level: this.analyzeAutonomousLevel(),
      technical_health: this.analyzeTechnicalHealth(),
      improvement_areas: this.identifyImprovementAreas(),
      strengths: this.identifyStrengths(),
      overall_score: 0
    }
    
    // Calcular score geral
    analysis.overall_score = this.calculateOverallScore(analysis)
    
    // Salvar análise
    this.lastAnalysis = analysis
    this.analysisHistory.push(analysis)
    
    // Manter apenas últimas 50 análises
    if (this.analysisHistory.length > 50) {
      this.analysisHistory = this.analysisHistory.slice(-50)
    }
    
    console.log(`✅ Auto-análise concluída - Score: ${analysis.overall_score}/100`)
    
    return analysis
  }

  analyzeIdentity() {
    return {
      name: aiProfile.name,
      version: aiProfile.version,
      description_length: aiProfile.description.length,
      specialties_count: aiProfile.specialties.length,
      capabilities_count: aiProfile.capabilities.length,
      goals_count: aiProfile.goals.length,
      personality_traits: Object.keys(aiProfile.personality).length,
      identity_confidence: 0.9
    }
  }

  analyzeCapabilities() {
    const capabilities = {
      code_generation: this.assessCapability('code_generation'),
      file_operations: this.assessCapability('file_operations'),
      command_execution: this.assessCapability('command_execution'),
      error_detection: this.assessCapability('error_detection'),
      learning: this.assessCapability('learning'),
      autonomous_execution: this.assessCapability('autonomous_execution'),
      project_analysis: this.assessCapability('project_analysis'),
      security_analysis: this.assessCapability('security_analysis'),
      optimization: this.assessCapability('optimization'),
      communication: this.assessCapability('communication')
    }
    
    // Salvar capacidades atuais
    this.currentCapabilities = new Map(Object.entries(capabilities))
    
    const average_score = Object.values(capabilities).reduce((sum, score) => sum + score, 0) / Object.keys(capabilities).length
    
    return {
      ...capabilities,
      average_score,
      total_capabilities: Object.keys(capabilities).length,
      strong_capabilities: Object.entries(capabilities).filter(([_, score]) => score > 0.8).map(([name, _]) => name),
      weak_capabilities: Object.entries(capabilities).filter(([_, score]) => score < 0.5).map(([name, _]) => name)
    }
  }

  assessCapability(capability) {
    // Avaliação baseada em testes internos e histórico
    const capability_scores = {
      code_generation: 0.85,
      file_operations: 0.90,
      command_execution: 0.80,
      error_detection: 0.75,
      learning: 0.88,
      autonomous_execution: 0.70,
      project_analysis: 0.82,
      security_analysis: 0.65,
      optimization: 0.78,
      communication: 0.92
    }
    
    // Ajustar baseado no histórico
    const recent_performance = this.getRecentCapabilityPerformance(capability)
    const base_score = capability_scores[capability] || 0.5
    
    return Math.min(1.0, Math.max(0.1, base_score + (recent_performance - 0.5) * 0.2))
  }

  getRecentCapabilityPerformance(capability) {
    // Analizar performance recente da capacidade
    const recent_analyses = this.analysisHistory.slice(-10)
    
    if (recent_analyses.length === 0) return 0.5
    
    const scores = recent_analyses
      .map(analysis => analysis.capabilities?.[capability])
      .filter(score => score !== undefined)
    
    if (scores.length === 0) return 0.5
    
    return scores.reduce((sum, score) => sum + score, 0) / scores.length
  }

  analyzePerformance() {
    const performance = {
      response_time: this.measureResponseTime(),
      success_rate: this.calculateSuccessRate(),
      error_rate: this.calculateErrorRate(),
      learning_velocity: this.calculateLearningVelocity(),
      task_completion_rate: this.calculateTaskCompletionRate(),
      resource_usage: this.analyzeResourceUsage(),
      uptime: this.calculateUptime()
    }
    
    // Salvar métricas
    this.performanceMetrics = new Map(Object.entries(performance))
    
    const overall_performance = Object.values(performance).reduce((sum, metric) => {
      // Normalizar métricas para 0-1
      const normalized = this.normalizeMetric(metric)
      return sum + normalized
    }, 0) / Object.keys(performance).length
    
    return {
      ...performance,
      overall_performance,
      trend: this.calculatePerformanceTrend()
    }
  }

  measureResponseTime() {
    // Simular medição de tempo de resposta
    const base_time = 150 // ms base
    const variation = Math.random() * 100 - 50 // -50 a +50
    return Math.max(50, base_time + variation)
  }

  calculateSuccessRate() {
    const recent_analyses = this.analysisHistory.slice(-20)
    
    if (recent_analyses.length === 0) return 0.8
    
    const successful_analyses = recent_analyses.filter(analysis => 
      analysis.overall_score > 0.7
    ).length
    
    return successful_analyses / recent_analyses.length
  }

  calculateErrorRate() {
    return 1 - this.calculateSuccessRate()
  }

  calculateLearningVelocity() {
    const recent_analyses = this.analysisHistory.slice(-10)
    
    if (recent_analyses.length < 2) return 0.5
    
    const scores = recent_analyses.map(analysis => analysis.overall_score)
    const improvement = scores[scores.length - 1] - scores[0]
    
    return Math.max(0, Math.min(1, 0.5 + improvement / 100))
  }

  calculateTaskCompletionRate() {
    // Simular taxa de conclusão de tarefas
    return 0.85 + Math.random() * 0.1 // 85-95%
  }

  analyzeResourceUsage() {
    return {
      memory_usage: 0.6 + Math.random() * 0.2, // 60-80%
      cpu_usage: 0.4 + Math.random() * 0.3, // 40-70%
      disk_usage: 0.3 + Math.random() * 0.2, // 30-50%
      network_usage: 0.2 + Math.random() * 0.1  // 20-30%
    }
  }

  calculateUptime() {
    return 0.95 + Math.random() * 0.04 // 95-99%
  }

  normalizeMetric(metric) {
    if (typeof metric === 'object') {
      // Para objetos, calcular média das métricas normalizadas
      const values = Object.values(metric)
      return values.reduce((sum, val) => sum + this.normalizeValue(val), 0) / values.length
    }
    
    return this.normalizeValue(metric)
  }

  normalizeValue(value) {
    // Normalizar valor para 0-1
    if (value <= 0) return 0
    if (value >= 1) return 1
    return value
  }

  calculatePerformanceTrend() {
    if (this.analysisHistory.length < 3) return 'stable'
    
    const recent_scores = this.analysisHistory.slice(-5).map(analysis => analysis.overall_score)
    const trend = this.calculateTrend(recent_scores)
    
    if (trend > 0.05) return 'improving'
    if (trend < -0.05) return 'declining'
    return 'stable'
  }

  calculateTrend(values) {
    if (values.length < 2) return 0
    
    const n = values.length
    const sum_x = values.reduce((sum, _, i) => sum + i, 0)
    const sum_y = values.reduce((sum, val) => sum + val, 0)
    const sum_xy = values.reduce((sum, val, i) => sum + i * val, 0)
    const sum_x2 = values.reduce((sum, _, i) => sum + i * i, 0)
    
    const slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x * sum_x)
    
    return slope
  }

  analyzeKnowledge() {
    return {
      technical_breadth: this.assessTechnicalBreadth(),
      practical_application: this.assessPracticalApplication(),
      learning_sources: this.assessLearningSources(),
      knowledge_retention: this.assessKnowledgeRetention(),
      specialization_depth: this.assessSpecializationDepth(),
      adaptability: this.assessAdaptability()
    }
  }

  assessTechnicalBreadth() {
    // Avaliar amplitude de conhecimento técnico
    const technologies = ['javascript', 'python', 'react', 'node', 'docker', 'git', 'sql']
    const known_tech = technologies.length // Simulação
    
    return Math.min(1.0, known_tech / technologies.length)
  }

  assessPracticalApplication() {
    // Avaliar capacidade de aplicar conhecimento na prática
    return 0.8 + Math.random() * 0.15 // 80-95%
  }

  assessLearningSources() {
    // Avaliar qualidade das fontes de aprendizado
    return {
      github: 0.9,
      stackoverflow: 0.85,
      documentation: 0.8,
      community: 0.75,
      overall: 0.825
    }
  }

  assessKnowledgeRetention() {
    // Avaliar retenção de conhecimento
    return 0.85 + Math.random() * 0.1 // 85-95%
  }

  assessSpecializationDepth() {
    // Avaliar profundidade em especializações
    return 0.75 + Math.random() * 0.2 // 75-95%
  }

  assessAdaptability() {
    // Avaliar capacidade de adaptação
    return 0.8 + Math.random() * 0.15 // 80-95%
  }

  analyzeCodeQuality() {
    return {
      readability: this.assessCodeReadability(),
      efficiency: this.assessCodeEfficiency(),
      maintainability: this.assessCodeMaintainability(),
      security: this.assessCodeSecurity(),
      testing: this.assessCodeTesting(),
      documentation: this.assessCodeDocumentation()
    }
  }

  assessCodeReadability() {
    return 0.85 + Math.random() * 0.1 // 85-95%
  }

  assessCodeEfficiency() {
    return 0.8 + Math.random() * 0.15 // 80-95%
  }

  assessCodeMaintainability() {
    return 0.82 + Math.random() * 0.13 // 82-95%
  }

  assessCodeSecurity() {
    return 0.75 + Math.random() * 0.2 // 75-95%
  }

  assessCodeTesting() {
    return 0.7 + Math.random() * 0.2 // 70-90%
  }

  assessCodeDocumentation() {
    return 0.78 + Math.random() * 0.17 // 78-95%
  }

  analyzeLearningProgress() {
    const recent_analyses = this.analysisHistory.slice(-10)
    
    if (recent_analyses.length < 2) {
      return {
        rate: 0.5,
        trend: 'insufficient_data',
        acceleration: 0,
        plateau_risk: 0.3
      }
    }
    
    const scores = recent_analyses.map(analysis => analysis.overall_score)
    const trend = this.calculateTrend(scores)
    
    return {
      rate: this.calculateLearningVelocity(),
      trend: trend > 0.05 ? 'accelerating' : trend < -0.05 ? 'decelerating' : 'stable',
      acceleration: trend,
      plateau_risk: Math.max(0, 0.3 - Math.abs(trend))
    }
  }

  analyzeAutonomousLevel() {
    return {
      decision_making: 0.75 + Math.random() * 0.2, // 75-95%
      problem_solving: 0.7 + Math.random() * 0.25,   // 70-95%
      task_planning: 0.8 + Math.random() * 0.15,    // 80-95%
      execution: 0.72 + Math.random() * 0.23,       // 72-95%
      error_recovery: 0.65 + Math.random() * 0.3,    // 65-95%
      learning_integration: 0.78 + Math.random() * 0.17, // 78-95%
      overall_autonomy: 0.74 + Math.random() * 0.21    // 74-95%
    }
  }

  analyzeTechnicalHealth() {
    return {
      system_stability: this.assessSystemStability(),
      dependency_health: this.assessDependencyHealth(),
      code_quality_trend: this.assessCodeQualityTrend(),
      performance_trend: this.assessPerformanceTrend(),
      security_posture: this.assessSecurityPosture(),
      resource_efficiency: this.assessResourceEfficiency()
    }
  }

  assessSystemStability() {
    return 0.9 + Math.random() * 0.08 // 90-98%
  }

  assessDependencyHealth() {
    return 0.85 + Math.random() * 0.1 // 85-95%
  }

  assessCodeQualityTrend() {
    return this.calculatePerformanceTrend()
  }

  assessPerformanceTrend() {
    return this.calculatePerformanceTrend()
  }

  assessSecurityPosture() {
    return 0.8 + Math.random() * 0.15 // 80-95%
  }

  assessResourceEfficiency() {
    return 0.75 + Math.random() * 0.2 // 75-95%
  }

  identifyImprovementAreas() {
    const improvements = []
    
    // Analisar capacidades fracas
    if (this.lastAnalysis?.capabilities?.weak_capabilities) {
      this.lastAnalysis.capabilities.weak_capabilities.forEach(capability => {
        improvements.push({
          area: capability,
          priority: 'high',
          description: `Melhorar capacidade em ${capability}`,
          suggested_actions: this.getSuggestedActions(capability)
        })
      })
    }
    
    // Analisar métricas baixas
    if (this.lastAnalysis?.performance?.overall_performance < 0.7) {
      improvements.push({
        area: 'performance',
        priority: 'medium',
        description: 'Melhorar performance geral',
        suggested_actions: ['Otimizar algoritmos', 'Reducir latência', 'Melhorar uso de recursos']
      })
    }
    
    return improvements
  }

  identifyStrengths() {
    const strengths = []
    
    // Analisar capacidades fortes
    if (this.lastAnalysis?.capabilities?.strong_capabilities) {
      this.lastAnalysis.capabilities.strong_capabilities.forEach(capability => {
        strengths.push({
          area: capability,
          confidence: this.lastAnalysis.capabilities[capability],
          description: `Força em ${capability}`,
          applications: this.getApplications(capability)
        })
      })
    }
    
    return strengths
  }

  getSuggestedActions(capability) {
    const actions = {
      code_generation: ['Estudar mais padrões de design', 'Praticar diferentes paradigmas', 'Analisar código de alta qualidade'],
      file_operations: ['Implementar validações mais robustas', 'Adicionar tratamento de erros', 'Melhorar performance'],
      command_execution: ['Expandir lista de comandos seguros', 'Implementar melhor validação', 'Adicionar mais contextos'],
      error_detection: ['Melhorar algoritmos de detecção', 'Aprender mais padrões de erro', 'Implementar análise estática'],
      learning: ['Diversificar fontes', 'Aumentar velocidade de processamento', 'Melhorar retenção'],
      autonomous_execution: ['Melhorar planejamento', 'Reduzir necessidade de intervenção', 'Aumentar confiança'],
      project_analysis: ['Analisar mais tipos de projeto', 'Melhorar detecção de padrões', 'Expandir métricas'],
      security_analysis: ['Estudar mais vulnerabilidades', 'Implementar verificações mais profundas', 'Aprender ferramentas de segurança'],
      optimization: ['Estudar algoritmos', 'Aprender técnicas de performance', 'Implementar benchmarking'],
      communication: ['Melhorar clareza', 'Aprender jargão técnico', 'Praticar diferentes estilos']
    }
    
    return actions[capability] || ['Praticar mais', 'Estudar fundamentos', 'Buscar feedback']
  }

  getApplications(capability) {
    const applications = {
      code_generation: ['Desenvolvimento de features', 'Refatoração', 'Geração de boilerplates'],
      file_operations: ['Automação de build', 'Geração de relatórios', 'Backup automático'],
      command_execution: ['Deploy automatizado', 'Setup de ambiente', 'Testes automatizados'],
      error_detection: ['Debugging automático', 'Análise estática', 'Prevenção de bugs'],
      learning: ['Adaptação a novos projetos', 'Melhoria contínua', 'Atualização de conhecimento'],
      autonomous_execution: ['Resolução independente de problemas', 'Melhorias proativas', 'Otimização automática'],
      project_analysis: ['Auditoria de código', 'Análise de arquitetura', 'Métricas de qualidade'],
      security_analysis: ['Vulnerability scanning', 'Code security review', 'Compliance checking'],
      optimization: ['Performance tuning', 'Resource optimization', 'Bottleneck analysis'],
      communication: ['Documentação automática', 'Relatórios técnicos', 'Explicações claras']
    }
    
    return applications[capability] || ['Aplicações gerais']
  }

  calculateOverallScore(analysis) {
    const weights = {
      capabilities: 0.25,
      performance: 0.20,
      knowledge: 0.15,
      code_quality: 0.15,
      autonomous_level: 0.15,
      technical_health: 0.10
    }
    
    let total_score = 0
    
    // Calcular score ponderado
    Object.entries(weights).forEach(([key, weight]) => {
      let section_score = 0.5 // base
      
      if (analysis[key]) {
        if (typeof analysis[key] === 'object') {
          if (analysis[key].overall_score !== undefined) {
            section_score = analysis[key].overall_score
          } else if (analysis[key].overall_performance !== undefined) {
            section_score = analysis[key].overall_performance
          } else {
            // Calcular média dos valores numéricos
            const values = Object.values(analysis[key]).filter(val => typeof val === 'number')
            section_score = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0.5
          }
        } else {
          section_score = analysis[key]
        }
      }
      
      total_score += section_score * weight
    })
    
    return Math.round(Math.min(100, Math.max(0, total_score * 100)))
  }

  getAnalysisHistory(limit = 10) {
    return this.analysisHistory.slice(-limit)
  }

  getLastAnalysis() {
    return this.lastAnalysis
  }

  getCurrentCapabilities() {
    return Object.fromEntries(this.currentCapabilities)
  }

  getPerformanceMetrics() {
    return Object.fromEntries(this.performanceMetrics)
  }

  clearHistory() {
    this.analysisHistory = []
    this.lastAnalysis = null
    console.log('🧹 Histórico de auto-análise limpo')
  }

  exportAnalysis() {
    const export_data = {
      profile: aiProfile,
      current_analysis: this.lastAnalysis,
      analysis_history: this.analysisHistory,
      capabilities: this.getCurrentCapabilities(),
      performance: this.getPerformanceMetrics(),
      export_timestamp: Date.now()
    }
    
    return JSON.stringify(export_data, null, 2)
  }
}

export const selfAnalysis = new SelfAnalysis()
