import { buildAssistantPromptContext } from "./promptContext.js"

const DEFAULT_OPTIONS = {
  maxPromptChars: 9000,
  ragTopK: 5,
  memoryTurns: 8
}

function normalizeText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function classifyIntent(question = "") {
  const text = normalizeText(question).toLowerCase()

  const flags = {
    asksIdentity: /\b(quem e voce|quem e vc|quem e o giom|qual seu nome|sua identidade)\b/.test(text),
    asksTechnical: /\b(codigo|bug|erro|api|sql|react|node|typescript|python|arquitetura|deploy|performance)\b/.test(text),
    asksBible: /\b(biblia|jesus|evangelho|versiculo|naa|almeida|king james|hebraico|grego|aramaico)\b/.test(text),
    asksGeneralKnowledge: /\b(o que e|explique|como funciona|me ensina|resuma|compare)\b/.test(text),
    asksPersonalPreference: /\b(prefiro|meu nome|gosto de|minha area|minha area e|minha area eh)\b/.test(text),
    veryShort: text.length < 25
  }

  return {
    category: flags.asksTechnical
      ? "technical"
      : flags.asksBible
        ? "bible"
        : flags.asksGeneralKnowledge
          ? "knowledge"
          : "general",
    flags
  }
}

function decideRetrievalStrategy(intent, context = {}) {
  const hasConversationHistory = Array.isArray(context.conversationHistory) && context.conversationHistory.length > 0
  const hasUserSignals = Boolean(context.userId || context.userProfile)

  const useRag = intent.flags.asksTechnical || intent.flags.asksBible || intent.flags.asksGeneralKnowledge
  const useMemory = hasConversationHistory || hasUserSignals || intent.flags.asksPersonalPreference
  const respondDirect = intent.flags.veryShort && !useRag

  return {
    useRag,
    useMemory,
    respondDirect,
    reason: respondDirect
      ? "short_direct"
      : useRag
        ? "needs_external_context"
        : useMemory
          ? "memory_context_only"
          : "default"
  }
}

function truncateSection(text = "", maxChars = 3200) {
  const normalized = String(text || "").trim()
  if (normalized.length <= maxChars) return normalized
  return `${normalized.slice(0, maxChars - 3)}...`
}

function buildFinalPrompt({ systemPrompt, memoryText, ragText, userQuestion, maxPromptChars }) {
  const sections = [
    "[ System Prompt ]",
    truncateSection(systemPrompt, 3200),
    "",
    "[ Memoria relevante ]",
    truncateSection(memoryText, 1800) || "Sem memoria relevante.",
    "",
    "[ Contexto do RAG ]",
    truncateSection(ragText, 1800) || "Sem contexto adicional.",
    "",
    "[ Pergunta do usuario ]",
    String(userQuestion || "").trim()
  ]

  let prompt = sections.join("\n")
  if (prompt.length > maxPromptChars) {
    prompt = `${prompt.slice(0, maxPromptChars - 3)}...`
  }

  return prompt
}

export class GiomOrchestrator {
  constructor(options = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...(options || {})
    }
  }

  async buildResponsePlan(question, context = {}) {
    const intent = classifyIntent(question)
    const strategy = decideRetrievalStrategy(intent, context)

    const promptContext = await buildAssistantPromptContext(question, context, {
      limit: strategy.useRag ? this.options.ragTopK : 3,
      userStyle: context.userStyle || "natural"
    })

    const memoryText = strategy.useMemory
      ? [
        promptContext.memoryContext?.knownFactsText || "",
        promptContext.memoryContext?.contextSummary || "",
        promptContext.memoryContext?.recentConversationText || ""
      ]
        .filter(Boolean)
        .join("\n")
      : ""

    const ragText = strategy.useRag
      ? (promptContext.ragContext?.context || "")
      : ""

    const finalPrompt = buildFinalPrompt({
      systemPrompt: promptContext.promptPackage?.systemPrompt || promptContext.promptPackage?.prompt || "",
      memoryText,
      ragText,
      userQuestion: question,
      maxPromptChars: this.options.maxPromptChars
    })

    return {
      intent,
      strategy,
      promptPackage: promptContext.promptPackage,
      memoryContext: promptContext.memoryContext,
      ragContext: promptContext.ragContext,
      finalPrompt
    }
  }
}

export const giomOrchestrator = new GiomOrchestrator()
