// Frontend com streaming (ChatGPT-style)
class StreamingChat {
  constructor() {
    this.chatContainer = document.getElementById('chat-container')
    this.input = document.getElementById('question-input')
    this.sendBtn = document.getElementById('send-btn')
    this.typingIndicator = null
    
    this.initEventListeners()
  }

  initEventListeners() {
    if (this.sendBtn) {
      this.sendBtn.addEventListener('click', () => this.sendQuestion())
    }

    if (this.input) {
      this.input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          this.sendQuestion()
        }
      })
    }
  }

  async sendQuestion() {
    const question = this.input?.value?.trim()
    if (!question) return

    // Limpar input
    this.input.value = ''
    
    // Adicionar pergunta do usuário
    this.addMessage('user', question)
    
    // Mostrar indicador de digitação
    this.showTypingIndicator()
    
    // Criar container para resposta da IA
    const aiMessageContainer = this.addMessage('ai', '', true)
    
    try {
      // Fazer requisição com streaming
      const response = await fetch('/ask/streaming', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ question })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      // Processar streaming
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
              this.hideTypingIndicator()
              return
            }
            
            try {
              const parsed = JSON.parse(data)
              
              if (parsed.chunk) {
                fullText += parsed.chunk
                aiMessageContainer.textContent = fullText
                this.scrollToBottom()
              }
              
              if (parsed.isComplete) {
                this.hideTypingIndicator()
                this.addMetadata(aiMessageContainer, parsed)
              }
            } catch (e) {
              // Ignorar erros de parsing
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Erro:', error)
      this.hideTypingIndicator()
      aiMessageContainer.textContent = `❌ Erro: ${error.message}`
      aiMessageContainer.classList.add('error')
    }
  }

  addMessage(role, content, isStreaming = false) {
    const messageDiv = document.createElement('div')
    messageDiv.className = `message ${role}`
    
    if (role === 'ai') {
      messageDiv.innerHTML = `
        <div class="ai-avatar">🤖</div>
        <div class="message-content">
          <div class="ai-name">Ai-GROOT Enterprise</div>
          <div class="ai-text"${isStreaming ? ' data-streaming="true"' : ''}>${content}</div>
          ${isStreaming ? '<div class="streaming-cursor">|</div>' : ''}
        </div>
      `
    } else {
      messageDiv.innerHTML = `
        <div class="message-content">
          <div class="user-text">${content}</div>
        </div>
        <div class="user-avatar">👤</div>
      `
    }
    
    this.chatContainer.appendChild(messageDiv)
    this.scrollToBottom()
    
    return role === 'ai' ? messageDiv.querySelector('.ai-text') : null
  }

  addMetadata(container, metadata) {
    const metadataDiv = document.createElement('div')
    metadataDiv.className = 'message-metadata'
    metadataDiv.innerHTML = `
      <span class="provider">🔹 ${metadata.provider || 'Groq'}</span>
      <span class="tokens">🔹 ${metadata.tokens || 0} tokens</span>
      <span class="time">🔹 ${metadata.duration || 0}ms</span>
    `
    container.appendChild(metadataDiv)
  }

  showTypingIndicator() {
    if (this.typingIndicator) return
    
    this.typingIndicator = document.createElement('div')
    this.typingIndicator.className = 'typing-indicator'
    this.typingIndicator.innerHTML = `
      <div class="ai-avatar">🤖</div>
      <div class="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `
    
    this.chatContainer.appendChild(this.typingIndicator)
    this.scrollToBottom()
  }

  hideTypingIndicator() {
    if (this.typingIndicator) {
      this.typingIndicator.remove()
      this.typingIndicator = null
    }
  }

  scrollToBottom() {
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight
  }
}

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  new StreamingChat()
})
