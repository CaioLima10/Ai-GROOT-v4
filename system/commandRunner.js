import { execSync } from 'child_process'

export class CommandRunner {
  constructor() {
    this.history = []
    this.allowedCommands = [
      'npm', 'node', 'git', 'python', 'pip', 'docker', 'curl', 'wget',
      'ls', 'dir', 'cd', 'mkdir', 'rm', 'cp', 'mv', 'cat', 'echo',
      'npx', 'yarn', 'pnpm', 'npm run', 'npm test', 'npm start'
    ]
  }

  async run(command, options = {}) {
    const startTime = Date.now()
    
    try {
      // Validar se comando é permitido (segurança)
      if (!this.isCommandAllowed(command)) {
        throw new Error(`Comando não permitido: ${command}`)
      }
      
      console.log(`💻 Executando: ${command}`)
      
      // Executar comando
      const output = execSync(command, {
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
        timeout: options.timeout || 30000, // 30 segundos
        ...options
      })
      
      const duration = Date.now() - startTime
      
      const result = {
        success: true,
        command,
        output: output || 'Comando executado com sucesso',
        duration,
        timestamp: Date.now()
      }
      
      this.history.push(result)
      console.log(`✅ Comando concluído em ${duration}ms`)
      
      return result
      
    } catch (error) {
      const duration = Date.now() - startTime
      
      const errorResult = {
        success: false,
        command,
        error: error.message,
        output: error.stdout || '',
        duration,
        timestamp: Date.now()
      }
      
      this.history.push(errorResult)
      console.error(`❌ Erro no comando (${duration}ms):`, error.message)
      
      return errorResult
    }
  }

  async runMultiple(commands, options = {}) {
    console.log(`🔄 Executando ${commands.length} comandos em sequência`)
    
    const results = []
    
    for (const command of commands) {
      const result = await this.run(command, options)
      results.push(result)
      
      // Parar se algum comando falhar
      if (!result.success && !options.continueOnError) {
        console.log(`⏹️ Parando execução devido a erro no comando: ${command}`)
        break
      }
    }
    
    return {
      success: results.every(r => r.success),
      results,
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0)
    }
  }

  async install(packageName, manager = 'npm') {
    console.log(`📦 Instalando pacote: ${packageName}`)
    
    const installCommands = {
      npm: `npm install ${packageName}`,
      yarn: `yarn add ${packageName}`,
      pnpm: `pnpm add ${packageName}`,
      pip: `pip install ${packageName}`,
      pip3: `pip3 install ${packageName}`
    }
    
    const command = installCommands[manager] || installCommands.npm
    return await this.run(command, { timeout: 120000 }) // 2 minutos para instalação
  }

  async runScript(scriptName, args = []) {
    console.log(`🚀 Executando script: ${scriptName}`)
    
    const command = `npm run ${scriptName} ${args.join(' ')}`
    return await this.run(command, { timeout: 60000 }) // 1 minuto para scripts
  }

  async git(action, params = []) {
    console.log(`🔧 Git: ${action}`)
    
    const command = `git ${action} ${params.join(' ')}`
    return await this.run(command)
  }

  async clone(repo, destination = '.') {
    console.log(`📥 Clonando repositório: ${repo}`)
    
    const command = `git clone ${repo} ${destination}`
    return await this.run(command, { timeout: 180000 }) // 3 minutos para clone
  }

  isCommandAllowed(command) {
    // Verificar se o comando começa com algum comando permitido
    const commandStart = command.split(' ')[0]
    return this.allowedCommands.some(allowed => command.startsWith(allowed))
  }

  getHistory(limit = 10) {
    return this.history.slice(-limit)
  }

  clearHistory() {
    this.history = []
    console.log('🧹 Histórico de comandos limpo')
  }

  getStats() {
    const successful = this.history.filter(h => h.success).length
    const failed = this.history.filter(h => !h.success).length
    const avgDuration = this.history.length > 0 
      ? this.history.reduce((sum, h) => sum + h.duration, 0) / this.history.length 
      : 0
    
    return {
      totalCommands: this.history.length,
      successful,
      failed,
      successRate: this.history.length > 0 ? (successful / this.history.length * 100).toFixed(1) + '%' : '0%',
      averageDuration: Math.round(avgDuration)
    }
  }

  // Métodos utilitários específicos para desenvolvimento
  async installDependencies() {
    console.log('📦 Instalando dependências do projeto...')
    
    // Tentar diferentes gerenciadores de pacotes
    const managers = ['npm', 'yarn', 'pnpm']
    
    for (const manager of managers) {
      try {
        // Verificar se o gerenciador existe
        const checkResult = await this.run(`${manager} --version`, { silent: true })
        
        if (checkResult.success) {
          console.log(`📋 Usando ${manager} para instalar dependências`)
          return await this.run(`${manager} install`, { timeout: 300000 }) // 5 minutos
        }
      } catch (error) {
        console.log(`⚠️ ${manager} não encontrado, tentando próximo...`)
      }
    }
    
    throw new Error('Nenhum gerenciador de pacotes encontrado (npm, yarn, pnpm)')
  }

  async startDevelopmentServer() {
    console.log('🚀 Iniciando servidor de desenvolvimento...')
    
    const startCommands = [
      'npm start',
      'npm run dev',
      'npm run develop',
      'yarn start',
      'yarn dev',
      'pnpm start',
      'pnpm dev'
    ]
    
    for (const command of startCommands) {
      try {
        // Verificar se o script existe
        const packageJson = await this.run('cat package.json', { silent: true })
        
        if (packageJson.success && packageJson.output.includes(command.split(' ')[1])) {
          console.log(`🎯 Executando: ${command}`)
          return await this.run(command, { timeout: 10000 }) // 10 segundos, não vai esperar
        }
      } catch (error) {
        continue
      }
    }
    
    throw new Error('Nenhum script de start encontrado')
  }

  async runTests() {
    console.log('🧪 Executando testes...')
    
    const testCommands = [
      'npm test',
      'npm run test',
      'yarn test',
      'pnpm test'
    ]
    
    for (const command of testCommands) {
      try {
        return await this.run(command, { timeout: 60000 })
      } catch (error) {
        continue
      }
    }
    
    throw new Error('Nenhum script de teste encontrado')
  }
}

export const commandRunner = new CommandRunner()
