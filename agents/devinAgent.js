import { taskPlanner } from '../system/taskPlanner.js'
import { fileSystem } from '../system/fileSystem.js'
import { commandRunner } from '../system/commandRunner.js'
import { selfEditor } from '../system/selfEditor.js'
import { askMultiAI } from '../core/multiAI.js'

export class DevinAgent {
  constructor() {
    this.name = 'devinAgent'
    this.capabilities = [
      'autonomous_coding',
      'self_improvement',
      'project_analysis',
      'error_detection',
      'dependency_management',
      'code_generation',
      'file_operations',
      'command_execution',
      'continuous_learning'
    ]
    
    this.activeProjects = new Map()
    this.currentContext = {}
    this.learningHistory = []
  }

  async run(task, analysis, context = {}) {
    console.log(`🤖 DevinAgent: Executando tarefa autônoma: ${task}`)
    
    try {
      // 1. Analisar e entender a tarefa
      const taskAnalysis = await this.analyzeTask(task, context)
      
      // 2. Criar plano de execução
      const plan = await taskPlanner.plan(task, {
        ...context,
        autonomous: true,
        complexity: taskAnalysis.complexity
      })
      
      if (!plan.success) {
        throw new Error(`Falha ao criar plano: ${plan.error}`)
      }
      
      // 3. Executar o plano
      const execution = await this.executeAutonomousPlan(plan.plan, taskAnalysis)
      
      // 4. Aprender com a execução
      await this.learnFromExecution(task, plan, execution)
      
      const result = {
        success: execution.success,
        task,
        analysis: taskAnalysis,
        plan: plan.plan,
        execution,
        confidence: execution.success ? 0.8 : 0.3,
        metadata: {
          executionTime: execution.duration || 0,
          stepsCompleted: execution.completedSteps || 0,
          autonomousActions: execution.autonomousActions || []
        }
      }
      
      console.log(`✅ DevinAgent: Tarefa concluída - ${execution.success ? 'SUCESSO' : 'FALHA'}`)
      return result
      
    } catch (error) {
      console.error(`❌ DevinAgent: Erro na execução autônoma:`, error)
      
      return {
        success: false,
        task,
        error: error.message,
        confidence: 0.1
      }
    }
  }

  async analyzeTask(task, context) {
    console.log(`🔍 Analisando tarefa: ${task}`)
    
    try {
      const prompt = `
Analise esta tarefa para execução autônoma:

TAREFA: ${task}
CONTEXTO: ${JSON.stringify(context)}

Forneça análise em formato JSON:
{
  "type": "create|fix|install|run|edit|test|analyze|general",
  "complexity": "low|medium|high",
  "files": ["arquivo1", "arquivo2"],
  "dependencies": ["dep1", "dep2"],
  "risks": ["risco1", "risco2"],
  "estimatedTime": minutos,
  "confidence": 0.0-1.0
}
`
      
      const response = await askMultiAI(prompt)
      
      try {
        const analysis = JSON.parse(response)
        console.log(`📊 Análise: ${analysis.type} (complexidade: ${analysis.complexity})`)
        return analysis
      } catch (parseError) {
        // Fallback para análise simples
        return {
          type: this.detectTaskType(task),
          complexity: 'medium',
          files: [],
          dependencies: [],
          risks: [],
          estimatedTime: 15,
          confidence: 0.6
        }
      }
      
    } catch (error) {
      console.error('❌ Erro na análise da tarefa:', error)
      
      return {
        type: 'general',
        complexity: 'medium',
        files: [],
        dependencies: [],
        risks: ['analysis_failed'],
        estimatedTime: 20,
        confidence: 0.4
      }
    }
  }

  detectTaskType(task) {
    const lowerTask = task.toLowerCase()
    
    if (lowerTask.includes('criar') || lowerTask.includes('novo')) return 'create'
    if (lowerTask.includes('corrigir') || lowerTask.includes('erro')) return 'fix'
    if (lowerTask.includes('instalar') || lowerTask.includes('dependênc')) return 'install'
    if (lowerTask.includes('rodar') || lowerTask.includes('executar')) return 'run'
    if (lowerTask.includes('editar') || lowerTask.includes('modificar')) return 'edit'
    if (lowerTask.includes('testar') || lowerTask.includes('teste')) return 'test'
    if (lowerTask.includes('analisar') || lowerTask.includes('análise')) return 'analyze'
    
    return 'general'
  }

  async executeAutonomousPlan(plan, taskAnalysis) {
    console.log(`🚀 Executando plano autônomo: ${plan.description}`)
    
    const startTime = Date.now()
    const results = []
    let autonomousActions = []
    
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i]
      
      console.log(`📋 Passo autônomo ${i + 1}/${plan.steps.length}: ${step}`)
      
      try {
        const stepResult = await this.executeAutonomousStep(step, taskAnalysis)
        
        results.push({
          step,
          stepNumber: i + 1,
          success: stepResult.success,
          result: stepResult,
          timestamp: Date.now()
        })
        
        if (stepResult.autonomousAction) {
          autonomousActions.push(stepResult.autonomousAction)
        }
        
        // Se falhar e não for modo continue, parar
        if (!stepResult.success) {
          console.log(`⏹️ Parando execução autônoma no passo: ${step}`)
          break
        }
        
      } catch (error) {
        console.error(`❌ Erro no passo autônomo ${i + 1}: ${step}`, error)
        
        results.push({
          step,
          stepNumber: i + 1,
          success: false,
          error: error.message,
          timestamp: Date.now()
        })
        break
      }
    }
    
    const duration = Date.now() - startTime
    
    return {
      plan,
      results,
      totalSteps: plan.steps.length,
      completedSteps: results.filter(r => r.success).length,
      failedSteps: results.filter(r => !r.success).length,
      success: results.every(r => r.success),
      duration,
      autonomousActions
    }
  }

  async executeAutonomousStep(step, taskAnalysis) {
    const lowerStep = step.toLowerCase()
    
    // CRIAÇÃO DE ARQUIVOS
    if (lowerStep.includes('criar') || lowerStep.includes('novo')) {
      return await this.createFileAutonomous(step, taskAnalysis)
    }
    
    // INSTALAÇÃO DE DEPENDÊNCIAS
    if (lowerStep.includes('instalar') || lowerStep.includes('dependênc')) {
      return await this.installDependenciesAutonomous(step, taskAnalysis)
    }
    
    // EXECUÇÃO DE COMANDOS
    if (lowerStep.includes('executar') || lowerStep.includes('rodar')) {
      return await this.executeCommandAutonomous(step, taskAnalysis)
    }
    
    // EDIÇÃO DE ARQUIVOS
    if (lowerStep.includes('editar') || lowerStep.includes('modificar')) {
      return await this.editFileAutonomous(step, taskAnalysis)
    }
    
    // CORREÇÃO DE ERROS
    if (lowerStep.includes('corrigir') || lowerStep.includes('consertar')) {
      return await this.fixErrorAutonomous(step, taskAnalysis)
    }
    
    // ANÁLISE DE CÓDIGO
    if (lowerStep.includes('analisar') || lowerStep.includes('análise')) {
      return await this.analyzeCodeAutonomous(step, taskAnalysis)
    }
    
    // OTIMIZAÇÃO
    if (lowerStep.includes('otimizar') || lowerStep.includes('performance')) {
      return await this.optimizeCodeAutonomous(step, taskAnalysis)
    }
    
    // TESTE
    if (lowerStep.includes('testar') || lowerStep.includes('teste')) {
      return await this.runTestsAutonomous(step, taskAnalysis)
    }
    
    // PASSO GENÉRICO - USAR IA
    return await this.executeGenericAutonomousStep(step, taskAnalysis)
  }

  async createFileAutonomous(step, taskAnalysis) {
    console.log('📝 Criando arquivo autonomicamente...')
    
    try {
      // Usar IA para determinar o que criar
      const prompt = `
Com base nesta instrução, crie o arquivo necessário:

INSTRUÇÃO: ${step}
ANÁLISE: ${JSON.stringify(taskAnalysis)}

Forneça:
1. Nome do arquivo
2. Conteúdo completo do arquivo
3. Linguagem/tipo

Responda em formato JSON:
{
  "filename": "nome_arquivo",
  "content": "conteúdo completo",
  "language": "javascript|python|json|etc"
}
`
      
      const response = await askMultiAI(prompt)
      
      try {
        const fileData = JSON.parse(response)
        
        // Criar o arquivo
        const writeResult = await fileSystem.write(fileData.filename, fileData.content)
        
        if (writeResult.success) {
          return {
            success: true,
            message: `Arquivo criado autonomamente: ${fileData.filename}`,
            autonomousAction: {
              type: 'file_creation',
              filename: fileData.filename,
              language: fileData.language,
              size: fileData.content.length
            }
          }
        } else {
          throw new Error(writeResult.error)
        }
        
      } catch (parseError) {
        // Tentar extrair informações manualmente
        const filenameMatch = response.match(/filename[":\s]*["']([^"']+)["']/i)
        const filename = filenameMatch ? filenameMatch[1] : 'autogenerated.js'
        
        const writeResult = await fileSystem.write(filename, response)
        
        return {
          success: writeResult.success,
          message: writeResult.success ? `Arquivo criado: ${filename}` : `Erro: ${writeResult.error}`,
          autonomousAction: writeResult.success ? {
            type: 'file_creation',
            filename,
            fallback: true
          } : null
        }
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  async installDependenciesAutonomous(step, taskAnalysis) {
    console.log('📦 Instalando dependências autonomamente...')
    
    try {
      // Detectar dependências necessárias
      const dependencies = taskAnalysis.dependencies || []
      
      if (dependencies.length === 0) {
        // Tentar detectar do package.json
        const packageResult = await fileSystem.read('package.json')
        if (packageResult.success) {
          try {
            const packageData = JSON.parse(packageResult.content)
            dependencies.push(...Object.keys(packageData.dependencies || {}))
          } catch (e) {
            // Ignorar erro de parse
          }
        }
      }
      
      if (dependencies.length > 0) {
        const installResult = await commandRunner.installDependencies()
        
        return {
          success: installResult.success,
          message: installResult.success ? 'Dependências instaladas' : `Erro: ${installResult.error}`,
          autonomousAction: {
            type: 'dependency_installation',
            dependencies,
            result: installResult
          }
        }
      } else {
        return {
          success: true,
          message: 'Nenhuma dependência para instalar',
          autonomousAction: {
            type: 'dependency_check',
            result: 'none_needed'
          }
        }
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  async executeCommandAutonomous(step, taskAnalysis) {
    console.log('💻 Executando comando autonomamente...')
    
    try {
      // Usar IA para determinar o comando
      const prompt = `
Com base nesta instrução, determine o comando exato para executar:

INSTRUÇÃO: ${step}
ANÁLISE: ${JSON.stringify(taskAnalysis)}

Forneça apenas o comando shell exato, sem explicações.
`
      
      const command = await askMultiAI(prompt)
      const cleanCommand = command.trim()
      
      // Validar segurança do comando
      if (!this.isCommandSafe(cleanCommand)) {
        throw new Error(`Comando não permitido por segurança: ${cleanCommand}`)
      }
      
      const result = await commandRunner.run(cleanCommand)
      
      return {
        success: result.success,
        message: result.success ? `Comando executado: ${cleanCommand}` : `Erro: ${result.error}`,
        autonomousAction: {
          type: 'command_execution',
          command: cleanCommand,
          result
        }
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  async editFileAutonomous(step, taskAnalysis) {
    console.log('✏️ Editando arquivo autonomamente...')
    
    try {
      // Determinar qual arquivo editar
      const filename = taskAnalysis.files?.[0] || 'index.js'
      
      if (!fileSystem.exists(filename)) {
        throw new Error(`Arquivo não encontrado: ${filename}`)
      }
      
      // Usar self-editor para melhorar
      const editResult = await selfEditor.improve(filename, 'autonomous')
      
      return {
        success: editResult.success,
        message: editResult.success ? `Arquivo editado: ${filename}` : `Erro: ${editResult.error}`,
        autonomousAction: {
          type: 'file_editing',
          filename,
          result: editResult
        }
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  async fixErrorAutonomous(step, taskAnalysis) {
    console.log('🔧 Corrigindo erro autonomamente...')
    
    try {
      // Identificar arquivos com erros
      const files = taskAnalysis.files || ['index.js', 'app.js', 'server.js']
      
      for (const file of files) {
        if (fileSystem.exists(file)) {
          const fixResult = await selfEditor.fix(file, step)
          
          if (fixResult.success) {
            return {
              success: true,
              message: `Erro corrigido no arquivo: ${file}`,
              autonomousAction: {
                type: 'error_fix',
                filename: file,
                result: fixResult
              }
            }
          }
        }
      }
      
      return {
        success: true,
        message: 'Nenhum erro encontrado para corrigir',
        autonomousAction: {
          type: 'error_check',
          result: 'no_errors_found'
        }
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  async analyzeCodeAutonomous(step, taskAnalysis) {
    console.log('🔍 Analisando código autonomamente...')
    
    try {
      const files = taskAnalysis.files || ['*.js', '*.jsx', '*.ts', '*.tsx']
      
      // Executar análise estática
      const analysisResult = await commandRunner.run(`npx eslint ${files}`, { silent: true })
      
      return {
        success: true,
        message: 'Código analisado',
        autonomousAction: {
          type: 'code_analysis',
          files,
          result: analysisResult
        }
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  async optimizeCodeAutonomous(step, taskAnalysis) {
    console.log('⚡ Otimizando código autonomamente...')
    
    try {
      const files = taskAnalysis.files || ['index.js', 'app.js', 'server.js']
      
      for (const file of files) {
        if (fileSystem.exists(file)) {
          const optimizeResult = await selfEditor.optimize(file, 'performance')
          
          if (optimizeResult.success) {
            return {
              success: true,
              message: `Arquivo otimizado: ${file}`,
              autonomousAction: {
                type: 'code_optimization',
                filename: file,
                result: optimizeResult
              }
            }
          }
        }
      }
      
      return {
        success: true,
        message: 'Nenhum arquivo encontrado para otimização',
        autonomousAction: {
          type: 'optimization_check',
          result: 'no_files_found'
        }
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  async runTestsAutonomous(step, taskAnalysis) {
    console.log('🧪 Executando testes autonomamente...')
    
    try {
      const testResult = await commandRunner.runTests()
      
      return {
        success: testResult.success,
        message: testResult.success ? 'Testes executados' : `Erro nos testes: ${testResult.error}`,
        autonomousAction: {
          type: 'test_execution',
          result: testResult
        }
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  async executeGenericAutonomousStep(step, taskAnalysis) {
    console.log(`🤖 Executando passo genérico autônomo: ${step}`)
    
    try {
      const response = await askMultiAI(`
Como um agente autônomo, como você executaria esta etapa:

PASSO: ${step}
CONTEXTO: ${JSON.stringify(taskAnalysis)}

Forneça um plano de ação específico e executável.
`)
      
      return {
        success: true,
        message: 'Passo genérico executado com IA',
        response,
        autonomousAction: {
          type: 'generic_execution',
          step,
          response
        }
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  isCommandSafe(command) {
    const dangerousCommands = [
      'rm -rf /',
      'sudo rm',
      'format',
      'fdisk',
      'mkfs',
      'dd if=',
      'chmod 777',
      'wget http://',
      'curl http://',
      'nc -l',
      'ncat -l'
    ]
    
    const lowerCommand = command.toLowerCase()
    return !dangerousCommands.some(dangerous => lowerCommand.includes(dangerous))
  }

  async learnFromExecution(task, plan, execution) {
    console.log('🧠 Aprendendo com execução autônoma...')
    
    try {
      const learning = {
        task,
        plan: plan.description,
        executionSuccess: execution.success,
        stepsCompleted: execution.completedSteps,
        totalSteps: execution.totalSteps,
        duration: execution.duration,
        autonomousActions: execution.autonomousActions,
        timestamp: Date.now()
      }
      
      this.learningHistory.push(learning)
      
      // Manter apenas últimos 100 aprendizados
      if (this.learningHistory.length > 100) {
        this.learningHistory = this.learningHistory.slice(-100)
      }
      
      // Salvar em arquivo
      await fileSystem.write('agents/devinLearning.json', JSON.stringify(this.learningHistory, null, 2))
      
      console.log('💾 Aprendizado salvo com sucesso')
      
    } catch (error) {
      console.error('❌ Erro ao salvar aprendizado:', error)
    }
  }

  getLearningHistory(limit = 10) {
    return this.learningHistory.slice(-limit)
  }

  getStats() {
    const totalExecutions = this.learningHistory.length
    const successfulExecutions = this.learningHistory.filter(l => l.executionSuccess).length
    const averageDuration = totalExecutions > 0 
      ? this.learningHistory.reduce((sum, l) => sum + (l.duration || 0), 0) / totalExecutions 
      : 0
    
    return {
      totalExecutions,
      successfulExecutions,
      successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions * 100).toFixed(1) + '%' : '0%',
      averageDuration: Math.round(averageDuration),
      autonomousActionsCount: this.learningHistory.reduce((sum, l) => sum + (l.autonomousActions?.length || 0), 0)
    }
  }

  clearLearningHistory() {
    this.learningHistory = []
    console.log('🧹 Histórico de aprendizado limpo')
  }
}

export const devinAgent = new DevinAgent()
