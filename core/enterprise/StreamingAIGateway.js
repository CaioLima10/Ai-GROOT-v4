import dotenv from "dotenv"
import { aiProviders } from "../aiProviders.js"

dotenv.config()

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "")

function resolveStreamingFetchTimeoutMs(options = {}) {
  const fromOptions = Number(options?.streamingProviderTimeoutMs || options?.providerTimeoutMs)
  if (Number.isFinite(fromOptions) && fromOptions > 0) {
    return Math.max(2000, fromOptions)
  }

  const fromEnv = Number(process.env.AI_STREAMING_PROVIDER_TIMEOUT_MS || process.env.AI_PROVIDER_TIMEOUT_MS || 15000)
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.max(2000, fromEnv)
  }

  return 15000
}

function normalizeStreamingErrorMessage(providerName, error, timeoutMs) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") {
    return `${providerName} streaming timeout after ${timeoutMs}ms`
  }

  return error?.message || `${providerName} streaming falhou`
}

function normalizeProviderLabel(provider) {
  if (provider === "ollama") return "Ollama"
  if (provider === "groq") return "Groq"
  return "simulated"
}

export class StreamingAIGateway {
  constructor() {
    this.activeStreams = new Map()
  }

  createStreamId() {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  getStreamingProvider() {
    const selected = (process.env.GROOT_AI_PROVIDER || "auto").toLowerCase()
    const activeProviders = typeof aiProviders.getActiveProviders === "function"
      ? aiProviders.getActiveProviders()
      : []

    if (selected === "ollama" || process.env.OLLAMA_ENABLED === "true") return "ollama"
    if (selected === "groq") {
      return activeProviders.some((provider) => provider.key === "groq") ? "groq" : "simulated"
    }
    if (activeProviders.some((provider) => provider.key === "groq")) return "groq"
    return "simulated"
  }

  async askStreaming(question, optionsOrOnChunk, maybeOnChunk, maybeOnComplete, maybeOnError) {
    const usingLegacySignature = typeof optionsOrOnChunk === "function"
    const options = usingLegacySignature ? {} : (optionsOrOnChunk || {})
    const onChunk = usingLegacySignature ? optionsOrOnChunk : maybeOnChunk
    const onComplete = usingLegacySignature ? maybeOnChunk : maybeOnComplete
    const onError = usingLegacySignature ? maybeOnComplete : maybeOnError
    const provider = this.getStreamingProvider()
    const attemptedProvider = provider
    const attemptedProviderLabel = normalizeProviderLabel(attemptedProvider)

    try {
      if (provider === "ollama") {
        return await this.askOllamaStreaming(question, options, onChunk, onComplete, onError)
      }

      if (provider === "groq") {
        return await this.askGroqStreaming(question, options, onChunk, onComplete, onError)
      }

      return await this.askSimulatedStreaming(question, options, onChunk, onComplete, onError)
    } catch (error) {
      if (provider !== "simulated") {
        try {
          return await this.askSimulatedStreaming(
            question,
            {
              ...options,
              attemptedStreamingProvider: attemptedProvider,
              streamingFallbackFrom: attemptedProvider,
              streamingFallbackReason: normalizeStreamingErrorMessage(attemptedProviderLabel, error, resolveStreamingFetchTimeoutMs(options))
            },
            onChunk,
            onComplete,
            onError
          )
        } catch (fallbackError) {
          onError({
            id: this.createStreamId(),
            error: fallbackError.message
          })
          return
        }
      }

      onError({
        id: this.createStreamId(),
        error: error.message
      })
    }
  }

  async askSimulatedStreaming(question, options, onChunk, onComplete, onError) {
    const streamId = this.createStreamId()
    const fallbackFrom = String(options?.streamingFallbackFrom || "").trim() || null
    const attemptedProvider = String(options?.attemptedStreamingProvider || fallbackFrom || "simulated").trim() || "simulated"
    const providerUsed = "simulated"
    const fallbackReason = String(options?.streamingFallbackReason || "").trim() || null

    try {
      const fullResponse = await aiProviders.askMultiAI(question, options)
      const words = String(fullResponse || "").split(" ")
      let currentText = ""

      for (let index = 0; index < words.length; index++) {
        const word = words[index] + (index < words.length - 1 ? " " : "")
        currentText += word

        onChunk({
          id: streamId,
          chunk: word,
          fullText: currentText,
          isComplete: index === words.length - 1
        })

        await new Promise(resolve => setTimeout(resolve, 35))
      }

      onComplete({
        id: streamId,
        fullText: currentText,
        provider: fallbackFrom ? `simulated:${fallbackFrom}` : providerUsed,
        attemptedProvider,
        providerUsed,
        providerFallback: Boolean(fallbackFrom),
        fallbackFrom,
        fallbackReason,
        tokens: words.length,
        duration: Date.now() - parseInt(streamId.split("_")[1], 10)
      })
    } catch (error) {
      onError({
        id: streamId,
        error: error.message
      })
    }
  }

  async askOllamaStreaming(question, options, onChunk, onComplete, onError) {
    const streamId = this.createStreamId()
    const model = process.env.OLLAMA_MODEL || "qwen3"
    const timeoutMs = resolveStreamingFetchTimeoutMs(options)

    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.OLLAMA_API_KEY ? { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` } : {})
        },
        body: JSON.stringify({
          model,
          messages: aiProviders.buildMessages(question, options),
          stream: true
        }),
        signal: AbortSignal.timeout(timeoutMs)
      })

      if (!response.ok || !response.body) {
        throw new Error(`Ollama streaming falhou com status ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let fullText = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const rawLine of lines) {
          const line = rawLine.trim()
          if (!line) continue

          const payload = JSON.parse(line)
          const content = payload?.message?.content || ""

          if (content) {
            fullText += content
            onChunk({
              id: streamId,
              chunk: content,
              fullText,
              isComplete: false
            })
          }

          if (payload?.done) {
            onComplete({
              id: streamId,
              fullText,
              provider: "Ollama",
              attemptedProvider: "ollama",
              providerUsed: "ollama",
              providerFallback: false,
              fallbackFrom: null,
              fallbackReason: null,
              tokens: payload?.eval_count || null,
              duration: payload?.total_duration || null
            })
            return
          }
        }
      }

      onComplete({
        id: streamId,
        fullText,
        provider: "Ollama",
        attemptedProvider: "ollama",
        providerUsed: "ollama",
        providerFallback: false,
        fallbackFrom: null,
        fallbackReason: null
      })
    } catch (error) {
      onError({
        id: streamId,
        error: normalizeStreamingErrorMessage("Ollama", error, timeoutMs)
      })
    }
  }

  async askGroqStreaming(question, options, onChunk, onComplete, onError) {
    const streamId = this.createStreamId()
    const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant"
    const timeoutMs = resolveStreamingFetchTimeoutMs(options)

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: aiProviders.buildMessages(question, options),
          stream: true
        }),
        signal: AbortSignal.timeout(timeoutMs)
      })

      if (!response.ok || !response.body) {
        throw new Error(`Groq streaming falhou com status ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let fullText = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const rawLine of lines) {
          const line = rawLine.trim()
          if (!line.startsWith("data:")) continue

          const data = line.slice(5).trim()
          if (!data) continue

          if (data === "[DONE]") {
            onComplete({
              id: streamId,
              fullText,
              provider: "Groq",
              attemptedProvider: "groq",
              providerUsed: "groq",
              providerFallback: false,
              fallbackFrom: null,
              fallbackReason: null
            })
            return
          }

          try {
            const payload = JSON.parse(data)
            const content = payload?.choices?.[0]?.delta?.content || ""

            if (content) {
              fullText += content
              onChunk({
                id: streamId,
                chunk: content,
                fullText,
                isComplete: false
              })
            }
          } catch {
            // Ignora chunks parciais ou keep-alive
          }
        }
      }

      onComplete({
        id: streamId,
        fullText,
        provider: "Groq",
        attemptedProvider: "groq",
        providerUsed: "groq",
        providerFallback: false,
        fallbackFrom: null,
        fallbackReason: null
      })
    } catch (error) {
      onError({
        id: streamId,
        error: normalizeStreamingErrorMessage("Groq", error, timeoutMs)
      })
    }
  }
}

export const streamingGateway = new StreamingAIGateway()
