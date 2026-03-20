import { fileSystem } from '../system/fileSystem.js'
import { commandRunner } from '../system/commandRunner.js'
import { vectorStore } from '../vector/saveVector.js'
import { experienceStore } from '../experience/experienceStore.js'

export class Tools {
  constructor() {
    this.tools = new Map()
    this.executionHistory = []
    this.securityLevel = 'high'
    this.initializeTools()
  }

  initializeTools() {
    // Tools de sistema
    this.registerTool('getTime', this.getTime.bind(this), {
      description: 'Get current date and time',
      category: 'system',
      safe: true
    })

    this.registerTool('getVersion', this.getVersion.bind(this), {
      description: 'Get GROOT version information',
      category: 'system',
      safe: true
    })

    this.registerTool('getSystemInfo', this.getSystemInfo.bind(this), {
      description: 'Get system information and status',
      category: 'system',
      safe: true
    })

    // Tools de arquivo
    this.registerTool('readFile', this.readFile.bind(this), {
      description: 'Read file contents',
      category: 'file',
      safe: true,
      parameters: ['path']
    })

    this.registerTool('writeFile', this.writeFile.bind(this), {
      description: 'Write content to file',
      category: 'file',
      safe: false,
      parameters: ['path', 'content']
    })

    this.registerTool('listFiles', this.listFiles.bind(this), {
      description: 'List files in directory',
      category: 'file',
      safe: true,
      parameters: ['path']
    })

    // Tools de memória
    this.registerTool('saveMemory', this.saveMemory.bind(this), {
      description: 'Save text to vector memory',
      category: 'memory',
      safe: true,
      parameters: ['text']
    })

    this.registerTool('searchMemory', this.searchMemory.bind(this), {
      description: 'Search vector memory',
      category: 'memory',
      safe: true,
      parameters: ['query']
    })

    // Tools de experiência
    this.registerTool('addExperience', this.addExperience.bind(this), {
      description: 'Add experience to learning system',
      category: 'experience',
      safe: true,
      parameters: ['experience']
    })

    // Tools de comando
    this.registerTool('runCommand', this.runCommand.bind(this), {
      description: 'Execute system command (safe only)',
      category: 'command',
      safe: false,
      parameters: ['command']
    })

    // Tools de análise
    this.registerTool('analyzeCode', this.analyzeCode.bind(this), {
      description: 'Analyze code for patterns and issues',
      category: 'analysis',
      safe: true,
      parameters: ['code', 'language']
    })

    // Tools matemáticos
    this.registerTool('calculate', this.calculate.bind(this), {
      description: 'Perform mathematical calculations',
      category: 'math',
      safe: true,
      parameters: ['expression']
    })

    console.log(`🔧 Initialized ${this.tools.size} tools`)
  }

  registerTool(name, func, config = {}) {
    this.tools.set(name, {
      name,
      func,
      config: {
        description: config.description || `Tool: ${name}`,
        category: config.category || 'general',
        safe: config.safe !== false,
        parameters: config.parameters || [],
        ...config
      }
    })
  }

  async executeTool(toolName, parameters = {}) {
    const startTime = Date.now()
    
    try {
      const tool = this.tools.get(toolName)
      
      if (!tool) {
        throw new Error(`Tool "${toolName}" not found`)
      }
      
      // Verificar segurança
      if (!tool.config.safe && this.securityLevel === 'high') {
        throw new Error(`Tool "${toolName}" requires lower security level`)
      }
      
      console.log(`🔧 Executing tool: ${toolName}`)
      
      // Validar parâmetros
      this.validateParameters(tool, parameters)
      
      // Executar tool
      const result = await tool.func(parameters)
      
      const execution = {
        toolName,
        parameters,
        result,
        success: true,
        duration: Date.now() - startTime,
        timestamp: Date.now()
      }
      
      this.executionHistory.push(execution)
      
      // Manter histórico limitado
      if (this.executionHistory.length > 100) {
        this.executionHistory = this.executionHistory.slice(-100)
      }
      
      console.log(`✅ Tool executed: ${toolName} (${execution.duration}ms)`)
      
      return execution
      
    } catch (error) {
      console.error(`❌ Tool execution error: ${toolName}`, error)
      
      const execution = {
        toolName,
        parameters,
        error: error.message,
        success: false,
        duration: Date.now() - startTime,
        timestamp: Date.now()
      }
      
      this.executionHistory.push(execution)
      
      return execution
    }
  }

  validateParameters(tool, parameters) {
    const required = tool.config.parameters
    
    for (const param of required) {
      if (!(param in parameters)) {
        throw new Error(`Required parameter "${param}" missing for tool "${tool.name}"`)
      }
    }
  }

  // Implementações das tools
  async getTime() {
    return {
      currentTime: new Date().toISOString(),
      timestamp: Date.now(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      formatted: new Date().toLocaleString()
    }
  }

  async getVersion() {
    return {
      name: "Ai-GROOT",
      version: "9.0.0",
      edition: "Professional",
      capabilities: [
        "embeddings",
        "vector_memory",
        "tools",
        "planner",
        "agents",
        "consciousness"
      ],
      build: Date.now()
    }
  }

  async getSystemInfo() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      toolsCount: this.tools.size,
      executionHistory: this.executionHistory.length,
      securityLevel: this.securityLevel
    }
  }

  async readFile({ path }) {
    const result = await fileSystem.read(path)
    return {
      path,
      content: result.content,
      size: result.size,
      success: result.success
    }
  }

  async writeFile({ path, content }) {
    const result = await fileSystem.write(path, content)
    return {
      path,
      bytesWritten: content.length,
      success: result.success
    }
  }

  async listFiles({ path }) {
    const files = []
    
    try {
      const entries = await fileSystem.readDirectory(path)
      return {
        path,
        files: entries,
        count: entries.length
      }
    } catch (error) {
      return {
        path,
        files: [],
        count: 0,
        error: error.message
      }
    }
  }

  async saveMemory({ text }) {
    const result = await vectorStore.saveVector(text, {
      type: 'tool_memory',
      source: 'tools'
    })
    
    return {
      text: text.substring(0, 100) + '...',
      success: result.success,
      vectorId: result.data?.id
    }
  }

  async searchMemory({ query }) {
    const result = await vectorStore.searchVectors(query, 5, 0.5)
    
    return {
      query,
      results: result.results,
      count: result.results.length,
      success: result.success
    }
  }

  async addExperience({ experience }) {
    const experienceRecord = typeof experience === 'string' 
      ? { input: experience, type: 'tool_generated' }
      : experience
    
    const result = experienceStore.add(experienceRecord)
    
    return {
      experienceId: result.id,
      type: result.type,
      success: true
    }
  }

  async runCommand({ command }) {
    const result = await commandRunner.run(command)
    
    return {
      command,
      output: result.output,
      success: result.success,
      duration: result.duration
    }
  }

  async analyzeCode({ code, language = 'javascript' }) {
    const analysis = {
      language,
      lines: code.split('\n').length,
      characters: code.length,
      complexity: this.calculateComplexity(code),
      patterns: this.identifyPatterns(code),
      issues: this.identifyIssues(code, language)
    }
    
    return analysis
  }

  async calculate({ expression }) {
    try {
      // Avaliar expressão matemática segura
      const safeExpression = expression.replace(/[^0-9+\-*/().\s]/g, '')
      const result = Function('"use strict"; return (' + safeExpression + ')')()
      
      return {
        expression,
        result,
        success: true
      }
    } catch (error) {
      return {
        expression,
        error: error.message,
        success: false
      }
    }
  }

  calculateComplexity(code) {
    const lines = code.split('\n')
    let complexity = 1
    
    // Contar estruturas de controle
    const controlStructures = ['if', 'else', 'for', 'while', 'switch', 'case', 'try', 'catch', 'function']
    
    lines.forEach(line => {
      controlStructures.forEach(struct => {
        if (line.includes(struct)) {
          complexity++
        }
      })
    })
    
    return {
      score: complexity,
      level: complexity < 5 ? 'low' : complexity < 15 ? 'medium' : 'high'
    }
  }

  identifyPatterns(code) {
    const patterns = []
    
    if (code.includes('function')) patterns.push('function_declaration')
    if (code.includes('class')) patterns.push('class_definition')
    if (code.includes('async')) patterns.push('async_function')
    if (code.includes('await')) patterns.push('await_usage')
    if (code.includes('try')) patterns.push('error_handling')
    if (code.includes('=>')) patterns.push('arrow_function')
    
    return patterns
  }

  identifyIssues(code, language) {
    const issues = []
    
    // Verificar problemas comuns
    if (code.includes('console.log') && language === 'javascript') {
      issues.push({
        type: 'debug_code',
        severity: 'low',
        message: 'Console.log found in production code'
      })
    }
    
    if (code.includes('var ') && language === 'javascript') {
      issues.push({
        type: 'deprecated_syntax',
        severity: 'medium',
        message: 'Var keyword is deprecated, use const/let'
      })
    }
    
    if (code.includes('eval') && language === 'javascript') {
      issues.push({
        type: 'security_risk',
        severity: 'high',
        message: 'Eval function detected - security risk'
      })
    }
    
    return issues
  }

  getAvailableTools() {
    const tools = {}
    
    for (const [name, tool] of this.tools.entries()) {
      tools[name] = {
        description: tool.config.description,
        category: tool.config.category,
        safe: tool.config.safe,
        parameters: tool.config.parameters
      }
    }
    
    return tools
  }

  getToolsByCategory(category) {
    const tools = this.getAvailableTools()
    const filtered = {}
    
    for (const [name, tool] of Object.entries(tools)) {
      if (tool.category === category) {
        filtered[name] = tool
      }
    }
    
    return filtered
  }

  getExecutionHistory(limit = 10) {
    return this.executionHistory.slice(-limit)
  }

  setSecurityLevel(level) {
    const validLevels = ['low', 'medium', 'high', 'critical']
    if (validLevels.includes(level)) {
      this.securityLevel = level
      console.log(`🔒 Security level set to: ${level}`)
    }
  }

  getStats() {
    const categoryCounts = {}
    const safeCounts = { safe: 0, unsafe: 0 }
    
    for (const tool of this.tools.values()) {
      categoryCounts[tool.config.category] = (categoryCounts[tool.config.category] || 0) + 1
      if (tool.config.safe) {
        safeCounts.safe++
      } else {
        safeCounts.unsafe++
      }
    }
    
    const recentExecutions = this.executionHistory.slice(-10)
    const successRate = recentExecutions.length > 0 
      ? recentExecutions.filter(e => e.success).length / recentExecutions.length 
      : 0
    
    return {
      totalTools: this.tools.size,
      categoryCounts,
      safeCounts,
      securityLevel: this.securityLevel,
      executionHistory: this.executionHistory.length,
      successRate: (successRate * 100).toFixed(1) + '%',
      recentExecutions: recentExecutions.slice(-5)
    }
  }

  exportToolsData() {
    return {
      tools: this.getAvailableTools(),
      stats: this.getStats(),
      executionHistory: this.executionHistory,
      exportTimestamp: Date.now()
    }
  }
}

export const tools = new Tools()
