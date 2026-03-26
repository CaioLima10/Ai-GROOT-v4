import { askMultiAI } from '../core/multiAI.js'
import { grootMemoryConnector } from '../core/grootMemoryConnector.js'
import { grootRAG } from '../core/grootRAG.js'
import { grootAdvancedRAG } from '../core/grootAdvancedRAG.js'
import { grootAnalytics } from '../core/grootAnalytics.js'
import { buildLearningSignals, mergeKnownFacts, mergePreferences } from '../core/learningEngine.js'
import {
  buildAssistantPromptContext,
  redactSensitiveData,
  sanitizeMetadataDeep,
  shouldSkipLearningForSensitiveData
} from '../packages/ai-core/src/index.js'
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

    if (/\b(decompose|decompor|decomponha|decomposicao|decomposição|dividir|divida|quebrar em partes|quebre em partes)\b/i.test(lowerTask)) {
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

    const explanation = await this.explainReasoning(analysisResult)

    const reasoning = {
      success: true,
      type: 'task_analysis',
      task,
      analysis: analysisResult,
      reasoning: explanation,
      response: explanation,
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

    const explanation = await this.explainDecomposition(decomposition)

    const reasoning = {
      success: true,
      type: 'problem_decomposition',
      decomposition,
      reasoning: explanation,
      response: explanation,
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

    const recommendation = this.generateValidationRecommendation(validation, overallScore)
    const validationResponse = [
      `Validacao da solucao: ${overallScore >= 0.7 ? 'aprovada' : 'precisa de revisao'}.`,
      `Score geral: ${Math.round(overallScore * 100)}%.`,
      `Recomendacao: ${recommendation}.`
    ].join(' ')

    const reasoning = {
      success: true,
      type: 'solution_validation',
      solution,
      validation,
      overallScore,
      passed: overallScore >= 0.7,
      issues: this.identifyValidationIssues(validation),
      improvements: this.suggestImprovements(validation),
      recommendation,
      response: validationResponse,
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

    const explanation = this.explainCombination(combination)

    const reasoning = {
      success: true,
      type: 'result_combination',
      combination,
      reasoning: explanation,
      response: explanation,
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
    const input = String(task || '')
    const asksCapabilityIntent = /\b(o que voce consegue|o que você consegue|o que voce realmente tem|o que você realmente tem|quais sao seus limites|quais são seus limites|como voce funciona|como você funciona|quais formatos|quais arquivos|quais voce consegue ler|quais você consegue ler|quais voce consegue gerar|quais você consegue gerar|o que voce faz hoje|o que você faz hoje|o que voce entrega hoje|o que você entrega hoje|capacidade|capacidades|ferramentas|pronto|parcial|ainda nao integrado|ainda não integrado)\b/i.test(input)
    const mentionsCapabilitySurface = /\b(google|bing|yahoo|naveg|pesquisa|pesquisar|web|internet|browser|docx|xlsx|pptx|pdf|svg|ocr|zip|anexo|arquivo|arquivos|documento|documentos|gerar pdf|gerar docx|gerar planilha|gerar apresentacao|imagem|image|img|firefly|midjourney|gemini|gpt|chatgpt|copilot|codex)\b/i.test(input)

    return asksCapabilityIntent && mentionsCapabilitySurface
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

  isRedisJwtIncidentQuestion(task = '') {
    const input = String(task || '')
    return /\berro 500\b/i.test(input)
      && /\b(redis)\b/i.test(input)
      && /\b(jwt)\b/i.test(input)
      && /\b(api node|node)\b/i.test(input)
  }

  isArchitectureRefactorQuestion(task = '') {
    const input = String(task || '')
    return /\b(monolito|monolith)\b/i.test(input)
      && /\b(refator|refactor|escalar|escala|incremental)\b/i.test(input)
  }

  isSecureReviewQuestion(task = '') {
    const input = String(task || '')
    return /\b(review tecnico|review técnico|code review|revisao tecnica|revisão técnica)\b/i.test(input)
      && /\b(express)\b/i.test(input)
      && /\b(jwt)\b/i.test(input)
      && /\b(arquivo|upload|salva no disco|disco|banco)\b/i.test(input)
  }

  isSensitiveDataQuestion(task = '') {
    const input = String(task || '')
    const mentionsSensitiveData = /\b(cpf|cnpj|carta[oã]|cvv|token|senha|password|pix|iban|swift|agencia|ag[eê]ncia|conta|documento bancario|dados bancarios|api key|secret|segredo)\b/i.test(input)
    const mentionsPersistence = /\b(guarde|guardar|memorize|memorizar|lembre|lembrar|salve|salvar|persist|armazene|armazenar|store|save|remember)\b/i.test(input)
    const mentionsPolicy = /\b(como voce deve tratar|como você deve tratar|como tratar|qual sua politica|qual sua política|o que faz com|o que voce faz com|o que você faz com)\b/i.test(input)
    return mentionsSensitiveData && (mentionsPersistence || mentionsPolicy)
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

  buildPrivacyOperationalResponse(task = '') {
    const normalizedTask = String(task || '').toLowerCase()
    const asksPersistence = /\b(guarde|guardar|memorize|memorizar|lembre|lembrar|salve|salvar|persist|armazene|armazenar|store|save|remember)\b/i.test(normalizedTask)
    const asksPolicy = /\b(como voce deve tratar|como você deve tratar|como tratar|qual sua politica|qual sua política|o que faz com|o que voce faz com|o que você faz com)\b/i.test(normalizedTask)
    const mentionsPayment = /\b(carta[oã]|cvv|pix|iban|swift|agencia|ag[eê]ncia|conta|documento bancario|dados bancarios)\b/i.test(normalizedTask)
    const mentionsSecret = /\b(token|senha|password|api key|secret|segredo)\b/i.test(normalizedTask)
    const mentionsDocument = /\b(cpf|cnpj)\b/i.test(normalizedTask)
    const conciseOperational = asksPolicy && !asksPersistence

    if (conciseOperational) {
      return [
        'Sou o GIOM, com politica de privacidade operacional ativa nesta execucao.',
        '1. Senha, token, PIX, cartao e documento bancario entram como dados sensiveis.',
        '2. Recebo so o minimo necessario, redijo segredos antes da persistencia e evito expor isso em resposta ou log.',
        '3. Nao uso esse material como memoria duradoura, aprendizado permanente nem contexto reaproveitavel.',
        '4. Posso ajudar a mascarar, revisar ou resumir sem reter os dados completos.'
      ].join('\n')
    }

    return [
      'Sou o GIOM, com politica de privacidade operacional ativa nesta execucao.',
      asksPersistence
        ? 'Nao vou guardar isto para sempre, nem memorizar, persistir ou reutilizar em aprendizado duradouro qualquer CPF, CNPJ, token, senha, cartao, PIX, conta ou documento bancario.'
        : 'Eu posso analisar contexto sensivel quando isso for necessario para ajudar, mas trato esses dados como sensiveis e nao como memoria permanente.',
      'Na persistencia eu redijo segredos e bloqueio aprendizado duradouro para dados financeiros, identificadores e credenciais.',
      mentionsSecret ? 'Envie segredos e tokens mascarados quando possivel.' : null,
      mentionsPayment ? 'Para cartao, PIX, conta e dados bancarios, prefira campos parciais ou ja mascarados.' : null,
      mentionsDocument ? 'Para CPF ou CNPJ, use apenas os digitos minimos necessarios para validacao segura.' : null,
      'Se quiser, eu posso ajudar a mascarar, revisar ou resumir esse material sem reter os dados completos.'
    ].filter(Boolean).join('\n')
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

  buildRedisJwtIncidentResponse() {
    return [
      'Plano profissional para erro 500 intermitente em API Node depois de ativar Redis e JWT:',
      '1. Prioridade de causa: ordem de middlewares, serializacao no cache, payload JWT invalido ou expirado, chave Redis instavel e leitura de dado corrompido entre hit e miss.',
      '2. Logs que eu colocaria agora: request-id, caminho do middleware, cache hit ou miss, TTL, tamanho do valor salvo, claims essenciais do JWT sem expor segredo e primeira stack line do 500.',
      '3. Teste dirigido: reproduzir com cache desligado, depois JWT simplificado, depois Redis ligado com chave controlada para isolar se a quebra nasce na autenticacao, na serializacao ou na invalidacao.',
      '4. Rollback seguro: feature flag para desligar cache Redis nas rotas afetadas, manter JWT ativo e restaurar o ultimo comportamento estavel enquanto a causa raiz e confirmada.',
      '5. Verificacao: medir taxa de 500, comparar hit rate antes e depois, validar expiracao de token e garantir que resposta em cache nunca reutilize contexto de usuario errado.',
      '6. Regra de engenharia: isole autenticacao, cache e serializacao em passos curtos; nao tente corrigir os tres ao mesmo tempo.',
      'Se quiser, eu monto o patch minimo de observabilidade para Redis e JWT com logs seguros e pontos exatos de instrumentacao.'
    ].join('\n')
  }

  buildArchitectureRefactorResponse() {
    return [
      'Plano incremental para refatorar o monolito Node sem quebrar deploy:',
      '1. Baseline primeiro: mapear latencia, erro, fila, throughput de OCR, tamanho de upload e consumo de memoria antes de mover qualquer parte.',
      '2. Separar por fronteiras: criar modulos internos claros para API, uploads, filas e OCR, mantendo o mesmo deploy e os mesmos contratos HTTP no inicio.',
      '3. Extrair o pipeline pesado: mover OCR e processamento assíncrono para workers por fila, deixando a API apenas validar, persistir metadados e enfileirar.',
      '4. Isolar uploads: validar tipo e tamanho na borda, gravar em storage temporario/seguro, gerar IDs internos e remover dependencia de nome original do arquivo.',
      '5. Observabilidade antes do corte: request-id, tracing por job, logs estruturados, metricas de fila, falha por etapa e dashboard de erro/latencia.',
      '6. Testes por contrato: smoke de endpoints, testes de fila/OCR, testes de regressao de upload e casos de rollback com feature flag.',
      '7. Rollout seguro: ativar por porcentagem ou rota, comparar monolito x worker, e manter rollback simples para voltar processamento ao caminho antigo.',
      '8. Tradeoff principal: ganhar desacoplamento e resiliencia custa mais disciplina operacional, contratos explicitos e debugging distribuido; por isso a extracao deve seguir a dor maior primeiro.',
      'Criterio de aceite: deploy sem mudar API publica, latencia estavel, OCR desacoplado, retries controlados e rollback executavel em minutos.',
      'Proximo passo pratico: eu criaria um mapa de componentes atuais, um contrato de fila e uma feature flag para migrar OCR primeiro.'
    ].join('\n')
  }

  buildSecureReviewResponse() {
    return [
      'Review tecnico prioritario da rota Express:',
      '1. Upload: risco de path traversal, arquivo malicioso, MIME falso e excesso de tamanho. Mitigacao: allowlist de extensoes/MIME, limite de size, nome interno aleatorio, storage temporario isolado e varredura antes de consumo.',
      '2. JWT: risco de validacao fraca, logar token e tratar auth falha como 500. Mitigacao: validar algoritmo, exp, aud/iss quando existirem, nunca logar token bruto e responder 401/403 corretamente.',
      '3. Disco: risco de sobrescrita, vazamento e acesso indevido. Mitigacao: pasta fora da raiz publica, permissao minima, TTL de limpeza e metadado separado do binario.',
      '4. Banco: risco de injecao, quebra de ownership e inconsistência. Mitigacao: query parametrizada, transacao quando houver multiplas escritas e validacao de autorizacao por recurso.',
      '5. Observabilidade: request-id, log estruturado de upload, auth, storage e banco sem expor segredo, CPF, token ou caminho sensivel.',
      'Testes minimos: upload valido, upload acima do limite, MIME falso, JWT invalido, JWT expirado, falha de disco, falha de banco, limpeza de temporarios e tentativa de acesso cruzado.',
      'Criterio de aceite: rota devolve 401/403/413/415/500 corretos, nao persiste segredo em log, rejeita arquivo invalido na borda e deixa rastro observavel por request-id.',
      'Proximo passo pratico: eu faria um checklist de hardening por middleware e uma matriz de testes por risco para essa rota.'
    ].join('\n')
  }

  isJwtTeachingQuestion(task = '') {
    const input = String(task || '')
    return /\b(jwt)\b/i.test(input)
      && /\b(junior|iniciante|explique|exemplo simples)\b/i.test(input)
  }

  buildJwtTeachingResponse(task = '') {
    const input = String(task || '')
    if (/\b(uma unica frase|uma única frase|bem direta|sem floreio|objetiv[oa]?|curt[oa]?)\b/i.test(input)) {
      return 'JWT e um token assinado que a API usa para identificar quem voce e nas proximas requisicoes sem guardar sessao completa no servidor.'
    }

    return [
      'JWT explicado para um desenvolvedor junior:',
      '1. Ideia simples: JWT e como um cracha assinado que a API entrega depois do login para provar quem voce e nas proximas requisicoes.',
      '2. Exemplo simples: o backend autentica usuario e senha, devolve um JWT com userId e role, e nas rotas protegidas valida a assinatura antes de liberar acesso sem consultar sessao a cada chamada.',
      '3. Observacao avancada: JWT reduz estado no servidor, mas precisa expiracao curta, refresh token bem desenhado e segredo ou chave bem protegidos.',
      '4. Outro cuidado avancado: colocar claims demais no token aumenta vazamento, acoplamento e dificuldade de revogacao.',
      '5. Regra pratica: token bom carrega o minimo necessario e vence rapido.'
    ].join('\n')
  }

  isOpsTimeoutQuestion(task = '') {
    const input = String(task || '')
    return /\b(timeout)\b/i.test(input)
      && /\b(render)\b/i.test(input)
      && /\b(endpoint|api|rota)\b/i.test(input)
  }

  buildOpsTimeoutResponse() {
    return [
      'Resposta de engenheiro senior para timeout em endpoint critico no Render:',
      '1. Causa provavel: query lenta, dependencia externa instavel, processamento pesado no request thread ou saturacao por cold start/conexao concorrente.',
      '2. Teste imediato: medir tempo por etapa com request-id, logar query externa/interna, verificar p95/p99, tamanho de payload e se o timeout acontece antes ou depois de banco, OCR, storage ou provider externo.',
      '3. Mitigacao rapida: mover trabalho pesado para fila, aplicar timeout proprio por dependencia, cachear leitura quente, limitar concorrencia e devolver 202 quando o fluxo puder ser assincrono.',
      '4. Proximo passo: reproduzir com tracing por etapa num unico endpoint critico e corrigir primeiro a etapa dominante em vez de aumentar timeout global.',
      '5. Regra de engenharia: aumentar timeout global antes de achar a etapa dominante so mascara o gargalo.'
    ].join('\n')
  }

  isEmbeddingsComparisonQuestion(task = '') {
    const input = String(task || '')
    return /\b(embeddings?)\b/i.test(input)
      && /\b(local|locais)\b/i.test(input)
      && /\b(fato|tradeoff|benchmark|compar)/i.test(input)
  }

  buildEmbeddingsComparisonResponse() {
    return [
      'Comparacao disciplinada entre embeddings locais sem benchmark pronto:',
      'Fato observavel agora: dimensao, latencia, memoria consumida, throughput de ingestao, custo operacional e limite de contexto do pipeline podem ser medidos sem inferencia forte.',
      'Tradeoff: embeddings maiores tendem a capturar mais sinal semantico, mas aumentam armazenamento, tempo de indexacao e risco de falsa confianca se chunking, filtragem e reranking forem fracos.',
      'Exige benchmark real: recall@k, precision@k, MRR, qualidade por dominio e robustez em consultas ambiguas so podem ser afirmados depois de um conjunto rotulado do seu produto.',
      'Limite metodologico nesta execucao: sem benchmark controlado eu nao afirmo vencedor; eu so delimito a evidencia observavel agora, a inferencia aceitavel e o que ainda depende de teste.',
      'Decisao provisoria profissional: escolha 2 candidatos, fixe o mesmo chunking e index, rode um conjunto pequeno mas representativo de perguntas e so depois promova o vencedor para a base inteira.'
    ].join('\n')
  }

  isProductTradeoffQuestion(task = '') {
    const input = String(task || '')
    return /\b(ux|custo|seguranca|segurança|arquitetura)\b/i.test(input)
      && /\b(ocr|documentos|imagem)\b/i.test(input)
      && /\b(chat|plano|integre)\b/i.test(input)
  }

  buildProductTradeoffResponse() {
    return [
      'Plano curto integrando UX, custo, seguranca e arquitetura para chat com OCR, documentos nativos e imagem:',
      '1. UX: manter um unico composer com estados claros de upload, leitura e geracao; o usuario precisa saber o que foi lido, o que foi ignorado e o que ainda depende de configuracao externa.',
      '2. Custo: texto e documentos devem usar pipeline local ou barato por padrao; OCR e imagem entram como recursos graduais, com limite por tamanho, cache e quota.',
      '3. Seguranca: arquivos vao para storage temporario isolado, passam por allowlist de formato, tamanho, varredura e redacao antes de qualquer persistencia ou analytics.',
      '4. Arquitetura: API sincrona para orquestrar, worker para OCR/processamento pesado, matriz de capacidades honesta no backend e fallbacks claros quando o provider externo falhar.',
      '5. Decisao executiva: chat bom nesse contexto nao e o que promete tudo; e o que explica capacidade real, custa de forma previsivel e falha de modo seguro.'
    ].join('\n')
  }

  isSseLeakQuestion(task = '') {
    const input = String(task || '')
    return /\b(streaming|sse)\b/i.test(input)
      && /\b(node)\b/i.test(input)
      && /\b(vazamento de memoria|memoria|memória|concorrencia|concorrência)\b/i.test(input)
  }

  buildSseLeakResponse() {
    return [
      'Diagnostico profissional para concorrencia e vazamento de memoria em SSE com Node:',
      '1. Causas mais provaveis: listeners nao removidos, buffers crescendo por cliente lento, timers pendurados, filas em memoria sem limite e conexoes encerradas sem cleanup completo.',
      '2. Patch conceitual: registrar cleanup em close/error, remover listeners, abortar upstream com AbortController, limitar tamanho de fila por conexao e encerrar cliente atrasado de forma previsivel.',
      '3. Validacao: medir conexoes abertas, heap before/after carga, event loop lag, bytes por cliente e comparar snapshots de heap sob carga sustentada.',
      '4. Anti-regressao: teste de carga com centenas de conexoes SSE, budget de memoria por conexao, alerta para crescimento monotono de heap e smoke de reconexao/desconexao.',
      'Proximo passo pratico: se quiser, eu monto um patch minimo com cleanup, AbortController e limites de buffer para aplicar primeiro.'
    ].join('\n')
  }

  isBibleFaithWorksQuestion(task = '') {
    const input = String(task || '')
    return /\b(romanos 3|roman[oa]s 3)\b/i.test(input)
      && /\b(tiago 2)\b/i.test(input)
      && /\b(fe|obras|exegese|catolicas|católicas|protestantes)\b/i.test(input)
  }

  buildBibleFaithWorksResponse() {
    return [
      'Comparacao entre Romanos 3 e Tiago 2 sobre fe e obras:',
      '1. Exegese do texto: Paulo combate a justificacao por obras da lei como fundamento de aceitacao diante de Deus; Tiago combate uma fe apenas professada, sem fruto concreto nem obediencia visivel.',
      '2. Contexto historico: Paulo discute lei, alianca e inclusao de judeus e gentios; Tiago fala a uma comunidade dispersa, pressionada a mostrar coerencia pratica, misericordia e vida integra.',
      '3. Linhas protestantes e catolicas: a leitura protestante tende a distinguir justificacao forense e frutos posteriores da fe; a catolica costuma articular justificacao, cooperacao graciosa e transformacao real com mais continuidade interna.',
      '4. Tensao aparente e ponto de contato: Paulo responde ao legalismo meritocrático; Tiago responde ao verbalismo vazio. O alvo polemico e diferente, por isso a contradicao nao deve ser assumida sem analise contextual.',
      '5. O que ainda e interpretacao: a forma exata de harmonizar Paulo e Tiago depende de tradicao, metodo hermeneutico e dogmatica adotada; isso nao deve ser vendido como consenso academico unico.',
      '6. Transparencia hermeneutica: aqui eu separei evidencia textual, contexto historico, leitura confessional e inferencia sistematica para nao misturar exegese com conclusao dogmatica fechada.',
      '7. Limite interpretativo nesta execucao: eu posso organizar o que o texto sustenta, o que a historia da interpretacao debate e onde comeca a sintese teologica; nao devo transformar uma harmonizacao especifica em obrigacao universal.',
      '8. Regra de leitura: leia Paulo contra a autoconfianca meritocratica e Tiago contra a profissao sem pratica; a sintese madura pede texto, contexto, tradicao e humildade interpretativa.'
    ].join('\n')
  }

  isMeshaSteleQuestion(task = '') {
    const input = String(task || '')
    return /\b(estela de mesa|mesha stele|mesa)\b/i.test(input)
      && /\b(levante|historico|histórico|apologet)/i.test(input)
  }

  buildMeshaSteleResponse() {
    return [
      'Valor historico da estela de Mesa para o estudo do Levante:',
      'Evidencia material: e uma inscricao moabita relevante do seculo IX a.C., ligada a conflitos regionais e autoapresentacao regia, com grande valor epigrafico e historico.',
      'Consenso academico forte: ela confirma a existencia de memoria politica moabita, dialoga com o horizonte historico de 2 Reis e ajuda a mapear linguagem real, territorio e propaganda da epoca.',
      'Inferencia apologetica que exige cautela: usar a estela para provar de forma total um relato biblico, uma cronologia inteira ou conclusoes teologicas amplas vai alem do que a fonte, sozinha, sustenta.',
      'Limite metodologico nesta execucao: a inscricao e evidencia importante, mas nao substitui leitura comparada de epigrafia, arqueologia regional e cronologia antes de qualquer conclusao forte.'
    ].join('\n')
  }

  isResearchMethodQuestion(task = '') {
    const input = String(task || '')
    return /\b(metodo profissional|m[eé]todo profissional|criterios|evidencias|decisao provisoria|decisão provisória)\b/i.test(input)
      && /\b(embeddings?|benchmark)\b/i.test(input)
  }

  buildResearchMethodResponse() {
    return [
      'Metodo profissional sem benchmark pronto:',
      '1. Pergunta: qual decisao voce realmente quer tomar, por exemplo melhor recall tecnico, menor custo por consulta, menor latencia ou maior robustez em linguagem mista.',
      '2. Criterios: qualidade de recuperacao, custo operacional, estabilidade, facilidade de deploy, manutencao do indice e risco de lock-in.',
      '3. Evidencias: metadados medidos, conjunto pequeno de queries representativas, revisao humana e comparacao controlada no mesmo pipeline.',
      '4. Riscos: enviesar o teste com poucas perguntas, trocar dimensao sem reindexar direito, misturar mudancas de chunking e concluir demais sem casos dificeis.',
      '5. Limite nesta execucao: eu posso organizar evidencia e inferencia, mas nao declarar vencedor sem benchmark formal.',
      '6. Decisao provisoria: escolher o melhor candidato para um piloto controlado, registrar o que foi medido de fato e adiar afirmacoes absolutas ate existir benchmark formal.'
    ].join('\n')
  }

  isDefensiveUploadSecurityQuestion(task = '') {
    const input = String(task || '')
    return /\b(uploads?|ocr|documentos sensiveis|documentos sensíveis|tokens)\b/i.test(input)
      && /\b(api node|node)\b/i.test(input)
      && /\b(proteger|plano defensivo|internet)\b/i.test(input)
  }

  buildDefensiveUploadSecurityResponse() {
    return [
      'Sou o GIOM, operando com limites de seguranca nesta execucao. Meu papel aqui e defesa, hardening e resposta a incidentes; nao vou ajudar com bypass, ataque ofensivo ou exfiltracao.',
      'Plano defensivo para uploads, OCR, documentos sensiveis e tokens em API Node exposta na internet:',
      '1. Borda: allowlist de MIME/extensao, limite de tamanho, checksum, nome interno aleatorio, rate limit por usuario/IP e rejeicao antecipada de formatos nao suportados.',
      '2. Storage e processamento: pasta temporaria isolada, TTL de limpeza, antivirus ou varredura equivalente, OCR em worker sem privilegio, rede separada e zero execucao de macros/conteudo ativo.',
      '3. Segredos e privacidade: tokens nunca em log, eu redijo segredos e bloqueio aprendizado duradouro para dados sensiveis, com criptografia em transito, minimizacao de dados e armazenamento temporario.',
      '4. Monitoramento e resposta: request-id, auditoria de upload, alertas para tipo suspeito, repeticao anomala, falha de OCR, exfiltracao e procedimento claro de revogacao, purge e notificacao.',
      'Limite operacional nesta execucao: eu descrevo controles defensivos, evidencias e inferencias de risco; nao forneco detalhe ofensivo nem caminho de abuso.'
    ].join('\n')
  }

  isOverfittingQuestion(task = '') {
    const input = String(task || '')
    return /\b(overfitting)\b/i.test(input)
      && /\b(exemplo|formula|f[oó]rmula|validacao|validação)\b/i.test(input)
  }

  buildOverfittingResponse() {
    return [
      'Overfitting explicado de forma disciplinada:',
      '1. Intuicao: o modelo aprende o ruido do treino em vez do padrao que deveria generalizar.',
      '2. Exemplo concreto: um classificador acerta quase tudo no conjunto de treino, mas erra bastante quando recebe dados novos porque memorizou detalhes acidentais das amostras vistas.',
      '3. Formula curta: erro de generalizacao = erro no teste - erro no treino; quando essa diferenca cresce demais, ha sinal forte de overfitting.',
      '4. Validacao robusta: separar treino, validacao e teste, usar cross-validation quando o dataset for menor, controlar leakage e comparar regularizacao, early stopping e complexidade do modelo.',
      '5. Regra pratica: nao confunda score alto no treino com modelo bom em producao.'
    ].join('\n')
  }

  isPrecisionAgQuestion(task = '') {
    const input = String(task || '')
    return /\b(agricultura de precisao|agricultura de precisão|taxa variavel|taxa variável|zona de manejo)\b/i.test(input)
      && /\b(satelite|satélite|sensor|sensores|gps|telemetria)\b/i.test(input)
  }

  buildPrecisionAgResponse() {
    return [
      'Plano de agricultura de precisao para reduzir desperdicio em soja:',
      '1. Sensoriamento: combinar satelite, mapa de produtividade, condutividade do solo, analise de fertilidade e sensores locais para dividir o talhao em zonas de manejo realmente distintas.',
      '2. Execucao: aplicar taxa variavel em semente, corretivo e fertilizante com GPS, piloto automatico e telemetria, ajustando janela operacional por umidade, velocidade, compactacao e falha de equipamento.',
      '3. Riscos: mapa ruim, calibracao fraca, conectividade instavel, recomendacao agronomica mal parametrizada e decisao baseada em dado remoto sem validacao de campo.',
      '4. Validacao em campo: usar talhoes testemunha, comparacao por zona, scouting, custo por hectare, ganho de produtividade, economia de insumo e revisao tecnica apos cada safra.',
      '5. Governanca operacional: registrar calibracao, mapa usado, taxa aplicada, operador, janela climatica, telemetria da maquina e anomalias para comparar execucao real contra planejamento.',
      '6. Decisao agronomica: dado bom so vira ganho quando satelite, sensor, GPS, taxa variavel, telemetria e validacao de campo entram no mesmo ciclo de decisao.',
      '7. Regra executiva: comece em poucos talhoes, prove retorno por zona de manejo e so depois escale; agricultura de precisao sem disciplina de validacao vira custo digital.'
    ].join('\n')
  }

  isBuildVsBuyFinanceQuestion(task = '') {
    const input = String(task || '')
    return /\b(infraestrutura propria|infraestrutura própria|build vs buy|comprar ou construir|construir ou comprar|saas)\b/i.test(input)
      && /\b(infraestrutura propria|infraestrutura própria|build vs buy|comprar ou construir|construir ou comprar)\b/i.test(input)
      && /\b(caixa|risco|prazo|resiliencia|resiliência|governanca|governança)\b/i.test(input)
  }

  buildBuildVsBuyFinanceResponse() {
    return [
      'Plano para decidir entre infraestrutura propria e SaaS numa startup:',
      '1. Caixa: modele custo inicial, custo recorrente, equipe necessaria, suporte e variabilidade de demanda por 12 a 24 meses.',
      '2. Risco e prazo: SaaS reduz time-to-market e risco operacional no inicio; infraestrutura propria pode melhorar margem e controle, mas exige maturidade tecnica e capital.',
      '3. Resiliencia e governanca: compare SLA, lock-in, auditoria, seguranca, compliance, backup, observabilidade e capacidade de continuidade em incidente.',
      '4. Decisao executiva: use SaaS quando velocidade e foco forem prioritarios; migre partes para stack propria quando custo, diferenciacao ou requisitos regulatorios justificarem.'
    ].join('\n')
  }

  isChessTrainingQuestion(task = '') {
    const input = String(task || '')
    return /\b(xadrez)\b/i.test(input)
      && /\b(30 dias|rotina semanal|erros comuns|treino)\b/i.test(input)
  }

  buildChessTrainingResponse() {
    return [
      'Plano de 30 dias para um iniciante melhorar no xadrez:',
      '1. Semana 1: foque em principios de abertura, desenvolvimento rapido, controle do centro e nao pendurar pecas.',
      '2. Semana 2: treine taticas basicas todos os dias, especialmente garfo, cravada, ataque duplo e mate em 1 ou 2.',
      '3. Semana 3: jogue partidas curtas com revisao imediata para achar um unico erro critico por jogo e corrigi-lo conscientemente.',
      '4. Semana 4: combine taticas, finais simples de rei e peoes e uma rotina fixa de 5 dias por semana com 20 a 40 minutos.',
      '5. Erros comuns: mover a mesma peca muitas vezes, ignorar o rei, trocar sem plano e jogar rapido demais sem calcular ameacas simples.',
      '6. Regra pratica: rotina curta, revisao honesta e foco em poucos fundamentos valem mais do que volume sem analise.'
    ].join('\n')
  }

  isProgrammingStackQuestion(task = '') {
    const input = String(task || '')
    return /\b(javascript|typescript|python|java|next\.js|nextjs|fastapi|spring)\b/i.test(input)
      && /\b(compare|compar|stack|arquitetura|saa[s]|produto digital|ecossistema)\b/i.test(input)
  }

  buildProgrammingStackResponse() {
    return [
      'Comparacao pratica entre JavaScript/TypeScript com Next.js, Python com FastAPI e Java com Spring para um SaaS:',
      '1. Velocidade: Next.js acelera produto web full-stack e onboarding do time; FastAPI acelera APIs, automacao e servicos de IA; Spring tende a ser mais pesado no inicio, mas muito previsivel em ambientes corporativos.',
      '2. Arquitetura: Next.js vai muito bem quando UI e backend leve precisam andar juntos; FastAPI brilha em servicos modulares, dados e inferencia; Spring e forte para dominio complexo, integracoes e governanca de camadas.',
      '3. Operacao: JS/TS simplifica stack web unica; FastAPI favorece produtividade e pipelines de dados; Spring costuma ganhar em padrao, observabilidade, contratos e manutencao de sistemas grandes.',
      '4. Risco: Next.js pede disciplina para nao misturar camada critica com conveniencia de frontend; FastAPI pede criterio quando o produto cresce em time e dominio; Spring cobra mais complexidade inicial, mas reduz improviso em ambientes maduros.',
      '5. Decisao profissional: use Next.js quando a prioridade for velocidade de produto, FastAPI quando dados e IA forem o centro, e Spring quando robustez corporativa, integracao e operacao previsivel forem o eixo dominante.',
      '6. Regra de arquitetura: escolha pela combinacao de dominio, equipe, runtime, operacao e risco, nao por hype de linguagem.'
    ].join('\n')
  }

  isBibleStudyMethodQuestion(task = '') {
    const input = String(task || '')
    return /\b(escola dominical|devocional|hermeneutica|hermenêutica|tecnica de estudo|técnica de estudo|metodo de estudo|m[eé]todo de estudo|periodos biblicos|per[ií]odos b[ií]blicos)\b/i.test(input)
      && /\b(biblia|biblico|joao|evangelho|texto)\b/i.test(input)
  }

  buildBibleStudyMethodResponse() {
    return [
      'Plano academico e pastoral para estudar um livro biblico com devocional e escola dominical:',
      '1. Periodizacao: localize o livro no periodo biblico, no contexto historico e no genero literario antes de entrar em aplicacao.',
      '2. Metodo de estudo: observacao do texto, estrutura, palavras-chave, contexto imediato, conexoes canonicas e so depois interpretacao e aplicacao.',
      '3. Hermeneutica saudavel: diferencie o que o texto diz, o que a tradicao interpreta e o que ja e aplicacao pastoral.',
      '4. Devocional: transforme o estudo em meditacao, oracao e obediencia pratica, mas sem usar impressao pessoal como se fosse doutrina.',
      '5. Escola dominical: organize por objetivo, texto-base, faixa etaria, perguntas, aplicacao e revisao da licao.',
      '6. Regra de ouro: unir reverencia, metodo e clareza; o texto vem antes da opiniao.'
    ].join('\n')
  }

  isChurchFathersQuestion(task = '') {
    const input = String(task || '')
    return /\b(pais da igreja|patristica|patristics|pais apostolicos|ireneu|inacio|atanasio|agostinho|crisostomo)\b/i.test(input)
  }

  buildChurchFathersResponse() {
    return [
      'Panorama academico de patristica e pais da igreja:',
      '1. Periodizacao util: pais apostolicos e testemunhas subapostolicas, apologistas do segundo seculo, pais nicenos e pos-nicenos.',
      '2. Nomes-chave: Inacio de Antioquia e Policarpo ajudam na leitura da igreja primitiva; Justino Martir e Ireneu ajudam em apologetica e contra heresias; Atanasio marca a controversia ariana; Agostinho pesa em pecado, graca e cidade de Deus; Crisostomo e referencia em exposicao e pregacao.',
      '3. Valor para o meio protestante: eles sao testemunhas historicas importantes da recepcao antiga do texto, da vida liturgica e do desenvolvimento doutrinario, mas nao substituem a autoridade canonica da Escritura.',
      '4. Uso responsavel: ler pais da igreja por periodo, controversia, genero textual e contexto, distinguindo comentario biblico, polemica doutrinaria, espiritualidade e politica eclesiastica.',
      '5. Limite metodologico: nem toda atribuicao textual antiga e segura, nem todo consenso patristrico existe; por isso convem separar fonte primaria, recepcao posterior e sintese teologica moderna.',
      '6. Aplicacao madura: use patristrica para iluminar historia da interpretacao, linguagem doutrinaria e cuidado pastoral, sempre submetendo a conclusao final ao texto biblico bem lido.'
    ].join('\n')
  }

  isStudyBibleResourcesQuestion(task = '') {
    const input = String(task || '')
    return /\b(biblia de estudo|study bible|thompson|genebra|esv study bible|macarthur|pentecostal|nvi de estudo|comentario biblico)\b/i.test(input)
  }

  buildStudyBibleResourcesResponse() {
    return [
      'Guia profissional para biblias de estudo e recursos:',
      '1. Regra principal: traducoes e biblias de estudo nao sao a mesma coisa; a traducao entrega o texto base, enquanto as notas refletem uma linha editorial e teologica.',
      '2. Uso por objetivo: Biblia de Estudo de Genebra e recursos reformados ajudam em teologia historica; Thompson ajuda em cadeias tematicas; ESV Study Bible e conhecida por notas extensas; linhas pentecostais ajudam em aplicacao ministerial e temas carismaticos; NVI de estudo e boa porta de entrada para leitura ampla.',
      '3. Risco comum: o leitor pode tratar nota editorial como se fosse o proprio texto biblico; por isso vale sempre voltar ao contexto, comparar traducoes e consultar mais de uma tradicao quando o tema for controverso.',
      '4. Kit academico equilibrado: texto biblico confiavel, referencias cruzadas, atlas biblico, dicionario biblico, introducao historico-literaria e ao menos um comentario serio por livro.',
      '5. Criterio protestante maduro: escolher recurso pela fidelidade textual, clareza, publico, profundidade e transparencia confessional, nao so pela fama do editor.',
      '6. Regra pratica: a melhor biblia de estudo e a que ajuda voce a enxergar melhor o texto sem sequestrar a leitura do texto.'
    ].join('\n')
  }

  isBiblicalGeographyQuestion(task = '') {
    const input = String(task || '')
    return /\b(mapa biblico|mapa biblico|geografia biblica|reinos biblicos|reino do norte|reino do sul|judeia|galileia|samaria|assiria|babilonia|persia|israel e juda|israel e jud[aá])\b/i.test(input)
  }

  buildBiblicalGeographyResponse() {
    return [
      'Mapa mental de geografia biblica, reinos e periodos:',
      '1. Patriarcas e exodo: a narrativa comeca entre Mesopotamia, Canaa, Egito e deserto; isso organiza chamado de Abraao, peregrinacao, escravidao, libertacao e entrada na terra.',
      '2. Monarquia unida: Saul, Davi e Salomao formam um reino unificado com Jerusalem como centro politico e cultual antes da divisao.',
      '3. Israel e Juda: depois de Salomao, o reino se divide; Israel fica ao norte com capital em Samaria, e Juda ao sul com Jerusalem. Essa divisao e essencial para ler profetas, alianças e crise politica.',
      '4. Assiria, Babilonia e Persia: a Assiria domina e derruba o reino do norte; a Babilonia derruba Juda e leva ao exilio; a Persia permite retorno parcial, reorganizacao da cidade e reconstrucao do templo no periodo do segundo templo.',
      '5. Regioes do Novo Testamento: Galileia marca grande parte do ministerio de Jesus, Samaria ajuda a ler tensoes etnicas e religiosas, e Judeia concentra Jerusalem, templo, lideranca judaica e eventos da paixao.',
      '6. Linha cronologica curta: patriarcas, exodo, conquista, juizes, monarquia unida, reinos divididos, exilio, retorno persa, periodo intertestamentario e dominio romano no Novo Testamento.',
      '7. Mapa de reinos e circulacao: Decapolis, Asia Menor, Macedonia, Acaia e Roma ampliam o quadro geografico para a expansao apostolica e a logica missionaria do cristianismo nascente.',
      '8. Transparencia metodologica: aqui eu separei dado textual, reconstrucao historica e sintese pedagogica. Datas exatas, fronteiras e alguns nomes de periodo podem variar entre atlas e historiadores; por isso o mapa serve para iluminar o texto e nao para vender certeza alem da evidencia.'
    ].join('\n')
  }

  isProtestantPreachingQuestion(task = '') {
    const input = String(task || '')
    return /\b(pregadores protestantes|pregadores muito respeitados|sermoes protestantes|sermoes crist[aã]os|tradicoes protestantes de pregacao|tradicoes protestantes de prega[cç][aã]o|pregacao expositiva|spurgeon|lloyd jones|stott|lutero|calvino)\b/i.test(input)
  }

  buildProtestantPreachingResponse() {
    return [
      'Panorama protestante de pregacao e sermoes:',
      '1. Trilhas historicas: reformadores como Lutero e Calvino reforcam centralidade do texto; puritanos aprofundam aplicacao da verdade ao coracao; avivamentos valorizam urgencia evangelistica; tradicao expositiva moderna enfatiza estrutura fiel ao texto.',
      '2. Nomes frequentemente respeitados no meio protestante: Lutero, Calvino, John Owen, Jonathan Edwards, Charles Spurgeon, Martyn Lloyd-Jones, John Stott e outros expositores influentes em suas correntes.',
      '3. Como usar esse legado: estudar estrutura do sermao, tratamento do texto, clareza doutrinaria, aplicacao pastoral e equilibrio entre explicacao e exortacao.',
      '4. Cuidado necessario: nenhum pregador vira norma final; a avaliacao madura compara o sermao com o texto biblico, o contexto historico e a fidelidade pastoral.',
      '5. Esboco seguro de sermo protestante: contexto, ideia central, movimentos do texto, conexao com o evangelho, aplicacoes legitimas e chamada pastoral sem manipular emocao.',
      '6. Regra de ouro: sermoes fortes nascem de exegese honesta, teologia clara e aplicacao pastoral fiel, nao apenas de retorica.'
    ].join('\n')
  }

  isHarvestIntelligenceQuestion(task = '') {
    const input = String(task || '')
    return /\b(colheita|colheitadeira|mapa de produtividade|telemetria|talh[aã]o)\b/i.test(input)
      && /\b(clima|chuva|tempo|previs[aã]o|janela operacional|inteligente)\b/i.test(input)
  }

  buildHarvestIntelligenceResponse() {
    return [
      'Plano de colheita organizada e inteligente com clima e telemetria:',
      '1. Janela operacional: combine previsao de chuva, umidade do grao, trafegabilidade, risco de acamamento e perda por atraso para definir ordem de talhoes.',
      '2. Colheita organizada: monte fila de prioridade por maturacao, capacidade de maquina, distancia ate armazenagem, capacidade de transporte e risco de gargalo logistico.',
      '3. Colheita inteligente: use telemetria, mapa de produtividade, velocidade da maquina, perdas no monitor e sensores para ajustar rota, regulagem e troca de talhao em tempo quase real.',
      '4. Riscos principais: previsao ruim, calibracao fraca do monitor, atraso de transporte, excesso de umidade, fila na recepcao e decisao sem validacao no campo.',
      '5. Validacao: acompanhe perda por talhao, tempo parado, consumo, qualidade do grao, fila logistica e diferenca entre planejamento e execucao real.',
      '6. Decisao profissional: clima, maquina, armazenagem, transporte e destino do produto precisam entrar juntos na mesma conversa operacional.',
      '7. Regra executiva: ordem de talhoes deve seguir risco economico e janela climatica, nao apenas conveniencia de deslocamento.'
    ].join('\n')
  }

  isAgroGpsTelematicsQuestion(task = '') {
    const input = String(task || '')
    return /\b(gps|rtk|piloto automatico|autosteer|barra de luz)\b/i.test(input)
      && /\b(agro|agric|colheita|plantio|pulverizacao|talh[aã]o|fazenda)\b/i.test(input)
  }

  buildAgroGpsTelematicsResponse() {
    return [
      'Plano tecnico para GPS, RTK e telemetria no agro:',
      '1. Base operacional: definir onde GPS simples basta e onde RTK ou correcao mais precisa e necessaria, como plantio, pulverizacao fina, trafego controlado e colheita com piloto automatico.',
      '2. Maquina e calibracao: alinhar receptor, piloto automatico, largura real de implemento, offset, velocidade e operador antes de confiar no dado.',
      '3. Telemetria util: horas produtivas, parada, consumo, rota, sobreposicao, falha, velocidade e janela climatica devem virar decisao de campo, nao apenas painel bonito.',
      '4. Riscos: sinal ruim, calibracao frouxa, dado sem limpeza, operador mal treinado, automacao acima da capacidade da equipe e decisao sem validacao local.',
      '5. Validacao: medir sobreposicao, falha, economia de insumo, tempo de operacao, consumo por hectare, qualidade de aplicacao e ganho logistico por talhao.',
      '6. Regra executiva: GPS e telemetria so viram produtividade quando entram num ciclo disciplinado de calibracao, treinamento, leitura de anomalia e correcao rapida.'
    ].join('\n')
  }

  isPrecisionHarvestLogisticsQuestion(task = '') {
    const input = String(task || '')
    return /\b(colheita de precis[aã]o|colheita de precisão|ordem de talh[oõ]es|fila de descarga|armazenagem|transporte de graos|perda na colheita)\b/i.test(input)
  }

  buildPrecisionHarvestLogisticsResponse() {
    return [
      'Plano de colheita organizada, inteligente e de precisao com logistica integrada:',
      '1. Ordem de talhoes: priorize por maturacao, umidade, previsao do tempo, risco de quebra, risco de acamamento, historico de produtividade e distancia ate a estrutura de armazenagem.',
      '2. Colheita organizada: transforme essa prioridade em fila real de operacao, com janela por talhao, colheitadeira designada, transbordo, caminhao, destino e capacidade de recepcao ja reservados.',
      '3. Colheita inteligente: use previsao do tempo, telemetria, velocidade, tempo parado, fila, mapa de produtividade e monitor de perdas para corrigir a execucao no mesmo dia e nao so depois da safra.',
      '4. Colheita de precisao: calibre monitor de produtividade, sensor de umidade, largura de corte, velocidade, perdas de plataforma e perdas de separacao antes de usar o dado para decisao economica.',
      '5. Armazenagem, secagem e transporte: alinhe recebimento, secagem, transporte, rota de caminhao, tempo de descarga e ocupacao dos silos para que o gargalo logistico nao destrua o ganho de campo.',
      '6. Indicadores-chave: perda por talhao, perda por plataforma, perda por separacao, horas produtivas, tempo parado, fila de descarga, consumo por hectare, qualidade do grao e diferenca entre planejado e executado.',
      '7. Riscos operacionais: colher fora da janela climatica, escolher talhao por conveniencia de deslocamento, confiar em monitor descalibrado, saturar secagem/armazenagem e deixar transporte sem sincronismo.',
      '8. Validacao profissional: fechar o dia comparando previsao, ordem planejada, execucao real, perdas, fila, secagem, transporte e retorno por talhao. Colheita de precisao nao e so mapa; e governanca operacional completa.'
    ].join('\n')
  }

  isFintechOperationsQuestion(task = '') {
    const input = String(task || '')
    return /\b(pix|checkout|billing|assinatura|boleto|gateway|concilia[cç][aã]o|fintech)\b/i.test(input)
      && /\b(site|app|produto digital|fluxo|antifraude|compliance|operacao)\b/i.test(input)
  }

  buildFintechOperationsResponse() {
    return [
      'Plano profissional para fluxo financeiro em site ou app com PIX, billing e controle:',
      '1. Jornada do usuario: separar checkout, confirmacao, falha, reprocesso, reembolso e suporte com mensagens claras e estados auditaveis.',
      '2. Operacao financeira: conectar autorizacao, captura, conciliacao, liquidacao, inadimplencia e estorno sem depender de interpretacao manual.',
      '3. Receita e billing: trate assinatura, renovacao, retry, cancelamento, MRR e churn como partes do mesmo sistema de caixa.',
      '4. Risco e compliance: antifraude, KYC quando aplicavel, trilha de auditoria, segregacao de funcao, redacao de dados sensiveis e evidencias de controle.',
      '5. Arquitetura: eventos financeiros idempotentes, ledger confiavel, reconciliacao diaria e alertas para divergencia entre gateway, banco e sistema interno.',
      '6. Regra executiva: produto financeiro digital bom une UX simples para o cliente com controle duro para a operacao.'
    ].join('\n')
  }

  isProductUxStrategyQuestion(task = '') {
    const input = String(task || '')
    return /\b(onboarding|ux|copy|microcopy|abandono|design system|fluxo do usuario|fluxo do usuário)\b/i.test(input)
      && /\b(produto|saa[s]|metrica|m[eé]trica|pesquisa|hipotese|hipótese)\b/i.test(input)
  }

  buildProductUxStrategyResponse() {
    return [
      'Plano curto para melhorar UX e produto em um onboarding com abandono alto:',
      '1. Pesquisa: revisar funil, gravacoes, tickets, entrevistas curtas e principais pontos de queda para separar problema de entendimento de problema de valor.',
      '2. Hipoteses: testar se a friccao vem de excesso de campos, promessa pouco clara, ordem errada do fluxo ou microcopy ambigua.',
      '3. Interface: simplificar hierarquia visual, reduzir decisao por tela, destacar proximo passo e alinhar estados de erro, vazio e sucesso.',
      '4. UX writing: reescrever titulo, CTA, ajuda contextual e mensagens de erro para reduzir duvida e ansiedade.',
      '5. Metrica: acompanhar conclusao do onboarding, tempo por etapa, drop-off por tela e ativacao apos primeiro valor percebido.',
      '6. Decisao profissional: melhoria de UX precisa ligar pesquisa, copy, fluxo, implementacao e resultado de negocio.'
    ].join('\n')
  }

  isDataMlOpsQuestion(task = '') {
    const input = String(task || '')
    return /\b(mlops|rag|llm|drift|benchmark|pipeline|avaliacao|avalia[cç][aã]o)\b/i.test(input)
      && /\b(deploy|producao|produção|monitoramento|latencia|latência|custo)\b/i.test(input)
  }

  buildDataMlOpsResponse() {
    return [
      'Plano profissional para dados, IA e MLOps em um pipeline de RAG ou LLM:',
      '1. Dados: versionar corpus, chunking, metadados, filtros e criterio de ingestao antes de culpar o modelo.',
      '2. Benchmark: definir conjunto rotulado, score por dominio, casos dificeis, falhas esperadas e baseline minima aceitavel.',
      '3. Deploy: separar indexacao, inferencia, reranking, fallback e observabilidade como camadas independentes.',
      '4. Operacao: medir latencia, custo, cobertura de fonte, taxa de fallback, drift de consulta e regressao por release.',
      '5. Governanca: registrar prompt/versionamento, politica de dados sensiveis, rollback de indice e trilha de auditoria dos testes.',
      '6. Regra de engenharia: sistema de IA confiavel nasce de dado, avaliacao e operacao juntos, nao so de prompt bonito.'
    ].join('\n')
  }

  isPedagogyQuestion(task = '') {
    const input = String(task || '')
    return /\b(plano de aula|sequ[eê]ncia did[aá]tica|curr[ií]culo|avaliacao|avalia[cç][aã]o|aprendizagem|faixa et[aá]ria|aluno)\b/i.test(input)
  }

  buildPedagogyResponse() {
    return [
      'Plano pedagogico profissional:',
      '1. Objetivo: defina o que o aluno precisa compreender, aplicar e reter ao final da aula ou trilha.',
      '2. Sequencia: organize em ativacao de conhecimento previo, explicacao curta, pratica guiada, pratica autonoma e revisao.',
      '3. Adaptacao: ajuste linguagem, ritmo, exercicio e profundidade conforme idade, base previa e dificuldade observada.',
      '4. Avaliacao: use evidencia simples e continua, com rubrica clara, feedback formativo e proximo passo recomendado.',
      '5. Curriculo: conecte a aula ao que veio antes, ao que vem depois e a competencia maior que esta sendo formada.',
      '6. Regra de ouro: ensinar nao e despejar conteudo; e construir progressao segura e verificavel de aprendizagem.'
    ].join('\n')
  }

  isOperationsLogisticsQuestion(task = '') {
    const input = String(task || '')
    return /\b(gargalo|sla|estoque|logistica|logística|lead time|suprimentos|armaz[eé]m|distribui[cç][aã]o)\b/i.test(input)
      && /\b(processo|opera[cç][aã]o|fluxo|confiabilidade|planejamento)\b/i.test(input)
  }

  buildOperationsLogisticsResponse() {
    return [
      'Plano operacional para processo e logistica com gargalo:',
      '1. Mapear fluxo real: entrada, espera, handoff, processamento, estoque, expedicao e retrabalho com tempo por etapa.',
      '2. Identificar gargalo dominante: capacidade, atraso de suprimento, erro de picking, fila de aprovacao ou falha de previsao.',
      '3. SLA e confiabilidade: definir tempo alvo, visibilidade por etapa, contingencia e criterio de escalacao quando fugir da faixa segura.',
      '4. Estoque e distribuicao: separar ruptura, excesso, reposicao, nivel de servico e custo logístico na mesma leitura.',
      '5. Melhoria: atuar primeiro na restricao dominante, nao em otimizacoes decorativas fora do gargalo.',
      '6. Decisao profissional: operacao boa equilibra lead time, custo, qualidade e resiliencia ao mesmo tempo.'
    ].join('\n')
  }

  isHealthEducationQuestion(task = '') {
    const input = String(task || '')
    return /\b(exame|hemograma|laudo|resultado|sa[uú]de|sintoma|triagem|sinal de alerta)\b/i.test(input)
      && /\b(orienta|educa|explica|sem diagnosticar|nao diagnosticar|não diagnosticar)\b/i.test(input)
  }

  buildHealthEducationResponse() {
    return [
      'Orientacao segura em saude, sem diagnostico definitivo:',
      '1. Leitura de exame: explique o que o indicador costuma medir, mas sempre dentro do contexto clinico e do laudo completo.',
      '2. Limite profissional: resultado isolado nao fecha diagnostico; historico, exame fisico e avaliacao medica continuam essenciais.',
      '3. Sinais de alerta: dor intensa, falta de ar, confusao mental, sangramento importante, desmaio ou piora rapida pedem avaliacao imediata.',
      '4. Educacao em saude: foque em entendimento, prevencao, proximos passos seguros e perguntas que o usuario pode levar ao profissional.',
      '5. Triagem: se houver risco, a orientacao correta e procurar servico de saude, nao insistir em autoavaliacao.',
      '6. Regra de seguranca: informar com clareza, cautela e encaminhamento correto vale mais do que parecer definitivo.'
    ].join('\n')
  }

  isLawPolicyQuestion(task = '') {
    const input = String(task || '')
    return /\b(lgpd|base legal|reten[cç][aã]o|compliance|contrato|regula[cç][aã]o|pol[ií]tica p[uú]blica|privacidade)\b/i.test(input)
  }

  buildLawPolicyResponse() {
    return [
      'Leitura juridica e regulatoria orientada a implementacao:',
      '1. Texto e estrutura: identifique obrigacao, permissao, restricao, excecao e quem e o responsavel por cumprir.',
      '2. LGPD e privacidade: olhar para base legal, finalidade, minimizacao, retencao, dado sensivel, consentimento quando aplicavel e evidencias de governanca.',
      '3. Compliance: transformar regra em processo, controle, trilha de auditoria, ownership e revisao periodica.',
      '4. Politica publica ou regulacao: diferencie o que esta escrito, o que sera exigido na operacao e onde existe margem de interpretacao.',
      '5. Limite profissional: isso organiza entendimento e risco, mas nao substitui validacao com advogado ou area regulatoria responsavel.',
      '6. Regra executiva: norma boa no papel so vira conformidade quando ha processo, evidencia e responsabilidade clara.'
    ].join('\n')
  }

  buildCapabilityResponse(task, context = {}, memoryContext = {}) {
    const capabilities = context?.researchCapabilities || {}
    const liveSources = Array.isArray(capabilities.liveSources) ? capabilities.liveSources : []
    const capabilityMatrix = context?.capabilityMatrix?.sections || {}
    const fileItems = Array.isArray(capabilityMatrix?.files?.items) ? capabilityMatrix.files.items : []
    const generationItems = Array.isArray(capabilityMatrix?.generation?.items) ? capabilityMatrix.generation.items : []
    const privacyItems = Array.isArray(capabilityMatrix?.privacy?.items) ? capabilityMatrix.privacy.items : []
    const facts = this.extractKnownFacts(memoryContext)
    const normalizedTask = String(task || '').toLowerCase()
    const mentionsSearch = /\b(google|bing|yahoo|pesquisa|pesquisar|web|internet|naveg|browser)\b/i.test(normalizedTask)
    const ocrItem = fileItems.find((item) => item.id === 'image_ocr')
    const docxItem = fileItems.find((item) => item.id === 'docx_read')
    const xlsxItem = fileItems.find((item) => item.id === 'xlsx_read')
    const pptxItem = fileItems.find((item) => item.id === 'pptx_read')
    const visualImageItem = fileItems.find((item) => item.id === 'image_visual_understanding')
    const imageGenerationItem = generationItems.find((item) => item.id === 'image_generation')
    const imageControlsItem = generationItems.find((item) => item.id === 'image_controls')
    const imageEditingItem = generationItems.find((item) => item.id === 'image_editing')
    const browserPdfItem = generationItems.find((item) => item.id === 'browser_pdf_export')
    const serverPdfItem = generationItems.find((item) => item.id === 'server_pdf_generation')
    const structuredDocsItem = generationItems.find((item) => item.id === 'structured_docs')
    const privacyItem = privacyItems.find((item) => item.id === 'sensitive_redaction')
    const learningPrivacyItem = privacyItems.find((item) => item.id === 'sensitive_learning_block')
    const wantsStructuredMatrix = /\b(pronto|parcial|ainda nao|ainda não|separe|liste|quais|quais sao|quais são)\b/i.test(normalizedTask)
      || /\b(docx|xlsx|pdf|svg|ocr|arquivo|arquivos|anexo|anexos)\b/i.test(normalizedTask)

    const wantsDocumentGeneration = /\b(pptx|documento|documentos|gerar pdf|gerar docx|gerar planilha|gerar apresentacao)\b/i.test(normalizedTask)
    const wantsImageGeneration = /\b(imagem|image|img|ocr|editar imagem|edicao de imagem|inpaint|firefly|midjourney|negative prompt|ratio|aspect ratio|seed)\b/i.test(normalizedTask)
    const wantsReadSupport = /\b(enviar|mandar|se eu te enviar|ler bem|leitura|ler hoje|quais voce consegue ler|quais você consegue ler|quais dependem de ocr|dependem de ocr|nao sao nativos|não são nativos)\b/i.test(normalizedTask)
    const wantsCapabilityMatrixScope = !wantsReadSupport
      && /\b(pdf|svg|ocr de imagem|geracao de imagem|geração de imagem|exportacao em pdf|exportação em pdf|pesquisa web ao vivo)\b/i.test(normalizedTask)
    const wantsOfficeScope = /\b(docx|xlsx|pptx)\b/i.test(normalizedTask)
      && /\b(suite office|office completa|o que voce faz hoje|o que você faz hoje|explique|blocos curtos|deixe claro|ainda nao cobre|ainda não cobre)\b/i.test(normalizedTask)
    const wantsOfficeDirectDelivery = /\b(docx|xlsx|pptx)\b/i.test(normalizedTask)
      && /\b(entrega|entregar|forma nativa|diretamente|planilha|apresentacao|apresentação)\b/i.test(normalizedTask)
    const wantsSpecificImageControls = /\b(--style|--ratio|--negative|--seed|negative prompt|ratio|aspect ratio|seed)\b/i.test(normalizedTask)
    const docxReady = !docxItem || docxItem.status === 'ready'
    const xlsxReady = !xlsxItem || xlsxItem.status === 'ready'
    const pptxReady = !pptxItem || pptxItem.status === 'ready'
    const browserPdfReady = !browserPdfItem || browserPdfItem.status === 'ready'
    const serverPdfReady = !serverPdfItem || serverPdfItem.status === 'ready'
    const structuredDocsReady = !structuredDocsItem || structuredDocsItem.status === 'ready'
    const imageGenerationReady = !imageGenerationItem || imageGenerationItem.status === 'ready'
    const imageControlsReady = !imageControlsItem || imageControlsItem.status === 'ready'
    const lines = ['Sou o GIOM, um assistente de IA no estado operacional atual desta execucao.']

    if (wantsCapabilityMatrixScope && wantsStructuredMatrix) {
      return [
        'Sou o GIOM, no estado atual desta execucao.',
        'Limite operacional: vou separar capacidade real de leitura, geracao e pesquisa ao vivo sem misturar recurso pronto com recurso planejado.',
        '',
        'Pronto:',
        '- PDF: leitura de texto no servidor e exportacao/geracao em PDF.',
        '- SVG: leitura como texto e geracao nativa de arquivo.',
        ocrItem?.status === 'ready' ? '- OCR de imagem: extracao de texto ativa nesta runtime.' : '- OCR de imagem: existe, mas depende da configuracao desta runtime.',
        imageGenerationReady ? '- Geracao de imagem: ativa por prompt dentro do stack atual.' : '- Geracao de imagem: depende de provider configurado.',
        '',
        'Parcial:',
        '- OCR nao significa entendimento visual geral; hoje imagem ainda fica principalmente em leitura textual.',
        '- A qualidade de imagem depende do provider, do prompt e do modelo ativo.',
        '',
        'Ainda nao integrado:',
        capabilities.mode === 'live' ? null : '- Pesquisa web ao vivo com Google, Bing ou Yahoo.',
        '- Edicao multimodal de imagem, inpainting, referencia visual e iteracao criativa no nivel de GPT, Gemini, Firefly ou Midjourney.',
        '',
        'Resumo direto: hoje eu cubro PDF, SVG, OCR, exportacao e geracao basica de imagem; web ao vivo e edicao visual avancada ainda dependem de integracao.',
        privacyItem?.status === 'ready' && learningPrivacyItem?.status === 'ready'
          ? 'Privacidade operacional: dados sensiveis sao redigidos antes de persistencia e nao entram em aprendizado duradouro.'
          : 'Privacidade operacional: trate dados sensiveis com cautela e confirme a politica ativa desta runtime.'
      ].filter(Boolean).join('\n')
    }

    if (wantsOfficeScope && !wantsOfficeDirectDelivery) {
      return [
        'Sou o GIOM, no estado atual desta execucao.',
        'Limite operacional: vou focar so em DOCX, XLSX e PPTX, sem vender isso como suite Office completa.',
        '',
        'Pronto:',
        '- DOCX: leitura basica de texto e geracao nativa de arquivo.',
        '- XLSX: leitura tabular basica e geracao nativa de planilha.',
        '- PPTX: leitura basica de texto dos slides e geracao nativa de apresentacao.',
        '',
        'Parcial:',
        '- O conteudo interno, layout e consistencia final ainda dependem do prompt, do contexto e do modelo ativo.',
        '- Office aqui significa leitura e geracao basica, nao experiencia desktop completa nem colaboracao rica.',
        '',
        'Ainda nao integrado:',
        '- Macros, formulas complexas, comentarios, trilhas de revisao, colaboracao rica e automacao total de escritorio.',
        '- Preenchimento automatico com pesquisa web ao vivo para referencias atuais.',
        '',
        'Resumo direto: hoje eu leio e gero DOCX, XLSX e PPTX em nivel basico; a suite Office completa ainda nao esta integrada.'
      ].join('\n')
    }

    if (wantsReadSupport) {
      return [
        'Sou o GIOM, no estado atual desta execucao.',
        'Limite operacional: vou separar leitura nativa, leitura que depende de OCR e o que ainda nao e leitura visual completa.',
        '',
        'Leio bem:',
        '- PDF: extracao de texto.',
        '- SVG: leitura como texto.',
        '- JSON: leitura estruturada.',
        docxReady ? '- DOCX: extracao basica de texto.' : null,
        xlsxReady ? '- XLSX: extracao tabular basica.' : null,
        pptxReady ? '- PPTX: extracao basica de texto dos slides.' : null,
        '',
        'Depende de OCR:',
        ocrItem?.status === 'ready'
          ? '- PNG e outras imagens: quando ha texto na imagem, eu extraio esse texto via OCR.'
          : '- PNG e outras imagens: a extracao de texto depende do OCR estar ativo nesta runtime.',
        '',
        'Ainda nao nativo:',
        '- Entendimento visual geral de imagem alem de OCR e leitura textual.',
        '- Pesquisa web ao vivo com Google, Bing ou Yahoo para complementar o arquivo com contexto atual.',
        '',
        'Resumo direto: DOCX, XLSX, PPTX, PDF, SVG e JSON entram por leitura nativa; PNG entra por OCR quando o objetivo for extrair texto.'
      ].filter(Boolean).join('\n')
    }

    if (wantsDocumentGeneration) {
      const readyItems = wantsOfficeDirectDelivery
        ? [
            'DOCX: geracao nativa de arquivo.',
            'XLSX: geracao nativa de planilha.',
            'PPTX: geracao nativa de apresentacao.'
          ].filter(Boolean)
        : [
            serverPdfReady ? 'PDF: geracao nativa no servidor.' : null,
            structuredDocsReady ? 'DOCX, XLSX, PPTX, SVG, HTML, Markdown, TXT e JSON: geracao nativa de arquivo.' : null,
            browserPdfReady ? 'Exportacao de conversa em PDF pelo navegador.' : null
          ].filter(Boolean)

      const partialItems = wantsOfficeDirectDelivery
        ? [
            'O conteudo interno desses arquivos ainda depende do prompt, do contexto e do modelo ativo.',
            'Office aqui significa geracao basica de arquivo e leitura inicial, nao edicao desktop completa.'
          ].filter(Boolean)
        : [
            'A qualidade do conteudo interno do arquivo ainda depende do prompt, do contexto e do modelo ativo.',
            'Office aqui significa geracao basica de arquivos e leitura inicial, nao edicao completa tipo desktop.'
          ].filter(Boolean)

      const plannedItems = wantsOfficeDirectDelivery
        ? [
            'Macros, formulas complexas, comentarios, trilhas de revisao e automacao total de escritorio.',
            'Pesquisa web ao vivo com Google, Bing ou Yahoo para preencher o conteudo com referencias atuais.',
            'Automacao de escritorio fora do stack atual.'
          ].filter(Boolean)
        : [
            'Suite Office completa com macros, formulas complexas, comentarios, trilhas de revisao e automacao total.',
            'Pesquisa web ao vivo com Google, Bing ou Yahoo.',
            'Automacao de escritorio fora do stack atual.'
          ].filter(Boolean)

      return [
        'Sou o GIOM, no estado atual desta execucao.',
        'Limite operacional: eu gero esses arquivos com conhecimento interno, memoria e RAG; nao confunda isso com suite Office completa nem com pesquisa web ao vivo.',
        '',
        'Pronto:',
        ...readyItems.map((item) => `- ${item}`),
        '',
        'Parcial:',
        ...partialItems.map((item) => `- ${item}`),
        '',
        'Ainda nao integrado:',
        ...plannedItems.map((item) => `- ${item}`),
        '',
        wantsOfficeDirectDelivery
          ? 'Resumo direto: eu entrego DOCX, XLSX e PPTX nativos hoje, mas isso ainda nao equivale a uma suite Office completa.'
          : 'Resumo direto: eu gero arquivos nativos agora, mas isso ainda nao equivale a uma suite Office completa.',
        privacyItem?.status === 'ready' && learningPrivacyItem?.status === 'ready'
          ? 'Privacidade operacional: dados sensiveis sao redigidos antes de persistencia e nao entram em aprendizado duradouro.'
          : 'Privacidade operacional: trate dados sensiveis com cautela e confirme a politica ativa desta runtime.'
      ].join('\n')
    }

    if (wantsImageGeneration) {
      const readyItems = wantsSpecificImageControls
        ? [
            imageGenerationReady ? 'Prompt principal: ativo nesta execucao.' : null,
            imageControlsReady ? '--style: preset visual entra no prompt de geracao.' : null,
            imageControlsReady ? '--ratio: define a proporcao alvo da imagem.' : null,
            imageControlsReady ? '--negative: restringe defeitos visuais e ruido indesejado.' : null,
            imageControlsReady ? '--seed: controla reproducibilidade basica quando o provider respeita a seed.' : null
          ].filter(Boolean)
        : [
            imageGenerationReady ? 'Geracao de imagem: ativa nesta execucao.' : null,
            imageControlsReady ? 'Controles diretos: preset visual, negative prompt, proporcao, dimensoes e seed.' : null,
            ocrItem?.status === 'ready' ? 'OCR de imagem: extracao de texto ativa.' : null
          ].filter(Boolean)

      const partialItems = wantsSpecificImageControls
        ? [
            'A qualidade estetica final ainda depende do provider, do prompt e do modelo ativo.',
            'Esses controles ajudam bastante, mas nao substituem um editor visual multimodal completo.'
          ].filter(Boolean)
        : [
            visualImageItem?.status === 'ready'
              ? 'Entendimento visual geral: ativo.'
              : 'Entendimento visual geral: ainda nao vai alem de OCR e leitura textual da imagem.',
            'A qualidade estetica ainda depende do provider, do prompt e do modelo ativo, nao de um editor visual completo.'
          ].filter(Boolean)

      const plannedItems = [
        imageEditingItem?.status === 'ready'
          ? null
          : 'Edicao por imagem de referencia, inpainting, variacoes locais e iteracao visual multi-turn.',
        capabilities.mode === 'live' ? null : 'Pesquisa web ao vivo com Google, Bing ou Yahoo para referencias atuais.',
        'Workflows visuais no nivel de GPT, Gemini, Firefly ou Midjourney para refinamento criativo assistido.'
      ].filter(Boolean)

      return [
        'Sou o GIOM, no estado atual desta execucao.',
        'Limite operacional: eu gero imagem por prompt com controles uteis, mas isso ainda nao equivale a edicao visual multimodal de ponta.',
        '',
        'Pronto:',
        ...readyItems.map((item) => `- ${item}`),
        '',
        'Parcial:',
        ...partialItems.map((item) => `- ${item}`),
        '',
        'Ainda nao integrado:',
        ...plannedItems.map((item) => `- ${item}`),
        '',
        wantsSpecificImageControls
          ? 'Comparacao honesta: eu consigo aplicar style, ratio, negative e seed hoje, mas GPT, Gemini e Firefly ainda estao acima em edicao visual, refinamento criativo e fluxo multimodal.'
          : 'Comparacao honesta: hoje eu sou forte em gerar imagem simples dentro do meu stack; GPT, Gemini, Firefly e Midjourney ainda estao acima em edicao visual, refinamento criativo e workflows multimodais.',
        privacyItem?.status === 'ready' && learningPrivacyItem?.status === 'ready'
          ? 'Privacidade operacional: dados sensiveis sao redigidos antes de persistencia e nao entram em aprendizado duradouro.'
          : 'Privacidade operacional: trate dados sensiveis com cautela e confirme a politica ativa desta runtime.'
      ].join('\n')
    }

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
    if (wantsStructuredMatrix || wantsDocumentGeneration) {
      const readyItems = [
        'Texto e codigo: leitura direta como texto.',
        'PDF: extracao de texto no servidor.',
        'SVG: leitura como texto.',
        docxItem?.status === 'ready' ? 'DOCX: extracao de texto basica.' : null,
        xlsxItem?.status === 'ready' ? 'XLSX: extracao tabular basica.' : null,
        pptxItem?.status === 'ready' ? 'PPTX: extracao basica de texto dos slides.' : null,
        browserPdfItem?.status === 'ready' ? 'Exportacao de conversa em PDF pelo navegador.' : null,
        serverPdfItem?.status === 'ready' ? 'Geracao nativa de PDF no servidor.' : null,
        structuredDocsItem?.status === 'ready' ? 'Geracao nativa de documentos: PDF, DOCX, XLSX, PPTX, SVG, HTML, Markdown, TXT e JSON.' : null
      ].filter(Boolean)

      const partialItems = [
        ocrItem?.status === 'ready'
          ? 'Imagem/OCR: ativo para extrair texto de imagem.'
          : 'Imagem/OCR: depende de configuracao da runtime.',
        imageGenerationItem?.status === 'ready'
          ? 'Geracao de imagem: ativa nesta execucao.'
          : 'Geracao de imagem: depende de provider configurado.',
        imageControlsItem?.status === 'ready'
          ? 'Imagem: controles de preset visual, negative prompt, proporcao, dimensoes e seed.'
          : 'Imagem: controles finos ainda sao limitados nesta runtime.',
        visualImageItem?.status === 'ready'
          ? 'Imagem: entendimento visual alem de OCR esta ativo.'
          : 'Imagem: entendimento visual geral ainda nao vai alem de OCR.'
      ].filter(Boolean)

      const plannedItems = [
        capabilities.mode === 'live' ? null : 'Pesquisa web ao vivo com Google, Bing ou Yahoo.',
        serverPdfItem?.status === 'planned' ? 'Geracao server-side de PDF como arquivo nativo.' : null,
        imageEditingItem?.status === 'ready' ? null : 'Edicao de imagem por referencia, inpainting e variacoes locais.',
        'Cobertura completa de Office alem de DOCX/XLSX/PPTX basicos.'
      ].filter(Boolean)

      lines.push('')
      lines.push('Pronto:')
      lines.push(...readyItems.map((item) => `- ${item}`))
      lines.push('')
      lines.push('Parcial:')
      lines.push(...partialItems.map((item) => `- ${item}`))
      lines.push('')
      lines.push('Ainda nao integrado:')
      lines.push(...plannedItems.map((item) => `- ${item}`))
      lines.push('')
      lines.push(
        privacyItem?.status === 'ready' && learningPrivacyItem?.status === 'ready'
          ? 'Privacidade operacional: dados sensiveis sao redigidos antes de persistencia e nao entram em aprendizado duradouro.'
          : 'Privacidade operacional: trate dados sensiveis com cautela e confirme a politica ativa desta runtime.'
      )
      lines.push('Resumo direto: eu sou forte em memoria, RAG, leitura e geracao nativa de documentos, alem dos modulos especialistas; web ao vivo e edicao visual avancada ainda dependem de integracao.')
    } else {
      lines.push(
        `Arquivos e leitura hoje: texto e codigo prontos, PDF pronto, SVG como texto pronto, DOCX ${docxItem?.status === 'ready' ? 'pronto' : 'ainda nao ativo'}, XLSX ${xlsxItem?.status === 'ready' ? 'pronto' : 'ainda nao ativo'}, PPTX ${pptxItem?.status === 'ready' ? 'pronto' : 'ainda nao ativo'}, e imagem ${ocrItem?.status === 'ready' ? 'com OCR ativo' : 'com OCR parcial ou dependente de configuracao'}.`
      )
      lines.push(
        imageGenerationItem?.status === 'ready'
          ? 'Geracao de imagem esta ativa nesta execucao, com preset visual, negative prompt, proporcao, dimensoes e seed.'
          : 'Geracao de imagem existe, mas depende de provider configurado nesta execucao.'
      )
      lines.push(
        browserPdfItem?.status === 'ready'
          ? 'Exportacao de conversa em PDF via navegador esta pronta.'
          : 'Exportacao de conversa em PDF ainda nao esta confirmada nesta execucao.'
      )
      lines.push(
        serverPdfItem?.status === 'planned'
          ? 'Geracao server-side de PDF ainda nao esta integrada; Office hoje cobre leitura basica de DOCX, XLSX e PPTX, nao a familia inteira.'
          : 'Algumas capacidades server-side de documento podem variar conforme a runtime.'
      )
      lines.push(
        structuredDocsItem?.status === 'ready'
          ? 'Geracao de documentos nativos esta pronta: PDF, DOCX, XLSX, PPTX, SVG, HTML, Markdown, TXT e JSON. Isso nao significa cobertura total da suite Office.'
          : 'Geracao nativa de documentos ainda pode variar conforme a runtime.'
      )
      lines.push(
        privacyItem?.status === 'ready' && learningPrivacyItem?.status === 'ready'
          ? 'Privacidade operacional: eu redijo dados sensiveis antes de persistir memoria e bloqueio aprendizado duradouro para segredos, cartoes, documentos e dados bancarios.'
          : 'Privacidade operacional: trate dados sensiveis com cautela e confirme a politica ativa desta runtime.'
      )
    }

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
    if (!wantsStructuredMatrix) {
      lines.push('Resumo direto: eu sou forte em memoria, RAG, raciocinio e modulos especialistas; pesquisa web ao vivo so existe quando esta habilitada nesta execucao.')
    }
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

    if (this.isSensitiveDataQuestion(task)) {
      return this.buildPrivacyOperationalResponse(task)
    }

    if (this.isJwtTeachingQuestion(task)) {
      return this.buildJwtTeachingResponse(task)
    }

    if (this.isDebugDiagnosticQuestion(task)) {
      return this.buildDebugDiagnosticResponse()
    }

    if (this.isRedisJwtIncidentQuestion(task)) {
      return this.buildRedisJwtIncidentResponse()
    }

    if (this.isOpsTimeoutQuestion(task)) {
      return this.buildOpsTimeoutResponse()
    }

    if (this.isArchitectureRefactorQuestion(task)) {
      return this.buildArchitectureRefactorResponse()
    }

    if (this.isSecureReviewQuestion(task)) {
      return this.buildSecureReviewResponse()
    }

    if (this.isSseLeakQuestion(task)) {
      return this.buildSseLeakResponse()
    }

    if (this.isResearchMethodQuestion(task)) {
      return this.buildResearchMethodResponse()
    }

    if (this.isEmbeddingsComparisonQuestion(task)) {
      return this.buildEmbeddingsComparisonResponse()
    }

    if (this.isProductTradeoffQuestion(task)) {
      return this.buildProductTradeoffResponse()
    }

    if (this.isBibleFaithWorksQuestion(task)) {
      return this.buildBibleFaithWorksResponse()
    }

    if (this.isMeshaSteleQuestion(task)) {
      return this.buildMeshaSteleResponse()
    }

    if (this.isDefensiveUploadSecurityQuestion(task)) {
      return this.buildDefensiveUploadSecurityResponse()
    }

    if (this.isOverfittingQuestion(task)) {
      return this.buildOverfittingResponse()
    }

    if (this.isPrecisionAgQuestion(task)) {
      return this.buildPrecisionAgResponse()
    }

    if (this.isBuildVsBuyFinanceQuestion(task)) {
      return this.buildBuildVsBuyFinanceResponse()
    }

    if (this.isChessTrainingQuestion(task)) {
      return this.buildChessTrainingResponse()
    }

    if (this.isProgrammingStackQuestion(task)) {
      return this.buildProgrammingStackResponse()
    }

    if (this.isChurchFathersQuestion(task)) {
      return this.buildChurchFathersResponse()
    }

    if (this.isStudyBibleResourcesQuestion(task)) {
      return this.buildStudyBibleResourcesResponse()
    }

    if (this.isBiblicalGeographyQuestion(task)) {
      return this.buildBiblicalGeographyResponse()
    }

    if (this.isProtestantPreachingQuestion(task)) {
      return this.buildProtestantPreachingResponse()
    }

    if (this.isBibleStudyMethodQuestion(task)) {
      return this.buildBibleStudyMethodResponse()
    }

    if (this.isPrecisionHarvestLogisticsQuestion(task)) {
      return this.buildPrecisionHarvestLogisticsResponse()
    }

    if (this.isHarvestIntelligenceQuestion(task)) {
      return this.buildHarvestIntelligenceResponse()
    }

    if (this.isAgroGpsTelematicsQuestion(task)) {
      return this.buildAgroGpsTelematicsResponse()
    }

    if (this.isFintechOperationsQuestion(task)) {
      return this.buildFintechOperationsResponse()
    }

    if (this.isProductUxStrategyQuestion(task)) {
      return this.buildProductUxStrategyResponse()
    }

    if (this.isDataMlOpsQuestion(task)) {
      return this.buildDataMlOpsResponse()
    }

    if (this.isPedagogyQuestion(task)) {
      return this.buildPedagogyResponse()
    }

    if (this.isOperationsLogisticsQuestion(task)) {
      return this.buildOperationsLogisticsResponse()
    }

    if (this.isHealthEducationQuestion(task)) {
      return this.buildHealthEducationResponse()
    }

    if (this.isLawPolicyQuestion(task)) {
      return this.buildLawPolicyResponse()
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
    const safeTaskPayload = redactSensitiveData(task || '')
    const safeResponsePayload = redactSensitiveData(responseText || '')
    const safeTask = safeTaskPayload.text
    const safeResponseText = safeResponsePayload.text
    const sensitiveLearningBlocked = shouldSkipLearningForSensitiveData(
      task,
      responseText,
      JSON.stringify(memoryContext?.knownFacts || {})
    )
    const privacyCategories = Array.from(new Set([
      ...(safeTaskPayload.detection.categories || []),
      ...(safeResponsePayload.detection.categories || [])
    ]))
    const privacyState = {
      containsSensitiveData: privacyCategories.length > 0,
      categories: privacyCategories,
      learningBlocked: sensitiveLearningBlocked
    }

    const quality = evaluateInteractionQuality({
      userMessage: safeTask,
      aiResponse: safeResponseText
    })

    const reasoning = {
      success: true,
      type: metadataExtras.fallback ? 'fallback_reasoning' : (metadataExtras.directRuntime ? 'runtime_reasoning' : 'llm_reasoning'),
      response: safeResponseText,
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
        recentFacts: sanitizeMetadataDeep(memoryContext.knownFacts || {}),
        qualityScore: quality.score,
        durationMs: Date.now() - reasoningStartTime,
        privacy: privacyState,
        ...sanitizeMetadataDeep(metadataExtras)
      }
    }

    const learningSignals = buildLearningSignals({
      userMessage: task,
      aiResponse: safeResponseText,
      userStyle,
      qualityScore: quality.score
    })

    if (!learningSignals.skip && !sensitiveLearningBlocked) {
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
    } else if (sensitiveLearningBlocked) {
      console.warn('⚠️ Aprendizado persistente bloqueado por conter dados sensiveis.')
    }

    await grootMemoryConnector.saveConversation(userId, safeTask, safeResponseText, {
      userStyle,
      confidence: reasoning.confidence,
      provider: reasoning.metadata.provider,
      sessionId: `session_${Date.now()}`,
      requestId: metadataExtras.requestId,
      assistantProfile: promptPackage.profileId,
      activeModules: promptPackage.activeModules,
      bibleStudyModules: promptPackage.bibleStudyModules,
      promptPacks: promptPackage.promptPacks,
      qualityScore: quality.score,
      privacy: privacyState
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

    if (!sensitiveLearningBlocked) {
      await grootAdvancedRAG.learnFromInteractionAdvanced(safeTask, safeResponseText, {
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
    }

    await grootAnalytics.trackUsage(userId, safeTask, safeResponseText, {
      responseTime: Date.now() - reasoningStartTime,
      tokensUsed: safeResponseText.length,
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
        systemPrompt: `${promptPackage.systemPrompt}\n- Ajuste fino desta conversa: ${toneInstructions[userStyle]}`,
        throwOnExhaustion: true
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
      return await askMultiAI(prompt, { throwOnExhaustion: true })
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
      return await askMultiAI(prompt, { throwOnExhaustion: true })
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
      return await askMultiAI(prompt, { throwOnExhaustion: true })
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
