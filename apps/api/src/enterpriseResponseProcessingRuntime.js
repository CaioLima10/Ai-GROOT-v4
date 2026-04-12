import { resolveCompatModel } from "../../../packages/shared-config/src/index.js"

export function getCompatContext(modelId, extras = {}) {
  const preset = resolveCompatModel(modelId)
  return {
    assistantProfile: preset.profile,
    activeModules: preset.modules,
    bibleStudyModules: preset.bibleStudyModules || [],
    ...extras
  }
}

export function resolveDeterministicFixtureResponseCore(question = "", context = {}, deps = {}) {
  const {
    runtimeIsFixtureCardPreferred,
    buildFixtureCardResponse,
    buildFixtureIntentFallback
  } = deps

  if (!runtimeIsFixtureCardPreferred(question, context)) {
    return null
  }

  const fixtureCard = buildFixtureCardResponse(context)
  if (fixtureCard) {
    return fixtureCard
  }

  return buildFixtureIntentFallback(question, context)
}

export function resolveDeterministicWeatherResponseCore(question = "", context = {}, deps = {}) {
  const {
    runtimeIsWeatherCardPreferred,
    runtimeBuildWeatherCardResponse,
    runtimeBuildWeatherIntentFallback
  } = deps

  const preferredVariant = String(context?.preferredResponseVariant || "").trim().toLowerCase()
  if (preferredVariant !== "weather" && !runtimeIsWeatherCardPreferred(question, context)) {
    return null
  }

  const weatherCard = runtimeBuildWeatherCardResponse(question, context)
  if (weatherCard) {
    return weatherCard
  }

  return runtimeBuildWeatherIntentFallback(context)
}

export function requiresVerifiedFreshDataCore(question = "", context = {}, deps = {}) {
  const {
    runtimeIsWeatherQuestion,
    runtimeIsFixtureQuestion
  } = deps

  const normalizedQuestion = String(question || "").trim()
  if (!normalizedQuestion) {
    return false
  }

  if (runtimeIsWeatherQuestion(normalizedQuestion) || runtimeIsFixtureQuestion(normalizedQuestion)) {
    return true
  }

  if (String(context?.preferredResponseVariant || "").trim()) {
    return true
  }

  return /\b(agora|ao vivo|tempo real|ultim[oa]s?|atualizad[oa]|confirm[ea]|fonte|horario exato|horário exato|placar exato|preco|preço|cotacao|cotação|noticia|notícia)\b/i.test(normalizedQuestion)
}

function resolveExplicitShortReply(question = "", deps = {}) {
  const input = String(question || "").trim()
  if (!input) {
    return null
  }

  const safety = typeof deps.detectSafetyRisk === "function"
    ? deps.detectSafetyRisk(input)
    : null
  if (safety?.triggered) {
    return null
  }

  const patterns = [
    /\b(?:responda|responde|retorne|diga)\s+(?:apenas|s[oó]|somente)\s*:\s*(.+)$/i,
    /\b(?:responda|responde|retorne|diga)\s+(?:apenas|s[oó]|somente)\s+["'“”]?([^"'“”\n\r]+)["'“”]?\s*$/i
  ]

  for (const pattern of patterns) {
    const match = input.match(pattern)
    const reply = String(match?.[1] || "")
      .trim()
      .replace(/^["'“”]+|["'“”]+$/g, "")
      .trim()

    if (!reply) {
      continue
    }

    if (reply.length > 120 || /[\n\r]/.test(reply)) {
      return null
    }

    return reply
  }

  return null
}

function countKnownFacts(context = {}) {
  const buckets = [
    context?.knownFacts,
    context?.memoryProfile?.knownFacts,
    context?.profile?.knownFacts
  ]

  let count = 0
  for (const bucket of buckets) {
    if (Array.isArray(bucket)) {
      count += bucket.filter(Boolean).length
      continue
    }

    if (bucket && typeof bucket === "object") {
      count += Object.keys(bucket).length
    }
  }

  return count
}

function hasMeaningfulConversationContext(context = {}) {
  const historyBuckets = [
    context?.conversationHistory,
    context?.history,
    context?.recentConversationTurns,
    context?.recentMessages
  ]

  const historyCount = historyBuckets.reduce((total, bucket) => {
    if (!Array.isArray(bucket)) {
      return total
    }

    return total + bucket.filter((entry) => entry && (entry.content || entry.text || entry.message || entry.role)).length
  }, 0)

  if (historyCount > 0) {
    return true
  }

  if (countKnownFacts(context) > 0) {
    return true
  }

  const summary = String(context?.memorySummary || context?.summary || "").trim()
  return Boolean(summary) && !/^in[ií]cio de conversa\b/i.test(summary)
}

function isConversationRecallQuestion(question = "") {
  const input = String(question || "")
  return /\b(qual e meu nome|qual é meu nome|meu nome|quem sou eu|lembra|voce lembra|você lembra|eu ja te falei|eu já te falei|o que eu te disse|o que eu falei|o que eu pedi|qual foi meu pedido|qual foi a pergunta anterior|qual era o assunto|nessa conversa|nesta conversa|nessa thread|nesta thread|no chat anterior|na conversa anterior)\b/i.test(input)
}

function buildMissingConversationContextResponse(question = "") {
  const input = String(question || "")

  if (/\b(qual e meu nome|qual é meu nome|meu nome|quem sou eu)\b/i.test(input)) {
    return "Voce ainda nao me disse seu nome nesta conversa."
  }

  if (/\b(qual foi meu pedido|o que eu pedi|o que eu te disse|o que eu falei|assunto|pergunta anterior)\b/i.test(input)) {
    return "Voce ainda nao me passou esse contexto nesta conversa."
  }

  return "Ainda nao tenho esse contexto nesta conversa. Se quiser, me diga de novo e eu continuo daqui."
}

function shouldUseMissingConversationContextFallback(question = "", context = {}) {
  return isConversationRecallQuestion(question) && !hasMeaningfulConversationContext(context)
}

function isGenericUnknownResponse(text = "") {
  return /\b(nao consegui responder a esta pergunta no momento|não consegui responder a esta pergunta no momento|tente novamente em alguns instantes|nao tenho essa informacao|não tenho essa informação)\b/i.test(String(text || ""))
}

export function buildUnknownInformationResponseCore(question = "", context = {}, options = {}, deps = {}) {
  const explicitShortReply = resolveExplicitShortReply(question, deps)
  if (explicitShortReply) {
    return explicitShortReply
  }

  if (shouldUseMissingConversationContextFallback(question, context)) {
    return buildMissingConversationContextResponse(question)
  }

  const includeReason = options.includeReason !== false
  const details = []

  if (includeReason && requiresVerifiedFreshDataCore(question, context, deps)) {
    details.push("Nao consegui confirmar esta informacao em tempo real nesta execucao.")
  }

  if (options.offerRetry !== false) {
    details.push("Tente novamente em alguns instantes.")
  }

  const base = details.length > 0
    ? `Nao consegui responder a esta pergunta no momento. ${details.join(" ")}`
    : "Nao consegui responder a esta pergunta no momento. Se o problema persistir, verifique as configuracoes do servidor."

  return base.trim()
}

function buildCompactKnowledgeSourceLabel(item = {}) {
  const title = String(item?.title || item?.sourceId || item?.source || "").trim()
  if (!title) return ""

  return title
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function buildKnowledgeSourcesFooter(context = {}) {
  const sources = Array.isArray(context?.ragSources) ? context.ragSources : []
  if (sources.length === 0) {
    return ""
  }

  const unique = []
  const seen = new Set()

  for (const source of sources) {
    const label = buildCompactKnowledgeSourceLabel(source)
    if (!label) continue
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(label)
    if (unique.length >= 3) break
  }

  if (unique.length === 0) {
    return ""
  }

  return `Base consultada: ${unique.join("; ")}`
}

function shouldAppendKnowledgeSources(question = "", context = {}, text = "") {
  if (!Array.isArray(context?.ragSources) || context.ragSources.length === 0) {
    return false
  }

  if (/\b(?:responda|responde|retorne|diga)\s+(?:apenas|s[oó]|somente)\b/i.test(String(question || ""))) {
    return false
  }

  if (isConversationRecallQuestion(question)) {
    return false
  }

  if (/^\s*\{[\s\S]*\}\s*$/m.test(String(text || ""))) {
    return false
  }

  if (/base consultada:/i.test(String(text || ""))) {
    return false
  }

  if (/\b(clima|tempo|previs[aã]o|placar|jogo|partida|ao vivo)\b/i.test(String(question || ""))) {
    return false
  }

  return true
}

const INTERNAL_CONTEXT_LEAK_PATTERN = /\b(com o contexto que eu tenho agora|ponto principal e este|topicos recentes|t[oó]picos recentes|[uú]ltimo pedido|ultimo pedido|se quiser, eu continuo a partir daqui|ainda nao tenho essa informacao|pergunte denovo|validacao da solucao|valida[cç][aã]o da solu[cç][aã]o|no estado atual desta execucao|limite operacional)\b/i
const INTERNAL_PROMPT_SCAFFOLD_PATTERN = /\[\s*(System Prompt|Memoria relevante|Contexto do RAG|Pergunta do usuario)\s*\]/i
const INTERNAL_OPERATIONAL_DUMP_PATTERN = /\b(estou em modo de contingencia operacional|pergunta recebida:|estado dos providers:)\b/i
const INTERNAL_REASONING_DUMP_PATTERN = /\b(score geral:\s*\d|intent detectada:|abordagem recomendada:)\b/i

function buildSanitizedLeakFallback(question = "", context = {}, deps = {}) {
  const {
    detectGreetingSignals,
    buildGreetingResponse,
    buildGospelCoreFallback,
    resolveDeterministicUploadResponseRuntime,
    deterministicUploadResponseDeps,
    resolveDeterministicBibleGuidanceResponse,
    isPromptCardPreferred,
    buildPromptCardResponse,
    isTableCardPreferred,
    buildTableCardResponse,
    resolveDeterministicWeatherResponse,
    runtimeIsWeatherCardPreferred,
    runtimeBuildWeatherCardResponse,
    runtimeBuildWeatherIntentFallback,
    resolveDeterministicFixtureResponse
  } = deps

  const greetingSignals = detectGreetingSignals(question)
  if (greetingSignals.isGreetingOnly) {
    return buildGreetingResponse(question, context)
  }

  const gospelFallback = buildGospelCoreFallback(question, context)
  if (gospelFallback) return gospelFallback

  const uploadResponseClean = resolveDeterministicUploadResponseRuntime(question, context, deterministicUploadResponseDeps)
  if (uploadResponseClean) return uploadResponseClean

  const bibleFallback = resolveDeterministicBibleGuidanceResponse(question, context)
  if (bibleFallback) return bibleFallback

  if (typeof isPromptCardPreferred === "function" && typeof buildPromptCardResponse === "function" && isPromptCardPreferred(context)) {
    const promptCard = buildPromptCardResponse("", question, context)
    if (promptCard) return promptCard
  }

  if (typeof isTableCardPreferred === "function" && typeof buildTableCardResponse === "function" && isTableCardPreferred(context)) {
    const tableCard = buildTableCardResponse("", question, context)
    if (tableCard) return tableCard
  }

  const deterministicWeatherResponse = resolveDeterministicWeatherResponse(question, context)
  if (deterministicWeatherResponse) {
    return deterministicWeatherResponse
  }

  if (runtimeIsWeatherCardPreferred(question, context)) {
    const weatherCard = runtimeBuildWeatherCardResponse(question, context)
    if (weatherCard) {
      return weatherCard
    }

    const weatherFallback = runtimeBuildWeatherIntentFallback(context)
    if (weatherFallback) {
      return weatherFallback
    }
  }

  const deterministicFixtureResponse = resolveDeterministicFixtureResponse(question, context)
  if (deterministicFixtureResponse) {
    return deterministicFixtureResponse
  }

  return "Nao consegui processar sua pergunta neste momento. Tente novamente em alguns instantes."
}

function hasInternalResponseLeak(text = "") {
  const source = String(text || "")
  return INTERNAL_CONTEXT_LEAK_PATTERN.test(source)
    || INTERNAL_PROMPT_SCAFFOLD_PATTERN.test(source)
    || INTERNAL_OPERATIONAL_DUMP_PATTERN.test(source)
    || INTERNAL_REASONING_DUMP_PATTERN.test(source)
}

export function postProcessAssistantResponseCore(question = "", responseText = "", context = {}, deps = {}) {
  const {
    detectGreetingSignals,
    buildGreetingResponse,
    shouldKeepIdentityPreamble,
    buildGospelCoreFallback,
    resolveDeterministicUploadResponseRuntime,
    deterministicUploadResponseDeps,
    resolveDeterministicBibleGuidanceResponse,
    isPromptCardPreferred,
    buildPromptCardResponse,
    isTableCardPreferred,
    buildTableCardResponse,
    resolveDeterministicWeatherResponse,
    runtimeIsWeatherCardPreferred,
    runtimeBuildWeatherCardResponse,
    runtimeBuildWeatherIntentFallback,
    resolveDeterministicFixtureResponse,
    isInterpretiveBibleQuestion,
    refineBibleInterpretiveResponse,
    buildGreetingLead
  } = deps

  let text = String(responseText || "").trim()
  if (!text) {
    return text
  }

  const explicitShortReply = resolveExplicitShortReply(question, deps)
  if (explicitShortReply) {
    return explicitShortReply
  }

  // Interceptar vazamento de dados internos de memoria/contexto ANTES de qualquer outro processamento
  if (hasInternalResponseLeak(text)) {
    return buildSanitizedLeakFallback(question, context, {
      detectGreetingSignals,
      buildGreetingResponse,
      buildGospelCoreFallback,
      resolveDeterministicUploadResponseRuntime,
      deterministicUploadResponseDeps,
      resolveDeterministicBibleGuidanceResponse,
      isPromptCardPreferred,
      buildPromptCardResponse,
      isTableCardPreferred,
      buildTableCardResponse,
      resolveDeterministicWeatherResponse,
      runtimeIsWeatherCardPreferred,
      runtimeBuildWeatherCardResponse,
      runtimeBuildWeatherIntentFallback,
      resolveDeterministicFixtureResponse
    })
  }

  if (isGenericUnknownResponse(text) && shouldUseMissingConversationContextFallback(question, context)) {
    return buildMissingConversationContextResponse(question)
  }

  const greetingSignals = detectGreetingSignals(question)
  if (greetingSignals.isGreetingOnly) {
    return buildGreetingResponse(question, context)
  }

  if (shouldKeepIdentityPreamble(question)) {
    return text
  }

  const gospelCoreFallback = buildGospelCoreFallback(question, context)
  if (gospelCoreFallback && /\b(com o contexto que eu tenho agora|ponto principal e este|se quiser, eu continuo a partir daqui)\b/i.test(text)) {
    return gospelCoreFallback
  }

  const deterministicUploadResponse = resolveDeterministicUploadResponseRuntime(question, context, deterministicUploadResponseDeps)
  if (
    deterministicUploadResponse
    && /\b(validacao da solucao|valida[cç][aã]o da solu[cç][aã]o|no estado atual desta execucao|limite operacional|com o contexto que eu tenho agora|ponto principal e este|topicos recentes|t[oó]picos recentes)\b/i.test(text)
  ) {
    return deterministicUploadResponse
  }

  const deterministicBibleGuidance = resolveDeterministicBibleGuidanceResponse(question, context)
  if (
    deterministicBibleGuidance
    && /\b(com o contexto que eu tenho agora|ponto principal e este|se quiser, eu continuo a partir daqui|topicos recentes|tópicos recentes|base local consultada)\b/i.test(text)
  ) {
    return deterministicBibleGuidance
  }

  if (typeof isPromptCardPreferred === "function" && typeof buildPromptCardResponse === "function" && isPromptCardPreferred(context)) {
    const promptCard = buildPromptCardResponse(text, question, context)
    if (promptCard) {
      return promptCard
    }
  }

  if (typeof isTableCardPreferred === "function" && typeof buildTableCardResponse === "function" && isTableCardPreferred(context)) {
    const tableCard = buildTableCardResponse(text, question, context)
    if (tableCard) {
      return tableCard
    }
  }

  const deterministicWeatherResponse = resolveDeterministicWeatherResponse(question, context)
  if (deterministicWeatherResponse) {
    return deterministicWeatherResponse
  }

  if (runtimeIsWeatherCardPreferred(question, context)) {
    const weatherCard = runtimeBuildWeatherCardResponse(question, context)
    if (weatherCard) {
      return weatherCard
    }

    if (/(nao tenho acesso|não tenho acesso|tempo real|pesquisa ao vivo|clima ao vivo|clima em tempo real)/i.test(text)) {
      return runtimeBuildWeatherIntentFallback(context)
    }
  }

  const deterministicFixtureResponse = resolveDeterministicFixtureResponse(question, context)
  if (deterministicFixtureResponse) {
    return deterministicFixtureResponse
  }

  if (context?.biblePassage?.content && isInterpretiveBibleQuestion(question)) {
    text = refineBibleInterpretiveResponse(question, text, context)
  }

  text = text
    .replace(/^(?:shalom[!,.:\s-]*)?(?:ol[aá][!,.:\s-]*)?(?:eu\s+sou|sou)\s+(?:o\s+)?giom(?:\s*,\s*|\s+)(?:um\s+assistente(?:\s+de\s+ia)?|assistente(?:\s+de\s+ia)?|uma\s+ia|uma\s+intelig[eê]ncia\s+artificial)?[!,.:\s-]*/i, "")
    .replace(/^(?:shalom|ol[aá])[!,.:\s-]+/i, "")
    .replace(/^(?:prazer|muito prazer)[!,.:\s-]*/i, "")
    .replace(/^[-:,\s]+/i, "")
    .trim()

  if (greetingSignals.hasGreeting && !/^(ol[aá]|oi|bom dia|boa tarde|boa noite|shalom)\b/i.test(text)) {
    text = `${buildGreetingLead(question, context)} ${text}`.trim()
  }

  if (shouldAppendKnowledgeSources(question, context, text)) {
    const sourcesFooter = buildKnowledgeSourcesFooter(context)
    if (sourcesFooter) {
      text = `${text}\n\n${sourcesFooter}`.trim()
    }
  }

  return text
}

export function buildOperationalContingencyResponseCore(question = "", context = {}, reason = "", deps = {}) {
  const {
    resolveDeterministicUploadResponseRuntime,
    deterministicUploadResponseDeps,
    resolveDeterministicBibleGuidanceResponse,
    resolveDeterministicWeatherResponse,
    resolveDeterministicFixtureResponse,
    runtimeIsWeatherQuestion,
    runtimeBuildWeatherIntentFallback,
    runtimeIsFixtureQuestion,
    buildFixtureIntentFallback,
    buildUnknownInformationResponse
  } = deps

  const deterministicUploadResponse = resolveDeterministicUploadResponseRuntime(question, context, deterministicUploadResponseDeps)
  if (deterministicUploadResponse) {
    return deterministicUploadResponse
  }

  const deterministicBibleGuidance = resolveDeterministicBibleGuidanceResponse(question, context)
  if (deterministicBibleGuidance) {
    return deterministicBibleGuidance
  }

  const deterministicWeatherResponse = resolveDeterministicWeatherResponse(question, context)
  if (deterministicWeatherResponse) {
    return deterministicWeatherResponse
  }

  const deterministicFixtureResponse = resolveDeterministicFixtureResponse(question, context)
  if (deterministicFixtureResponse) {
    return deterministicFixtureResponse
  }

  if (runtimeIsWeatherQuestion(question)) {
    return runtimeBuildWeatherIntentFallback(context)
  }

  if (runtimeIsFixtureQuestion(question, context)) {
    const fixtureFallback = buildFixtureIntentFallback(question, context)
    if (fixtureFallback) {
      return fixtureFallback
    }
  }

  return buildUnknownInformationResponse(question, context, {
    includeReason: Boolean(String(reason || "").trim()),
    offerRetry: true
  })
}

export function resolveSafetyChatPayloadCore(question, context = {}, deps = {}) {
  const {
    detectSafetyRisk,
    buildSafetyResponse
  } = deps

  const safety = detectSafetyRisk(question)
  if (!safety?.triggered && !safety?.advisory) {
    return null
  }

  return {
    safety,
    responseText: buildSafetyResponse(safety, {
      locale: context?.locale || context?.language || "pt-BR",
      promptText: question
    })
  }
}

export function isAgroWeatherRelevantCore(question = "", context = {}, deps = {}) {
  const { runtimeIsAgroWeatherRelevant } = deps
  const input = String(question || "")
  return runtimeIsAgroWeatherRelevant(input, context)
}

