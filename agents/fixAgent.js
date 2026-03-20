import { askMultiAI } from '../core/multiAI.js'
import { codeAgent } from './codeAgent.js'

export class FixAgent {
  constructor() {
    this.name = 'fixAgent'
    this.capabilities = [
      'debug_errors',
      'fix_bugs',
      'optimize_performance',
      'security_fixes',
      'dependency_issues',
      'runtime_errors',
      'syntax_errors',
      'logic_errors'
    ]
    
    this.errorPatterns = new Map([
      ['ReferenceError', 'variável não definida'],
      ['TypeError', 'tipo de dado incorreto'],
      ['SyntaxError', 'erro de sintaxe'],
      ['NetworkError', 'problema de rede'],
      ['DatabaseError', 'erro no banco de dados'],
      ['AuthenticationError', 'problema de autenticação'],
      ['PermissionError', 'problema de permissão']
    ])
  }

  async run(task, analysis, context = {}) {
    console.log(`🔧 FixAgent: Analisando erro em: ${task}`)
    
    try {
      // 1. Identificar tipo de erro
      const errorInfo = this.identifyError(task, context)
      console.log(`🔍 Erro identificado: ${errorInfo.type} - ${errorInfo.description}`)
      
      // 2. Analisar contexto do erro
      const contextAnalysis = await this.analyzeErrorContext(errorInfo, context)
      
      // 3. Buscar soluções conhecidas
      const knownSolutions = await this.searchKnownSolutions(errorInfo)
      
      // 4. Gerar correção
      const fix = await this.generateFix(errorInfo, contextAnalysis, knownSolutions)
      
      // 5. Validar correção
      const validatedFix = await this.validateFix(fix, errorInfo)
      
      const fixResponse = {
        success: true,
        originalError: errorInfo,
        analysis: contextAnalysis,
        fix: validatedFix,
        solutions: knownSolutions,
        confidence: this.calculateFixConfidence(validatedFix, errorInfo),
        metadata: {
          errorType: errorInfo.type,
          severity: errorInfo.severity,
          fixComplexity: validatedFix.complexity,
          estimatedTime: validatedFix.estimatedTime
        }
      }
      
      console.log(`✅ FixAgent: Erro corrigido (${fixResponse.metadata.fixComplexity})`)
      return fixResponse
      
    } catch (error) {
      console.error(`❌ FixAgent: Erro ao corrigir:`, error)
      return {
        success: false,
        error: error.message,
        suggestion: 'Forneça mais detalhes sobre o erro ou o código completo'
      }
    }
  }

  identifyError(task, context) {
    const lowerTask = task.toLowerCase()
    
    // Verificar se há mensagem de erro explícita
    const errorMatch = task.match(/error[:\s]*(.+)/i) || task.match(/(.*)error/i)
    
    if (errorMatch) {
      const errorMessage = errorMatch[1].trim()
      
      // Identificar tipo de erro baseado na mensagem
      for (const [pattern, description] of this.errorPatterns) {
        if (errorMessage.toLowerCase().includes(pattern.toLowerCase())) {
          return {
            type: pattern,
            description,
            message: errorMessage,
            severity: this.getErrorSeverity(pattern),
            hasCode: task.includes('```') || context.code
          }
        }
      }
    }
    
    // Se não encontrar padrão específico, análise genérica
    return {
      type: 'UnknownError',
      description: 'Erro não identificado',
      message: task,
      severity: 'medium',
      hasCode: task.includes('```') || context.code
    }
  }

  getErrorSeverity(errorType) {
    const severityMap = {
      'ReferenceError': 'high',
      'TypeError': 'high',
      'SyntaxError': 'critical',
      'NetworkError': 'medium',
      'DatabaseError': 'high',
      'AuthenticationError': 'critical',
      'PermissionError': 'medium'
    }
    
    return severityMap[errorType] || 'medium'
  }

  async analyzeErrorContext(errorInfo, context) {
    const analysis = {
      hasCode: errorInfo.hasCode,
      codeContext: context.code || null,
      environment: context.environment || 'unknown',
      framework: context.framework || 'unknown',
      dependencies: context.dependencies || [],
      recentChanges: context.recentChanges || []
    }
    
    // Se houver código, analisar profundamente
    if (analysis.hasCode && analysis.codeContext) {
      const codeAnalysis = await this.analyzeErrorCode(analysis.codeContext)
      analysis.codeAnalysis = codeAnalysis
    }
    
    return analysis
  }

  async analyzeErrorCode(code) {
    // Análise básica do código com erro
    const lines = code.split('\n')
    
    return {
      lineCount: lines.length,
      hasFunctions: code.includes('function'),
      hasClasses: code.includes('class'),
      hasAsync: code.includes('async') || code.includes('await'),
      hasTryCatch: code.includes('try') && code.includes('catch'),
      complexity: this.calculateComplexity(code),
      potentialIssues: this.identifyPotentialIssues(code)
    }
  }

  calculateComplexity(code) {
    // Cálculo simples de complexidade ciclomática
    const complexityKeywords = ['if', 'else', 'while', 'for', 'switch', 'case', 'catch', '&&', '||']
    let complexity = 1
    
    complexityKeywords.forEach(keyword => {
      const matches = code.match(new RegExp(keyword, 'g'))
      if (matches) {
        complexity += matches.length
      }
    })
    
    return complexity
  }

  identifyPotentialIssues(code) {
    const issues = []
    
    if (code.includes('console.log')) {
      issues.push('console.log em código de produção')
    }
    
    if (code.includes('eval(')) {
      issues.push('uso de eval() - risco de segurança')
    }
    
    if (code.match(/var\s+\w+/)) {
      issues.push('uso de var - preferir const/let')
    }
    
    return issues
  }

  async searchKnownSolutions(errorInfo) {
    // Simular busca em StackOverflow, GitHub Issues, etc.
    const solutions = [
      {
        source: 'StackOverflow',
        title: `Como resolver ${errorInfo.type}`,
        description: `Solução comum para ${errorInfo.description}`,
        code: this.generateCommonSolution(errorInfo.type),
        votes: Math.floor(Math.random() * 100) + 50
      }
    ]
    
    return solutions
  }

  generateCommonSolution(errorType) {
    const solutions = {
      'ReferenceError': 'const variable = valor; // declarar variável',
      'TypeError': 'if (typeof variable === \'string\') { // validar tipo }',
      'SyntaxError': '// Verificar sintaxe: ponto e vírgula, parênteses',
      'NetworkError': 'try { const response = await fetch(url) } catch (error) { console.error(error) }',
      'AuthenticationError': 'const token = localStorage.getItem(\'token\'); if (!token) { redirect(\'/login\') }'
    }
    
    return solutions[errorType] || '// Verificar documentação da API'
  }

  async generateFix(errorInfo, contextAnalysis, knownSolutions) {
    const prompt = this.buildFixPrompt(errorInfo, contextAnalysis, knownSolutions)
    
    try {
      const response = await askMultiAI(prompt)
      
      return {
        code: this.extractFixCode(response),
        explanation: this.extractFixExplanation(response),
        steps: this.extractFixSteps(response),
        tests: this.generateTests(errorInfo, contextAnalysis),
        complexity: this.estimateFixComplexity(errorInfo, response),
        estimatedTime: this.estimateFixTime(errorInfo)
      }
    } catch (error) {
      throw new Error(`Falha ao gerar correção: ${error.message}`)
    }
  }

  buildFixPrompt(errorInfo, contextAnalysis, knownSolutions) {
    return `Você é um especialista em debugging e correção de erros de software.

ERRO IDENTIFICADO:
- Tipo: ${errorInfo.type}
- Descrição: ${errorInfo.description}
- Mensagem: ${errorInfo.message}
- Severidade: ${errorInfo.severity}

CONTEXTO DO ERRO:
${contextAnalysis.codeContext ? `CÓDIGO COM ERRO:\n${contextAnalysis.codeContext}` : 'Nenhum código fornecido'}
${contextAnalysis.codeAnalysis ? `\nANÁLISE DO CÓDIGO:\n${JSON.stringify(contextAnalysis.codeAnalysis, null, 2)}` : ''}

SOLUÇÕES CONHECIDAS:
${knownSolutions.map(s => `- ${s.title}: ${s.description}`).join('\n')}

REQUISITOS PARA A CORREÇÃO:
1. Identificar a causa raiz do erro
2. Fornecer código corrigido
3. Explicar o que foi alterado e por quê
4. Incluir tratamento preventivo de erros futuros
5. Adicionar testes se aplicável
6. Manter a lógica original intacta

Por favor, forneça:
- Código corrigido (em bloco de código)
- Explicação detalhada das alterações
- Passos para evitar o erro no futuro
- Testes para validar a correção`
  }

  extractFixCode(response) {
    const codeBlocks = response.match(/```[\s\S]*?```/g) || []
    return codeBlocks.map(block => block.replace(/```(\w+)?\n?/g, '').replace(/```$/g, '')).join('\n\n')
  }

  extractFixExplanation(response) {
    const withoutCode = response.replace(/```[\s\S]*?```/g, '')
    return withoutCode.trim()
  }

  extractFixSteps(response) {
    // Extrair passos numerados da resposta
    const steps = response.match(/\d+\.\s*.+/g) || []
    return steps.map(step => step.replace(/^\d+\.\s*/, ''))
  }

  generateTests(errorInfo, contextAnalysis) {
    if (errorInfo.type === 'ReferenceError') {
      return `// Teste para ReferenceError
describe('ReferenceError Fix', () => {
  it('should not throw ReferenceError', () => {
    expect(() => {
      // chamar função corrigida
    }).not.toThrow(ReferenceError)
  })
})`
    }
    
    return `// Teste genérico
describe('Error Fix', () => {
  it('should work without errors', () => {
    // implementar teste específico
  })
})`
  }

  estimateFixComplexity(errorInfo, response) {
    let complexity = 'simple'
    
    if (errorInfo.severity === 'critical') complexity = 'complex'
    else if (errorInfo.severity === 'high') complexity = 'medium'
    
    if (response.includes('refactor') || response.includes('redesign')) {
      complexity = 'complex'
    }
    
    return complexity
  }

  estimateFixTime(errorInfo) {
    const timeMap = {
      'simple': '5-10 minutos',
      'medium': '10-30 minutos',
      'complex': '30-60 minutos'
    }
    
    return timeMap[this.estimateFixComplexity(errorInfo, '')] || '10-30 minutos'
  }

  async validateFix(fix, errorInfo) {
    // Validação básica da correção
    const validation = {
      hasCode: fix.code && fix.code.length > 0,
      hasExplanation: fix.explanation && fix.explanation.length > 50,
      hasSteps: fix.steps && fix.steps.length > 0,
      addressesError: this.checkIfFixAddressesError(fix, errorInfo)
    }
    
    validation.isValid = Object.values(validation).every(v => v === true)
    validation.score = Object.values(validation).filter(v => v === true).length / Object.keys(validation).length
    
    return {
      ...fix,
      validation
    }
  }

  checkIfFixAddressesError(fix, errorInfo) {
    // Verificar se a correção aborda o erro original
    const fixLower = fix.code.toLowerCase()
    const errorLower = errorInfo.message.toLowerCase()
    
    // Verificação simples baseada em palavras-chave
    const fixKeywords = ['const', 'let', 'var', 'function', 'class', 'try', 'catch', 'if', 'typeof']
    
    return fixKeywords.some(keyword => 
      fixLower.includes(keyword) && errorLower.includes(keyword.split(' ')[0])
    )
  }

  calculateFixConfidence(fix, errorInfo) {
    let confidence = 0.7 // Base
    
    if (fix.validation?.isValid) {
      confidence += 0.2
    }
    
    if (fix.validation?.score > 0.8) {
      confidence += 0.1
    }
    
    if (errorInfo.severity === 'low') {
      confidence += 0.05
    }
    
    return Math.min(1.0, confidence)
  }
}

export const fixAgent = new FixAgent()
