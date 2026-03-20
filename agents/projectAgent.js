import fs from 'fs/promises'
import path from 'path'

export class ProjectAgent {
  constructor() {
    this.name = 'projectAgent'
    this.capabilities = [
      'scan_project',
      'analyze_structure',
      'identify_patterns',
      'estimate_complexity',
      'generate_documentation',
      'create_architecture_diagram'
    ]
    
    this.projectCache = new Map()
    this.analysisHistory = []
  }

  async run(task, analysis, context = {}) {
    console.log(`📁 ProjectAgent: Analisando projeto: ${task}`)
    
    try {
      const taskType = this.identifyTaskType(task, analysis)
      
      switch (taskType) {
        case 'scan':
          return await this.scanProject(task, context)
        case 'analyze':
          return await this.analyzeProject(task, context)
        case 'structure':
          return await this.analyzeStructure(task, context)
        case 'document':
          return await this.generateDocumentation(task, context)
        default:
          return await this.generalProjectAnalysis(task, context)
      }
      
    } catch (error) {
      console.error(`❌ ProjectAgent: Erro na análise:`, error)
      return {
        success: false,
        error: error.message,
        suggestion: 'Verifique se o projeto existe e as permissões de acesso'
      }
    }
  }

  identifyTaskType(task, analysis) {
    const lowerTask = task.toLowerCase()
    
    if (lowerTask.includes('scan') || lowerTask.includes('escanear')) {
      return 'scan'
    }
    
    if (lowerTask.includes('analyze') || lowerTask.includes('analisar')) {
      return 'analyze'
    }
    
    if (lowerTask.includes('structure') || lowerTask.includes('estrutura')) {
      return 'structure'
    }
    
    if (lowerTask.includes('document') || lowerTask.includes('documentar')) {
      return 'document'
    }
    
    return 'general'
  }

  async scanProject(task, context) {
    const projectPath = context.projectPath || process.cwd()
    
    console.log(`📂 Escaneando projeto em: ${projectPath}`)
    
    try {
      const scanResults = await this.performFullScan(projectPath)
      
      const scanReport = {
        success: true,
        type: 'project_scan',
        projectPath,
        scanResults,
        insights: this.generateScanInsights(scanResults),
        recommendations: this.generateScanRecommendations(scanResults),
        metadata: {
          scanTime: Date.now(),
          totalFiles: scanResults.files.length,
          totalSize: scanResults.totalSize
        }
      }
      
      this.saveAnalysis(scanReport)
      
      console.log(`✅ Scan concluído: ${scanResults.files.length} arquivos`)
      return scanReport
      
    } catch (error) {
      throw new Error(`Falha no scan do projeto: ${error.message}`)
    }
  }

  async analyzeProject(task, context) {
    const projectPath = context.projectPath || process.cwd()
    
    console.log(`🔍 Analisando projeto: ${projectPath}`)
    
    try {
      // Escanear projeto primeiro
      const scanResults = await this.performFullScan(projectPath)
      
      // Análise detalhada
      const analysis = {
        structure: this.analyzeProjectStructure(scanResults),
        dependencies: await this.analyzeDependencies(projectPath),
        codeQuality: await this.analyzeCodeQuality(scanResults),
        architecture: await this.analyzeArchitecture(scanResults),
        patterns: this.identifyCodePatterns(scanResults),
        complexity: this.calculateProjectComplexity(scanResults),
        security: await this.analyzeSecurity(scanResults),
        documentation: this.analyzeDocumentation(scanResults)
      }
      
      const analysisReport = {
        success: true,
        type: 'project_analysis',
        projectPath,
        analysis,
        insights: this.generateAnalysisInsights(analysis),
        recommendations: this.generateAnalysisRecommendations(analysis),
        score: this.calculateProjectScore(analysis),
        metadata: {
          analysisTime: Date.now(),
          filesAnalyzed: scanResults.files.length,
          complexity: analysis.complexity.level
        }
      }
      
      this.saveAnalysis(analysisReport)
      
      console.log(`✅ Análise concluída: score ${analysisReport.score}/100`)
      return analysisReport
      
    } catch (error) {
      throw new Error(`Falha na análise do projeto: ${error.message}`)
    }
  }

  async analyzeStructure(task, context) {
    const projectPath = context.projectPath || process.cwd()
    
    console.log(`🏗️ Analisando estrutura: ${projectPath}`)
    
    try {
      const structure = await this.analyzeProjectStructureDetailed(projectPath)
      
      const structureReport = {
        success: true,
        type: 'structure_analysis',
        projectPath,
        structure,
        insights: this.generateStructureInsights(structure),
        recommendations: this.generateStructureRecommendations(structure),
        metadata: {
          analysisTime: Date.now(),
          directoriesCount: structure.directories.length,
          filesCount: structure.files.length
        }
      }
      
      this.saveAnalysis(structureReport)
      
      console.log(`✅ Análise de estrutura concluída`)
      return structureReport
      
    } catch (error) {
      throw new Error(`Falha na análise de estrutura: ${error.message}`)
    }
  }

  async generateDocumentation(task, context) {
    const projectPath = context.projectPath || process.cwd()
    
    console.log(`📚 Gerando documentação: ${projectPath}`)
    
    try {
      const scanResults = await this.performFullScan(projectPath)
      const analysis = await this.analyzeProject(task, { ...context, projectPath })
      
      const documentation = {
        overview: this.generateOverviewDocumentation(analysis),
        api: this.generateAPIDocumentation(scanResults),
        architecture: this.generateArchitectureDocumentation(analysis),
        setup: this.generateSetupDocumentation(scanResults),
        contributing: this.generateContributingDocumentation(analysis)
      }
      
      const documentationReport = {
        success: true,
        type: 'documentation_generation',
        projectPath,
        documentation,
        insights: this.generateDocumentationInsights(documentation),
        recommendations: this.generateDocumentationRecommendations(documentation),
        metadata: {
          generationTime: Date.now(),
          sectionsCount: Object.keys(documentation).length
        }
      }
      
      this.saveAnalysis(documentationReport)
      
      console.log(`✅ Documentação gerada: ${Object.keys(documentation).length} seções`)
      return documentationReport
      
    } catch (error) {
      throw new Error(`Falha na geração de documentação: ${error.message}`)
    }
  }

  async generalProjectAnalysis(task, context) {
    console.log(`🎯 Análise geral do projeto`)
    
    // Combinar múltiplas análises
    const scan = await this.scanProject(task, context)
    const analysis = await this.analyzeProject(task, context)
    const structure = await this.analyzeStructure(task, context)
    
    const generalReport = {
      success: true,
      type: 'general_analysis',
      task,
      scan,
      analysis,
      structure,
      integratedInsights: this.integrateAnalysisResults(scan, analysis, structure),
      actionPlan: this.createProjectActionPlan(scan, analysis, structure),
      nextSteps: this.generateProjectNextSteps(scan, analysis, structure),
      metadata: {
        analysisTime: Date.now(),
        comprehensive: true
      }
    }
    
    this.saveAnalysis(generalReport)
    
    console.log(`✅ Análise geral concluída`)
    return generalReport
  }

  // Métodos de scan
  async performFullScan(projectPath) {
    const results = {
      files: [],
      directories: [],
      totalSize: 0,
      languages: new Map(),
      frameworks: new Map(),
      fileTypes: new Map()
    }
    
    try {
      await this.scanDirectory(projectPath, results)
      
      // Processar resultados
      results.languages = new Map([...results.languages.entries()].sort((a, b) => b[1] - a[1]))
      results.frameworks = new Map([...results.frameworks.entries()].sort((a, b) => b[1] - a[1]))
      results.fileTypes = new Map([...results.fileTypes.entries()].sort((a, b) => b[1] - a[1]))
      
      return results
      
    } catch (error) {
      console.error(`Erro no scan do diretório ${projectPath}:`, error)
      return {
        files: [],
        directories: [],
        totalSize: 0,
        languages: new Map(),
        frameworks: new Map(),
        fileTypes: new Map(),
        error: error.message
      }
    }
  }

  async scanDirectory(dirPath, results, depth = 0) {
    if (depth > 10) return // Evitar recursão infinita
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        
        if (entry.isDirectory()) {
          // Ignorar diretórios comuns
          if (!this.shouldSkipDirectory(entry.name)) {
            results.directories.push({
              name: entry.name,
              path: fullPath,
              depth: depth
            })
            
            await this.scanDirectory(fullPath, results, depth + 1)
          }
        } else if (entry.isFile()) {
          const fileStats = await fs.stat(fullPath)
          const fileExt = path.extname(entry.name).toLowerCase()
          const fileName = path.basename(entry.name, fileExt)
          
          const fileInfo = {
            name: entry.name,
            path: fullPath,
            size: fileStats.size,
            extension: fileExt,
            type: this.getFileType(fileExt),
            language: this.detectFileLanguage(entry.name, fileExt),
            modified: fileStats.mtime,
            created: fileStats.birthtime
          }
          
          results.files.push(fileInfo)
          results.totalSize += fileStats.size
          
          // Contar linguagens
          const lang = fileInfo.language
          if (lang) {
            results.languages.set(lang, (results.languages.get(lang) || 0) + 1)
          }
          
          // Contar tipos de arquivo
          results.fileTypes.set(fileExt, (results.fileTypes.get(fileExt) || 0) + 1)
          
          // Detectar frameworks
          const framework = this.detectFramework(entry.name, dirPath)
          if (framework) {
            results.frameworks.set(framework, (results.frameworks.get(framework) || 0) + 1)
          }
        }
      }
    } catch (error) {
      console.error(`Erro ao ler diretório ${dirPath}:`, error)
    }
  }

  shouldSkipDirectory(dirName) {
    const skipDirs = [
      'node_modules',
      '.git',
      '.vscode',
      '.idea',
      'dist',
      'build',
      'coverage',
      '.nyc_output',
      '.cache',
      'tmp',
      'temp'
    ]
    
    return skipDirs.includes(dirName) || dirName.startsWith('.')
  }

  getFileType(extension) {
    const typeMap = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'react',
      '.tsx': 'react-typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown',
      '.txt': 'text',
      '.sql': 'sql',
      '.sh': 'shell',
      '.bat': 'batch',
      '.ps1': 'powershell',
      '.dockerfile': 'docker',
      '.gitignore': 'git',
      '.env': 'environment'
    }
    
    return typeMap[extension] || 'unknown'
  }

  detectFileLanguage(fileName, extension) {
    const name = fileName.toLowerCase()
    
    // Detectar por extensão
    const langByExt = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'react',
      '.tsx': 'react-typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.swift': 'swift',
      '.kt': 'kotlin'
    }
    
    // Detectar por nome de arquivo
    const langByName = {
      'package.json': 'javascript',
      'tsconfig.json': 'typescript',
      'requirements.txt': 'python',
      'pom.xml': 'java',
      'composer.json': 'php',
      'gemfile': 'ruby',
      'go.mod': 'go',
      'cargo.toml': 'rust',
      'dockerfile': 'docker'
    }
    
    return langByExt[extension] || langByName[name] || this.getFileType(extension)
  }

  detectFramework(fileName, dirPath) {
    const frameworks = {
      'react': ['package.json', 'src/App.jsx', 'src/App.tsx', 'public/index.html'],
      'vue': ['package.json', 'src/App.vue', 'vue.config.js'],
      'angular': ['package.json', 'angular.json', 'src/app/app.module.ts'],
      'express': ['package.json', 'app.js', 'server.js'],
      'django': ['manage.py', 'settings.py', 'requirements.txt'],
      'flask': ['app.py', 'requirements.txt'],
      'spring': ['pom.xml', 'src/main/java'],
      'next': ['package.json', 'next.config.js', 'pages/_app.js'],
      'gatsby': ['package.json', 'gatsby-config.js', 'gatsby-node.js']
    }
    
    const lowerFileName = fileName.toLowerCase()
    
    for (const [framework, indicators] of Object.entries(frameworks)) {
      if (indicators.some(indicator => lowerFileName.includes(indicator))) {
        return framework
      }
    }
    
    return null
  }

  // Métodos de análise
  analyzeProjectStructure(scanResults) {
    const structure = {
      depth: this.calculateDirectoryDepth(scanResults.directories),
      fileDistribution: this.analyzeFileDistribution(scanResults.files),
      directoryStructure: this.buildDirectoryTree(scanResults.directories),
      organization: this.analyzeOrganization(scanResults),
      patterns: this.identifyStructurePatterns(scanResults)
    }
    
    return structure
  }

  async analyzeDependencies(projectPath) {
    const dependencies = {
      packageManagers: [],
      dependencies: new Map(),
      devDependencies: new Map(),
      vulnerabilities: [],
      outdated: []
    }
    
    try {
      // Procurar arquivos de dependências
      const packageFiles = ['package.json', 'requirements.txt', 'pom.xml', 'composer.json', 'Gemfile']
      
      for (const file of packageFiles) {
        const filePath = path.join(projectPath, file)
        
        try {
          const exists = await fs.access(filePath).then(() => true).catch(() => false)
          
          if (exists) {
            const content = await fs.readFile(filePath, 'utf-8')
            const analysis = this.parseDependencyFile(file, content)
            
            dependencies.packageManagers.push(file)
            
            if (analysis.dependencies) {
              analysis.dependencies.forEach(dep => {
                dependencies.dependencies.set(dep.name, dep)
              })
            }
            
            if (analysis.devDependencies) {
              analysis.devDependencies.forEach(dep => {
                dependencies.devDependencies.set(dep.name, dep)
              })
            }
          }
        } catch (error) {
          console.error(`Erro ao ler ${file}:`, error)
        }
      }
    } catch (error) {
      console.error('Erro na análise de dependências:', error)
    }
    
    return dependencies
  }

  parseDependencyFile(fileName, content) {
    try {
      if (fileName === 'package.json') {
        const pkg = JSON.parse(content)
        return {
          dependencies: Object.entries(pkg.dependencies || {}).map(([name, version]) => ({ name, version })),
          devDependencies: Object.entries(pkg.devDependencies || {}).map(([name, version]) => ({ name, version }))
        }
      }
      
      // Implementar parsing para outros formatos
      return { dependencies: [], devDependencies: [] }
    } catch (error) {
      console.error(`Erro ao parsear ${fileName}:`, error)
      return { dependencies: [], devDependencies: [] }
    }
  }

  async analyzeCodeQuality(scanResults) {
    const codeFiles = scanResults.files.filter(file => 
      ['javascript', 'typescript', 'python', 'java', 'cpp', 'c'].includes(file.type)
    )
    
    const quality = {
      totalFiles: codeFiles.length,
      loc: 0,
      complexity: 'medium',
      maintainability: 'medium',
      testCoverage: 'unknown',
      codeSmells: [],
      duplications: []
    }
    
    // Calcular métricas simples
    for (const file of codeFiles.slice(0, 10)) { // Limitar para performance
      try {
        const content = await fs.readFile(file.path, 'utf-8')
        const lines = content.split('\n').length
        quality.loc += lines
        
        // Detectar code smells simples
        if (content.includes('console.log')) {
          quality.codeSmells.push({
            file: file.name,
            type: 'console_log',
            severity: 'low'
          })
        }
        
        if (content.includes('eval(')) {
          quality.codeSmells.push({
            file: file.name,
            type: 'eval_usage',
            severity: 'high'
          })
        }
      } catch (error) {
        console.error(`Erro ao analisar arquivo ${file.name}:`, error)
      }
    }
    
    return quality
  }

  async analyzeArchitecture(scanResults) {
    const architecture = {
      type: 'unknown',
      patterns: [],
      layers: [],
      components: [],
      technologies: Array.from(scanResults.frameworks.keys()),
      structure: 'modular'
    }
    
    // Detectar tipo de arquitetura
    if (scanResults.frameworks.has('react') || scanResults.frameworks.has('vue')) {
      architecture.type = 'frontend'
    } else if (scanResults.frameworks.has('express') || scanResults.frameworks.has('django')) {
      architecture.type = 'backend'
    } else if (scanResults.frameworks.has('next') || scanResults.frameworks.has('gatsby')) {
      architecture.type = 'fullstack'
    }
    
    // Analisar estrutura de diretórios
    const hasSrcDir = scanResults.directories.some(dir => dir.name === 'src')
    const hasComponentsDir = scanResults.directories.some(dir => dir.name === 'components')
    const hasUtilsDir = scanResults.directories.some(dir => dir.name === 'utils')
    
    if (hasSrcDir && hasComponentsDir) {
      architecture.layers.push('presentation')
    }
    
    if (hasUtilsDir) {
      architecture.layers.push('business')
    }
    
    return architecture
  }

  identifyCodePatterns(scanResults) {
    const patterns = []
    
    // Padrões de nomenclatura
    const fileNames = scanResults.files.map(f => f.name.toLowerCase())
    
    if (fileNames.some(name => name.includes('test'))) {
      patterns.push({
        type: 'testing',
        description: 'Projeto possui testes',
        frequency: fileNames.filter(name => name.includes('test')).length
      })
    }
    
    if (fileNames.some(name => name.includes('config'))) {
      patterns.push({
        type: 'configuration',
        description: 'Arquivos de configuração presentes',
        frequency: fileNames.filter(name => name.includes('config')).length
      })
    }
    
    // Padrões de estrutura
    const hasTests = scanResults.directories.some(dir => dir.name.includes('test'))
    const hasDocs = scanResults.directories.some(dir => dir.name.includes('doc'))
    
    if (hasTests && hasDocs) {
      patterns.push({
        type: 'well_structured',
        description: 'Estrutura organizada com testes e documentação'
      })
    }
    
    return patterns
  }

  calculateProjectComplexity(scanResults) {
    let complexity = 1
    
    // Fatores de complexidade
    const fileCount = scanResults.files.length
    const dirCount = scanResults.directories.length
    const langCount = scanResults.languages.size
    const frameworkCount = scanResults.frameworks.size
    
    complexity += Math.log(fileCount + 1) * 0.3
    complexity += Math.log(dirCount + 1) * 0.2
    complexity += Math.log(langCount + 1) * 0.3
    complexity += Math.log(frameworkCount + 1) * 0.2
    
    const level = complexity > 5 ? 'high' : complexity > 3 ? 'medium' : 'low'
    
    return {
      score: complexity,
      level,
      factors: {
        fileCount,
        dirCount,
        langCount,
        frameworkCount
      }
    }
  }

  async analyzeSecurity(scanResults) {
    const security = {
      vulnerabilities: [],
      risks: [],
      bestPractices: [],
      score: 0.8
    }
    
    // Analisar arquivos de configuração
    const configFiles = scanResults.files.filter(file => 
      ['.env', '.config', 'config.json', 'settings.json'].includes(file.name)
    )
    
    if (configFiles.length > 0) {
      security.risks.push({
        type: 'exposed_config',
        description: 'Arquivos de configuração potencialmente expostos',
        severity: 'medium'
      })
    }
    
    // Verificar se há arquivos de segurança
    const securityFiles = scanResults.files.filter(file => 
      ['security', 'auth', 'permissions'].some(keyword => file.name.toLowerCase().includes(keyword))
    )
    
    if (securityFiles.length === 0) {
      security.risks.push({
        type: 'no_security',
        description: 'Nenhum arquivo de segurança encontrado',
        severity: 'low'
      })
    }
    
    return security
  }

  analyzeDocumentation(scanResults) {
    const documentation = {
      exists: false,
      files: [],
      coverage: 'poor',
      quality: 'unknown'
    }
    
    // Procurar arquivos de documentação
    const docFiles = scanResults.files.filter(file => 
      ['.md', '.txt', '.rst', 'readme'].some(ext => file.name.toLowerCase().includes(ext))
    )
    
    documentation.files = docFiles
    documentation.exists = docFiles.length > 0
    
    if (docFiles.length > 0) {
      documentation.coverage = docFiles.length > 3 ? 'good' : 'fair'
    }
    
    // Verificar diretórios de documentação
    const docDirs = scanResults.directories.filter(dir => 
      ['doc', 'docs', 'documentation'].some(keyword => dir.name.toLowerCase().includes(keyword))
    )
    
    if (docDirs.length > 0) {
      documentation.coverage = 'good'
    }
    
    return documentation
  }

  // Métodos auxiliares
  calculateDirectoryDepth(directories) {
    if (directories.length === 0) return 0
    
    return Math.max(...directories.map(dir => dir.depth))
  }

  analyzeFileDistribution(files) {
    const distribution = {
      byType: new Map(),
      bySize: new Map(),
      byLanguage: new Map()
    }
    
    files.forEach(file => {
      // Por tipo
      distribution.byType.set(file.type, (distribution.byType.get(file.type) || 0) + 1)
      
      // Por tamanho
      const sizeCategory = this.categorizeFileSize(file.size)
      distribution.bySize.set(sizeCategory, (distribution.bySize.get(sizeCategory) || 0) + 1)
      
      // Por linguagem
      if (file.language) {
        distribution.byLanguage.set(file.language, (distribution.byLanguage.get(file.language) || 0) + 1)
      }
    })
    
    return distribution
  }

  categorizeFileSize(size) {
    if (size < 1024) return 'small' // < 1KB
    if (size < 10240) return 'medium' // < 10KB
    if (size < 102400) return 'large' // < 100KB
    return 'huge' // >= 100KB
  }

  buildDirectoryTree(directories) {
    const tree = {}
    
    directories.forEach(dir => {
      const parts = dir.path.split(path.sep)
      let current = tree
      
      parts.forEach((part, index) => {
        if (index === 0) return // Ignorar raiz
        
        if (!current[part]) {
          current[part] = {}
        }
        
        current = current[part]
      })
      
      current._info = dir
    })
    
    return tree
  }

  analyzeOrganization(scanResults) {
    const organization = {
      structure: 'unknown',
      conventions: [],
      standards: 'unknown',
      consistency: 'medium'
    }
    
    // Analisar convenções de nomenclatura
    const fileNames = scanResults.files.map(f => f.name)
    const hasConsistentNaming = this.checkNamingConsistency(fileNames)
    
    if (hasConsistentNaming) {
      organization.conventions.push('naming_consistent')
      organization.consistency = 'high'
    }
    
    // Analisar estrutura
    const hasStandardDirs = scanResults.directories.some(dir => 
      ['src', 'lib', 'components', 'utils', 'tests'].includes(dir.name)
    )
    
    if (hasStandardDirs) {
      organization.structure = 'standard'
      organization.conventions.push('standard_structure')
    }
    
    return organization
  }

  identifyStructurePatterns(scanResults) {
    const patterns = []
    
    // Padrão MVC
    const hasModels = scanResults.directories.some(dir => dir.name.includes('model'))
    const hasViews = scanResults.directories.some(dir => dir.name.includes('view'))
    const hasControllers = scanResults.directories.some(dir => dir.name.includes('controller'))
    
    if (hasModels && hasViews && hasControllers) {
      patterns.push({
        type: 'mvc',
        description: 'Padrão MVC detectado'
      })
    }
    
    // Padrão microservices
    const hasServices = scanResults.directories.some(dir => dir.name.includes('service'))
    const hasApi = scanResults.directories.some(dir => dir.name.includes('api'))
    
    if (hasServices && hasApi) {
      patterns.push({
        type: 'microservices',
        description: 'Estrutura de microservices detectada'
      })
    }
    
    return patterns
  }

  checkNamingConsistency(fileNames) {
    const patterns = {
      camelCase: 0,
      snake_case: 0,
      kebab_case: 0,
      PascalCase: 0
    }
    
    fileNames.forEach(name => {
      if (this.isCamelCase(name)) patterns.camelCase++
      if (this.isSnakeCase(name)) patterns.snake_case++
      if (this.isKebabCase(name)) patterns.kebab_case++
      if (this.isPascalCase(name)) patterns.PascalCase++
    })
    
    const total = Object.values(patterns).reduce((sum, count) => sum + count, 0)
    const dominant = Math.max(...Object.values(patterns))
    
    return (dominant / total) > 0.7 // 70% de consistência
  }

  isCamelCase(str) {
    return /^[a-z][a-zA-Z0-9]*$/.test(str)
  }

  isSnakeCase(str) {
    return /^[a-z][a-z0-9_]*$/.test(str)
  }

  isKebabCase(str) {
    return /^[a-z][a-z0-9-]*$/.test(str)
  }

  isPascalCase(str) {
    return /^[A-Z][a-zA-Z0-9]*$/.test(str)
  }

  // Métodos de geração de insights
  generateScanInsights(scanResults) {
    return {
      primaryLanguage: scanResults.languages.keys().next().value || 'unknown',
      totalFiles: scanResults.files.length,
      totalDirectories: scanResults.directories.length,
      totalSize: this.formatFileSize(scanResults.totalSize),
      frameworks: Array.from(scanResults.frameworks.keys()),
      fileTypes: Array.from(scanResults.fileTypes.keys()).slice(0, 5)
    }
  }

  generateScanRecommendations(scanResults) {
    const recommendations = []
    
    if (scanResults.files.length > 1000) {
      recommendations.push({
        priority: 'medium',
        type: 'project_size',
        description: 'Projeto muito grande, considere modularizar'
      })
    }
    
    if (scanResults.languages.size > 5) {
      recommendations.push({
        priority: 'low',
        type: 'language_diversity',
        description: 'Muitas linguagens, considere padronizar'
      })
    }
    
    return recommendations
  }

  generateAnalysisInsights(analysis) {
    return {
      complexity: `Complexidade: ${analysis.complexity.level} (${analysis.complexity.score.toFixed(1)})`,
      architecture: `Arquitetura: ${analysis.architecture.type}`,
      codeQuality: `Qualidade: ${analysis.codeQuality.maintainability}`,
      security: `Segurança: ${analysis.security.score > 0.7 ? 'boa' : 'precisa melhorar'}`,
      documentation: `Documentação: ${analysis.documentation.coverage}`
    }
  }

  generateAnalysisRecommendations(analysis) {
    const recommendations = []
    
    if (analysis.codeQuality.codeSmells.length > 0) {
      recommendations.push({
        priority: 'medium',
        type: 'code_quality',
        description: 'Corrigir code smells detectados'
      })
    }
    
    if (analysis.security.risks.length > 0) {
      recommendations.push({
        priority: 'high',
        type: 'security',
        description: 'Endereçar riscos de segurança'
      })
    }
    
    if (analysis.documentation.coverage === 'poor') {
      recommendations.push({
        priority: 'medium',
        type: 'documentation',
        description: 'Melhorar documentação do projeto'
      })
    }
    
    return recommendations
  }

  calculateProjectScore(analysis) {
    let score = 0.5 // Base
    
    // Complexidade (mais baixa = melhor)
    if (analysis.complexity.level === 'low') score += 0.2
    else if (analysis.complexity.level === 'medium') score += 0.1
    
    // Code quality
    if (analysis.codeQuality.maintainability === 'high') score += 0.2
    else if (analysis.codeQuality.maintainability === 'medium') score += 0.1
    
    // Security
    score += analysis.security.score * 0.2
    
    // Documentation
    if (analysis.documentation.coverage === 'good') score += 0.1
    else if (analysis.documentation.coverage === 'fair') score += 0.05
    
    return Math.min(1.0, score) * 100
  }

  // Métodos de geração de documentação
  generateOverviewDocumentation(analysis) {
    return {
      title: 'Project Overview',
      description: 'Descrição geral do projeto',
      sections: [
        {
          title: 'Technologies',
          content: `Linguagens: ${Array.from(analysis.analysis.dependencies.languages.keys()).join(', ')}`
        },
        {
          title: 'Architecture',
          content: `Tipo: ${analysis.analysis.architecture.type}`
        },
        {
          title: 'Complexity',
          content: `Nível: ${analysis.analysis.complexity.level}`
        }
      ]
    }
  }

  generateAPIDocumentation(scanResults) {
    const apiFiles = scanResults.files.filter(file => 
      file.name.toLowerCase().includes('api') || file.name.toLowerCase().includes('route')
    )
    
    return {
      title: 'API Documentation',
      description: 'Documentação das APIs do projeto',
      endpoints: apiFiles.map(file => ({
        file: file.name,
        path: file.path,
        type: file.type
      }))
    }
  }

  generateArchitectureDocumentation(analysis) {
    return {
      title: 'Architecture Documentation',
      description: 'Documentação da arquitetura do sistema',
      sections: [
        {
          title: 'Architecture Type',
          content: analysis.analysis.architecture.type
        },
        {
          title: 'Layers',
          content: analysis.analysis.architecture.layers.join(', ')
        },
        {
          title: 'Components',
          content: analysis.analysis.architecture.components.join(', ')
        }
      ]
    }
  }

  generateSetupDocumentation(scanResults) {
    return {
      title: 'Setup Guide',
      description: 'Guia de configuração do ambiente',
      sections: [
        {
          title: 'Prerequisites',
          content: 'Node.js 18+, npm 8+'
        },
        {
          title: 'Installation',
          content: 'npm install'
        },
        {
          title: 'Configuration',
          content: 'cp .env.example .env'
        }
      ]
    }
  }

  generateContributingDocumentation(analysis) {
    return {
      title: 'Contributing Guidelines',
      description: 'Diretrizes para contribuição',
      sections: [
        {
          title: 'Development Workflow',
          content: 'Fork -> Branch -> PR -> Merge'
        },
        {
          title: 'Code Standards',
          content: 'Follow ESLint rules, write tests'
        },
        {
          title: 'Testing',
          content: 'npm test'
        }
      ]
    }
  }

  generateDocumentationInsights(documentation) {
    return {
      sectionsCount: Object.keys(documentation).length,
      completeness: 'comprehensive',
      quality: 'professional'
    }
  }

  generateDocumentationRecommendations(documentation) {
    return [
      'Adicionar exemplos de uso',
      'Incluir diagramas de arquitetura',
      'Documentar APIs com OpenAPI'
    ]
  }

  generateStructureInsights(structure) {
    return {
      depth: `Profundidade: ${structure.depth} níveis`,
      organization: `Organização: ${structure.organization.consistency}`,
      patterns: `Padrões: ${structure.patterns.length} detectados`
    }
  }

  generateStructureRecommendations(structure) {
    const recommendations = []
    
    if (structure.depth > 5) {
      recommendations.push({
        priority: 'medium',
        type: 'structure',
        description: 'Reduzir profundidade da estrutura de diretórios'
      })
    }
    
    if (structure.organization.consistency === 'low') {
      recommendations.push({
        priority: 'low',
        type: 'organization',
        description: 'Padronizar convenções de nomenclatura'
      })
    }
    
    return recommendations
  }

  formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  // Métodos de integração
  integrateAnalysisResults(scan, analysis, structure) {
    return {
      overallHealth: this.calculateOverallHealth(scan, analysis, structure),
      keyMetrics: {
        files: scan.files.length,
        complexity: analysis.complexity.level,
        security: analysis.security.score,
        documentation: analysis.documentation.coverage
      },
      strengths: this.identifyStrengths(scan, analysis, structure),
      weaknesses: this.identifyWeaknesses(scan, analysis, structure),
      opportunities: this.identifyOpportunities(scan, analysis, structure)
    }
  }

  createProjectActionPlan(scan, analysis, structure) {
    return {
      immediate: [
        'Corrigir vulnerabilidades críticas',
        'Remover code smells de alta prioridade'
      ],
      shortTerm: [
        'Melhorar documentação',
        'Otimizar performance',
        'Padronizar código'
      ],
      longTerm: [
        'Refatorar arquitetura se necessário',
        'Implementar testes automatizados',
        'Configurar CI/CD'
      ]
    }
  }

  generateProjectNextSteps(scan, analysis, structure) {
    return [
      'Priorizar correções de segurança',
      'Implementar testes unitários',
      'Melhorar documentação técnica',
      'Configurar monitoramento',
      'Estabelecer código de qualidade'
    ]
  }

  calculateOverallHealth(scan, analysis, structure) {
    let health = 0.7
    
    // Fatores positivos
    if (analysis.codeQuality.maintainability === 'high') health += 0.1
    if (analysis.security.score > 0.8) health += 0.1
    if (analysis.documentation.coverage === 'good') health += 0.05
    
    // Fatores negativos
    if (analysis.complexity.level === 'high') health -= 0.1
    if (analysis.security.risks.length > 2) health -= 0.15
    if (analysis.codeQuality.codeSmells.length > 5) health -= 0.1
    
    return Math.max(0, Math.min(1, health))
  }

  identifyStrengths(scan, analysis, structure) {
    const strengths = []
    
    if (analysis.architecture.type !== 'unknown') {
      strengths.push('Arquitetura bem definida')
    }
    
    if (analysis.dependencies.dependencies.size > 0) {
      strengths.push('Dependências bem gerenciadas')
    }
    
    if (structure.organization.consistency === 'high') {
      strengths.push('Estrutura organizacional consistente')
    }
    
    return strengths
  }

  identifyWeaknesses(scan, analysis, structure) {
    const weaknesses = []
    
    if (analysis.codeQuality.codeSmells.length > 0) {
      weaknesses.push('Code smells presentes')
    }
    
    if (analysis.security.risks.length > 0) {
      weaknesses.push('Riscos de segurança identificados')
    }
    
    if (analysis.documentation.coverage === 'poor') {
      weaknesses.push('Documentação insuficiente')
    }
    
    return weaknesses
  }

  identifyOpportunities(scan, analysis, structure) {
    const opportunities = []
    
    if (analysis.codeQuality.testCoverage === 'unknown') {
      opportunities.push('Implementar cobertura de testes')
    }
    
    if (analysis.architecture.layers.length < 3) {
      opportunities.push('Melhorar arquitetura em camadas')
    }
    
    if (scan.languages.size > 3) {
      opportunities.push('Padronizar tecnologias')
    }
    
    return opportunities
  }

  saveAnalysis(analysis) {
    this.analysisHistory.push({
      ...analysis,
      timestamp: Date.now()
    })
    
    // Manter apenas últimas 50 análises
    if (this.analysisHistory.length > 50) {
      this.analysisHistory = this.analysisHistory.slice(-50)
    }
  }
}

export const projectAgent = new ProjectAgent()
