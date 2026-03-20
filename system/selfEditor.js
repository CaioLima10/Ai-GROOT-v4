import { fileSystem } from './fileSystem.js'
import { askMultiAI } from '../core/multiAI.js'

export class SelfEditor {
  constructor() {
    this.editHistory = []
    this.backupEnabled = true
  }

  async improve(filePath, improvementType = 'general') {
    console.log(`🔧 Melhorando arquivo: ${filePath} (${improvementType})`)
    
    try {
      // Ler arquivo atual
      const fileContent = await fileSystem.read(filePath)
      
      if (!fileContent.success) {
        throw new Error(`Não foi possível ler o arquivo: ${filePath}`)
      }
      
      // Criar backup antes de editar
      if (this.backupEnabled) {
        await this.createBackup(filePath, fileContent.content)
      }
      
      // Gerar prompt específico baseado no tipo de melhoria
      const prompt = this.generateImprovementPrompt(fileContent.content, improvementType)
      
      // Pedir à IA para melhorar
      const improvedCode = await askMultiAI(prompt)
      
      // Salvar arquivo melhorado
      const writeResult = await fileSystem.write(filePath, improvedCode)
      
      if (writeResult.success) {
        const editRecord = {
          filePath,
          improvementType,
          originalSize: fileContent.size,
          newSize: improvedCode.length,
          timestamp: Date.now(),
          success: true
        }
        
        this.editHistory.push(editRecord)
        console.log(`✅ Arquivo melhorado: ${filePath}`)
        
        return {
          success: true,
          message: `Arquivo melhorado: ${filePath}`,
          filePath,
          improvementType,
          sizeChange: improvedCode.length - fileContent.size,
          editRecord
        }
      } else {
        throw new Error(writeResult.error)
      }
      
    } catch (error) {
      console.error(`❌ Erro ao melhorar arquivo ${filePath}:`, error)
      
      const errorRecord = {
        filePath,
        improvementType,
        error: error.message,
        timestamp: Date.now(),
        success: false
      }
      
      this.editHistory.push(errorRecord)
      
      return {
        success: false,
        error: error.message,
        filePath
      }
    }
  }

  async refactor(filePath, refactorType = 'clean') {
    console.log(`🔄 Refatorando arquivo: ${filePath} (${refactorType})`)
    
    return await this.improve(filePath, `refactor_${refactorType}`)
  }

  async optimize(filePath, optimizationType = 'performance') {
    console.log(`⚡ Otimizando arquivo: ${filePath} (${optimizationType})`)
    
    return await this.improve(filePath, `optimize_${optimizationType}`)
  }

  async fix(filePath, errorDescription = '') {
    console.log(`🔧 Corrigindo arquivo: ${filePath} (${errorDescription})`)
    
    try {
      const fileContent = await fileSystem.read(filePath)
      
      if (!fileContent.success) {
        throw new Error(`Não foi possível ler o arquivo: ${filePath}`)
      }
      
      // Criar backup
      if (this.backupEnabled) {
        await this.createBackup(filePath, fileContent.content)
      }
      
      const prompt = `
Corrija o erro neste arquivo:

ERRO: ${errorDescription}

CÓDIGO:
\`\`\`
${fileContent.content}
\`\`\`

Forneça apenas o código corrigido, sem explicações adicionais.
`
      
      const fixedCode = await askMultiAI(prompt)
      const writeResult = await fileSystem.write(filePath, fixedCode)
      
      if (writeResult.success) {
        const fixRecord = {
          filePath,
          errorDescription,
          originalSize: fileContent.size,
          newSize: fixedCode.length,
          timestamp: Date.now(),
          success: true
        }
        
        this.editHistory.push(fixRecord)
        console.log(`✅ Arquivo corrigido: ${filePath}`)
        
        return {
          success: true,
          message: `Arquivo corrigido: ${filePath}`,
          filePath,
          errorDescription,
          fixRecord
        }
      }
      
    } catch (error) {
      console.error(`❌ Erro ao corrigir arquivo ${filePath}:`, error)
      
      return {
        success: false,
        error: error.message,
        filePath
      }
    }
  }

  async addFeature(filePath, featureDescription) {
    console.log(`➕ Adicionando funcionalidade ao arquivo: ${filePath}`)
    
    try {
      const fileContent = await fileSystem.read(filePath)
      
      if (!fileContent.success) {
        throw new Error(`Não foi possível ler o arquivo: ${filePath}`)
      }
      
      // Criar backup
      if (this.backupEnabled) {
        await this.createBackup(filePath, fileContent.content)
      }
      
      const prompt = `
Adicione esta funcionalidade ao arquivo:

FUNCIONALIDADE: ${featureDescription}

CÓDIGO ATUAL:
\`\`\`
${fileContent.content}
\`\`\`

Integre a nova funcionalidade de forma coesa com o código existente.
`
      
      const enhancedCode = await askMultiAI(prompt)
      const writeResult = await fileSystem.write(filePath, enhancedCode)
      
      if (writeResult.success) {
        const featureRecord = {
          filePath,
          featureDescription,
          originalSize: fileContent.size,
          newSize: enhancedCode.length,
          timestamp: Date.now(),
          success: true
        }
        
        this.editHistory.push(featureRecord)
        console.log(`✅ Funcionalidade adicionada: ${filePath}`)
        
        return {
          success: true,
          message: `Funcionalidade adicionada: ${filePath}`,
          filePath,
          featureDescription,
          featureRecord
        }
      }
      
    } catch (error) {
      console.error(`❌ Erro ao adicionar funcionalidade ao arquivo ${filePath}:`, error)
      
      return {
        success: false,
        error: error.message,
        filePath
      }
    }
  }

  async createBackup(filePath, content) {
    const timestamp = Date.now()
    const backupPath = `${filePath}.backup.${timestamp}`
    
    const backupResult = await fileSystem.write(backupPath, content)
    
    if (backupResult.success) {
      console.log(`💾 Backup criado: ${backupPath}`)
    }
    
    return backupResult
  }

  generateImprovementPrompt(code, improvementType) {
    const prompts = {
      general: `
Melhore este código:

\`\`\`
${code}
\`\`\`

Foque em:
- Legibilidade
- Performance
- Boas práticas
- Tratamento de erros
- Comentários explicativos

Forneça apenas o código melhorado.
`,

      refactor_clean: `
Refatore este código para limpeza:

\`\`\`
${code}
\`\`\`

Foque em:
- Remover código duplicado
- Simplificar lógica complexa
- Melhorar nomes de variáveis
- Organizar estrutura
- Seguir convenções da linguagem

Forneça apenas o código refatorado.
`,

      optimize_performance: `
Otimize este código para performance:

\`\`\`
${code}
\`\`\`

Foque em:
- Reduzir complexidade algorítmica
- Otimizar uso de memória
- Melhorar tempo de execução
- Evitar operações desnecessárias
- Usar estruturas de dados eficientes

Forneça apenas o código otimizado.
`,

      refactor_security: `
Refatore este código para segurança:

\`\`\`
${code}
\`\`\`

Foque em:
- Validação de entrada
- Prevenção de injeção de código
- Tratamento seguro de dados
- Evitar vulnerabilidades comuns
- Implementar princípios de segurança

Forneça apenas o código seguro.
`
    }
    
    return prompts[improvementType] || prompts.general
  }

  getEditHistory(limit = 10) {
    return this.editHistory.slice(-limit)
  }

  getStats() {
    const successful = this.editHistory.filter(h => h.success).length
    const failed = this.editHistory.filter(h => !h.success).length
    
    const improvements = {}
    this.editHistory.forEach(edit => {
      if (edit.success) {
        const type = edit.improvementType || 'unknown'
        improvements[type] = (improvements[type] || 0) + 1
      }
    })
    
    return {
      totalEdits: this.editHistory.length,
      successful,
      failed,
      successRate: this.editHistory.length > 0 ? (successful / this.editHistory.length * 100).toFixed(1) + '%' : '0%',
      improvementTypes: improvements,
      backupEnabled: this.backupEnabled
    }
  }

  enableBackup() {
    this.backupEnabled = true
    console.log('💾 Backup de arquivos ativado')
  }

  disableBackup() {
    this.backupEnabled = false
    console.log('🚫 Backup de arquivos desativado')
  }

  clearHistory() {
    this.editHistory = []
    console.log('🧹 Histórico de edições limpo')
  }

  async restoreFromBackup(filePath, backupTimestamp) {
    const backupPath = `${filePath}.backup.${backupTimestamp}`
    
    console.log(`🔄 Restaurando backup: ${backupPath}`)
    
    try {
      const backupContent = await fileSystem.read(backupPath)
      
      if (backupContent.success) {
        const restoreResult = await fileSystem.write(filePath, backupContent.content)
        
        if (restoreResult.success) {
          console.log(`✅ Arquivo restaurado: ${filePath}`)
          return {
            success: true,
            message: `Arquivo restaurado de: ${backupPath}`,
            filePath
          }
        }
      }
      
    } catch (error) {
      console.error(`❌ Erro ao restaurar backup:`, error)
      return {
        success: false,
        error: error.message,
        backupPath
      }
    }
  }
}

export const selfEditor = new SelfEditor()
