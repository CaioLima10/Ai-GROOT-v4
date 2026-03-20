import { autoLearner } from './learning/autoLearner.js'
import { ragEngine } from './learning/ragEngine.js'
import { nlpProcessor } from './nlp/nlpProcessor.js'
import { codeAnalyzer } from './code/codeAnalyzer.js'

// Script de treinamento e melhoria contínua
export class AITrainer {
  constructor() {
    this.trainingData = []
    this.isTraining = false
  }
  
  async startTraining() {
    if (this.isTraining) {
      console.log('🧪 Training já em andamento...')
      return
    }
    
    console.log('🚀 Iniciando treinamento do Ai-GROOT...')
    this.isTraining = true
    
    try {
      // 1. Carregar dados de treinamento
      await this.loadTrainingData()
      
      // 2. Treinar NLP
      await this.trainNLP()
      
      // 3. Otimizar memória
      await this.optimizeMemory()
      
      // 4. Gerar insights
      const insights = await this.generateInsights()
      
      console.log('✅ Treinamento concluído!')
      console.log('📊 Insights:', insights)
      
    } catch (error) {
      console.error('❌ Erro no treinamento:', error)
    } finally {
      this.isTraining = false
    }
  }
  
  async loadTrainingData() {
    // Dados de exemplo para treinamento
    this.trainingData = [
      {
        question: 'Oi, como você está?',
        intent: { type: 'greeting', confidence: 0.9 },
        response: 'Oi! Estou ótimo e pronto para ajudar com desenvolvimento de software!',
        success: 1.0
      },
      {
        question: 'Tem erro nesse código',
        intent: { type: 'error_help', confidence: 0.8, hasCode: true },
        response: 'Vou analisar seu código para encontrar o problema.',
        success: 0.9
      },
      {
        question: 'Analisa essa função',
        intent: { type: 'code_help', confidence: 0.85, hasCode: true },
        response: 'Vou analisar a estrutura e complexidade da sua função.',
        success: 0.95
      },
      {
        question: 'O que é React?',
        intent: { type: 'general', confidence: 0.7 },
        response: 'React é uma biblioteca JavaScript para criar interfaces de usuário.',
        success: 0.8
      }
    ]
    
    console.log(`📚 ${this.trainingData.length} exemplos de treinamento carregados`)
  }
  
  async trainNLP() {
    console.log('🧠 Treinando processador NLP...')
    
    for (const data of this.trainingData) {
      // Treinar com cada exemplo
      await nlpProcessor.detectIntent(data.question)
      await autoLearner.learn(data.question, data.response, data.intent)
    }
    
    console.log('✅ NLP treinado com exemplos')
  }
  
  async optimizeMemory() {
    console.log('💾 Otimizando memória vetorial...')
    
    // Limpar memórias antigas
    await ragEngine.clearOldMemories(7) // 7 dias
    
    // Obter estatísticas
    const stats = await ragEngine.getMemoryStats()
    console.log('📊 Estatísticas da memória:', stats)
  }
  
  async generateInsights() {
    const learnerInsights = await autoLearner.generateInsights()
    const memoryStats = await ragEngine.getMemoryStats()
    
    return {
      learner: learnerInsights,
      memory: memoryStats,
      trainingData: this.trainingData.length,
      timestamp: new Date().toISOString()
    }
  }
  
  async evaluatePerformance() {
    // Avaliar performance atual do sistema
    const testQueries = [
      'Oi',
      'Tem erro no meu código',
      'Como funciona async/await?',
      'Analisa essa função',
      'Me ajuda com um bug'
    ]
    
    const results = []
    
    for (const query of testQueries) {
      const start = Date.now()
      
      try {
        const intent = await nlpProcessor.detectIntent(query)
        const context = await ragEngine.getContext(query, intent)
        
        results.push({
          query,
          intent: intent.type,
          confidence: intent.confidence,
          contextItems: context.length,
          responseTime: Date.now() - start,
          success: true
        })
      } catch (error) {
        results.push({
          query,
          error: error.message,
          responseTime: Date.now() - start,
          success: false
        })
      }
    }
    
    const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
    const successRate = results.filter(r => r.success).length / results.length
    
    return {
      results,
      avgResponseTime,
      successRate,
      timestamp: new Date().toISOString()
    }
  }
  
  async continuousLearning() {
    // Aprendizado contínuo em background
    console.log('🔄 Iniciando aprendizado contínuo...')
    
    setInterval(async () => {
      try {
        // Avaliar performance
        const perf = await this.evaluatePerformance()
        
        // Se performance baixa, retreinar
        if (perf.successRate < 0.8) {
          console.log('⚠️ Performance baixa, retreinando...')
          await this.startTraining()
        }
        
        // Otimizar memória periodicamente
        if (Math.random() < 0.1) { // 10% de chance
          await this.optimizeMemory()
        }
        
      } catch (error) {
        console.error('❌ Erro no aprendizado contínuo:', error)
      }
    }, 5 * 60 * 1000) // A cada 5 minutos
  }
}

// Iniciar treinamento se executado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const trainer = new AITrainer()
  
  console.log('🎯 Ai-GROOT Training System')
  console.log('================================')
  
  trainer.startTraining().then(() => {
    console.log('\n🚀 Sistema pronto para uso!')
    process.exit(0)
  }).catch(error => {
    console.error('❌ Falha no treinamento:', error)
    process.exit(1)
  })
}

export const aiTrainer = new AITrainer()
