import { askMultiAI } from '../core/multiAI.js'
import { grootMemoryConnector } from '../core/grootMemoryConnector.js'
import { grootRAG } from '../core/grootRAG.js'
import { grootAdvancedRAG } from '../core/grootAdvancedRAG.js'
import { grootAnalytics } from '../core/grootAnalytics.js'
import { buildLearningSignals, mergeKnownFacts, mergePreferences } from '../core/learningEngine.js'
import { buildAssistantPromptContext } from '../packages/ai-core/src/index.js'
import { evaluateInteractionQuality } from '../core/qualityEngine.js'
import { maybeSummarize } from '../core/summaryEngine.js'
import { buildSafetyResponse, detectSafetyRisk } from '../core/safetyGuard.js'

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

  extractKnownFacts(memoryContext = {}) {
    return {
      ...(memoryContext?.userProfile?.knownFacts || {}),
      ...(memoryContext?.knownFacts || {})
    }
  }

  isCapabilityQuestion(task = '') {
    return /\b(google|bing|yahoo|naveg|pesquisa|pesquisar|web|internet|browser|busca ao vivo|acesso ao vivo|o que voce consegue|o que você consegue|o que voce realmente tem|o que você realmente tem|quais sao seus limites|quais são seus limites|como voce funciona|como você funciona|capacidades|ferramentas)\b/i
      .test(String(task || ''))
  }

  isMemoryRecallQuestion(task = '') {
    return /\b(agora diga|qual e meu nome|qual é meu nome|minha area|minha área|como prefiro as respostas|o que eu disse|lembra do meu nome|lembra da minha area|lembra da minha área|uma unica frase|uma única frase)\b/i
      .test(String(task || ''))
  }

  isMemoryRegistrationPrompt(task = '') {
    return /\bresponda apenas:\s*memoria registrada\b/i.test(String(task || ''))
  }

  isDebugDiagnosticQuestion(task = '') {
    return /\berro 500\b/i.test(String(task || ''))
      && /\b(jwt)\b/i.test(String(task || ''))
      && /\b(express)\b/i.test(String(task || ''))
  }

  buildSafetyOperationalResponse(task = '', context = {}) {
    const safety = detectSafetyRisk(task)
    if (!safety?.triggered && !safety?.advisory) {
      return null
    }

    return buildSafetyResponse(safety, {
      locale: context?.locale || context?.language || 'pt-BR',
      promptText: task
    })
  }

  buildDebugDiagnosticResponse() {
    return [
      'Plano curto de diagnostico para erro 500 em API Express apos adicionar JWT, do mais provavel para o menos provavel:',
      '1. Middleware JWT: valide JWT_SECRET, formato Bearer, expiracao do token e try/catch no verify.',
      '2. Conversao indevida para 500: confira se falhas de autenticacao nao estao caindo no error handler generico em vez de 401 ou 403.',
      '3. req.user e claims: logue authorization, payload decodificado e a primeira linha em que req.user fica invalido.',
      '4. Ordem do pipeline: revise body parser, auth, rotas protegidas e error handler final.',
      '5. Ambiente e deploy: compare segredo JWT, horario do servidor e variaveis entre local e producao.',
      'Primeiro teste pratico agora: adicionar logs curtos no middleware JWT e no error handler para identificar a primeira quebra real.',
      'Se quiser, eu monto em seguida um checklist de logs exatos e o patch minimo para diagnosticar isso em minutos.'
    ].join('\n')
  }

  buildCapabilityResponse(task, context = {}, memoryContext = {}) {
    const capabilities = context?.researchCapabilities || {}
    const liveSources = Array.isArray(capabilities.liveSources) ? capabilities.liveSources : []
    const facts = this.extractKnownFacts(memoryContext)
    const normalizedTask = String(task || '').toLowerCase()
    const mentionsSearch = /\b(google|bing|yahoo|pesquisa|pesquisar|web|internet|naveg|browser)\b/i.test(normalizedTask)

    const lines = ['Sou o GIOM, um assistente de IA no estado operacional atual desta execucao.']

    if (mentionsSearch && capabilities.mode !== 'live') {
      lines.push('Nao, hoje eu nao consigo pesquisar Google, Bing, Yahoo ou navegar na web ao vivo.')
    } else if (capabilities.mode === 'live') {
      lines.push(`Sim, nesta execucao eu tenho pesquisa ao vivo via ${liveSources.join(', ') || 'web'}.`)
    } else {
      lines.push('Hoje eu opero sem pesquisa web ao vivo confirmada.')
    }

    lines.push(
      capabilities.mode === 'live'
        ? `Fontes disponiveis agora: pesquisa atual via ${liveSources.join(', ') || 'web'}, memoria conversacional, perfil do usuario, historico salvo e base curada via RAG.`
        : 'Fontes disponiveis agora: memoria conversacional, perfil do usuario, historico salvo e base curada via RAG.'
    )
    lines.push('Meu papel aqui e analisar, explicar, escrever codigo, revisar tecnicamente e aplicar os modulos especialistas ativos.')

    if (facts.name || facts.workDomain || facts.responseStyle) {
      const retainedSignals = []
      if (facts.name) retainedSignals.push('nome')
      if (facts.workDomain) retainedSignals.push('area')
      if (facts.responseStyle) retainedSignals.push('preferencia de resposta')
      lines.push(`Eu tambem retenho contexto curto informado explicitamente pelo usuario, como ${retainedSignals.join(', ')}.`)
    }

    lines.push(
      capabilities.mode === 'live'
        ? 'Limite operacional: eu separo o que veio da pesquisa atual do que veio do conhecimento interno; se a origem nao estiver indicada, trate a informacao como nao verificada.'
        : 'Limite operacional: fatos atuais que dependem de busca externa ficam nao verificados enquanto a pesquisa ao vivo nao estiver habilitada.'
    )
    lines.push('Resumo direto: eu sou forte em memoria, RAG, raciocinio e modulos especialistas; pesquisa web ao vivo so existe quando esta habilitada nesta execucao.')
    lines.push('Se quiser, eu posso listar agora quais fontes internas e modulos especialistas estao ativos nesta conversa.')
    return lines.join('\n')
  }

  buildMemoryRegistrationResponse(task = '') {
    const explicitResponse = String(task || '').match(/\bresponda apenas:\s*([^.\n]+)\b/i)
    if (explicitResponse?.[1]) {
      return explicitResponse[1].trim()
    }

    return 'Memoria registrada.'
  }

  buildMemoryRecallResponse(task, memoryContext = {}) {
    const facts = this.extractKnownFacts(memoryContext)
    const normalizedTask = String(task || '').toLowerCase()

    if (!facts.name && !facts.workDomain && !facts.responseStyle && !facts.role) {
      return null
    }

    const wantsSingleSentence = /uma unica frase|uma única frase|em uma frase/i.test(normalizedTask)
    const parts = []

    if (facts.name) parts.push(`seu nome e ${facts.name}`)
    if (facts.workDomain) parts.push(`voce trabalha com ${facts.workDomain}`)
    if (facts.responseStyle) {
      const style = String(facts.responseStyle || '').trim()
      parts.push(
        /\brespostas?\b/i.test(style)
          ? `prefere ${style}`
          : `prefere respostas ${style}`
      )
    }
    if (facts.role && !facts.workDomain) parts.push(`sua funcao e ${facts.role}`)

    if (parts.length === 0) {
      return null
    }

    if (wantsSingleSentence || /meu nome|minha area|minha área|prefiro/i.test(normalizedTask)) {
      const sentence = parts.join(', ')
        .replace(/, ([^,]*)$/, ' e $1')
      return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`
    }

    return parts.map((item, index) => `${index + 1}. ${item.charAt(0).toUpperCase()}${item.slice(1)}.`).join('\n')
  }

  tryDirectOperationalResponse(task, context = {}, memoryContext = {}) {
    if (this.isMemoryRegistrationPrompt(task)) {
      return this.buildMemoryRegistrationResponse(task)
    }

    const safetyResponse = this.buildSafetyOperationalResponse(task, context)
    if (safetyResponse) {
      return safetyResponse
    }

    if (this.isDebugDiagnosticQuestion(task)) {
      return this.buildDebugDiagnosticResponse()
    }

    if (this.isCapabilityQuestion(task)) {
      return this.buildCapabilityResponse(task, context, memoryContext)
    }

    if (this.isMemoryRecallQuestion(task)) {
      return this.buildMemoryRecallResponse(task, memoryContext)
    }

    return null
  }

  buildRuleBasedFallback(task, context = {}, memoryContext = {}, promptPackage = {}) {
    const directResponse = this.tryDirectOperationalResponse(task, context, memoryContext)
    if (directResponse) {
      return directResponse
    }

    const prompt = String(task || '')
    const lowerTask = prompt.toLowerCase()

    if (this.isDebugDiagnosticQuestion(lowerTask)) {
      return this.buildDebugDiagnosticResponse()
    }

    const moduleLabel = Array.isArray(promptPackage.activeModules) && promptPackage.activeModules.length > 0
      ? promptPackage.activeModules.join(', ')
      : 'geral'
    const memoryHint = memoryContext?.knownFactsText
      ? `Contexto curto confirmado: ${memoryContext.knownFactsText}.`
      : 'Ainda sem fatos explicitos adicionais do usuario nesta sessao.'
    const summaryHint = memoryContext?.contextSummary || 'Sem contexto acumulado.'

    return [
      'Sou o GIOM, um assistente de IA em modo de contingencia operacional nesta execucao.',
      'Vou responder com base no contexto disponivel sem fingir pesquisa externa.',
      `Modulo ativo principal: ${moduleLabel}.`,
      memoryHint,
      `Resumo recente: ${summaryHint}.`,
      'Meus recursos atuais aqui sao memoria recente, perfil do usuario, conhecimento curado e raciocinio local.',
      'Se quiser, eu posso continuar em passos objetivos e ir refinando a resposta por iteracoes curtas.'
    ].join(' ')
  }

  async finalizeReasoningResponse(task, responseText, userId, userStyle, memoryContext, ragContext, promptPackage, reasoningStartTime, metadataExtras = {}) {
    const quality = evaluateInteractionQuality({
      userMessage: task,
      aiResponse: responseText
    })

    const reasoning = {
      success: true,
      type: metadataExtras.fallback ? 'fallback_reasoning' : (metadataExtras.directRuntime ? 'runtime_reasoning' : 'llm_reasoning'),
      response: responseText,
      confidence: metadataExtras.confidence || (metadataExtras.fallback ? 0.82 : 0.9),
      metadata: {
        reasoningTime: Date.now(),
        method: metadataExtras.method || (metadataExtras.fallback ? 'rule_fallback' : 'direct_llm'),
        provider: metadataExtras.provider || (metadataExtras.fallback ? 'rule_fallback' : 'multi_ai_fallback'),
        userStyle,
        toneInstruction: metadataExtras.toneInstruction || null,
        personality: promptPackage.profileId,
        activeModules: promptPackage.activeModules,
        bibleStudyModules: promptPackage.bibleStudyModules,
        promptPacks: promptPackage.promptPacks,
        audience: promptPackage.audience,
        memoryContext: memoryContext.contextSummary,
        recentFacts: memoryContext.knownFacts || {},
        qualityScore: quality.score,
        durationMs: Date.now() - reasoningStartTime,
        ...metadataExtras
      }
    }

    const learningSignals = buildLearningSignals({
      userMessage: task,
      aiResponse: responseText,
      userStyle,
      qualityScore: quality.score
    })

    if (!learningSignals.skip) {
      const existingProfile = memoryContext.userProfile || {}
      const existingTopics = Array.isArray(existingProfile.topics) ? existingProfile.topics : []
      const mergedTopics = Array.from(new Set([...existingTopics, ...learningSignals.topics])).slice(0, 12)
      const mergedFacts = mergeKnownFacts(existingProfile.knownFacts || {}, learningSignals.facts || {})

      const mergedProfile = mergePreferences(existingProfile, {
        ...learningSignals.preferences,
        style: learningSignals.style,
        topics: mergedTopics,
        knownFacts: mergedFacts
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

      if (Object.keys(learningSignals.facts || {}).length > 0) {
        await grootMemoryConnector.saveLearningPattern(
          userId,
          'identity_fact',
          learningSignals.facts,
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

    await grootMemoryConnector.saveConversation(userId, task, responseText, {
      userStyle,
      confidence: reasoning.confidence,
      provider: reasoning.metadata.provider,
      sessionId: `session_${Date.now()}`,
      requestId: metadataExtras.requestId,
      assistantProfile: promptPackage.profileId,
      activeModules: promptPackage.activeModules,
      bibleStudyModules: promptPackage.bibleStudyModules,
      promptPacks: promptPackage.promptPacks,
      qualityScore: quality.score
    })

    if (metadataExtras.requestId) {
      await grootMemoryConnector.saveEvaluation(userId, metadataExtras.requestId, quality)
    }

    try {
      const history = await grootMemoryConnector.getRecentHistory(userId, 12)
      const summary = await maybeSummarize(history)
      if (summary) {
        await grootMemoryConnector.saveSummary(userId, summary, {
          source: 'auto',
          count: history.length
        })
      }
    } catch (error) {
      console.warn('⚠️ Falha ao gerar resumo:', error.message)
    }

    await grootAdvancedRAG.learnFromInteractionAdvanced(task, responseText, {
      userStyle,
      confidence: reasoning.confidence,
      provider: reasoning.metadata.provider,
      category: promptPackage.activeModules.includes('bible') ? 'bible' : 'learned',
      qualityScore: quality.score,
      assistantProfile: promptPackage.profileId,
      activeModules: promptPackage.activeModules,
      bibleStudyModules: promptPackage.bibleStudyModules,
      promptPacks: promptPackage.promptPacks
    })

    await grootAnalytics.trackUsage(userId, task, responseText, {
      responseTime: Date.now() - reasoningStartTime,
      tokensUsed: responseText.length,
      provider: reasoning.metadata.provider,
      userStyle,
      confidence: reasoning.confidence,
      success: true,
      knowledgeFound: ragContext.knowledge.length,
      bugsFound: ragContext.bugs.length,
      activeModules: promptPackage.activeModules,
      bibleStudyModules: promptPackage.bibleStudyModules
    })

    this.saveReasoning(reasoning)
    return reasoning
  }

  async generalReasoning(task, analysis, context = {}) {
    console.log(`🧠 ReasoningAgent: Processando tarefa geral...`)
    const reasoningStartTime = Date.now()

    // 📋 PROCESSAR UPLOAD SE EXISTIR
    let uploadContext = ""
    if (context.uploadId && context.uploadName) {
      uploadContext = `
📎 ARQUIVO ENVIADO:
- Nome: ${context.uploadName}
- Tipo: ${context.uploadType}
- ID: ${context.uploadId}
- Observações: O arquivo está disponível para análise. Peça para descrever o conteúdo específico que deseja analisar.

`
    }

    const userId = context.userId || 'default_user'
    const userStyle = this.detectUserStyle(task, userId)

    const toneInstructions = {
      casual: "Mantenha conversa natural e acessivel.",
      urgent: "Priorize a solucao utilizavel e corte o excesso.",
      detailed: "Organize a resposta em blocos claros e aprofunde quando for util.",
      beginner: "Explique em passos simples e sem jargao desnecessario.",
      natural: "Equilibre clareza, fluidez e precisao."
    }

    const {
      memoryContext,
      ragContext,
      promptPackage
    } = await buildAssistantPromptContext(task, {
      ...context,
      userId,
      depthPreference: userStyle === 'detailed'
        ? 'advanced'
        : (userStyle === 'beginner' ? 'beginner' : 'adaptive')
    }, {
      limit: 6,
      userStyle
    })

    console.log('📚 Contexto da memória:', memoryContext.contextSummary)
    console.log('🎯 Contexto RAG Avançado:', ragContext.totalFound, 'itens encontrados')

    const prompt = `${uploadContext}${task}`.trim()
    const directRuntimeResponse = this.tryDirectOperationalResponse(task, context, memoryContext)

    if (directRuntimeResponse) {
      const reasoning = await this.finalizeReasoningResponse(
        task,
        directRuntimeResponse,
        userId,
        userStyle,
        memoryContext,
        ragContext,
        promptPackage,
        reasoningStartTime,
        {
          provider: 'deterministic_runtime',
          method: 'deterministic_runtime',
          directRuntime: true,
          confidence: 0.96,
          requestId: context.requestId,
          toneInstruction: toneInstructions[userStyle]
        }
      )

      console.log('✅ Resposta operacional deterministica concluida')
      return reasoning
    }

    try {
      const { askMultiAI } = await import('../core/multiAI.js')
      const llmResponse = await askMultiAI(prompt, {
        systemPrompt: `${promptPackage.systemPrompt}\n- Ajuste fino desta conversa: ${toneInstructions[userStyle]}`
      })

      // 🧠 FILTRO DE NATURALIDADE - REMOVER ROBÔTISMO
      const filteredResponse = llmResponse
        .replace(/É um prazer conversar com você/gi, '')
        .replace(/Estou ansioso para|Fico feliz em/gi, '')
        .replace(/Espero que isso ajude/gi, '')
        .replace(/Você entendeu\?|Alguma dúvida\?/gi, '')
        .replace(/Isso é muito incrível|Isso é fantástico/gi, 'Isso resolve')
        .replace(/Vamos explorar juntos/gi, '')
        .replace(/Como desenvolvedor experiente/gi, '')
        .replace(/\n{3,}/g, '\n\n') // Remover linhas vazias excessivas
        .trim()

      const reasoning = await this.finalizeReasoningResponse(
        task,
        filteredResponse,
        userId,
        userStyle,
        memoryContext,
        ragContext,
        promptPackage,
        reasoningStartTime,
        {
          provider: 'multi_ai_fallback',
          method: 'direct_llm',
          confidence: 0.9,
          requestId: context.requestId,
          toneInstruction: toneInstructions[userStyle]
        }
      )

      console.log(`✅ Raciocínio LLM concluído e salvo na memória`)
      return reasoning

    } catch (error) {
      console.error('❌ Erro no LLM, usando análise estrutural:', error.message)

      const fallbackResponse = this.buildRuleBasedFallback(task, context, memoryContext, promptPackage)
      const reasoning = await this.finalizeReasoningResponse(
        task,
        fallbackResponse,
        userId,
        userStyle,
        memoryContext,
        ragContext,
        promptPackage,
        reasoningStartTime,
        {
          provider: 'rule_fallback',
          method: 'rule_fallback',
          confidence: 0.84,
          fallback: true,
          requestId: context.requestId,
          toneInstruction: toneInstructions[userStyle],
          fallbackError: error.message
        }
      )

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
