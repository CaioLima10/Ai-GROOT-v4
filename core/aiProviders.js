import axios from "axios"
import dotenv from "dotenv"

dotenv.config()

// Sistema de múltiplos providers com fallback automático - CORRIGIDO
export class AIProviders {
  constructor() {
    const openRouterKey = process.env.OPENROUTER_KEY || process.env.OPENROUTER_API_KEY
    // SISTEMA MULTIPROVIDER CORRIGIDO
    this.providers = [
      {
        name: 'Groq',
        priority: 1, // Principal - funciona!
        enabled: !!process.env.GROQ_API_KEY,
        apiCall: this.askGroq.bind(this)
      },
      {
        name: 'OpenRouter',
        priority: 2, // Backup
        enabled: !!openRouterKey && openRouterKey.length > 50,
        apiCall: this.askOpenRouter.bind(this)
      },
      {
        name: 'Google Gemini',
        priority: 3, // Terciário
        enabled: !!process.env.GEMINI_API_KEY,
        apiCall: this.askGeminiCorrect.bind(this) // Método corrigido
      }
      // REMOVIDO: HuggingFace (410 Gone)
    ].filter(p => p.enabled).sort((a, b) => a.priority - b.priority)

    console.log(`🤖 Ai-GROOT Enterprise - ${this.providers.length} providers ativos:`)
    this.providers.forEach(p => console.log(`  ✅ ${p.name} (prioridade ${p.priority})`))
  }

  async askMultiAI(question, maxRetries = 1) {
    const startTime = Date.now()
    console.log(`🤖 Ai-GROOT Enterprise - ${this.providers.length} providers disponíveis`)

    // Fallback inteligente SEM loop infinito
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i]
      
      try {
        console.log(`🔄 [${i + 1}/${this.providers.length}] Tentando ${provider.name}...`)
        
        const result = await provider.apiCall(question)
        
        console.log(`✅ Sucesso com ${provider.name} (${Date.now() - startTime}ms)`)
        return result
        
      } catch (error) {
        console.error(`❌ Tentativa ${i + 1} falhou:`, error.message)
        
        // Se não for o último provider, continuar
        if (i < this.providers.length - 1) {
          const delay = Math.min(1000 * Math.pow(2, i), 3000)
          console.log(`⏳ Aguardando ${delay}ms antes de tentar novamente...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    // Se todos falharem, retornar fallback controlado
    console.log(`⚠️ Todos os providers falharam → modo fallback seguro`)
    return this.getFallbackResponse(question)
  }

  getFallbackResponse(question) {
    return `Como um assistente de IA, estou enfrentando dificuldades técnicas temporárias. 

Sobre sua pergunta: "${question.substring(0, 100)}${question.length > 100 ? '...' : ''}"

Por favor, tente novamente em alguns minutos. Se o problema persistir, verifique as configurações das APIs.

---
*Ai-GROOT Enterprise v9.0.0*`
  }

  // OpenRouter API - CORRIGIDO
  async askOpenRouter(question) {
    console.log('🔍 OpenRouter: processando requisição...')
    
    const key = process.env.OPENROUTER_KEY || process.env.OPENROUTER_API_KEY;
    
    if (!key) {
      throw new Error('OPENROUTER_KEY não encontrada no .env');
    }
    
    if (key.length < 50) {
      throw new Error('OPENROUTER_KEY inválida (muito curta - deve ter ~60 caracteres)');
    }

    const payload = {
      model: "google/gemma-2-9b-it:free",
      messages: [
        {
          role: "system",
          content: "Você é Ai-GROOT, especialista em desenvolvimento de software, debugging e programação."
        },
        {
          role: "user",
          content: question
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    }

    const headers = {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
      // REMOVIDO: HTTP-Referer e X-Title (causam problemas)
    }

    try {
      const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        payload,
        {
          headers,
          timeout: 30000
        }
      )

      if (!response.data?.choices?.[0]?.message?.content) {
        throw new Error("Resposta inválida do OpenRouter");
      }

      return response.data.choices[0].message.content;
      
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('401 Unauthorized - API key inválida ou expirada');
      }
      throw error;
    }
  }

  // Google Gemini API - CORRIGIDO
  async askGeminiCorrect(question) {
    try {
      // Instalar: npm install @google/generative-ai
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const result = await model.generateContent(
        `Você é Ai-GROOT, especialista em desenvolvimento de software. Responda como um assistente técnico moderno.\n\n${question}`
      );

      if (!result.response?.text()) {
        throw new Error("Resposta inválida do Gemini");
      }

      return result.response.text();
      
    } catch (error) {
      if (error.message.includes('API key')) {
        throw new Error('GEMINI_API_KEY inválida');
      }
      throw error;
    }
  }

  // Groq API - OTIMIZADO
  async askGroq(question) {
    console.log('🔍 Groq: processando requisição...')

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: "Você é Ai-GROOT, especialista em desenvolvimento de software. Forneça respostas técnicas, precisas e com exemplos práticos. Use const/let em vez de var. Prefira JavaScript moderno e frameworks atuais."
          },
          {
            role: "user",
            content: question
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 25000
      }
    )

    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error("Resposta inválida do Groq")
    }

    return response.data.choices[0].message.content
  }
}

// Instância global
export const aiProviders = new AIProviders()

// Função legado para compatibilidade
export async function askMultiAI(question) {
  return await aiProviders.askMultiAI(question)
}
