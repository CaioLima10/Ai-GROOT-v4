// Type declarations for @giom/shared-config
// Barrel re-exports — add explicit types as modules are migrated to TypeScript

export * from "./runtimeContracts.js"
export * from "./runtimeSchemas.js"
export * from "./questionIntents.js"

// JS-only module types (interim — migrate to TS incrementally)
export declare const AI_ENTERPRISE_NAME: string
export declare const AI_KNOWLEDGE_SERVICE_SLUG: string
export declare const AI_MODEL_OWNER: string
export declare const AI_SERVICE_SLUG: string
export interface SharedEvaluationDimension {
  id: string
  label: string
  description: string
}
export interface SharedBenchmarkScenarioTurn {
  question: string
  context?: Record<string, unknown>
  tags?: string[]
}
export interface SharedBenchmarkScenario {
  id: string
  label: string
  summary?: string
  tags?: string[]
  turns: SharedBenchmarkScenarioTurn[]
}
export interface SharedBenchmarkPack {
  id: string
  label: string
  summary: string
  recommendedProfile?: string
  scenarios: SharedBenchmarkScenario[]
}
export interface SharedBibleLearningTrackStep {
  id: string
  label: string
  summary: string
  goal: string
  promptStarter: string
  moduleIds: string[]
}

export interface SharedBibleLearningTrack {
  id: string
  label: string
  summary: string
  assistantProfile: string
  activeModules: string[]
  bibleStudyModules: string[]
  promptPacks: string[]
  preferredBibleCode: string
  ministryFocus?: string
  depthPreference?: string
  steps: SharedBibleLearningTrackStep[]
}

export declare function getResearchCapabilities(): Record<string, boolean>
export declare function listAssistantProfiles(): unknown[]
export declare function listBibleLearningTracks(): SharedBibleLearningTrack[]
export declare function listBibleStudyModules(): unknown[]
export declare function listCapabilityHighlights(opts: Record<string, unknown>): Record<string, unknown>
export declare function listCompatModels(): unknown[]
export declare function listDomainModules(): unknown[]
export declare const EVALUATION_DIMENSIONS: SharedEvaluationDimension[]
export declare function getEvaluationPack(packId?: string): SharedBenchmarkPack | null
export declare function listEvaluationDimensions(): SharedEvaluationDimension[]
export declare function listEvaluationPacks(): SharedBenchmarkPack[]
export declare function listModuleEnhancementPlans(): unknown[]
export declare function listPlannedModules(): unknown[]
export declare function listPromptPacks(): unknown[]
export declare function parseBibleReference(text: string): unknown
export declare function resolveCompatModel(id: string): unknown
export declare function isLikelyWeatherQuestion(question: string): boolean
export declare function isBibleFollowUpQuestion(question: string, history: unknown[]): boolean
export declare function inferMinistryFocusFromText(text: string): unknown
