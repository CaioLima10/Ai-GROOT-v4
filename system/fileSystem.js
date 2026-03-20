import fs from 'fs/promises'
import fsSync from 'fs'

export class FileSystem {
  constructor() {
    this.operations = []
  }

  async write(path, content) {
    try {
      // Garantir que o diretório existe
      const dir = path.dirname(path)
      await this.ensureDirectory(dir)
      
      await fs.writeFile(path, content, 'utf8')
      
      const operation = {
        type: 'write',
        path,
        timestamp: Date.now(),
        size: content.length
      }
      
      this.operations.push(operation)
      console.log(`📝 Arquivo criado: ${path} (${content.length} bytes)`)
      
      return {
        success: true,
        message: `Arquivo criado: ${path}`,
        operation
      }
    } catch (error) {
      console.error(`❌ Erro ao criar arquivo ${path}:`, error)
      return {
        success: false,
        error: error.message,
        path
      }
    }
  }

  async read(path) {
    try {
      const content = await fs.readFile(path, 'utf8')
      console.log(`📖 Arquivo lido: ${path} (${content.length} bytes)`)
      return {
        success: true,
        content,
        size: content.length
      }
    } catch (error) {
      console.error(`❌ Erro ao ler arquivo ${path}:`, error)
      return {
        success: false,
        error: error.message,
        path
      }
    }
  }

  exists(path) {
    try {
      const exists = fsSync.existsSync(path)
      console.log(`🔍 Verificando ${path}: ${exists ? 'EXISTS' : 'NOT FOUND'}`)
      return exists
    } catch (error) {
      console.error(`❌ Erro ao verificar ${path}:`, error)
      return false
    }
  }

  async ensureDirectory(dirPath) {
    try {
      if (!this.exists(dirPath)) {
        await fs.mkdir(dirPath, { recursive: true })
        console.log(`📁 Diretório criado: ${dirPath}`)
      }
      return true
    } catch (error) {
      console.error(`❌ Erro ao criar diretório ${dirPath}:`, error)
      return false
    }
  }

  async append(path, content) {
    try {
      await fs.appendFile(path, content, 'utf8')
      console.log(`➕ Conteúdo adicionado ao arquivo: ${path}`)
      return {
        success: true,
        message: `Conteúdo adicionado: ${path}`
      }
    } catch (error) {
      console.error(`❌ Erro ao adicionar conteúdo ao arquivo ${path}:`, error)
      return {
        success: false,
        error: error.message,
        path
      }
    }
  }

  async delete(path) {
    try {
      await fs.unlink(path)
      console.log(`🗑️ Arquivo deletado: ${path}`)
      return {
        success: true,
        message: `Arquivo deletado: ${path}`
      }
    } catch (error) {
      console.error(`❌ Erro ao deletar arquivo ${path}:`, error)
      return {
        success: false,
        error: error.message,
        path
      }
    }
  }

  getOperations() {
    return this.operations
  }

  clearOperations() {
    this.operations = []
    console.log('🧹 Histórico de operações limpo')
  }

  async getStats() {
    const totalWrites = this.operations.filter(op => op.type === 'write').length
    const totalSize = this.operations
      .filter(op => op.type === 'write')
      .reduce((sum, op) => sum + (op.size || 0), 0)
    
    return {
      totalOperations: this.operations.length,
      totalWrites,
      totalSize,
      averageSize: totalWrites > 0 ? Math.round(totalSize / totalWrites) : 0
    }
  }
}

export const fileSystem = new FileSystem()
