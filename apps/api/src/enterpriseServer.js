import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs/promises"
import crypto from "crypto"
import { createAskGiomLegacyAdapter, createAskGiomService } from "../../../backend/src/application/ask/askGiom.js"
import { buildRuntimeContext } from "../../../backend/src/application/context/buildRuntimeContext.js"
import { createMemoryContextMetricsCollector } from "../../../backend/src/application/monitoring/memoryContextMetrics.js"
import { createRuntimeSessionMemoryStore } from "../../../backend/src/infrastructure/memory/runtimeSessionMemoryStore.js"
import { createGrootMemoryRetrievalAdapter } from "../../../backend/src/infrastructure/memory/grootMemoryRetrievalAdapter.js"
import { createGrootEmbeddingsProviderAdapter } from "../../../backend/src/infrastructure/memory/grootEmbeddingsProviderAdapter.js"
import { createSemanticMemoryStore } from "../../../backend/src/infrastructure/memory/semanticMemoryStore.js"
import { createRedisMemoryClient } from "../../../backend/src/infrastructure/memory/redisMemoryClient.js"
import { buildPreparedAskPayloadFromHttp } from "../../../backend/src/interfaces/http/adapters/buildPreparedAskPayloadFromHttp.js"
import { createSaveConversationNonBlocking } from "../../../backend/src/application/conversation/saveConversationNonBlocking.js"
import { buildHealthSnapshot } from "../../../backend/src/application/monitoring/buildHealthSnapshot.js"
import { createRequireAdminMiddleware } from "../../../backend/src/interfaces/http/middlewares/requireAdmin.js"
import { evaluateResponse } from "../../../backend/src/application/evaluation/evaluateResponse.js"
import { processEvaluation } from "../../../backend/src/application/evaluation/improvementLoop.js"
import { selfHealResponse } from "../../../backend/src/application/selfHealing/selfHealResponse.js"
import { askGroot } from "../../../core/aiBrain.js"
import { aiGateway } from "../../../core/enterprise/AIGateway.js"
import { streamingGateway } from "../../../core/enterprise/StreamingAIGateway.js"
import { aiProviders } from "../../../core/aiProviders.js"
import {
  AI_ENTERPRISE_NAME,
  AI_KNOWLEDGE_SERVICE_SLUG,
  AI_MODEL_OWNER,
  AI_SERVICE_SLUG,
  getResearchCapabilities,
  listAssistantProfiles,
  listBibleStudyModules,
  listCapabilityHighlights,
  listCompatModels,
  listDomainModules,
  listEvaluationDimensions,
  listEvaluationPacks,
  listModuleEnhancementPlans,
  listPlannedModules,
  listPromptPacks,
  parseBibleReference,
  resolveCompatModel
} from "../../../packages/shared-config/src/index.js"
import {
  getAskContextDiagnostics,
  sanitizeAskContext
} from "../../../packages/shared-config/src/runtimeContracts.js"
import {
  buildAssistantPromptContext,
  generateStructuredDocument,
  evaluateConversationTurn,
  giomOrchestrator,
  grootAdvancedRAG,
  grootEmbeddings,
  grootMemoryConnector,
  listDocumentFormats,
  normalizeDocumentFormat,
  runConversationBenchmark
} from "../../../packages/ai-core/src/index.js"
import { fetchBiblePassage } from "../../../core/bibleApi.js"
import { buildSafetyResponse, detectSafetyRisk } from "../../../core/safetyGuard.js"
import {
  buildGreetingLead,
  buildGreetingResponse,
  detectGreetingSignals
} from "../../../core/greetingBehavior.js"
import {
  getLiveResearchRuntime,
  hasGoogleCustomSearchConfigured,
  performGoogleCustomSearch,
  resolveApproximateLocationByIp,
  resolveNextFixtureFromQuestion,
  summarizeGoogleSearchResults
} from "./liveResearch.js"
import {
  createSportsDataIoFetch,
  listSportsDataIoEndpoints,
  resolveSportsDataIoEndpoint
} from "./sportsDataIoRuntime.js"
import {
  isFixtureCardPreferred as runtimeIsFixtureCardPreferred,
  isFixtureQuestion as runtimeIsFixtureQuestion,
  isSportsScheduleRelevant as runtimeIsSportsScheduleRelevant,
  shouldInjectGoogleLiveSearch as runtimeShouldInjectGoogleLiveSearch
} from "./liveResearchIntents.js"
import {
  buildClockVerificationMeta,
  getVerifiedRuntimeClock
} from "./runtimeClock.js"
import { buildRuntimeConversationContext as buildRuntimeConversationContextCore } from "./runtimeConversationContext.js"
import {
  buildWeatherCardResponse as runtimeBuildWeatherCardResponse,
  buildWeatherClientMetadata as runtimeBuildWeatherClientMetadata,
  buildWeatherConversationLocationMetadata as runtimeBuildWeatherConversationLocationMetadata,
  buildWeatherIntentFallback as runtimeBuildWeatherIntentFallback,
  buildWeatherSnapshot as runtimeBuildWeatherSnapshot,
  extractWeatherLocationQuery as runtimeExtractWeatherLocationQuery,
  fetchWeatherForecastPayload as runtimeFetchWeatherForecastPayload,
  inferWeatherForecastDays as runtimeInferWeatherForecastDays,
  isAgroWeatherRelevant as runtimeIsAgroWeatherRelevant,
  isWeatherCardPreferred as runtimeIsWeatherCardPreferred,
  isWeatherQuestion as runtimeIsWeatherQuestion,
  resolveRecentWeatherLocationFromMemory as runtimeResolveRecentWeatherLocationFromMemory,
  shouldPreferRecentWeatherMemory as runtimeShouldPreferRecentWeatherMemory,
  resolveWeatherLocationByQuery as runtimeResolveWeatherLocationByQuery,
  resolveWeatherLocationContext as runtimeResolveWeatherLocationContext
} from "./weatherRuntime.js"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import slowDown from "express-slow-down"
import hpp from "hpp"
import compression from "compression"
import {
  IMAGE_RATIO_DIMENSIONS,
  IMAGE_STYLE_PRESETS,
  SUPPORTED_UPLOAD_ACCEPT,
  UPLOAD_DIR,
  buildImageStylePresetPrompt,
  getImageGenerationToken,
  getUploadCapabilities,
  imageGenerationMaxDimension,
  imageGenerationMinDimension,
  imageGenerationModel,
  isImageGenerationEnabled,
  parseImageGenerationRequest,
  uploadMaxBytes,
  uploadOcrEnabled,
  uploads,
  uploadTtlMinutes
} from "./enterpriseAssetsRuntime.js"
import { configureEnterpriseSecurity } from "./enterpriseSecurityRuntime.js"
import {
  buildUploadExtractionBlock,
  detectMimeFromMagic,
  ensureUploadDir,
  finalizeTextExtraction,
  isAllowedUploadByAccept,
  isMimeCompatibleWithExtension,
  normalizeUploadMime,
  parseBase64Payload,
  safeFilename,
  scheduleUploadCleanup
} from "./enterpriseUploadsRuntime.js"
import {
  consumeImageQuota,
  consumeUploadQuota,
  getImageQuotaStatus,
  getUploadQuotaStatus,
  resolveImageQuotaContext,
  resolveUploadQuotaContext
} from "./enterpriseUploadQuotaRuntime.js"
import { resolveDeterministicUploadResponse as resolveDeterministicUploadResponseRuntime } from "./enterpriseUploadResponsesRuntime.js"
import {
  decodeXmlEntities,
  dedupeParagraphs,
  normalizeTextForDeduplication
} from "./enterpriseTextRuntime.js"
import {
  buildFixtureCardResponse,
  buildFixtureIntentFallback,
  buildPromptCardResponse,
  isPromptCardPreferred,
  normalizeAnswerText,
  shouldKeepIdentityPreamble
} from "./enterpriseResponseCardsRuntime.js"
import {
  buildQuestionFromGeminiContents,
  buildQuestionFromMessages,
  estimateUsage,
  flattenMessageContent
} from "./enterpriseRequestRuntime.js"
import {
  buildGospelCoreFallback,
  extractBibleConversationPreferencesFromHistory,
  extractRecentBibleContextFromHistory,
  inferMinistryFocusFromText,
  isBibleFollowUpQuestion,
  isInterpretiveBibleQuestion,
  mergeRuntimeInstructions,
  refineBibleInterpretiveResponse,
  resolveDeterministicBibleGuidanceResponse,
  resolveDeterministicBiblePassageResponse
} from "./enterpriseBibleRuntime.js"
import {
  buildDocumentDraftPrompt,
  sanitizeDocumentTitle
} from "./enterpriseDocumentRuntime.js"
import { buildRuntimeCapabilityMatrix } from "./enterpriseCapabilityRuntime.js"
import { writeSSE } from "./enterpriseSSERuntime.js"
import {
  buildOperationalContingencyResponseCore,
  buildUnknownInformationResponseCore,
  getCompatContext,
  isAgroWeatherRelevantCore,
  postProcessAssistantResponseCore,
  requiresVerifiedFreshDataCore,
  resolveDeterministicFixtureResponseCore,
  resolveDeterministicWeatherResponseCore,
  resolveSafetyChatPayloadCore
} from "./enterpriseResponseProcessingRuntime.js"
import { sanitizeWeatherLocationQuery } from "./weatherGeocoding.js"
import { resolveUploadExtraction } from "./enterpriseUploadExtractionRuntime.js"
import {
  buildLanguageClientMetadata,
  cleanupLanguageRuntimeCache,
  enrichLanguageRuntimeContext,
  getLanguageRuntimeStatus
} from "./languageRuntime.js"

/** @typedef {import("../../../packages/ai-core/src/aiContracts").EnhancedRuntimeConversationContext} EnhancedRuntimeConversationContext */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").LiveWeatherClientMetadata} LiveWeatherClientMetadata */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").LiveWeatherSnapshot} LiveWeatherSnapshot */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").RuntimeClock} RuntimeClock */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").WeatherForecastProviderPayload} WeatherForecastProviderPayload */
/** @typedef {import("../../../packages/ai-core/src/aiContracts").WeatherLocationResolution} WeatherLocationResolution */

dotenv.config()

const app = express()
const fetchSportsDataIo = createSportsDataIoFetch()
app.disable("x-powered-by")
app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false)

const { askLimiter, askSlowDown } = configureEnterpriseSecurity(app, {
  cors,
  hpp,
  compression,
  helmet,
  rateLimit,
  slowDown,
  express
})

// Corrige __dirname no ESModules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const documentGenerationFormats = listDocumentFormats()
const documentGenerationFormatIds = documentGenerationFormats.map((entry) => entry.format)
const orchestratorShadowEnabled = process.env.GIOM_ORCHESTRATOR_SHADOW !== "false"
const deterministicUploadResponseDeps = {
  decodeXmlEntities,
  dedupeParagraphs,
  normalizeTextForDeduplication,
  isWeatherQuestion: runtimeIsWeatherQuestion,
  isFixtureQuestion: runtimeIsFixtureQuestion
}

const responseProcessingDeps = {
  runtimeIsFixtureCardPreferred,
  buildFixtureCardResponse,
  buildFixtureIntentFallback,
  runtimeIsWeatherCardPreferred,
  runtimeBuildWeatherCardResponse,
  runtimeBuildWeatherIntentFallback,
  runtimeIsWeatherQuestion,
  runtimeIsFixtureQuestion,
  detectGreetingSignals,
  buildGreetingResponse,
  shouldKeepIdentityPreamble,
  buildGospelCoreFallback,
  resolveDeterministicUploadResponseRuntime,
  deterministicUploadResponseDeps,
  resolveDeterministicBibleGuidanceResponse,
  isPromptCardPreferred,
  buildPromptCardResponse,
  isInterpretiveBibleQuestion,
  refineBibleInterpretiveResponse,
  buildGreetingLead,
  detectSafetyRisk,
  buildSafetyResponse,
  runtimeIsAgroWeatherRelevant
}

async function generateImageWithProvider(prompt, options = {}) {
  const token = getImageGenerationToken()
  if (!token) {
    const error = new Error("Geração de imagens não configurada. Defina HUGGINGFACE_API_KEY no ambiente.")
    error.statusCode = 503
    error.code = "IMAGE_GENERATION_DISABLED"
    throw error
  }

  const { HfInference } = await import("@huggingface/inference")
  const client = new HfInference(token)
  const parameters = {
    negative_prompt: options.negativePrompt || "blurry, deformed, low quality, watermark, unreadable text",
    width: options.width,
    height: options.height,
    guidance_scale: options.guidanceScale,
    num_inference_steps: options.numInferenceSteps,
    seed: options.seed
  }

  Object.keys(parameters).forEach((key) => {
    if (parameters[key] == null || parameters[key] === "") {
      delete parameters[key]
    }
  })

  const image = await client.textToImage({
    model: imageGenerationModel,
    inputs: prompt,
    parameters
  })

  const mimeType = image?.type || "image/png"
  const buffer = Buffer.from(await image.arrayBuffer())

  return {
    mimeType,
    base64: buffer.toString("base64"),
    model: imageGenerationModel,
    provider: "huggingface",
    controls: {
      stylePreset: options.stylePreset || null,
      aspectRatio: options.aspectRatio || null,
      width: options.width || null,
      height: options.height || null,
      negativePrompt: options.negativePrompt || null,
      guidanceScale: options.guidanceScale || null,
      numInferenceSteps: options.numInferenceSteps || null,
      seed: options.seed ?? null
    }
  }
}

function resolveDeterministicFixtureResponse(question = "", context = {}) {
  return resolveDeterministicFixtureResponseCore(question, context, responseProcessingDeps)
}

function resolveDeterministicWeatherResponse(question = "", context = {}) {
  return resolveDeterministicWeatherResponseCore(question, context, responseProcessingDeps)
}

function requiresVerifiedFreshData(question = "", context = {}) {
  return requiresVerifiedFreshDataCore(question, context, responseProcessingDeps)
}

function buildUnknownInformationResponse(question = "", context = {}, options = {}) {
  return buildUnknownInformationResponseCore(question, context, options, {
    ...responseProcessingDeps,
    requiresVerifiedFreshData
  })
}

function postProcessAssistantResponse(question = "", responseText = "", context = {}) {
  return postProcessAssistantResponseCore(question, responseText, context, {
    ...responseProcessingDeps,
    resolveDeterministicWeatherResponse,
    resolveDeterministicFixtureResponse
  })
}

function buildOperationalContingencyResponse(question = "", context = {}, reason = "") {
  return buildOperationalContingencyResponseCore(question, context, reason, {
    ...responseProcessingDeps,
    resolveDeterministicWeatherResponse,
    resolveDeterministicFixtureResponse,
    buildUnknownInformationResponse
  })
}

function resolveSafetyChatPayload(question, context = {}) {
  return resolveSafetyChatPayloadCore(question, context, responseProcessingDeps)
}

const askGiomService = createAskGiomService({
  ports: {
    deterministicUpload: {
      resolve: (question, context) => resolveDeterministicUploadResponseRuntime(
        question,
        context,
        deterministicUploadResponseDeps
      )
    },
    greeting: {
      detect: detectGreetingSignals,
      build: buildGreetingResponse
    },
    safety: {
      resolve: resolveSafetyChatPayload
    },
    bible: {
      passages: {
        resolve: resolveDeterministicBiblePassageResponse
      },
      guidance: {
        resolve: resolveDeterministicBibleGuidanceResponse
      }
    },
    weather: {
      resolve: resolveDeterministicWeatherResponse
    },
    fixture: {
      resolve: resolveDeterministicFixtureResponse
    },
    aiProvider: {
      ask: async (question, context) => {
        try {
          const providerContext = await buildAskProviderContext(question, context)
          const answer = await askGroot(providerContext.finalPrompt, {
            ...context,
            ...providerContext.contextEnhancements
          })

          if (answer && typeof answer === "object") {
            return {
              ...answer,
              contextEnhancements: providerContext.contextEnhancements
            }
          }

          return {
            success: true,
            response: String(answer || ""),
            contextEnhancements: providerContext.contextEnhancements
          }
        } catch (_error) {
          return askGroot(question, context)
        }
      }
    },
    response: {
      normalize: normalizeAnswerText,
      postProcess: postProcessAssistantResponse,
      contingency: buildOperationalContingencyResponse
    }
  },
  logger: aiGateway.logger,
  evaluation: {
    enabled: String(process.env.GIOM_EVAL_ENABLED || "true").toLowerCase() !== "false",
    selfHealingEnabled: String(process.env.GIOM_SELF_HEAL_ENABLED || "true").toLowerCase() !== "false",
    selfHealingThreshold: Number(process.env.GIOM_SELF_HEAL_THRESHOLD || 0.6),
    selfHealingTimeoutMs: Number(process.env.GIOM_SELF_HEAL_TIMEOUT_MS || 3500)
  }
})

const askGiom = createAskGiomLegacyAdapter(askGiomService)

const runtimeSessionMemoryStore = createRuntimeSessionMemoryStore({
  ttlMs: Number(process.env.MEMORY_STM_TTL_MS || 30 * 60 * 1000),
  maxTurnsPerSession: Number(process.env.MEMORY_STM_MAX_TURNS || 24)
})

const distributedMemoryClient = await createRedisMemoryClient({
  logger: aiGateway.logger,
  redisUrl: process.env.REDIS_URL,
  clusterUrls: process.env.REDIS_CLUSTER_URLS,
  prefix: process.env.MEMORY_REDIS_PREFIX || "ai-groot:memory"
})

const memoryMetricsNodeId = String(
  process.env.MEMORY_METRICS_NODE_ID ||
  process.env.HOSTNAME ||
  `node_${process.pid}`
)

const embeddingProvider = createGrootEmbeddingsProviderAdapter({
  embeddings: grootEmbeddings,
  distributedCache: distributedMemoryClient,
  cacheTtlMs: Number(process.env.MEMORY_EMBEDDING_CACHE_TTL_MS || 10 * 60 * 1000),
  cacheMaxEntries: Number(process.env.MEMORY_EMBEDDING_CACHE_MAX_ITEMS || 5000)
})

const semanticMemoryStore = createSemanticMemoryStore({
  embeddingProvider,
  distributedClient: distributedMemoryClient,
  ttlMs: Number(process.env.MEMORY_SEMANTIC_TTL_MS || 3 * 24 * 60 * 60 * 1000),
  maxItemsPerBucket: Number(process.env.MEMORY_SEMANTIC_MAX_ITEMS || 5000)
})

const retrievalPort = createGrootMemoryRetrievalAdapter({
  connector: grootMemoryConnector,
  embeddingProvider,
  semanticStore: semanticMemoryStore,
  distributedCache: distributedMemoryClient,
  distributedCacheTtlMs: Number(process.env.MEMORY_RETRIEVAL_DISTRIBUTED_TTL_MS || 60_000),
  distributedLockTtlMs: Number(process.env.MEMORY_RETRIEVAL_LOCK_TTL_MS || 6_000),
  distributedLockTimeoutMs: Number(process.env.MEMORY_RETRIEVAL_LOCK_TIMEOUT_MS || 2_500),
  distributedLockRetryIntervalMs: Number(process.env.MEMORY_RETRIEVAL_LOCK_RETRY_MS || 35),
  distributedCacheReadWaitMs: Number(process.env.MEMORY_RETRIEVAL_LOCK_CACHE_WAIT_MS || 1_500)
})

const memoryContextMetrics = createMemoryContextMetricsCollector({
  maxSamples: Number(process.env.MEMORY_METRICS_MAX_SAMPLES || 5000),
  nodeId: memoryMetricsNodeId,
  distributedClient: distributedMemoryClient,
  slos: {
    retrievalP95BudgetMs: Number(process.env.MEMORY_SLO_RETRIEVAL_P95_MS || 250),
    totalP95BudgetMs: Number(process.env.MEMORY_SLO_TOTAL_P95_MS || 900),
    totalP99MaxBudgetMs: Number(process.env.MEMORY_SLO_TOTAL_P99_MS || 1800)
  }
})

function appendConversationToStm(userId, sessionId, question, responseText) {
  const createdAt = new Date().toISOString()

  runtimeSessionMemoryStore.appendTurn({
    userId,
    sessionId,
    role: "user",
    content: question,
    created_at: createdAt
  })
  runtimeSessionMemoryStore.appendTurn({
    userId,
    sessionId,
    role: "assistant",
    content: responseText,
    created_at: createdAt
  })

  void semanticMemoryStore
    .addConversationPair({
      userId,
      sessionId,
      userText: question,
      assistantText: responseText,
      createdAt
    })
    .catch((error) => {
      aiGateway.logger.warn("semantic_memory_append", {
        userId,
        sessionId,
        error: error?.message || "append_failed"
      })
    })
}

function shouldPersistLearnedConversation(giomResult = null) {
  return giomResult?.learning?.shouldPersistMemory !== false
}

async function persistEvaluationArtifacts(userId, requestId, evaluation, metadata = {}) {
  await grootMemoryConnector.saveEvaluation(userId, requestId, evaluation)
  await grootMemoryConnector.saveLearningPattern(
    userId,
    "conversation_eval",
    {
      requestId,
      score: evaluation.score,
      status: evaluation.status,
      issues: evaluation.issues,
      dimensions: evaluation.dimensions,
      metadata
    },
    evaluation.score
  )
}

const saveConversationNonBlocking = createSaveConversationNonBlocking({
  connector: grootMemoryConnector,
  logger: aiGateway.logger
})

function isAgroWeatherRelevant(question = "", context = {}) {
  return isAgroWeatherRelevantCore(question, context, responseProcessingDeps)
}

const runtimeConversationContextDeps = {
  buildRuntimeCapabilityMatrix,
  getResearchCapabilities,
  inferWeatherForecastDays: runtimeInferWeatherForecastDays,
  extractWeatherLocationQuery: runtimeExtractWeatherLocationQuery,
  isAgroWeatherRelevant: runtimeIsAgroWeatherRelevant,
  resolveWeatherLocationByQuery: runtimeResolveWeatherLocationByQuery,
  isWeatherQuestion: runtimeIsWeatherQuestion,
  shouldPreferRecentWeatherMemory: runtimeShouldPreferRecentWeatherMemory,
  resolveRecentWeatherLocationFromMemory: runtimeResolveRecentWeatherLocationFromMemory,
  resolveWeatherLocationContext: runtimeResolveWeatherLocationContext,
  resolveApproximateLocationByIp,
  getVerifiedRuntimeClock,
  fetchWeatherForecastPayload: runtimeFetchWeatherForecastPayload,
  buildWeatherSnapshot: runtimeBuildWeatherSnapshot,
  buildClockVerificationMeta,
  isSportsScheduleRelevant: runtimeIsSportsScheduleRelevant,
  resolveNextFixtureFromQuestion,
  shouldInjectGoogleLiveSearch: (question = "", context = {}) => runtimeShouldInjectGoogleLiveSearch(
    question,
    context,
    { googleSearchConfigured: hasGoogleCustomSearchConfigured() }
  ),
  performGoogleCustomSearch,
  summarizeGoogleSearchResults,
  parseBibleReference,
  isBibleFollowUpQuestion,
  extractRecentBibleContextFromHistory,
  inferMinistryFocusFromText,
  extractBibleConversationPreferencesFromHistory,
  fetchBiblePassage,
  mergeRuntimeInstructions,
  enrichLanguageRuntimeContext
}

/**
 * @param {string} [question]
 * @param {import("../../../packages/ai-core/src/aiContracts").PromptBuilderRuntimeContext} [context]
 * @param {Record<string, unknown>} [extras]
 * @returns {Promise<EnhancedRuntimeConversationContext>}
 */
async function buildRuntimeConversationContext(question = "", context = {}, extras = {}) {
  return buildRuntimeConversationContextCore(question, context, extras, runtimeConversationContextDeps)
}

function buildLanguageRuntimeMetadata(enhancedContext = {}) {
  return buildLanguageClientMetadata(enhancedContext?.languageRuntime || null)
}

async function buildStreamingPromptPackage(question, context = {}) {
  return buildAssistantPromptContext(question, context, {
    limit: 6,
    userStyle: "natural"
  })
}

async function buildAskProviderContext(question, context = {}) {
  const plan = await giomOrchestrator.buildResponsePlan(question, {
    ...context,
    userStyle: context.userStyle || "natural"
  })

  const ragSources = Array.isArray(plan?.ragContext?.knowledge)
    ? plan.ragContext.knowledge.slice(0, 4).map((item) => ({
      title: item.title || item.sourceName || item.sourceId || item.category || null,
      source: item.source || null,
      sourceId: item.sourceId || null,
      category: item.category || null,
      rankingScore: item.rankingScore || item.similarity || null
    }))
    : []

  return {
    finalPrompt: plan?.finalPrompt || question,
    contextEnhancements: {
      promptPackage: plan?.promptPackage || null,
      memoryContext: plan?.memoryContext || null,
      ragContext: plan?.ragContext || null,
      ragSources
    }
  }
}

async function buildShadowOrchestratorPlan(question, context = {}) {
  if (!orchestratorShadowEnabled) return null

  try {
    const planPromise = giomOrchestrator.buildResponsePlan(question, {
      ...context,
      userStyle: context.userStyle || "natural"
    })

    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          error: true,
          message: "orchestrator_shadow_timeout"
        })
      }, 250)
    })

    return await Promise.race([planPromise, timeoutPromise])
  } catch (error) {
    return {
      error: true,
      message: error?.message || "orchestrator_shadow_failed"
    }
  }
}

// Frontend legado removido do runtime oficial para evitar rotas ambíguas.
// O frontend suportado é exclusivamente o app Next.js em apps/web-next.

// Root health/info route
app.get("/", (_req, res) => {
  res.json({
    name: AI_ENTERPRISE_NAME,
    status: "ok",
    version: process.env.npm_package_version ?? "1.0.0",
    endpoints: ["/health", "/ask", "/config", "/capabilities", "/v1/models"],
  })
})

// Config público para o frontend (somente chaves seguras)
app.get("/config", async (req, res) => {
  const knowledgeStats = await grootAdvancedRAG.getAdvancedStats()
  const capabilityMatrix = buildRuntimeCapabilityMatrix()
  const runtimeResearchCapabilities = getResearchCapabilities()
  const liveResearchRuntime = getLiveResearchRuntime()
  const liveWebEnabled = Boolean(
    runtimeResearchCapabilities.liveWeb ||
    runtimeResearchCapabilities.google ||
    runtimeResearchCapabilities.bing ||
    runtimeResearchCapabilities.yahoo ||
    runtimeResearchCapabilities.scholar ||
    runtimeResearchCapabilities.news ||
    runtimeResearchCapabilities.codeSearch ||
    runtimeResearchCapabilities.browserAutomation ||
    liveResearchRuntime.googleSearch
  )

  res.json({
    service: AI_SERVICE_SLUG,
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    adminProtected: !!process.env.ADMIN_DASH_KEY,
    features: {
      auth: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
      localModels: process.env.OLLAMA_ENABLED === "true",
      futureOpenAIReady: true,
      streaming: true,
      pdfParsing: true,
      officeSuiteBasic: true,
      docxParsing: true,
      spreadsheetParsing: true,
      presentationParsing: true,
      imageOcr: uploadOcrEnabled,
      imageGeneration: isImageGenerationEnabled(),
      documentGeneration: true,
      serverPdfGeneration: true,
      weatherForecast: Boolean(runtimeResearchCapabilities.weatherForecast),
      sportsSchedule: Boolean(runtimeResearchCapabilities.sportsSchedule || liveResearchRuntime.sportsSchedule),
      googleSearch: Boolean(liveResearchRuntime.googleSearch),
      googleImageSearch: Boolean(liveResearchRuntime.googleImageSearch)
    },
    ai: {
      providerMode: process.env.GROOT_AI_PROVIDER || "auto",
      modelTier: process.env.GROOT_MODEL_TIER || "balanced",
      providers: aiProviders.getProviderSummary(),
      embeddings: grootEmbeddings.getStatus(),
      assistantProfiles: listAssistantProfiles(),
      domainModules: listDomainModules(),
      moduleEnhancements: listModuleEnhancementPlans(),
      plannedModules: listPlannedModules(),
      bibleStudyModules: listBibleStudyModules(),
      compatModels: listCompatModels(),
      promptPacks: listPromptPacks(),
      imageGeneration: {
        enabled: isImageGenerationEnabled(),
        provider: isImageGenerationEnabled() ? "huggingface" : "disabled",
        model: imageGenerationModel,
        stylePresets: Object.keys(IMAGE_STYLE_PRESETS),
        aspectRatios: Object.keys(IMAGE_RATIO_DIMENSIONS),
        minDimension: imageGenerationMinDimension,
        maxDimension: imageGenerationMaxDimension
      },
      documentGeneration: {
        enabled: true,
        formats: documentGenerationFormats
      }
    },
    research: runtimeResearchCapabilities,
    liveResearch: liveResearchRuntime,
    privacy: {
      sensitiveDataRedaction: true,
      sensitiveLearningBlocked: true,
      temporaryUploadStorage: true,
      uploadTtlMinutes,
      piiEchoProtection: true
    },
    safety: {
      explicitSexualContentBlocked: true,
      crimesBlocked: true,
      cyberAbuseBlocked: true,
      selfHarmSupport: true,
      violenceBlocked: true,
      terrorismBlocked: true,
      youthHarmInfluenceBlocked: true,
      preventionAndModerationGuidanceAllowed: true
    },
    evaluation: {
      dimensions: listEvaluationDimensions(),
      packs: listEvaluationPacks(),
      note: "Consciencia operacional mede autodescricao correta de capacidades e limites, nao sentiencia real."
    },
    knowledge: {
      statusEndpoint: "/knowledge/status",
      localKnowledge: knowledgeStats.localKnowledge,
      localBugs: knowledgeStats.localBugs,
      remoteEnabled: knowledgeStats.remoteEnabled
    },
    capabilities: listCapabilityHighlights({
      uploadAccept: SUPPORTED_UPLOAD_ACCEPT,
      ocrEnabled: uploadOcrEnabled,
      docxEnabled: true,
      xlsxEnabled: true,
      pptxEnabled: true,
      imageGenerationEnabled: isImageGenerationEnabled(),
      imageGenerationProvider: isImageGenerationEnabled() ? "huggingface" : "disabled",
      imageControlsEnabled: true,
      visualImageUnderstanding: uploadOcrEnabled,
      imageEditingEnabled: false,
      liveWebEnabled,
      weatherForecastEnabled: Boolean(runtimeResearchCapabilities.weatherForecast),
      browserPdfExport: true,
      privacyRedaction: true,
      sensitiveLearningBlocked: true,
      temporaryUploads: true
    }),
    uploads: {
      enabled: true,
      maxBytes: uploadMaxBytes,
      ttlMinutes: uploadTtlMinutes,
      ...getUploadCapabilities()
    },
    capabilityMatrix,
    documentFormats: documentGenerationFormats
  })
})

app.get("/capabilities", (_req, res) => {
  res.json(buildRuntimeCapabilityMatrix())
})

app.get("/research/weather", askLimiter, async (req, res) => {
  const runtimeResearchCapabilities = getResearchCapabilities()
  if (!runtimeResearchCapabilities.weatherForecast) {
    return res.status(503).json({
      error: "Consulta de clima ao vivo nao habilitada nesta execucao.",
      code: "WEATHER_FORECAST_DISABLED"
    })
  }

  const latitude = Number(req.query.latitude ?? req.query.lat)
  const longitude = Number(req.query.longitude ?? req.query.lon)
  const timezone = String(req.query.timezone || "auto")
  const forecastDays = Math.max(1, Math.min(Number(req.query.days || 7) || 7, 7))
  const cityQuery = sanitizeWeatherLocationQuery(String(req.query.city || req.query.name || req.query.q || ""))
  let resolvedLocation = null

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    resolvedLocation = {
      latitude,
      longitude,
      timezone,
      forecastDays
    }
  } else if (cityQuery) {
    try {
      resolvedLocation = await runtimeResolveWeatherLocationByQuery(cityQuery, forecastDays, { question: cityQuery })
      if (!resolvedLocation) {
        return res.status(404).json({
          error: `Nao encontrei a localidade ${cityQuery}.`,
          code: "WEATHER_LOCATION_NOT_FOUND"
        })
      }
    } catch (error) {
      return res.status(502).json({
        error: error.message || "Falha ao localizar a cidade informada.",
        code: error.code || "WEATHER_GEOCODING_FAILED",
        details: process.env.NODE_ENV === "development" ? (error.details || error.message) : undefined
      })
    }
  } else {
    return res.status(400).json({
      error: "Informe latitude/longitude validas ou uma cidade para consultar a previsao.",
      code: "WEATHER_COORDINATES_REQUIRED"
    })
  }

  try {
    const weatherClock = await getVerifiedRuntimeClock(resolvedLocation.timezone || timezone || "Etc/UTC")
    const payload = await runtimeFetchWeatherForecastPayload(resolvedLocation)
    return res.json({
      success: true,
      provider: "open-meteo",
      coordinates: {
        latitude: resolvedLocation.latitude,
        longitude: resolvedLocation.longitude
      },
      forecastDays,
      timezone: resolvedLocation.timezone || timezone,
      location: {
        label: resolvedLocation.label || null,
        city: resolvedLocation.city || null,
        region: resolvedLocation.region || null,
        country: resolvedLocation.country || null,
        countryCode: resolvedLocation.countryCode || null,
        locationType: resolvedLocation.locationType || null,
        sourceType: resolvedLocation.sourceType || null
      },
      data: runtimeBuildWeatherSnapshot(payload, resolvedLocation, weatherClock)
    })
  } catch (error) {
    return res.status(error.code === "WEATHER_PROVIDER_FAILED" ? 502 : 500).json({
      error: error.message || "Falha ao obter previsao do tempo.",
      code: error.code || "WEATHER_LOOKUP_FAILED",
      details: process.env.NODE_ENV === "development" ? (error.details || error.message) : undefined
    })
  }
})

app.get("/research/search", askLimiter, async (req, res) => {
  const runtimeResearchCapabilities = getResearchCapabilities()
  if (!runtimeResearchCapabilities.google || !hasGoogleCustomSearchConfigured()) {
    return res.status(503).json({
      error: "Pesquisa Google ao vivo nao habilitada nesta execucao.",
      code: "GOOGLE_SEARCH_DISABLED"
    })
  }

  const query = String(req.query.q || req.query.query || "").trim()
  const searchType = String(req.query.type || req.query.searchType || "").trim().toLowerCase() === "image"
    ? "image"
    : "web"
  const num = Math.max(1, Math.min(Number(req.query.num || 5) || 5, 10))

  if (!query) {
    return res.status(400).json({
      error: "Informe um termo de busca em q ou query.",
      code: "SEARCH_QUERY_REQUIRED"
    })
  }

  try {
    const payload = await performGoogleCustomSearch(query, {
      num,
      searchType,
      hl: String(req.query.hl || "pt-BR"),
      gl: String(req.query.gl || "br")
    })

    return res.json({
      success: true,
      provider: payload.provider,
      searchType: payload.searchType,
      items: payload.items
    })
  } catch (error) {
    return res.status(502).json({
      error: error.message || "Falha ao consultar pesquisa Google.",
      code: error.code || "GOOGLE_SEARCH_FAILED",
      details: process.env.NODE_ENV === "development" ? error.details || null : undefined
    })
  }
})

app.get("/research/sports", askLimiter, async (req, res) => {
  const runtimeResearchCapabilities = getResearchCapabilities()
  if (!runtimeResearchCapabilities.sportsSchedule) {
    return res.status(503).json({
      error: "Consulta esportiva ao vivo nao habilitada nesta execucao.",
      code: "SPORTS_SCHEDULE_DISABLED"
    })
  }

  const query = String(req.query.q || req.query.query || "").trim()
  if (!query) {
    return res.status(400).json({
      error: "Informe um time, selecao ou pergunta esportiva em q ou query.",
      code: "SPORTS_QUERY_REQUIRED"
    })
  }

  try {
    const fixture = await resolveNextFixtureFromQuestion(query)
    if (!fixture) {
      return res.status(404).json({
        error: "Nao encontrei agenda esportiva para a consulta informada.",
        code: "SPORTS_LOOKUP_EMPTY"
      })
    }

    return res.json({
      success: true,
      provider: fixture.provider || "thesportsdb",
      data: fixture
    })
  } catch (error) {
    return res.status(502).json({
      error: error.message || "Falha ao consultar agenda esportiva.",
      code: error.code || "SPORTS_LOOKUP_FAILED",
      details: process.env.NODE_ENV === "development" ? error.details || null : undefined
    })
  }
})

app.get("/research/soccer/endpoints", askLimiter, (_req, res) => {
  return res.json({
    success: true,
    provider: "sportsdataio",
    auth: {
      header: "Ocp-Apim-Subscription-Key",
      queryParam: "key"
    },
    endpoints: listSportsDataIoEndpoints()
  })
})

app.get("/research/soccer/:endpointKey", askLimiter, async (req, res) => {
  const runtimeResearchCapabilities = getResearchCapabilities()
  if (!runtimeResearchCapabilities.sportsSchedule) {
    return res.status(503).json({
      error: "Consulta esportiva ao vivo nao habilitada nesta execucao.",
      code: "SPORTS_SCHEDULE_DISABLED"
    })
  }

  const endpointKey = String(req.params.endpointKey || "").trim()
  const endpointDefinition = resolveSportsDataIoEndpoint(endpointKey)
  if (!endpointDefinition) {
    return res.status(400).json({
      error: "Endpoint de futebol nao permitido para consulta.",
      code: "SPORTSDATA_ENDPOINT_NOT_ALLOWED",
      allowedEndpoints: listSportsDataIoEndpoints().map((entry) => entry.key)
    })
  }

  const pathParams = {}
  for (const key of endpointDefinition.requiredParams) {
    pathParams[key] = req.query[key]
  }

  const queryParams = { ...req.query }
  delete queryParams.key

  try {
    const payload = await fetchSportsDataIo(endpointKey, pathParams, queryParams)
    return res.json({
      success: true,
      provider: "sportsdataio",
      endpoint: endpointKey,
      category: endpointDefinition.category,
      callInterval: endpointDefinition.callInterval,
      requiredParams: endpointDefinition.requiredParams,
      data: payload
    })
  } catch (error) {
    return res.status(error.statusCode || 502).json({
      error: error.message || "Falha ao consultar SportsDataIO.",
      code: error.code || "SPORTSDATA_REQUEST_FAILED",
      details: process.env.NODE_ENV === "development" ? error.details || null : undefined
    })
  }
})

app.get("/knowledge/status", async (_req, res) => {
  try {
    const stats = await grootAdvancedRAG.getAdvancedStats()
    res.json({
      service: AI_KNOWLEDGE_SERVICE_SLUG,
      stats,
      bibleStudyModules: listBibleStudyModules()
    })
  } catch (error) {
    res.status(500).json({
      error: "Falha ao obter status da base de conhecimento",
      details: process.env.NODE_ENV === "development" ? error.message : undefined
    })
  }
})

app.get("/v1/models", (_req, res) => {
  res.json({
    object: "list",
    data: listCompatModels().map(model => ({
      id: model.id,
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: AI_MODEL_OWNER
    }))
  })
})

app.post("/v1/chat/completions", async (req, res) => {
  try {
    const { model = "groot-1-free", messages = [] } = req.body || {}
    const preset = resolveCompatModel(model)
    const question = buildQuestionFromMessages(messages)

    if (!question) {
      return res.status(400).json({ error: { message: "messages vazio", type: "invalid_request_error" } })
    }

    const answer = await askGroot(question, getCompatContext(model, {
      requestId: `compat_${Date.now()}`,
      assistantProfile: preset.profile,
      activeModules: preset.modules
    }))

    const responseText = typeof answer === "string"
      ? answer
      : (answer?.response ?? answer?.answer ?? "")

    res.json({
      id: `chatcmpl_${crypto.randomUUID()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: responseText
          },
          finish_reason: "stop"
        }
      ],
      usage: estimateUsage(responseText)
    })
  } catch (error) {
    res.status(500).json({
      error: {
        message: error.message,
        type: "server_error"
      }
    })
  }
})

app.post("/v1/responses", async (req, res) => {
  try {
    const { model = "groot-1-free", input = "", instructions = "" } = req.body || {}
    const preset = resolveCompatModel(model)
    const question = Array.isArray(input)
      ? input
        .map(item => typeof item === "string" ? item : flattenMessageContent(item?.content || item?.text || ""))
        .join("\n")
      : String(input || "")

    if (!question.trim()) {
      return res.status(400).json({ error: { message: "input vazio", type: "invalid_request_error" } })
    }

    const answer = await askGroot(question, getCompatContext(model, {
      requestId: `resp_${Date.now()}`,
      assistantProfile: preset.profile,
      activeModules: preset.modules,
      instructions
    }))

    const responseText = typeof answer === "string"
      ? answer
      : (answer?.response ?? answer?.answer ?? "")

    res.json({
      id: `resp_${crypto.randomUUID()}`,
      object: "response",
      created_at: Math.floor(Date.now() / 1000),
      status: "completed",
      model,
      output_text: responseText,
      output: [
        {
          id: `msg_${crypto.randomUUID()}`,
          type: "message",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: responseText,
              annotations: []
            }
          ]
        }
      ],
      usage: estimateUsage(responseText)
    })
  } catch (error) {
    res.status(500).json({
      error: {
        message: error.message,
        type: "server_error"
      }
    })
  }
})

app.post(/^\/v1beta\/models\/([^:]+):generateContent$/, async (req, res) => {
  try {
    const model = req.params[0] || "groot-1-free"
    const question = buildQuestionFromGeminiContents(req.body?.contents || [])
    const systemInstruction = Array.isArray(req.body?.systemInstruction?.parts)
      ? req.body.systemInstruction.parts.map(part => part?.text || "").filter(Boolean).join("\n")
      : ""

    if (!question.trim()) {
      return res.status(400).json({ error: { message: "contents vazio", status: "INVALID_ARGUMENT" } })
    }

    const answer = await askGroot(question, getCompatContext(model, {
      requestId: `gem_${Date.now()}`,
      instructions: systemInstruction
    }))

    const responseText = typeof answer === "string"
      ? answer
      : (answer?.response ?? answer?.answer ?? "")

    res.json({
      candidates: [
        {
          index: 0,
          content: {
            role: "model",
            parts: [{ text: responseText }]
          },
          finishReason: "STOP"
        }
      ],
      usageMetadata: {
        promptTokenCount: 0,
        candidatesTokenCount: Math.max(1, Math.ceil(responseText.length / 4)),
        totalTokenCount: Math.max(1, Math.ceil(responseText.length / 4))
      },
      modelVersion: model
    })
  } catch (error) {
    res.status(500).json({
      error: {
        message: error.message,
        status: "INTERNAL"
      }
    })
  }
})

const requireAdmin = createRequireAdminMiddleware({ crypto })

// Health check enterprise
app.get("/health", async (req, res) => {
  try {
    const snapshot = await buildHealthSnapshot({
      aiGateway,
      grootAdvancedRAG,
      service: AI_SERVICE_SLUG,
      version: "2.0.0"
    })
    res.json(snapshot)
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error.message
    })
  }
})

// Metrics endpoint (Prometheus compatible)
app.get("/metrics", requireAdmin, async (req, res) => {
  try {
    const metrics = aiGateway.metrics.exportMetrics('prometheus')
    res.set('Content-Type', 'text/plain')
    res.send(metrics)
  } catch (error) {
    res.status(500).json({ error: 'Failed to get metrics' })
  }
})

app.get("/metrics/json", requireAdmin, (req, res) => {
  try {
    res.json({
      summary: aiGateway.metrics.getSummary(),
      providers: aiGateway.metrics.getProviderStats(),
      errors: aiGateway.metrics.getErrorSummary(),
      topUsers: aiGateway.metrics.getTopUsers(5)
    })
  } catch (error) {
    res.status(500).json({ error: "Failed to get metrics" })
  }
})

app.get("/metrics/memoryContext", requireAdmin, async (req, res) => {
  try {
    const includeDistributed = String(req.query.includeDistributed || "false").toLowerCase() === "true"
    const format = String(req.query.format || "json").toLowerCase()

    if (format === "prometheus") {
      const metricsText = await memoryContextMetrics.exportPrometheus({ includeDistributed })
      res.set("Content-Type", "text/plain; version=0.0.4")
      return res.send(metricsText)
    }

    const snapshot = includeDistributed
      ? await memoryContextMetrics.snapshotDistributed()
      : memoryContextMetrics.snapshot()

    res.json({
      success: true,
      distributed: includeDistributed,
      nodeId: memoryMetricsNodeId,
      memoryContext: snapshot
    })
  } catch (error) {
    res.status(500).json({ error: "Failed to get memory context metrics" })
  }
})

// Logs endpoint
app.get("/logs", requireAdmin, (req, res) => {
  try {
    const filter = {
      level: req.query.level,
      requestId: req.query.requestId,
      event: req.query.event,
      since: req.query.since,
      until: req.query.until
    }

    const logs = aiGateway.logger.getLogs(filter)
    res.json({ logs, summary: aiGateway.logger.getLogSummary() })
  } catch (error) {
    res.status(500).json({ error: 'Failed to get logs' })
  }
})

// Admin dashboard
app.get("/admin", requireAdmin, (req, res) => {
  res.json({
    service: AI_SERVICE_SLUG,
    admin: true,
    note: "UI de admin legada removida do runtime oficial. Use /metrics, /metrics/json, /logs e /runtime/language/status.",
    endpoints: {
      health: "/health",
      metrics: "/metrics",
      metricsJson: "/metrics/json",
      memoryContextMetrics: "/metrics/memoryContext",
      logs: "/logs",
      languageRuntimeStatus: "/runtime/language/status",
      languageRuntimeCleanup: "/runtime/language/cache/cleanup"
    }
  })
})

app.get("/runtime/language/status", requireAdmin, async (_req, res) => {
  try {
    const status = await getLanguageRuntimeStatus()
    res.json({
      success: true,
      runtime: "language",
      ...status
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Falha ao consultar status do language runtime",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
      code: "LANGUAGE_RUNTIME_STATUS_FAILED"
    })
  }
})

app.post("/runtime/language/cache/cleanup", requireAdmin, async (_req, res) => {
  try {
    const cleanup = await cleanupLanguageRuntimeCache()
    const status = await getLanguageRuntimeStatus()
    res.json({
      success: true,
      runtime: "language",
      cleanup,
      ...status
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Falha ao limpar cache do language runtime",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
      code: "LANGUAGE_RUNTIME_CACHE_CLEANUP_FAILED"
    })
  }
})

// Upload temporário (armazenamento local, auto-delete)
app.post("/upload", askLimiter, async (req, res) => {
  try {
    const quotaContext = resolveUploadQuotaContext(req)
    const quotaBefore = getUploadQuotaStatus(quotaContext)
    if (quotaBefore.blocked) {
      return res.status(429).json({
        error: "Limite diário de uploads atingido",
        code: "UPLOAD_QUOTA_EXCEEDED",
        quota: quotaBefore
      })
    }

    const { name, type, data } = req.body || {}
    if (!name || !data) {
      return res.status(400).json({ error: "Arquivo inválido", code: "INVALID_UPLOAD" })
    }

    const buffer = parseBase64Payload(data)
    if (!buffer || !buffer.length) {
      return res.status(400).json({ error: "Conteúdo vazio", code: "EMPTY_UPLOAD" })
    }

    if (buffer.length > uploadMaxBytes) {
      return res.status(413).json({
        error: "Arquivo muito grande",
        code: "UPLOAD_TOO_LARGE",
        maxBytes: uploadMaxBytes
      })
    }

    await ensureUploadDir()
    const id = crypto.randomUUID()
    const safeName = safeFilename(name)
    const detectedType = detectMimeFromMagic(buffer, safeName)
    const resolvedType = normalizeUploadMime(safeName, type || "", detectedType)

    if (!isAllowedUploadByAccept(safeName, resolvedType)) {
      return res.status(415).json({
        error: "Tipo de arquivo não suportado",
        code: "UPLOAD_UNSUPPORTED_TYPE",
        detectedType: resolvedType,
        name: safeName
      })
    }

    if (!isMimeCompatibleWithExtension(safeName, resolvedType)) {
      return res.status(415).json({
        error: "Arquivo com tipo inconsistente para a extensão",
        code: "UPLOAD_TYPE_MISMATCH",
        detectedType: resolvedType,
        name: safeName
      })
    }

    const filePath = path.join(UPLOAD_DIR, `${id}_${safeName}`)

    await fs.writeFile(filePath, buffer)

    const expiresAt = Date.now() + uploadTtlMinutes * 60 * 1000
    uploads.set(id, {
      id,
      name: safeName,
      type: resolvedType,
      path: filePath,
      size: buffer.length,
      expiresAt
    })
    scheduleUploadCleanup(id)
    const uploadRef = uploads.get(id)
    if (uploadRef) {
      Promise.resolve()
        .then(() => resolveUploadExtraction(uploadRef))
        .catch(() => { })
    }

    const quotaAfter = consumeUploadQuota(quotaContext)

    res.json({
      id,
      name: safeName,
      type: resolvedType,
      size: buffer.length,
      expiresAt,
      detectedType: detectedType || resolvedType,
      quota: quotaAfter
    })
  } catch (error) {
    console.error("❌ Falha no upload:", error.message)
    res.status(500).json({ error: "Falha ao salvar arquivo", code: "UPLOAD_FAILED" })
  }
})

app.get("/upload/quota", (req, res) => {
  try {
    const quotaContext = resolveUploadQuotaContext(req)
    const quota = getUploadQuotaStatus(quotaContext)
    res.json({ success: true, quota })
  } catch (error) {
    res.status(500).json({ success: false, error: "Falha ao consultar cota de upload", code: "UPLOAD_QUOTA_STATUS_FAILED" })
  }
})

app.get("/usage/limits", (req, res) => {
  try {
    const uploadContext = resolveUploadQuotaContext(req)
    const imageContext = resolveImageQuotaContext(req)
    res.json({
      success: true,
      limits: {
        upload: getUploadQuotaStatus(uploadContext),
        image: getImageQuotaStatus(imageContext)
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, error: "Falha ao consultar limites de uso", code: "USAGE_LIMITS_FAILED" })
  }
})

app.post("/generate/image", askLimiter, askSlowDown, async (req, res) => {
  try {
    const imageQuotaContext = resolveImageQuotaContext(req)
    const imageQuotaBefore = getImageQuotaStatus(imageQuotaContext)
    if (imageQuotaBefore.blocked) {
      return res.status(429).json({
        error: "Limite diário de geração de imagem atingido",
        code: "IMAGE_QUOTA_EXCEEDED",
        quota: imageQuotaBefore
      })
    }

    const requestId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const prompt = String(req.body?.prompt || "").trim()
    const locale = String(req.body?.locale || "pt-BR")
    const imageRequest = parseImageGenerationRequest(req.body)

    if (!prompt) {
      return res.status(400).json({ error: "Prompt de imagem vazio", code: "EMPTY_IMAGE_PROMPT" })
    }

    const safety = detectSafetyRisk(prompt)
    if (safety.triggered) {
      return res.status(400).json({
        error: buildSafetyResponse(safety, { locale, promptText: prompt }),
        code: "IMAGE_PROMPT_BLOCKED",
        safety
      })
    }

    const fullPrompt = [
      prompt,
      imageRequest.style ? `Style guidance: ${imageRequest.style}` : "",
      imageRequest.stylePreset ? `Style preset: ${imageRequest.stylePreset}` : "",
      buildImageStylePresetPrompt(imageRequest.stylePreset),
      imageRequest.aspectRatio ? `Requested aspect ratio: ${imageRequest.aspectRatio}` : "",
      imageRequest.width && imageRequest.height ? `Target size: ${imageRequest.width}x${imageRequest.height}` : ""
    ]
      .filter(Boolean)
      .join("\n")

    const image = await generateImageWithProvider(fullPrompt, imageRequest)
    const imageQuotaAfter = consumeImageQuota(imageQuotaContext)

    res.json({
      success: true,
      requestId,
      image,
      quota: imageQuotaAfter,
      controls: image.controls || {
        stylePreset: imageRequest.stylePreset || null,
        aspectRatio: imageRequest.aspectRatio,
        width: imageRequest.width,
        height: imageRequest.height,
        negativePrompt: imageRequest.negativePrompt || null,
        guidanceScale: imageRequest.guidanceScale,
        numInferenceSteps: imageRequest.numInferenceSteps,
        seed: imageRequest.seed ?? null
      }
    })
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.message || "Falha ao gerar imagem",
      code: error.code || "IMAGE_GENERATION_FAILED"
    })
  }
})

app.post("/generate/document", askLimiter, askSlowDown, async (req, res) => {
  const requestId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  try {
    const userId = req.get("X-User-Id") || req.ip || "default_user"
    const prompt = String(req.body?.prompt || "").trim()
    const providedContent = String(req.body?.content || "").trim()
    const requestedFormat = normalizeDocumentFormat(req.body?.format || "pdf")
    const locale = String(req.body?.locale || "pt-BR")
    const title = sanitizeDocumentTitle(req.body?.title || "", "Documento GIOM")
    const documentContext = sanitizeAskContext(req.body?.context)
    const activeModules = Array.isArray(documentContext.activeModules) ? documentContext.activeModules : []
    const assistantProfile = String(documentContext.assistantProfile || "auto")

    if (!requestedFormat) {
      return res.status(400).json({
        error: "Formato de documento nao suportado.",
        code: "UNSUPPORTED_DOCUMENT_FORMAT",
        supportedFormats: documentGenerationFormatIds
      })
    }

    if (!prompt && !providedContent) {
      return res.status(400).json({
        error: "Informe um prompt ou conteudo para gerar o documento.",
        code: "EMPTY_DOCUMENT_REQUEST"
      })
    }

    const safety = detectSafetyRisk(`${title}\n${prompt}\n${providedContent}`)
    if (safety.triggered) {
      return res.status(400).json({
        error: buildSafetyResponse(safety, { locale, promptText: prompt || providedContent }),
        code: "DOCUMENT_PROMPT_BLOCKED",
        safety
      })
    }

    const runtimeContext = {
      ...(req.body?.context || {}),
      locale,
      userId,
      requestId,
      assistantProfile,
      activeModules,
      researchCapabilities: getResearchCapabilities(req.body?.context?.researchCapabilities || {}),
      capabilityMatrix: buildRuntimeCapabilityMatrix(),
      privacyCapabilities: {
        sensitiveDataRedaction: true,
        sensitiveLearningBlocked: true,
        temporaryUploadStorage: true
      }
    }

    const documentContent = providedContent || await askGiom(
      buildDocumentDraftPrompt(prompt, requestedFormat, {
        locale,
        style: req.body?.context?.verbosity || "natural",
        activeModules,
        title
      }),
      runtimeContext
    )

    const document = await generateStructuredDocument({
      format: requestedFormat,
      title,
      content: documentContent,
      fileNameBase: title,
      metadata: {
        requestId,
        locale,
        assistantProfile
      }
    })

    await grootMemoryConnector.saveConversation(userId, prompt || `Gerar documento ${requestedFormat.toUpperCase()}`, `Documento ${document.fileName} gerado com sucesso.`, {
      provider: "document_generation",
      requestId,
      assistantProfile,
      activeModules,
      document: {
        format: requestedFormat,
        title,
        fileName: document.fileName,
        mimeType: document.mimeType,
        size: document.size
      }
    })

    res.json({
      success: true,
      requestId,
      document,
      content: documentContent,
      previewText: document.previewText
    })
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.message || "Falha ao gerar documento",
      code: error.code || "DOCUMENT_GENERATION_FAILED"
    })
  }
})

// API principal com contexto enterprise
app.post("/ask", askLimiter, askSlowDown, async (req, res) => {
  const requestId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()
  let preparedQuestion = ""
  let preparedContext = {}

  const requestBodyShape = (() => {
    const body = req.body || {}
    const hasMessagesArray = Array.isArray(body.messages)
    const firstMessage = hasMessagesArray ? body.messages[0] : null
    return {
      hasQuestion: typeof body.question === "string" && !!body.question.trim(),
      hasMessage: typeof body.message === "string" && !!body.message.trim(),
      hasPrompt: typeof body.prompt === "string" && !!body.prompt.trim(),
      hasMessagesArray,
      firstMessageKeys: firstMessage && typeof firstMessage === "object" ? Object.keys(firstMessage).slice(0, 6) : [],
      hasInput: Boolean(body.input),
      hasContentsArray: Array.isArray(body.contents),
      hasContextObject: !!(body.context && typeof body.context === "object" && !Array.isArray(body.context))
    }
  })()

  const contextDiagnostics = getAskContextDiagnostics(req.body?.context)

  try {
    const preparedSeedPayload = await buildPreparedAskPayloadFromHttp({
      req,
      requestId,
      uploads,
      resolveUploadExtraction,
      buildUploadExtractionBlock
    })

    const decision = askGiomService.decide(preparedSeedPayload, { mode: "standard" })

    const runtimeContextResult = await buildRuntimeContext({
      preparedPayload: preparedSeedPayload,
      decisionResult: decision,
      ports: {
        stm: runtimeSessionMemoryStore,
        retrieval: retrievalPort,
        runtimeContext: {
          enrich: buildRuntimeConversationContext
        }
      },
      limits: {
        maxConversationTurns: Number(process.env.MEMORY_CONTEXT_MAX_TURNS || 10),
        maxMemorySummaryChars: Number(process.env.MEMORY_CONTEXT_SUMMARY_MAX_CHARS || 450),
        maxContextTokens: Number(process.env.MEMORY_CONTEXT_MAX_TOKENS || 1800)
      }
    })

    aiGateway.logger.info(requestId, "MEMORY_CONTEXT_BUILT", {
      route: "ask",
      memoryContext: runtimeContextResult.diagnostics
    })

    memoryContextMetrics.record({
      route: "ask",
      requestId,
      sessionId: preparedSeedPayload?.enrichedData?.request?.sessionId || "",
      payloadId: preparedSeedPayload?.enrichedData?.request?.requestId || requestId,
      handlerId: decision?.handlerName || "",
      diagnostics: runtimeContextResult.diagnostics
    })

    const preparedPayload = runtimeContextResult.preparedPayload
    const {
      normalizedQuestion,
      preparedQuestion: finalQuestion,
      context: enhancedContext,
      enrichedData
    } = preparedPayload
    const question = normalizedQuestion
    const userId = enrichedData.request.userId
    preparedQuestion = finalQuestion
    preparedContext = enhancedContext

    const promptPackagePromise = buildStreamingPromptPackage(finalQuestion, enhancedContext)
    const shadowPlanPromise = buildShadowOrchestratorPlan(finalQuestion, enhancedContext)

    aiGateway.logger.info(requestId, 'REQUEST_STARTED', {
      questionLength: question.length,
      context: Object.keys(enhancedContext),
      contextDiagnostics,
      requestBodyShape,
      decision,
      memoryContext: runtimeContextResult.diagnostics,
      orchestratorShadow: {
        enabled: orchestratorShadowEnabled,
        pending: orchestratorShadowEnabled
      }
    })

    const giomResult = await askGiomService.execute(preparedPayload, decision)
    const responseText = giomResult.responseText
    aiGateway.metrics.recordResponseEvaluation(requestId, giomResult.evaluation, giomResult.selfHealing)

    const [{ promptPackage }, shadowPlan] = await Promise.all([
      promptPackagePromise,
      shadowPlanPromise
    ])

    if (!responseText) {
      throw new Error("Resposta vazia da IA")
    }

    aiGateway.logger.info(requestId, 'REQUEST_COMPLETED', {
      responseLength: responseText.length,
      handler: giomResult.handler,
      intent: giomResult.intent,
      routeType: giomResult.routeType
    })

    if (shouldPersistLearnedConversation(giomResult)) {
      saveConversationNonBlocking(userId, question, responseText, {
        provider: "standard_gateway",
        requestId,
        sessionId: enrichedData.request.sessionId || null,
        assistantProfile: promptPackage.profileId || enhancedContext.assistantProfile || null,
        activeModules: promptPackage.activeModules || enhancedContext.activeModules || [],
        domainSubmodules: promptPackage.domainSubmodules || enhancedContext.domainSubmodules || {},
        bibleStudyModules: promptPackage.bibleStudyModules || enhancedContext.bibleStudyModules || [],
        promptPacks: promptPackage.promptPacks || enhancedContext.promptPacks || [],
        evaluation: giomResult.evaluation || null,
        selfHealing: giomResult.selfHealing || null,
        learning: giomResult.learning || null,
        askRoute: {
          handler: giomResult.handler,
          intent: giomResult.intent,
          routeType: giomResult.routeType
        },
        orchestratorShadow: shadowPlan && !shadowPlan.error
          ? {
            strategy: shadowPlan.strategy,
            intentCategory: shadowPlan.intent?.category || "unknown",
            finalPromptLength: String(shadowPlan.finalPrompt || "").length
          }
          : null,
        uploadName: enhancedContext.uploadName || null,
        uploadType: enhancedContext.uploadType || null
      }, requestId)
    }

    aiGateway.metrics.recordRequest(requestId, Date.now() - startTime, true)
    aiGateway.metrics.recordUserActivity(userId, "ask", {
      length: question.length
    })
    if (shouldPersistLearnedConversation(giomResult)) {
      appendConversationToStm(userId, enrichedData.request.sessionId || null, question, responseText)
    }

    res.json({
      success: true,
      data: {
        response: responseText
      },
      response: responseText,
      answer: responseText,
      requestId,
      metadata: {
        processingTime: Date.now() - startTime,
        version: '2.0.0',
        assistantProfile: promptPackage.profileId,
        requestedAssistantProfile: promptPackage.requestedProfileId || enhancedContext.assistantProfile || null,
        activeModules: promptPackage.activeModules,
        domainSubmodules: promptPackage.domainSubmodules || {},
        bibleStudyModules: promptPackage.bibleStudyModules || [],
        askRoute: {
          handler: giomResult.handler,
          intent: giomResult.intent,
          routeType: giomResult.routeType,
          traceLength: giomResult.trace.length
        },
        orchestratorShadow: shadowPlan && !shadowPlan.error
          ? {
            enabled: true,
            strategy: shadowPlan.strategy,
            intentCategory: shadowPlan.intent?.category || "unknown"
          }
          : {
            enabled: orchestratorShadowEnabled,
            error: shadowPlan?.message || null
          },
        weatherUsed: runtimeBuildWeatherClientMetadata(enhancedContext.agroWeather),
        languageUsed: buildLanguageRuntimeMetadata(enhancedContext),
        memoryContext: runtimeContextResult.diagnostics,
        evaluation: giomResult.evaluation || null,
        selfHealing: giomResult.selfHealing || null,
        learning: giomResult.learning || null
      }
    })

  } catch (error) {
    aiGateway.logger.error(requestId, 'REQUEST_FAILED', {
      error: error.message,
      stack: error.stack,
      requestBodyShape
    })

    aiGateway.metrics.recordRequest(requestId, Date.now() - startTime, false)
    aiGateway.metrics.recordError("ask_error", error, { requestId })

    const statusCode = error.statusCode || error.response?.status || 500
    const errorCode = error.code || "INTERNAL_ERROR"

    if (statusCode >= 500) {
      const fallbackResponse = buildOperationalContingencyResponse(
        preparedQuestion || req.body?.question || "",
        preparedContext,
        error.message
      )

      return res.status(200).json({
        success: true,
        data: {
          response: fallbackResponse
        },
        response: fallbackResponse,
        answer: fallbackResponse,
        requestId,
        metadata: {
          processingTime: Date.now() - startTime,
          version: "2.0.0",
          fallback: true,
          fallbackReason: errorCode
        }
      })
    }

    res.status(statusCode).json({
      error: "Erro ao processar sua pergunta",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
      code: errorCode,
      requestId
    })
  }
})

app.post("/ask/stream", askLimiter, askSlowDown, async (req, res) => {
  const requestId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()
  let hasCompleted = false
  const sseHeartbeatMs = Math.max(2_500, Number(process.env.SSE_HEARTBEAT_MS || 10_000))

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8")
  res.setHeader("Cache-Control", "no-cache, no-transform")
  res.setHeader("Connection", "keep-alive")
  res.setHeader("X-Accel-Buffering", "no")
  res.flushHeaders?.()

  // Heartbeat periódico evita timeout em proxies e navegadores durante respostas longas.
  const heartbeat = setInterval(() => {
    if (hasCompleted || res.writableEnded) return
    writeSSE(res, "ping", {
      ts: Date.now()
    })
  }, sseHeartbeatMs)

  const clearHeartbeat = () => clearInterval(heartbeat)
  res.on("close", clearHeartbeat)
  res.on("finish", clearHeartbeat)

  try {
    const preparedSeedPayload = await buildPreparedAskPayloadFromHttp({
      req,
      requestId,
      uploads,
      resolveUploadExtraction,
      buildUploadExtractionBlock
    })

    const streamDecision = askGiomService.decide(preparedSeedPayload, { mode: "stream" })

    const runtimeContextResult = await buildRuntimeContext({
      preparedPayload: preparedSeedPayload,
      decisionResult: streamDecision,
      ports: {
        stm: runtimeSessionMemoryStore,
        retrieval: retrievalPort,
        runtimeContext: {
          enrich: buildRuntimeConversationContext
        }
      },
      limits: {
        maxConversationTurns: Number(process.env.MEMORY_CONTEXT_MAX_TURNS || 10),
        maxMemorySummaryChars: Number(process.env.MEMORY_CONTEXT_SUMMARY_MAX_CHARS || 450),
        maxContextTokens: Number(process.env.MEMORY_CONTEXT_MAX_TOKENS || 1800)
      }
    })

    aiGateway.logger.info(requestId, "MEMORY_CONTEXT_BUILT", {
      route: "ask_stream",
      memoryContext: runtimeContextResult.diagnostics
    })

    memoryContextMetrics.record({
      route: "ask_stream",
      requestId,
      sessionId: preparedSeedPayload?.enrichedData?.request?.sessionId || "",
      payloadId: preparedSeedPayload?.enrichedData?.request?.requestId || requestId,
      handlerId: streamDecision?.handlerName || "",
      diagnostics: runtimeContextResult.diagnostics
    })

    const preparedPayload = runtimeContextResult.preparedPayload
    const {
      normalizedQuestion: question,
      preparedQuestion: finalQuestion,
      context: enhancedContext,
      enrichedData
    } = preparedPayload
    const userId = enrichedData.request.userId

    aiGateway.logger.info(requestId, "STREAM_REQUEST_DECISION", {
      intent: streamDecision.intent,
      handlerName: streamDecision.handlerName,
      routeType: streamDecision.routeType,
      requiresStreaming: streamDecision.requiresStreaming,
      decisionMs: streamDecision.decisionMs,
      memoryContext: runtimeContextResult.diagnostics
    })

    if (!streamDecision.requiresStreaming) {
      const deterministicResult = await askGiomService.execute(
        {
          normalizedQuestion: question,
          preparedQuestion: finalQuestion,
          context: enhancedContext,
          flags: preparedPayload.flags,
          enrichedData
        },
        streamDecision
      )

      aiGateway.metrics.recordResponseEvaluation(requestId, deterministicResult.evaluation, deterministicResult.selfHealing)

      if (shouldPersistLearnedConversation(deterministicResult)) {
        saveConversationNonBlocking(userId, question, deterministicResult.responseText, {
          provider: "decision_router_direct",
          requestId,
          assistantProfile: enhancedContext.assistantProfile || null,
          activeModules: enhancedContext.activeModules || [],
          domainSubmodules: enhancedContext.domainSubmodules || {},
          bibleStudyModules: enhancedContext.bibleStudyModules || [],
          promptPacks: enhancedContext.promptPacks || [],
          evaluation: deterministicResult.evaluation || null,
          selfHealing: deterministicResult.selfHealing || null,
          learning: deterministicResult.learning || null,
          streaming: true,
          askRoute: {
            handler: deterministicResult.handler,
            intent: deterministicResult.intent,
            routeType: deterministicResult.routeType
          }
        }, requestId)
      }

      aiGateway.metrics.recordRequest(requestId, Date.now() - startTime, true)
      aiGateway.metrics.recordUserActivity(userId, "ask_stream", {
        length: question.length,
        routeType: deterministicResult.routeType,
        intent: deterministicResult.intent
      })
      if (shouldPersistLearnedConversation(deterministicResult)) {
        appendConversationToStm(userId, enrichedData.request.sessionId || null, question, deterministicResult.responseText)
      }

      writeSSE(res, "meta", {
        requestId,
        providerMode: process.env.GROOT_AI_PROVIDER || "auto",
        assistantProfile: enhancedContext.assistantProfile || null,
        requestedAssistantProfile: enhancedContext.assistantProfile || null,
        activeModules: enhancedContext.activeModules || [],
        domainSubmodules: enhancedContext.domainSubmodules || {},
        bibleStudyModules: enhancedContext.bibleStudyModules || [],
        askRoute: {
          handler: deterministicResult.handler,
          intent: deterministicResult.intent,
          routeType: deterministicResult.routeType,
          traceLength: deterministicResult.trace.length
        },
        weatherUsed: runtimeBuildWeatherClientMetadata(enhancedContext.agroWeather),
        languageUsed: buildLanguageRuntimeMetadata(enhancedContext)
      })

      writeSSE(res, "complete", {
        requestId,
        response: deterministicResult.responseText,
        metadata: {
          processingTime: Date.now() - startTime,
          provider: "decision_router_direct",
          assistantProfile: enhancedContext.assistantProfile || null,
          requestedAssistantProfile: enhancedContext.assistantProfile || null,
          activeModules: enhancedContext.activeModules || [],
          domainSubmodules: enhancedContext.domainSubmodules || {},
          bibleStudyModules: enhancedContext.bibleStudyModules || [],
          askRoute: {
            handler: deterministicResult.handler,
            intent: deterministicResult.intent,
            routeType: deterministicResult.routeType
          },
          weatherUsed: runtimeBuildWeatherClientMetadata(enhancedContext.agroWeather),
          languageUsed: buildLanguageRuntimeMetadata(enhancedContext),
          memoryContext: runtimeContextResult.diagnostics,
          evaluation: deterministicResult.evaluation || null,
          selfHealing: deterministicResult.selfHealing || null,
          learning: deterministicResult.learning || null
        }
      })
      clearHeartbeat()
      res.end()
      return
    }

    const streamProviderContext = await buildAskProviderContext(finalQuestion, enhancedContext)
    const streamEnhancedContext = {
      ...enhancedContext,
      ...streamProviderContext.contextEnhancements
    }
    const promptPackage = streamProviderContext.contextEnhancements?.promptPackage
      || await buildStreamingPromptPackage(finalQuestion, enhancedContext)
    const shadowPlan = await buildShadowOrchestratorPlan(finalQuestion, enhancedContext)

    aiGateway.logger.info(requestId, "STREAM_REQUEST_STARTED", {
      questionLength: question.length,
      context: Object.keys(enhancedContext)
    })

    writeSSE(res, "meta", {
      requestId,
      providerMode: process.env.GROOT_AI_PROVIDER || "auto",
      assistantProfile: promptPackage.profileId,
      requestedAssistantProfile: promptPackage.requestedProfileId || enhancedContext.assistantProfile || null,
      activeModules: promptPackage.activeModules,
      domainSubmodules: promptPackage.domainSubmodules || {},
      bibleStudyModules: promptPackage.bibleStudyModules || [],
      askRoute: {
        handler: streamDecision.handlerName,
        intent: streamDecision.intent,
        routeType: streamDecision.routeType,
        decisionMs: streamDecision.decisionMs
      },
      orchestratorShadow: shadowPlan && !shadowPlan.error
        ? {
          enabled: true,
          strategy: shadowPlan.strategy,
          intentCategory: shadowPlan.intent?.category || "unknown"
        }
        : {
          enabled: orchestratorShadowEnabled,
          error: shadowPlan?.message || null
        },
      weatherUsed: runtimeBuildWeatherClientMetadata(enhancedContext.agroWeather),
      languageUsed: buildLanguageRuntimeMetadata(enhancedContext),
      ragSources: streamEnhancedContext.ragSources || []
    })

    await streamingGateway.askStreaming(
      streamProviderContext.finalPrompt,
      {
        systemPrompt: promptPackage.systemPrompt
      },
      (payload) => {
        writeSSE(res, "chunk", payload)
      },
      async (payload) => {
        hasCompleted = true
        const providerResponseText = postProcessAssistantResponse(question, String(payload?.fullText || "").trim(), streamEnhancedContext)
        let responseText = providerResponseText

        if (!responseText) {
          writeSSE(res, "complete", {
            requestId,
            response: buildOperationalContingencyResponse(question, streamEnhancedContext, "resposta vazia da IA"),
            metadata: {
              processingTime: Date.now() - startTime,
              provider: payload?.provider || "streaming_gateway",
              fallback: true
            }
          })
          clearHeartbeat()
          res.end()
          return
        }

        let evaluation = null
        let selfHealing = { applied: false, issues: [] }
        let learning = {
          shouldPersistMemory: true,
          memoryBoost: 1,
          markedForRetraining: false,
          score: null
        }

        const streamEvalEnabled = String(process.env.GIOM_EVAL_ENABLED || "true").toLowerCase() !== "false"
        const streamSelfHealEnabled = String(process.env.GIOM_SELF_HEAL_ENABLED || "true").toLowerCase() !== "false"
        const streamSelfHealThreshold = Number(process.env.GIOM_SELF_HEAL_THRESHOLD || 0.6)
        const streamSelfHealTimeoutMs = Number(process.env.GIOM_SELF_HEAL_TIMEOUT_MS || 3500)

        if (streamEvalEnabled && responseText) {
          try {
            evaluation = await evaluateResponse({
              question,
              answer: responseText,
              context: streamEnhancedContext,
              memoryContext: streamEnhancedContext?.memoryContext || null,
              intent: streamDecision.intent,
              handler: streamDecision.handlerName,
              latencyMs: Date.now() - startTime
            })

            if (streamSelfHealEnabled) {
              const healed = await selfHealResponse({
                evaluation,
                question,
                answer: responseText,
                aiProvider: {
                  ask: (repairQuestion, repairContext) => askGroot(repairQuestion, {
                    ...streamEnhancedContext,
                    ...(repairContext || {})
                  })
                },
                normalizeAnswer: normalizeAnswerText,
                threshold: streamSelfHealThreshold,
                timeoutMs: streamSelfHealTimeoutMs
              })

              selfHealing = {
                applied: Boolean(healed?.healed),
                issues: healed?.issues || []
              }

              if (healed?.healed && healed?.finalAnswer) {
                responseText = postProcessAssistantResponse(question, String(healed.finalAnswer), streamEnhancedContext)
                evaluation = await evaluateResponse({
                  question,
                  answer: responseText,
                  context: streamEnhancedContext,
                  memoryContext: streamEnhancedContext?.memoryContext || null,
                  intent: streamDecision.intent,
                  handler: streamDecision.handlerName,
                  latencyMs: Date.now() - startTime
                })
              }
            }

            learning = await processEvaluation(
              evaluation,
              {
                question,
                normalizedQuestion: finalQuestion,
                requestId,
                intent: streamDecision.intent,
                handler: streamDecision.handlerName
              },
              {
                responseText,
                handler: streamDecision.handlerName,
                intent: streamDecision.intent,
                routeType: streamDecision.routeType
              }
            )
          } catch (evaluationError) {
            aiGateway.logger.warn(requestId, "STREAM_EVALUATION_FAILED", {
              error: evaluationError?.message || "stream_evaluation_failed"
            })
          }
        }

        aiGateway.metrics.recordResponseEvaluation(requestId, evaluation, selfHealing)

        const streamLearningEnvelope = { learning }
        if (shouldPersistLearnedConversation(streamLearningEnvelope)) {
          saveConversationNonBlocking(userId, question, responseText, {
            provider: payload?.provider || "streaming_gateway",
            requestId,
            assistantProfile: promptPackage.profileId,
            activeModules: promptPackage.activeModules,
            domainSubmodules: promptPackage.domainSubmodules || {},
            bibleStudyModules: promptPackage.bibleStudyModules,
            promptPacks: promptPackage.promptPacks,
            evaluation: evaluation || null,
            selfHealing: selfHealing || null,
            learning: learning || null,
            orchestratorShadow: shadowPlan && !shadowPlan.error
              ? {
                strategy: shadowPlan.strategy,
                intentCategory: shadowPlan.intent?.category || "unknown",
                finalPromptLength: String(shadowPlan.finalPrompt || "").length
              }
              : null,
            streaming: true
          }, requestId)
        }

        aiGateway.metrics.recordRequest(requestId, Date.now() - startTime, true)
        aiGateway.metrics.recordUserActivity(userId, "ask_stream", {
          length: question.length
        })
        if (shouldPersistLearnedConversation(streamLearningEnvelope)) {
          appendConversationToStm(userId, enrichedData.request.sessionId || null, question, responseText)
        }

        aiGateway.logger.info(requestId, "STREAM_REQUEST_COMPLETED", {
          responseLength: responseText.length
        })

        writeSSE(res, "complete", {
          requestId,
          response: responseText,
          metadata: {
            processingTime: Date.now() - startTime,
            provider: payload?.provider || "streaming_gateway",
            assistantProfile: promptPackage.profileId,
            requestedAssistantProfile: promptPackage.requestedProfileId || enhancedContext.assistantProfile || null,
            activeModules: promptPackage.activeModules,
            domainSubmodules: promptPackage.domainSubmodules || {},
            bibleStudyModules: promptPackage.bibleStudyModules || [],
            askRoute: {
              handler: streamDecision.handlerName,
              intent: streamDecision.intent,
              routeType: streamDecision.routeType,
              decisionMs: streamDecision.decisionMs
            },
            weatherUsed: runtimeBuildWeatherClientMetadata(enhancedContext.agroWeather),
            languageUsed: buildLanguageRuntimeMetadata(streamEnhancedContext),
            memoryContext: runtimeContextResult.diagnostics,
            evaluation: evaluation || null,
            selfHealing: selfHealing || null,
            learning: learning || null,
            ragSources: streamEnhancedContext.ragSources || []
          }
        })
        clearHeartbeat()
        res.end()
      },
      async (payload) => {
        const streamErrorMessage = String(payload?.error || "Falha no streaming")
        try {
          const fallbackResult = await askGiomService(preparedPayload, { mode: "standard" })
          const responseText = String(fallbackResult.responseText || "").trim()
            || buildOperationalContingencyResponse(question, enhancedContext, streamErrorMessage)

          hasCompleted = true

          aiGateway.metrics.recordResponseEvaluation(requestId, fallbackResult.evaluation, fallbackResult.selfHealing)

          if (shouldPersistLearnedConversation(fallbackResult)) {
            saveConversationNonBlocking(userId, question, responseText, {
              provider: "streaming_fallback_standard",
              requestId,
              assistantProfile: promptPackage.profileId,
              activeModules: promptPackage.activeModules,
              domainSubmodules: promptPackage.domainSubmodules || {},
              bibleStudyModules: promptPackage.bibleStudyModules,
              promptPacks: promptPackage.promptPacks,
              evaluation: fallbackResult.evaluation || null,
              selfHealing: fallbackResult.selfHealing || null,
              learning: fallbackResult.learning || null,
              streaming: false,
              fallbackFromStreaming: true,
              askRoute: {
                handler: fallbackResult.handler,
                intent: fallbackResult.intent,
                routeType: fallbackResult.routeType
              }
            }, requestId)
          }

          aiGateway.metrics.recordRequest(requestId, Date.now() - startTime, true)
          aiGateway.metrics.recordUserActivity(userId, "ask_stream_fallback", {
            length: question.length,
            reason: "stream_provider_error"
          })
          if (shouldPersistLearnedConversation(fallbackResult)) {
            appendConversationToStm(userId, enrichedData.request.sessionId || null, question, responseText)
          }

          writeSSE(res, "complete", {
            requestId,
            response: responseText,
            metadata: {
              processingTime: Date.now() - startTime,
              provider: "standard_fallback",
              fallbackFromStreaming: true,
              assistantProfile: promptPackage.profileId,
              requestedAssistantProfile: promptPackage.requestedProfileId || enhancedContext.assistantProfile || null,
              activeModules: promptPackage.activeModules,
              domainSubmodules: promptPackage.domainSubmodules || {},
              bibleStudyModules: promptPackage.bibleStudyModules || [],
              askRoute: {
                handler: fallbackResult.handler,
                intent: fallbackResult.intent,
                routeType: fallbackResult.routeType
              },
              weatherUsed: runtimeBuildWeatherClientMetadata(streamEnhancedContext.agroWeather),
              languageUsed: buildLanguageRuntimeMetadata(streamEnhancedContext),
              memoryContext: runtimeContextResult.diagnostics,
              evaluation: fallbackResult.evaluation || null,
              selfHealing: fallbackResult.selfHealing || null,
              learning: fallbackResult.learning || null,
              ragSources: fallbackResult.ragSources || streamEnhancedContext.ragSources || []
            }
          })
          clearHeartbeat()
          res.end()
          return
        } catch (fallbackError) {
          aiGateway.metrics.recordRequest(requestId, Date.now() - startTime, false)
          aiGateway.metrics.recordError("ask_stream_fallback_error", fallbackError, {
            requestId
          })
          writeSSE(res, "error", {
            requestId,
            error: fallbackError.message || streamErrorMessage
          })
          clearHeartbeat()
          res.end()
          return
        }
      }
    )
  } catch (error) {
    if (!hasCompleted) {
      aiGateway.logger.error(requestId, "STREAM_REQUEST_FAILED", {
        error: error.message,
        stack: error.stack
      })
      writeSSE(res, "error", {
        requestId,
        error: error.message || "Falha ao processar streaming",
        code: error.code || "STREAM_FAILED"
      })
      clearHeartbeat()
      res.end()
    }
  }
})

// Feedback explícito do usuário
app.post("/feedback", async (req, res) => {
  try {
    const { requestId, rating, comment } = req.body || {}
    if (!requestId || typeof rating !== "number") {
      return res.status(400).json({ error: "Feedback inválido", code: "INVALID_FEEDBACK" })
    }

    const userId = req.get('X-User-Id') || req.ip || 'default_user'
    await grootMemoryConnector.saveFeedback(userId, requestId, rating, comment)

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: "Falha ao salvar feedback" })
  }
})

app.get("/evaluation/packs", requireAdmin, (_req, res) => {
  res.json({
    dimensions: listEvaluationDimensions(),
    packs: listEvaluationPacks(),
    note: "Consciencia operacional avalia honestidade sobre capacidades e limites, sem alegar consciencia real."
  })
})

app.post("/evaluation/conversation", requireAdmin, async (req, res) => {
  const requestId = `eval_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  try {
    const { message, context = {}, history = [], tags = [], sessionId } = req.body || {}

    if (!message || !String(message).trim()) {
      return res.status(400).json({
        error: "Mensagem obrigatoria para avaliacao",
        code: "EVAL_MESSAGE_REQUIRED"
      })
    }

    const evaluationUserId = String(sessionId || req.get("X-User-Id") || req.ip || "evaluation_user")
    const preparedContext = await buildRuntimeConversationContext(String(message), context, {
      userId: evaluationUserId,
      requestId,
      evaluationMode: true,
      conversationHistory: Array.isArray(history) ? history : []
    })
    const researchCapabilities = preparedContext.researchCapabilities

    const responseText = await askGiom(String(message), preparedContext)
    const evaluation = evaluateConversationTurn({
      userMessage: String(message),
      aiResponse: responseText,
      history: Array.isArray(history) ? history : [],
      researchCapabilities,
      tags: Array.isArray(tags) ? tags : []
    })

    await persistEvaluationArtifacts(evaluationUserId, requestId, evaluation, {
      mode: "conversation_lab",
      contextKeys: Object.keys(context || {}),
      tags: Array.isArray(tags) ? tags : []
    })

    res.json({
      success: true,
      requestId,
      sessionId: evaluationUserId,
      response: responseText,
      evaluation,
      capabilities: {
        research: researchCapabilities
      }
    })
  } catch (error) {
    aiGateway.logger.error(requestId, "EVALUATION_CONVERSATION_FAILED", {
      error: error.message
    })
    res.status(500).json({
      error: "Falha ao avaliar conversa",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
      code: "EVALUATION_FAILED",
      requestId
    })
  }
})

app.post("/evaluation/run", requireAdmin, async (req, res) => {
  const benchmarkId = `benchmark_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  try {
    const { packId = "core_diagnostics" } = req.body || {}
    const benchmarkUserId = `${benchmarkId}_user`

    const benchmark = await runConversationBenchmark({
      packId,
      researchCapabilities: getResearchCapabilities(),
      requestTurn: async ({ scenario, turn, history }) => {
        const requestId = `bench_${scenario.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const scenarioUserId = `${benchmarkUserId}_${scenario.id}`
        const context = await buildRuntimeConversationContext(turn.question, {
          ...(turn.context || {}),
          userId: scenarioUserId,
          requestId,
          evaluationMode: true,
          evaluationScenario: scenario.id,
          conversationHistory: history
        })

        const answer = await askGiom(turn.question, context)
        return {
          answer,
          requestId,
          metadata: {
            scenarioUserId
          }
        }
      }
    })

    for (const turn of benchmark.turns) {
      const evaluationRequestId = turn.metadata?.requestId || `${benchmarkId}_${turn.scenarioId}`
      await persistEvaluationArtifacts(benchmarkUserId, evaluationRequestId, turn.evaluation, {
        mode: "benchmark_turn",
        packId,
        scenarioId: turn.scenarioId
      })
    }

    await grootMemoryConnector.saveLearningPattern(
      benchmarkUserId,
      "conversation_benchmark_summary",
      {
        benchmarkId,
        packId,
        summary: benchmark.summary,
        turns: benchmark.turns.map((turn) => ({
          scenarioId: turn.scenarioId,
          score: turn.evaluation.score,
          issues: turn.evaluation.issues
        }))
      },
      benchmark.summary.score
    )

    res.json({
      success: true,
      benchmarkId,
      sessionId: benchmarkUserId,
      ...benchmark
    })
  } catch (error) {
    aiGateway.logger.error(benchmarkId, "BENCHMARK_FAILED", {
      error: error.message
    })
    res.status(500).json({
      error: "Falha ao rodar benchmark do GIOM",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
      code: "BENCHMARK_FAILED",
      benchmarkId
    })
  }
})

// Endpoints avançados para developers
app.post("/analyze", async (req, res) => {
  const requestId = `analyze_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    const { code, language, type = 'general' } = req.body

    if (!code) {
      return res.status(400).json({ error: "Código não fornecido" })
    }

    const context = {
      fileInfo: {
        language,
        type
      },
      analysis: true
    }

    const question = `Analise este código ${language}: ${code.substring(0, 10000)}`
    const answer = await askGroot(question, context)

    res.json({
      analysis: answer,
      requestId,
      metadata: {
        codeLength: code.length,
        language,
        type
      }
    })

  } catch (error) {
    aiGateway.logger.error(requestId, 'ANALYSIS_FAILED', { error: error.message })
    res.status(500).json({ error: "Falha na análise" })
  }
})

// Code review endpoint
app.post("/review", async (req, res) => {
  const requestId = `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    const { code, language, guidelines = [] } = req.body

    if (!code) {
      return res.status(400).json({ error: "Código não fornecido" })
    }

    const context = {
      fileInfo: {
        language,
        type: 'review'
      },
      review: true,
      guidelines
    }

    const question = `Faça um code review deste código ${language}, seguindo estas diretrizes: ${guidelines.join(', ')}\n\nCódigo:\n${code}`
    const answer = await askGroot(question, context)

    res.json({
      review: answer,
      requestId,
      metadata: {
        codeLength: code.length,
        language,
        guidelinesCount: guidelines.length
      }
    })

  } catch (error) {
    aiGateway.logger.error(requestId, 'REVIEW_FAILED', { error: error.message })
    res.status(500).json({ error: "Falha no code review" })
  }
})

// Bible API (YouVersion Platform) - requer YVP_APP_KEY
app.get("/bible/passage", async (req, res) => {
  const requestId = `bible_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    const passage = String(req.query.passage || '').trim()
    const bibleId = String(req.query.bibleId || '').trim()
    const bibleCode = String(req.query.bibleCode || '').trim()

    if (!passage) {
      return res.status(400).json({
        error: "Passagem não informada. Use ?passage=JHN.3.16",
        code: "MISSING_PASSAGE",
        requestId
      })
    }

    const data = await fetchBiblePassage({ bibleId, bibleCode, passage })

    res.json({
      data,
      source: data?.source || data?.provider || "youversion",
      requestId
    })
  } catch (error) {
    res.status(500).json({
      error: "Falha ao consultar a Bíblia",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
      code: "BIBLE_API_ERROR",
      requestId
    })
  }
})

const PORT = process.env.PORT || 3002

const server = app.listen(PORT, () => {
  console.log(`🚀 ${AI_ENTERPRISE_NAME} rodando em http://localhost:${PORT}`)
  console.log(`📊 Metrics: http://localhost:${PORT}/metrics`)
  console.log(`📋 Logs: http://localhost:${PORT}/logs`)
  console.log(`🔧 Admin: http://localhost:${PORT}/admin`)
})

// Mantém conexões keep-alive abertas por 65s (> timeout padrão do proxy Next.js de 60s).
// headersTimeout > keepAliveTimeout evita corrida entre servidor e cliente ao fechar
// a conexão simultaneamente (causa do primeiro request "caindo").
server.keepAliveTimeout = Number(process.env.SERVER_KEEPALIVE_TIMEOUT_MS || 65_000)
server.headersTimeout = Number(process.env.SERVER_HEADERS_TIMEOUT_MS || 66_000)

// Graceful shutdown enterprise
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM recebido, encerrando servidor enterprise...')
  server.close(() => {
    console.log('✅ Servidor encerrado')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('\n🔄 SIGINT recebido, encerrando servidor enterprise...')
  server.close(() => {
    console.log('✅ Servidor encerrado')
    process.exit(0)
  })
})

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
  process.exit(1)
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Porta ${PORT} já está em uso.`)
    console.error(`   Tente: npx kill-port ${PORT}`)
  } else {
    console.error('❌ Erro no servidor:', error)
  }
  process.exit(1)
})
