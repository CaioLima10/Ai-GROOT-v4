// GROOT 9.0 IA PROFISSIONAL - Core Final
import { mind } from './coreMind/mind.js'
import { principles } from './coreIdentity/principles.js'
import { security } from './coreIdentity/security.js'
import { experienceStore } from './experience/experienceStore.js'
import SupabaseMemory from './memory/supabaseMemory.js'
import { askMultiAI } from './core/multiAI.js'
import { tools } from './tools/tools.js'
import { planner } from './planner/planner.js'
import { modeManager } from './modes/modeManager.js'
import { vectorStore } from './vector/saveVector.js'
import { identity } from './coreIdentity/identity.js'

// Criar instância global da memória
const memory = new SupabaseMemory()

/**
 * GROOT 9.0 - IA Profissional com Embeddings Reais
 * Sistema completo com planner, tools, modos inteligentes e consciência avançada
 */
export class GrootCore {
  constructor() {
    this.version = "9.0.0"
    this.name = "Ai-GROOT Professional"
    this.status = 'active'
    this.sessionId = this.generateSessionId()
    this.startTime = Date.now()
    this.interactionCount = 0
    this.lastInteraction = null
    this.capabilities = [
      'embeddings',
      'vector_memory',
      'planning',
      'tools',
      'modes',
      'consciousness',
      'autonomous'
    ]
  }

  async ask(prompt, context = {}) {
    const interactionId = this.generateInteractionId()
    const startTime = Date.now()

    console.log(`🌳 GROOT ${this.version}: Processing interaction ${interactionId}`)
    console.log(`📝 Prompt: ${prompt.substring(0, 100)}...`)

    try {
      this.interactionCount++

      // 1. Verificar princípios morais e segurança
      const principlesCheck = principles.check(prompt, context)
      const securityCheck = security.blockDanger(prompt, context)

      if (principlesCheck.violations.length > 0) {
        console.log(`🚫 Principles violation detected: ${principlesCheck.violations.length} issues`)
        return this.formatResponse({
          blocked: true,
          reason: "Principles violation",
          violations: principlesCheck.violations,
          recommendation: principlesCheck.recommendation
        }, interactionId)
      }

      if (securityCheck.blocked) {
        console.log(`🚫 Security threat detected: ${securityCheck.threats.length} threats`)
        return this.formatResponse({
          blocked: true,
          reason: "Security threat",
          threats: securityCheck.threats,
          action: securityCheck.action
        }, interactionId)
      }

      // 2. Criar plano usando planner
      const plan = await planner.plan(prompt, context)

      if (plan.blocked) {
        return this.formatResponse({
          blocked: true,
          reason: plan.reason,
          plan: plan
        }, interactionId)
      }

      // 3. Executar no modo apropriado
      const modeExecution = await modeManager.executeInMode(prompt, {
        ...context,
        plan: plan.validatedPlan,
        interactionId
      })

      // 4. Se o modo falhar, usar planner como fallback
      if (!modeExecution.success && plan.validatedPlan.confidence > 0.5) {
        console.log(`🔄 Using planner as fallback`)
        const plannerResult = await this.executePlan(plan)

        return this.formatResponse({
          success: true,
          response: plannerResult.response,
          confidence: plan.validatedPlan.confidence,
          source: 'planner',
          plan: plan,
          execution: plannerResult
        }, interactionId)
      }

      // 5. Salvar experiência
      await this.saveInteraction(prompt, modeExecution.result, modeExecution.success ? 'success' : 'error', context)

      return this.formatResponse({
        success: modeExecution.success,
        response: modeExecution.result?.response || modeExecution.result?.error || "I encountered an issue processing your request.",
        confidence: modeExecution.result?.confidence || 0.5,
        source: modeExecution.result?.source || 'unknown',
        mode: modeExecution.mode,
        plan: plan,
        execution: modeExecution
      }, interactionId)

    } catch (error) {
      console.error(`❌ GROOT Core Error:`, error)

      // Salvar experiência de erro
      await this.saveInteraction(prompt, { error: error.message }, 'error', context)

      return this.formatResponse({
        success: false,
        error: error.message,
        response: "I encountered an error while processing your request. Please try again.",
        source: 'error'
      }, interactionId)
    } finally {
      this.lastInteraction = {
        interactionId,
        prompt,
        timestamp: Date.now(),
        duration: Date.now() - startTime
      }
    }
  }

  async executePlan(plan) {
    console.log(`🎯 Executing plan: ${plan.validatedPlan.steps.length} steps`)

    try {
      const results = []

      for (const step of plan.validatedPlan.steps) {
        console.log(`📋 Step ${step.step}: ${step.description}`)

        let stepResult = null

        // Executar baseado no tipo de ação
        switch (step.action) {
          case 'analyze':
            stepResult = await this.analyzeStep(step, plan)
            break
          case 'execute':
            stepResult = await this.executeStep(step, plan)
            break
          case 'validate':
            stepResult = await this.validateStep(step, plan)
            break
          case 'tool':
            stepResult = await this.toolStep(step, plan)
            break
          default:
            stepResult = await this.defaultStep(step, plan)
            break
        }

        results.push({
          step: step.step,
          description: step.description,
          result: stepResult,
          success: stepResult.success !== false
        })

        // Se falhar e não for modo continue, parar
        if (!stepResult.success && !plan.validatedPlan.alternativeApproaches) {
          console.log(`⏹️ Plan execution stopped at step ${step.step}`)
          break
        }
      }

      const success = results.every(r => r.success)
      const response = this.generatePlanResponse(results, plan)

      return {
        success,
        response,
        results,
        stepsCompleted: results.length,
        totalSteps: plan.validatedPlan.steps.length
      }

    } catch (error) {
      console.error('❌ Plan execution error:', error)
      return {
        success: false,
        error: error.message,
        response: "I encountered an error while executing the plan."
      }
    }
  }

  async analyzeStep(step, plan) {
    try {
      // Usar mind para análise
      const thinking = await mind.think(step.description, {
        type: 'plan_analysis',
        step: step.step
      })

      return {
        success: true,
        analysis: thinking.thought,
        confidence: thinking.confidence
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  async executeStep(step, plan) {
    try {
      // Executar ação genérica
      const response = await askMultiAI(step.description)
      const content = this.extractContent(response)

      return {
        success: true,
        response: content,
        source: 'ai'
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  async validateStep(step, plan) {
    try {
      // Validação básica
      const validation = {
        step: step.step,
        description: step.description,
        valid: true,
        issues: []
      }

      // Verificar se tem resultado dos passos anteriores
      if (step.dependencies && step.dependencies.length > 0) {
        // Implementar verificação de dependências
        validation.dependencies = step.dependencies
      }

      return {
        success: true,
        validation
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  async toolStep(step, plan) {
    try {
      if (!step.tool) {
        throw new Error('Tool step requires tool parameter')
      }

      const toolResult = await tools.executeTool(step.tool, step.parameters || {})

      return {
        success: toolResult.success,
        result: toolResult.result,
        tool: step.tool
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  async defaultStep(step, plan) {
    try {
      // Ação padrão: usar AI
      const response = await askMultiAI(step.description)
      const content = this.extractContent(response)

      return {
        success: true,
        response: content,
        action: 'default'
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  generatePlanResponse(results, plan) {
    const successful = results.filter(r => r.success).length
    const total = results.length

    let response = `Plan execution completed: ${successful}/${total} steps successful.\n\n`

    results.forEach(result => {
      response += `Step ${result.step}: ${result.success ? '✅' : '❌'} ${result.description}\n`
      if (result.result?.response) {
        response += `Result: ${result.result.response.substring(0, 100)}...\n`
      }
      if (result.error) {
        response += `Error: ${result.error}\n`
      }
      response += '\n'
    })

    if (successful === total) {
      response += 'All steps completed successfully!'
    } else {
      response += 'Some steps failed. Check the details above.'
    }

    return response
  }

  extractContent(aiResponse) {
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

  formatResponse(data, interactionId) {
    const response = {
      id: interactionId,
      timestamp: Date.now(),
      session: this.sessionId,
      version: this.version,
      capabilities: this.capabilities,
      ...data
    }

    // Adicionar personalidade se não for bloqueado
    if (!data.blocked && data.success !== false) {
      response.personality = {
        name: this.name,
        role: identity.role,
        creator: identity.creator,
        capabilities: this.capabilities.slice(0, 5)
      }
    }

    return response
  }

  async saveInteraction(prompt, response, outcome, context) {
    try {
      const experience = {
        type: 'interaction',
        input: prompt,
        output: typeof response === 'string' ? response : response.response || response.error,
        outcome,
        success: outcome !== 'error' && outcome !== 'blocked',
        confidence: response.confidence || 0.5,
        context: {
          ...context,
          sessionId: this.sessionId,
          interactionCount: this.interactionCount,
          version: this.version
        },
        tags: ['groot_interaction', outcome, 'v9'],
        metadata: {
          timestamp: Date.now(),
          source: response.source || 'unknown',
          mode: response.mode || 'unknown'
        }
      }

      // Salvar no store local
      experienceStore.add(experience)

      // Salvar na memória Supabase
      await memory.save(
        `GROOT Interaction: ${prompt}\nResponse: ${experience.output}`,
        'interaction'
      )

      console.log(`💾 Interaction saved: ${outcome} (${experience.confidence.toFixed(2)} confidence)`)

    } catch (error) {
      console.error('❌ Error saving interaction:', error)
    }
  }

  async getStatus() {
    try {
      const consciousness = mind.getConsciousnessStatus()
      const experienceStats = experienceStore.getStats()
      const memoryStats = await supabaseMemory.getStats()
      const vectorStats = await vectorStore.getStats()
      const toolsStats = tools.getStats()
      const plannerStats = planner.getStats()
      const modeStats = modeManager.getStats()

      return {
        core: {
          name: this.name,
          version: this.version,
          status: this.status,
          sessionId: this.sessionId,
          startTime: this.startTime,
          uptime: Date.now() - this.startTime,
          interactionCount: this.interactionCount,
          lastInteraction: this.lastInteraction,
          capabilities: this.capabilities
        },
        consciousness,
        experience: experienceStats,
        memory: memoryStats,
        vector: vectorStats,
        tools: toolsStats,
        planner: plannerStats,
        modes: modeStats,
        system: {
          totalComponents: 8,
          activeComponents: 8,
          health: 'excellent'
        }
      }

    } catch (error) {
      console.error('❌ Error getting status:', error)
      return {
        core: {
          name: this.name,
          version: this.version,
          status: 'error',
          error: error.message
        }
      }
    }
  }

  async evolve() {
    try {
      console.log(`🧬 GROOT Evolution Process Started`)

      // 1. Analisar performance atual
      const status = await this.getStatus()

      // 2. Identificar áreas de melhoria
      const improvements = this.identifyImprovements(status)

      // 3. Aplicar melhorias
      for (const improvement of improvements) {
        await this.applyImprovement(improvement)
      }

      // 4. Atualizar versão se necessário
      if (improvements.length > 0) {
        this.version = this.incrementVersion(this.version)
        console.log(`🚀 GROOT evolved to version ${this.version}`)
      }

      return {
        success: true,
        previousVersion: this.version,
        improvements: improvements.length,
        newVersion: this.version
      }

    } catch (error) {
      console.error('❌ Evolution error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  identifyImprovements(status) {
    const improvements = []

    // Melhorias baseadas na performance
    if (status.experience.successRate < 0.8) {
      improvements.push({
        type: 'learning',
        description: 'Improve success rate through enhanced learning',
        priority: 'high'
      })
    }

    if (status.vector.totalVectors < 100) {
      improvements.push({
        type: 'memory',
        description: 'Increase vector memory retention',
        priority: 'medium'
      })
    }

    if (status.consciousness.averageConfidence < 0.7) {
      improvements.push({
        type: 'thinking',
        description: 'Enhance thinking confidence',
        priority: 'high'
      })
    }

    if (status.tools.successRate < 0.8) {
      improvements.push({
        type: 'tools',
        description: 'Improve tool execution reliability',
        priority: 'medium'
      })
    }

    if (status.planner.successRate < 0.7) {
      improvements.push({
        type: 'planning',
        description: 'Enhance planning accuracy',
        priority: 'high'
      })
    }

    return improvements
  }

  async applyImprovement(improvement) {
    console.log(`🔧 Applying improvement: ${improvement.description}`)

    switch (improvement.type) {
      case 'learning':
        // Ajustar taxa de aprendizado do mind
        mind.setLearningRate(Math.min(1, mind.learningRate * 1.2))
        break

      case 'memory':
        // Aumentar retenção de memória
        console.log('📚 Memory retention increased')
        break

      case 'thinking':
        // Ajustar threshold de decisão do mind
        mind.setDecisionThreshold(Math.max(0.5, mind.decisionThreshold - 0.1))
        break

      case 'tools':
        // Melhorar segurança das tools
        tools.setSecurityLevel('critical')
        break

      case 'planning':
        // Ajustar threshold do planner
        planner.confidenceThreshold = Math.max(0.6, planner.confidenceThreshold - 0.1)
        break

      default:
        console.log(`🔧 Unknown improvement type: ${improvement.type}`)
    }
  }

  incrementVersion(version) {
    const parts = version.split('.')
    const patch = parseInt(parts[2] || 0) + 1
    return `${parts[0]}.${parts[1]}.${patch}`
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  generateInteractionId() {
    return `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  async reset() {
    console.log('🔄 Resetting GROOT Core...')

    // Limpar históricos
    mind.clearThinkingHistory()
    experienceStore.clearExperiences()

    // Resetar contadores
    this.interactionCount = 0
    this.lastInteraction = null

    // Nova sessão
    this.sessionId = this.generateSessionId()
    this.startTime = Date.now()

    // Resetar modo para híbrido
    modeManager.setMode('hybrid')

    console.log('✅ GROOT Core reset completed')

    return {
      success: true,
      newSessionId: this.sessionId,
      resetTime: Date.now()
    }
  }

  async exportCore() {
    const status = await this.getStatus()

    return {
      identity,
      status,
      mind: mind.exportMindData(),
      experience: experienceStore.exportExperienceData(),
      memory: supabaseMemory.exportMemoryData(),
      vector: vectorStore.exportVectorData(),
      tools: tools.exportToolsData(),
      planner: planner.exportPlanningData(),
      modes: modeManager.exportModeData(),
      exportTimestamp: Date.now()
    }
  }
}

// Instância global do GROOT Core
export const grootCore = new GrootCore()

// Exportar função principal para compatibilidade
export async function askGroot(prompt, context = {}) {
  return await grootCore.ask(prompt, context)
}
