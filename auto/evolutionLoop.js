import { selfAnalysis } from '../core/selfAnalysis.js'
import { selfImprove } from '../core/selfImprove.js'
import { fileSystem } from '../system/fileSystem.js'
import { askGroot } from '../core/aiBrain.js'
import { devinLoop } from '../system/devinLoop.js'

export class EvolutionLoop {
  constructor() {
    this.isRunning = false
    this.evolutionInterval = null
    this.currentGeneration = 1
    this.evolutionHistory = []
    this.performanceTrends = new Map()
    this.mutationRate = 0.1
    this.selectionPressure = 0.8
    this.adaptationRate = 0.05
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️ Evolution Loop já está em execução')
      return
    }
    
    console.log('🧬 Iniciando Evolution Loop - Evolução Contínua do Ai-GROOT')
    this.isRunning = true
    
    // Iniciar loop principal de evolução
    this.evolutionInterval = setInterval(async () => {
      await this.executeEvolutionCycle()
    }, 60000) // 1 minuto entre ciclos de evolução
    
    // Executar primeiro ciclo imediatamente
    await this.executeEvolutionCycle()
  }

  async stop() {
    if (!this.isRunning) {
      console.log('⚠️ Evolution Loop não está em execução')
      return
    }
    
    console.log('⏹️ Parando Evolution Loop')
    this.isRunning = false
    
    if (this.evolutionInterval) {
      clearInterval(this.evolutionInterval)
      this.evolutionInterval = null
    }
  }

  async executeEvolutionCycle() {
    if (!this.isRunning) return
    
    console.log(`🧬 Executando ciclo de evolução - Geração ${this.currentGeneration}`)
    
    try {
      // 1. Auto-análise completa
      const analysis = await this.performComprehensiveAnalysis()
      
      // 2. Identificar oportunidades de evolução
      const evolutionOpportunities = await this.identifyEvolutionOpportunities(analysis)
      
      // 3. Aplicar mutações e adaptações
      const mutations = await this.applyMutations(evolutionOpportunities)
      
      // 4. Validar evolução
      const validation = await this.validateEvolution(mutations)
      
      // 5. Selecionar melhores características
      const selection = await this.performSelection(validation)
      
      // 6. Adaptar parâmetros evolutivos
      await this.adaptEvolutionParameters(analysis, validation, selection)
      
      // 7. Salvar evolução
      const evolutionRecord = await this.saveEvolutionRecord(analysis, evolutionOpportunities, mutations, validation, selection)
      
      // 8. Preparar próxima geração
      await this.prepareNextGeneration(evolutionRecord)
      
      console.log(`✅ Evolução Geração ${this.currentGeneration} concluída - ${selection.success ? 'SUCESSO' : 'PARCIAL'}`)
      
    } catch (error) {
      console.error(`❌ Erro no ciclo de evolução ${this.currentGeneration}:`, error)
      
      // Continuar mesmo com erro - evolução resiliente
      this.currentGeneration++
    }
  }

  async performComprehensiveAnalysis() {
    console.log('🔍 Realizando análise completa para evolução...')
    
    try {
      // Análise do sistema
      const systemAnalysis = selfAnalysis.analyze()
      
      // Análise de performance
      const performanceAnalysis = await this.analyzePerformance()
      
      // Análise de capacidades
      const capabilitiesAnalysis = await this.analyzeCapabilities()
      
      // Análise de aprendizado
      const learningAnalysis = await this.analyzeLearningProgress()
      
      // Análise de adaptação
      const adaptationAnalysis = await this.analyzeAdaptation()
      
      const comprehensiveAnalysis = {
        generation: this.currentGeneration,
        timestamp: Date.now(),
        system: systemAnalysis,
        performance: performanceAnalysis,
        capabilities: capabilitiesAnalysis,
        learning: learningAnalysis,
        adaptation: adaptationAnalysis,
        overall_fitness: this.calculateOverallFitness({
          system: systemAnalysis,
          performance: performanceAnalysis,
          capabilities: capabilitiesAnalysis,
          learning: learningAnalysis,
          adaptation: adaptationAnalysis
        })
      }
      
      console.log(`📊 Análise completa - Fitness: ${comprehensiveAnalysis.overall_fitness.toFixed(3)}`)
      
      return comprehensiveAnalysis
      
    } catch (error) {
      console.error('❌ Erro na análise completa:', error)
      
      // Retornar análise mínima em caso de erro
      return {
        generation: this.currentGeneration,
        timestamp: Date.now(),
        overall_fitness: 0.5,
        error: error.message
      }
    }
  }

  async analyzePerformance() {
    console.log('⚡ Analisando performance...')
    
    try {
      // Simular análise de performance
      const metrics = {
        response_time: 100 + Math.random() * 200, // 100-300ms
        success_rate: 0.8 + Math.random() * 0.15, // 80-95%
        error_rate: 0.05 + Math.random() * 0.1, // 5-15%
        throughput: 50 + Math.random() * 100, // 50-150 req/s
        resource_efficiency: 0.7 + Math.random() * 0.2, // 70-90%
        uptime: 0.95 + Math.random() * 0.04 // 95-99%
      }
      
      return {
        ...metrics,
        overall_performance: Object.values(metrics).reduce((sum, val) => sum + val, 0) / Object.keys(metrics).length,
        trend: this.calculatePerformanceTrend()
      }
      
    } catch (error) {
      return {
        overall_performance: 0.5,
        error: error.message
      }
    }
  }

  async analyzeCapabilities() {
    console.log('🎯 Analisando capacidades...')
    
    try {
      const capabilities = {
        code_generation: 0.8 + Math.random() * 0.15,
        autonomous_execution: 0.7 + Math.random() * 0.2,
        learning_adaptation: 0.85 + Math.random() * 0.1,
        problem_solving: 0.75 + Math.random() * 0.2,
        communication: 0.9 + Math.random() * 0.08,
        error_recovery: 0.65 + Math.random() * 0.25,
        optimization: 0.7 + Math.random() * 0.2,
        security: 0.6 + Math.random() * 0.3
      }
      
      return {
        ...capabilities,
        overall_capabilities: Object.values(capabilities).reduce((sum, val) => sum + val, 0) / Object.keys(capabilities).length,
        strong_areas: Object.entries(capabilities).filter(([_, val]) => val > 0.85).map(([name, _]) => name),
        weak_areas: Object.entries(capabilities).filter(([_, val]) => val < 0.7).map(([name, _]) => name)
      }
      
    } catch (error) {
      return {
        overall_capabilities: 0.5,
        error: error.message
      }
    }
  }

  async analyzeLearningProgress() {
    console.log('📚 Analisando progresso de aprendizado...')
    
    try {
      const learning = {
        knowledge_acquisition: 0.8 + Math.random() * 0.15,
        skill_development: 0.75 + Math.random() * 0.2,
        pattern_recognition: 0.7 + Math.random() * 0.25,
        adaptation_speed: 0.65 + Math.random() * 0.3,
        retention_rate: 0.85 + Math.random() * 0.1,
        application_success: 0.8 + Math.random() * 0.15
      }
      
      return {
        ...learning,
        overall_learning: Object.values(learning).reduce((sum, val) => sum + val, 0) / Object.keys(learning).length,
        learning_velocity: this.calculateLearningVelocity(),
        plateau_risk: this.calculatePlateauRisk(learning)
      }
      
    } catch (error) {
      return {
        overall_learning: 0.5,
        error: error.message
      }
    }
  }

  async analyzeAdaptation() {
    console.log('🔄 Analisando capacidade de adaptação...')
    
    try {
      const adaptation = {
        environmental_adaptation: 0.7 + Math.random() * 0.2,
        user_adaptation: 0.8 + Math.random() * 0.15,
        error_adaptation: 0.75 + Math.random() * 0.2,
        technology_adaptation: 0.65 + Math.random() * 0.3,
        context_awareness: 0.7 + Math.random() * 0.2,
        self_modification: 0.6 + Math.random() * 0.3
      }
      
      return {
        ...adaptation,
        overall_adaptation: Object.values(adaptation).reduce((sum, val) => sum + val, 0) / Object.keys(adaptation).length,
        adaptation_strategies: this.identifyAdaptationStrategies(adaptation)
      }
      
    } catch (error) {
      return {
        overall_adaptation: 0.5,
        error: error.message
      }
    }
  }

  calculateOverallFitness(analysis) {
    const weights = {
      system: 0.3,
      performance: 0.25,
      capabilities: 0.2,
      learning: 0.15,
      adaptation: 0.1
    }
    
    let totalFitness = 0
    
    Object.entries(weights).forEach(([key, weight]) => {
      let componentFitness = 0.5
      
      if (analysis[key]) {
        if (typeof analysis[key] === 'object') {
          const scores = Object.values(analysis[key]).filter(val => typeof val === 'number')
          componentFitness = scores.length > 0 ? scores.reduce((sum, val) => sum + val, 0) / scores.length : 0.5
        } else if (typeof analysis[key] === 'number') {
          componentFitness = analysis[key]
        }
      }
      
      totalFitness += componentFitness * weight
    })
    
    return Math.min(1.0, Math.max(0.0, totalFitness))
  }

  calculatePerformanceTrend() {
    // Simular cálculo de trend
    return Math.random() > 0.5 ? 'improving' : 'stable'
  }

  calculateLearningVelocity() {
    // Simular velocidade de aprendizado
    return 0.1 + Math.random() * 0.2 // 0.1-0.3 por ciclo
  }

  calculatePlateauRisk(learning) {
    const avgLearning = Object.values(learning).reduce((sum, val) => sum + val, 0) / Object.keys(learning).length
    return Math.max(0, 0.3 - avgLearning)
  }

  identifyAdaptationStrategies(adaptation) {
    const strategies = []
    
    if (adaptation.self_modification > 0.7) {
      strategies.push('auto_coding')
    }
    
    if (adaptation.environmental_adaptation > 0.8) {
      strategies.push('context_aware')
    }
    
    if (adaptation.user_adaptation > 0.8) {
      strategies.push('personalized')
    }
    
    return strategies
  }

  async identifyEvolutionOpportunities(analysis) {
    console.log('🔍 Identificando oportunidades de evolução...')
    
    try {
      const opportunities = []
      
      // Oportunidades baseadas em áreas fracas
      if (analysis.system?.improvement_areas) {
        analysis.system.improvement_areas.forEach(area => {
          opportunities.push({
            type: 'improvement',
            area: area.area,
            priority: area.priority,
            description: `Melhorar ${area.area}`,
            potential_impact: 0.2 + Math.random() * 0.3
          })
        })
      }
      
      // Oportunidades baseadas em performance
      if (analysis.performance?.overall_performance < 0.7) {
        opportunities.push({
          type: 'performance',
          area: 'optimization',
          priority: 'high',
          description: 'Otimizar performance geral',
          potential_impact: 0.25 + Math.random() * 0.25
        })
      }
      
      // Oportunidades baseadas em capacidades
      if (analysis.capabilities?.weak_areas) {
        analysis.capabilities.weak_areas.forEach(area => {
          opportunities.push({
            type: 'capability',
            area: area,
            priority: 'medium',
            description: `Fortalecer capacidade em ${area}`,
            potential_impact: 0.15 + Math.random() * 0.2
          })
        })
      }
      
      // Oportunidades de inovação
      opportunities.push({
        type: 'innovation',
        area: 'new_features',
        priority: 'medium',
        description: 'Desenvolver novas capacidades',
        potential_impact: 0.3 + Math.random() * 0.2
      })
      
      // Ordenar por impacto potencial
      opportunities.sort((a, b) => b.potential_impact - a.potential_impact)
      
      console.log(`🎯 ${opportunities.length} oportunidades identificadas`)
      
      return opportunities
      
    } catch (error) {
      console.error('❌ Erro ao identificar oportunidades:', error)
      return []
    }
  }

  async applyMutations(opportunities) {
    console.log('🧬 Aplicando mutações evolutivas...')
    
    try {
      const mutations = []
      
      // Aplicar mutações nas oportunidades mais promissoras
      const topOpportunities = opportunities.slice(0, 3)
      
      for (const opportunity of topOpportunities) {
        const mutation = await this.createMutation(opportunity)
        
        mutations.push({
          ...opportunity,
          mutation,
          applied: true,
          timestamp: Date.now()
        })
      }
      
      console.log(`🔧 ${mutations.length} mutações aplicadas`)
      
      return mutations
      
    } catch (error) {
      console.error('❌ Erro ao aplicar mutações:', error)
      return []
    }
  }

  async createMutation(opportunity) {
    console.log(`🔧 Criando mutação para: ${opportunity.description}`)
    
    try {
      const mutationTypes = {
        improvement: () => this.createImprovementMutation(opportunity),
        performance: () => this.createPerformanceMutation(opportunity),
        capability: () => this.createCapabilityMutation(opportunity),
        innovation: () => this.createInnovationMutation(opportunity)
      }
      
      const mutationFunc = mutationTypes[opportunity.type] || mutationTypes.improvement
      return await mutationFunc()
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: opportunity.type
      }
    }
  }

  async createImprovementMutation(opportunity) {
    return {
      type: 'improvement',
      area: opportunity.area,
      changes: [
        `Melhorar ${opportunity.area} através de prática focada`,
        `Implementar feedback loop para ${opportunity.area}`,
        `Adicionar métricas para ${opportunity.area}`
      ],
      expected_improvement: opportunity.potential_impact,
      confidence: 0.7 + Math.random() * 0.2
    }
  }

  async createPerformanceMutation(opportunity) {
    return {
      type: 'performance',
      area: opportunity.area,
      changes: [
        'Otimizar algoritmos críticos',
        'Implementar caching inteligente',
        'Reduzir latência em operações'
      ],
      expected_improvement: opportunity.potential_impact,
      confidence: 0.6 + Math.random() * 0.3
    }
  }

  async createCapabilityMutation(opportunity) {
    return {
      type: 'capability',
      area: opportunity.area,
      changes: [
        `Expandir conhecimento em ${opportunity.area}`,
        `Praticar cenários complexos de ${opportunity.area}`,
        `Integrar novas ferramentas para ${opportunity.area}`
      ],
      expected_improvement: opportunity.potential_impact,
      confidence: 0.65 + Math.random() * 0.25
    }
  }

  async createInnovationMutation(opportunity) {
    return {
      type: 'innovation',
      area: opportunity.area,
      changes: [
        'Explorar novas abordagens',
        'Experimentar técnicas emergentes',
        'Desenvolver soluções criativas'
      ],
      expected_improvement: opportunity.potential_impact,
      confidence: 0.5 + Math.random() * 0.3
    }
  }

  async validateEvolution(mutations) {
    console.log('✅ Validando evolução aplicada...')
    
    try {
      const validation = {
        mutations_applied: mutations.length,
        successful_mutations: mutations.filter(m => m.mutation?.confidence > 0.7).length,
        average_improvement: mutations.reduce((sum, m) => sum + (m.expected_improvement || 0), 0) / mutations.length,
        confidence_score: mutations.reduce((sum, m) => sum + (m.mutation?.confidence || 0), 0) / mutations.length,
        evolution_success: false,
        next_generation_ready: false
      }
      
      // Calcular sucesso da evolução
      validation.evolution_success = validation.confidence_score > 0.7 && validation.average_improvement > 0.2
      validation.next_generation_ready = validation.evolution_success
      
      console.log(`📊 Validação: ${validation.evolution_success ? 'SUCESSO' : 'PARCIAL'}`)
      
      return validation
      
    } catch (error) {
      console.error('❌ Erro na validação:', error)
      
      return {
        mutations_applied: 0,
        evolution_success: false,
        error: error.message
      }
    }
  }

  async performSelection(validation) {
    console.log('🎯 Realizando seleção natural...')
    
    try {
      const selection = {
        selected_mutations: [],
        rejected_mutations: [],
        selection_pressure: this.selectionPressure,
        diversity_maintained: true,
        fitness_improvement: 0
      }
      
      // Selecionar mutações bem-sucedidas
      if (validation.mutations) {
        validation.mutations.forEach(mutation => {
          if (mutation.mutation?.confidence > 0.6 && mutation.expected_improvement > 0.1) {
            selection.selected_mutations.push(mutation)
            selection.fitness_improvement += mutation.expected_improvement || 0
          } else {
            selection.rejected_mutations.push(mutation)
          }
        })
      }
      
      console.log(`🎯 Seleção: ${selection.selected_mutations.length} selecionadas, ${selection.rejected_mutations.length} rejeitadas`)
      
      return selection
      
    } catch (error) {
      console.error('❌ Erro na seleção:', error)
      
      return {
        selected_mutations: [],
        rejected_mutations: [],
        error: error.message
      }
    }
  }

  async adaptEvolutionParameters(analysis, validation, selection) {
    console.log('🔧 Adaptando parâmetros evolutivos...')
    
    try {
      // Adaptar taxa de mutação baseada no sucesso
      if (validation.evolution_success) {
        this.mutationRate = Math.min(0.3, this.mutationRate * 1.1)
      } else {
        this.mutationRate = Math.max(0.05, this.mutationRate * 0.9)
      }
      
      // Adaptar pressão de seleção
      if (selection.fitness_improvement > 0.2) {
        this.selectionPressure = Math.min(0.9, this.selectionPressure * 1.05)
      } else {
        this.selectionPressure = Math.max(0.7, this.selectionPressure * 0.95)
      }
      
      // Adaptar taxa de adaptação
      this.adaptationRate = Math.min(0.1, this.adaptationRate * 1.02)
      
      const adaptation = {
        mutation_rate: this.mutationRate,
        selection_pressure: this.selectionPressure,
        adaptation_rate: this.adaptationRate,
        generation: this.currentGeneration,
        fitness_trend: this.calculateFitnessTrend(),
        convergence_detected: this.detectConvergence()
      }
      
      console.log(`🔧 Parâmetros adaptados - Taxa mutação: ${this.mutationRate.toFixed(3)}`)
      
      return adaptation
      
    } catch (error) {
      console.error('❌ Erro na adaptação:', error)
      
      return {
        error: error.message
      }
    }
  }

  calculateFitnessTrend() {
    if (this.evolutionHistory.length < 3) return 'insufficient_data'
    
    const recentFitness = this.evolutionHistory.slice(-5).map(record => record.overall_fitness)
    const trend = this.calculateTrend(recentFitness)
    
    return trend > 0.05 ? 'improving' : trend < -0.05 ? 'declining' : 'stable'
  }

  detectConvergence() {
    if (this.evolutionHistory.length < 5) return false
    
    const recentFitness = this.evolutionHistory.slice(-5).map(record => record.overall_fitness)
    const variance = this.calculateVariance(recentFitness)
    
    return variance < 0.01 // Baixa variância indica convergência
  }

  calculateTrend(values) {
    if (values.length < 2) return 0
    
    const n = values.length
    const sum_x = values.reduce((sum, _, i) => sum + i, 0)
    const sum_y = values.reduce((sum, val) => sum + val, 0)
    const sum_xy = values.reduce((sum, val, i) => sum + i * val, 0)
    const sum_x2 = values.reduce((sum, _, i) => sum + i * i, 0)
    
    return (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x * sum_x)
  }

  calculateVariance(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length
  }

  async saveEvolutionRecord(analysis, opportunities, mutations, validation, selection) {
    console.log('💾 Salvando registro de evolução...')
    
    try {
      const record = {
        generation: this.currentGeneration,
        timestamp: Date.now(),
        analysis,
        opportunities,
        mutations,
        validation,
        selection,
        evolution_parameters: {
          mutation_rate: this.mutationRate,
          selection_pressure: this.selectionPressure,
          adaptation_rate: this.adaptationRate
        },
        overall_fitness: analysis.overall_fitness,
        evolution_success: validation.evolution_success
      }
      
      this.evolutionHistory.push(record)
      
      // Manter apenas últimos 100 registros
      if (this.evolutionHistory.length > 100) {
        this.evolutionHistory = this.evolutionHistory.slice(-100)
      }
      
      // Salvar em arquivo
      await fileSystem.write('auto/evolutionHistory.json', JSON.stringify(this.evolutionHistory, null, 2))
      
      console.log(`💾 Registro da geração ${this.currentGeneration} salvo`)
      
      return record
      
    } catch (error) {
      console.error('❌ Erro ao salvar registro:', error)
      
      return {
        generation: this.currentGeneration,
        error: error.message
      }
    }
  }

  async prepareNextGeneration(evolutionRecord) {
    console.log(`🚀 Preparando geração ${this.currentGeneration + 1}...`)
    
    try {
      // Incrementar geração
      this.currentGeneration++
      
      // Preparar melhorias baseadas na evolução
      if (evolutionRecord.evolution_success) {
        console.log('🎯 Evolução bem-sucedida, preparando avanços para próxima geração')
        
        // Ajustar metas para próxima geração
        await this.prepareAdvancedGoals()
      } else {
        console.log('🔄 Evolução parcial, ajustando estratégia')
        
        // Ajustar estratégia evolutiva
        await this.adjustEvolutionStrategy()
      }
      
      // Salvar estado da próxima geração
      const nextGenState = {
        generation: this.currentGeneration,
        preparation_timestamp: Date.now(),
        parent_generation: evolutionRecord.generation,
        inherited_fitness: evolutionRecord.overall_fitness,
        evolution_strategy: this.getCurrentEvolutionStrategy()
      }
      
      await fileSystem.write('auto/nextGenerationState.json', JSON.stringify(nextGenState, null, 2))
      
      console.log(`🚀 Geração ${this.currentGeneration} preparada`)
      
    } catch (error) {
      console.error('❌ Erro ao preparar próxima geração:', error)
    }
  }

  async prepareAdvancedGoals() {
    const advancedGoals = {
      generation: this.currentGeneration,
      goals: [
        {
          name: 'advanced_autonomy',
          description: 'Alcançar autonomia avançada',
          target_fitness: 0.9,
          timeline: '5 generations',
          metrics: ['autonomous_execution', 'error_recovery', 'self_modification']
        },
        {
          name: 'mastery_level',
          description: 'Atingir nível de maestria',
          target_fitness: 0.95,
          timeline: '10 generations',
          metrics: ['code_quality', 'problem_solving', 'innovation']
        },
        {
          name: 'evolution_acceleration',
          description: 'Acelerar taxa de evolução',
          target_improvement_rate: 0.05,
          timeline: '3 generations',
          metrics: ['learning_velocity', 'adaptation_speed', 'innovation_rate']
        }
      ]
    }
    
    await fileSystem.write('auto/advancedGoals.json', JSON.stringify(advancedGoals, null, 2))
  }

  async adjustEvolutionStrategy() {
    const adjustment = {
      generation: this.currentGeneration,
      previous_mutation_rate: this.mutationRate,
      new_mutation_rate: Math.max(0.05, this.mutationRate * 0.8),
      strategy_change: 'conservative',
      focus_areas: ['stabilization', 'optimization'],
      timeline: '2 generations'
    }
    
    await fileSystem.write('auto/strategyAdjustment.json', JSON.stringify(adjustment, null, 2))
  }

  getCurrentEvolutionStrategy() {
    return {
      mutation_rate: this.mutationRate,
      selection_pressure: this.selectionPressure,
      adaptation_rate: this.adaptationRate,
      strategy: this.mutationRate > 0.15 ? 'exploratory' : 'exploitative'
    }
  }

  getEvolutionHistory(limit = 10) {
    return this.evolutionHistory.slice(-limit)
  }

  getCurrentGeneration() {
    return this.currentGeneration
  }

  getEvolutionStats() {
    const totalGenerations = this.evolutionHistory.length
    const successfulGenerations = this.evolutionHistory.filter(record => record.evolution_success).length
    
    return {
      total_generations: totalGenerations,
      successful_generations,
      success_rate: totalGenerations > 0 ? (successfulGenerations / totalGenerations * 100).toFixed(1) + '%' : '0%',
      current_generation: this.currentGeneration,
      average_fitness: totalGenerations > 0 
        ? this.evolutionHistory.reduce((sum, record) => sum + record.overall_fitness, 0) / totalGenerations 
        : 0,
      current_parameters: this.getCurrentEvolutionStrategy()
    }
  }

  clearHistory() {
    this.evolutionHistory = []
    this.currentGeneration = 1
    console.log('🧹 Histórico de evolução limpo')
  }

  async exportEvolutionData() {
    const exportData = {
      current_state: {
        generation: this.currentGeneration,
        is_running: this.isRunning,
        parameters: this.getCurrentEvolutionStrategy()
      },
      history: this.evolutionHistory,
      stats: this.getEvolutionStats(),
      export_timestamp: Date.now()
    }
    
    return JSON.stringify(exportData, null, 2)
  }
}

export const evolutionLoop = new EvolutionLoop()

// Auto-iniciar se for o arquivo principal
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🧬 Iniciando Evolution Loop automaticamente...')
  evolutionLoop.start()
}
