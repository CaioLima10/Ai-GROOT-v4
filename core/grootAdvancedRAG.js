// GROOT RAG AVANÇADO - Vector Search + Embeddings Gratuitos
import { grootFreeEmbeddings } from './grootFreeEmbeddings.js'
import { grootMemoryConnector } from './grootMemoryConnector.js'

export class GrootAdvancedRAG {
  constructor() {
    this.supabase = grootMemoryConnector.supabase
    this.embeddings = grootFreeEmbeddings
    this.enabled = !!this.supabase

    if (!this.enabled) {
      console.warn('⚠️ RAG avançado desativado: Supabase não configurado.')
    }
  }

  // 🔍 BUSCA SEMÂNTICA REAL
  async searchKnowledge(query, language = null, limit = 5) {
    if (!this.enabled) {
      return {
        knowledge: [],
        bugs: [],
        queryEmbedding: null,
        totalFound: 0
      }
    }
    try {
      // Gerar embedding da query
      const queryEmbedding = await this.embeddings.generateEmbedding(query)

      // Buscar conhecimento relevante
      const { data: knowledge, error: knowledgeError } = await this.supabase
        .rpc('search_knowledge', {
          query_embedding: queryEmbedding,
          match_threshold: 0.3,
          match_count: limit
        })

      if (knowledgeError) throw knowledgeError

      // Buscar bugs relacionados
      const { data: bugs, error: bugsError } = await this.supabase
        .rpc('search_bugs', {
          query_embedding: queryEmbedding,
          language_param: language,
          match_threshold: 0.3,
          match_count: 3
        })

      if (bugsError) throw bugsError

      return {
        knowledge: knowledge || [],
        bugs: bugs || [],
        queryEmbedding,
        totalFound: (knowledge?.length || 0) + (bugs?.length || 0)
      }
    } catch (error) {
      console.error('❌ Erro na busca semântica:', error)
      return {
        knowledge: [],
        bugs: [],
        queryEmbedding: null,
        totalFound: 0
      }
    }
  }

  // 📚 ADICIONAR CONHECIMENTO COM EMBEDDING
  async addKnowledge(content, metadata = {}) {
    if (!this.enabled) {
      return null
    }
    try {
      const embedding = await this.embeddings.generateEmbedding(content)

      const payload = {
        content,
        embedding,
        source: metadata.source || 'manual',
        category: metadata.category || 'general',
        language: metadata.language || 'pt',
        metadata: {
          ...metadata,
          created_at: new Date().toISOString()
        },
        version: metadata.version || 1,
        is_active: metadata.is_active ?? true
      }

      let { data, error } = await this.supabase
        .from('knowledge_embeddings')
        .insert(payload)
        .select()

      if (error && error.message?.includes('column')) {
        const fallback = { ...payload }
        delete fallback.version
        delete fallback.is_active
        const retry = await this.supabase
          .from('knowledge_embeddings')
          .insert(fallback)
          .select()
        data = retry.data
        error = retry.error
      }

      if (error) throw error

      console.log('📚 Conhecimento adicionado com embedding real')
      return data[0]
    } catch (error) {
      console.error('❌ Erro ao adicionar conhecimento:', error)
      return null
    }
  }

  async deprecateKnowledge(knowledgeId) {
    if (!this.enabled) {
      return null
    }
    try {
      const { data, error } = await this.supabase
        .from('knowledge_embeddings')
        .update({ is_active: false })
        .eq('id', knowledgeId)
        .select()

      if (error && error.message?.includes('column')) {
        return null
      }

      if (error) throw error
      return data?.[0] || null
    } catch (error) {
      console.error('❌ Erro ao desativar conhecimento:', error)
      return null
    }
  }

  async saveKnowledgeVersion(knowledgeId, content, metadata = {}) {
    if (!this.enabled) {
      return null
    }
    try {
      const { data, error } = await this.supabase
        .from('knowledge_versions')
        .insert({
          knowledge_id: knowledgeId,
          content,
          metadata,
          version: metadata.version || 1,
          created_at: new Date().toISOString()
        })
        .select()

      if (error) throw error
      return data?.[0] || null
    } catch (error) {
      console.error('❌ Erro ao salvar versão:', error)
      return null
    }
  }

  async rollbackKnowledge(knowledgeId, versionContent) {
    if (!this.enabled) {
      return null
    }
    try {
      const embedding = await this.embeddings.generateEmbedding(versionContent)
      const { data, error } = await this.supabase
        .from('knowledge_embeddings')
        .update({
          content: versionContent,
          embedding,
          is_active: true
        })
        .eq('id', knowledgeId)
        .select()

      if (error && error.message?.includes('column')) {
        const fallback = await this.supabase
          .from('knowledge_embeddings')
          .update({
            content: versionContent,
            embedding
          })
          .eq('id', knowledgeId)
          .select()
        return fallback.data?.[0] || null
      }

      if (error) throw error
      return data?.[0] || null
    } catch (error) {
      console.error('❌ Erro ao fazer rollback:', error)
      return null
    }
  }

  // 🐛 ADICIONAR BUGS E SOLUÇÕES
  async addBugSolution(errorMessage, solution, metadata = {}) {
    if (!this.enabled) {
      return null
    }
    try {
      const content = `Error: ${errorMessage}\nSolution: ${solution}`
      const embedding = await this.embeddings.generateEmbedding(content)

      const { data, error } = await this.supabase
        .from('bugs_knowledge')
        .insert({
          error_message: errorMessage,
          stack_trace: metadata.stackTrace || '',
          solution,
          language: metadata.language || 'javascript',
          framework: metadata.framework || '',
          embedding,
          confidence: metadata.confidence || 0.8,
          metadata: {
            ...metadata,
            created_at: new Date().toISOString()
          }
        })
        .select()

      if (error) throw error

      console.log('🐛 Bug e solução adicionados')
      return data[0]
    } catch (error) {
      console.error('❌ Erro ao adicionar bug:', error)
      return null
    }
  }

  // 🎯 ENRIQUECER PERGUNTA COM CONTEXTO AVANÇADO
  async enrichQueryAdvanced(query, language = null) {
    const searchResults = await this.searchKnowledge(query, language)

    if (searchResults.totalFound === 0) {
      return {
        query,
        context: '',
        knowledge: [],
        bugs: [],
        enriched: false
      }
    }

    // Montar contexto enriquecido
    const knowledgeContext = searchResults.knowledge
      .map(k => `📚 ${k.category}: ${k.content} (Fonte: ${k.source})`)
      .join('\n\n')

    const bugsContext = searchResults.bugs
      .map(b => `🐛 ${b.language}: ${b.error_message}\n💡 Solução: ${b.solution}`)
      .join('\n\n')

    const fullContext = [
      knowledgeContext,
      bugsContext
    ].filter(Boolean).join('\n\n')

    return {
      query,
      context: fullContext,
      knowledge: searchResults.knowledge,
      bugs: searchResults.bugs,
      enriched: true,
      totalFound: searchResults.totalFound
    }
  }

  // 🧠 APRENDER COM INTERAÇÃO (AVANÇADO)
  async learnFromInteractionAdvanced(userMessage, aiResponse, metadata = {}) {
    if (!this.enabled) return
    // Detectar tipo de conteúdo
    const contentType = this.detectContentType(userMessage, aiResponse)

    switch (contentType) {
      case 'bug_solution':
        await this.extractAndSaveBug(userMessage, aiResponse, metadata)
        break
      case 'code_knowledge':
        await this.extractAndSaveCode(userMessage, aiResponse, metadata)
        break
      case 'general_knowledge':
        await this.addKnowledge(aiResponse, {
          source: 'interaction',
          category: 'learned',
          language: metadata.language || 'pt',
          userMessage
        })
        break
    }
  }

  // 🔍 DETECTAR TIPO DE CONTEÚDO
  detectContentType(userMessage, aiResponse) {
    const message = userMessage.toLowerCase()

    if (message.includes('erro') || message.includes('bug') || message.includes('problema')) {
      return 'bug_solution'
    }

    if (message.includes('código') || message.includes('função') || message.includes('implementar')) {
      return 'code_knowledge'
    }

    return 'general_knowledge'
  }

  // 🐛 EXTRAIR E SALVAR BUG
  async extractAndSaveBug(userMessage, aiResponse, metadata) {
    // Simples extração - pode ser melhorado com regex mais avançado
    const errorMatch = userMessage.match(/(erro|bug|problema)[\s:]+(.+)/i)
    const solutionMatch = aiResponse.match(/(solução|fix|correção)[\s:]+(.+)/i)

    if (errorMatch && solutionMatch) {
      await this.addBugSolution(
        errorMatch[2].trim(),
        solutionMatch[2].trim(),
        {
          language: metadata.language || 'javascript',
          stackTrace: '',
          confidence: 0.7
        }
      )
    }
  }

  // 💻 EXTRAIR E SALVAR CÓDIGO
  async extractAndSaveCode(userMessage, aiResponse, metadata) {
    // Extrair blocos de código da resposta
    const codeBlocks = aiResponse.match(/```[\s\S]*?```/g) || []

    for (const block of codeBlocks) {
      const code = block.replace(/```[\w]*\n/, '').replace(/```$/, '')
      await this.addKnowledge(code, {
        source: 'interaction',
        category: 'code',
        language: metadata.language || 'javascript',
        userMessage
      })
    }
  }

  // 📊 OBTER ESTATÍSTICAS AVANÇADAS
  async getAdvancedStats() {
    if (!this.enabled) {
      return {
        totalKnowledge: 0,
        totalBugs: 0,
        lastUpdated: new Date().toISOString()
      }
    }
    try {
      const [knowledgeCount, bugsCount] = await Promise.all([
        this.supabase.from('knowledge_embeddings').select('count', { count: 'exact' }),
        this.supabase.from('bugs_knowledge').select('count', { count: 'exact' })
      ])

      return {
        totalKnowledge: knowledgeCount.count || 0,
        totalBugs: bugsCount.count || 0,
        lastUpdated: new Date().toISOString()
      }
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas:', error)
      return {
        totalKnowledge: 0,
        totalBugs: 0,
        lastUpdated: new Date().toISOString()
      }
    }
  }
}

export const grootAdvancedRAG = new GrootAdvancedRAG()
