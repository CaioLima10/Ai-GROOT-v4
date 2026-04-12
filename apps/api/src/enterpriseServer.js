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
  listBibleLearningTracks,
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
  buildAssistantPrompt,
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
  buildTableCardResponse,
  isTableCardPreferred,
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
  sanitizeGeneratedDocumentContent,
  sanitizeDocumentTitle
} from "./enterpriseDocumentRuntime.js"
import { buildRuntimeCapabilityMatrix } from "./enterpriseCapabilityRuntime.js"
import { createEnterpriseTraceStore } from "./enterpriseTraceRuntime.js"
import { createEnterpriseToolRegistry } from "./enterpriseToolRegistryRuntime.js"
import { createEnterpriseJobManager } from "./enterpriseJobsRuntime.js"
import { createEnterpriseLocalVoiceRuntime } from "./enterpriseLocalVoiceRuntime.js"
import { createEnterpriseVoiceRuntime } from "./enterpriseVoiceRuntime.js"
import { createEnterpriseLongMemoryRuntime } from "./enterpriseLongMemoryRuntime.js"
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
  registerEnterpriseResearchRoutes,
  registerEnterpriseVoiceRoutes
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
import { resolveOperationalRuntimeShortcut } from "./enterpriseOperationalShortcutsRuntime.js"

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

const traceStore = createEnterpriseTraceStore({
  logger: aiGateway.logger,
  service: AI_SERVICE_SLUG,
  version: process.env.npm_package_version || "2.1.0"
})

app.use(traceStore.createRequestMiddleware())

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
  isTableCardPreferred,
  buildTableCardResponse,
  isInterpretiveBibleQuestion,
  refineBibleInterpretiveResponse,
  buildGreetingLead,
  detectSafetyRisk,
  buildSafetyResponse,
  runtimeIsAgroWeatherRelevant
}

function escapeSvgText(text = "") {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function hashPromptSeed(input = "") {
  return Array.from(String(input || "")).reduce((hash, char) => {
    return (hash * 33 + char.charCodeAt(0)) >>> 0
  }, 5381)
}

function extractPromptSummary(prompt = "") {
  const firstLine = String(prompt || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || ""

  return firstLine.replace(/\s+/g, " ").trim()
}

function buildImageFallbackKeywords(prompt = "") {
  const stopwords = new Set([
    "de", "da", "do", "das", "dos", "um", "uma", "para", "com", "sem", "sobre", "the", "and", "style", "guidance", "requested", "aspect", "ratio", "target", "size"
  ])

  const words = extractPromptSummary(prompt)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9]{3,}/g) || []

  const unique = []
  for (const word of words) {
    if (stopwords.has(word)) {
      continue
    }

    if (!unique.includes(word)) {
      unique.push(word)
    }

    if (unique.length >= 3) {
      break
    }
  }

  return unique
}

function buildLocalFallbackImage(prompt, options = {}, meta = {}) {
  const ratioPreset = IMAGE_RATIO_DIMENSIONS[options.aspectRatio] || IMAGE_RATIO_DIMENSIONS["1:1"]
  const width = Number(options.width) || ratioPreset.width
  const height = Number(options.height) || ratioPreset.height
  const summary = extractPromptSummary(prompt) || "Ilustracao GIOM"
  const headline = summary.split(/\s+/).slice(0, 6).join(" ") || "Ilustracao GIOM"
  const subtitle = summary.length > 120 ? `${summary.slice(0, 117).trim()}...` : summary
  const keywords = buildImageFallbackKeywords(prompt)
  const seed = hashPromptSeed(`${prompt}|${width}|${height}|${options.stylePreset || ""}`)
  const palettes = [
    ["#0f172a", "#1d4ed8", "#f8fafc", "#38bdf8"],
    ["#172554", "#0f766e", "#ecfeff", "#67e8f9"],
    ["#1f2937", "#b45309", "#fff7ed", "#f59e0b"],
    ["#111827", "#be123c", "#fff1f2", "#fb7185"]
  ]
  const palette = palettes[seed % palettes.length]
  const circleA = 120 + (seed % Math.max(140, Math.floor(width * 0.18)))
  const circleB = 180 + (seed % Math.max(180, Math.floor(height * 0.2)))
  const shapeShift = 80 + (seed % 220)
  const keywordRow = keywords.length > 0
    ? `<text x="72" y="${height - 104}" font-size="28" font-family="Segoe UI, Arial, sans-serif" fill="${palette[2]}" opacity="0.88">${escapeSvgText(keywords.join("   "))}</text>`
    : ""
  const fallbackLabel = meta.reason
    ? `<text x="72" y="${height - 56}" font-size="22" font-family="Segoe UI, Arial, sans-serif" fill="${palette[2]}" opacity="0.74">Fallback local ativo: ${escapeSvgText(String(meta.reason).slice(0, 72))}</text>`
    : ""
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeSvgText(subtitle)}">
      <defs>
        <linearGradient id="giom-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${palette[0]}"/>
          <stop offset="55%" stop-color="${palette[1]}"/>
          <stop offset="100%" stop-color="${palette[0]}"/>
        </linearGradient>
        <radialGradient id="giom-glow" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stop-color="${palette[3]}" stop-opacity="0.92"/>
          <stop offset="100%" stop-color="${palette[3]}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" rx="36" fill="url(#giom-bg)"/>
      <circle cx="${Math.round(width * 0.78)}" cy="${Math.round(height * 0.22)}" r="${circleA}" fill="url(#giom-glow)" opacity="0.7"/>
      <circle cx="${Math.round(width * 0.18)}" cy="${Math.round(height * 0.82)}" r="${circleB}" fill="url(#giom-glow)" opacity="0.34"/>
      <rect x="48" y="48" width="${width - 96}" height="${height - 96}" rx="28" fill="rgba(15,23,42,0.18)" stroke="rgba(248,250,252,0.18)"/>
      <path d="M ${Math.round(width * 0.14)} ${Math.round(height * 0.72)} C ${Math.round(width * 0.28)} ${Math.round(height * 0.48)}, ${Math.round(width * 0.42)} ${Math.round(height * 0.88)}, ${Math.round(width * 0.56)} ${Math.round(height * 0.6)} S ${Math.round(width * 0.84)} ${Math.round(height * 0.36)}, ${Math.round(width * 0.9)} ${Math.round(height * 0.58)}" fill="none" stroke="${palette[2]}" stroke-width="12" stroke-linecap="round" opacity="0.18"/>
      <circle cx="${Math.round(width * 0.72)}" cy="${Math.round(height * 0.34)}" r="${shapeShift}" fill="none" stroke="${palette[2]}" stroke-width="4" opacity="0.12"/>
      <text x="72" y="112" font-size="28" font-family="Segoe UI, Arial, sans-serif" fill="${palette[2]}" opacity="0.84">GIOM visual</text>
      <text x="72" y="${Math.round(height * 0.44)}" font-size="${Math.max(42, Math.min(72, Math.round(width / 14)))}" font-family="Segoe UI, Arial, sans-serif" font-weight="700" fill="${palette[2]}">${escapeSvgText(headline)}</text>
      <text x="72" y="${Math.round(height * 0.52)}" font-size="30" font-family="Segoe UI, Arial, sans-serif" fill="${palette[2]}" opacity="0.84">${escapeSvgText(subtitle)}</text>
      ${keywordRow}
      ${fallbackLabel}
    </svg>
  `.trim()

  return {
    mimeType: "image/svg+xml",
    base64: Buffer.from(svg, "utf8").toString("base64"),
    model: "local-svg-fallback",
    provider: "local-svg",
    fallback: true,
    controls: {
      stylePreset: options.stylePreset || null,
      aspectRatio: options.aspectRatio || null,
      width,
      height,
      negativePrompt: options.negativePrompt || null,
      guidanceScale: options.guidanceScale || null,
      numInferenceSteps: options.numInferenceSteps || null,
      seed: options.seed ?? null
    }
  }
}

async function generateImageWithProvider(prompt, options = {}) {
  const token = getImageGenerationToken()
  if (!token) {
    return buildLocalFallbackImage(prompt, options, { reason: "sem provider externo" })
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

  try {
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
  } catch (error) {
    console.warn("[imageGeneration] provider failed, using local fallback:", error?.message || error)
    return buildLocalFallbackImage(prompt, options, {
      reason: error?.message || "falha no provider"
    })
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
        const operationalShortcut = resolveOperationalRuntimeShortcut(userQuestion || question, context)

        if (operationalShortcut) {
          return {
            success: true,
            response: operationalShortcut,
            contextEnhancements: {
              ragSources: Array.isArray(context?.ragSources) ? context.ragSources : [],
              operationalShortcut: true
            }
          }
        }

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

const longMemoryRuntime = createEnterpriseLongMemoryRuntime({
  connector: grootMemoryConnector,
  runtimeSessionMemoryStore,
  logger: aiGateway.logger,
  summaryTurnThreshold: Number(process.env.GIOM_LONG_MEMORY_SUMMARY_TURN_THRESHOLD || 8),
  summaryCharThreshold: Number(process.env.GIOM_LONG_MEMORY_SUMMARY_CHAR_THRESHOLD || 900),
  summaryCooldownMs: Number(process.env.GIOM_LONG_MEMORY_SUMMARY_COOLDOWN_MS || 45_000)
})

const jobManager = createEnterpriseJobManager({
  logger: aiGateway.logger,
  traceStore,
  concurrency: Number(process.env.GIOM_ASYNC_JOB_CONCURRENCY || 2),
  maxJobs: Number(process.env.GIOM_ASYNC_JOB_MAX_ITEMS || 500)
})

const toolRegistry = createEnterpriseToolRegistry({
  logger: aiGateway.logger,
  traceStore,
  maxExecutions: Number(process.env.GIOM_TOOL_EXECUTIONS_MAX || 400)
})

const localVoiceRuntime = createEnterpriseLocalVoiceRuntime({
  logger: aiGateway.logger
})

const voiceRuntime = createEnterpriseVoiceRuntime({
  logger: aiGateway.logger,
  maxSessions: Number(process.env.GIOM_VOICE_MAX_SESSIONS || 200),
  maxEventsPerSession: Number(process.env.GIOM_VOICE_MAX_EVENTS || 250),
  sessionTtlMs: Number(process.env.GIOM_VOICE_SESSION_TTL_MS || 6 * 60 * 60 * 1000),
  resolveCapabilities: () => localVoiceRuntime.buildSessionCapabilities()
})

toolRegistry.registerTool({
  id: "weather.lookup",
  title: "Consultar clima",
  description: "Busca previsao do tempo e contexto meteorologico ao vivo.",
  category: "research",
  timeoutMs: 10_000,
  grounding: {
    mode: "weather_api",
    provider: "open-meteo"
  },
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      city: { type: "string", minLength: 2, maxLength: 120 },
      latitude: { type: "number", minimum: -90, maximum: 90, coerce: true },
      longitude: { type: "number", minimum: -180, maximum: 180, coerce: true },
      timezone: { type: "string", default: "auto", maxLength: 80 },
      days: { type: "integer", minimum: 1, maximum: 7, default: 3, coerce: true }
    }
  },
  outputDescription: "Retorna forecast estruturado, localizacao resolvida e provider.",
  enabled: () => Boolean(getResearchCapabilities().weatherForecast),
  execute: async (input = {}) => {
    const runtimeResearchCapabilities = getResearchCapabilities()
    if (!runtimeResearchCapabilities.weatherForecast) {
      const error = new Error("Consulta de clima ao vivo nao habilitada nesta execucao.")
      error.code = "WEATHER_FORECAST_DISABLED"
      error.statusCode = 503
      throw error
    }

    const forecastDays = Math.max(1, Math.min(Number(input.days || 3) || 3, 7))
    const cityQuery = sanitizeWeatherLocationQuery(String(input.city || ""))
    let resolvedLocation = null

    if (cityQuery) {
      resolvedLocation = await runtimeResolveWeatherLocationByQuery(cityQuery, forecastDays, { question: cityQuery })
      if (!resolvedLocation) {
        const error = new Error(`Nao encontrei a localidade ${cityQuery}.`)
        error.code = "WEATHER_LOCATION_NOT_FOUND"
        error.statusCode = 404
        throw error
      }
    } else if (Number.isFinite(Number(input.latitude)) && Number.isFinite(Number(input.longitude))) {
      resolvedLocation = {
        latitude: Number(input.latitude),
        longitude: Number(input.longitude),
        timezone: String(input.timezone || "auto"),
        forecastDays
      }
    } else {
      const error = new Error("Informe city ou latitude/longitude validas para consultar o clima.")
      error.code = "WEATHER_COORDINATES_REQUIRED"
      error.statusCode = 400
      throw error
    }

    const weatherClock = await getVerifiedRuntimeClock(resolvedLocation.timezone || String(input.timezone || "Etc/UTC"))
    const payload = await runtimeFetchWeatherForecastPayload(resolvedLocation)

    return {
      provider: "open-meteo",
      forecastDays,
      timezone: resolvedLocation.timezone || String(input.timezone || "auto"),
      location: {
        label: resolvedLocation.label || null,
        city: resolvedLocation.city || cityQuery || null,
        region: resolvedLocation.region || null,
        country: resolvedLocation.country || null,
        countryCode: resolvedLocation.countryCode || null
      },
      data: runtimeBuildWeatherSnapshot(payload, resolvedLocation, weatherClock)
    }
  }
})

toolRegistry.registerTool({
  id: "search.web",
  title: "Pesquisa web",
  description: "Executa busca web ou de imagem com grounding explicitado.",
  category: "research",
  timeoutMs: 12_000,
  grounding: {
    mode: "live_search",
    provider: "google-custom-search"
  },
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["query"],
    properties: {
      query: { type: "string", minLength: 2, maxLength: 240 },
      searchType: { type: "string", enum: ["web", "image"], default: "web" },
      num: { type: "integer", minimum: 1, maximum: 10, default: 5, coerce: true },
      hl: { type: "string", default: "pt-BR", maxLength: 20 },
      gl: { type: "string", default: "br", maxLength: 8 }
    }
  },
  outputDescription: "Retorna itens pesquisados com provider e tipo de busca.",
  enabled: () => Boolean(getResearchCapabilities().google && hasGoogleCustomSearchConfigured()),
  execute: async (input = {}) => {
    const runtimeResearchCapabilities = getResearchCapabilities()
    if (!runtimeResearchCapabilities.google || !hasGoogleCustomSearchConfigured()) {
      const error = new Error("Pesquisa Google ao vivo nao habilitada nesta execucao.")
      error.code = "GOOGLE_SEARCH_DISABLED"
      error.statusCode = 503
      throw error
    }

    const payload = await performGoogleCustomSearch(String(input.query || ""), {
      num: Math.max(1, Math.min(Number(input.num || 5) || 5, 10)),
      searchType: String(input.searchType || "web") === "image" ? "image" : "web",
      hl: String(input.hl || "pt-BR"),
      gl: String(input.gl || "br")
    })

    return {
      provider: payload.provider,
      searchType: payload.searchType,
      items: payload.items
    }
  }
})

toolRegistry.registerTool({
  id: "sports.lookup",
  title: "Consultar esportes",
  description: "Busca agenda esportiva e proximos confrontos.",
  category: "research",
  timeoutMs: 10_000,
  grounding: {
    mode: "sports_api",
    provider: "thesportsdb"
  },
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["query"],
    properties: {
      query: { type: "string", minLength: 2, maxLength: 180 }
    }
  },
  outputDescription: "Retorna fixture estruturado do esporte consultado.",
  enabled: () => Boolean(getResearchCapabilities().sportsSchedule),
  execute: async (input = {}) => {
    const runtimeResearchCapabilities = getResearchCapabilities()
    if (!runtimeResearchCapabilities.sportsSchedule) {
      const error = new Error("Consulta esportiva ao vivo nao habilitada nesta execucao.")
      error.code = "SPORTS_SCHEDULE_DISABLED"
      error.statusCode = 503
      throw error
    }

    const fixture = await resolveNextFixtureFromQuestion(String(input.query || ""))
    if (!fixture) {
      const error = new Error("Nao encontrei agenda esportiva para a consulta informada.")
      error.code = "SPORTS_LOOKUP_EMPTY"
      error.statusCode = 404
      throw error
    }

    return {
      provider: fixture.provider || "thesportsdb",
      data: fixture
    }
  }
})

toolRegistry.registerTool({
  id: "system.capabilities",
  title: "Capacidades do runtime",
  description: "Explica as capacidades ativas do GIOM nesta execucao.",
  category: "system",
  timeoutMs: 2_000,
  grounding: {
    mode: "internal_runtime",
    provider: "giom"
  },
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {}
  },
  outputDescription: "Retorna capability matrix, profiles e status de tools/jobs.",
  execute: async () => ({
    capabilityMatrix: buildRuntimeCapabilityMatrix(),
    research: getResearchCapabilities(),
    compatModels: listCompatModels(),
    assistantProfiles: listAssistantProfiles(),
    jobs: jobManager.getSummary(),
    tools: toolRegistry.getSummary()
  })
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

const RUNTIME_FALLBACK_MAX_PROMPT_CHARS = 9_000

function truncateProviderPromptSection(text = "", maxChars = 3_200) {
  const normalized = String(text || "").trim()
  if (normalized.length <= maxChars) return normalized
  return `${normalized.slice(0, Math.max(0, maxChars - 3)).trim()}...`
}

function buildRecentConversationTextFromRuntimeContext(context = {}, limit = 6) {
  const history = Array.isArray(context?.conversationHistory) ? context.conversationHistory : []
  return history
    .slice(-Math.max(1, Number(limit || 6)))
    .map((turn) => {
      const role = turn?.role === "assistant" ? "GIOM" : "Usuario"
      const content = String(turn?.content || "").trim()
      if (!content) return ""
      return `${role}: ${content}`
    })
    .filter(Boolean)
    .join("\n")
}

function buildKnownFactsTextFromRuntimeContext(context = {}) {
  const profile = context?.memoryProfile && typeof context.memoryProfile === "object"
    ? context.memoryProfile
    : {}
  const knownFacts = profile?.knownFacts && typeof profile.knownFacts === "object"
    ? profile.knownFacts
    : {}
  const facts = []

  if (knownFacts.name || profile.name) facts.push(`Nome: ${knownFacts.name || profile.name}`)
  if (knownFacts.preferredName || profile.preferredName) facts.push(`Como chamar: ${knownFacts.preferredName || profile.preferredName}`)
  if (knownFacts.workDomain || profile.workDomain) facts.push(`Area: ${knownFacts.workDomain || profile.workDomain}`)
  if (knownFacts.responseStyle || profile.responseStyle) facts.push(`Preferencia de resposta: ${knownFacts.responseStyle || profile.responseStyle}`)
  if (knownFacts.role || profile.role) facts.push(`Funcao: ${knownFacts.role || profile.role}`)
  if (knownFacts.bibleVersion || profile.bibleVersion) facts.push(`Biblia preferida: ${knownFacts.bibleVersion || profile.bibleVersion}`)
  if (knownFacts.currentGoal || profile.currentGoal) facts.push(`Objetivo atual: ${knownFacts.currentGoal || profile.currentGoal}`)

  return facts.join(" | ")
}

function buildRuntimeFallbackRagText(context = {}) {
  return [
    context?.liveSearchSummary || "",
    context?.agroWeather?.summary || "",
    context?.liveFixture?.summary || "",
    context?.biblePassage?.summary || ""
  ]
    .filter(Boolean)
    .join("\n")
}

function buildRuntimeFallbackProviderContext(question, context = {}) {
  const memoryContext = {
    contextSummary: String(context?.memorySummary || "").trim(),
    knownFactsText: buildKnownFactsTextFromRuntimeContext(context),
    recentConversationText: buildRecentConversationTextFromRuntimeContext(context, 6),
    userProfile: context?.memoryProfile && typeof context.memoryProfile === "object"
      ? context.memoryProfile
      : {}
  }
  const ragText = buildRuntimeFallbackRagText(context)
  const ragContext = {
    enriched: Boolean(ragText),
    context: ragText,
    knowledge: []
  }
  const promptPackage = buildAssistantPrompt({
    task: question,
    context,
    memoryContext,
    ragContext,
    userStyle: context?.userStyle || "natural"
  })
  const memoryText = [
    memoryContext.knownFactsText,
    memoryContext.contextSummary,
    memoryContext.recentConversationText
  ]
    .filter(Boolean)
    .join("\n")
  const sections = [
    "[ System Prompt ]",
    truncateProviderPromptSection(promptPackage.systemPrompt || "", 3_200),
    "",
    "[ Memoria relevante ]",
    truncateProviderPromptSection(memoryText, 1_800) || "Sem memoria relevante.",
    "",
    "[ Contexto do RAG ]",
    truncateProviderPromptSection(ragText, 1_800) || "Sem contexto adicional.",
    "",
    "[ Pergunta do usuario ]",
    String(question || "").trim()
  ]
  let finalPrompt = sections.join("\n")
  if (finalPrompt.length > RUNTIME_FALLBACK_MAX_PROMPT_CHARS) {
    finalPrompt = `${finalPrompt.slice(0, RUNTIME_FALLBACK_MAX_PROMPT_CHARS - 3)}...`
  }

  return {
    finalPrompt,
    contextEnhancements: {
      promptPackage,
      memoryContext,
      ragContext,
      ragSources: Array.isArray(context?.ragSources) ? context.ragSources : []
    }
  }
}

function buildFallbackStreamingPromptPackage(question, context = {}) {
  return buildRuntimeFallbackProviderContext(question, context).contextEnhancements.promptPackage
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
    return buildFallbackStreamingPromptPackage(question, context)
  }

  if (result?.error) {
    console.warn("[giomOrchestrator] buildAssistantPromptContext failed; using minimal streaming prompt package.", result.error?.message || result.error)
    return buildFallbackStreamingPromptPackage(question, context)
  }

  return result?.promptPackage || buildFallbackStreamingPromptPackage(question, context)
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
  const runtimeFallback = buildRuntimeFallbackProviderContext(question, context)

  if (result?.timedOut) {
    console.warn("[giomOrchestrator] buildResponsePlan timed out while preparing provider context; using runtime-context fallback.")
    return runtimeFallback
  } else if (result?.error) {
    console.warn("[giomOrchestrator] buildResponsePlan failed while preparing provider context; using runtime-context fallback.", result.error?.message || result.error)
    return runtimeFallback
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
    finalPrompt: plan?.finalPrompt || runtimeFallback.finalPrompt,
    contextEnhancements: {
      promptPackage: plan?.promptPackage || runtimeFallback.contextEnhancements.promptPackage,
      memoryContext: plan?.memoryContext || runtimeFallback.contextEnhancements.memoryContext,
      ragContext: plan?.ragContext || runtimeFallback.contextEnhancements.ragContext,
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
  askLimiter,
  AI_ENTERPRISE_NAME,
  AI_SERVICE_SLUG,
  grootAdvancedRAG,
  buildRuntimeCapabilityMatrix,
  getResearchCapabilities,
  getLiveResearchRuntime,
  aiProviders,
  grootEmbeddings,
  listAssistantProfiles,
  listBibleLearningTracks,
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
  listCapabilityHighlights,
  traceStore,
  toolRegistry,
  jobManager,
  voiceRuntime,
  longMemoryRuntime,
  localVoiceRuntime
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

registerEnterpriseVoiceRoutes(app, {
  askLimiter,
  voiceRuntime,
  writeSSE,
  askGiom,
  buildRuntimeConversationContext,
  postProcessAssistantResponse,
  traceStore,
  longMemoryRuntime,
  localVoiceRuntime
})

registerEnterpriseKnowledgeRoutes(app, {
  grootAdvancedRAG,
  AI_KNOWLEDGE_SERVICE_SLUG,
  listBibleLearningTracks,
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
  cleanupLanguageRuntimeCache,
  traceStore,
  toolRegistry,
  jobManager,
  voiceRuntime,
  longMemoryRuntime,
  localVoiceRuntime
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
  sanitizeGeneratedDocumentContent,
  sanitizeAskContext,
  buildDocumentDraftPrompt,
  documentGenerationFormatIds,
  parseBibleReference,
  fetchBiblePassage,
  getResearchCapabilities,
  buildRuntimeCapabilityMatrix,
  askGiom,
  generateStructuredDocument,
  grootMemoryConnector,
  jobManager,
  traceStore
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
  longMemoryRuntime,
  runtimeBuildWeatherClientMetadata,
  buildLanguageRuntimeMetadata,
  buildOperationalContingencyResponse,
  resolveOperationalRuntimeShortcut,
  getVerifiedRuntimeClock,
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
  askGroot,
  jobManager
})

// Bible API (YouVersion Platform) - requer YVP_APP_KEY
registerEnterpriseBibleRoutes(app, {
  fetchBiblePassage
})

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error)
  }

  const requestTrace = traceStore.getRequestContext(req) || {}
  const requestId = String(requestTrace.requestId || `runtime_error_${Date.now()}`)
  const statusCode = Number(error?.statusCode || error?.status || 500) || 500
  const publicMessage = statusCode >= 500
    ? "Falha interna do runtime do GIOM."
    : (error?.message || "Falha ao processar requisicao.")

  aiGateway.logger.error(requestId, "HTTP_UNHANDLED_ERROR", {
    traceId: requestTrace.traceId || null,
    path: req?.originalUrl || req?.url || "/",
    method: req?.method || "GET",
    statusCode,
    error: error?.message || "unknown_error",
    code: error?.code || null
  })

  res.status(statusCode).json({
    success: false,
    error: publicMessage,
    code: error?.code || "UNHANDLED_RUNTIME_ERROR",
    requestId,
    details: process.env.NODE_ENV === "development"
      ? (error?.stack || error?.message || null)
      : undefined
  })
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
