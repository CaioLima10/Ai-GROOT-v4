import dotenv from "dotenv"
import { aiProviders } from "../aiProviders.js"

dotenv.config()

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "")

export class StreamingAIGateway {
  constructor() {
    this.activeStreams = new Map()
  }

  createStreamId() {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  getStreamingProvider() {
    const selected = (process.env.GROOT_AI_PROVIDER || "auto").toLowerCase()
    if (selected === "ollama" || process.env.OLLAMA_ENABLED === "true") return "ollama"
    if (selected === "groq" || process.env.GROQ_API_KEY) return "groq"
    return "simulated"
  }

  async askStreaming(question, optionsOrOnChunk, maybeOnChunk, maybeOnComplete, maybeOnError) {
    const usingLegacySignature = typeof optionsOrOnChunk === "function"
    const options = usingLegacySignature ? {} : (optionsOrOnChunk || {})
    const onChunk = usingLegacySignature ? optionsOrOnChunk : maybeOnChunk
    const onComplete = usingLegacySignature ? maybeOnChunk : maybeOnComplete
    const onError = usingLegacySignature ? maybeOnComplete : maybeOnError
    const provider = this.getStreamingProvider()

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
              streamingFallbackFrom: provider
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
        provider: options?.streamingFallbackFrom ? `simulated:${options.streamingFallbackFrom}` : "simulated",
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
        })
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
        provider: "Ollama"
      })
    } catch (error) {
      onError({
        id: streamId,
        error: error.message
      })
    }
  }

  async askGroqStreaming(question, options, onChunk, onComplete, onError) {
    const streamId = this.createStreamId()
    const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant"

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
        })
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
              provider: "Groq"
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
        provider: "Groq"
      })
    } catch (error) {
      onError({
        id: streamId,
        error: error.message
      })
    }
  }
}

export const streamingGateway = new StreamingAIGateway()
