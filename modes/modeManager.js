import { mind } from '../coreMind/mind.js'
import { askMultiAI } from '../core/multiAI.js'
import { tools } from '../tools/tools.js'
import { experienceStore } from '../experience/experienceStore.js'

export class ModeManager {
  constructor() {
    this.currentMode = 'hybrid'
    this.modes = new Map()
    this.modeHistory = []
    this.initializeModes()
  }

  initializeModes() {
    this.modes.set('hybrid', {
      name: 'Hybrid Mode',
      description: 'Uses all available resources: mind, memory, AI, tools',
      priority: 1,
      capabilities: ['thinking', 'memory', 'ai', 'tools', 'learning'],
      fallback: true,
      auto: true
    })

    this.modes.set('auto', {
      name: 'Autonomous Mode',
      description: 'Uses only internal resources: mind, memory, experience',
      priority: 2,
      capabilities: ['thinking', 'memory', 'experience'],
      fallback: false,
      auto: true
    })

    this.modes.set('online', {
      name: 'Online Mode',
      description: 'Primarily uses external AI services',
      priority: 3,
      capabilities: ['ai', 'memory'],
      fallback: true,
      auto: false
    })

    this.modes.set('safe', {
      name: 'Safe Mode',
      description: 'Uses only safe local operations',
      priority: 4,
      capabilities: ['memory', 'basic_tools'],
      fallback: false,
      auto: false
    })

    this.modes.set('learning', {
      name: 'Learning Mode',
      description: 'Focuses on learning and knowledge acquisition',
      priority: 5,
      capabilities: ['ai', 'memory', 'learning'],
      fallback: true,
      auto: false
    })

    this.modes.set('debug', {
      name: 'Debug Mode',
      description: 'Verbose logging and detailed analysis',
      priority: 6,
      capabilities: ['thinking', 'memory', 'ai', 'tools', 'debug'],
      fallback: true,
      auto: false
    })

    console.log(`🔧 Initialized ${this.modes.size} modes`)
  }

  getMode(modeName = null) {
    if (modeName && this.modes.has(modeName)) {
      return this.modes.get(modeName)
    }
    return this.modes.get(this.currentMode)
  }

  setMode(modeName) {
    if (!this.modes.has(modeName)) {
      console.warn(`⚠️ Mode "${modeName}" not found. Available modes: ${Array.from(this.modes.keys()).join(', ')}`)
      return false
    }

    const previousMode = this.currentMode
    this.currentMode = modeName
    
    this.modeHistory.push({
      from: previousMode,
      to: modeName,
      timestamp: Date.now(),
      reason: 'manual'
    })

    console.log(`🔄 Mode changed: ${previousMode} → ${modeName}`)
    return true
  }

  async executeInMode(prompt, context = {}) {
    const mode = this.getMode()
    const startTime = Date.now()
    
    console.log(`🎯 Executing in ${mode.name}: ${prompt.substring(0, 50)}...`)
    
    try {
      let result = null
      
      switch (mode.name.toLowerCase().replace(' ', '_')) {
        case 'hybrid_mode':
          result = await this.executeHybrid(prompt, context)
          break
          
        case 'autonomous_mode':
          result = await this.executeAutonomous(prompt, context)
          break
          
        case 'online_mode':
          result = await this.executeOnline(prompt, context)
          break
          
        case 'safe_mode':
          result = await this.executeSafe(prompt, context)
          break
          
        case 'learning_mode':
          result = await this.executeLearning(prompt, context)
          break
          
        case 'debug_mode':
          result = await this.executeDebug(prompt, context)
          break
          
        default:
          result = await this.executeHybrid(prompt, context)
          break
      }
      
      const execution = {
        mode: mode.name,
        prompt,
        context,
        result,
        success: result.success !== false,
        duration: Date.now() - startTime,
        timestamp: Date.now()
      }
      
      // Auto-ajustar modo se necessário
      await this.autoAdjustMode(execution)
      
      return execution
      
    } catch (error) {
      console.error(`❌ Error in ${mode.name}:`, error)
      
      return {
        mode: mode.name,
        prompt,
        error: error.message,
        success: false,
        duration: Date.now() - startTime,
        timestamp: Date.now()
      }
    }
  }

  async executeHybrid(prompt, context) {
    console.log('🔄 Hybrid Mode: Using all resources')
    
    // 1. Tentar pensar primeiro
    const thinking = await mind.think(prompt, context)
    
    if (thinking.success && thinking.confidence > 0.7) {
      console.log('✅ Hybrid: High confidence thought, using result')
      return {
        success: true,
        source: 'mind',
        response: thinking.thought,
        confidence: thinking.confidence,
        memories: thinking.memories,
        experiences: thinking.experiences
      }
    }
    
    // 2. Se não tiver confiança, usar IA
    console.log('🤖 Hybrid: Using AI as backup')
    const aiResponse = await askMultiAI(prompt)
    const content = this.extractContent(aiResponse)
    
    return {
      success: true,
      source: 'ai',
      response: content,
      confidence: 0.6,
      fallback: true
    }
  }

  async executeAutonomous(prompt, context) {
    console.log('🧠 Autonomous Mode: Using only internal resources')
    
    // 1. Buscar memórias
    const memories = await mind.recallMemories(prompt, context)
    
    // 2. Buscar experiências
    const experiences = mind.recallExperiences(prompt, context)
    
    // 3. Tentar pensar
    const thinking = await mind.think(prompt, context)
    
    if (thinking.success) {
      return {
        success: true,
        source: 'autonomous',
        response: thinking.thought,
        confidence: thinking.confidence,
        memories,
        experiences,
        autonomous: true
      }
    }
    
    // 4. Se não conseguir pensar, usar memórias
    if (memories.length > 0) {
      const bestMemory = memories[0]
      return {
        success: true,
        source: 'memory',
        response: bestMemory.text,
        confidence: 0.5,
        memories: [bestMemory],
        autonomous: true
      }
    }
    
    // 5. Último recurso: resposta genérica
    return {
      success: true,
      source: 'autonomous_fallback',
      response: "I'm processing this autonomously. Let me think about the best approach based on my experience.",
      confidence: 0.3,
      autonomous: true
    }
  }

  async executeOnline(prompt, context) {
    console.log('🌐 Online Mode: Using external AI services')
    
    try {
      const aiResponse = await askMultiAI(prompt)
      const content = this.extractContent(aiResponse)
      
      // Salvar na memória para uso offline
      await mind.recallMemories(prompt, context)
      
      return {
        success: true,
        source: 'online',
        response: content,
        confidence: 0.7,
        online: true
      }
      
    } catch (error) {
      console.error('❌ Online mode failed, falling back to hybrid')
      return await this.executeHybrid(prompt, context)
    }
  }

  async executeSafe(prompt, context) {
    console.log('🛡️ Safe Mode: Using only safe local operations')
    
    // 1. Buscar apenas memórias locais
    const memories = await mind.recallMemories(prompt, context)
    
    if (memories.length > 0) {
      return {
        success: true,
        source: 'safe_memory',
        response: memories[0].text,
        confidence: 0.6,
        safe: true
      }
    }
    
    // 2. Usar tools seguros
    const safeTools = ['getTime', 'getVersion', 'getSystemInfo']
    
    for (const toolName of safeTools) {
      try {
        const toolResult = await tools.executeTool(toolName, {})
        if (toolResult.success) {
          return {
            success: true,
            source: 'safe_tool',
            response: `Based on ${toolName}: ${JSON.stringify(toolResult.result)}`,
            confidence: 0.4,
            safe: true
          }
        }
      } catch (error) {
        continue
      }
    }
    
    // 3. Resposta de segurança
    return {
      success: true,
      source: 'safe_fallback',
      response: "I'm operating in safe mode. I can help with basic information and memory recall.",
      confidence: 0.3,
      safe: true
    }
  }

  async executeLearning(prompt, context) {
    console.log('📚 Learning Mode: Focus on knowledge acquisition')
    
    // 1. Usar IA para aprender
    const aiResponse = await askMultiAI(prompt)
    const content = this.extractContent(aiResponse)
    
    // 2. Salvar como experiência de aprendizado
    const experience = {
      type: 'learning',
      input: prompt,
      output: content,
      outcome: 'knowledge_acquired',
      success: true,
      confidence: 0.8,
      context: { ...context, mode: 'learning' },
      tags: ['learning', 'knowledge'],
      metadata: {
        timestamp: Date.now(),
        source: 'learning_mode'
      }
    }
    
    experienceStore.add(experience)
    
    // 3. Salvar na memória vetorial
    await mind.recallMemories(prompt, context)
    
    return {
      success: true,
      source: 'learning',
      response: content,
      confidence: 0.8,
      learning: true,
      experienceId: experience.id
    }
  }

  async executeDebug(prompt, context) {
    console.log('🐛 Debug Mode: Verbose logging and analysis')
    
    const debugInfo = {
      mode: 'debug',
      prompt,
      context,
      timestamp: Date.now(),
      systemInfo: await tools.executeTool('getSystemInfo', {}),
      availableTools: tools.getAvailableTools(),
      memoryStats: await mind.recallMemories(prompt, context).then(m => ({ count: m.length }))
    }
    
    console.log('🐛 Debug Info:', JSON.stringify(debugInfo, null, 2))
    
    // Executar em modo híbrido com logging extra
    const result = await this.executeHybrid(prompt, context)
    
    return {
      ...result,
      debugInfo,
      debug: true
    }
  }

  extractContent(response) {
    if (typeof response === 'string') {
      return response
    }
    
    if (response.choices && response.choices[0]) {
      const choice = response.choices[0]
      return choice.message?.content || choice.text || choice.content || JSON.stringify(choice)
    }
    
    if (response.content) {
      return response.content
    }
    
    if (response.text) {
      return response.text
    }
    
    return JSON.stringify(response)
  }

  async autoAdjustMode(execution) {
    // Ajustar modo baseado no resultado
    if (!execution.success && this.currentMode !== 'hybrid') {
      console.log('🔄 Auto-adjusting to hybrid mode due to failure')
      this.setMode('hybrid')
      
      this.modeHistory.push({
        from: execution.mode,
        to: 'hybrid',
        timestamp: Date.now(),
        reason: 'auto_recovery'
      })
    }
    
    // Se o modo atual não está performando bem, considerar mudança
    if (execution.success && execution.duration > 30000 && this.currentMode !== 'auto') {
      console.log('⚡ Performance issue detected, considering mode change')
      // Implementar lógica de mudança de modo baseada em performance
    }
  }

  getAvailableModes() {
    const modes = {}
    
    for (const [name, mode] of this.modes.entries()) {
      modes[name] = {
        name: mode.name,
        description: mode.description,
        capabilities: mode.capabilities,
        priority: mode.priority,
        fallback: mode.fallback,
        auto: mode.auto
      }
    }
    
    return modes
  }

  getModeHistory(limit = 10) {
    return this.modeHistory.slice(-limit)
  }

  getStats() {
    const modeCounts = {}
    
    this.modeHistory.forEach(change => {
      modeCounts[change.to] = (modeCounts[change.to] || 0) + 1
    })
    
    const recentExecutions = this.modeHistory.slice(-20)
    const recentChanges = recentExecutions.filter(change => change.reason === 'auto_recovery').length
    
    return {
      currentMode: this.currentMode,
      totalModes: this.modes.size,
      modeCounts,
      totalChanges: this.modeHistory.length,
      recentAutoChanges: recentChanges,
      mostUsedMode: Object.keys(modeCounts).reduce((a, b) => modeCounts[a] > modeCounts[b] ? a : b, Object.keys(modeCounts)[0]) || 'hybrid'
    }
  }

  setAutoMode(enabled) {
    // Habilitar/desabilitar ajuste automático de modo
    for (const [name, mode] of this.modes.entries()) {
      mode.auto = enabled
    }
    
    console.log(`🤖 Auto mode ${enabled ? 'enabled' : 'disabled'}`)
  }

  exportModeData() {
    return {
      currentMode: this.currentMode,
      modes: this.getAvailableModes(),
      history: this.modeHistory,
      stats: this.getStats(),
      exportTimestamp: Date.now()
    }
  }
}

export const modeManager = new ModeManager()
