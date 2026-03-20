import { askMultiAI } from '../core/multiAI.js'

export class TaskPlanner {
  constructor() {
    this.planHistory = []
    this.taskPatterns = new Map()
    this.initializePatterns()
  }

  initializePatterns() {
    // Padrões de tarefas comuns
    this.taskPatterns.set('create', [
      'criar', 'crie', 'create', 'new', 'novo', 'gerar', 'gere'
    ])
    
    this.taskPatterns.set('fix', [
      'corrigir', 'consertar', 'arrumar', 'fix', 'resolver', 'erro', 'bug', 'debug'
    ])
    
    this.taskPatterns.set('install', [
      'instalar', 'instale', 'install', 'npm', 'yarn', 'pnpm', 'pip', 'dependência'
    ])
    
    this.taskPatterns.set('run', [
      'rodar', 'execute', 'executar', 'start', 'iniciar', 'npm start', 'node'
    ])
    
    this.taskPatterns.set('edit', [
      'editar', 'modificar', 'alterar', 'mudar', 'edit', 'melhorar', 'otimizar'
    ])
    
    this.taskPatterns.set('test', [
      'testar', 'teste', 'test', 'npm test', 'validar', 'verificar'
    ])
    
    this.taskPatterns.set('learn', [
      'aprender', 'estudar', 'pesquisar', 'buscar', 'learn', 'search'
    ])
    
    this.taskPatterns.set('analyze', [
      'analisar', 'análise', 'analyze', 'revisar', 'review', 'examinar'
    ])
    
    this.taskPatterns.set('deploy', [
      'deploy', 'implantar', 'publicar', 'build', 'compilar'
    ])
  }

  async plan(task, context = {}) {
    console.log(`📋 Planejando tarefa: ${task}`)
    
    try {
      // Detectar tipo de tarefa
      const taskType = this.detectTaskType(task)
      
      // Criar plano detalhado
      const plan = await this.createDetailedPlan(task, taskType, context)
      
      // Salvar no histórico
      const planRecord = {
        task,
        taskType,
        plan,
        timestamp: Date.now(),
        context
      }
      
      this.planHistory.push(planRecord)
      
      console.log(`✅ Plano criado: ${taskType} (${plan.steps.length} passos)`)
      
      return {
        success: true,
        task,
        taskType,
        plan,
        confidence: plan.confidence,
        estimatedTime: plan.estimatedTime
      }
      
    } catch (error) {
      console.error(`❌ Erro ao planejar tarefa:`, error)
      
      return {
        success: false,
        error: error.message,
        task
      }
    }
  }

  detectTaskType(task) {
    const lowerTask = task.toLowerCase()
    
    for (const [type, keywords] of this.taskPatterns.entries()) {
      if (keywords.some(keyword => lowerTask.includes(keyword))) {
        return type
      }
    }
    
    return 'general'
  }

  async createDetailedPlan(task, taskType, context) {
    const planTemplates = {
      create: {
        description: 'Criar novo arquivo/componente',
        steps: [
          'Analisar requisitos',
          'Estruturar código',
          'Implementar funcionalidade',
          'Adicionar tratamento de erros',
          'Testar implementação',
          'Documentar código'
        ],
        estimatedTime: 15, // minutos
        confidence: 0.8
      },
      
      fix: {
        description: 'Corrigir erro ou bug',
        steps: [
          'Identificar o erro',
          'Analisar causa raiz',
          'Propor solução',
          'Implementar correção',
          'Testar correção',
          'Verificar regressões'
        ],
        estimatedTime: 20,
        confidence: 0.7
      },
      
      install: {
        description: 'Instalar dependências ou pacotes',
        steps: [
          'Verificar gerenciador de pacotes',
          'Executar comando de instalação',
          'Verificar instalação',
          'Configurar se necessário'
        ],
        estimatedTime: 10,
        confidence: 0.9
      },
      
      run: {
        description: 'Executar aplicação ou script',
        steps: [
          'Verificar pré-requisitos',
          'Executar comando',
          'Monitorar execução',
          'Verificar resultado'
        ],
        estimatedTime: 5,
        confidence: 0.9
      },
      
      edit: {
        description: 'Editar ou modificar arquivo existente',
        steps: [
          'Ler arquivo atual',
          'Identificar ponto de modificação',
          'Aplicar alterações',
          'Verificar sintaxe',
          'Testar mudanças'
        ],
        estimatedTime: 12,
        confidence: 0.8
      },
      
      test: {
        description: 'Executar testes do projeto',
        steps: [
          'Verificar ambiente de teste',
          'Executar suíte de testes',
          'Analisar resultados',
          'Corrigir falhas se necessário'
        ],
        estimatedTime: 8,
        confidence: 0.8
      },
      
      learn: {
        description: 'Aprender sobre tópico ou tecnologia',
        steps: [
          'Definir objetivos de aprendizado',
          'Buscar informações relevantes',
          'Analisar fontes',
          'Sintetizar conhecimento',
          'Salvar aprendizados'
        ],
        estimatedTime: 25,
        confidence: 0.7
      },
      
      analyze: {
        description: 'Analisar código ou projeto',
        steps: [
          'Coletar dados para análise',
          'Examinar estrutura',
          'Identificar padrões',
          'Avaliar qualidade',
          'Gerar relatório'
        ],
        estimatedTime: 18,
        confidence: 0.8
      },
      
      deploy: {
        description: 'Fazer deploy da aplicação',
        steps: [
          'Preparar ambiente',
          'Compilar/build projeto',
          'Configurar deployment',
          'Executar deploy',
          'Verificar funcionamento'
        ],
        estimatedTime: 15,
        confidence: 0.7
      },
      
      general: {
        description: 'Tarefa genérica',
        steps: [
          'Entender tarefa',
          'Definir abordagem',
          'Executar ações necessárias',
          'Verificar resultado',
          'Documentar processo'
        ],
        estimatedTime: 20,
        confidence: 0.6
      }
    }
    
    const template = planTemplates[taskType] || planTemplates.general
    
    // Personalizar plano baseado no contexto
    const personalizedPlan = await this.personalizePlan(template, task, context)
    
    return personalizedPlan
  }

  async personalizePlan(template, task, context) {
    // Usar IA para refinar o plano se necessário
    if (context.complexity === 'high' || context.requiresAI) {
      try {
        const prompt = `
Refine este plano para a tarefa:

TAREFA: ${task}
TIPO: ${template.description}
PLANO ATUAL: ${template.steps.join(', ')})}

CONTEXTO: ${JSON.stringify(context)}

Forneça um plano mais detalhado e específico em formato JSON:
{
  "steps": ["passo 1", "passo 2", ...],
  "estimatedTime": minutos,
  "confidence": 0.0-1.0,
  "tools": ["ferramenta1", "ferramenta2", ...]
}
`
        
        const aiResponse = await askMultiAI(prompt)
        
        // Tentar parsear resposta JSON
        try {
          const refinedPlan = JSON.parse(aiResponse)
          return {
            ...template,
            ...refinedPlan,
            aiRefined: true
          }
        } catch (parseError) {
          console.log('⚠️ Não foi possível parsear resposta da IA, usando plano padrão')
          return template
        }
        
      } catch (error) {
        console.log('⚠️ Erro ao refinar plano com IA, usando plano padrão:', error.message)
        return template
      }
    }
    
    return template
  }

  async executePlan(plan, context = {}) {
    console.log(`🚀 Executando plano: ${plan.description}`)
    
    const results = []
    let currentStep = 0
    
    for (const step of plan.steps) {
      currentStep++
      
      console.log(`📋 Passo ${currentStep}/${plan.steps.length}: ${step}`)
      
      try {
        // Aqui seria integrado com os outros sistemas
        const stepResult = await this.executeStep(step, context)
        
        results.push({
          step,
          stepNumber: currentStep,
          success: stepResult.success,
          result: stepResult,
          timestamp: Date.now()
        })
        
        if (!stepResult.success && !context.continueOnError) {
          console.log(`⏹️ Parando execução devido a falha no passo: ${step}`)
          break
        }
        
      } catch (error) {
        console.error(`❌ Erro no passo ${currentStep}: ${step}`, error)
        
        results.push({
          step,
          stepNumber: currentStep,
          success: false,
          error: error.message,
          timestamp: Date.now()
        })
        
        if (!context.continueOnError) {
          break
        }
      }
    }
    
    const executionSummary = {
      plan,
      results,
      totalSteps: plan.steps.length,
      completedSteps: results.filter(r => r.success).length,
      failedSteps: results.filter(r => !r.success).length,
      success: results.every(r => r.success),
      timestamp: Date.now()
    }
    
    console.log(`✅ Plano executado: ${executionSummary.completedSteps}/${executionSummary.totalSteps} passos concluídos`)
    
    return executionSummary
  }

  async executeStep(step, context) {
    // Método placeholder - seria integrado com os agentes
    return {
      success: true,
      message: `Passo executado: ${step}`,
      step
    }
  }

  getPlanHistory(limit = 10) {
    return this.planHistory.slice(-limit)
  }

  getStats() {
    const totalPlans = this.planHistory.length
    const successfulPlans = this.planHistory.filter(p => p.plan.success !== false).length
    
    const taskTypeStats = {}
    this.planHistory.forEach(plan => {
      const type = plan.taskType || 'unknown'
      taskTypeStats[type] = (taskTypeStats[type] || 0) + 1
    })
    
    return {
      totalPlans,
      successfulPlans,
      successRate: totalPlans > 0 ? (successfulPlans / totalPlans * 100).toFixed(1) + '%' : '0%',
      taskTypeDistribution: taskTypeStats,
      averageSteps: totalPlans > 0 
        ? Math.round(this.planHistory.reduce((sum, p) => sum + (p.plan.steps?.length || 0), 0) / totalPlans)
        : 0
    }
  }

  clearHistory() {
    this.planHistory = []
    console.log('🧹 Histórico de planos limpo')
  }

  addPattern(type, keywords) {
    if (Array.isArray(keywords)) {
      this.taskPatterns.set(type, keywords)
      console.log(`📝 Padrão adicionado: ${type} (${keywords.join(', ')})`)
    }
  }

  getPatterns() {
    const patterns = {}
    for (const [type, keywords] of this.taskPatterns.entries()) {
      patterns[type] = keywords
    }
    return patterns
  }
}

export const taskPlanner = new TaskPlanner()
