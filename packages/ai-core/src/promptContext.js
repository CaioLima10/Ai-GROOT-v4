import { DEFAULT_ACTIVE_MODULES } from "../../shared-config/src/domainModules.js"
import { buildAssistantPrompt } from "./promptBuilder.js"
import { grootAdvancedRAG } from "./grootAdvancedRAG.js"
import { grootMemoryConnector } from "./grootMemoryConnector.js"

export async function buildAssistantPromptContext(task, context = {}, options = {}) {
  const userId = context.userId || "default_user"
  const requestedModules = Array.isArray(context.activeModules) ? context.activeModules.filter(Boolean) : []
  const requestedBibleStudyModules = Array.isArray(context.bibleStudyModules)
    ? context.bibleStudyModules.filter(Boolean)
    : []
  const limit = Number(options.limit || 6)

  const memoryContext = await grootMemoryConnector.getContextForPrompt(userId, {
    limit,
    activeModules: requestedModules,
    bibleStudyModules: requestedBibleStudyModules
  })

  const ragContext = await grootAdvancedRAG.enrichQueryAdvanced(task, {
    language: context.language || null,
    modules: requestedModules.length > 0
      ? requestedModules
      : (memoryContext.userProfile?.activeModules || DEFAULT_ACTIVE_MODULES),
    bibleStudyModules: requestedBibleStudyModules.length > 0
      ? requestedBibleStudyModules
      : (memoryContext.userProfile?.bibleStudyModules || []),
    limit
  })

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
