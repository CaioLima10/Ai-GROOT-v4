import { askMultiAI } from '../core/multiAI.js'
import { tools } from '../tools/tools.js'
import { mind } from '../coreMind/mind.js'
import { principles } from '../coreIdentity/principles.js'
import { security } from '../coreIdentity/security.js'
import { experienceStore } from '../experience/experienceStore.js'

export class Planner {
  constructor() {
    this.planningHistory = []
    this.maxPlans = 5
    this.confidenceThreshold = 0.7
    this.currentPlan = null
  }

  async plan(prompt, context = {}) {
    const planId = this.generatePlanId()
    const startTime = Date.now()

    console.log(`📋 Planning: ${prompt}`)

    try {
      // 1. Análise inicial da tarefa
      const analysis = await this.analyzeTask(prompt, context)

      // 2. Verificar princípios e segurança
      const principlesCheck = principles.check(prompt, context)
      const securityCheck = security.blockDanger(prompt, context)

      if (principlesCheck.violations.length > 0 || securityCheck.blocked) {
        return this.createBlockedPlan(planId, prompt, principlesCheck, securityCheck)
      }

      // 3. Buscar memória e experiências relevantes
      const memories = await this.recallMemories(prompt, context)
      const experiences = this.recallExperiences(prompt, context)

      // 4. Gerar plano usando IA
      const aiPlan = await this.generateAIPlan(prompt, analysis, memories, experiences, context)

      // 5. Validar e refinar plano
      const validatedPlan = await this.validatePlan(aiPlan, analysis)

      // 6. Criar plano final
      const finalPlan = {
        id: planId,
        prompt,
        context,
        analysis,
        memories: memories.length,
        experiences: experiences.length,
        aiPlan,
        validatedPlan,
        confidence: validatedPlan.confidence,
        steps: validatedPlan.steps,
        tools: validatedPlan.tools,
        duration: Date.now() - startTime,
        timestamp: Date.now()
      }

      this.currentPlan = finalPlan
      this.planningHistory.push(finalPlan)

      // Manter histórico limitado
      if (this.planningHistory.length > 100) {
        this.planningHistory = this.planningHistory.slice(-100)
      }

      console.log(`✅ Plan created: ${finalPlan.steps.length} steps (${finalPlan.confidence.toFixed(2)} confidence)`)

      return finalPlan

    } catch (error) {
      console.error('❌ Planning error:', error)

      return {
        id: planId,
        prompt,
        error: error.message,
        confidence: 0,
        steps: [],
        tools: [],
        success: false,
        timestamp: Date.now()
      }
    }
  }

  async analyzeTask(prompt, context) {
    const analysis = {
      complexity: this.assessComplexity(prompt),
      category: this.categorizeTask(prompt),
      requiredCapabilities: this.identifyCapabilities(prompt),
      estimatedTime: this.estimateTime(prompt, context),
      risks: this.identifyRisks(prompt, context),
      dependencies: this.identifyDependencies(prompt, context)
    }

    console.log(`🔍 Task analysis: ${analysis.category} (${analysis.complexity} complexity)`)

    return analysis
  }

  assessComplexity(prompt) {
    let complexity = 1

    // Comprimento
    if (prompt.length > 100) complexity += 1
    if (prompt.length > 500) complexity += 1

    // Estrutura
    if (prompt.includes('\n')) complexity += 1
    if (prompt.includes('```')) complexity += 2

    // Palavras-chave complexas
    const complexWords = [
      'implement', 'architecture', 'optimize', 'algorithm', 'design',
      'integrate', 'migrate', 'refactor', 'debug', 'test', 'deploy'
    ]

    complexWords.forEach(word => {
      if (prompt.toLowerCase().includes(word)) {
        complexity += 1
      }
    })

    // Múltiplas tarefas
    const taskIndicators = ['and', 'also', 'additionally', 'plus', 'then']
    taskIndicators.forEach(indicator => {
      const regex = new RegExp(`\\b${indicator}\\b`, 'gi')
      const matches = prompt.match(regex)
      if (matches) {
        complexity += matches.length
      }
    })

    return Math.min(5, complexity) // Escala 1-5
  }

  categorizeTask(prompt) {
    const categories = {
      coding: ['code', 'function', 'class', 'implement', 'program', 'script'],
      analysis: ['analyze', 'review', 'check', 'examine', 'audit', 'inspect'],
      debugging: ['error', 'bug', 'fix', 'debug', 'issue', 'problem'],
      learning: ['learn', 'explain', 'teach', 'understand', 'study', 'research'],
      planning: ['plan', 'design', 'architecture', 'strategy', 'approach'],
      data: ['data', 'database', 'query', 'store', 'save', 'retrieve'],
      system: ['system', 'server', 'deploy', 'configure', 'setup', 'install'],
      testing: ['test', 'validate', 'verify', 'check', 'ensure']
    }

    const lowerPrompt = prompt.toLowerCase()

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lowerPrompt.includes(keyword))) {
        return category
      }
    }

    return 'general'
  }

  identifyCapabilities(prompt) {
    const capabilities = []

    const capabilityMap = {
      'coding': ['code_generation', 'file_operations'],
      'analysis': ['code_analysis', 'pattern_recognition'],
      'debugging': ['error_detection', 'troubleshooting'],
      'learning': ['research', 'knowledge_retrieval'],
      'planning': ['task_planning', 'resource_allocation'],
      'data': ['data_processing', 'database_operations'],
      'system': ['system_commands', 'configuration'],
      'testing': ['test_execution', 'validation']
    }

    const category = this.categorizeTask(prompt)

    if (capabilityMap[category]) {
      capabilities.push(...capabilityMap[category])
    }

    return [...new Set(capabilities)] // Remover duplicatas
  }

  estimateTime(prompt, context) {
    const complexity = this.assessComplexity(prompt)
    const category = this.categorizeTask(prompt)

    const baseTimes = {
      coding: 300,      // 5 minutos
      analysis: 120,    // 2 minutos
      debugging: 240,   // 4 minutos
      learning: 180,    // 3 minutos
      planning: 150,    // 2.5 minutos
      data: 90,         // 1.5 minutos
      system: 200,      // 3.3 minutos
      testing: 180,     // 3 minutos
      general: 120     // 2 minutos
    }

    const baseTime = baseTimes[category] || baseTimes.general
    const complexityMultiplier = 1 + (complexity - 1) * 0.5

    return Math.round(baseTime * complexityMultiplier)
  }

  identifyRisks(prompt, context) {
    const risks = []

    // Risco de segurança
    if (prompt.toLowerCase().includes('delete') || prompt.toLowerCase().includes('remove')) {
      risks.push({
        type: 'security',
        severity: 'high',
        description: 'Destructive operation detected'
      })
    }

    // Risco de complexidade
    const complexity = this.assessComplexity(prompt)
    if (complexity >= 4) {
      risks.push({
        type: 'complexity',
        severity: 'medium',
        description: 'High complexity task'
      })
    }

    // Risco de dependências
    if (prompt.toLowerCase().includes('install') || prompt.toLowerCase().includes('deploy')) {
      risks.push({
        type: 'dependency',
        severity: 'medium',
        description: 'External dependency operation'
      })
    }

    return risks
  }

  identifyDependencies(prompt, context) {
    const dependencies = []

    // Dependências de sistema
    if (prompt.toLowerCase().includes('file') || prompt.toLowerCase().includes('directory')) {
      dependencies.push('file_system')
    }

    if (prompt.toLowerCase().includes('command') || prompt.toLowerCase().includes('run')) {
      dependencies.push('system_commands')
    }

    if (prompt.toLowerCase().includes('database') || prompt.toLowerCase().includes('data')) {
      dependencies.push('database')
    }

    // Dependências de ferramentas
    if (prompt.toLowerCase().includes('test')) {
      dependencies.push('testing_framework')
    }

    if (prompt.toLowerCase().includes('deploy')) {
      dependencies.push('deployment_tools')
    }

    return dependencies
  }

  async recallMemories(prompt, context) {
    try {
      // Usar memória do mind
      const memories = await mind.recallMemories(prompt, context)
      return memories
    } catch (error) {
      console.error('❌ Error recalling memories:', error)
      return []
    }
  }

  recallExperiences(prompt, context) {
    try {
      // Usar experiência store
      const experiences = experienceStore.findSimilar({
        input: prompt,
        type: this.categorizeTask(prompt),
        category: context.category || 'general'
      }, 5)

      return experiences
    } catch (error) {
      console.error('❌ Error recalling experiences:', error)
      return []
    }
  }

  async generateAIPlan(prompt, analysis, memories, experiences, context) {
    const planningPrompt = this.buildPlanningPrompt(prompt, analysis, memories, experiences, context)

    try {
      const response = await askMultiAI(planningPrompt)

      // Extrair plano da resposta
      const plan = this.extractPlanFromResponse(response)

      console.log(`🤖 AI plan generated: ${plan.steps?.length || 0} steps`)

      return plan

    } catch (error) {
      console.error('❌ Error generating AI plan:', error)

      // Fallback para plano básico
      return this.createBasicPlan(prompt, analysis)
    }
  }

  buildPlanningPrompt(prompt, analysis, memories, experiences, context) {
    let planningPrompt = `Create a detailed plan for the following task:\n\n`

    planningPrompt += `TASK: ${prompt}\n\n`

    planningPrompt += `ANALYSIS:\n`
    planningPrompt += `- Complexity: ${analysis.complexity}/5\n`
    planningPrompt += `- Category: ${analysis.category}\n`
    planningPrompt += `- Required capabilities: ${analysis.requiredCapabilities.join(', ')}\n`
    planningPrompt += `- Estimated time: ${analysis.estimatedTime} seconds\n`

    if (analysis.risks.length > 0) {
      planningPrompt += `- Risks: ${analysis.risks.map(r => r.description).join(', ')}\n`
    }

    if (analysis.dependencies.length > 0) {
      planningPrompt += `- Dependencies: ${analysis.dependencies.join(', ')}\n`
    }

    planningPrompt += `\nCONTEXT:\n`
    planningPrompt += `${JSON.stringify(context, null, 2)}\n\n`

    if (memories.length > 0) {
      planningPrompt += `RELEVANT MEMORIES (${memories.length}):\n`
      memories.slice(0, 3).forEach((mem, i) => {
        planningPrompt += `${i + 1}. ${mem.text?.substring(0, 100)}...\n`
      })
      planningPrompt += '\n'
    }

    if (experiences.length > 0) {
      planningPrompt += `RELEVANT EXPERIENCES (${experiences.length}):\n`
      experiences.slice(0, 3).forEach((exp, i) => {
        planningPrompt += `${i + 1}. ${exp.experience.input?.substring(0, 100)}... (${exp.experience.success ? 'success' : 'failure'})\n`
      })
      planningPrompt += '\n'
    }

    planningPrompt += `Generate a plan in JSON format:
{
  "steps": [
    {
      "step": 1,
      "description": "Clear description of what to do",
      "action": "action_type",
      "tool": "tool_name_if_needed",
      "parameters": {"key": "value"},
      "estimatedTime": 30,
      "dependencies": []
    }
  ],
  "tools": ["tool1", "tool2"],
  "confidence": 0.8,
  "totalEstimatedTime": 120,
  "successCriteria": ["criteria1", "criteria2"],
  "alternativeApproaches": ["backup plan 1", "backup plan 2"]
}

Guidelines:
- Be specific and actionable
- Use available tools when appropriate
- Consider risks and dependencies
- Estimate realistic times
- Provide confidence level (0-1)
- Include success criteria
- Provide backup approaches
`

    return planningPrompt
  }

  extractPlanFromResponse(response) {
    try {
      // Tentar parsear JSON
      if (typeof response === 'string') {
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0])
        }
      }

      if (typeof response === 'object') {
        if (response.choices && response.choices[0]) {
          const content = response.choices[0].message?.content || response.choices[0].text
          if (content) {
            const jsonMatch = content.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              return JSON.parse(jsonMatch[0])
            }
          }
        }

        // Se já for objeto estruturado
        if (response.steps || response.tools) {
          return response
        }
      }

      // Fallback para plano básico
      console.log('⚠️ Could not extract structured plan, using fallback')
      return {
        steps: [{ step: 1, description: 'Process request', action: 'analyze', estimatedTime: 60 }],
        tools: [],
        confidence: 0.5,
        totalEstimatedTime: 60,
        successCriteria: ['Request processed'],
        alternativeApproaches: ['Manual processing']
      }

    } catch (error) {
      console.error('❌ Error extracting plan:', error)
      return this.createBasicPlan('', {})
    }
  }

  createBasicPlan(prompt, analysis) {
    return {
      steps: [
        {
          step: 1,
          description: 'Analyze request',
          action: 'analyze',
          estimatedTime: 30,
          dependencies: []
        },
        {
          step: 2,
          description: 'Execute task',
          action: 'execute',
          estimatedTime: analysis.estimatedTime || 60,
          dependencies: [1]
        },
        {
          step: 3,
          description: 'Validate result',
          action: 'validate',
          estimatedTime: 30,
          dependencies: [2]
        }
      ],
      tools: [],
      confidence: 0.6,
      totalEstimatedTime: (analysis.estimatedTime || 60) + 60,
      successCriteria: ['Task completed'],
      alternativeApproaches: ['Manual execution']
    }
  }

  async validatePlan(aiPlan, analysis) {
    const validation = {
      confidence: aiPlan.confidence || 0.5,
      steps: aiPlan.steps || [],
      tools: aiPlan.tools || [],
      issues: [],
      recommendations: []
    }

    // Validar steps
    if (!validation.steps || validation.steps.length === 0) {
      validation.issues.push('No steps defined in plan')
      validation.steps = this.createBasicPlan('', {}).steps
    }

    // Validar tools
    const availableTools = tools.getAvailableTools()
    const missingTools = validation.tools.filter(tool => !availableTools[tool])

    if (missingTools.length > 0) {
      validation.issues.push(`Missing tools: ${missingTools.join(', ')}`)
      validation.tools = validation.tools.filter(tool => availableTools[tool])
    }

    // Validar confiança
    if (validation.confidence < 0.3) {
      validation.issues.push('Low confidence in plan')
      validation.recommendations.push('Consider gathering more information')
    }

    // Validar tempo estimado
    const totalTime = validation.steps.reduce((sum, step) => sum + (step.estimatedTime || 30), 0)
    if (totalTime > analysis.estimatedTime * 2) {
      validation.issues.push('Estimated time seems too high')
      validation.recommendations.push('Consider optimizing steps')
    }

    // Ajustar confiança baseado em issues
    if (validation.issues.length > 0) {
      validation.confidence = Math.max(0.3, validation.confidence - (validation.issues.length * 0.1))
    }

    console.log(`✅ Plan validation: ${validation.issues.length} issues, confidence: ${validation.confidence.toFixed(2)}`)

    return validation
  }

  createBlockedPlan(planId, prompt, principlesCheck, securityCheck) {
    return {
      id: planId,
      prompt,
      blocked: true,
      reason: securityCheck.blocked ? 'Security threat' : 'Principles violation',
      principles: principlesCheck.violations,
      security: securityCheck.threats,
      recommendation: principlesCheck.recommendation,
      steps: [],
      tools: [],
      confidence: 0,
      timestamp: Date.now()
    }
  }

  generatePlanId() {
    return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  getCurrentPlan() {
    return this.currentPlan
  }

  getPlanningHistory(limit = 10) {
    return this.planningHistory.slice(-limit)
  }

  getStats() {
    const totalPlans = this.planningHistory.length
    const successfulPlans = this.planningHistory.filter(plan => !plan.error && plan.confidence > 0.5).length

    const categoryCounts = {}
    const complexityCounts = {}

    this.planningHistory.forEach(plan => {
      if (plan.analysis) {
        const category = plan.analysis.category || 'general'
        const complexity = plan.analysis.complexity || 1

        categoryCounts[category] = (categoryCounts[category] || 0) + 1
        complexityCounts[complexity] = (complexityCounts[complexity] || 0) + 1
      }
    })

    return {
      totalPlans,
      successfulPlans,
      successRate: totalPlans > 0 ? (successfulPlans / totalPlans * 100).toFixed(1) + '%' : '0%',
      categoryCounts,
      complexityCounts,
      averageConfidence: totalPlans > 0
        ? (this.planningHistory.reduce((sum, plan) => sum + (plan.confidence || 0), 0) / totalPlans).toFixed(2)
        : 0,
      currentPlan: this.currentPlan?.id || null
    }
  }

  clearHistory() {
    this.planningHistory = []
    this.currentPlan = null
    console.log('🧹 Planning history cleared')
  }

  exportPlanningData() {
    return {
      currentPlan: this.currentPlan,
      history: this.planningHistory,
      stats: this.getStats(),
      exportTimestamp: Date.now()
    }
  }
}

export const planner = new Planner()
