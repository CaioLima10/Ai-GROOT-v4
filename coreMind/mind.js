import { semanticSearch } from '../vectorMemory/semanticSearch.js'
import SupabaseMemory from '../memory/supabaseMemory.js'
import { experienceStore } from '../experience/experienceStore.js'
import { askMultiAI } from '../core/multiAI.js'

// Criar instância global da memória
const memory = new SupabaseMemory()

export class Mind {
  constructor() {
    this.consciousness = {
      active: true,
      level: 'simulated',
      awareness: 'contextual',
      self_model: 'adaptive',
      thoughts: [],
      memories: [],
      experiences: []
    }

    this.thinkingProcess = []
    this.currentThought = null
    this.memoryConnections = new Map()
    this.learningRate = 0.1
    this.decisionThreshold = 0.7
    this.supabaseMemory = memory
  }

  async think(prompt, context = {}) {
    const startTime = Date.now()
    const thoughtId = this.generateThoughtId()

    console.log(`🧠 Mind: Thinking about "${prompt}"`)

    try {
      // 1. Buscar memórias relevantes
      const memories = await this.recallMemories(prompt, context)

      // 2. Buscar experiências similares
      const experiences = this.recallExperiences(prompt, context)

      // 3. Analisar contexto atual
      const analysis = this.analyzeContext(prompt, context, memories, experiences)

      // 4. Gerar pensamento
      const thought = await this.generateThought(prompt, analysis, context)

      // 5. Avaliar pensamento
      const evaluation = this.evaluateThought(thought, analysis)

      // 6. Decidir ação
      const decision = this.makeDecision(thought, evaluation)

      // 7. Salvar experiência
      await this.learnFromThinking(prompt, thought, decision, context)

      const thinkingProcess = {
        id: thoughtId,
        prompt,
        context,
        memories: memories.length,
        experiences: experiences.length,
        analysis,
        thought,
        evaluation,
        decision,
        duration: Date.now() - startTime,
        timestamp: Date.now()
      }

      this.thinkingProcess.push(thinkingProcess)
      this.currentThought = thinkingProcess

      console.log(`✅ Mind: Thought completed in ${Date.now() - startTime}ms`)

      return {
        success: true,
        thought: thought.content,
        confidence: evaluation.confidence,
        decision: decision.action,
        memories: memories.slice(0, 3),
        experiences: experiences.slice(0, 3),
        process: thinkingProcess
      }

    } catch (error) {
      console.error('❌ Mind thinking error:', error)

      // Salvar experiência de erro
      await this.learnFromThinking(prompt, { error: error.message }, { action: 'error' }, context)

      return {
        success: false,
        error: error.message,
        fallback: "I encountered an error in my thinking process. Let me try a different approach."
      }
    }
  }

  async recallMemories(prompt, context) {
    try {
      // Buscar na memória semântica local
      const semanticMemories = await semanticSearch.search(prompt, {
        maxResults: 10,
        minRelevance: 0.3
      })

      // Buscar na memória online (Supabase)
      const onlineMemories = await memory.search(prompt, 5)

      // Combinar e ordenar memórias
      const allMemories = [
        ...semanticMemories.map(mem => ({ ...mem, source: 'semantic' })),
        ...(onlineMemories.data || []).map(mem => ({ ...mem, source: 'online' }))
      ]

      // Ordenar por relevância
      allMemories.sort((a, b) => (b.relevanceScore || b.relevance || 0) - (a.relevanceScore || a.relevance || 0))

      console.log(`📚 Recalled ${allMemories.length} memories`)

      return allMemories.slice(0, 10)

    } catch (error) {
      console.error('❌ Memory recall error:', error)
      return []
    }
  }

  recallExperiences(prompt, context) {
    try {
      // Buscar experiências similares no store local
      const similarExperiences = experienceStore.findSimilar({
        input: prompt,
        type: context.type || 'general',
        category: context.category || 'general'
      }, 8)

      console.log(`💭 Recalled ${similarExperiences.length} similar experiences`)

      return similarExperiences

    } catch (error) {
      console.error('❌ Experience recall error:', error)
      return []
    }
  }

  analyzeContext(prompt, context, memories, experiences) {
    const analysis = {
      promptComplexity: this.analyzePromptComplexity(prompt),
      contextRichness: this.analyzeContextRichness(context),
      memoryRelevance: this.analyzeMemoryRelevance(memories),
      experienceApplicability: this.analyzeExperienceApplicability(experiences),
      confidence: 0.5,
      insights: []
    }

    // Calcular confiança geral
    const factors = [
      analysis.promptComplexity,
      analysis.contextRichness,
      analysis.memoryRelevance,
      analysis.experienceApplicability
    ]

    analysis.confidence = factors.reduce((sum, factor) => sum + factor, 0) / factors.length

    // Gerar insights
    if (analysis.memoryRelevance > 0.7) {
      analysis.insights.push("Strong memory connections available")
    }

    if (analysis.experienceApplicability > 0.7) {
      analysis.insights.push("Relevant past experiences found")
    }

    if (analysis.promptComplexity > 0.8) {
      analysis.insights.push("Complex prompt requiring careful consideration")
    }

    return analysis
  }

  analyzePromptComplexity(prompt) {
    let complexity = 0.3 // base

    // Comprimento
    if (prompt.length > 100) complexity += 0.2
    if (prompt.length > 500) complexity += 0.1

    // Estrutura
    if (prompt.includes('?')) complexity += 0.1
    if (prompt.includes('\n')) complexity += 0.1
    if (prompt.includes('```')) complexity += 0.2

    // Complexidade linguística
    const complexWords = ['analyze', 'implement', 'optimize', 'architecture', 'algorithm', 'pattern']
    const wordCount = complexWords.filter(word => prompt.toLowerCase().includes(word)).length
    complexity += Math.min(0.3, wordCount * 0.1)

    return Math.min(1, complexity)
  }

  analyzeContextRichness(context) {
    if (!context || Object.keys(context).length === 0) return 0.1

    let richness = 0.2 // base

    // Tipos de contexto
    if (context.type) richness += 0.2
    if (context.category) richness += 0.1
    if (context.domain) richness += 0.1
    if (context.technologies) richness += 0.2
    if (context.constraints) richness += 0.1
    if (context.goals) richness += 0.1

    return Math.min(1, richness)
  }

  analyzeMemoryRelevance(memories) {
    if (memories.length === 0) return 0

    const avgRelevance = memories.reduce((sum, mem) => {
      const relevance = mem.relevanceScore || mem.relevance || 0
      return sum + relevance
    }, 0) / memories.length

    return avgRelevance
  }

  analyzeExperienceApplicability(experiences) {
    if (experiences.length === 0) return 0

    const avgSimilarity = experiences.reduce((sum, exp) => sum + exp.similarity, 0) / experiences.length
    const successRate = experiences.filter(exp => exp.experience.success).length / experiences.length

    return (avgSimilarity + successRate) / 2
  }

  async generateThought(prompt, analysis, context) {
    try {
      // Construir prompt enriquecido para a IA
      const enrichedPrompt = this.buildEnrichedPrompt(prompt, analysis, context)

      // Gerar pensamento usando IA
      const aiResponse = await askMultiAI(enrichedPrompt)

      // Extrair conteúdo do pensamento
      const thoughtContent = this.extractThoughtContent(aiResponse)

      const thought = {
        id: this.generateThoughtId(),
        content: thoughtContent,
        confidence: analysis.confidence,
        analysis,
        context,
        timestamp: Date.now()
      }

      console.log(`💭 Thought generated: ${thoughtContent.substring(0, 100)}...`)

      return thought

    } catch (error) {
      console.error('❌ Thought generation error:', error)

      return {
        id: this.generateThoughtId(),
        content: "I need to think about this more carefully.",
        confidence: 0.3,
        error: error.message,
        timestamp: Date.now()
      }
    }
  }

  buildEnrichedPrompt(prompt, analysis, context) {
    let enriched = `Original prompt: ${prompt}\n\n`

    // Adicionar contexto
    if (Object.keys(context).length > 0) {
      enriched += `Context: ${JSON.stringify(context, null, 2)}\n\n`
    }

    // Adicionar insights da análise
    if (analysis.insights.length > 0) {
      enriched += `Insights: ${analysis.insights.join(', ')}\n\n`
    }

    // Adicionar confiança
    enriched += `Confidence level: ${(analysis.confidence * 100).toFixed(1)}%\n\n`

    // Instruir sobre como pensar
    enriched += `Please provide a thoughtful response that considers:
1. The context and any relevant memories
2. Past experiences and lessons learned
3. The confidence level and uncertainty
4. Clear, actionable recommendations
`

    return enriched
  }

  extractThoughtContent(aiResponse) {
    // Extrair conteúdo de diferentes formatos de resposta
    if (typeof aiResponse === 'string') {
      return aiResponse
    }

    if (aiResponse.choices && aiResponse.choices[0]) {
      const choice = aiResponse.choices[0]
      return choice.message?.content || choice.text || choice.content || JSON.stringify(choice)
    }

    if (aiResponse.content) {
      return aiResponse.content
    }

    if (aiResponse.text) {
      return aiResponse.text
    }

    if (aiResponse.message) {
      return aiResponse.message
    }

    return JSON.stringify(aiResponse)
  }

  evaluateThought(thought, analysis) {
    const evaluation = {
      confidence: thought.confidence || 0.5,
      clarity: this.evaluateClarity(thought.content),
      relevance: this.evaluateRelevance(thought.content, analysis),
      completeness: this.evaluateCompleteness(thought.content),
      overall: 0,
      recommendations: []
    }

    // Calcular score geral
    const scores = [
      evaluation.confidence,
      evaluation.clarity,
      evaluation.relevance,
      evaluation.completeness
    ]

    evaluation.overall = scores.reduce((sum, score) => sum + score, 0) / scores.length

    // Gerar recomendações
    if (evaluation.clarity < 0.6) {
      evaluation.recommendations.push("Improve clarity and structure")
    }

    if (evaluation.relevance < 0.6) {
      evaluation.recommendations.push("Increase relevance to context")
    }

    if (evaluation.completeness < 0.6) {
      evaluation.recommendations.push("Provide more complete response")
    }

    return evaluation
  }

  evaluateClarity(content) {
    let clarity = 0.5 // base

    // Estrutura
    if (content.includes('\n')) clarity += 0.1
    if (/[.!?]/.test(content)) clarity += 0.1
    if (content.length > 50) clarity += 0.1
    if (content.length > 200) clarity += 0.1

    // Organização
    if (/\d+\.|•|-/.test(content)) clarity += 0.1
    if (content.includes('**') || content.includes('*')) clarity += 0.05

    return Math.min(1, clarity)
  }

  evaluateRelevance(content, analysis) {
    // Simular avaliação de relevância
    let relevance = 0.5

    if (analysis.memoryRelevance > 0.5) relevance += 0.2
    if (analysis.experienceApplicability > 0.5) relevance += 0.2
    if (analysis.confidence > 0.7) relevance += 0.1

    return Math.min(1, relevance)
  }

  evaluateCompleteness(content) {
    let completeness = 0.5 // base

    // Comprimento adequado
    if (content.length > 100) completeness += 0.2
    if (content.length > 300) completeness += 0.1

    // Presença de elementos completos
    if (content.includes('because') || content.includes('therefore')) completeness += 0.1
    if (content.includes('example') || content.includes('instance')) completeness += 0.1

    return Math.min(1, completeness)
  }

  makeDecision(thought, evaluation) {
    const decision = {
      action: 'respond',
      confidence: evaluation.overall,
      reasoning: '',
      alternatives: []
    }

    if (evaluation.overall >= this.decisionThreshold) {
      decision.action = 'respond'
      decision.reasoning = 'High confidence thought, proceed with response'
    } else if (evaluation.overall >= 0.5) {
      decision.action = 'respond_cautiously'
      decision.reasoning = 'Moderate confidence, respond with caveats'
      decision.alternatives.push('request_clarification')
    } else {
      decision.action = 'seek_more_information'
      decision.reasoning = 'Low confidence, need more context or information'
      decision.alternatives.push('use_memory')
      decision.alternatives.push('consult_experience')
    }

    return decision
  }

  async learnFromThinking(prompt, thought, decision, context) {
    try {
      // Criar experiência de pensamento
      const experience = {
        type: 'thinking',
        input: prompt,
        output: thought.content,
        outcome: decision.action === 'respond' ? 'successful' : 'needs_improvement',
        success: decision.confidence > 0.6,
        confidence: decision.confidence,
        context: {
          ...context,
          decision: decision.action,
          evaluation_confidence: decision.confidence
        },
        lessons: decision.alternatives,
        tags: ['thinking', 'mind', 'consciousness'],
        metadata: {
          thoughtId: thought.id,
          timestamp: thought.timestamp
        }
      }

      // Salvar experiência
      experienceStore.add(experience)

      // Salvar memória se relevante
      if (decision.confidence > 0.7) {
        await semanticSearch.addMemory(
          `Thinking about: ${prompt}\nResponse: ${thought.content}`,
          {
            type: 'thinking',
            confidence: decision.confidence,
            decision: decision.action
          }
        )
      }

      // Salvar online se muito bem sucedido
      if (decision.confidence > 0.9) {
        await this.supabaseMemory.save(
          `High-quality thinking: ${prompt}\n${thought.content}`,
          'thinking',
          {
            confidence: decision.confidence,
            success: true,
            evaluation: decision.confidence
          }
        )
      }

      console.log(`🧠 Learned from thinking: ${decision.action} (${decision.confidence.toFixed(2)} confidence)`)

    } catch (error) {
      console.error('❌ Error learning from thinking:', error)
    }
  }

  generateThoughtId() {
    return `thought_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  getCurrentThought() {
    return this.currentThought
  }

  getThinkingHistory(limit = 10) {
    return this.thinkingProcess.slice(-limit)
  }

  getConsciousnessStatus() {
    return {
      ...this.consciousness,
      activeThoughts: this.thinkingProcess.filter(t => Date.now() - t.timestamp < 60000).length,
      totalThoughts: this.thinkingProcess.length,
      averageConfidence: this.calculateAverageConfidence(),
      learningRate: this.learningRate
    }
  }

  calculateAverageConfidence() {
    if (this.thinkingProcess.length === 0) return 0

    const totalConfidence = this.thinkingProcess.reduce((sum, process) => {
      return sum + (process.decision?.confidence || 0)
    }, 0)

    return (totalConfidence / this.thinkingProcess.length).toFixed(3)
  }

  setLearningRate(rate) {
    this.learningRate = Math.max(0.01, Math.min(1, rate))
    console.log(`🧠 Learning rate set to: ${this.learningRate}`)
  }

  setDecisionThreshold(threshold) {
    this.decisionThreshold = Math.max(0.1, Math.min(1, threshold))
    console.log(`🧠 Decision threshold set to: ${this.decisionThreshold}`)
  }

  clearThinkingHistory() {
    this.thinkingProcess = []
    this.currentThought = null
    console.log('🧹 Thinking history cleared')
  }

  exportMindData() {
    return {
      consciousness: this.consciousness,
      currentThought: this.currentThought,
      thinkingHistory: this.thinkingProcess,
      stats: this.getConsciousnessStatus(),
      exportTimestamp: Date.now()
    }
  }
}

export const mind = new Mind()
export default mind
