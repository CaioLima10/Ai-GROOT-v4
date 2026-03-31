// @ts-check

import { DEFAULT_ACTIVE_MODULES } from "../../shared-config/src/domainModules.js"
import { buildAssistantPrompt } from "./promptBuilder.js"
import { grootAdvancedRAG } from "./grootAdvancedRAG.js"
import { grootMemoryConnector } from "./grootMemoryConnector.js"

const PROTESTANT_TEXT_SIGNALS = [
  "protestant", "protestante", "reformada", "reformado", "reforma", "westminster",
  "assembleia de deus", "assembleia", "ad", "batista", "presbiter", "presbyter",
  "presibeter", "presibeteriana",
  "confissao de fe", "confissão de fé", "confession of faith", "catecismo", "catechism",
  "sola scriptura", "sola fide", "solus christus", "soli deo gloria", "apologetica", "apologética"
]

const PROTESTANT_SOURCE_SIGNALS = [
  "wikisource_protestant_texts",
  "protestant",
  "westminster",
  "reformed",
  "presbyter",
  "baptist",
  "assembleia de deus",
  "pentecostal"
]

function detectPromptDomains(task = "") {
  const text = String(task || "").toLowerCase()
  const domains = new Set()

  if ([
    "biblia", "bíblia", "bible", "westminster", "confession", "confissao", "confissão", "reformada",
    "teologia", "theology", "igreja", "church", "protestant", "catecismo", "catechism"
  ].some(signal => text.includes(signal))) {
    domains.add("theology")
  }

  if ([
    "hebraico", "hebrew", "grego", "greek", "aramaico", "aramaic", "lexico", "léxico", "koine"
  ].some(signal => text.includes(signal))) {
    domains.add("languages")
  }

  if ([
    "codigo", "código", "bug", "erro", "api", "sql", "react", "node", "typescript", "python", "deploy"
  ].some(signal => text.includes(signal))) {
    domains.add("developer")
  }

  return domains
}

function detectProtestantFocus(task = "") {
  const text = String(task || "").toLowerCase()
  return PROTESTANT_TEXT_SIGNALS.some(signal => text.includes(signal))
}

function getKnowledgeCategories(item = {}) {
  return new Set([
    String(item.category || "").toLowerCase(),
    ...(Array.isArray(item.categories) ? item.categories.map(category => String(category || "").toLowerCase()) : []),
    ...(Array.isArray(item.metadata?.categories) ? item.metadata.categories.map(category => String(category || "").toLowerCase()) : [])
  ].filter(Boolean))
}

function isProtestantKnowledge(item = {}, categories = getKnowledgeCategories(item)) {
  const hasProtestantCategory = Array.from(categories).some(category => [
    "theology_protestant",
    "creeds_confessions",
    "bible"
  ].includes(category))

  if (hasProtestantCategory) {
    return true
  }

  const textFields = [
    item.sourceId,
    item.source,
    item.sourceName,
    item.title,
    item.content,
    item.metadata?.source,
    item.metadata?.sourceId,
    item.metadata?.title
  ]
    .map(value => String(value || "").toLowerCase())
    .join(" ")

  return PROTESTANT_SOURCE_SIGNALS.some(signal => textFields.includes(signal))
}

function knowledgeMatchesPromptDomains(item, domains, options = {}) {
  const strictProtestant = Boolean(options.strictProtestant)
  if (!domains || domains.size === 0) return true

  const categories = getKnowledgeCategories(item)
  const hasTheology = Array.from(categories).some(category => [
    "bible", "tanakh", "theology", "theology_protestant", "church_history",
    "biblical_history", "biblical_archaeology", "judaism", "creeds_confessions"
  ].includes(category))
  const hasLanguages = Array.from(categories).some(category => [
    "languages", "hebrew", "aramaic", "greek", "biblical_hebrew"
  ].includes(category))
  const hasDeveloper = Array.from(categories).some(category => [
    "developer", "programming", "frameworks", "debugging", "database", "backend", "frontend", "code"
  ].includes(category))

  if (domains.has("developer")) return hasDeveloper
  if (domains.has("languages") && domains.has("theology")) return hasLanguages || hasTheology
  if (domains.has("languages")) return hasLanguages
  if (domains.has("theology")) {
    if (strictProtestant) {
      return (hasTheology || hasLanguages) && isProtestantKnowledge(item, categories)
    }
    return hasTheology || hasLanguages
  }

  return true
}

function filterRagContextForTask(task, ragContext = {}) {
  const domains = detectPromptDomains(task)
  const strictProtestant = detectProtestantFocus(task)
  const knowledge = Array.isArray(ragContext?.knowledge) ? ragContext.knowledge : []
  if (!knowledge.length || domains.size === 0) {
    return ragContext
  }

  const filteredKnowledge = knowledge.filter(item => knowledgeMatchesPromptDomains(item, domains, { strictProtestant }))
  const strictFallback = strictProtestant
    ? knowledge.filter(item => isProtestantKnowledge(item)).slice(0, 2)
    : []
  const effectiveKnowledge = filteredKnowledge.length > 0
    ? filteredKnowledge
    : (strictFallback.length > 0 ? strictFallback : knowledge.slice(0, 2))
  const knowledgeContext = effectiveKnowledge
    .map(item => `📚 ${item.category}: ${item.content} (Fonte: ${item.source})`)
    .join("\n\n")
  const bugsContext = Array.isArray(ragContext?.bugs) && domains.has("developer")
    ? ragContext.bugs
      .map(item => `🐛 ${item.language}: ${item.error_message}\n💡 Solução: ${item.solution}`)
      .join("\n\n")
    : ""

  return {
    ...ragContext,
    context: [knowledgeContext, bugsContext].filter(Boolean).join("\n\n"),
    knowledge: effectiveKnowledge,
    bugs: Array.isArray(ragContext?.bugs) && domains.has("developer") && !strictProtestant ? ragContext.bugs : []
  }
}

/** @typedef {import("./aiContracts").AssistantPromptContextOptions} AssistantPromptContextOptions */
/** @typedef {import("./aiContracts").AssistantPromptContextResult} AssistantPromptContextResult */
/** @typedef {import("./aiContracts").PromptBuilderMemoryContext} PromptBuilderMemoryContext */
/** @typedef {import("./aiContracts").PromptBuilderRagContext} PromptBuilderRagContext */
/** @typedef {import("./aiContracts").PromptBuilderRuntimeContext} PromptBuilderRuntimeContext */

/**
 * @param {string} task
 * @param {PromptBuilderRuntimeContext} [context]
 * @param {AssistantPromptContextOptions} [options]
 * @returns {Promise<AssistantPromptContextResult>}
 */
export async function buildAssistantPromptContext(task, context = {}, options = {}) {
  const userId = context.userId || "default_user"
  const requestedModules = Array.isArray(context.activeModules) ? context.activeModules.filter(Boolean) : []
  const requestedBibleStudyModules = Array.isArray(context.bibleStudyModules)
    ? context.bibleStudyModules.filter(Boolean)
    : []
  const limit = Number(options.limit || 6)

  /** @type {PromptBuilderMemoryContext} */
  const memoryContext = await grootMemoryConnector.getContextForPrompt(userId, {
    limit,
    activeModules: requestedModules,
    bibleStudyModules: requestedBibleStudyModules,
    conversationHistory: Array.isArray(context.conversationHistory) ? context.conversationHistory : []
  })

  /** @type {PromptBuilderRagContext} */
  const rawRagContext = await grootAdvancedRAG.enrichQueryAdvanced(task, {
    language: context.language || null,
    modules: requestedModules.length > 0
      ? requestedModules
      : (memoryContext.userProfile?.activeModules || DEFAULT_ACTIVE_MODULES),
    bibleStudyModules: requestedBibleStudyModules.length > 0
      ? requestedBibleStudyModules
      : (memoryContext.userProfile?.bibleStudyModules || []),
    limit
  })
  const ragContext = filterRagContextForTask(task, rawRagContext)

  return {
    requestedModules,
    requestedBibleStudyModules,
    memoryContext,
    ragContext,
    promptPackage: buildAssistantPrompt({
      task,
      context,
      memoryContext,
      ragContext,
      userStyle: options.userStyle || "natural"
    })
  }
}
