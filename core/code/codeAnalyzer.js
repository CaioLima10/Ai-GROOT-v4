import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import * as ts from 'ts-morph'
import { Project } from 'ts-morph'

export class CodeAnalyzer {
  constructor() {
    this.project = new Project()
  }
  
  async analyze(text) {
    const code = this.extractCode(text)
    
    if (!code.hasCode) {
      return { hasCode: false, message: 'Nenhum código encontrado' }
    }
    
    const analysis = {
      hasCode: true,
      languages: this.detectLanguages(code),
      structures: this.analyzeStructure(code),
      metrics: this.calculateMetrics(code),
      issues: this.detectIssues(code),
      suggestions: this.generateSuggestions(code)
    }
    
    return analysis
  }
  
  async deepAnalyze(code, language = 'javascript') {
    const analysis = await this.analyze(code)
    
    // Análise profunda baseada na linguagem
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        return await this.analyzeJavaScript(code, analysis)
      case 'python':
        return await this.analyzePython(code, analysis)
      case 'java':
        return await this.analyzeJava(code, analysis)
      default:
        return analysis
    }
  }
  
  extractCode(text) {
    const blocks = {
      blocks: (text.match(/```[\s\S]*?```/g) || []).map(block => 
        block.replace(/```(\w+)?\n?/g, '').replace(/```$/g, '')
      ),
      functions: (text.match(/function\s+\w+[\s\S]*?}/g) || []),
      classes: (text.match(/class\s+\w+[\s\S]*?}/g) || []),
      methods: (text.match(/\w+\s*\([^)]*\)\s*[\s\S]*?}/g) || []),
      variables: (text.match(/(?:const|let|var)\s+\w+/g) || [])
    }
    
    return {
      ...blocks,
      hasCode: Object.values(blocks).some(arr => arr.length > 0),
      totalLines: blocks.blocks.join('\n').split('\n').length
    }
  }
  
  detectLanguages(code) {
    const languages = []
    const allCode = [...code.blocks, ...code.functions, ...code.classes].join('\n')
    
    // Detectar JavaScript/TypeScript
    if (allCode.includes('function') || allCode.includes('const ') || allCode.includes('let ')) {
      languages.push('javascript')
    }
    
    // Detectar TypeScript
    if (allCode.includes(': string') || allCode.includes(': number') || allCode.includes('interface ')) {
      languages.push('typescript')
    }
    
    // Detectar Python
    if (allCode.includes('def ') || allCode.includes('import ') || allCode.includes('class ')) {
      languages.push('python')
    }
    
    // Detectar Java
    if (allCode.includes('public class') || allCode.includes('private ') || allCode.includes('public static void')) {
      languages.push('java')
    }
    
    return languages.length > 0 ? languages : ['unknown']
  }
  
  analyzeStructure(code) {
    const structures = {
      functions: [],
      classes: [],
      variables: [],
      imports: [],
      exports: []
    }
    
    // Analisar funções
    code.functions.forEach(func => {
      const name = func.match(/function\s+(\w+)/)?.[1] || 'anonymous'
      const params = func.match(/\(([^)]*)\)/)?.[1] || ''
      structures.functions.push({ name, params, complexity: this.calculateComplexity(func) })
    })
    
    // Analisar classes
    code.classes.forEach(cls => {
      const name = cls.match(/class\s+(\w+)/)?.[1] || 'anonymous'
      const methods = cls.match(/(\w+)\s*\([^)]*\)/g) || []
      structures.classes.push({ name, methodCount: methods.length, methods })
    })
    
    // Analisar variáveis
    code.variables.forEach(variable => {
      const type = variable.match(/(const|let|var)/)?.[1] || 'unknown'
      const name = variable.match(/(?:const|let|var)\s+(\w+)/)?.[1] || 'unknown'
      structures.variables.push({ name, type })
    })
    
    return structures
  }
  
  calculateMetrics(code) {
    const allCode = [...code.blocks, ...code.functions, ...code.classes].join('\n')
    
    return {
      linesOfCode: code.totalLines,
      cyclomaticComplexity: this.calculateCyclomaticComplexity(allCode),
      maintainabilityIndex: this.calculateMaintainabilityIndex(allCode),
      technicalDebt: this.estimateTechnicalDebt(allCode),
      testCoverage: this.estimateTestCoverage(allCode)
    }
  }
  
  calculateComplexity(code) {
    const complexity = 1 // Base complexity
    
    // Contar pontos de decisão
    const decisions = code.match(/\b(if|while|for|switch|case|catch)\b/g) || []
    return complexity + decisions.length
  }
  
  calculateCyclomaticComplexity(code) {
    let complexity = 1
    
    // Contar nós de decisão
    const decisionNodes = code.match(/\b(if|else|while|for|switch|case|catch|&&|\|\|)\b/g) || []
    complexity += decisionNodes.length
    
    return complexity
  }
  
  calculateMaintainabilityIndex(code) {
    // Fórmula simplificada do Maintainability Index
    const loc = code.split('\n').length
    const complexity = this.calculateCyclomaticComplexity(code)
    const volume = loc * Math.log2(loc + 1)
    
    // MI = 171 - 5.2 * ln(Halstead Volume) - 0.23 * (Cyclomatic Complexity) - 16.2 * ln(Lines of Code)
    const mi = Math.max(0, 171 - 5.2 * Math.log(volume) - 0.23 * complexity - 16.2 * Math.log(loc))
    
    return Math.round(mi)
  }
  
  estimateTechnicalDebt(code) {
    const issues = []
    
    // Code smells comuns
    if (code.includes('console.log')) {
      issues.push({ type: 'debug_code', severity: 'low', message: 'Console.log encontrado em código de produção' })
    }
    
    if (code.match(/var\s+\w+/)) {
      issues.push({ type: 'var_usage', severity: 'medium', message: 'Uso de "var" desatualizado' })
    }
    
    if (code.length > 1000) {
      issues.push({ type: 'long_function', severity: 'medium', message: 'Função muito longa' })
    }
    
    const complexity = this.calculateCyclomaticComplexity(code)
    if (complexity > 10) {
      issues.push({ type: 'high_complexity', severity: 'high', message: `Complexidade ciclomática alta: ${complexity}` })
    }
    
    return {
      totalHours: issues.length * 2, // Estimativa simples
      issues,
      score: Math.max(0, 100 - issues.length * 10)
    }
  }
  
  estimateTestCoverage(code) {
    // Heurística simples para estimar cobertura de testes
    const hasTests = code.includes('test(') || code.includes('it(') || code.includes('describe(')
    const hasAssertions = code.includes('expect(') || code.includes('assert.')
    
    if (hasTests && hasAssertions) {
      return { estimated: 80, hasTests: true }
    } else if (hasTests) {
      return { estimated: 40, hasTests: true }
    } else {
      return { estimated: 0, hasTests: false }
    }
  }
  
  detectIssues(code) {
    const issues = []
    
    code.blocks.forEach((block, index) => {
      // Verificar problemas comuns
      if (block.includes('eval(')) {
        issues.push({ type: 'security', severity: 'high', message: 'Uso de eval() detectado', location: `block ${index + 1}` })
      }
      
      if (block.includes('innerHTML')) {
        issues.push({ type: 'security', severity: 'medium', message: 'innerHTML pode ser vulnerável a XSS', location: `block ${index + 1}` })
      }
      
      if (block.match(/catch\s*\(\s*\)\s*\{\s*\}/)) {
        issues.push({ type: 'error_handling', severity: 'medium', message: 'Catch vazio detectado', location: `block ${index + 1}` })
      }
    })
    
    return issues
  }
  
  generateSuggestions(code) {
    const suggestions = []
    
    // Sugerir melhorias baseadas na análise
    if (code.variables.length > 10) {
      suggestions.push({ type: 'refactoring', message: 'Considere extrair variáveis para um objeto ou classe' })
    }
    
    if (code.functions.length > 5) {
      suggestions.push({ type: 'structure', message: 'Considere dividir em múltiplos arquivos ou módulos' })
    }
    
    const complexity = this.calculateCyclomaticComplexity(code.blocks.join('\n'))
    if (complexity > 5) {
      suggestions.push({ type: 'complexity', message: 'Reduza a complexidade extraindo funções menores' })
    }
    
    if (!code.blocks.some(block => block.includes('async') || block.includes('await'))) {
      suggestions.push({ type: 'performance', message: 'Considere usar async/await para operações assíncronas' })
    }
    
    return suggestions
  }
  
  async analyzeJavaScript(code, analysis) {
    try {
      // Parse com Babel para análise mais profunda
      const ast = parse(code.blocks.join('\n'), {
        sourceType: 'module',
        plugins: ['jsx', 'typescript']
      })
      
      const jsAnalysis = {
        ast: null,
        dependencies: [],
        imports: [],
        exports: [],
        unusedVariables: []
      }
      
      traverse(ast, {
        ImportDeclaration(path) {
          jsAnalysis.imports.push(path.node.source.value)
        },
        ExportDeclaration(path) {
          jsAnalysis.exports.push(path.type)
        },
        VariableDeclarator(path) {
          // Detectar variáveis não utilizadas (simplificado)
          const name = path.node.id.name
          if (!path.scope.bindings[name]?.referenced) {
            jsAnalysis.unusedVariables.push(name)
          }
        }
      })
      
      return { ...analysis, javascript: jsAnalysis }
    } catch (error) {
      console.error('Erro na análise JavaScript:', error)
      return analysis
    }
  }
}

export const codeAnalyzer = new CodeAnalyzer()
