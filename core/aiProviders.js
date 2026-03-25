import axios from "axios"
import dotenv from "dotenv"
import { AI_BRAND_NAME, AI_ENTERPRISE_NAME } from "../packages/shared-config/src/brand.js"

dotenv.config()

const MODEL_TIER = (process.env.GROOT_MODEL_TIER || "balanced").toLowerCase()
const PRIMARY_PROVIDER = (process.env.GROOT_AI_PROVIDER || "auto").toLowerCase()
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "")
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")
const OPENROUTER_KEY = process.env.OPENROUTER_KEY || process.env.OPENROUTER_API_KEY

const SYSTEM_PROMPT = `Voce e ${AI_BRAND_NAME}, especialista em desenvolvimento de software, debugging, arquitetura, automacao e boas praticas modernas. Responda com clareza, precisao e foco em implementacao.`

const TIER_DEFAULTS = {
  fast: {
    ollama: "qwen3",
    groq: "llama-3.1-8b-instant",
    openrouter: "openrouter/free",
    gemini: "gemini-2.5-flash-lite",
    openai: "gpt-5-mini"
  },
  balanced: {
    ollama: "qwen3",
    groq: "llama-3.1-8b-instant",
    openrouter: "openrouter/free",
    gemini: "gemini-2.5-flash",
    openai: "gpt-5-mini"
  },
  best: {
    ollama: "gpt-oss",
    groq: "llama-3.3-70b-versatile",
    openrouter: "openai/gpt-oss-120b",
    gemini: "gemini-2.5-pro",
    openai: "gpt-5.4"
  }
}

const tier = TIER_DEFAULTS[MODEL_TIER] || TIER_DEFAULTS.balanced

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function uniqueByKey(list, key) {
  const seen = new Set()
  return list.filter(item => {
    if (!item || seen.has(item[key])) return false
    seen.add(item[key])
    return true
  })
}

function buildProviderError(name, error) {
  const status = error?.response?.status
  const details = error?.response?.data?.error?.message || error?.response?.data?.error || error?.message
  return new Error(`${name}: ${status ? `${status} ` : ""}${details || "falhou"}`.trim())
}

export class AIProviders {
  constructor() {
    this.openaiClient = null
    this.ollamaStatus = {
      checkedAt: 0,
      available: false
    }

    this.providers = this.buildProviders()
    this.logProviders()
  }

  buildProviders() {
    const configured = [
      {
        key: "ollama",
        name: "Ollama Local",
        priority: 10,
        enabled: process.env.OLLAMA_ENABLED === "true" || PRIMARY_PROVIDER === "ollama",
        supports: {
          local: true,
          streaming: true,
          tools: true,
          structuredOutput: true,
          openaiCompatible: false,
          freeFirst: true
        },
        apiCall: this.askOllama.bind(this)
      },
      {
        key: "groq",
        name: "Groq",
        priority: 20,
        enabled: !!process.env.GROQ_API_KEY,
        supports: {
          local: false,
          streaming: true,
          tools: true,
          structuredOutput: true,
          openaiCompatible: true,
          freeFirst: true
        },
        apiCall: this.askGroq.bind(this)
      },
      {
        key: "openrouter",
        name: "OpenRouter",
        priority: 30,
        enabled: !!OPENROUTER_KEY,
        supports: {
          local: false,
          streaming: true,
          tools: true,
          structuredOutput: true,
          openaiCompatible: true,
          freeFirst: true
        },
        apiCall: this.askOpenRouter.bind(this)
      },
      {
        key: "gemini",
        name: "Google Gemini",
        priority: 40,
        enabled: !!process.env.GEMINI_API_KEY,
        supports: {
          local: false,
          streaming: true,
          tools: true,
          structuredOutput: true,
          openaiCompatible: false,
          freeFirst: true
        },
        apiCall: this.askGemini.bind(this)
      },
      {
        key: "openai",
        name: "OpenAI",
        priority: 50,
        enabled: !!process.env.OPENAI_API_KEY,
        supports: {
          local: false,
          streaming: true,
          tools: true,
          structuredOutput: true,
          openaiCompatible: true,
          freeFirst: false
        },
        apiCall: this.askOpenAI.bind(this)
      }
    ]

    return configured.filter(provider => provider.enabled).sort((a, b) => a.priority - b.priority)
  }

  logProviders() {
    console.log(`🤖 ${AI_ENTERPRISE_NAME} - ${this.providers.length} providers configurados:`)
    if (this.providers.length === 0) {
      console.log("  ⚠️ Nenhum provider remoto/local configurado. Ativando fallback seguro.")
      return
    }

    this.providers.forEach(provider => {
      console.log(`  ✅ ${provider.name} (${provider.key})`)
    })
  }

  getProviderSummary() {
    return this.providers.map(provider => ({
      key: provider.key,
      name: provider.name,
      enabled: provider.enabled,
      supports: provider.supports
    }))
  }

  getActiveProviders() {
    if (this.providers.length === 0) return []
    if (PRIMARY_PROVIDER === "auto") return [...this.providers]

    const selected = this.providers.find(provider => provider.key === PRIMARY_PROVIDER)
    if (!selected) return [...this.providers]

    return uniqueByKey([selected, ...this.providers], "key")
  }

  async askMultiAI(question, options = {}, legacyMaxRetries = 1) {
    let normalizedOptions = options
    let maxRetries = legacyMaxRetries

    if (typeof options === "number") {
      normalizedOptions = {}
      maxRetries = options
    }

    const providers = this.getActiveProviders()
    const startTime = Date.now()

    if (providers.length === 0) {
      return this.getFallbackResponse(question)
    }

    for (let attempt = 0; attempt < Math.max(1, maxRetries); attempt++) {
      for (let index = 0; index < providers.length; index++) {
        const provider = providers[index]

        try {
          console.log(`🔄 [${index + 1}/${providers.length}] Tentando ${provider.name}...`)
          const response = await provider.apiCall(question, normalizedOptions)
          console.log(`✅ Sucesso com ${provider.name} (${Date.now() - startTime}ms)`)
          return response
        } catch (error) {
          console.error(`❌ ${provider.name} falhou:`, error.message)

          const isLastProvider = index === providers.length - 1
          const isLastAttempt = attempt === Math.max(1, maxRetries) - 1

          if (!isLastProvider || !isLastAttempt) {
            const delay = Math.min(800 * (attempt + 1), 2000)
            await sleep(delay)
          }
        }
      }
    }

    console.log("⚠️ Todos os providers falharam -> modo fallback seguro")
    return this.getFallbackResponse(question)
  }

  getFallbackResponse(question) {
    const preview = String(question || "").slice(0, 100)
    return `Estou em modo de contingencia no momento.\n\nPergunta recebida: "${preview}${preview.length === 100 ? "..." : ""}"\n\nTente novamente em alguns instantes ou revise as configuracoes de provider no .env.\n\n${AI_ENTERPRISE_NAME}`
  }

  buildMessages(question, options = {}) {
    if (Array.isArray(options.messages) && options.messages.length > 0) {
      return options.messages
    }

    const systemPrompt = options.systemPrompt === null ? null : (options.systemPrompt || SYSTEM_PROMPT)
    const messages = []

    if (systemPrompt) {
      messages.push({
        role: "system",
        content: systemPrompt
      })
    }

    messages.push({
      role: "user",
      content: String(question || "")
    })

    return messages
  }

  buildOpenAICompatiblePayload(question, options, model, provider) {
    const payload = {
      model,
      messages: this.buildMessages(question, options),
      temperature: options.temperature ?? 0.7
    }

    const maxTokens = options.maxTokens ?? options.max_tokens
    if (maxTokens) {
      payload.max_tokens = maxTokens
    }

    if (Array.isArray(options.tools) && options.tools.length > 0) {
      payload.tools = options.tools
    }

    if (options.toolChoice) {
      payload.tool_choice = options.toolChoice
    }

    if (options.stream === true) {
      payload.stream = true
    }

    if (options.responseFormat && provider !== "groq") {
      payload.response_format = options.responseFormat
    }

    return payload
  }

  extractOpenAICompatibleText(response, providerName) {
    const message = response?.data?.choices?.[0]?.message
    const content = message?.content

    if (typeof content === "string" && content.trim()) {
      return content
    }

    if (Array.isArray(content)) {
      const text = content
        .map(item => item?.text || item?.content || "")
        .filter(Boolean)
        .join("")

      if (text.trim()) return text
    }

    if (Array.isArray(message?.tool_calls) && message.tool_calls.length > 0) {
      return JSON.stringify({
        provider: providerName,
        toolCalls: message.tool_calls
      }, null, 2)
    }

    throw new Error(`Resposta invalida do ${providerName}`)
  }

  getOllamaHeaders() {
    if (!process.env.OLLAMA_API_KEY) return { "Content-Type": "application/json" }
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OLLAMA_API_KEY}`
    }
  }

  async checkOllamaAvailability() {
    const now = Date.now()
    const cacheTtlMs = 15 * 1000

    if (now - this.ollamaStatus.checkedAt < cacheTtlMs) {
      return this.ollamaStatus.available
    }

    try {
      await axios.get(`${OLLAMA_BASE_URL}/api/tags`, {
        headers: this.getOllamaHeaders(),
        timeout: Number(process.env.OLLAMA_HEALTHCHECK_TIMEOUT_MS || 1200)
      })
      this.ollamaStatus = {
        checkedAt: now,
        available: true
      }
      return true
    } catch {
      this.ollamaStatus = {
        checkedAt: now,
        available: false
      }
      return false
    }
  }

  async askOllama(question, options = {}) {
    const available = await this.checkOllamaAvailability()
    if (!available) {
      throw new Error(`Ollama local nao respondeu em ${OLLAMA_BASE_URL}`)
    }

    const model = process.env.OLLAMA_MODEL || tier.ollama

    try {
      const response = await axios.post(
        `${OLLAMA_BASE_URL}/api/chat`,
        {
          model,
          messages: this.buildMessages(question, options),
          stream: false,
          tools: Array.isArray(options.tools) && options.tools.length > 0 ? options.tools : undefined,
          format: options.format || undefined,
          options: options.runtimeOptions || undefined
        },
        {
          headers: this.getOllamaHeaders(),
          timeout: Number(process.env.OLLAMA_TIMEOUT_MS || 120000)
        }
      )

      const content = response?.data?.message?.content
      if (typeof content === "string" && content.trim()) {
        return content
      }

      if (Array.isArray(response?.data?.message?.tool_calls) && response.data.message.tool_calls.length > 0) {
        return JSON.stringify({
          provider: "ollama",
          toolCalls: response.data.message.tool_calls
        }, null, 2)
      }

      throw new Error("Resposta invalida do Ollama")
    } catch (error) {
      throw buildProviderError("Ollama", error)
    }
  }

  async askGroq(question, options = {}) {
    const model = process.env.GROQ_MODEL || tier.groq

    try {
      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        this.buildOpenAICompatiblePayload(question, options, model, "groq"),
        {
          headers: {
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json"
          },
          timeout: Number(process.env.GROQ_TIMEOUT_MS || 25000)
        }
      )

      return this.extractOpenAICompatibleText(response, "Groq")
    } catch (error) {
      throw buildProviderError("Groq", error)
    }
  }

  async askOpenRouter(question, options = {}) {
    const model = process.env.OPENROUTER_MODEL || tier.openrouter

    try {
      const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        this.buildOpenAICompatiblePayload(question, options, model, "openrouter"),
        {
          headers: {
            "Authorization": `Bearer ${OPENROUTER_KEY}`,
            "Content-Type": "application/json"
          },
          timeout: Number(process.env.OPENROUTER_TIMEOUT_MS || 30000)
        }
      )

      return this.extractOpenAICompatibleText(response, "OpenRouter")
    } catch (error) {
      throw buildProviderError("OpenRouter", error)
    }
  }

  toGeminiContents(question, options = {}) {
    if (Array.isArray(options.messages) && options.messages.length > 0) {
      return options.messages.map(message => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: String(message.content || "") }]
      }))
    }

    return [
      {
        role: "user",
        parts: [{ text: String(question || "") }]
      }
    ]
  }

  toGeminiTools(tools = []) {
    const declarations = tools
      .filter(tool => tool?.type === "function" && tool.function?.name)
      .map(tool => ({
        name: tool.function.name,
        description: tool.function.description || "",
        parameters: tool.function.parameters || {
          type: "object",
          properties: {}
        }
      }))

    if (declarations.length === 0) return undefined
    return [{ functionDeclarations: declarations }]
  }

  extractGeminiText(data) {
    const parts = data?.candidates?.[0]?.content?.parts || []
    const text = parts
      .map(part => part?.text || "")
      .filter(Boolean)
      .join("")

    if (text.trim()) {
      return text
    }

    const functionCalls = parts
      .filter(part => part?.functionCall)
      .map(part => part.functionCall)

    if (functionCalls.length > 0) {
      return JSON.stringify({
        provider: "gemini",
        functionCalls
      }, null, 2)
    }

    throw new Error("Resposta invalida do Gemini")
  }

  async askGemini(question, options = {}) {
    const model = process.env.GEMINI_MODEL || tier.gemini
    const payload = {
      systemInstruction: options.systemPrompt === null
        ? undefined
        : {
            parts: [
              {
                text: options.systemPrompt || SYSTEM_PROMPT
              }
            ]
          },
      contents: this.toGeminiContents(question, options),
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2000
      },
      tools: this.toGeminiTools(options.tools)
    }

    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        payload,
        {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: Number(process.env.GEMINI_TIMEOUT_MS || 30000)
        }
      )

      return this.extractGeminiText(response.data)
    } catch (error) {
      throw buildProviderError("Gemini", error)
    }
  }

  async getOpenAIClient() {
    if (this.openaiClient) return this.openaiClient

    const sdk = await import("openai")
    this.openaiClient = new sdk.OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: OPENAI_BASE_URL
    })
    return this.openaiClient
  }

  async askOpenAI(question, options = {}) {
    const model = process.env.OPENAI_MODEL || tier.openai

    try {
      const client = await this.getOpenAIClient()
      const response = await client.chat.completions.create(
        this.buildOpenAICompatiblePayload(question, options, model, "openai")
      )

      const content = response?.choices?.[0]?.message?.content
      if (typeof content === "string" && content.trim()) {
        return content
      }

      if (Array.isArray(response?.choices?.[0]?.message?.tool_calls) && response.choices[0].message.tool_calls.length > 0) {
        return JSON.stringify({
          provider: "openai",
          toolCalls: response.choices[0].message.tool_calls
        }, null, 2)
      }

      throw new Error("Resposta invalida do OpenAI")
    } catch (error) {
      throw buildProviderError("OpenAI", error)
    }
  }
}

export const aiProviders = new AIProviders()

export async function askMultiAI(question, options) {
  return aiProviders.askMultiAI(question, options)
}
