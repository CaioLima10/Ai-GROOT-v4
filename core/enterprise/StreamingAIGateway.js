// Gateway para streaming de respostas (ChatGPT-style)
import { aiProviders } from '../aiProviders.js'

export class StreamingAIGateway {
  constructor() {
    this.activeStreams = new Map()
  }

  async askStreaming(question, onChunk, onComplete, onError) {
    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    console.log(`🔄 Iniciando streaming ${streamId}`)
    
    try {
      // Para streaming, vamos simular com chunks do Groq
      const fullResponse = await aiProviders.askMultiAI(question)
      
      // Simular streaming dividindo a resposta em chunks
      const words = fullResponse.split(' ')
      let currentText = ''
      
      for (let i = 0; i < words.length; i++) {
        const word = words[i] + (i < words.length - 1 ? ' ' : '')
        currentText += word
        
        // Enviar chunk
        onChunk({
          id: streamId,
          chunk: word,
          fullText: currentText,
          isComplete: i === words.length - 1
        })
        
        // Pequeno delay para simular streaming real
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      
      onComplete({
        id: streamId,
        fullText: currentText,
        provider: 'Groq',
        tokens: words.length,
        duration: Date.now() - parseInt(streamId.split('_')[1])
      })
      
    } catch (error) {
      console.error(`❌ Erro no streaming ${streamId}:`, error)
      onError({
        id: streamId,
        error: error.message
      })
    }
  }

  // Streaming real com APIs que suportam (OpenAI, Anthropic, etc)
  async askRealStreaming(question, onChunk, onComplete, onError) {
    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    try {
      // Implementação futura para APIs com streaming real
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: 'Você é Ai-GROOT...' },
            { role: 'user', content: question }
          ],
          stream: true // Habilitar streaming
        })
      })
      
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            
            if (data === '[DONE]') {
              onComplete({ id: streamId, fullText })
              return
            }
            
            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content || ''
              
              if (content) {
                fullText += content
                onChunk({
                  id: streamId,
                  chunk: content,
                  fullText
                })
              }
            } catch (e) {
              // Ignorar erros de parsing
            }
          }
        }
      }
      
    } catch (error) {
      onError({ id: streamId, error: error.message })
    }
  }
}

export const streamingGateway = new StreamingAIGateway()
