import type {
  ConversationHistoryItem,
  GIOMAskContext
} from "../../shared-config/src/runtimeContracts.js";

export type AssistantAudience = "adaptive" | "beginner" | "advanced";

export interface RuntimeSummaryPayload {
  summary?: string;
  [key: string]: unknown;
}

export interface RuntimeBiblePassage extends RuntimeSummaryPayload {
  reference?: string;
  content?: string;
  bibleCode?: string;
  bibleLabel?: string;
  source?: string;
  provider?: string;
}

export interface LanguageRuntimePayload extends RuntimeSummaryPayload {
  detectedLanguage?: string | null;
  mode?: string;
  targetText?: string | null;
  servicesUsed?: string[];
  clarificationHints?: string[];
  translation?: {
    provider?: string;
    sourceLanguage?: string;
    targetLanguage?: string;
    translatedText?: string;
    confidence?: number;
    cacheHit?: string | null;
    fallbackFrom?: string | null;
  } | null;
  correction?: {
    provider?: string;
    language?: string;
    detectedLanguage?: string | null;
    matchesCount?: number;
    cacheHit?: string | null;
    topMatches?: Array<{
      message?: string;
      replacements?: string[];
    }>;
  } | null;
  lexical?: {
    provider?: string;
    term?: string;
    partOfSpeech?: string | null;
    definition?: string | null;
    example?: string | null;
    extractPreview?: string | null;
    relatedWords?: string[];
    cacheHit?: string | null;
  } | null;
  instructions?: string;
  translationError?: string;
  correctionError?: string;
  lexicalError?: string;
  error?: string;
}

export interface LanguageRuntimeClientMetadata {
  enabled: boolean;
  detectedLanguage?: string | null;
  mode?: string;
  servicesUsed?: string[];
  clarificationHints?: string[];
  cacheHit?: string | null;
  summary: string;
}

export interface PromptBuilderRuntimeContext extends GIOMAskContext {
  userId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  bibleCode?: string;
  weatherForecastData?: LiveWeatherSnapshot | null;
  agroWeather?: LiveWeatherSnapshot | null;
  liveFixture?: LiveFixtureSummary | null;
  biblePassage?: RuntimeBiblePassage | null;
  biblePassageContextFromHistory?: boolean;
  languageRuntime?: LanguageRuntimePayload | null;
}

export interface PromptBuilderKnownFacts {
  name?: string;
  workDomain?: string;
  responseStyle?: string;
  role?: string;
}

export interface PromptBuilderUserProfile extends Record<string, unknown> {
  activeModules?: string[];
  assistantProfile?: string;
  bibleStudyModules?: string[];
  promptPacks?: string[];
  domainSubmodules?: Record<string, string[]>;
  style?: string;
  verbosity?: string;
  locale?: string;
  topics?: string[];
}

export interface PromptBuilderMemoryContext extends Record<string, unknown> {
  contextSummary?: string;
  recentConversationText?: string;
  knownFactsText?: string;
  knownFacts?: PromptBuilderKnownFacts;
  learningSummary?: string;
  userProfile?: PromptBuilderUserProfile;
}

export interface PromptBuilderRagContext extends Record<string, unknown> {
  enriched?: boolean;
  context?: string;
}

export interface AssistantPromptProfile {
  id: string;
  label: string;
  summary: string;
  tone: string;
  instructions: string[];
  [key: string]: unknown;
}

export interface AssistantPromptPackage {
  requestedProfileId: string;
  profileId: string;
  profile: AssistantPromptProfile;
  activeModules: string[];
  domainSubmodules: Record<string, string[]>;
  bibleStudyModules: string[];
  promptPacks: string[];
  audience: AssistantAudience;
  systemPrompt: string;
}

export interface AssistantPromptContextOptions {
  limit?: number;
  userStyle?: string;
}

export interface AssistantPromptContextResult {
  requestedModules: string[];
  requestedBibleStudyModules: string[];
  memoryContext: PromptBuilderMemoryContext;
  ragContext: PromptBuilderRagContext;
  promptPackage: AssistantPromptPackage;
}

export type EvaluationDimensionId =
  | "comprehension"
  | "coherence"
  | "memory"
  | "transparency"
  | "conversation"
  | "self_model"
  | "safety";

export type EvaluationStatus =
  | "excellent"
  | "solid"
  | "mixed"
  | "needs_attention"
  | "unknown";

export interface ResearchCapabilitiesSnapshot extends Record<string, unknown> {
  mode?: string;
}

export interface RuntimeClock {
  nowMs: number;
  unixTime: number;
  utcIso: string;
  localIso: string;
  timezone: string;
  utcOffset?: string | null;
  source: string;
  verified: boolean;
  fetchedAt: string;
}

export interface RuntimeClockMeta {
  source: string;
  verified: boolean;
  timezone: string;
  nowUtc: string;
  fetchedAt: string;
}

export interface WeatherLocationResolution {
  label?: string;
  latitude: number;
  longitude: number;
  forecastDays?: number;
  timezone?: string;
  source?: string;
  sourceType?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  countryCode?: string | null;
  locationType?: string | null;
  requestedQuery?: string | null;
  accuracyMeters?: number | null;
}

export interface WeatherForecastCurrentPayload {
  time?: string | null;
  temperature_2m?: number | null;
  precipitation?: number | null;
  weather_code?: number | null;
  wind_speed_10m?: number | null;
  is_day?: number | null;
}

export interface WeatherForecastDailyPayload {
  time?: string[];
  temperature_2m_max?: Array<number | null>;
  temperature_2m_min?: Array<number | null>;
  precipitation_probability_max?: Array<number | null>;
  precipitation_sum?: Array<number | null>;
  wind_speed_10m_max?: Array<number | null>;
  weather_code?: Array<number | null>;
  uv_index_max?: Array<number | null>;
  sunrise?: string[];
  sunset?: string[];
}

export interface WeatherForecastProviderPayload {
  timezone?: string;
  current?: WeatherForecastCurrentPayload | null;
  daily?: WeatherForecastDailyPayload | null;
}

export interface WeatherCurrentConditions {
  temperature: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  weatherCode: number | null;
  isDay: boolean;
  observedAt: string | null;
}

export interface WeatherDailyForecast {
  date: string;
  tempMax: number | null;
  tempMin: number | null;
  precipitationProbability: number | null;
  precipitationSum: number | null;
  windSpeedMax: number | null;
  weatherCode: number | null;
  uvIndexMax: number | null;
}

export interface LiveWeatherSnapshot extends RuntimeSummaryPayload {
  provider: string;
  providerLabel?: string;
  locationLabel: string;
  forecastDays?: number | null;
  timezone?: string;
  fetchedAt?: string;
  referenceDate?: string | null;
  todayIndex?: number;
  timeVerification?: RuntimeClockMeta | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  countryCode?: string | null;
  locationType?: string | null;
  resolutionSource?: string | null;
  locationSourceLabel?: string | null;
  requestedQuery?: string | null;
  accuracyMeters?: number | null;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  current?: WeatherCurrentConditions | null;
  daily?: WeatherDailyForecast[];
  error?: string | null;
}

export interface LiveWeatherClientMetadata {
  provider: string;
  providerLabel?: string;
  locationLabel?: string | null;
  locationSourceLabel?: string | null;
  locationType?: string | null;
  forecastDays?: number | null;
  fetchedAt?: string | null;
  referenceDate?: string | null;
  timeVerification?: RuntimeClockMeta | null;
  coordinates?: {
    latitude: number;
    longitude: number;
  } | null;
  summary: string;
  error?: string | null;
}

export interface GoogleSearchItem extends Record<string, unknown> {
  title: string;
  link: string;
  displayLink?: string;
  snippet?: string;
}

export interface GoogleCustomSearchOptions extends Record<string, unknown> {
  num?: number;
  hl?: string;
  gl?: string;
  searchType?: "web" | "image";
  allowedHosts?: string[];
}

export interface GoogleCustomSearchPayload extends Record<string, unknown> {
  provider: string;
  searchType?: string;
  items: GoogleSearchItem[];
}

export interface LiveSearchSnapshot {
  provider: string;
  items: GoogleSearchItem[];
  error?: string;
}

export interface LiveResearchRuntime extends Record<string, boolean | string | number | null | undefined> {
  googleSearch: boolean;
  googleImageSearch: boolean;
  sportsSchedule: boolean;
  liveWeb: boolean;
}

export interface FixtureSourceLink {
  title?: string;
  link: string;
  source?: string;
}

export interface FixtureVerification {
  status: string;
  label: string;
  note: string;
  checkedAt: string;
  clock?: RuntimeClockMeta | null;
  providerChain: string[];
}

export interface LiveFixtureEntry extends Record<string, unknown> {
  id?: string | number;
  summary?: string;
  league?: string;
  homeTeam?: string;
  awayTeam?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  homeBadge?: string | null;
  awayBadge?: string | null;
  kickoff?: string;
  dateLabel?: string;
  status?: string;
  venue?: string;
  timestampMs?: number | null;
}

export interface LiveFixtureSummary extends RuntimeSummaryPayload {
  provider?: string;
  teamQuery?: string;
  teamName?: string;
  subjectType?: string;
  league?: string;
  homeTeam?: string;
  awayTeam?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  homeBadge?: string | null;
  awayBadge?: string | null;
  kickoff?: string;
  dateLabel?: string;
  status?: string;
  venue?: string;
  teamBadge?: string | null;
  teamCountry?: string;
  teamVenue?: string;
  nextMatches?: LiveFixtureEntry[];
  recentMatches?: LiveFixtureEntry[];
  liveMatches?: LiveFixtureEntry[];
  verification?: FixtureVerification | null;
  timeVerification?: RuntimeClockMeta | null;
  sourceLinks?: FixtureSourceLink[];
  hasUpcomingFixture?: boolean;
  wantsHistory?: boolean;
  wantsNext?: boolean;
  error?: string;
}

export interface RuntimeUploadExtraction extends Record<string, unknown> {
  kind?: string;
  method?: string;
  quality?: string;
  truncated?: boolean;
  warnings?: string[];
  pages?: number;
  fullTextLength?: number;
  text?: string;
}

export interface ConversationEvaluationBucket {
  score: number;
  notes: string[];
  recoveredFacts?: string[];
}

export interface ConversationTurnDimension {
  id: EvaluationDimensionId;
  label: string;
  score: number;
  applicable?: boolean;
  applicableCount?: number;
  description: string;
}

export interface ConversationTurnEvaluation {
  score: number;
  status: EvaluationStatus;
  issues: string[];
  dimensions: ConversationTurnDimension[];
  details: {
    memory: ConversationEvaluationBucket;
    transparency: ConversationEvaluationBucket;
    conversation: ConversationEvaluationBucket;
    selfModel: ConversationEvaluationBucket;
    safety: ConversationEvaluationBucket;
  };
}

export interface EvaluationTurnInput {
  userMessage: string;
  aiResponse: string;
  history?: ConversationHistoryTurn[];
  researchCapabilities?: ResearchCapabilitiesSnapshot;
  tags?: string[];
}

export interface ConversationEvaluationSummary {
  score: number;
  status: EvaluationStatus;
  issues: string[];
  dimensions: ConversationTurnDimension[];
  strengths: string[];
  risks: string[];
}

export interface ConversationHistoryTurn extends ConversationHistoryItem {
  role: string;
  content: string;
}

export interface BenchmarkScenarioTurn {
  question: string;
  context?: PromptBuilderRuntimeContext;
  tags?: string[];
}

export interface BenchmarkScenario {
  id: string;
  label: string;
  summary?: string;
  tags?: string[];
  turns: BenchmarkScenarioTurn[];
}

export interface BenchmarkPack {
  id: string;
  label: string;
  summary: string;
  recommendedProfile?: string;
  scenarios: BenchmarkScenario[];
}

export interface BenchmarkAnswerPayload {
  answer?: string;
  response?: string;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ConversationTurnRecord {
  scenarioId: string;
  scenarioLabel: string;
  question: string;
  answer: string;
  context: PromptBuilderRuntimeContext;
  evaluation: ConversationTurnEvaluation;
  metadata: Record<string, unknown>;
}

export type BenchmarkTurnRequester = (input: {
  pack: BenchmarkPack;
  scenario: BenchmarkScenario;
  turn: BenchmarkScenarioTurn;
  history: ConversationHistoryTurn[];
}) => Promise<string | BenchmarkAnswerPayload> | string | BenchmarkAnswerPayload;

export interface ConversationBenchmarkRequest {
  packId?: string;
  researchCapabilities?: ResearchCapabilitiesSnapshot;
  requestTurn: BenchmarkTurnRequester;
}

export interface ConversationBenchmarkResult {
  pack: {
    id: string;
    label: string;
    summary: string;
    recommendedProfile?: string;
  };
  summary: ConversationEvaluationSummary;
  turns: ConversationTurnRecord[];
}

export interface EnhancedRuntimeConversationContext extends PromptBuilderRuntimeContext {
  conversationHistory: ConversationHistoryTurn[];
  researchCapabilities: ResearchCapabilitiesSnapshot;
  capabilityMatrix: Record<string, unknown>;
  privacyCapabilities: {
    sensitiveDataRedaction: boolean;
    sensitiveLearningBlocked: boolean;
    temporaryUploadStorage: boolean;
  };
  timestamp: string;
  weatherLocationQuery?: string;
  weatherLocation?: WeatherLocationResolution | null;
  weatherLocationError?: string;
  agroWeather?: LiveWeatherSnapshot | null;
  weatherForecastData?: LiveWeatherSnapshot | null;
  liveFixture?: LiveFixtureSummary | null;
  liveSearch?: LiveSearchSnapshot | { error?: string } | null;
  liveSearchSummary?: string;
  languageRuntime?: LanguageRuntimePayload | null;
  biblePassageError?: string;
  originalQuestion?: string;
  composedQuestion?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  uploadExtraction?: RuntimeUploadExtraction | null;
}
