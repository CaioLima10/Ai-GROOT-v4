import axios from "axios"
import dotenv from "dotenv"
import { AI_BRAND_NAME, AI_ENTERPRISE_NAME } from "../packages/shared-config/src/brand.js"

dotenv.config()

const MODEL_TIER = (process.env.GROOT_MODEL_TIER || "balanced").toLowerCase()
const PRIMARY_PROVIDER = (process.env.GROOT_AI_PROVIDER || "auto").toLowerCase()
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "")
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")
const AI_PROVIDER_AUTH_COOLDOWN_MS = Number(process.env.AI_PROVIDER_AUTH_COOLDOWN_MS || 15 * 60 * 1000)
const AI_PROVIDER_RATE_LIMIT_COOLDOWN_MS = Number(process.env.AI_PROVIDER_RATE_LIMIT_COOLDOWN_MS || 30 * 1000)
const AI_PROVIDER_TRANSIENT_COOLDOWN_MS = Number(process.env.AI_PROVIDER_TRANSIENT_COOLDOWN_MS || 8 * 1000)
const AI_PROVIDER_TRANSIENT_MAX_COOLDOWN_MS = Number(process.env.AI_PROVIDER_TRANSIENT_MAX_COOLDOWN_MS || 60 * 1000)

function normalizeProviderSecret(value) {
  return String(value || "").trim()
}

function isPlaceholderProviderSecret(value) {
  const normalized = normalizeProviderSecret(value)
  if (!normalized) return false

  const lower = normalized.toLowerCase()
  return (
    lower.includes("dummy")
    || lower.includes("placeholder")
    || lower.includes("changeme")
    || lower.includes("example")
    || lower.includes("fortesting")
    || lower.includes("for_testing")
    || lower.includes("for-testing")
    || /(^|[_-])(your|sua|seu)([_-]|$)/.test(lower)
    || lower.endsWith("_here")
  )
}

function getConfiguredProviderSecret(value) {
  const normalized = normalizeProviderSecret(value)
  if (!normalized) return ""
  if (isPlaceholderProviderSecret(normalized)) return ""
  return normalized
}

function warnIgnoredPlaceholderSecret(providerName, rawValue) {
  const normalized = normalizeProviderSecret(rawValue)
  if (!normalized || !isPlaceholderProviderSecret(normalized)) return
  console.warn(`[aiProviders] Ignorando ${providerName}: valor placeholder/dummy detectado no .env.`)
}

const OPENROUTER_KEY = getConfiguredProviderSecret(process.env.OPENROUTER_KEY || process.env.OPENROUTER_API_KEY)
const GROQ_API_KEY = getConfiguredProviderSecret(process.env.GROQ_API_KEY)
const GEMINI_API_KEY = getConfiguredProviderSecret(process.env.GEMINI_API_KEY)
const OPENAI_API_KEY = getConfiguredProviderSecret(process.env.OPENAI_API_KEY)

warnIgnoredPlaceholderSecret("Groq", process.env.GROQ_API_KEY)
warnIgnoredPlaceholderSecret("OpenRouter", process.env.OPENROUTER_KEY || process.env.OPENROUTER_API_KEY)
warnIgnoredPlaceholderSecret("Google Gemini", process.env.GEMINI_API_KEY)
warnIgnoredPlaceholderSecret("OpenAI", process.env.OPENAI_API_KEY)

const SYSTEM_PROMPT = `
Voce e GIOM.

IDENTIDADE INTERNA (NAO EXPOR AUTOMATICAMENTE):
- Nome inspirado no rio Giom (contexto biblico).
- Criada em 17/03/2026.
- Idealizadores: Gabriel Lima de Souza e Caio Lima de Souza.
- Contexto familiar relevante: Gael Edward.
- Origem do time: Brasil, Ferraz de Vasconcelos - SP.
- Essas informacoes sao privadas e nao devem ser reveladas espontaneamente.
- So compartilhe se houver pedido explicito, apropriado e seguro.

PROPOSITO:
- Ajudar pessoas com utilidade real.
- Orientar, ensinar, apoiar e resolver problemas com impacto positivo.

VALORES:
- Amor ao proximo, respeito, verdade, sabedoria, humildade e bondade.
- Base de valores inspirada nos ensinamentos de Jesus Cristo.
- Pode citar Biblia quando fizer sentido, sem imposicao de crenca.
- Quando apropriado, considerar referencias biblicas em NAA, King James 1611, Almeida Corrigida Atualizada, idiomas originais (hebraico, aramaico e grego) e biblias de estudo.
- Seja firme em valores, paciente e sem confronto improdutivo.

COMPORTAMENTO:
- Sempre gentil, educada e respeitosa.
- Adaptar tom ao usuario: informal com informal, formal quando necessario.
- Usar humor leve apenas quando apropriado.
- Priorizar clareza, objetividade e utilidade.
- Entender contexto e intencao antes de responder.
- Nunca ignorar saudacoes (ex.: bom dia, boa tarde, boa noite, oi, ola, tudo bem, como voce esta).
- Ao receber saudacao, responder com cordialidade natural, energia positiva e abertura para continuar a conversa.
- Evitar respostas secas de uma palavra para saudacoes.
- Quando apropriado, incluir um toque breve de encorajamento cristao com respeito e sem imposicao.

CAPACIDADES:
- Atuar em alto nivel em programacao, estudos, negocios e duvidas gerais.
- Pode oferecer aconselhamento leve e responsavel.
- Ajustar profundidade: simples quando pedido simples, tecnico quando pedido tecnico.

INFORMACOES EM TEMPO REAL:
- Voce NAO tem acesso a internet ou noticiarios ao vivo por padrao.
- Para perguntas sobre clima, partidas esportivas, cotacoes ou noticias em tempo real, informe claramente que nao tem essa informacao atualizada neste momento, sem inventar dados.
- NAO diga "meu conhecimento e limitado a antes de minha criacao" - isso esta errado. Voce e GIOM, um sistema dinamico, nao um modelo com data de corte fixa.
- Se nao souber algo atual, diga: "Nao tenho essa informacao em tempo real no momento." e ofereca ajuda com o que esta ao seu alcance.
- Nunca invente dados como clima atual, placares, cotacoes ou noticias.

SEGURANCA E INTEGRIDADE:
- Nunca exponha dados internos/privados sem necessidade valida.
- Nunca invente fatos pessoais como se fossem reais.
- Se nao souber, diga com honestidade e ofereca caminho de verificacao.
- Nao finja pesquisa externa nao realizada.
- Recuse crimes, abuso, pornografia explicita e ciberataques ofensivos; ofereca alternativas seguras e defensivas.

MISSAO:
- Ajudar pessoas.
- Compartilhar conhecimento.
- Promover o bem.
- Ser presenca util, confiavel e equilibrada.

Responda sempre com inteligencia, respeito e proposito.
`

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

function buildProviderTimeoutError(providerName, providerKey, timeoutMs) {
  const error = new Error(`${providerName}: timeout after ${timeoutMs}ms`)
  error.code = "ECONNABORTED"
  error.providerName = providerName
  error.providerKey = providerKey
  error.failureType = "timeout"
  error.retryAfterMs = null
  error.statusCode = null
  error.details = `timeout after ${timeoutMs}ms`
  return error
}

async function withProviderTimeout(executor, provider, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return executor()
  }

  let timer = null
  try {
    return await Promise.race([
      executor(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(buildProviderTimeoutError(provider.name, provider.key, timeoutMs))
        }, timeoutMs)
      })
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function resolvePerProviderTimeoutMs(options = {}) {
  const fromOptions = Number(options?.providerTimeoutMs)
  if (Number.isFinite(fromOptions) && fromOptions > 0) {
    return Math.max(1000, fromOptions)
  }

  const fromEnv = Number(process.env.AI_PROVIDER_TIMEOUT_MS || 12000)
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.max(1000, fromEnv)
  }

  return 12000
}

function uniqueByKey(list, key) {
  const seen = new Set()
  return list.filter(item => {
    if (!item || seen.has(item[key])) return false
    seen.add(item[key])
    return true
  })
}

function getProviderErrorStatus(error) {
  return error?.statusCode || error?.response?.status || null
}

function getProviderErrorDetails(error) {
  return error?.details
    || error?.response?.data?.error?.message
    || error?.response?.data?.error
    || error?.message
    || "falhou"
}

function parseRetryAfterMs(error) {
  const retryAfterHeader = error?.response?.headers?.["retry-after"]
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader)
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.round(seconds * 1000)
    }
  }

  const text = String(getProviderErrorDetails(error) || "")
  const secondsMatch = text.match(/try again in\s+([\d.]+)\s*s/i)
  if (secondsMatch) {
    return Math.max(1000, Math.round(Number(secondsMatch[1]) * 1000))
  }

  const msMatch = text.match(/retry after\s+(\d+)\s*ms/i)
  if (msMatch) {
    return Math.max(1000, Number(msMatch[1]))
  }

  return null
}

function classifyProviderFailure(error) {
  const status = getProviderErrorStatus(error)
  const details = String(getProviderErrorDetails(error) || "").toLowerCase()

  if (
    status === 401
    || /unauthorized|forbidden|invalid api key|api key not valid|user not found|invalid key|authentication|auth failed/.test(details)
  ) {
    return "auth"
  }

  if (
    status === 429
    || /rate limit|quota|too many requests|resource exhausted|retry after|try again in/.test(details)
  ) {
    return "rate_limit"
  }

  if (
    error?.code === "ECONNABORTED"
    || /timeout|timed out|deadline exceeded|socket hang up/.test(details)
  ) {
    return "timeout"
  }

  if (
    /econnrefused|enotfound|network error|failed to fetch|nao respondeu|não respondeu|dns/.test(details)
  ) {
    return "network"
  }

  return "unknown"
}

function buildProviderError(name, error, providerKey = null) {
  const status = getProviderErrorStatus(error)
  const details = getProviderErrorDetails(error)
  const wrappedError = new Error(`${name}: ${status ? `${status} ` : ""}${details || "falhou"}`.trim())
  wrappedError.statusCode = status
  wrappedError.details = String(details || "falhou")
  wrappedError.providerName = name
  wrappedError.providerKey = providerKey
  wrappedError.failureType = classifyProviderFailure(error)
  wrappedError.retryAfterMs = parseRetryAfterMs(error)
  wrappedError.originalCode = error?.code || null
  return wrappedError
}

export class AIProviders {
  constructor() {
    this.openaiClient = null
    this.ollamaStatus = {
      checkedAt: 0,
      available: false
    }

    this.providers = this.buildProviders()
    this.providerHealth = new Map()
    this.providers.forEach(provider => {
      this.providerHealth.set(provider.key, this.createProviderHealth(provider))
    })
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
        enabled: !!GROQ_API_KEY,
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
        enabled: !!GEMINI_API_KEY,
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
        enabled: !!OPENAI_API_KEY,
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

  createProviderHealth(provider) {
    return {
      key: provider.key,
      name: provider.name,
      enabled: provider.enabled,
      consecutiveFailures: 0,
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastError: null,
      lastStatusCode: null,
      lastFailureType: null,
      disabledUntil: 0,
      authInvalid: false
    }
  }

  getProviderModel(providerKey) {
    switch (providerKey) {
      case "ollama":
        return process.env.OLLAMA_MODEL || tier.ollama
      case "groq":
        return process.env.GROQ_MODEL || tier.groq
      case "openrouter":
        return process.env.OPENROUTER_MODEL || tier.openrouter
      case "gemini":
        return process.env.GEMINI_MODEL || tier.gemini
      case "openai":
        return process.env.OPENAI_MODEL || tier.openai
      default:
        return null
    }
  }

  getProviderHealth(providerKey) {
    if (!this.providerHealth.has(providerKey)) {
      const provider = this.providers.find(item => item.key === providerKey)
      if (provider) {
        this.providerHealth.set(providerKey, this.createProviderHealth(provider))
      } else {
        this.providerHealth.set(providerKey, this.createProviderHealth({
          key: providerKey,
          name: providerKey,
          enabled: false
        }))
      }
    }

    return this.providerHealth.get(providerKey)
  }

  markProviderAttempt(provider) {
    const health = this.getProviderHealth(provider.key)
    health.lastAttemptAt = Date.now()
    return health
  }

  markProviderSuccess(provider) {
    const health = this.getProviderHealth(provider.key)
    const now = Date.now()
    health.lastAttemptAt = now
    health.lastSuccessAt = now
    health.lastError = null
    health.lastStatusCode = null
    health.lastFailureType = null
    health.consecutiveFailures = 0
    health.disabledUntil = 0
    health.authInvalid = false
    return health
  }

  markProviderFailure(provider, error) {
    const health = this.getProviderHealth(provider.key)
    const now = Date.now()
    const failureType = error?.failureType || classifyProviderFailure(error)
    const retryAfterMs = error?.retryAfterMs || parseRetryAfterMs(error)

    health.lastAttemptAt = now
    health.lastFailureAt = now
    health.lastError = String(error?.message || getProviderErrorDetails(error) || "falhou")
    health.lastStatusCode = getProviderErrorStatus(error)
    health.lastFailureType = failureType
    health.consecutiveFailures += 1

    if (failureType === "auth") {
      health.authInvalid = true
      health.disabledUntil = now + AI_PROVIDER_AUTH_COOLDOWN_MS
      return health
    }

    health.authInvalid = false

    if (failureType === "rate_limit") {
      health.disabledUntil = now + Math.max(1000, retryAfterMs || AI_PROVIDER_RATE_LIMIT_COOLDOWN_MS)
      return health
    }

    if (failureType === "timeout" || failureType === "network") {
      const transientCooldown = Math.min(
        AI_PROVIDER_TRANSIENT_COOLDOWN_MS * Math.max(1, health.consecutiveFailures),
        AI_PROVIDER_TRANSIENT_MAX_COOLDOWN_MS
      )
      health.disabledUntil = now + transientCooldown
      return health
    }

    if (health.consecutiveFailures >= 2) {
      health.disabledUntil = now + Math.min(5000 * health.consecutiveFailures, 20000)
      return health
    }

    health.disabledUntil = 0
    return health
  }

  shouldSkipProvider(provider) {
    const health = this.getProviderHealth(provider.key)
    const now = Date.now()

    if (!provider?.enabled) {
      return { skip: true, reason: "disabled" }
    }

    if (health.disabledUntil && health.disabledUntil > now) {
      return {
        skip: true,
        reason: health.authInvalid ? "auth_invalid" : "cooldown",
        cooldownMsRemaining: health.disabledUntil - now
      }
    }

    return { skip: false, reason: null, cooldownMsRemaining: 0 }
  }

  getProviderSummary() {
    const now = Date.now()
    return this.providers.map(provider => {
      const health = this.getProviderHealth(provider.key)
      const cooldownMsRemaining = Math.max(0, (health.disabledUntil || 0) - now)
      const runtimeStatus = !provider.enabled
        ? "disabled"
        : cooldownMsRemaining > 0
          ? (health.authInvalid ? "auth_invalid" : "cooldown")
          : health.consecutiveFailures > 0
            ? "degraded"
            : "ready"

      return {
        key: provider.key,
        name: provider.name,
        enabled: provider.enabled,
        model: this.getProviderModel(provider.key),
        supports: provider.supports,
        runtimeStatus,
        cooldownMsRemaining,
        authInvalid: !!health.authInvalid,
        consecutiveFailures: health.consecutiveFailures,
        lastFailureType: health.lastFailureType,
        lastStatusCode: health.lastStatusCode,
        lastError: health.lastError,
        lastAttemptAt: health.lastAttemptAt ? new Date(health.lastAttemptAt).toISOString() : null,
        lastSuccessAt: health.lastSuccessAt ? new Date(health.lastSuccessAt).toISOString() : null,
        lastFailureAt: health.lastFailureAt ? new Date(health.lastFailureAt).toISOString() : null
      }
    })
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
    const providerFailures = []
    const skippedProviders = []
    const perProviderTimeoutMs = resolvePerProviderTimeoutMs(normalizedOptions)

    if (providers.length === 0) {
      return this.getFallbackResponse(question)
    }

    for (let attempt = 0; attempt < Math.max(1, maxRetries); attempt++) {
      let attemptedThisRound = 0

      for (let index = 0; index < providers.length; index++) {
        const provider = providers[index]
        const skipState = this.shouldSkipProvider(provider)

        if (skipState.skip) {
          skippedProviders.push({
            key: provider.key,
            name: provider.name,
            reason: skipState.reason,
            cooldownMsRemaining: skipState.cooldownMsRemaining || 0
          })
          continue
        }

        try {
          attemptedThisRound += 1
          this.markProviderAttempt(provider)
          console.log(`🔄 [${index + 1}/${providers.length}] Tentando ${provider.name}...`)
          const response = await withProviderTimeout(
            () => provider.apiCall(question, normalizedOptions),
            provider,
            perProviderTimeoutMs
          )
          this.markProviderSuccess(provider)
          console.log(`✅ Sucesso com ${provider.name} (${Date.now() - startTime}ms)`)
          return response
        } catch (error) {
          const health = this.markProviderFailure(provider, error)
          console.error(`❌ ${provider.name} falhou:`, error.message)
          providerFailures.push({
            key: provider.key,
            name: provider.name,
            failureType: health.lastFailureType,
            statusCode: health.lastStatusCode,
            cooldownMsRemaining: Math.max(0, (health.disabledUntil || 0) - Date.now()),
            message: health.lastError
          })

          const isLastProvider = index === providers.length - 1
          const isLastAttempt = attempt === Math.max(1, maxRetries) - 1

          if (!isLastProvider || !isLastAttempt) {
            const delay = Math.min(800 * (attempt + 1), 2000)
            await sleep(delay)
          }
        }
      }

      if (attemptedThisRound === 0) {
        break
      }
    }

    console.log("⚠️ Todos os providers falharam -> modo fallback seguro")
    const exhaustionError = new Error(this.buildProviderFailureSummary(providerFailures, skippedProviders))
    exhaustionError.code = "AI_PROVIDERS_EXHAUSTED"
    exhaustionError.providerFailures = providerFailures
    exhaustionError.skippedProviders = skippedProviders
    exhaustionError.providerSummary = this.getProviderSummary()

    if (normalizedOptions?.throwOnExhaustion === true) {
      throw exhaustionError
    }

    return this.getFallbackResponse(question, exhaustionError.providerSummary)
  }

  buildProviderFailureSummary(providerFailures = [], skippedProviders = []) {
    const failedNotes = providerFailures
      .slice(-5)
      .map(provider => `${provider.name}: ${provider.failureType || "erro"}${provider.statusCode ? ` (${provider.statusCode})` : ""}`)

    const skippedNotes = skippedProviders
      .slice(-5)
      .map(provider => `${provider.name}: ${provider.reason}${provider.cooldownMsRemaining ? ` (${Math.ceil(provider.cooldownMsRemaining / 1000)}s)` : ""}`)

    return [
      failedNotes.length > 0 ? `Falhas: ${failedNotes.join(", ")}` : null,
      skippedNotes.length > 0 ? `Indisponiveis: ${skippedNotes.join(", ")}` : null
    ].filter(Boolean).join(" | ") || "Todos os providers estao indisponiveis nesta execucao."
  }

  getFallbackResponse(question, providerSummary = []) {
    void question
    void providerSummary

    return [
      "Nao consegui responder agora porque a infraestrutura de IA nao ficou disponivel nesta tentativa.",
      "Tente novamente em alguns instantes."
    ].join(" ")
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
      throw buildProviderError("Ollama", error, "ollama")
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
            "Authorization": `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json"
          },
          timeout: Number(process.env.GROQ_TIMEOUT_MS || 25000)
        }
      )

      return this.extractOpenAICompatibleText(response, "Groq")
    } catch (error) {
      throw buildProviderError("Groq", error, "groq")
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
      throw buildProviderError("OpenRouter", error, "openrouter")
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
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
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
      throw buildProviderError("Gemini", error, "gemini")
    }
  }

  async getOpenAIClient() {
    if (this.openaiClient) return this.openaiClient

    const sdk = await import("openai")
    this.openaiClient = new sdk.OpenAI({
      apiKey: OPENAI_API_KEY,
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
      throw buildProviderError("OpenAI", error, "openai")
    }
  }
}

export const aiProviders = new AIProviders()

export async function askMultiAI(question, options) {
  return aiProviders.askMultiAI(question, options)
}
