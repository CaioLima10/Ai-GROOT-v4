import { askGroot } from '../core/aiBrain.js'
import { taskPlanner } from './taskPlanner.js'
import { fileSystem } from './fileSystem.js'
import { commandRunner } from './commandRunner.js'
import { selfEditor } from './selfEditor.js'

export class DevinLoop {
  constructor() {
    this.isRunning = false
    this.loopInterval = null
    this.currentTask = null
    this.taskQueue = []
    this.performance = {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      averageTime: 0
    }
    this.autonomousMode = true
    this.learningEnabled = true
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️ Devin Loop já está em execução')
      return
    }
    
    console.log('🚀 Iniciando Devin Loop - Modo Autônomo')
    this.isRunning = true
    
    // Iniciar loop principal
    this.loopInterval = setInterval(async () => {
      await this.executeLoop()
    }, 15000) // 15 segundos
    
    // Executar primeira tarefa imediatamente
    await this.executeLoop()
  }

  async stop() {
    if (!this.isRunning) {
      console.log('⚠️ Devin Loop não está em execução')
      return
    }
    
    console.log('⏹️ Parando Devin Loop')
    this.isRunning = false
    
    if (this.loopInterval) {
      clearInterval(this.loopInterval)
      this.loopInterval = null
    }
  }

  async executeLoop() {
    if (!this.isRunning) return
    
    console.log('🔄 Executando ciclo autônomo...')
    
    try {
      // 1. Verificar se há tarefas na fila
      if (this.taskQueue.length > 0) {
        const task = this.taskQueue.shift()
        await this.executeTask(task)
      } else {
        // 2. Gerar tarefa autônoma
        const autonomousTask = await this.generateAutonomousTask()
        if (autonomousTask) {
          await this.executeTask(autonomousTask)
        }
      }
      
      // 3. Aprendizado e melhoria
      if (this.learningEnabled) {
        await this.performLearning()
      }
      
      // 4. Manutenção do sistema
      await this.performMaintenance()
      
    } catch (error) {
      console.error('❌ Erro no ciclo autônomo:', error)
      
      // Continuar mesmo com erro
      this.performance.failedTasks++
    }
  }

  async generateAutonomousTask() {
    console.log('🤔 Gerando tarefa autônoma...')
    
    const autonomousTasks = [
      'Verificar erros no projeto',
      'Analisar performance do código',
      'Buscar atualizações de dependências',
      'Revisar código recentemente modificado',
      'Otimizar arquivos grandes',
      'Verificar segurança do projeto',
      'Analisar estrutura do projeto',
      'Buscar melhores práticas',
      'Testar funcionalidades principais',
      'Limpar arquivos temporários',
      'Verificar configurações',
      'Analisar logs de erro',
      'Otimizar imports',
      'Verificar cobertura de testes'
    ]
    
    // Selecionar tarefa baseada em prioridade e estado atual
    const task = autonomousTasks[Math.floor(Math.random() * autonomousTasks.length)]
    
    return {
      type: 'autonomous',
      description: task,
      priority: 'medium',
      timestamp: Date.now()
    }
  }

  async executeTask(task) {
    const startTime = Date.now()
    this.currentTask = task
    
    console.log(`🎯 Executando tarefa: ${task.description}`)
    
    try {
      // 1. Planejar tarefa
      const plan = await taskPlanner.plan(task.description, {
        autonomous: true,
        priority: task.priority
      })
      
      if (!plan.success) {
        throw new Error(`Falha ao planejar tarefa: ${plan.error}`)
      }
      
      // 2. Executar plano
      const execution = await this.executePlanSteps(plan.plan, task)
      
      // 3. Atualizar performance
      const duration = Date.now() - startTime
      this.updatePerformance(execution.success, duration)
      
      console.log(`✅ Tarefa concluída: ${task.description} (${duration}ms)`)
      
      return {
        success: true,
        task,
        plan,
        execution,
        duration
      }
      
    } catch (error) {
      const duration = Date.now() - startTime
      this.updatePerformance(false, duration)
      
      console.error(`❌ Falha na tarefa: ${task.description}`, error)
      
      return {
        success: false,
        task,
        error: error.message,
        duration
      }
    } finally {
      this.currentTask = null
    }
  }

  async executePlanSteps(plan, task) {
    const results = []
    
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i]
      
      console.log(`📋 Passo ${i + 1}/${plan.steps.length}: ${step}`)
      
      try {
        const stepResult = await this.executeStep(step, task)
        results.push({
          step,
          stepNumber: i + 1,
          success: stepResult.success,
          result: stepResult
        })
        
        // Se falhar e não for modo continue, parar
        if (!stepResult.success) {
          console.log(`⏹️ Parando execução no passo: ${step}`)
          break
        }
        
      } catch (error) {
        console.error(`❌ Erro no passo ${i + 1}: ${step}`, error)
        results.push({
          step,
          stepNumber: i + 1,
          success: false,
          error: error.message
        })
        break
      }
    }
    
    return {
      plan,
      results,
      totalSteps: plan.steps.length,
      completedSteps: results.filter(r => r.success).length,
      success: results.every(r => r.success)
    }
  }

  async executeStep(step, task) {
    const lowerStep = step.toLowerCase()
    
    // Análise de código
    if (lowerStep.includes('analisar') || lowerStep.includes('análise')) {
      return await this.analyzeCode(task)
    }
    
    // Verificar erros
    if (lowerStep.includes('erro') || lowerStep.includes('verificar')) {
      return await this.checkErrors(task)
    }
    
    // Otimizar
    if (lowerStep.includes('otimizar') || lowerStep.includes('performance')) {
      return await this.optimizeCode(task)
    }
    
    // Instalar dependências
    if (lowerStep.includes('instalar') || lowerStep.includes('dependência')) {
      return await this.installDependencies(task)
    }
    
    // Testar
    if (lowerStep.includes('testar') || lowerStep.includes('teste')) {
      return await this.runTests(task)
    }
    
    // Revisar código
    if (lowerStep.includes('revisar') || lowerStep.includes('código')) {
      return await this.reviewCode(task)
    }
    
    // Limpar
    if (lowerStep.includes('limpar') || lowerStep.includes('temporário')) {
      return await this.cleanupFiles(task)
    }
    
    // Verificar segurança
    if (lowerStep.includes('segurança') || lowerStep.includes('vulnerabil')) {
      return await this.checkSecurity(task)
    }
    
    // Tarefa genérica - usar IA
    return await this.executeGenericStep(step, task)
  }

  async analyzeCode(task) {
    console.log('🔍 Analisando código do projeto...')
    
    try {
      // Buscar arquivos principais
      const mainFiles = ['index.js', 'app.js', 'server.js', 'main.js']
      
      for (const file of mainFiles) {
        if (fileSystem.exists(file)) {
          const content = await fileSystem.read(file)
          if (content.success) {
            const analysis = await askGroot(`Analise este código: ${content.content}`)
            return {
              success: true,
              message: `Código analisado: ${file}`,
              analysis
            }
          }
        }
      }
      
      return {
        success: true,
        message: 'Nenhum arquivo principal encontrado para análise'
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  async checkErrors(task) {
    console.log('🐛 Verificando erros no projeto...')
    
    try {
      // Verificar sintaxe dos arquivos JS
      const jsFiles = ['*.js', '*.jsx', '*.ts', '*.tsx']
      
      for (const pattern of jsFiles) {
        const result = await commandRunner.run(`node -c ${pattern}`, { silent: true })
        if (!result.success) {
          return {
            success: true,
            message: 'Erros de sintaxe encontrados',
            errors: result.error
          }
        }
      }
      
      return {
        success: true,
        message: 'Nenhum erro de sintaxe encontrado'
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  async optimizeCode(task) {
    console.log('⚡ Otimizando código...')
    
    try {
      const files = ['index.js', 'app.js', 'server.js']
      
      for (const file of files) {
        if (fileSystem.exists(file)) {
          const result = await selfEditor.optimize(file, 'performance')
          if (result.success) {
            return {
              success: true,
              message: `Arquivo otimizado: ${file}`,
              result
            }
          }
        }
      }
      
      return {
        success: true,
        message: 'Nenhum arquivo encontrado para otimização'
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  async installDependencies(task) {
    console.log('📦 Instalando dependências...')
    
    try {
      const result = await commandRunner.installDependencies()
      return result
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  async runTests(task) {
    console.log('🧪 Executando testes...')
    
    try {
      const result = await commandRunner.runTests()
      return result
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  async reviewCode(task) {
    console.log('👀 Revisando código...')
    
    try {
      const files = ['*.js', '*.jsx', '*.ts', '*.tsx']
      const result = await commandRunner.run(`npx eslint ${files}`, { silent: true })
      
      return {
        success: true,
        message: 'Código revisado',
        result
      }
      
    } catch (error) {
      return {
        success: true,
        message: 'Problemas encontrados na revisão',
        issues: error.message
      }
    }
  }

  async cleanupFiles(task) {
    console.log('🧹 Limpando arquivos temporários...')
    
    try {
      const cleanupCommands = [
        'rm -rf node_modules/.cache',
        'rm -rf .nyc_output',
        'rm -rf dist',
        'rm -rf build',
        'npm cache clean --force'
      ]
      
      for (const cmd of cleanupCommands) {
        await commandRunner.run(cmd, { silent: true })
      }
      
      return {
        success: true,
        message: 'Arquivos temporários limpos'
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  async checkSecurity(task) {
    console.log('🔒 Verificando segurança...')
    
    try {
      const result = await commandRunner.run('npm audit', { silent: true })
      
      return {
        success: true,
        message: 'Verificação de segurança concluída',
        result
      }
      
    } catch (error) {
      return {
        success: true,
        message: 'Vulnerabilidades encontradas',
        vulnerabilities: error.message
      }
    }
  }

  async executeGenericStep(step, task) {
    console.log(`🤖 Executando passo genérico: ${step}`)
    
    try {
      const response = await askGroot(`Como executar: ${step}`)
      
      return {
        success: true,
        message: 'Passo executado com IA',
        response
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  async performLearning() {
    console.log('🧠 Realizando aprendizado...')
    
    try {
      // Analisar performance das tarefas
      const performance = this.getPerformance()
      
      // Identificar padrões de falha
      const failedTasks = this.taskQueue
        .filter(t => t.result && !t.result.success)
        .slice(-10)
      
      if (failedTasks.length > 3) {
        console.log('📊 Muitas falhas recentes, ajustando estratégia...')
        // Ajustar estratégia futura
      }
      
      // Salvar aprendizados
      await this.saveLearnings(performance, failedTasks)
      
    } catch (error) {
      console.error('❌ Erro no aprendizado:', error)
    }
  }

  async performMaintenance() {
    console.log('🔧 Realizando manutenção...')
    
    try {
      // Limpar histórico antigo
      if (this.taskQueue.length > 100) {
        this.taskQueue = this.taskQueue.slice(-50)
      }
      
      // Verificar uso de memória
      if (global.gc) {
        global.gc()
      }
      
      // Salvar estado atual
      await this.saveState()
      
    } catch (error) {
      console.error('❌ Erro na manutenção:', error)
    }
  }

  async saveLearnings(performance, failedTasks) {
    const learningData = {
      performance,
      failedTasks,
      timestamp: Date.now(),
      autonomousMode: this.autonomousMode
    }
    
    await fileSystem.write('system/learnings.json', JSON.stringify(learningData, null, 2))
  }

  async saveState() {
    const state = {
      isRunning: this.isRunning,
      performance: this.performance,
      taskQueueLength: this.taskQueue.length,
      currentTask: this.currentTask,
      timestamp: Date.now()
    }
    
    await fileSystem.write('system/devinState.json', JSON.stringify(state, null, 2))
  }

  addTask(task, priority = 'medium') {
    this.taskQueue.push({
      ...task,
      priority,
      addedAt: Date.now()
    })
    
    // Ordenar por prioridade
    this.taskQueue.sort((a, b) => {
      const priorities = { high: 3, medium: 2, low: 1 }
      return (priorities[b.priority] || 1) - (priorities[a.priority] || 1)
    })
    
    console.log(`📝 Tarefa adicionada à fila: ${task.description}`)
  }

  updatePerformance(success, duration) {
    this.performance.totalTasks++
    
    if (success) {
      this.performance.successfulTasks++
    } else {
      this.performance.failedTasks++
    }
    
    // Calcular média móvel
    this.performance.averageTime = 
      (this.performance.averageTime * (this.performance.totalTasks - 1) + duration) / 
      this.performance.totalTasks
  }

  getPerformance() {
    return {
      ...this.performance,
      successRate: this.performance.totalTasks > 0 
        ? (this.performance.successfulTasks / this.performance.totalTasks * 100).toFixed(1) + '%'
        : '0%'
    }
  }

  getTaskQueue() {
    return this.taskQueue
  }

  clearTaskQueue() {
    this.taskQueue = []
    console.log('🧹 Fila de tarefas limpa')
  }

  enableAutonomousMode() {
    this.autonomousMode = true
    console.log('🤖 Modo autônomo ativado')
  }

  disableAutonomousMode() {
    this.autonomousMode = false
    console.log('👤 Modo autônomo desativado')
  }

  enableLearning() {
    this.learningEnabled = true
    console.log('🧠 Aprendizado ativado')
  }

  disableLearning() {
    this.learningEnabled = false
    console.log('🚫 Aprendizado desativado')
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      autonomousMode: this.autonomousMode,
      learningEnabled: this.learningEnabled,
      currentTask: this.currentTask,
      taskQueueLength: this.taskQueue.length,
      performance: this.getPerformance()
    }
  }
}

export const devinLoop = new DevinLoop()

// Auto-iniciar se for o arquivo principal
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 Iniciando Devin Loop automaticamente...')
  devinLoop.start()
}
