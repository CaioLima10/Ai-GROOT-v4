import { askMultiAI } from '../core/multiAI.js'

export class CodeAgent {
  constructor() {
    this.name = 'codeAgent'
    this.capabilities = [
      'generate_code',
      'refactor_code',
      'optimize_code',
      'create_functions',
      'create_classes',
      'create_apis',
      'create_components'
    ]
  }

  async run(task, analysis, context = {}) {
    console.log(`💻 CodeAgent: Gerando código para: ${task}`)
    
    const codeType = this.detectCodeType(task, analysis)
    const language = this.detectLanguage(task, context)
    
    const prompt = this.buildPrompt(task, codeType, language, analysis, context)
    
    try {
      const response = await askMultiAI(prompt)
      
      const codeResponse = {
        success: true,
        code: this.extractCode(response),
        explanation: this.extractExplanation(response),
        language,
        type: codeType,
        confidence: this.calculateConfidence(response, analysis),
        metadata: {
          task,
          codeType,
          language,
          lines: response.split('\n').length,
          hasTests: response.includes('test') || response.includes('describe')
        }
      }
      
      console.log(`✅ CodeAgent: Código gerado (${codeResponse.language} - ${codeResponse.type})`)
      return codeResponse
      
    } catch (error) {
      console.error(`❌ CodeAgent: Erro ao gerar código:`, error)
      return {
        success: false,
        error: error.message,
        codeType,
        language
      }
    }
  }

  detectCodeType(task, analysis) {
    const keywords = {
      'function': 'function',
      'class': 'class',
      'api': 'api',
      'component': 'component',
      'server': 'server',
      'database': 'database',
      'frontend': 'frontend',
      'backend': 'backend',
      'refactor': 'refactor',
      'optimize': 'optimize'
    }
    
    const lowerTask = task.toLowerCase()
    
    for (const [keyword, type] of Object.entries(keywords)) {
      if (lowerTask.includes(keyword)) {
        return type
      }
    }
    
    return 'general'
  }

  detectLanguage(task, context) {
    // Detectar linguagem baseada no contexto e palavras-chave
    const languages = {
      'javascript': ['js', 'javascript', 'node', 'react', 'vue', 'angular'],
      'python': ['python', 'django', 'flask', 'pandas', 'numpy'],
      'java': ['java', 'spring', 'maven', 'gradle'],
      'typescript': ['typescript', 'ts', 'react typescript'],
      'go': ['go', 'golang'],
      'rust': ['rust', 'cargo'],
      'cpp': ['c++', 'cpp', 'c++'],
      'csharp': ['c#', 'csharp', '.net'],
      'php': ['php', 'laravel', 'symfony']
    }
    
    const lowerTask = task.toLowerCase()
    
    // Verificar no contexto primeiro
    if (context.language) {
      return context.language
    }
    
    // Verificar na tarefa
    for (const [lang, keywords] of Object.entries(languages)) {
      if (keywords.some(keyword => lowerTask.includes(keyword))) {
        return lang
      }
    }
    
    return 'javascript' // Default
  }

  buildPrompt(task, codeType, language, analysis, context) {
    const basePrompt = `Você é um especialista em desenvolvimento de software com ${this.capabilities.length} anos de experiência.

TAREFA: ${task}
TIPO DE CÓDIGO: ${codeType}
LINGUAGEM: ${language.toUpperCase()}`

    const specificInstructions = this.getSpecificInstructions(codeType, language)
    const contextInfo = context.projectInfo ? `\nCONTEXTO DO PROJETO:\n${context.projectInfo}` : ''
    
    const fullPrompt = `${basePrompt}

${specificInstructions}

${contextInfo}

REQUISITOS:
- Código limpo e bem estruturado
- Boas práticas e padrões da linguagem
- Comentários explicativos onde necessário
- Tratamento de erros adequado
- Performance otimizada
- Segurança em mente

${this.getCodeExamples(codeType, language)}

Por favor, gere o código completo e funcional:`
    
    return fullPrompt
  }

  getSpecificInstructions(codeType, language) {
    const instructions = {
      function: `
INSTRUÇÕES ESPECÍFICAS PARA FUNÇÃO:
- Nome descritivo
- Parâmetros bem definidos
- Return type explícito
- Documentação JSDoc/Docstring
- Validação de entradas`,
      
      class: `
INSTRUÇÕES ESPECÍFICAS PARA CLASSE:
- Nome PascalCase
- Propriedades privadas com _
- Métodos públicos claros
- Constructor bem definido
- Encapsulamento adequado`,
      
      api: `
INSTRUÇÕES ESPECÍFICAS PARA API:
- Endpoints RESTful
- Status codes adequados
- Validação de inputs
- Tratamento de erros
- Documentação OpenAPI
- Segurança (CORS, autenticação)`,
      
      component: `
INSTRUÇÕES ESPECÍFICAS PARA COMPONENTE:
- Props bem definidas
- Estado local se necessário
- Reusabilidade
- Acessibilidade
- Responsividade`,
      
      server: `
INSTRUÇÕES ESPECÍFICAS PARA SERVIDOR:
- Configuração segura
- Middleware adequado
- Logging implementado
- Error handling
- Performance otimizada`,
      
      refactor: `
INSTRUÇÕES ESPECÍFICAS PARA REFACTOR:
- Manter funcionalidade
- Melhorar legibilidade
- Reduzir complexidade
- Eliminar código duplicado
- Aplicar padrões de design`,
      
      optimize: `
INSTRUÇÕES ESPECÍFICAS PARA OTIMIZAÇÃO:
- Identificar gargalos
- Reduzir complexidade algorítmica
- Otimizar uso de memória
- Melhorar performance
- Manter legibilidade`
    }
    
    return instructions[codeType] || ''
  }

  getCodeExamples(codeType, language) {
    const examples = {
      javascript: {
        function: `
// Exemplo de função em JavaScript:
/**
 * Descrição da função
 * @param {type} param - Descrição do parâmetro
 * @returns {type} Descrição do retorno
 */
function functionName(param) {
  // Validação
  if (!param) {
    throw new Error('Parâmetro obrigatório')
  }
  
  // Lógica principal
  const result = param * 2
  
  return result
}`,
        
        class: `
// Exemplo de classe em JavaScript:
class ClassName {
  constructor(param) {
    this._param = param
  }
  
  get param() {
    return this._param
  }
  
  set param(value) {
    this._param = value
  }
  
  method() {
    return this._param
  }
}`
      }
    }
    
    return examples[language]?.[codeType] || ''
  }

  extractCode(response) {
    // Extrair blocos de código da resposta
    const codeBlocks = response.match(/```[\s\S]*?```/g) || []
    
    if (codeBlocks.length > 0) {
      return codeBlocks.map(block => block.replace(/```(\w+)?\n?/g, '').replace(/```$/g, '')).join('\n\n')
    }
    
    // Se não houver blocos, procurar por código solto
    const lines = response.split('\n')
    const codeLines = lines.filter(line => 
      line.includes('function') || 
      line.includes('class') || 
      line.includes('const ') || 
      line.includes('let ') || 
      line.includes('var ')
    )
    
    return codeLines.length > 0 ? codeLines.join('\n') : response
  }

  extractExplanation(response) {
    // Extrair explicação do código
    const withoutCode = response.replace(/```[\s\S]*?```/g, '')
    return withoutCode.trim()
  }

  calculateConfidence(response, analysis) {
    let confidence = 0.8 // Base
    
    // Aumentar confiança se tiver código bem estruturado
    if (response.includes('function') || response.includes('class')) {
      confidence += 0.1
    }
    
    // Aumentar se tiver comentários
    if (response.includes('//') || response.includes('*')) {
      confidence += 0.05
    }
    
    // Aumentar se tiver tratamento de erros
    if (response.includes('try') || response.includes('catch')) {
      confidence += 0.05
    }
    
    return Math.min(1.0, confidence)
  }
}

export const codeAgent = new CodeAgent()
