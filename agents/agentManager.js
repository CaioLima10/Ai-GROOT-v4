import { codeAgent } from './codeAgent.js'
import { fixAgent } from './fixAgent.js'
import { learnAgent } from './learnAgent.js'
import { githubAgent } from './githubAgent.js'
import { stackoverflowAgent } from './stackoverflowAgent.js'
import { projectAgent } from './projectAgent.js'
import { reasoningAgent } from './reasoningAgent.js'
import { autoUpgradeAgent } from './autoUpgradeAgent.js'
import { devinAgent } from './devinAgent.js'

export class AgentManager {
  constructor() {
    this.agents = {
      code: codeAgent,
      fix: fixAgent,
      learn: learnAgent,
      github: githubAgent,
      stackoverflow: stackoverflowAgent,
      project: projectAgent,
      reasoning: reasoningAgent,
      upgrade: autoUpgradeAgent,
      devin: devinAgent
    }

    this.executionHistory = []
    this.learningLoop = null
  }

  async run(task, context = {}) {
    const taskId = this.generateTaskId()
    const startTime = Date.now()

    console.log(`🤖 AgentManager: Iniciando tarefa ${taskId}`)
    console.log(`📋 Tarefa: ${task}`)

    try {
      // 1. Analisar tarefa com reasoning
      const analysis = await this.agents.reasoning.analyze(task, context)
      console.log(`🧠 Análise: ${analysis.intent} (confiança: ${analysis.confidence})`)

      // 2. Selecionar agente(s) baseado na análise
      const selectedAgents = this.selectAgents(analysis)
      console.log(`🎯 Agentes selecionados: ${selectedAgents.map(a => a.name).join(', ')}`)

      // 3. Executar agentes em paralelo se possível
      const results = await this.executeAgents(selectedAgents, task, analysis, context)

      // 4. Combinar e refinar resultados
      const finalResult = await this.combineResults(results, analysis)

      // 5. Aprender com a execução
      await this.learnFromExecution(task, analysis, results, finalResult)

      // 6. Salvar no histórico
      this.saveExecution({
        id: taskId,
        task,
        analysis,
        agents: selectedAgents.map(a => a.name),
        result: finalResult,
        duration: Date.now() - startTime,
        timestamp: Date.now()
      })

      console.log(`✅ Tarefa ${taskId} concluída em ${Date.now() - startTime}ms`)
      return finalResult

    } catch (error) {
      console.error(`❌ Erro na tarefa ${taskId}:`, error)

      // Fallback para aprendizado
      return await this.agents.learn.run(`Erro ao executar: ${task}. Erro: ${error.message}`)
    }
  }

  selectAgents(analysis, task) {
    const agents = []

    // Verificar se é tarefa autônoma (prioridade para Devin)
    if (analysis.intent?.type === 'autonomous' || task.includes('autônomo') || task.includes('sozinho')) {
      agents.push(this.agents.devin)
      console.log('🤖 Usando Devin Agent para tarefa autônoma')
      return agents
    }

    // Verificar se é tarefa de criação/edição
    if (task.includes('criar') || task.includes('novo') || task.includes('editar')) {
      agents.push(this.agents.devin)
      console.log('🤖 Usando Devin Agent para criação/edição')
    }

    // Baseado no intent e confiança
    switch (analysis.intent?.type) {
      case 'code_generation':
        agents.push(this.agents.code)
        if (analysis.needsLearning) agents.push(this.agents.learn)
        break

      case 'error_fix':
        agents.push(this.agents.fix)
        agents.push(this.agents.stackoverflow)
        agents.push(this.agents.learn)
        break

      case 'learning':
        agents.push(this.agents.learn)
        agents.push(this.agents.github)
        agents.push(this.agents.stackoverflow)
        break

      case 'project_analysis':
        agents.push(this.agents.project)
        agents.push(this.agents.code)
        break

      case 'upgrade':
        agents.push(this.agents.upgrade)
        agents.push(this.agents.github)
        break

      default:
        // Usar reasoning para decidir
        agents.push(this.agents.reasoning)
        agents.push(this.agents.learn)
    }

    return agents
  }

  async executeAgents(agents, task, analysis, context) {
    const executions = agents.map(async (agent) => {
      try {
        const result = await agent.run(task, analysis, context)
        return {
          agent: agent.name,
          success: true,
          result,
          confidence: result.confidence || 0.8
        }
      } catch (error) {
        console.error(`❌ Erro no agente ${agent.name}:`, error)
        return {
          agent: agent.name,
          success: false,
          error: error.message,
          confidence: 0
        }
      }
    })

    return await Promise.all(executions)
  }

  async combineResults(results, analysis) {
    // Filtrar resultados bem-sucedidos
    const successful = results.filter(r => r.success)

    if (successful.length === 0) {
      throw new Error('Todos os agentes falharam')
    }

    // Ordenar por confiança
    successful.sort((a, b) => b.confidence - a.confidence)

    // Se houver múltiplos resultados, combinar
    if (successful.length > 1) {
      return await this.agents.reasoning.combine(successful, analysis)
    }

    return successful[0].result
  }

  async learnFromExecution(task, analysis, results, finalResult) {
    const learningData = {
      task,
      intent: analysis.intent,
      agentsUsed: results.map(r => r.agent),
      successRate: results.filter(r => r.success).length / results.length,
      result: finalResult,
      timestamp: Date.now()
    }

    // Salvar aprendizado
    await this.agents.learn.run(`Execução concluída: ${JSON.stringify(learningData)}`, analysis)
  }

  saveExecution(execution) {
    this.executionHistory.push(execution)

    // Manter apenas últimas 100 execuções
    if (this.executionHistory.length > 100) {
      this.executionHistory = this.executionHistory.slice(-100)
    }
  }

  startLearningLoop() {
    if (this.learningLoop) {
      console.log('🔄 Learning loop já está ativo')
      return
    }

    console.log('🚀 Iniciando learning loop infinito...')

    this.learningLoop = setInterval(async () => {
      try {
        await this.performLearningCycle()
      } catch (error) {
        console.error('❌ Erro no learning loop:', error)
      }
    }, 30000) // A cada 30 segundos
  }

  async performLearningCycle() {
    console.log('📚 Ciclo de aprendizado...')

    // 1. Aprender com GitHub
    await this.agents.github.run('discover new repositories', { auto: true })

    // 2. Aprender com StackOverflow
    await this.agents.stackoverflow.run('discover new solutions', { auto: true })

    // 3. Analisar execuções passadas
    if (this.executionHistory.length > 0) {
      const recentExecutions = this.executionHistory.slice(-10)
      await this.agents.reasoning.analyzeExecutions(recentExecutions)
    }

    // 4. Auto-upgrade se necessário (PROTEGIDO)
    try {
      if (this.agents.upgrade && typeof this.agents.upgrade.checkIfNeeded === 'function') {
        await this.agents.upgrade.checkIfNeeded()
      } else {
        console.log("⚠️ AutoUpgradeAgent não disponível ou sem checkIfNeeded")
      }
    } catch (upgradeError) {
      console.error("❌ Erro no auto-upgrade:", upgradeError.message)
      // Não quebrar o loop por erro de upgrade
    }

    console.log('✅ Ciclo de aprendizado concluído')
  }

  stopLearningLoop() {
    if (this.learningLoop) {
      clearInterval(this.learningLoop)
      this.learningLoop = null
      console.log('⏹️ Learning loop parado')
    }
  }

  generateTaskId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  getStats() {
    return {
      totalExecutions: this.executionHistory.length,
      agentsCount: Object.keys(this.agents).length,
      learningLoopActive: !!this.learningLoop,
      recentExecutions: this.executionHistory.slice(-5),
      successRate: this.calculateSuccessRate()
    }
  }

  calculateSuccessRate() {
    if (this.executionHistory.length === 0) return 0

    const successful = this.executionHistory.filter(e =>
      e.result && !e.result.error
    ).length

    return (successful / this.executionHistory.length * 100).toFixed(2)
  }
}

export const agentManager = new AgentManager()

// Iniciar learning loop automaticamente
agentManager.startLearningLoop()
