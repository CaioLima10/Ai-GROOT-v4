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
  registerEnterpriseAskRoutes,
  registerEnterpriseAdminRoutes,
  registerEnterpriseBibleRoutes,
  registerEnterpriseCompatRoutes,
  registerEnterpriseFeedbackRoutes,
  registerEnterpriseKnowledgeRoutes,
  registerEnterpriseMediaRoutes,
  registerEnterprisePublicRoutes,
  registerEnterpriseQualityRoutes,
  registerEnterpriseResearchRoutes
} from "./enterpriseRouteRegistrarsRuntime.js"
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
import {
  buildFastDirectAiOptions,
  buildFastDirectPromptPackage,
  shouldUseFastDirectAnswer
} from "./enterpriseFastPathRuntime.js"

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
        const userQuestion = String(context?.originalQuestion || question || "").trim()
        const fastPathEnabled = shouldUseFastDirectAnswer(userQuestion || question, context)

        if (fastPathEnabled) {
          try {
            const fastResponse = String(
              await aiProviders.askMultiAI(userQuestion || question, buildFastDirectAiOptions(context))
            ).trim()

            if (fastResponse) {
              return {
                success: true,
                response: fastResponse,
                contextEnhancements: {
                  promptPackage: buildFastDirectPromptPackage(context),
                  ragSources: Array.isArray(context?.ragSources) ? context.ragSources : [],
                  fastPath: {
                    enabled: true,
                    strategy: "direct_provider"
                  }
                }
              }
            }
          } catch (error) {
            console.warn("[fastPath] direct provider failed; falling back to orchestrator.", error?.message || error)
          }
        }

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

const ORCHESTRATOR_PROVIDER_CONTEXT_TIMEOUT_MS = Math.max(
  250,
  Number(process.env.GIOM_ORCHESTRATOR_PROVIDER_CONTEXT_TIMEOUT_MS || 2_500)
)

function buildFallbackStreamingPromptPackage(context = {}) {
  return {
    systemPrompt: null,
    profileId: String(context.assistantProfile || "auto"),
    requestedProfileId: context.assistantProfile || null,
    activeModules: Array.isArray(context.activeModules) ? context.activeModules : [],
    domainSubmodules: context.domainSubmodules || {},
    bibleStudyModules: Array.isArray(context.bibleStudyModules) ? context.bibleStudyModules : [],
    promptPacks: Array.isArray(context.promptPacks) ? context.promptPacks : []
  }
}

async function buildStreamingPromptPackage(question, context = {}) {
  const result = await Promise.race([
    buildAssistantPromptContext(question, context, {
      limit: 6,
      userStyle: "natural"
    }).then((promptPackage) => ({
      promptPackage,
      timedOut: false,
      error: null
    })).catch((error) => ({
      promptPackage: null,
      timedOut: false,
      error
    })),
    new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          promptPackage: null,
          timedOut: true,
          error: null
        })
      }, ORCHESTRATOR_PROVIDER_CONTEXT_TIMEOUT_MS)
    })
  ])

  if (result?.timedOut) {
    console.warn("[giomOrchestrator] buildAssistantPromptContext timed out; using minimal streaming prompt package.")
    return buildFallbackStreamingPromptPackage(context)
  }

  if (result?.error) {
    console.warn("[giomOrchestrator] buildAssistantPromptContext failed; using minimal streaming prompt package.", result.error?.message || result.error)
    return buildFallbackStreamingPromptPackage(context)
  }

  return result?.promptPackage || buildFallbackStreamingPromptPackage(context)
}

async function buildOrchestratorPlanWithTimeout(question, context = {}, timeoutMs = ORCHESTRATOR_PROVIDER_CONTEXT_TIMEOUT_MS) {
  const result = await Promise.race([
    giomOrchestrator.buildResponsePlan(question, {
      ...context,
      userStyle: context.userStyle || "natural"
    }).then((plan) => ({
      plan,
      timedOut: false,
      error: null
    })).catch((error) => ({
      plan: null,
      timedOut: false,
      error
    })),
    new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          plan: null,
          timedOut: true,
          error: null
        })
      }, timeoutMs)
    })
  ])

  return result
}

async function buildAskProviderContext(question, context = {}) {
  const result = await buildOrchestratorPlanWithTimeout(question, context)
  const plan = result?.plan || null

  if (result?.timedOut) {
    console.warn("[giomOrchestrator] buildResponsePlan timed out while preparing provider context; using direct question fallback.")
  } else if (result?.error) {
    console.warn("[giomOrchestrator] buildResponsePlan failed while preparing provider context; using direct question fallback.", result.error?.message || result.error)
  }

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
    const result = await buildOrchestratorPlanWithTimeout(question, context, 250)
    if (result?.timedOut) {
      return {
        error: true,
        message: "orchestrator_shadow_timeout"
      }
    }
    if (result?.error) {
      return {
        error: true,
        message: result.error?.message || "orchestrator_shadow_failed"
      }
    }
    return result?.plan || null
  } catch (error) {
    return {
      error: true,
      message: error?.message || "orchestrator_shadow_failed"
    }
  }
}

function buildOrchestratorShadowEnvelope(shadowPlan, fastPathEnabled = false) {
  if (fastPathEnabled) {
    return {
      enabled: false,
      reason: "fast_direct_path"
    }
  }

  if (shadowPlan && !shadowPlan.error) {
    return {
      enabled: true,
      strategy: shadowPlan.strategy,
      intentCategory: shadowPlan.intent?.category || "unknown"
    }
  }

  return {
    enabled: orchestratorShadowEnabled,
    error: shadowPlan?.message || null
  }
}

// Frontend legado removido do runtime oficial para evitar rotas ambíguas.
// O frontend suportado é exclusivamente o app Next.js em apps/web-next.

// Root health/info route
registerEnterprisePublicRoutes(app, {
  AI_ENTERPRISE_NAME,
  AI_SERVICE_SLUG,
  grootAdvancedRAG,
  buildRuntimeCapabilityMatrix,
  getResearchCapabilities,
  getLiveResearchRuntime,
  aiProviders,
  grootEmbeddings,
  listAssistantProfiles,
  listDomainModules,
  listModuleEnhancementPlans,
  listPlannedModules,
  listBibleStudyModules,
  listCompatModels,
  listPromptPacks,
  isImageGenerationEnabled,
  imageGenerationModel,
  IMAGE_STYLE_PRESETS,
  IMAGE_RATIO_DIMENSIONS,
  imageGenerationMinDimension,
  imageGenerationMaxDimension,
  documentGenerationFormats,
  uploadOcrEnabled,
  uploadTtlMinutes,
  listEvaluationDimensions,
  listEvaluationPacks,
  SUPPORTED_UPLOAD_ACCEPT,
  getUploadCapabilities,
  uploadMaxBytes,
  listCapabilityHighlights
})

registerEnterpriseResearchRoutes(app, {
  askLimiter,
  getResearchCapabilities,
  hasGoogleCustomSearchConfigured,
  sanitizeWeatherLocationQuery,
  resolveWeatherLocationByQuery: runtimeResolveWeatherLocationByQuery,
  getVerifiedRuntimeClock,
  fetchWeatherForecastPayload: runtimeFetchWeatherForecastPayload,
  buildWeatherSnapshot: runtimeBuildWeatherSnapshot,
  performGoogleCustomSearch,
  resolveNextFixtureFromQuestion,
  listSportsDataIoEndpoints,
  resolveSportsDataIoEndpoint,
  fetchSportsDataIo
})

registerEnterpriseKnowledgeRoutes(app, {
  grootAdvancedRAG,
  AI_KNOWLEDGE_SERVICE_SLUG,
  listBibleStudyModules
})

registerEnterpriseCompatRoutes(app, {
  crypto,
  listCompatModels,
  AI_MODEL_OWNER,
  resolveCompatModel,
  buildQuestionFromMessages,
  buildQuestionFromGeminiContents,
  flattenMessageContent,
  estimateUsage,
  askGroot,
  getCompatContext
})

const requireAdmin = createRequireAdminMiddleware({ crypto })

registerEnterpriseAdminRoutes(app, {
  requireAdmin,
  buildHealthSnapshot,
  aiGateway,
  grootAdvancedRAG,
  AI_SERVICE_SLUG,
  memoryContextMetrics,
  memoryMetricsNodeId,
  getLanguageRuntimeStatus,
  cleanupLanguageRuntimeCache
})

registerEnterpriseMediaRoutes(app, {
  askLimiter,
  askSlowDown,
  fs,
  path,
  crypto,
  UPLOAD_DIR,
  uploads,
  uploadTtlMinutes,
  uploadMaxBytes,
  parseBase64Payload,
  ensureUploadDir,
  safeFilename,
  detectMimeFromMagic,
  normalizeUploadMime,
  isAllowedUploadByAccept,
  isMimeCompatibleWithExtension,
  scheduleUploadCleanup,
  resolveUploadExtraction,
  resolveUploadQuotaContext,
  getUploadQuotaStatus,
  consumeUploadQuota,
  resolveImageQuotaContext,
  getImageQuotaStatus,
  consumeImageQuota,
  parseImageGenerationRequest,
  buildImageStylePresetPrompt,
  generateImageWithProvider,
  detectSafetyRisk,
  buildSafetyResponse,
  normalizeDocumentFormat,
  sanitizeDocumentTitle,
  sanitizeAskContext,
  buildDocumentDraftPrompt,
  documentGenerationFormatIds,
  getResearchCapabilities,
  buildRuntimeCapabilityMatrix,
  askGiom,
  generateStructuredDocument,
  grootMemoryConnector
})

registerEnterpriseAskRoutes(app, {
  askLimiter,
  askSlowDown,
  getAskContextDiagnostics,
  buildPreparedAskPayloadFromHttp,
  uploads,
  resolveUploadExtraction,
  buildUploadExtractionBlock,
  askGiomService,
  buildRuntimeContext,
  runtimeSessionMemoryStore,
  retrievalPort,
  buildRuntimeConversationContext,
  aiGateway,
  memoryContextMetrics,
  shouldUseFastDirectAnswer,
  buildFastDirectPromptPackage,
  buildStreamingPromptPackage,
  buildShadowOrchestratorPlan,
  buildOrchestratorShadowEnvelope,
  shouldPersistLearnedConversation,
  saveConversationNonBlocking,
  appendConversationToStm,
  runtimeBuildWeatherClientMetadata,
  buildLanguageRuntimeMetadata,
  buildOperationalContingencyResponse,
  writeSSE,
  buildAskProviderContext,
  buildFastDirectAiOptions,
  streamingGateway,
  postProcessAssistantResponse,
  evaluateResponse,
  selfHealResponse,
  askGroot,
  normalizeAnswerText,
  processEvaluation
})

// Feedback explícito do usuário
registerEnterpriseFeedbackRoutes(app, {
  grootMemoryConnector
})

registerEnterpriseQualityRoutes(app, {
  requireAdmin,
  aiGateway,
  listEvaluationDimensions,
  listEvaluationPacks,
  buildRuntimeConversationContext,
  askGiom,
  evaluateConversationTurn,
  persistEvaluationArtifacts,
  getResearchCapabilities,
  runConversationBenchmark,
  grootMemoryConnector,
  askGroot
})

// Bible API (YouVersion Platform) - requer YVP_APP_KEY
registerEnterpriseBibleRoutes(app, {
  fetchBiblePassage
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
