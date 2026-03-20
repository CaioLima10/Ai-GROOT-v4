import { askMultiAI } from '../core/multiAI.js'
import { grootMemoryConnector } from '../core/grootMemoryConnector.js'
import { grootRAG } from '../core/grootRAG.js'
import { grootAdvancedRAG } from '../core/grootAdvancedRAG.js'
import { grootAnalytics } from '../core/grootAnalytics.js'
import { buildLearningSignals, mergePreferences } from '../core/learningEngine.js'

export class ReasoningAgent {
  constructor() {
    this.name = 'reasoningAgent'
    this.capabilities = [
      'analyze_intent',
      'logical_reasoning',
      'decision_making',
      'problem_decomposition',
      'solution_validation',
      'meta_reasoning',
      'style_adaptation',
      'personality_learning'
    ]

    this.reasoningHistory = []
    this.decisionTree = new Map()
    this.patterns = new Map()
    // SISTEMA DE APRENDIZADO DE ESTILO
    this.userStyleProfile = new Map() // userId -> style preferences
    this.conversationPatterns = []
  }

  async run(task, analysis, context = {}) {
    console.log(`🧠 ReasoningAgent: Analisando tarefa: ${task}`)

    try {
      const reasoningType = this.identifyReasoningType(task, analysis)

      switch (reasoningType) {
        case 'analyze':
          return await this.analyzeTask(task, analysis, context)
        case 'decompose':
          return await this.decomposeProblem(task, analysis, context)
        case 'validate':
          return await this.validateSolution(task, analysis, context)
        case 'combine':
          return await this.combineResults(task, analysis, context)
        default:
          return await this.generalReasoning(task, analysis, context)
      }

    } catch (error) {
      console.error(`❌ ReasoningAgent: Erro no raciocínio:`, error)
      return {
        success: false,
        error: error.message,
        suggestion: 'Forneça mais contexto ou simplifique a tarefa'
      }
    }
  }

  identifyReasoningType(task, analysis) {
    const lowerTask = task.toLowerCase()

    if (lowerTask.includes('analyze') || lowerTask.includes('analisar')) {
      return 'analyze'
    }

    if (lowerTask.includes('decompose') || lowerTask.includes('dividir') || lowerTask.includes('quebrar')) {
      return 'decompose'
    }

    if (lowerTask.includes('validate') || lowerTask.includes('validar')) {
      return 'validate'
    }

    if (lowerTask.includes('combine') || lowerTask.includes('combinar')) {
      return 'combine'
    }

    return 'general'
  }

  async analyzeTask(task, analysis, context) {
    console.log(`🔍 Analisando tarefa: ${task}`)

    const analysisResult = {
      intent: this.analyzeIntent(task),
      complexity: this.assessComplexity(task, context),
      requirements: this.extractRequirements(task),
      constraints: this.identifyConstraints(context),
      dependencies: this.identifyDependencies(task, context),
      feasibility: this.assessFeasibility(task, context),
      approach: this.recommendApproach(task, analysis)
    }

    const reasoning = {
      success: true,
      type: 'task_analysis',
      task,
      analysis: analysisResult,
      reasoning: this.explainReasoning(analysisResult),
      confidence: this.calculateAnalysisConfidence(analysisResult),
      nextSteps: this.generateNextSteps(analysisResult),
      metadata: {
        analysisTime: Date.now(),
        complexity: analysisResult.complexity.level,
        feasibility: analysisResult.feasibility.score
      }
    }

    // Salvar no histórico
    this.saveReasoning(reasoning)

    console.log(`✅ Análise concluída: ${analysisResult.intent.type}`)
    return reasoning
  }

  async decomposeProblem(task, analysis, context) {
    console.log(`🔧 Decompondo problema: ${task}`)

    const decomposition = {
      mainProblem: task,
      subProblems: this.breakIntoSubProblems(task),
      dependencies: this.mapDependencies(task),
      sequence: this.createExecutionSequence(task),
      parallelTasks: this.identifyParallelTasks(task),
      criticalPath: this.identifyCriticalPath(task)
    }

    const reasoning = {
      success: true,
      type: 'problem_decomposition',
      decomposition,
      reasoning: this.explainDecomposition(decomposition),
      confidence: this.calculateDecompositionConfidence(decomposition),
      estimatedTime: this.estimateExecutionTime(decomposition),
      resources: this.identifyRequiredResources(decomposition),
      metadata: {
        decompositionTime: Date.now(),
        subProblemsCount: decomposition.subProblems.length,
        parallelTasksCount: decomposition.parallelTasks.length
      }
    }

    this.saveReasoning(reasoning)

    console.log(`✅ Problema decomposto: ${decomposition.subProblems.length} sub-problemas`)
    return reasoning
  }

  async validateSolution(solution, analysis, context) {
    console.log(`✅ Validando solução`)

    const validation = {
      correctness: this.validateCorrectness(solution, context),
      completeness: this.validateCompleteness(solution, context),
      efficiency: this.validateEfficiency(solution, context),
      maintainability: this.validateMaintainability(solution),
      security: this.validateSecurity(solution),
      scalability: this.validateScalability(solution, context)
    }

    const overallScore = this.calculateOverallValidationScore(validation)

    const reasoning = {
      success: true,
      type: 'solution_validation',
      solution,
      validation,
      overallScore,
      passed: overallScore >= 0.7,
      issues: this.identifyValidationIssues(validation),
      improvements: this.suggestImprovements(validation),
      recommendation: this.generateValidationRecommendation(validation, overallScore),
      metadata: {
        validationTime: Date.now(),
        score: overallScore,
        passed: overallScore >= 0.7
      }
    }

    this.saveReasoning(reasoning)

    console.log(`✅ Validação concluída: ${overallScore >= 0.7 ? 'APROVADO' : 'REPROVADO'}`)
    return reasoning
  }

  async combineResults(results, analysis) {
    console.log(`🔄 Combinando ${results.length} resultados`)

    const combination = {
      results,
      synthesis: this.synthesizeResults(results),
      conflicts: this.identifyConflicts(results),
      synergies: this.identifySynergies(results),
      bestPractices: this.extractBestPracticesFromResults(results),
      finalRecommendation: this.generateFinalRecommendation(results)
    }

    const reasoning = {
      success: true,
      type: 'result_combination',
      combination,
      reasoning: this.explainCombination(combination),
      confidence: this.calculateCombinationConfidence(combination),
      actionPlan: this.createActionPlan(combination),
      metadata: {
        combinationTime: Date.now(),
        resultsCount: results.length,
        conflictsCount: combination.conflicts.length
      }
    }

    this.saveReasoning(reasoning)

    console.log(`✅ Resultados combinados com sucesso`)
    return reasoning
  }

  // 🧠 MÉTODO DA CLASSE - DETECTOR DE ESTILO COM APRENDIZADO
  detectUserStyle(message, userId = 'default') {
    const msg = message.toLowerCase()

    // 📚 VERIFICAR PERFIL EXISTENTE
    const userProfile = this.userStyleProfile.get(userId)
    const previousPatterns = userProfile?.patterns || []

    // 🔍 DETECTAR PADRÕES ATUAIS
    const currentPatterns = []

    // Estilo casual/informal
    if (msg.match(/oi|fala|e ai|mano|bro|galera|vlw|top|legal|show|bom|dia/i)) {
      currentPatterns.push('casual')
    }

    // Estilo urgente/direto
    if (msg.match(/rapid|urgente|junto|rápido|depressa|help|socorro|me ajuda/i)) {
      currentPatterns.push('urgent')
    }

    // Estilo técnico/detalhado
    if (msg.length > 150 || msg.match(/detalhadamente|explique|completo|profundo|teoria/i)) {
      currentPatterns.push('detailed')
    }

    // Estilo iniciante
    if (msg.match(/o que é|como funciona|para que serve|básico|iniciante/i)) {
      currentPatterns.push('beginner')
    }

    // 🧠 APRENDER COM O HISTÓRICO
    if (currentPatterns.length > 0) {
      // Adicionar ao perfil do usuário
      if (!this.userStyleProfile.has(userId)) {
        this.userStyleProfile.set(userId, { patterns: [], dominantStyle: 'natural' })
      }

      const profile = this.userStyleProfile.get(userId)
      profile.patterns.push(...currentPatterns)

      // Calcular estilo dominante
      const patternCounts = {}
      profile.patterns.forEach(p => {
        patternCounts[p] = (patternCounts[p] || 0) + 1
      })

      profile.dominantStyle = Object.entries(patternCounts)
        .sort(([, a], [, b]) => b - a)[0][0]
    }

    // 🎭 RETORNAR ESTILO DOMINANTE OU ATUAL
    return userProfile?.dominantStyle || currentPatterns[0] || 'natural'
  }

  async generalReasoning(task, analysis, context) {
    console.log(`🎯 Raciocínio geral para: ${task}`)

    // 🧠 BUSCAR CONTEXTO DA MEMÓRIA
    const userId = context.userId || 'default_user'
    const memoryContext = await grootMemoryConnector.getContextForPrompt(userId)
    console.log('📚 Contexto da memória:', memoryContext.contextSummary)

    // 🎯 ENRIQUECER COM RAG AVANÇADO
    const ragContext = await grootAdvancedRAG.enrichQueryAdvanced(task)
    console.log('🎯 Contexto RAG Avançado:', ragContext.totalFound, 'itens encontrados')

    // 🚀 USAR LLM REAL DIRETO
    const { askMultiAI } = await import('../core/multiAI.js')

    const userStyle = this.detectUserStyle(task, userId)

    const safetyNote = context?.safety?.category === 'mental_health'
      ? 'Se o usuário demonstrar tristeza, ansiedade ou sofrimento, responda com empatia, encoraje buscar ajuda profissional e ofereça apoio. Não dê conselhos médicos específicos.'
      : ''

    const ageGuidance = context?.ageGroup === 'minor'
      ? 'O usuário é menor de idade. Evite conteúdo adulto, linguagem imprópria e instruções perigosas. Foque em respostas educativas e seguras.'
      : ''

    const profilePreferences = memoryContext.userProfile || {}
    const preferenceNotes = []

    if (profilePreferences.verbosity === 'short') {
      preferenceNotes.push('Responda de forma curta e objetiva.')
    }

    if (profilePreferences.verbosity === 'detailed') {
      preferenceNotes.push('Responda com mais detalhes e explicações.')
    }

    if (profilePreferences.examples) {
      preferenceNotes.push('Inclua exemplos práticos e código quando fizer sentido.')
    }

    if (profilePreferences.noEmojis) {
      preferenceNotes.push('Não use emojis.')
    }

    if (profilePreferences.safetyLevel === 'strict') {
      preferenceNotes.push('Seja mais cauteloso em temas sensíveis.')
    }

    const preferenceGuidance = preferenceNotes.length > 0
      ? `Preferências do usuário: ${preferenceNotes.join(' ')}`
      : ''

    // 🎭 INSTRUÇÕES DE TOM BASEADO NO ESTILO
    const toneInstructions = {
      casual: "Responda de forma informal e amigável, use gírias leves, seja descontraído. Use emojis se apropriado. 😄",
      urgent: "Vá direto ao ponto, sem enrolação. Seja objetivo e prático. Use linguagem clara e direta.",
      detailed: "Responda de forma completa e explicativa, mas sem perder naturalidade. Pode aprofundar mais nos conceitos.",
      beginner: "Explique de forma simples e didática, como se estivesse ensinando alguém que nunca ouviu falar do assunto. Use analogias.",
      natural: "Responda de forma natural e fluida, como uma conversa normal. Seja você mesmo."
    }

    // 🚀 PROMPT HUMANO INTELIGENTE COM MEMÓRIA + RAG
    const prompt = `Você é GROOT, uma inteligência artificial avançada com personalidade única.

Seu objetivo é conversar de forma NATURAL e adaptável, como um humano inteligente.

${toneInstructions[userStyle]}

🧠 MEMÓRIA DA CONVERSA:
${memoryContext.history.map(h => `Usuário: ${h.user}\nGROOT: ${h.ai}`).join('\n\n')}

📊 PERFIL DO USUÁRIO:
- Estilo preferido: ${memoryContext.userProfile?.style || 'natural'}
- Contexto: ${memoryContext.contextSummary}
- Tópicos recorrentes: ${(memoryContext.userProfile?.topics || []).join(', ') || 'nenhum ainda'}

🎯 CONHECIMENTO RELEVANTE (RAG AVANÇADO):
${ragContext.enriched ? ragContext.context : 'Nenhum conhecimento específico encontrado.'}

${ragContext.bugs.length > 0 ? '\n🐛 Bugs e Soluções Relacionados:\n' + ragContext.bugs.map(b => `• ${b.error_message}: ${b.solution}`).join('\n') : ''}

REGRAS IMPORTANTES:
- Fale de forma fluida e natural, como ChatGPT
- NÃO use estruturas fixas como "Análise", "Solução", "Melhores práticas" 
- Responda DIRETO à pergunta sem ser robótico
- Adapte seu tom ao estilo do usuário
- Seja autêntico e genuíno
- Use exemplos práticos e linguagem humana
- CONSIDERE O HISTÓRICO E O CONHECIMENTO ACIMA
- APRENDA COM ESSA INTERAÇÃO
- Se houver risco de autoagressão ou violência, responda com cuidado e incentive ajuda profissional
- Em segurança cibernética, seja defensivo e educativo. Não forneça instruções ofensivas.
${safetyNote ? `- Nota de cuidado: ${safetyNote}` : ''}
${ageGuidance ? `- Aviso de idade: ${ageGuidance}` : ''}
${preferenceGuidance ? `- ${preferenceGuidance}` : ''}

Tarefa atual do usuário: ${task}

Responda como se estivesse tendo uma conversa real, com memória do que já conversaram e conhecimento relevante.`

    try {
      const llmResponse = await askMultiAI(prompt)

      const reasoning = {
        success: true,
        type: 'llm_reasoning',
        response: llmResponse,
        confidence: 0.9,
        metadata: {
          reasoningTime: Date.now(),
          method: 'direct_llm',
          provider: 'multi_ai_fallback',
          userStyle: userStyle,
          toneInstruction: toneInstructions[userStyle],
          personality: 'adaptive_human',
          memoryContext: memoryContext.contextSummary
        }
      }

      const learningSignals = buildLearningSignals({
        userMessage: task,
        aiResponse: llmResponse,
        userStyle
      })

      if (!learningSignals.skip) {
        const existingProfile = memoryContext.userProfile || {}
        const existingTopics = Array.isArray(existingProfile.topics) ? existingProfile.topics : []
        const mergedTopics = Array.from(new Set([...existingTopics, ...learningSignals.topics])).slice(0, 12)

        const mergedProfile = mergePreferences(existingProfile, {
          ...learningSignals.preferences,
          style: learningSignals.style,
          topics: mergedTopics
        })

        await grootMemoryConnector.updateUserProfile(userId, mergedProfile)

        if (learningSignals.topics.length > 0) {
          await grootMemoryConnector.saveLearningPattern(
            userId,
            'topic',
            { topics: learningSignals.topics, source: 'conversation' },
            learningSignals.confidence
          )
        }

        if (Object.keys(learningSignals.preferences).length > 0) {
          await grootMemoryConnector.saveLearningPattern(
            userId,
            'preference',
            learningSignals.preferences,
            learningSignals.confidence
          )
        }

        await grootMemoryConnector.saveLearningPattern(
          userId,
          'style',
          { style: learningSignals.style },
          learningSignals.confidence
        )
      }

      // 🧠 SALVAR INTERAÇÃO NA MEMÓRIA
      await grootMemoryConnector.saveConversation(userId, task, llmResponse, {
        userStyle: userStyle,
        confidence: 0.9,
        provider: 'multi_ai_fallback',
        sessionId: `session_${Date.now()}`
      })

      // 🎯 APRENDER COM RAG AVANÇADO
      await grootAdvancedRAG.learnFromInteractionAdvanced(task, llmResponse, {
        userStyle: userStyle,
        confidence: 0.9,
        provider: 'multi_ai_fallback'
      })

      // 📊 REGISTRAR ANALYTICS
      await grootAnalytics.trackUsage(userId, task, llmResponse, {
        responseTime: Date.now() - Date.now(),
        tokensUsed: llmResponse.length,
        provider: 'multi_ai_fallback',
        userStyle: userStyle,
        confidence: 0.9,
        success: true,
        knowledgeFound: ragContext.knowledge.length,
        bugsFound: ragContext.bugs.length
      })

      this.saveReasoning(reasoning)
      console.log(`✅ Raciocínio LLM concluído e salvo na memória`)
      return reasoning

    } catch (error) {
      console.error('❌ Erro no LLM, usando análise estrutural:', error.message)

      // Fallback para análise estrutural
      const taskAnalysis = await this.analyzeTask(task, analysis, context)
      const problemDecomposition = await this.decomposeProblem(task, analysis, context)

      const integratedReasoning = {
        primaryIntent: taskAnalysis.analysis.intent,
        complexity: taskAnalysis.analysis.complexity,
        approach: taskAnalysis.analysis.approach,
        executionPlan: problemDecomposition.decomposition.sequence,
        riskAssessment: this.assessRisks(taskAnalysis, problemDecomposition),
        successCriteria: this.defineSuccessCriteria(task, context),
        monitoringPlan: this.createMonitoringPlan(taskAnalysis, problemDecomposition)
      }

      const reasoning = {
        success: true,
        type: 'integrated_reasoning',
        integratedReasoning,
        reasoning: await this.explainIntegratedReasoning(integratedReasoning),
        confidence: this.calculateIntegratedConfidence(integratedReasoning),
        recommendations: this.generateIntegratedRecommendations(integratedReasoning),
        metadata: {
          reasoningTime: Date.now(),
          strategiesApplied: ['analysis', 'decomposition'],
          integrationLevel: 'high',
          fallback: true
        }
      }

      this.saveReasoning(reasoning)
      console.log(`✅ Raciocínio estrutural concluído (fallback)`)
      return reasoning
    }
  }

  // Métodos de análise
  analyzeIntent(task) {
    const lowerTask = task.toLowerCase()

    const intents = {
      'code_generation': {
        keywords: ['criar', 'gerar', 'escrever', 'desenvolver', 'implementar'],
        confidence: 0
      },
      'problem_solving': {
        keywords: ['resolver', 'consertar', 'corrigir', 'debugar', 'arrumar'],
        confidence: 0
      },
      'learning': {
        keywords: ['aprender', 'entender', 'explicar', 'ensinar', 'mostrar'],
        confidence: 0
      },
      'analysis': {
        keywords: ['analisar', 'examinar', 'verificar', 'avaliar', 'revisar'],
        confidence: 0
      },
      'optimization': {
        keywords: ['otimizar', 'melhorar', 'refatorar', 'ajustar'],
        confidence: 0
      }
    }

    // Calcular confiança para cada intent
    Object.entries(intents).forEach(([intent, data]) => {
      const matches = data.keywords.filter(keyword => lowerTask.includes(keyword))
      data.confidence = matches.length / data.keywords.length
    })

    // Retornar intent com maior confiança
    const bestIntent = Object.entries(intents)
      .sort(([, a], [, b]) => b.confidence - a.confidence)[0]

    return {
      type: bestIntent[0],
      confidence: bestIntent[1].confidence,
      matchedKeywords: bestIntent[1].keywords.filter(k => lowerTask.includes(k))
    }
  }

  assessComplexity(task, context) {
    let complexity = 1

    // Fatores de complexidade
    const complexityFactors = {
      length: task.length > 100 ? 2 : task.length > 50 ? 1.5 : 1,
      technicalTerms: (task.match(/\b(api|database|algorithm|architecture|framework)\b/gi) || []).length * 0.5,
      multipleSteps: (task.match(/\b(e|depois|então|após)\b/gi) || []).length * 0.3,
      contextComplexity: context.projectSize === 'large' ? 1.5 : context.projectSize === 'medium' ? 1.2 : 1
    }

    Object.values(complexityFactors).forEach(factor => {
      complexity *= factor
    })

    const level = complexity > 3 ? 'high' : complexity > 2 ? 'medium' : 'low'

    return {
      score: complexity,
      level,
      factors: complexityFactors
    }
  }

  extractRequirements(task) {
    const requirements = []

    // Requisitos funcionais
    if (task.includes('autenticar') || task.includes('login')) {
      requirements.push({ type: 'functional', description: 'Sistema de autenticação' })
    }

    if (task.includes('banco') || task.includes('database')) {
      requirements.push({ type: 'functional', description: 'Integração com banco de dados' })
    }

    if (task.includes('api') || task.includes('endpoint')) {
      requirements.push({ type: 'functional', description: 'Criação de API/Endpoints' })
    }

    // Requisitos não funcionais
    if (task.includes('rápido') || task.includes('performance')) {
      requirements.push({ type: 'non-functional', description: 'Alta performance' })
    }

    if (task.includes('seguro') || task.includes('security')) {
      requirements.push({ type: 'non-functional', description: 'Segurança robusta' })
    }

    return requirements
  }

  identifyConstraints(context) {
    const constraints = []

    if (context.timeLimit) {
      constraints.push({ type: 'time', value: context.timeLimit })
    }

    if (context.budget) {
      constraints.push({ type: 'budget', value: context.budget })
    }

    if (context.technologies) {
      constraints.push({ type: 'technology', value: context.technologies })
    }

    return constraints
  }

  identifyDependencies(task, context) {
    const dependencies = []

    // Dependências baseadas na tarefa
    if (task.includes('database')) {
      dependencies.push({ type: 'database', required: true })
    }

    if (task.includes('api')) {
      dependencies.push({ type: 'api_framework', required: true })
    }

    if (task.includes('frontend')) {
      dependencies.push({ type: 'ui_library', required: true })
    }

    // Dependências do contexto
    if (context.existingSystems) {
      dependencies.push(...context.existingSystems.map(sys => ({ type: 'system', value: sys })))
    }

    return dependencies
  }

  assessFeasibility(task, context) {
    let score = 0.8 // Base

    // Fatores que afetam viabilidade
    const factors = {
      complexity: this.assessComplexity(task, context).level === 'low' ? 0.2 : -0.1,
      resources: context.resourcesAvailable ? 0.1 : -0.2,
      time: context.timeLimit ? 0.1 : 0,
      expertise: context.expertiseLevel === 'high' ? 0.1 : -0.1
    }

    Object.values(factors).forEach(factor => {
      score += factor
    })

    return {
      score: Math.max(0, Math.min(1, score)),
      level: score > 0.7 ? 'high' : score > 0.4 ? 'medium' : 'low',
      factors
    }
  }

  recommendApproach(task, analysis) {
    const intent = this.analyzeIntent(task)
    const complexity = this.assessComplexity(task, {})

    const approaches = {
      'code_generation': {
        simple: 'Desenvolvimento iterativo com validação',
        medium: 'Desenvolvimento modular com testes',
        complex: 'Desenvolvimento em camadas com arquitetura limpa'
      },
      'problem_solving': {
        simple: 'Análise direta e correção focalizada',
        medium: 'Análise sistemática com múltiplas hipóteses',
        complex: 'Análise profunda com debugging estruturado'
      },
      'learning': {
        simple: 'Pesquisa direta e resumo',
        medium: 'Pesquisa comparativa e análise',
        complex: 'Pesquisa aprofundada com síntese'
      }
    }

    return approaches[intent.type]?.[complexity.level] || 'Abordagem padrão'
  }

  // Métodos de decomposição
  breakIntoSubProblems(task) {
    const subProblems = []

    // Identificar partes principais da tarefa
    if (task.includes('e') || task.includes('depois')) {
      const parts = task.split(/\b(e|depois|então|após)\b/i)
      parts.forEach((part, index) => {
        if (part.trim()) {
          subProblems.push({
            id: index + 1,
            description: part.trim(),
            priority: index === 0 ? 'high' : 'medium',
            dependencies: index > 0 ? [index] : []
          })
        }
      })
    } else {
      // Decomposição baseada em verbos de ação
      const actions = ['analisar', 'projetar', 'implementar', 'testar', 'deployar']
      actions.forEach((action, index) => {
        if (task.toLowerCase().includes(action)) {
          subProblems.push({
            id: index + 1,
            description: `${action} parte da tarefa`,
            priority: 'medium',
            dependencies: index > 0 ? [index] : []
          })
        }
      })
    }

    return subProblems.length > 0 ? subProblems : [{
      id: 1,
      description: task,
      priority: 'high',
      dependencies: []
    }]
  }

  mapDependencies(task) {
    // Mapear dependências entre sub-problemas
    return this.breakIntoSubProblems(task).map(sub => ({
      from: sub.id,
      to: sub.dependencies,
      type: 'sequential'
    }))
  }

  createExecutionSequence(task) {
    const subProblems = this.breakIntoSubProblems(task)

    // Ordenar por prioridade e dependências
    const sorted = subProblems.sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1
      if (b.priority === 'high' && a.priority !== 'high') return 1
      return a.dependencies.length - b.dependencies.length
    })

    return sorted.map(sub => ({
      step: sub.id,
      description: sub.description,
      priority: sub.priority,
      estimatedTime: this.estimateStepTime(sub)
    }))
  }

  identifyParallelTasks(task) {
    const subProblems = this.breakIntoSubProblems(task)

    // Tarefas que podem ser executadas em paralelo (sem dependências)
    return subProblems.filter(sub => sub.dependencies.length === 0)
  }

  identifyCriticalPath(task) {
    const sequence = this.createExecutionSequence(task)

    // Caminho crítico = tarefas com maior tempo total de dependências
    return sequence.filter(step => step.priority === 'high')
  }

  // Métodos de validação
  validateCorrectness(solution, context) {
    let score = 0.8

    // Verificar se a solução aborda o problema
    if (solution && solution.length > 0) score += 0.1

    // Verificar se há lógica consistente
    if (this.hasLogicalConsistency(solution)) score += 0.1

    return Math.min(1.0, score)
  }

  validateCompleteness(solution, context) {
    let score = 0.7

    // Verificar se todos os requisitos foram atendidos
    if (context.requirements) {
      const addressedRequirements = context.requirements.filter(req =>
        solution.toLowerCase().includes(req.description.toLowerCase())
      ).length

      score += (addressedRequirements / context.requirements.length) * 0.3
    }

    return Math.min(1.0, score)
  }

  validateEfficiency(solution, context) {
    let score = 0.7

    // Verificar eficiência da solução
    if (this.isOptimizedSolution(solution)) score += 0.2
    if (this.usesBestPractices(solution)) score += 0.1

    return Math.min(1.0, score)
  }

  validateMaintainability(solution) {
    let score = 0.7

    // Verificar manutenibilidade
    if (this.isWellStructured(solution)) score += 0.2
    if (this.hasDocumentation(solution)) score += 0.1

    return Math.min(1.0, score)
  }

  validateSecurity(solution) {
    let score = 0.8

    // Verificar segurança básica
    if (!this.hasSecurityIssues(solution)) score += 0.2

    return Math.min(1.0, score)
  }

  validateScalability(solution, context) {
    let score = 0.7

    // Verificar escalabilidade
    if (this.isScalableSolution(solution)) score += 0.3

    return Math.min(1.0, score)
  }

  // Métodos auxiliares
  hasLogicalConsistency(solution) {
    // Verificação simples de consistência lógica
    return solution.includes('if') || solution.includes('function') || solution.includes('class')
  }

  isOptimizedSolution(solution) {
    // Verificar se usa otimizações básicas
    return solution.includes('cache') || solution.includes('async') || solution.includes('optimize')
  }

  usesBestPractices(solution) {
    // Verificar se segue boas práticas
    return solution.includes('const') || solution.includes('let') || solution.includes('try')
  }

  isWellStructured(solution) {
    // Verificar estrutura do código
    return solution.includes('function') || solution.includes('class') || solution.includes('module')
  }

  hasDocumentation(solution) {
    // Verificar se tem documentação
    return solution.includes('//') || solution.includes('*') || solution.includes('/**')
  }

  hasSecurityIssues(solution) {
    // Verificar problemas de segurança básicos
    return solution.includes('eval(') || solution.includes('innerHTML') || solution.includes('document.write')
  }

  isScalableSolution(solution) {
    // Verificar se considera escalabilidade
    return solution.includes('scale') || solution.includes('cluster') || solution.includes('load balance')
  }

  estimateStepTime(subProblem) {
    const timeMap = {
      'high': 30, // minutos
      'medium': 15,
      'low': 5
    }

    return timeMap[subProblem.priority] || 10
  }

  estimateExecutionTime(decomposition) {
    return decomposition.sequence.reduce((total, step) => total + step.estimatedTime, 0)
  }

  identifyRequiredResources(decomposition) {
    const resources = []

    // Recursos baseados nos sub-problemas
    decomposition.subProblems.forEach(sub => {
      if (sub.description.includes('database')) {
        resources.push({ type: 'database', priority: 'high' })
      }
      if (sub.description.includes('api')) {
        resources.push({ type: 'api_server', priority: 'medium' })
      }
    })

    return resources
  }

  // Métodos de cálculo de confiança
  calculateAnalysisConfidence(analysisResult) {
    let confidence = 0.7

    // Baseado na clareza da intent
    confidence += analysisResult.intent.confidence * 0.2

    // Baseado na viabilidade
    confidence += analysisResult.feasibility.score * 0.1

    return Math.min(1.0, confidence)
  }

  calculateDecompositionConfidence(decomposition) {
    let confidence = 0.8

    // Baseado no número de sub-problemas
    if (decomposition.subProblems.length > 1) confidence += 0.1

    // Baseado nas dependências claras
    const clearDependencies = decomposition.dependencies.filter(dep => dep.to.length > 0).length
    confidence += (clearDependencies / decomposition.dependencies.length) * 0.1

    return Math.min(1.0, confidence)
  }

  calculateOverallValidationScore(validation) {
    const scores = Object.values(validation)
    return scores.reduce((sum, score) => sum + score, 0) / scores.length
  }

  calculateCombinationConfidence(combination) {
    let confidence = 0.7

    // Baseado na qualidade dos resultados
    const avgResultConfidence = combination.results.reduce((sum, r) => sum + (r.confidence || 0.5), 0) / combination.results.length
    confidence += avgResultConfidence * 0.2

    // Baseado na ausência de conflitos
    confidence += (1 - combination.conflicts.length / combination.results.length) * 0.1

    return Math.min(1.0, confidence)
  }

  calculateIntegratedConfidence(integratedReasoning) {
    let confidence = 0.7

    // Baseado na clareza do plano
    if (integratedReasoning.executionPlan.length > 0) confidence += 0.1

    // Baseado na avaliação de riscos
    if (integratedReasoning.riskAssessment) confidence += 0.1

    // Baseado nos critérios de sucesso
    if (integratedReasoning.successCriteria.length > 0) confidence += 0.1

    return Math.min(1.0, confidence)
  }

  // Métodos de explicação - AGORA COM LLM REAL E ADAPTATIVO
  async explainReasoning(analysisResult) {
    const { askMultiAI } = await import('../core/multiAI.js')

    const prompt = `Explique este resultado de forma NATURAL e CONVERSACIONAL:

Intent detectada: ${analysisResult.intent.type} (confiança: ${(analysisResult.intent.confidence * 100).toFixed(1)}%)
Complexidade: ${analysisResult.complexity.level}
Abordagem recomendada: ${analysisResult.approach}

Explique como se estivesse conversando com um colega desenvolvedor.
Seja direto, use linguagem natural, sem formatações robóticas.`

    try {
      return await askMultiAI(prompt)
    } catch (error) {
      console.error('❌ Erro no LLM, usando fallback:', error.message)
      return `Entendi! Você precisa de uma abordagem ${analysisResult.approach} para isso. A complexidade é ${analysisResult.complexity.level} e a intenção parece ser ${analysisResult.intent.type}.`
    }
  }

  async explainDecomposition(decomposition) {
    const { askMultiAI } = await import('../core/multiAI.js')

    const prompt = `Analise esta decomposição de problema e explique como especialista:

Sub-problemas: ${decomposition.subProblems.length}
Caminho crítico: ${decomposition.criticalPath.length} passos
Tempo estimado: ${decomposition.estimatedTime} minutos

Explique a estratégia de decomposição e os próximos passos.`

    try {
      return await askMultiAI(prompt)
    } catch (error) {
      console.error('❌ Erro no LLM, usando fallback:', error.message)
      return `O problema foi decomposto em ${decomposition.subProblems.length} sub-problemas, com um caminho crítico de ${decomposition.criticalPath.length} passos. O tempo estimado de execução é de ${decomposition.estimatedTime} minutos.`
    }
  }

  explainCombination(combination) {
    return `Combinação de ${combination.results.length} resultados identificou ${combination.synergies.length} sinergias e ${combination.conflicts.length} conflitos. A recomendação final é ${combination.finalRecommendation}.`
  }

  async explainIntegratedReasoning(integratedReasoning) {
    const { askMultiAI } = await import('../core/multiAI.js')

    const prompt = `Analise este raciocínio integrado e explique como especialista:

Plano de execução: ${integratedReasoning.executionPlan.length} passos
Riscos identificados: ${integratedReasoning.riskAssessment.identifiedRisks.length}
Intent principal: ${integratedReasoning.primaryIntent.type}
Complexidade: ${integratedReasoning.complexity.level}

Explique a estratégia geral e como executar este plano.`

    try {
      return await askMultiAI(prompt)
    } catch (error) {
      console.error('❌ Erro no LLM, usando fallback:', error.message)
      return `Raciocínio integrado combinou análise de tarefa com decomposição de problema, resultando em um plano de execução com ${integratedReasoning.executionPlan.length} passos e ${integratedReasoning.riskAssessment.identifiedRisks.length} riscos identificados.`
    }
  }

  // Métodos de geração de resultados
  generateNextSteps(analysisResult) {
    return [
      `Executar abordagem: ${analysisResult.approach}`,
      `Atender requisitos: ${analysisResult.requirements.length} identificados`,
      `Considerar restrições: ${analysisResult.constraints.length} encontradas`
    ]
  }

  synthesizeResults(results) {
    return {
      summary: `Síntese de ${results.length} resultados`,
      keyPoints: results.flatMap(r => r.keyPoints || []).slice(0, 5),
      consensus: this.findConsensus(results),
      gaps: this.identifyGaps(results)
    }
  }

  identifyConflicts(results) {
    const conflicts = []

    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const conflict = this.compareResults(results[i], results[j])
        if (conflict) {
          conflicts.push({
            between: [results[i].agent, results[j].agent],
            type: conflict.type,
            description: conflict.description
          })
        }
      }
    }

    return conflicts
  }

  identifySynergies(results) {
    const synergies = []

    // Identificar complementaridades
    results.forEach(result => {
      if (result.agent.includes('code') && result.success) {
        synergies.push({
          type: 'code_quality',
          description: 'Solução de código pode beneficiar outros agentes',
          participants: [result.agent]
        })
      }
    })

    return synergies
  }

  extractBestPracticesFromResults(results) {
    return results
      .filter(r => r.success && r.bestPractices)
      .flatMap(r => r.bestPractices)
      .slice(0, 5)
  }

  generateFinalRecommendation(results) {
    const successful = results.filter(r => r.success)

    if (successful.length === 0) {
      return 'Nenhuma solução bem-sucedida encontrada'
    }

    // Retornar a solução com maior confiança
    const best = successful.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0]

    return `Adotar solução do agente ${best.agent} com confiança de ${((best.confidence || 0) * 100).toFixed(1)}%`
  }

  findConsensus(results) {
    // Encontrar pontos em comum entre resultados
    const commonPoints = []

    if (results.length >= 2) {
      // Simples: verificar se os primeiros resultados concordam
      const firstTwo = results.slice(0, 2)
      if (firstTwo[0].success && firstTwo[1].success) {
        commonPoints.push('Múltiplas soluções válidas encontradas')
      }
    }

    return commonPoints
  }

  identifyGaps(results) {
    const gaps = []

    // Identificar o que falta nas soluções
    const hasCode = results.some(r => r.result && r.result.includes('function'))
    const hasTests = results.some(r => r.result && r.result.includes('test'))

    if (!hasCode) {
      gaps.push('Falta implementação de código')
    }

    if (!hasTests) {
      gaps.push('Falta cobertura de testes')
    }

    return gaps
  }

  compareResults(result1, result2) {
    // Comparar dois resultados para identificar conflitos
    if (result1.success && result2.success) {
      // Verificar se as soluções são muito diferentes
      const similarity = this.calculateSimilarity(result1.result, result2.result)

      if (similarity < 0.3) {
        return {
          type: 'approach_divergence',
          description: 'Abordagens muito diferentes entre soluções'
        }
      }
    }

    return null
  }

  calculateSimilarity(text1, text2) {
    if (!text1 || !text2) return 0

    const words1 = text1.toLowerCase().split(/\s+/)
    const words2 = text2.toLowerCase().split(/\s+/)

    const commonWords = words1.filter(word => words2.includes(word))

    return commonWords.length / Math.max(words1.length, words2.length)
  }

  createActionPlan(combination) {
    return {
      immediate: [
        'Implementar solução recomendada',
        'Validar com testes'
      ],
      shortTerm: [
        'Monitorar performance',
        'Coletar feedback'
      ],
      longTerm: [
        'Refinar basedo em uso',
        'Expandir funcionalidades'
      ]
    }
  }

  identifyValidationIssues(validation) {
    const issues = []

    Object.entries(validation).forEach(([key, value]) => {
      if (value < 0.6) {
        issues.push({
          area: key,
          score: value,
          severity: value < 0.4 ? 'high' : 'medium'
        })
      }
    })

    return issues
  }

  suggestImprovements(validation) {
    const improvements = []

    Object.entries(validation).forEach(([key, value]) => {
      if (value < 0.8) {
        improvements.push({
          area: key,
          suggestion: `Melhorar ${key} da solução`,
          targetScore: 0.8
        })
      }
    })

    return improvements
  }

  generateValidationRecommendation(validation, overallScore) {
    if (overallScore >= 0.8) {
      return 'Solução aprovada para implementação'
    } else if (overallScore >= 0.6) {
      return 'Solução aprovada com ressalvas - recomenda-se melhorias'
    } else {
      return 'Solução reprovada - necessita revisão significativa'
    }
  }

  assessRisks(taskAnalysis, problemDecomposition) {
    const risks = []

    // Risco baseado na complexidade
    if (taskAnalysis.analysis.complexity.level === 'high') {
      risks.push({
        type: 'complexity',
        description: 'Alta complexidade pode levar a atrasos',
        probability: 'medium',
        impact: 'high'
      })
    }

    // Risco baseado nas dependências
    if (problemDecomposition.dependencies.length > 3) {
      risks.push({
        type: 'dependencies',
        description: 'Muitas dependências aumentam risco de falha em cadeia',
        probability: 'medium',
        impact: 'medium'
      })
    }

    return {
      identifiedRisks: risks,
      overallRisk: risks.length > 0 ? 'medium' : 'low',
      mitigationPlan: this.createMitigationPlan(risks)
    }
  }

  createMitigationPlan(risks) {
    return risks.map(risk => ({
      risk: risk.description,
      mitigation: `Implementar ${risk.type === 'complexity' ? 'protótipos' : 'testes unitários'}`,
      priority: risk.impact
    }))
  }

  defineSuccessCriteria(task, context) {
    const criteria = [
      'Solução deve resolver o problema original',
      'Implementação deve seguir boas práticas',
      'Código deve ser testável e maintainável'
    ]

    if (context.performance) {
      criteria.push('Performance deve atender requisitos especificados')
    }

    return criteria
  }

  createMonitoringPlan(taskAnalysis, problemDecomposition) {
    return {
      metrics: [
        'Tempo de execução',
        'Taxa de sucesso',
        'Qualidade da solução'
      ],
      frequency: taskAnalysis.analysis.complexity.level === 'high' ? 'diário' : 'semanal',
      alerts: [
        'Falha na execução',
        'Desvio de tempo estimado',
        'Qualidade abaixo do esperado'
      ]
    }
  }

  generateIntegratedRecommendations(integratedReasoning) {
    return [
      `Seguir plano de execução com ${integratedReasoning.executionPlan.length} passos`,
      `Monitorar ${integratedReasoning.riskAssessment.identifiedRisks.length} riscos identificados`,
      `Validar contra ${integratedReasoning.successCriteria.length} critérios de sucesso`
    ]
  }

  saveReasoning(reasoning) {
    this.reasoningHistory.push({
      ...reasoning,
      timestamp: Date.now()
    })

    // Manter apenas últimos 100 raciocínios
    if (this.reasoningHistory.length > 100) {
      this.reasoningHistory = this.reasoningHistory.slice(-100)
    }
  }
}

export const reasoningAgent = new ReasoningAgent()
