// GROOT GITHUB INTEGRATION - Aprender com repositórios reais
import { Octokit } from '@octokit/rest'
import { grootAdvancedRAG } from './grootAdvancedRAG.js'
import fs from 'fs/promises'
import path from 'path'

export class GrootGitHub {
  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    })
    this.rag = grootAdvancedRAG
    this.supportedLanguages = ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.php', '.rb']
  }

  // 📥 BAIXAR REPOSITÓRIO
  async downloadRepository(repoUrl, localPath = './temp-repo') {
    try {
      const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/')
      
      console.log(`📥 Baixando repositório: ${owner}/${repo}`)
      
      // Obter informações do repositório
      const { data: repoInfo } = await this.octokit.repos.get({
        owner,
        repo
      })

      // Listar arquivos
      const { data: files } = await this.octokit.repos.getContent({
        owner,
        repo,
        path: ''
      })

      // Baixar arquivos suportados
      const codeFiles = await this.downloadCodeFiles(owner, repo, files, localPath)
      
      return {
        repoInfo,
        codeFiles,
        totalFiles: codeFiles.length
      }
    } catch (error) {
      console.error('❌ Erro ao baixar repositório:', error.message)
      return null
    }
  }

  // 📁 BAIXAR ARQUIVOS DE CÓDIGO
  async downloadCodeFiles(owner, repo, files, basePath) {
    const codeFiles = []
    
    for (const file of files) {
      if (file.type === 'dir') {
        // Recursivamente baixar subdiretórios
        const { data: subFiles } = await this.octokit.repos.getContent({
          owner,
          repo,
          path: file.path
        })
        
        const subCodeFiles = await this.downloadCodeFiles(owner, repo, subFiles, basePath)
        codeFiles.push(...subCodeFiles)
      } else if (this.isCodeFile(file.name)) {
        try {
          const { data: content } = await this.octokit.repos.getContent({
            owner,
            repo,
            path: file.path
          })
          
          const decodedContent = Buffer.from(content.content, 'base64').toString()
          
          codeFiles.push({
            path: file.path,
            name: file.name,
            content: decodedContent,
            language: this.getLanguage(file.name),
            size: file.size
          })
        } catch (error) {
          console.error(`❌ Erro ao baixar arquivo ${file.path}:`, error.message)
        }
      }
    }
    
    return codeFiles
  }

  // 🔍 VERIFICAR SE É ARQUIVO DE CÓDIGO
  isCodeFile(filename) {
    const ext = path.extname(filename).toLowerCase()
    return this.supportedLanguages.includes(ext)
  }

  // 🏷️ OBTER LINGUAGEM DO ARQUIVO
  getLanguage(filename) {
    const ext = path.extname(filename).toLowerCase()
    const languageMap = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby'
    }
    return languageMap[ext] || 'unknown'
  }

  // 🧠 PROCESSAR E APRENDER COM REPOSITÓRIO
  async learnFromRepository(repoUrl) {
    try {
      console.log(`🧠 GROOT aprendendo com: ${repoUrl}`)
      
      // Baixar repositório
      const repoData = await this.downloadRepository(repoUrl)
      if (!repoData) return null

      console.log(`📁 Processando ${repoData.totalFiles} arquivos de código`)

      // Processar cada arquivo
      for (const file of repoData.codeFiles) {
        await this.processCodeFile(file, repoUrl)
      }

      // Salvar metadados do repositório
      await this.saveRepositoryMetadata(repoUrl, repoData.repoInfo)

      return {
        repoUrl,
        totalFiles: repoData.totalFiles,
        languages: this.getLanguageStats(repoData.codeFiles),
        processedAt: new Date().toISOString()
      }
    } catch (error) {
      console.error('❌ Erro ao aprender com repositório:', error)
      return null
    }
  }

  // 🔍 PROCESSAR ARQUIVO DE CÓDIGO
  async processCodeFile(file, repoUrl) {
    try {
      // Extrair funções
      const functions = this.extractFunctions(file.content, file.language)
      
      // Extrair padrões
      const patterns = this.extractPatterns(file.content, file.language)
      
      // Extrair comentários importantes
      const comments = this.extractComments(file.content, file.language)
      
      // Gerar embedding e salvar
      await this.rag.addKnowledge(file.content, {
        source: 'github',
        category: 'code',
        language: file.language,
        repoUrl,
        filePath: file.path,
        functions,
        patterns,
        comments,
        fileSize: file.size
      })

      console.log(`📚 Arquivo processado: ${file.path} (${functions.length} funções)`)
    } catch (error) {
      console.error(`❌ Erro ao processar arquivo ${file.path}:`, error.message)
    }
  }

  // 🔧 EXTRAIR FUNÇÕES (SIMPLIFICADO)
  extractFunctions(content, language) {
    const functions = []
    
    switch (language) {
      case 'javascript':
      case 'typescript':
        // Regex para funções JavaScript/TypeScript
        const jsFunctionRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>)|(\w+)\s*:\s*(?:async\s+)?function|\basync\s+function\s+(\w+))/g
        let match
        while ((match = jsFunctionRegex.exec(content)) !== null) {
          const functionName = match[1] || match[2] || match[3] || match[4]
          if (functionName) {
            functions.push({
              name: functionName,
              line: content.substring(0, match.index).split('\n').length
            })
          }
        }
        break
        
      case 'python':
        // Regex para funções Python
        const pyFunctionRegex = /(?:def\s+(\w+)|async\s+def\s+(\w+))/g
        while ((match = pyFunctionRegex.exec(content)) !== null) {
          const functionName = match[1] || match[2]
          functions.push({
            name: functionName,
            line: content.substring(0, match.index).split('\n').length
          })
        }
        break
        
      // Adicionar outras linguagens conforme necessário
    }
    
    return functions
  }

  // 🎯 EXTRAIR PADRÕES
  extractPatterns(content, language) {
    const patterns = []
    
    // Padrões comuns
    if (content.includes('try') && content.includes('catch')) {
      patterns.push('error_handling')
    }
    
    if (content.includes('async') || content.includes('await')) {
      patterns.push('async_programming')
    }
    
    if (content.includes('class') && content.includes('extends')) {
      patterns.push('inheritance')
    }
    
    if (content.includes('import') || content.includes('require')) {
      patterns.push('module_import')
    }
    
    return patterns
  }

  // 💬 EXTRAIR COMENTÁRIOS IMPORTANTES
  extractComments(content, language) {
    const comments = []
    
    switch (language) {
      case 'javascript':
      case 'typescript':
        // Regex para comentários JavaScript
        const jsCommentRegex = /\/\*\*([\s\S]*?)\*\/|\/\/(.*)$/gm
        let match
        while ((match = jsCommentRegex.exec(content)) !== null) {
          const comment = (match[1] || match[2]).trim()
          if (comment.length > 10) { // Ignorar comentários muito curtos
            comments.push({
              text: comment,
              line: content.substring(0, match.index).split('\n').length
            })
          }
        }
        break
        
      case 'python':
        // Regex para comentários Python
        const pyCommentRegex = /"""([\s\S]*?)"""|'''([\s\S]*?)'''|#(.*)$/gm
        while ((match = pyCommentRegex.exec(content)) !== null) {
          const comment = (match[1] || match[2] || match[3]).trim()
          if (comment.length > 10) {
            comments.push({
              text: comment,
              line: content.substring(0, match.index).split('\n').length
            })
          }
        }
        break
    }
    
    return comments
  }

  // 📊 OBTER ESTATÍSTICAS DE LINGUAGEM
  getLanguageStats(codeFiles) {
    const stats = {}
    
    codeFiles.forEach(file => {
      stats[file.language] = (stats[file.language] || 0) + 1
    })
    
    return Object.entries(stats)
      .sort(([,a], [,b]) => b - a)
      .map(([language, count]) => ({ language, count }))
  }

  // 💾 SALVAR METADADOS DO REPOSITÓRIO
  async saveRepositoryMetadata(repoUrl, repoInfo) {
    try {
      await this.rag.addKnowledge(`Repositório: ${repoUrl}\nDescrição: ${repoInfo.description}\nLinguagem: ${repoInfo.language}\nStars: ${repoInfo.stargazers_count}`, {
        source: 'github',
        category: 'repository_metadata',
        language: repoInfo.language || 'unknown',
        repoUrl,
        repoInfo
      })
    } catch (error) {
      console.error('❌ Erro ao salvar metadados:', error)
    }
  }

  // 🔍 BUSCAR CONHECIMENTO DE CÓDIGO
  async searchCodeKnowledge(query, language = null) {
    try {
      const queryEmbedding = await this.rag.embeddings.generateEmbedding(query)
      
      const { data, error } = await this.rag.supabase
        .from('code_knowledge')
        .select('*')
        .eq('language', language)
        .order('embedding', { ascending: false })
        .limit(5)

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('❌ Erro ao buscar conhecimento de código:', error)
      return []
    }
  }
}

export const grootGitHub = new GrootGitHub()
