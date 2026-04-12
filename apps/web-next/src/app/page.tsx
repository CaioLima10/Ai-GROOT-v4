"use client";

import { createClient, type Provider, type SupabaseClient, type User } from "@supabase/supabase-js";
import { usePathname } from "next/navigation";
import { AuthModal } from "@/components/chat/AuthModal";
import { BibleStudyHero } from "@/components/chat/BibleStudyHero";
import { BibleStudyPanel } from "@/components/chat/BibleStudyPanel";
import { BibleStudyWorkspaceBanner } from "@/components/chat/BibleStudyWorkspaceBanner";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatConversation } from "@/components/chat/ChatConversation";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { IconSidebar } from "@/components/chat/ChatIcons";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ProfileModal } from "@/components/chat/ProfileModal";
import { VoiceConversationOverlay } from "@/components/chat/VoiceConversationOverlay";
import { buildUploadPreviews, revokeUploadPreviews, type MessageUploadPreview } from "@/lib/uploadPreviews";
import { flushSync } from "react-dom";
import type {
  AuthIdentity,
  AuthMode,
  AuthStep,
  BibleLearningProgressState,
  BibleLearningTrack,
  BibleStudyModuleOption,
  ChatMessage,
  ChatThread,
  GeneratedDocument,
} from "@/components/chat/types";
import { resilientFetch } from "@/lib/resilientFetch";
import { isLikelyWeatherQuestion } from "@/lib/questionIntents";
import {
  isGiomRenderableContent,
  normalizeGiomMessageType,
  sanitizeAskContext
} from "@/lib/runtimeContracts";
import {
  parseAskResponsePayload,
  parseRealtimeSessionEnvelopePayload,
  parseRealtimeSpeechEnvelopePayload,
  parseRealtimeTranscriptionPayload,
  parseRealtimeVoiceResponseEnvelopePayload,
  parseRuntimeConfigPayload
} from "@groot/shared-config/src/runtimeSchemas.js";
import {
  buildSpeechSafeText,
  createAudioLevelMonitor,
  createWavAudioRecorder,
  createSilenceDetector,
  type AudioLevelMonitorController,
  isBrowserAudioCaptureSupported,
  isBrowserSpeechSynthesisSupported,
  isBrowserWavRecorderSupported,
  speakWithBrowser,
  type RealtimeVoiceSession,
  type BrowserSpeechController,
  type SilenceDetectorController,
  type WavAudioCaptureResult,
  type WavAudioRecorderController
} from "@/lib/voiceRealtime";
import { MessageRenderer } from "@/components/messages/MessageRenderer";
import type { GIOMMessage } from "@/components/messages/types";
import type {
  ConversationHistoryItem,
  GIOMAskContext,
  GIOMRenderableContent,
  GIOMUploadAsset,
  WeatherLocationContext as SharedWeatherLocationContext
} from "@/lib/runtimeContracts";
import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

type RuntimeConfig = {
  supabaseUrl?: string | null;
  supabaseAnonKey?: string | null;
  features?: {
    auth?: boolean;
    streaming?: boolean;
    imageGeneration?: boolean;
    documentGeneration?: boolean;
    voiceRealtime?: boolean;
    audioTranscriptions?: boolean;
    audioSpeech?: boolean;
    browserVad?: boolean;
    serverAudioTranscriptions?: boolean;
    serverAudioSpeech?: boolean;
    serverVad?: boolean;
  };
  uploads?: {
    enabled?: boolean;
    maxBytes?: number;
    accept?: string[];
  };
  ai?: {
    assistantProfiles?: Array<{
      id?: string;
      label?: string;
      summary?: string;
    }>;
    bibleLearningTracks?: BibleLearningTrack[];
    bibleStudyModules?: BibleStudyModuleOption[];
    documentGeneration?: {
      formats?: Array<{ id?: string; format?: string }>;
    };
    promptPacks?: Array<{
      id?: string;
      label?: string;
      summary?: string;
    }>;
    providers?: Array<{
      key?: string;
      name?: string;
      enabled?: boolean;
      model?: string;
      runtimeStatus?: string;
      cooldownMsRemaining?: number;
      consecutiveFailures?: number;
    }>;
  };
  runtime?: {
    voice?: {
      bargeIn?: boolean;
      defaultPersona?: string;
      personas?: Array<{
        id?: string;
        label?: string;
        voice?: string;
        tone?: string;
        summary?: string;
        provider?: string | null;
        serverAudioAvailable?: boolean;
      }>;
    };
  };
};

type ToolMode = "image" | "document";

type LocalAuthAccount = {
  id: string;
  email: string;
  fullName: string;
  password: string;
};

type UsageRecord = {
  dateKey: string;
  userId: string;
  messages: number;
  images: number;
  documents: number;
};

type PlanLimits = {
  messages: number;
  images: number;
  documents: number;
  uploads: boolean;
  tools: boolean;
};

type WeatherLocationContext = SharedWeatherLocationContext;
type VoiceStatus = "idle" | "connecting" | "listening" | "processing" | "speaking" | "paused";
type VoiceCaptureMode = "idle" | "browser" | "server";
type AppSurface = "chat" | "study";
type RealtimeSpeechManifest = {
  text: string;
  language?: string;
  voice?: string;
  rate?: number;
  pitch?: number;
  audio?: {
    mimeType?: string;
    format?: string;
    dataUrl?: string;
    audioBase64?: string;
    audioBytes?: number | null;
    durationMs?: number | null;
  } | null;
};

type VoiceOption = {
  value: string;
  label: string;
  language: string;
};

type VoicePersonaId = "giom" | "diana";

type VoicePersonaOption = {
  id: VoicePersonaId;
  label: string;
  summary: string;
  tone: string;
  previewText: string;
  rate: number;
  pitch: number;
  language: string;
};

type RuntimeVoicePersona = {
  id?: string;
  label?: string;
  voice?: string;
  tone?: string;
  summary?: string;
  provider?: string | null;
  serverAudioAvailable?: boolean;
};

type AssistantResponseMetadata = Pick<ChatMessage, "providerAttempted" | "providerUsed" | "providerFallback" | "fallbackFrom" | "fallbackReason">;

type AssistantResponseResult = {
  answer: string;
  metadata: AssistantResponseMetadata | null;
};

type StoredVoiceSettings = {
  speakerEnabled?: boolean;
  selectedVoicePersona?: VoicePersonaId;
  selectedVoiceName?: string;
};

type MemoryProfilePayload = {
  success?: boolean;
  latestSummary?: string;
  profile?: Record<string, unknown> | null;
};

type ThreadStorageBuckets = {
  version: 2;
  owners: Record<string, ChatThread[]>;
};

type SpeechManifestRequestOptions = {
  forceServerAudio?: boolean;
};

type VoiceSignalMode = "idle" | "input" | "output";
type StudyMascotMode = "idle" | "listening" | "speaking" | "celebrating";

type PlaybackController = BrowserSpeechController & {
  audioElement?: HTMLAudioElement | null;
  sourceKind?: "server" | "browser";
};

function normalizeRealtimeSpeechManifest(input: unknown, fallbackText = ""): RealtimeSpeechManifest | null {
  if (!input || typeof input !== "object") {
    const text = String(fallbackText || "").trim();
    return text ? { text } : null;
  }

  const record = input as Record<string, unknown>;
  const text = String(record.text || fallbackText || "").trim();
  if (!text) {
    return null;
  }

  const rawAudio = record.audio && typeof record.audio === "object"
    ? record.audio as Record<string, unknown>
    : null;

  return {
    text,
    language: String(record.language || "pt-BR"),
    voice: String(record.voice || "browser-default"),
    rate: Number(record.rate || 1) || 1,
    pitch: Number(record.pitch || 1) || 1,
    audio: rawAudio ? {
      mimeType: String(rawAudio.mimeType || "audio/wav"),
      format: String(rawAudio.format || "wav"),
      dataUrl: String(rawAudio.dataUrl || "").trim() || undefined,
      audioBase64: String(rawAudio.audioBase64 || "").trim() || undefined,
      audioBytes: Number(rawAudio.audioBytes || 0) || null,
      durationMs: Number(rawAudio.durationMs || 0) || null
    } : null
  };
}

function resolveServerAudioSource(manifest: RealtimeSpeechManifest | null | undefined) {
  const audio = manifest?.audio;
  if (!audio) {
    return "";
  }

  if (audio.dataUrl) {
    return String(audio.dataUrl).trim();
  }

  if (audio.audioBase64) {
    return `data:${audio.mimeType || "audio/wav"};base64,${audio.audioBase64}`;
  }

  return "";
}

function toVoiceLevelBucket(level: number) {
  const normalized = Math.max(0, Math.min(level || 0, 1));
  if (normalized < 0.08) return 0;
  if (normalized < 0.16) return 1;
  if (normalized < 0.28) return 2;
  if (normalized < 0.42) return 3;
  if (normalized < 0.62) return 4;
  return 5;
}

function playServerAudio(manifest: RealtimeSpeechManifest | null | undefined): PlaybackController | null {
  const source = resolveServerAudioSource(manifest);
  if (!source || typeof Audio === "undefined") {
    return null;
  }

  const audio = new Audio(source);
  audio.preload = "auto";

  let settled = false;
  let resolvePromise: () => void = () => undefined;
  let rejectPromise: (error: Error) => void = () => undefined;

  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };

    rejectPromise = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };

    audio.onended = () => resolvePromise();
    audio.onerror = () => rejectPromise(new Error("server_audio_playback_failed"));

    const playResult = audio.play();
    if (playResult && typeof playResult.catch === "function") {
      playResult.catch((error: unknown) => {
        rejectPromise(error instanceof Error ? error : new Error("server_audio_playback_failed"));
      });
    }
  });

  return {
    promise,
    audioElement: audio,
    sourceKind: "server",
    cancel: () => {
      audio.pause();
      audio.currentTime = 0;
      resolvePromise();
    }
  };
}

type SpeechRecognitionResultLike = {
  transcript: string;
};

type SpeechRecognitionResultListLike = {
  length: number;
  item(index: number): { isFinal: boolean; length: number; item(resultIndex: number): SpeechRecognitionResultLike } | null;
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

const AUTO_SCROLL_THRESHOLD = 96;
const THREADS_STORAGE_KEY = "giom-web-next-threads";
const SCOPE_STORAGE_KEY = "giom-web-next-scope";
const LOCAL_AUTH_ACCOUNTS_KEY = "giom-web-next-auth-accounts";
const LOCAL_AUTH_SESSION_KEY = "giom-web-next-auth-session";
const USAGE_STORAGE_KEY = "giom-web-next-usage";
const WEATHER_LOCATION_STORAGE_KEY = "giom-web-next-weather-location";
const VOICE_SETTINGS_STORAGE_KEY = "giom-web-next-voice-settings";
const WEATHER_LOCATION_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const EMPTY_MESSAGES: ChatMessage[] = [];
const DEFAULT_DOC_FORMAT = "pdf";
const MAX_INLINE_ATTACHMENTS = 12;
const MAX_CONVERSATION_HISTORY_ITEMS = 10;
const MAX_CONVERSATION_HISTORY_ITEM_CHARS = 900;
const VOICE_PERSONA_OPTIONS: VoicePersonaOption[] = [
  {
    id: "giom",
    label: "GIOM",
    summary: "Masculina, firme e direta para conversa continua.",
    tone: "Masculina",
    previewText: "Shalom. Eu sou o GIOM. Vamos conversar por voz com clareza, foco e resposta direta.",
    rate: 0.94,
    pitch: 0.82,
    language: "pt-BR"
  },
  {
    id: "diana",
    label: "DIANA",
    summary: "Feminina, clara e acolhedora para conversa continua.",
    tone: "Feminina",
    previewText: "Oi, eu sou a DIANA. Estou pronta para conversar com voce por voz de forma natural e acolhedora.",
    rate: 1.01,
    pitch: 1.14,
    language: "pt-BR"
  }
];
const VOICE_MALE_HINTS = ["male", "mascul", "homem", "man", "faber", "antonio", "daniel", "ricardo", "paulo", "lucas"];
const VOICE_FEMALE_HINTS = ["female", "femin", "mulher", "woman", "diana", "maria", "ana", "bianca", "camila", "sofia", "helena", "fernanda"];

function normalizeApiBase(value: string) {
  return String(value || "").trim().replace(/\/$/, "");
}

function shouldTryNextApiBase(error: unknown) {
  if (!error) return true;
  const status = Number((error as { status?: number })?.status || 0);
  if (Number.isFinite(status) && status >= 500) return true;
  const message = String((error as { message?: string })?.message || "").toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("load failed") ||
    message.includes("circuit") ||
    message.includes("timeout")
  );
}

function isOpaqueProxyFailure(status: number, rawText = "") {
  const normalized = String(rawText || "").trim().toLowerCase();
  return status >= 500 && (!normalized || normalized === "internal server error");
}

function buildBackendFailureMessage(
  route: string,
  status: number,
  payload: Record<string, unknown>,
  rawText = ""
) {
  const rawHint = String(rawText || "").replace(/\s+/g, " ").slice(0, 180);

  if (isOpaqueProxyFailure(status, rawHint)) {
    const routeHint = route.includes("/stream")
      ? "O proxy /backend nao conseguiu abrir o stream da API."
      : "O proxy /backend nao conseguiu falar com a API.";

    return `${routeHint} Isso normalmente significa backend offline ou porta divergente entre frontend e API. Se estiver em preview, suba os dois juntos com npm run preview:stack.`;
  }

  return String(
    (payload as { error?: string })?.error ||
      (payload as { details?: string })?.details ||
      (rawHint ? `Erro HTTP ${status}: ${rawHint}` : `Erro HTTP ${status}`)
  );
}

function sanitizeContextForApi(context: GIOMAskContext | Record<string, unknown>) {
  return sanitizeAskContext(context);
}

function makeId(prefix = "msg") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createThread(title = "Novo chat"): ChatThread {
  const now = new Date().toISOString();
  return {
    id: makeId("thread"),
    title,
    updatedAt: now,
    messages: []
  };
}

function buildConversationHistoryItemContent(message: ChatMessage) {
  const rawBaseContent = String(message.content || "").trim();
  const baseContent = message.generatedDocument && /^documento pronto\b/i.test(rawBaseContent)
    ? ""
    : rawBaseContent;
  const artifactContext: string[] = [];

  if (message.generatedDocument?.previewText) {
    artifactContext.push(
      `Documento gerado (${message.generatedDocument.fileName}): ${sanitizeArtifactPreviewText(message.generatedDocument.previewText)}`
    );
  }

  if (message.generatedImage) {
    artifactContext.push(
      message.artifactPrompt
        ? `Imagem gerada com prompt: ${message.artifactPrompt}`
        : "Imagem gerada nesta conversa."
    );
  }

  if (!artifactContext.length && message.artifactPrompt && !baseContent) {
    artifactContext.push(`Prompt do artefato: ${message.artifactPrompt}`);
  }

  return [baseContent, ...artifactContext]
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_CONVERSATION_HISTORY_ITEM_CHARS);
}

function buildConversationHistory(messages: ChatMessage[]): ConversationHistoryItem[] {
  return messages
    .filter((message) => !message.pending)
    .reduce<ConversationHistoryItem[]>((history, message) => {
      const content = buildConversationHistoryItemContent(message);
      if (!content) return history;

      history.push({
        role: message.role,
        content
      });

      return history;
    }, [])
    .slice(-MAX_CONVERSATION_HISTORY_ITEMS);
}

function parseSSEPacket(packet: string) {
  const lines = String(packet || "").split(/\r?\n/);
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (!dataLines.length) {
    return null;
  }

  try {
    return {
      event,
      data: JSON.parse(dataLines.join("\n"))
    };
  } catch {
    return null;
  }
}

function extractAnswer(payload: Record<string, unknown>) {
  return String(
    (payload?.data as { response?: string } | undefined)?.response ||
      payload?.response ||
      payload?.answer ||
      payload?.reply ||
      payload?.message ||
      ""
  );
}

function isGenericAssistantFallback(text: string) {
  return /^nao consegui (?:responder|processar) /i.test(String(text || "").trim());
}

function shouldRetryGenericFallbackPayload(payload: Record<string, unknown>) {
  const answer = extractAnswer(payload);
  const metadata = (payload?.metadata || payload?.data && typeof payload.data === "object"
    ? (payload?.metadata || (payload.data as { metadata?: Record<string, unknown> }).metadata)
    : payload?.metadata) as { fallback?: boolean } | undefined;

  return Boolean(metadata?.fallback) && isGenericAssistantFallback(answer);
}

function coerceMetadataValue(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function extractAssistantResponseMetadata(payload: Record<string, unknown>) {
  const data = asRecord(payload?.data);
  const metadata = {
    ...asRecord(data.metadata),
    ...asRecord(payload?.metadata)
  };

  const providerAttempted = coerceMetadataValue(metadata.providerAttempted || metadata.attemptedProvider);
  const providerUsed = coerceMetadataValue(metadata.providerUsed || metadata.provider);
  const fallbackFrom = coerceMetadataValue(metadata.fallbackFrom);
  const fallbackReason = coerceMetadataValue(metadata.fallbackReason);
  const providerFallback = Boolean(metadata.providerFallback || metadata.fallbackFromStreaming || metadata.fallback);

  if (!providerAttempted && !providerUsed && !fallbackFrom && !fallbackReason && !providerFallback) {
    return null;
  }

  return {
    providerAttempted,
    providerUsed,
    providerFallback,
    fallbackFrom,
    fallbackReason
  } satisfies AssistantResponseMetadata;
}

function getScopeId() {
  if (typeof window === "undefined") return "web-next-local";
  const existing = window.localStorage.getItem(SCOPE_STORAGE_KEY);
  if (existing) return existing;
  const created = makeId("scope");
  window.localStorage.setItem(SCOPE_STORAGE_KEY, created);
  return created;
}

function getThreadStorageOwnerKey(identity: AuthIdentity | null) {
  if (!identity || identity.source === "guest") {
    return `guest:${identity?.id || getScopeId()}`;
  }

  return `user:${identity.id}`;
}

function normalizeThreadStorageBuckets(input: unknown, legacyOwnerKey: string): ThreadStorageBuckets {
  if (Array.isArray(input)) {
    return {
      version: 2,
      owners: {
        [legacyOwnerKey]: input as ChatThread[]
      }
    };
  }

  if (!input || typeof input !== "object") {
    return {
      version: 2,
      owners: {}
    };
  }

  const record = input as Record<string, unknown>;
  const rawOwners = record.owners && typeof record.owners === "object"
    ? record.owners as Record<string, unknown>
    : record.byOwner && typeof record.byOwner === "object"
      ? record.byOwner as Record<string, unknown>
      : null;

  if (!rawOwners) {
    return {
      version: 2,
      owners: {}
    };
  }

  const owners: Record<string, ChatThread[]> = {};
  for (const [ownerKey, threads] of Object.entries(rawOwners)) {
    if (Array.isArray(threads)) {
      owners[ownerKey] = threads as ChatThread[];
    }
  }

  return {
    version: 2,
    owners
  };
}

function readThreadsFromStorage(ownerKey: string) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(THREADS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = normalizeThreadStorageBuckets(JSON.parse(raw), ownerKey);
    const storedThreads = parsed.owners[ownerKey];
    return Array.isArray(storedThreads) && storedThreads.length ? storedThreads : null;
  } catch {
    return null;
  }
}

function writeThreadsToStorage(ownerKey: string, threads: ChatThread[]) {
  if (typeof window === "undefined") return;

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(window.localStorage.getItem(THREADS_STORAGE_KEY) || "null");
  } catch {
    parsed = null;
  }

  const buckets = normalizeThreadStorageBuckets(parsed, ownerKey);
  buckets.owners[ownerKey] = threads;
  window.localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(buckets));
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}

function getInitials(identity: AuthIdentity | null) {
  if (!identity) return "GI";
  const source = identity.fullName || identity.email || "GI";
  const pieces = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!pieces.length) return "GI";
  return pieces.map((part) => part[0]?.toUpperCase() || "").join("");
}

function createGuestIdentity(): AuthIdentity {
  return {
    id: getScopeId(),
    email: "guest@local",
    fullName: "Convidado",
    plan: "Free",
    source: "guest"
  };
}

function mapSupabaseUser(user: User): AuthIdentity {
  const fullName = String(user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Usuario");
  return {
    id: user.id,
    email: String(user.email || ""),
    fullName,
    plan: "Free",
    source: "supabase"
  };
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "agora";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  }).format(date);
}

function normalizeStringArray(value: unknown, max = 24) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(
    value
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  )).slice(0, max);
}

function normalizeStudyDepthPreference(value: unknown) {
  return value === "advanced" || value === "beginner" ? value : "balanced";
}

function normalizeStudyModuleIds(value: unknown, allowedIds: Set<string>, max = 12) {
  return normalizeStringArray(value, max).filter((moduleId) => allowedIds.has(moduleId));
}

function resolveStudyModuleSelection(value: unknown, allowedIds: Set<string>, fallbackIds: string[] = []) {
  const explicit = normalizeStudyModuleIds(value, allowedIds);
  if (explicit.length > 0) {
    return explicit;
  }

  return normalizeStudyModuleIds(fallbackIds, allowedIds);
}

function normalizeBibleLearningProgress(value: unknown): BibleLearningProgressState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const entries = value as Record<string, unknown>;
  const normalized: BibleLearningProgressState = {};

  for (const [trackId, rawEntry] of Object.entries(entries)) {
    if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
      continue;
    }

    const entry = rawEntry as Record<string, unknown>;
    normalized[trackId] = {
      completedStepIds: normalizeStringArray(entry.completedStepIds, 16),
      currentStepId: String(entry.currentStepId || "").trim() || null,
      updatedAt: String(entry.updatedAt || "").trim() || null
    };
  }

  return normalized;
}

function ensureTrackProgressEntry(progressState: BibleLearningProgressState, track: BibleLearningTrack | null) {
  if (!track) {
    return progressState;
  }

  if (progressState[track.id]) {
    return progressState;
  }

  return {
    ...progressState,
    [track.id]: {
      completedStepIds: [],
      currentStepId: track.steps[0]?.id || null,
      updatedAt: null
    }
  };
}

function isStudyCheckpointStep(stepIndex: number, totalSteps: number) {
  return (stepIndex + 1) % 3 === 0 || stepIndex === totalSteps - 1;
}

function getStudyCheckpointLabel(stepIndex: number, totalSteps: number) {
  if (stepIndex === totalSteps - 1) {
    return "Conclusao";
  }

  return `Bloco ${Math.floor(stepIndex / 3) + 1}`;
}

function buildProviderResilienceLabel(providers: RuntimeConfig["ai"] extends infer T
  ? T extends { providers?: infer U } ? U | undefined : never
  : never) {
  const providerList = Array.isArray(providers) ? providers : [];
  if (providerList.length <= 1) {
    return null;
  }

  const enabledProviders = providerList.filter((provider) => provider?.enabled !== false);
  const readyProviders = enabledProviders.filter((provider) => {
    const runtimeStatus = String(provider?.runtimeStatus || "").trim().toLowerCase();
    return runtimeStatus === "ready" || runtimeStatus === "degraded";
  });

  if (!enabledProviders.length) {
    return "Fallback multi-API: nenhum provedor pronto agora.";
  }

  return `Fallback multi-API: ${readyProviders.length}/${enabledProviders.length} provedores prontos.`;
}

function buildBibleStudyInstruction(
  track: BibleLearningTrack | null,
  stepId: string | null | undefined,
  moduleCatalog: BibleStudyModuleOption[],
  selectedModuleIds: string[],
  depthPreference: string
) {
  if (!track) {
    return "";
  }

  const activeStep = track.steps.find((step) => step.id === stepId) || track.steps[0] || null;
  const moduleLabels = selectedModuleIds
    .map((moduleId) => moduleCatalog.find((module) => module.id === moduleId)?.label)
    .filter(Boolean)
    .slice(0, 5);
  const depthLine = depthPreference === "advanced"
    ? "Entregue profundidade avancada, com exegese, historia e organizacao doutrinaria quando couber."
    : depthPreference === "beginner"
      ? "Ensine como discipulado guiado, com linguagem clara, progressao didatica e sem jargao desnecessario."
      : "Mantenha equilibrio entre clareza pratica e profundidade teologica.";

  return [
    `Modo Fale Biblico ativo na trilha ${track.label}.`,
    activeStep ? `Etapa atual: ${activeStep.label}. Objetivo: ${activeStep.goal}` : "",
    moduleLabels.length > 0 ? `Priorize estes submodulos: ${moduleLabels.join(", ")}.` : "",
    depthLine
  ].filter(Boolean).join(" ");
}

function buildStaticLandingGreeting() {
  return {
    title: "Tudo pronto? Entao vamos la!",
    subtitle: ""
  };
}

function speechErrorMessage(error?: string) {
  if (!error) {
    return "Nao foi possivel usar o microfone agora.";
  }

  if (error === "not-allowed" || error === "service-not-allowed") {
    return "Microfone bloqueado. Clique no cadeado do navegador e permita o acesso ao microfone para este site.";
  }

  if (error === "audio-capture") {
    return "Nenhum microfone foi encontrado. Conecte um dispositivo de audio e tente novamente.";
  }

  if (error === "network") {
    return "Falha de rede ao usar o ditado por voz. Verifique sua conexao e tente novamente.";
  }

  if (error === "aborted") {
    return "Captura de voz interrompida.";
  }

  return `Falha no microfone: ${error}.`;
}

function getVoiceStatusLabel(status: VoiceStatus, interimTranscript = "") {
  if (status === "connecting") {
    return "Voz realtime conectando";
  }

  if (status === "listening") {
    return interimTranscript
      ? `Ouvindo: ${interimTranscript.slice(0, 72)}`
      : "Ouvindo com VAD ativo";
  }

  if (status === "processing") {
    return "Processando fala";
  }

  if (status === "speaking") {
    return "Resposta em voz alta";
  }

  if (status === "paused") {
    return "Conversa por voz pausada";
  }

  return "Voz pronta";
}

function getVoiceRecoveryHint(error?: string | null) {
  const message = String(error || "").trim();
  if (!message) {
    return null;
  }

  const normalized = message.toLowerCase();

  if (
    normalized.includes("microfone bloqueado")
    || normalized.includes("permita o acesso")
    || normalized.includes("nao foi possivel iniciar o microfone")
  ) {
    return "O navegador bloqueou o microfone. Libere a permissao do site e tente retomar a conversa.";
  }

  if (normalized.includes("microfone nao suportado")) {
    return "Este navegador nao expone captura compativel para o modo voz continuo. Troque de navegador ou dispositivo.";
  }

  if (normalized.includes("leitura em voz alta") || normalized.includes("voz alta")) {
    return "A saida de voz nao ficou disponivel. Abra os ajustes e valide o motor de fala antes de retomar.";
  }

  if (normalized.includes("conexao") || normalized.includes("rede") || normalized.includes("backend")) {
    return "A sessao de voz perdeu o canal com o backend. Tente reconectar agora.";
  }

  return message;
}

function getMessageUploads(message: ChatMessage) {
  if (Array.isArray(message.uploadNames) && message.uploadNames.length) {
    return message.uploadNames;
  }

  if (!message.uploadName) {
    return [] as string[];
  }

  return message.uploadName
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function getMessageUploadPreviews(
  message: ChatMessage,
  previewMap: Record<string, MessageUploadPreview[]>
) {
  return previewMap[message.id] || [];
}

function readLocalAccounts() {
  if (typeof window === "undefined") return [] as LocalAuthAccount[];

  try {
    const raw = window.localStorage.getItem(LOCAL_AUTH_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalAuthAccount[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalAccounts(accounts: LocalAuthAccount[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_AUTH_ACCOUNTS_KEY, JSON.stringify(accounts));
}

function readLocalSession() {
  if (typeof window === "undefined") return null as AuthIdentity | null;

  try {
    const raw = window.localStorage.getItem(LOCAL_AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthIdentity;
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocalSession(identity: AuthIdentity | null) {
  if (typeof window === "undefined") return;

  if (!identity) {
    window.localStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
    return;
  }

  window.localStorage.setItem(LOCAL_AUTH_SESSION_KEY, JSON.stringify(identity));
}

function readUsageStorage() {
  if (typeof window === "undefined") return [] as UsageRecord[];
  try {
    const raw = window.localStorage.getItem(USAGE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UsageRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsageStorage(records: UsageRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(records));
}

function readStoredWeatherLocation() {
  if (typeof window === "undefined") return null as WeatherLocationContext | null;

  try {
    const raw = window.localStorage.getItem(WEATHER_LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WeatherLocationContext;
    if (!Number.isFinite(parsed?.latitude) || !Number.isFinite(parsed?.longitude)) {
      return null;
    }
    const capturedAtMs = parsed?.capturedAt ? new Date(parsed.capturedAt).getTime() : Number.NaN;
    if (Number.isFinite(capturedAtMs) && Date.now() - capturedAtMs > WEATHER_LOCATION_MAX_AGE_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredWeatherLocation(location: WeatherLocationContext | null) {
  if (typeof window === "undefined") return;

  if (!location) {
    window.localStorage.removeItem(WEATHER_LOCATION_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(WEATHER_LOCATION_STORAGE_KEY, JSON.stringify(location));
}

function readStoredVoiceSettings() {
  if (typeof window === "undefined") return {} as StoredVoiceSettings;

  try {
    const raw = window.localStorage.getItem(VOICE_SETTINGS_STORAGE_KEY);
    if (!raw) return {} as StoredVoiceSettings;
    const parsed = JSON.parse(raw) as StoredVoiceSettings;
    return {
      speakerEnabled: parsed?.speakerEnabled === true,
      selectedVoicePersona: parsed?.selectedVoicePersona === "diana" ? "diana" : "giom",
      selectedVoiceName: String(parsed?.selectedVoiceName || "browser-default")
    };
  } catch {
    return {} as StoredVoiceSettings;
  }
}

function writeStoredVoiceSettings(settings: StoredVoiceSettings) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(VOICE_SETTINGS_STORAGE_KEY, JSON.stringify({
    speakerEnabled: settings.speakerEnabled === true,
    selectedVoicePersona: settings.selectedVoicePersona === "diana" ? "diana" : "giom",
    selectedVoiceName: String(settings.selectedVoiceName || "browser-default")
  }));
}

function buildBrowserVoiceOptions() {
  const fallbackOption: VoiceOption = {
    value: "browser-default",
    label: "Padrao do navegador",
    language: "pt-BR"
  };

  if (typeof window === "undefined" || !isBrowserSpeechSynthesisSupported()) {
    return [fallbackOption];
  }

  const seen = new Set<string>();
  const browserOptions = window.speechSynthesis.getVoices()
    .map((voice) => {
      const name = String(voice.name || "").trim();
      const language = String(voice.lang || "").trim() || "padrao";
      return {
        value: name,
        label: name ? `${name} (${language})` : `Voz do navegador (${language})`,
        language
      };
    })
    .filter((option) => {
      if (!option.value) {
        return false;
      }

      const key = `${option.value.toLowerCase()}::${option.language.toLowerCase()}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));

  return [fallbackOption, ...browserOptions];
}

function getVoicePersonaOption(persona: VoicePersonaId) {
  return VOICE_PERSONA_OPTIONS.find((option) => option.id === persona) || VOICE_PERSONA_OPTIONS[0];
}

function optionMatchesVoiceHints(option: VoiceOption, hints: string[]) {
  const haystack = `${option.label} ${option.language}`.toLowerCase();
  return hints.some((hint) => haystack.includes(hint));
}

function isPortugueseVoiceOption(option: VoiceOption) {
  const language = String(option.language || "").toLowerCase();
  return language.startsWith("pt");
}

function resolvePersonaBrowserVoiceName(persona: VoicePersonaId, options: VoiceOption[]) {
  const availableOptions = options.filter((option) => option.value && option.value !== "browser-default");
  const portugueseOptions = availableOptions.filter(isPortugueseVoiceOption);
  const candidatePool = portugueseOptions.length ? portugueseOptions : availableOptions;
  const primaryHints = persona === "giom" ? VOICE_MALE_HINTS : VOICE_FEMALE_HINTS;
  const oppositeHints = persona === "giom" ? VOICE_FEMALE_HINTS : VOICE_MALE_HINTS;

  const directMatch = candidatePool.find((option) => optionMatchesVoiceHints(option, primaryHints));
  if (directMatch) {
    return directMatch.value;
  }

  const safeFallback = candidatePool.find((option) => !optionMatchesVoiceHints(option, oppositeHints));
  if (safeFallback) {
    return safeFallback.value;
  }

  return candidatePool[0]?.value || "browser-default";
}

function buildPersonaSpeechSettings(persona: VoicePersonaOption, voiceName: string) {
  return {
    language: persona.language || "pt-BR",
    voiceName: String(voiceName || "browser-default"),
    rate: persona.rate,
    pitch: persona.pitch
  };
}

function normalizeVoicePersonaId(value: unknown): VoicePersonaId | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "giom" || normalized === "diana") {
    return normalized as VoicePersonaId;
  }

  return null;
}

function resolvePlaybackVoiceName(manifestVoice: string | undefined, fallbackVoiceName: string, serverVoice = "") {
  const normalizedVoice = String(manifestVoice || "").trim();
  if (!normalizedVoice || normalizedVoice === "browser-default") {
    return fallbackVoiceName;
  }

  const loweredVoice = normalizedVoice.toLowerCase();
  const normalizedServerVoice = String(serverVoice || "").trim().toLowerCase();
  if (loweredVoice === "giom" || loweredVoice === "diana" || (normalizedServerVoice && loweredVoice === normalizedServerVoice)) {
    return fallbackVoiceName;
  }

  return normalizedVoice;
}

function inferWeatherForecastDays(question: string) {
  const normalized = String(question || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/(semana|sete dias|7 dias|proximos dias|próximos dias|previsao semanal|previsao da semana)/.test(normalized)) {
    return 7;
  }

  if (/(amanha|amanhã|depois de amanha|depois de amanhã|proximos 5 dias|proximos cinco dias|próximos 5 dias)/.test(normalized)) {
    return 5;
  }

  return 7;
}

async function requestWeatherLocationFromBrowser(forecastDays = 7) {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Geolocalizacao indisponivel neste navegador.");
  }

  return await new Promise<WeatherLocationContext>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          label: "Local atual",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          forecastDays,
          timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "auto" : "auto",
          source: "browser_geolocation",
          accuracyMeters: Number.isFinite(position.coords.accuracy) ? Math.round(position.coords.accuracy) : undefined,
          capturedAt: new Date().toISOString()
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error("Permissao de localizacao negada."));
          return;
        }

        reject(new Error("Nao foi possivel obter sua localizacao."));
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 1000 * 60 * 5
      }
    );
  });
}

function getPlanLimits(identity: AuthIdentity | null): PlanLimits {
  if (!identity) {
    return {
      messages: 0,
      images: 0,
      documents: 0,
      uploads: false,
      tools: false
    };
  }

  if (identity.plan === "Pro") {
    return {
      messages: Number.POSITIVE_INFINITY,
      images: Number.POSITIVE_INFINITY,
      documents: Number.POSITIVE_INFINITY,
      uploads: true,
      tools: true
    };
  }

  if (identity.source === "guest") {
    return {
      messages: Number.POSITIVE_INFINITY,
      images: 1,
      documents: Number.POSITIVE_INFINITY,
      uploads: true,
      tools: true
    };
  }

  return {
    messages: 40,
    images: 3,
    documents: 3,
    uploads: true,
    tools: true
  };
}

function buildApiUrl(base: string, route: string) {
  return `${base}${route.startsWith("/") ? route : `/${route}`}`;
}

function detectToolIntent(question: string, availableDocFormats: string[]) {
  const trimmed = question.trim();
  const lowered = trimmed.toLowerCase();
  const normalized = trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const slashImagePrompt = lowered.startsWith("/img ") || lowered.startsWith("/image ")
    ? trimmed.replace(/^\/(img|image)\s+/i, "").trim()
    : "";
  const slashDocumentPrompt = lowered.startsWith("/doc ")
    ? trimmed.replace(/^\/doc\s+/i, "").trim()
    : "";

  if (slashImagePrompt) {
    return { mode: "image" as ToolMode, prompt: slashImagePrompt };
  }

  if (slashDocumentPrompt) {
    const format = availableDocFormats.find((item) => lowered.includes(item.toLowerCase())) || DEFAULT_DOC_FORMAT;
    return { mode: "document" as ToolMode, prompt: slashDocumentPrompt, format };
  }

  const explicitChatOnlyRequest = /\b(sem (criar|gerar|montar|fazer|produzir) (arquivo|documento|pdf|docx)|sem (arquivo|documento|pdf|docx)|so no chat|apenas no chat|em texto|sem baixar)\b/i;
  const imageRequest = /(gere|gera|crie|cria|faca|produza|desenhe|renderize|monte).{0,30}(uma |a )?(imagem|foto|ilustracao|arte|logo|capa|banner|wallpaper|thumbnail)/i;
  const documentRequest = /(gere|gera|crie|cria|faca|produza|redija|escreva|monte).{0,30}(um |uma )?(documento|arquivo|pdf|docx|xlsx|pptx|relatorio|proposta|contrato|apresentacao|planilha|ata|manual|briefing|slides?)/i;
  const softDocumentIntent = /\b(resumo|plano|cronograma)\b/i;
  const explicitExportIntent = /\b(arquivo|documento|pdf|docx|download|exportar|exportacao|baixar|anexo)\b/i;

  if (imageRequest.test(normalized)) {
    return {
      mode: "image" as ToolMode,
      prompt: trimmed.replace(/^(por favor\s+)?/i, "")
    };
  }

  if (explicitChatOnlyRequest.test(normalized)) {
    return null;
  }

  if (documentRequest.test(normalized) || (softDocumentIntent.test(normalized) && explicitExportIntent.test(normalized))) {
    const format = availableDocFormats.find((item) => lowered.includes(item.toLowerCase())) || DEFAULT_DOC_FORMAT;
    return {
      mode: "document" as ToolMode,
      prompt: trimmed,
      format
    };
  }

  return null;
}

function deriveDocumentTitle(prompt: string) {
  const normalized = prompt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^(?:agora\s+|por favor\s+|voce pode\s+|voces podem\s+)?/i, "")
    .replace(/^(?:gere|gera|crie|cria|faca|produza|redija|escreva|monte)\s+/i, "")
    .replace(/^(?:um|uma)\s+/i, "")
    .replace(/\b(?:documento|arquivo|pdf|docx|xlsx|pptx|planilha|apresentacao|slides?)\b(?=\s+(?:com|sobre|de|para))/gi, "")
    .replace(/\bem formato\s+(?:pdf|docx|xlsx|pptx)\b/gi, "")
    .replace(/^(?:com|sobre|de|para)\s+/i, "")
    .replace(/^(?:um|uma)\s+/i, "")
    .replace(/[.?!,:;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.slice(0, 48) || "Documento GIOM";
}

function sanitizeArtifactPreviewText(value: string) {
  const cleaned = String(value || "")
    .replace(/\bnao consegui responder a esta pergunta no momento[\s\S]*$/i, "")
    .replace(/\bnao consegui processar sua pergunta neste momento[\s\S]*$/i, "")
    .replace(/\beu gero esses arquivos com conhecimento interno[\s\S]*$/i, "")
    .replace(/\bnao confunda isso com suite office completa[\s\S]*$/i, "")
    .replace(/\boffice aqui significa geracao basica[\s\S]*$/i, "")
    .replace(/\bainda nao integrado[\s\S]*$/i, "")
    .replace(/^documento pronto\.?\s*/i, "")
    .trim();

  const normalized = cleaned
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (
    !cleaned
    || /^(nao consegui responder|nao consegui processar)\b/i.test(cleaned)
    || /^(resumo|preview|conteudo|conteudo base|limite|documento|documento pronto)(\s*:)?$/.test(normalized)
  ) {
    return "Arquivo pronto para download. Abra o preview para ver o conteudo base.";
  }

  return cleaned;
}

function sanitizePromptPayloadText(value: string) {
  return String(value || "")
    .replace(/^(?:use este prompt|prompt pronto(?:\s*\(copia e cola\))?|prompt final|prompt sugerido)\s*[:\-]?\s*/i, "")
    .replace(/^escrita\s*/i, "")
    .replace(/\bnao consegui responder a esta pergunta no momento[\s\S]*$/i, "")
    .replace(/\bnao consegui processar sua pergunta neste momento[\s\S]*$/i, "")
    .trim();
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

function extractBalancedJsonSnippet(content: string) {
  const source = String(content || "");

  for (let start = 0; start < source.length; start += 1) {
    const opener = source[start];
    if (opener !== "{" && opener !== "[") continue;

    const stack: string[] = [opener];
    let inString = false;
    let escaped = false;

    for (let index = start + 1; index < source.length; index += 1) {
      const char = source[index];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === "\\") {
          escaped = true;
          continue;
        }

        if (char === "\"") {
          inString = false;
        }

        continue;
      }

      if (char === "\"") {
        inString = true;
        continue;
      }

      if (char === "{" || char === "[") {
        stack.push(char);
        continue;
      }

      if (char === "}" || char === "]") {
        const last = stack[stack.length - 1];
        const matchesPair = (last === "{" && char === "}") || (last === "[" && char === "]");
        if (!matchesPair) break;
        stack.pop();
        if (!stack.length) {
          return source.slice(start, index + 1).trim();
        }
      }
    }
  }

  return null;
}

function collectStructuredPayloadTexts(content: string) {
  const trimmed = String(content || "").trim();
  if (!trimmed) return [] as string[];

  const candidates: string[] = [];
  const pushCandidate = (value: string | null | undefined) => {
    const normalized = String(value || "").trim();
    if (!normalized) return;
    if (!normalized.startsWith("{") && !normalized.startsWith("[")) return;
    if (!candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  };

  pushCandidate(trimmed);

  const fencedBlocks = Array.from(trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi));
  for (const block of fencedBlocks) {
    pushCandidate(block[1]);
  }

  pushCandidate(extractBalancedJsonSnippet(trimmed));
  return candidates;
}

function normalizePayloadType(value: unknown): GIOMMessage["type"] | null {
  return normalizeGiomMessageType(value);
}

function unescapeJsonLikeString(value: string) {
  return String(value || "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, "\"")
    .replace(/\\\\/g, "\\")
    .trim();
}

function extractPromptPayloadFromJsonLike(content: string) {
  const source = String(content || "").trim();
  if (!source) return null;

  const candidates = collectStructuredPayloadTexts(source);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const normalizedType = normalizePayloadType(parsed?.type || parsed?.kind || parsed?.card);
      if (normalizedType === "prompt") {
        const payloadContent = parsed.content ?? parsed.text ?? parsed.prompt ?? parsed.body;
        const cleanedPayloadContent = typeof payloadContent === "string"
          ? sanitizePromptPayloadText(payloadContent)
          : "";
        if (cleanedPayloadContent) {
          return {
            type: "prompt" as const,
            content: cleanedPayloadContent
          };
        }
      }
    } catch {
      continue;
    }
  }

  const contentMatch = source.match(/"type"\s*:\s*"prompt"[\s\S]*?"content"\s*:\s*"([\s\S]*?)"\s*(?:,\s*"[\w-]+"\s*:|\})/i);
  if (contentMatch?.[1]) {
    return {
      type: "prompt" as const,
      content: sanitizePromptPayloadText(unescapeJsonLikeString(contentMatch[1]))
    };
  }

  return null;
}

function stripStructuredArtifacts(content: string) {
  return String(content || "")
    .replace(/```(?:json)?[\s\S]*?```/gi, " ")
    .replace(/```(?:json)?[\s\S]*$/gi, " ")
    .replace(/\{\s*"type"\s*:\s*null[\s\S]*$/i, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferFixtureSubjectFromLooseText(content: string) {
  const normalized = String(content || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const commonTeams: Array<[string, string]> = [
    ["selecao brasileira", "Brasil"],
    ["selecao brasileira", "Brasil"],
    ["brasil", "Brasil"],
    ["botafogo", "Botafogo"],
    ["flamengo", "Flamengo"],
    ["palmeiras", "Palmeiras"],
    ["corinthians", "Corinthians"],
    ["sao paulo", "Sao Paulo"],
    ["santos", "Santos"],
    ["gremio", "Gremio"],
    ["internacional", "Internacional"],
    ["inter", "Internacional"]
  ];

  for (const [token, label] of commonTeams) {
    if (normalized.includes(token)) {
      return label;
    }
  }

  const extracted = String(content || "").match(
    /(?:proximo(?:s)? jogo(?:s)?(?: do| da| de)?|próximo(?:s)? jogo(?:s)?(?: do| da| de)?|partida(?:s)?(?: do| da| de)?|historico(?: do| da| de)?|histórico(?: do| da| de)?|retrospecto(?: do| da| de)?|ultim(?:o|os|a|as)\s+(?:jogo|jogos|partida|partidas|resultado|resultados)(?: do| da| de)?)([^.\n:!?]+)/i
  );

  return String(extracted?.[1] || "").replace(/[?.,!]/g, "").trim();
}

function extractLooseFixturePayload(content: string) {
  const source = String(content || "").trim();
  if (!source) return null;

  const hasFixtureMarker = /"variant"\s*:\s*"fixture"/i.test(source) || /"fixture"\s*:\s*null/i.test(source);
  if (!hasFixtureMarker) return null;

  const prose = stripStructuredArtifacts(source);
  const note = String(prose.split(/(?<=[.!?])\s+/)[0] || prose || "Consulta esportiva em processamento.")
    .replace(/```json/i, "")
    .trim()
    .slice(0, 220);
  const teamName = inferFixtureSubjectFromLooseText(prose || source) || "Agenda esportiva";

  return {
    type: "data" as const,
    content: {
      teamName,
      league: teamName === "Brasil" ? "Selecao brasileira" : "Agenda esportiva",
      homeTeam: teamName,
      awayTeam: "",
      homeScore: null,
      awayScore: null,
      kickoff: "--:--",
      dateLabel: "Sem confirmacao",
      status: "em analise",
      venue: "",
      note: note || "Consulta esportiva em processamento.",
      hasUpcomingFixture: false,
      nextMatches: [],
      recentMatches: [],
      sourceLinks: []
    },
    meta: {
      variant: "fixture",
      provider: "frontend_fixture_fallback"
    }
  };
}

function parseSpecialPayload(content: string): {
  type: GIOMMessage["type"];
  content: string | Record<string, unknown> | Array<unknown>;
  language?: string;
  meta?: Record<string, unknown>;
} | null {
  const candidates = collectStructuredPayloadTexts(content);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const normalizedType = normalizePayloadType(parsed?.type || parsed?.kind || parsed?.card);
      if (!normalizedType) {
        continue;
      }

      const payloadContent = Object.prototype.hasOwnProperty.call(parsed, "content")
        ? parsed.content
        : Object.prototype.hasOwnProperty.call(parsed, "data")
          ? parsed.data
          : parsed.payload;

      if (!isRenderableMessageContent(payloadContent)) {
        continue;
      }

      return {
        ...parsed,
        type: normalizedType,
        content: payloadContent,
        language: typeof parsed.language === "string" ? parsed.language : undefined,
        meta: typeof parsed.meta === "object" && parsed.meta ? parsed.meta as Record<string, unknown> : undefined
      };
    } catch {
      continue;
    }
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const meta = parsed?.meta && typeof parsed.meta === "object" ? parsed.meta as Record<string, unknown> : null;
      const variant = typeof meta?.variant === "string" ? meta.variant.trim().toLowerCase() : "";
      if (variant !== "fixture" && variant !== "weather" && variant !== "stats") {
        continue;
      }

      const payloadContent = Object.prototype.hasOwnProperty.call(parsed, "content")
        ? parsed.content
        : Object.prototype.hasOwnProperty.call(parsed, "data")
          ? parsed.data
          : Object.prototype.hasOwnProperty.call(parsed, "payload")
            ? parsed.payload
            : null;
      const nestedFixture = meta?.fixture && typeof meta.fixture === "object"
        ? meta.fixture as Record<string, unknown>
        : null;

      if (isRenderableMessageContent(payloadContent) && typeof payloadContent !== "string") {
        return {
          type: "data",
          content: payloadContent,
          meta: meta || undefined
        };
      }

      if (nestedFixture && Object.keys(nestedFixture).length > 0) {
        return {
          type: "data",
          content: nestedFixture,
          meta: meta || undefined
        };
      }

      const fallbackText = [
        parsed.letra,
        parsed.answer,
        parsed.response,
        meta?.letra && typeof meta.letra === "object" ? (meta.letra as Record<string, unknown>).content : null
      ].find((value) => typeof value === "string" && value.trim());

      if (typeof fallbackText === "string" && fallbackText.trim()) {
        return {
          type: "text",
          content: fallbackText.trim()
        };
      }
    } catch {
      continue;
    }
  }

  const promptPayload = extractPromptPayloadFromJsonLike(content);
  if (promptPayload) {
    return promptPayload;
  }

  const looseFixturePayload = extractLooseFixturePayload(content);
  if (looseFixturePayload) {
    return looseFixturePayload;
  }

  return null;
}

function isRenderableMessageContent(value: unknown): value is GIOMRenderableContent {
  return isGiomRenderableContent(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function hasExplicitShortReplyInstruction(question: string) {
  return /\b(?:responda|responde|retorne|diga)\s+(?:apenas|s[oó]|somente)\b/i.test(String(question || ""));
}

function isCapabilityPresentationQuestion(normalizedQuestion: string) {
  const asksCapabilities = /\b(o que voce consegue|o que voce realmente tem|quais sao seus limites|como voce funciona|consegue pesquisar|consegue verificar|quais formatos|quais arquivos|le de forma nativa|faz bem nesta execucao|nesta execucao|capacidade|capacidades|limites|ferramentas)\b/.test(normalizedQuestion);
  const mentionsToolingSurface = /\b(google|bing|yahoo|web|internet|browser|ao vivo|tempo real|formatos|arquivos|pdf|docx|xlsx|pptx|ocr|imagem|pesquisa)\b/.test(normalizedQuestion);

  return asksCapabilities && mentionsToolingSurface;
}

function hasSportsIntentCue(normalizedQuestion: string) {
  return /(jogo|jogos|partida|partidas|placar|agenda esportiva|agenda de jogos|confronto|quando joga|proximo jogo|proximos jogos|proximo confronto|historico|retrospecto|ultimos jogos|ultimos resultados|ultimos 5|resultado do jogo|escalacao|local do jogo|local da partida|horario do jogo|horario da partida|estadio|onde sera|proxima partida)/.test(normalizedQuestion);
}

function hasSportsCompetitionCue(normalizedQuestion: string) {
  return /(campeonato|serie a|serie b|brasileirao|brasileiro serie|libertadores|copa do brasil|copa do mundo|eliminatorias|selecao)/.test(normalizedQuestion);
}

function hasStrongSportsEntity(normalizedQuestion: string) {
  return /\b(botafogo|flamengo|palmeiras|corinthians|gremio|internacional|spfc|sao paulo fc|santos fc|selecao brasileira|bahia ec|ec bahia|esporte clube bahia)\b/.test(normalizedQuestion);
}

function hasAmbiguousSportsSubject(normalizedQuestion: string) {
  return /\b(brasil|bahia|santos|sao paulo|argentina)\b/.test(normalizedQuestion);
}

function hasSportsContextAnchor(normalizedQuestion: string) {
  return hasStrongSportsEntity(normalizedQuestion)
    || hasAmbiguousSportsSubject(normalizedQuestion)
    || hasSportsCompetitionCue(normalizedQuestion)
    || /\b(time|clube|selecao)\b/.test(normalizedQuestion);
}

function detectResponsePresentation(question: string) {
  const normalized = String(question || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const weatherIntent = isLikelyWeatherQuestion(question);
  const sportsIntentCue = hasSportsIntentCue(normalized);
  const strongSportsEntity = hasStrongSportsEntity(normalized);
  const brazilNationalTeamIntent = /\bbrasil\b/.test(normalized) && /(jogo|partida|placar|quando joga|campeonato|copa|selecao|eliminatorias)/.test(normalized);
  const capabilityIntent = isCapabilityPresentationQuestion(normalized);

  if (!normalized) return null;

  if (hasExplicitShortReplyInstruction(question)) {
    return {
      card: "text",
      instructions: "Se o usuario pedir para responder apenas com uma palavra ou frase curta, obedeça exatamente. Nao transforme isso em card, lista, passagem completa, citacao ou resposta expandida."
    };
  }

  if (capabilityIntent) {
    return {
      card: "text",
      instructions: "Quando o usuario perguntar sobre capacidades, limites, pesquisa web, formatos de arquivo ou verificacao atual, responda em texto objetivo e profissional. Nao force card de clima ou esporte."
    };
  }

  if (weatherIntent) {
    return {
      card: "data",
      variant: "weather",
      instructions: "Se a resposta for de clima, tempo, temperatura, sensacao termica ou previsao, responda em JSON puro usando type data e meta.variant weather. Use content com location, city, region, country, locationType, coordinates, dateLabel, temperature, unit, condition, high, low e note. Dentro deste contexto, interprete a pergunta como meteorologica e trate nomes geograficos como localidade real, distinguindo municipio, cidade, estado e pais. Nunca troque localidade por time ou selecao. Exemplos obrigatorios de contexto: 'clima de Santos' = cidade de Santos; 'clima na Bahia' = Estado da Bahia; 'tempo no Brasil' = pais Brasil; 'clima em Sao Paulo' = localidade geografica, nao Sao Paulo FC. Em follow-up sobre o widget de clima, use o ultimo local meteorologico confirmado da conversa, a menos que o usuario troque o lugar. Nunca invente clima ao vivo, previsao ou temperatura; sem localizacao valida, peca a cidade ou a permissao de localizacao."
    };
  }

  if (!weatherIntent && ((sportsIntentCue && hasSportsContextAnchor(normalized)) || strongSportsEntity || brazilNationalTeamIntent)) {
    return {
      card: "data",
      variant: "fixture",
      instructions: "Se a resposta for de futebol, jogo, confronto, placar, horario, local da partida, agenda esportiva ou historico esportivo, responda em JSON puro usando type data e meta.variant fixture. Use content com teamName, subjectType, teamBadge, teamCountry, league, homeTeam, awayTeam, homeScore, awayScore, kickoff, dateLabel, status, venue, nextMatches, recentMatches, liveMatches, verification e sourceLinks quando houver. Dentro deste contexto, interprete a pergunta como futebol e priorize horario, local, proximos jogos, resultados e historico recente. So trate Brasil, Bahia, Santos, Sao Paulo e nomes parecidos como entidade esportiva quando houver contexto claro de futebol, selecao, partida, campeonato, horario, placar ou historico esportivo. Exemplos obrigatorios de contexto: 'quando joga o Santos' = Santos FC; 'ultimos 5 jogos do Santos FC' = clube; 'quando joga o Bahia' = EC Bahia; 'quando joga o Sao Paulo' = Sao Paulo FC; 'quando joga o Brasil' = selecao brasileira; 'jogos da Argentina' = selecao argentina quando o contexto for futebol. Nunca responda esporte quando a pergunta for geografica ou meteorologica."
    };
  }

  if (/(prompt|copy e cola|copia e cola|copiar e colar)/.test(normalized)) {
    return {
      card: "prompt",
      instructions: "Se o usuario pediu um prompt pronto, responda em JSON puro usando type prompt e content como string unica pronta para copiar. Entregue somente o prompt final, sem explicacao antes ou depois."
    };
  }

  if (/(tabela|compare|comparacao|comparar|versus|vs\b|quadro comparativo)/.test(normalized)) {
    return {
      card: "table",
      instructions: "Se a resposta for comparativa, prefira JSON puro usando type table com content.columns e content.rows."
    };
  }

  if (/(cronologia|cronograma|timeline|linha do tempo|roteiro por etapas|etapas por data)/.test(normalized)) {
    return {
      card: "timeline",
      instructions: "Se a resposta for cronologica, prefira JSON puro usando type timeline com itens contendo time, title e description."
    };
  }

  if (/(checklist|passo a passo|tarefas|todo|to-do|lista de tarefas)/.test(normalized)) {
    return {
      card: "checklist",
      instructions: "Se a resposta for de acompanhamento ou passos praticos, prefira JSON puro usando type checklist."
    };
  }

  if (/(codigo|codigo fonte|script|html|css|javascript|typescript|sql|regex|funcao|função|snippet)/.test(normalized)) {
    return {
      card: "code",
      instructions: "Se a resposta principal for codigo, responda em JSON puro usando type code, language e content."
    };
  }

  return {
    card: "text",
    instructions: "Se nao houver card claramente util, responda em texto limpo, direto e sem markdown com **negrito** desnecessario."
  };
}

function normalizeIntentText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function extractPromptObjectiveFromQuestion(question: string) {
  return String(question || "")
    .replace(/\b(?:ainda\s+sem\s+arquivo|sem\s+gerar\s+arquivo|no\s+mesmo\s+assunto|no\s+mesmo\s+estilo|agora|por\s+favor)\b/gi, " ")
    .replace(/\b(?:me\s+de|me\s+d[eê]|gere|gera|crie|cria|faca|faça|monte|escreva)\b/gi, " ")
    .replace(/\b(?:um|uma)\s+prompt(?:\s+curto)?\b/gi, " ")
    .replace(/\b(?:copia\s+e\s+cola|copie\s+e\s+cole)\b/gi, " ")
    .replace(/[?!.]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function questionHasOnboardingContext(question: string) {
  return /\b(onboarding|implantacao|implantação|kickoff|go[-\s]?live|ativacao|ativação|adocao|adoção)\b/i.test(String(question || ""));
}

function questionRequestsStudyPrompt(question: string) {
  return /\b(estudar|estudo|devocional|meditacao|meditação|reflexao|reflexão|plano de leitura)\b/i.test(String(question || ""));
}

function looksLikePromptInstructionsText(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;

  const normalized = normalizeIntentText(trimmed);
  if (/\b(atue como|voce e|sua tarefa|objetivo|entregue|responda|mantenha|use|gere|crie|foco|restricoes|contexto|tom|papel)\b/.test(normalized)) {
    return true;
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.length >= 3 && lines.some((line) => /[:;]/.test(line));
}

function buildPromptFallbackContent(question: string) {
  const objective = extractPromptObjectiveFromQuestion(question);

  if (questionHasOnboardingContext(question)) {
    return [
      "Atue como analista de onboarding de clientes.",
      "Mapeie a etapa atual, os principais bloqueios e o primeiro marco de valor esperado.",
      "Entregue um plano curto com prioridade, responsavel, prazo e follow-up imediato.",
      "Mantenha tom executivo, objetivo e orientado a reduzir atrito na implantacao."
    ].join("\n");
  }

  if (questionRequestsStudyPrompt(question)) {
    return [
      "Atue como mentor biblico e guia de estudo devocional.",
      objective ? `Monte um plano curto para ${objective}.` : "Monte um plano curto de estudo biblico com continuidade do contexto anterior.",
      "Para cada etapa, entregue tema central, texto-base, pergunta de reflexao, aplicacao pratica e oracao curta.",
      "Mantenha fidelidade ao texto, linguagem humana e tom pastoral."
    ].join("\n");
  }

  return [
    "Atue como especialista que vai assumir esta conversa em continuidade.",
    objective ? `Tarefa: ${objective}.` : "Tarefa: assuma o contexto anterior e execute a proxima etapa pedida pelo usuario.",
    "Entregue resposta curta, clara, acionavel e com proximo passo recomendado.",
    "Mantenha tom humano, objetivo e sem repetir contexto desnecessario."
  ].join("\n");
}

function cleanComparisonTermForFallback(value: string) {
  return String(value || "")
    .replace(/^(?:o|a|os|as|um|uma)\s+/i, "")
    .replace(/[?.,!]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractComparisonTermsFromQuestion(question: string) {
  const patterns = [
    /\bcomparando\s+(.+?)\s+e\s+(.+?)(?:\s+(?:em|sobre|no contexto de)\b|[?.!,]|$)/i,
    /\bcompare\s+(.+?)\s+e\s+(.+?)(?:\s+(?:em|sobre|no contexto de)\b|[?.!,]|$)/i,
    /\b(.+?)\s+(?:vs|versus)\s+(.+?)(?:\s+(?:em|sobre|no contexto de)\b|[?.!,]|$)/i
  ];

  for (const pattern of patterns) {
    const match = String(question || "").match(pattern);
    const left = cleanComparisonTermForFallback(match?.[1] || "");
    const right = cleanComparisonTermForFallback(match?.[2] || "");
    if (left && right) {
      return [left, right] as const;
    }
  }

  return null;
}

function buildRequestedTablePayload(question: string) {
  const terms = extractComparisonTermsFromQuestion(question);
  if (!terms) return null;

  const [left, right] = terms;
  if (/\bromanos\s+8\b/i.test(question) && /culpa/i.test(left + right) && /seguranca/i.test(normalizeIntentText(left + right))) {
    const guiltLabel = /culpa/i.test(left) ? left : right;
    const securityLabel = guiltLabel === left ? right : left;
    return {
      columns: ["Aspecto", guiltLabel, securityLabel],
      rows: [
        ["Leitura central", "Peso da condenacao e da acusacao ligadas ao pecado.", "Seguranca de quem esta em Cristo e vive no Espirito."],
        ["Tom dominante", "Medo, autocobranca e senso de divida moral.", "Confianca, filiacao e esperanca sustentadas por Deus."],
        ["Base em Romanos 8", "Romanos 8 abre negando a condenacao final para quem esta em Cristo.", "Romanos 8 fecha afirmando que nada separa do amor de Deus."],
        ["Aplicacao pratica", "Levar a culpa para a cruz e abandonar a autossuficiencia.", "Descansar na obra de Cristo e caminhar com obediencia confiante."]
      ]
    };
  }

  const topicMatch = String(question || "").match(/\b(?:em|sobre|no contexto de)\s+([^?.!]+)$/i);
  const topic = String(topicMatch?.[1] || "").replace(/[?.,!]+$/g, "").trim();
  const topicSuffix = topic ? ` no contexto de ${topic}` : "";

  return {
    columns: ["Aspecto", left, right],
    rows: [
      ["Definicao", `${left} observado${topicSuffix}.`, `${right} observado${topicSuffix}.`],
      ["Foco principal", `Onde ${left} ganha mais peso${topicSuffix}.`, `Onde ${right} ganha mais peso${topicSuffix}.`],
      ["Risco ou tensao", `Qual cuidado pratico envolve ${left}.`, `Qual cuidado pratico envolve ${right}.`],
      ["Aplicacao", `Pergunta-chave: como lidar melhor com ${left}?`, `Pergunta-chave: como fortalecer ${right}?`]
    ]
  };
}

function buildRequestedTimelinePayload(question: string) {
  const normalized = normalizeIntentText(question);
  if (
    /\b(cronologia|timeline|linha do tempo)\b/.test(normalized)
    && /\b(nascimento|encarnacao)\b/.test(normalized)
    && /\b(resureicao|ressureicao|resurreicao|ressurreicao)\b/.test(normalized)
    && /\b(cristo|jesus)\b/.test(normalized)
  ) {
    return [
      { time: "1", title: "Nascimento", description: "Nascimento em Belem e primeiros eventos da infancia de Jesus." },
      { time: "2", title: "Preparacao", description: "Batismo por Joao Batista e inicio do ministerio publico." },
      { time: "3", title: "Paixao", description: "Entrada em Jerusalem, ultima ceia, prisao e crucificacao." },
      { time: "4", title: "Sepultamento", description: "Jesus e colocado no tumulo de Jose de Arimateia." },
      { time: "5", title: "Ressurreicao", description: "Ao terceiro dia o tumulo e encontrado vazio e Jesus aparece aos discipulos." }
    ];
  }

  if (/\b(cronograma|cronologia|timeline|linha do tempo)\b/.test(normalized) && /\b(arqueologia|arquiologia)\b/.test(normalized) && /\b(moises|exodo|egito)\b/.test(normalized)) {
    return [
      { time: "Semana 1", title: "Contexto historico", description: "Egito, Levante e Bronze Tardio como pano de fundo do periodo de Moises." },
      { time: "Semana 2", title: "Metodo", description: "Separar texto biblico, historiografia e arqueologia material." },
      { time: "Semana 3", title: "Evidencias", description: "Examinar topografia, rotas, assentamentos, estelas e limites de cada achado." },
      { time: "Semana 4", title: "Sintese", description: "Comparar propostas de data, pontos de consenso e lacunas reais." }
    ];
  }

  if (/\bonboarding|implantacao|implantacao|kickoff|go live|ativacao|adocao\b/.test(normalized)) {
    return [
      { time: "Semana 1", title: "Kickoff e alinhamento", description: "Definir objetivo, marco de valor e responsaveis do onboarding." },
      { time: "Semana 2", title: "Preparacao operacional", description: "Liberar acessos, materiais e checklist sem pendencias criticas." },
      { time: "Semana 3", title: "Entrega inicial", description: "Executar a implantacao principal e validar o primeiro resultado com o cliente." },
      { time: "Semana 4", title: "Follow-up e consolidacao", description: "Revisar riscos, adocao e proximo passo recomendado." }
    ];
  }

  const objective = extractPromptObjectiveFromQuestion(question) || "a demanda atual";
  return [
    { time: "Etapa 1", title: "Contexto", description: `Alinhar escopo, objetivo e criterios de sucesso para ${objective}.` },
    { time: "Etapa 2", title: "Execucao", description: "Organizar os entregaveis principais e remover bloqueios operacionais." },
    { time: "Etapa 3", title: "Revisao", description: "Validar resultado, ajustar riscos e registrar o proximo passo." }
  ];
}

function isGenericCardFallbackText(value: string) {
  const trimmed = String(value || "").trim();
  return isGenericAssistantFallback(trimmed) || /^AINDA NAO TENHO ESSA INFORMACAO\b/i.test(trimmed);
}

function looksLikeBiblePassageRawText(content: string) {
  const normalized = normalizeIntentText(content);
  return /\b(romanos 8|ja nao existe nenhuma condenacao|nao existe nenhuma condenacao|lei do espirito da vida|nada nos separara|nada pode nos separar)\b/.test(normalized);
}

function questionRequestsPastoralRewrite(question: string) {
  return /\b(pastoral|humano|humana|ansioso|ansiosa|acolhedor|acolhedora)\b/i.test(String(question || ""));
}

function buildPastoralFallbackText(question: string) {
  if (/\bromanos\s+8\b/i.test(question) || /\bmesmo texto\b/i.test(normalizeIntentText(question))) {
    return "Se voce esta ansioso, Romanos 8 nao aumenta o peso sobre voce; ele lembra que, em Cristo, voce nao esta condenado nem abandonado. A mensagem central e de seguranca: o Espirito sustenta sua fraqueza, Deus continua perto no meio da luta e nada pode separar voce do amor dEle. Em vez de correr para a culpa, esse texto convida voce a descansar, respirar e caminhar um passo de cada vez com confianca.";
  }

  return "Quero te responder de um jeito mais humano: esse texto nao foi dado para esmagar voce, mas para orientar, consolar e trazer clareza. O centro da mensagem e que Deus permanece presente, fiel e ativo mesmo quando voce esta cansado ou inseguro.";
}

function coerceAssistantReply(
  question: string,
  answer: string,
  responsePresentation: ReturnType<typeof detectResponsePresentation> | null
) {
  const trimmed = String(answer || "").trim();
  if (!trimmed || !responsePresentation) {
    return trimmed;
  }

  if (responsePresentation.card === "prompt") {
    const promptPayload = extractPromptPayloadFromJsonLike(trimmed);
    if (promptPayload?.content) {
      return JSON.stringify(promptPayload);
    }

    if (!isGenericAssistantFallback(trimmed) && looksLikePromptInstructionsText(trimmed)) {
      return JSON.stringify({
        type: "prompt",
        content: sanitizePromptPayloadText(trimmed)
      });
    }

    return JSON.stringify({
      type: "prompt",
      content: buildPromptFallbackContent(question)
    });
  }

  if (responsePresentation.card === "table") {
    const parsedPayload = parseSpecialPayload(trimmed);
    const inline = detectInlineType(trimmed);
    if (parsedPayload?.type === "table" || inline?.type === "table") {
      return trimmed;
    }

    const tablePayload = buildRequestedTablePayload(question);
    if (tablePayload) {
      return JSON.stringify({
        type: "table",
        content: tablePayload
      });
    }
  }

  if (responsePresentation.card === "timeline") {
    const parsedPayload = parseSpecialPayload(trimmed);
    const inline = detectInlineType(trimmed);
    if (parsedPayload?.type === "timeline" || inline?.type === "timeline") {
      return trimmed;
    }

    if (!isGenericCardFallbackText(trimmed)) {
      return trimmed;
    }

    return JSON.stringify({
      type: "timeline",
      content: buildRequestedTimelinePayload(question)
    });
  }

  if (questionRequestsPastoralRewrite(question) && (looksLikeBiblePassageRawText(trimmed) || isGenericAssistantFallback(trimmed))) {
    return buildPastoralFallbackText(question);
  }

  if (responsePresentation.variant === "weather") {
    return trimmed.replace(/Nao encontrei a localidade em /i, "Nao encontrei a localidade ");
  }

  return trimmed;
}

function inferCodeLanguage(content: string) {
  const sample = String(content || "").trim();
  if (!sample) return "text";
  if (/^\s*</.test(sample) && /<\/?[a-z][\s\S]*>/i.test(sample)) return "html";
  if (/\b(?:const|let|var|function|return|import|export|console\.)\b/.test(sample)) return "javascript";
  if (/\b(?:interface|type|implements|readonly|enum)\b/.test(sample)) return "typescript";
  if (/\b(?:SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|ALTER TABLE)\b/i.test(sample)) return "sql";
  if (/\b(?:def|print|import|from|class)\b/.test(sample) && /:\s*$|\bself\b/m.test(sample)) return "python";
  if (/^\s*[.#][\w-]+\s*\{|^\s*@media\b/m.test(sample)) return "css";
  return "text";
}

function looksLikeCodeSnippet(content: string) {
  const lines = String(content || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 3) return false;

  const codeLikeLines = lines.filter((line) =>
    /[{};<>=]/.test(line) ||
    /^<\/?[a-z][^>]*>$/i.test(line) ||
    /^(const|let|var|function|if|else|for|while|return|import|export|class|async|await|try|catch)\b/.test(line) ||
    /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|WITH)\b/i.test(line) ||
    /^(def|from|print|class)\b/.test(line)
  );

  return codeLikeLines.length >= Math.max(2, Math.ceil(lines.length * 0.5));
}

function detectInlineType(content: string): { type: GIOMMessage["type"]; content: unknown; language?: string } | null {
  const trimmed = content.trim();
  const promptPayload = extractPromptPayloadFromJsonLike(trimmed);
  if (promptPayload) {
    return promptPayload;
  }

  const codeBlocks = Array.from(trimmed.matchAll(/```([a-zA-Z0-9_-]+)?\n([\s\S]*?)\n```/g));
  if (codeBlocks.length) {
    const primaryBlock = codeBlocks.reduce((currentBest, candidate) => {
      const currentLength = String(currentBest[2] || "").length;
      const candidateLength = String(candidate[2] || "").length;
      return candidateLength > currentLength ? candidate : currentBest;
    });

    const primaryIndex = primaryBlock.index ?? 0;
    const prefix = trimmed.slice(0, primaryIndex).trim();
    const suffix = trimmed.slice(primaryIndex + primaryBlock[0].length).trim();
    const surroundingText = [prefix, suffix].filter(Boolean).join("\n").trim();
    const primaryLength = String(primaryBlock[2] || "").trim().length;

    if (!surroundingText || surroundingText.length <= 180 || primaryLength >= surroundingText.length) {
      return {
        type: "code",
        language: primaryBlock[1] || "text",
        content: primaryBlock[2]
      };
    }
  }

  const codeMatch = trimmed.match(/^```([a-zA-Z0-9_-]+)?\n([\s\S]*?)\n```$/);
  if (codeMatch) {
    return {
      type: "code",
      language: codeMatch[1] || "text",
      content: codeMatch[2]
    };
  }

  if (looksLikeCodeSnippet(trimmed)) {
    return {
      type: "code",
      language: inferCodeLanguage(trimmed),
      content: trimmed
    };
  }

  const checklistLines = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (checklistLines.length && checklistLines.every((line) => /^[-*]\s+\[[ xX]\]\s+/.test(line))) {
    return {
      type: "checklist",
      content: checklistLines.map((line) => {
        const match = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
        return {
          label: match?.[2] || line,
          checked: (match?.[1] || "").toLowerCase() === "x"
        };
      })
    };
  }

  const lines = trimmed.split("\n");
  if (lines.length >= 3 && lines[0].includes("|") && /^\s*\|?\s*[:-]+[-| :]*\|?\s*$/.test(lines[1])) {
    const columns = splitTableRow(lines[0]);
    const rows = lines.slice(2).filter((line) => line.includes("|")).map((line) => splitTableRow(line));
    return {
      type: "table",
      content: { columns, rows }
    };
  }

  if (lines.length && lines.every((line) => /^(\d{4}|\d{1,2}:\d{2})\s*[-:|]\s+/.test(line.trim()))) {
    return {
      type: "timeline",
      content: lines.map((line) => {
        const [time, ...rest] = line.split(/\s*[-:|]\s+/);
        return {
          time: time.trim(),
          title: rest.join(" - ")
        };
      })
    };
  }

  return null;
}

function toGIOMMessage(message: ChatMessage): GIOMMessage {
  if (message.generatedImage) {
    return {
      id: message.id,
      type: "image",
      content: {
        mimeType: message.generatedImage.mimeType,
        base64: message.generatedImage.base64,
        fileName: `giom-image-${message.id}.png`
      },
      meta: {
        prompt: message.artifactPrompt || ""
      }
    };
  }

  if (message.generatedDocument) {
    return {
      id: message.id,
      type: "document",
      content: {
        title: message.generatedDocument.fileName,
        sections: [
          {
            heading: "Preview",
            body: message.generatedDocument.previewText
          }
        ]
      },
      meta: {
        prompt: message.artifactPrompt || "",
        fileName: message.generatedDocument.fileName,
        mimeType: message.generatedDocument.mimeType,
        base64: message.generatedDocument.base64
      }
    };
  }

  const payload = parseSpecialPayload(message.content);
  if (payload) {
    const payloadContent = isRenderableMessageContent(payload.content) ? payload.content : message.content;
    return {
      id: message.id,
      type: (payload.type as GIOMMessage["type"]) || "text",
      content: payloadContent,
      language: typeof payload.language === "string" ? payload.language : undefined,
      meta: typeof payload.meta === "object" && payload.meta ? payload.meta as Record<string, unknown> : undefined
    };
  }

  const inline = detectInlineType(message.content);
  if (inline) {
    return {
      id: message.id,
      type: inline.type,
      content: inline.content as string | Record<string, unknown> | Array<unknown>,
      language: inline.language,
      meta: {
        prompt: message.artifactPrompt || ""
      }
    };
  }

  return {
    id: message.id,
    type: "text",
    content: message.content,
    meta: {
      prompt: message.artifactPrompt || ""
    }
  };
}

function MessageRichContent(
  {
    message,
    onCopyText,
    onEditText
  }: {
    message: ChatMessage;
    onCopyText: (value: string) => boolean | Promise<boolean>;
    onEditText: (value: string) => void;
  }
) {
  const giomMessage = useMemo(() => toGIOMMessage(message), [message]);

  return (
    <MessageRenderer
      message={giomMessage}
      onCopy={(value) => onCopyText(value)}
      onEdit={(value) => onEditText(value)}
    />
  );
}

async function readFileAsBase64(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const pathname = usePathname();
  const surface: AppSurface = pathname?.startsWith("/chat/bible") ? "study" : "chat";
  const [threads, setThreads] = useState<ChatThread[]>([createThread()]);
  const [activeThreadId, setActiveThreadId] = useState<string>("");
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [messageUploadPreviews, setMessageUploadPreviews] = useState<Record<string, MessageUploadPreview[]>>({});
  const [isSending, setIsSending] = useState(false);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [authStep, setAuthStep] = useState<AuthStep>("email");
  const [showAuthScreen, setShowAuthScreen] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<Provider | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authUser, setAuthUser] = useState<AuthIdentity | null>(createGuestIdentity());

  const [usage, setUsage] = useState<UsageRecord | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showGuestNewChatModal, setShowGuestNewChatModal] = useState(false);
  const [weatherLocation, setWeatherLocation] = useState<WeatherLocationContext | null>(null);
  const [studyModeEnabled, setStudyModeEnabled] = useState(false);
  const [studyTrackId, setStudyTrackId] = useState<string | null>(null);
  const [selectedBibleStudyModules, setSelectedBibleStudyModules] = useState<string[]>([]);
  const [preferredBibleCode, setPreferredBibleCode] = useState("NAA");
  const [studyMinistryFocus, setStudyMinistryFocus] = useState("");
  const [studyDepthPreference, setStudyDepthPreference] = useState("balanced");
  const [studyProgress, setStudyProgress] = useState<BibleLearningProgressState>({});
  const [studyCelebrationActive, setStudyCelebrationActive] = useState(false);
  const [learningProfileReady, setLearningProfileReady] = useState(false);
  const [learningProfileOwnerId, setLearningProfileOwnerId] = useState<string | null>(null);

  const [micSupported, setMicSupported] = useState(false);
  const [micListening, setMicListening] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(false);
  const [speakerSupported, setSpeakerSupported] = useState(false);
  const [selectedVoicePersona, setSelectedVoicePersona] = useState<VoicePersonaId>("giom");
  const [voicePreferencesReady, setVoicePreferencesReady] = useState(false);
  const [voicePreviewActive, setVoicePreviewActive] = useState(false);
  const [selectedVoiceName, setSelectedVoiceName] = useState("browser-default");
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>(() => buildBrowserVoiceOptions());
  const [voiceConversationMode, setVoiceConversationMode] = useState(false);
  const [voiceConversationPaused, setVoiceConversationPaused] = useState(false);
  const [voiceInputLevel, setVoiceInputLevel] = useState(0);
  const [voiceOutputLevel, setVoiceOutputLevel] = useState(0);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [voiceSession, setVoiceSession] = useState<RealtimeVoiceSession | null>(null);
  const [voiceInterimTranscript, setVoiceInterimTranscript] = useState("");
  const [voiceQuickModalOpen, setVoiceQuickModalOpen] = useState(false);
  const [inlineVoiceComposerActive, setInlineVoiceComposerActive] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const chatRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceRecorderRef = useRef<WavAudioRecorderController | null>(null);
  const speechPlaybackRef = useRef<BrowserSpeechController | null>(null);
  const silenceDetectorRef = useRef<SilenceDetectorController | null>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);
  const voiceInterruptDetectorRef = useRef<SilenceDetectorController | null>(null);
  const voiceInterruptStreamRef = useRef<MediaStream | null>(null);
  const voiceInterruptArmTimerRef = useRef<number | null>(null);
  const voiceOutputMonitorRef = useRef<AudioLevelMonitorController | null>(null);
  const voiceOutputSyntheticTimerRef = useRef<number | null>(null);
  const submitMessageRef = useRef<(() => Promise<void>) | null>(null);
  const startVoiceConversationModeRef = useRef<((options?: { enableSpeaker?: boolean }) => void) | null>(null);
  const voiceSessionRef = useRef<RealtimeVoiceSession | null>(null);
  const voiceConversationModeRef = useRef(false);
  const voiceConversationPausedRef = useRef(false);
  const voiceConversationResumeTimerRef = useRef<number | null>(null);
  const voiceCaptureModeRef = useRef<VoiceCaptureMode>("idle");
  const voiceCaptureFinishingRef = useRef(false);
  const voiceBargeInPendingRef = useRef(false);
  const voiceCapturedSinceStartRef = useRef(false);
  const voiceShouldAutoSubmitRef = useRef(false);
  const lastVoicePartialSentAtRef = useRef(0);
  const threadsRef = useRef<ChatThread[]>(threads);
  const messageUploadPreviewsRef = useRef<Record<string, MessageUploadPreview[]>>({});
  const guestLandingResetRef = useRef(false);
  const hydratedGuestThreadsHadMessagesRef = useRef(false);
  const guestThreadActivityRef = useRef(false);
  const inlineVoiceComposerActiveRef = useRef(false);

  const configuredApiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();
  const configuredBackendTarget = (process.env.NEXT_PUBLIC_BACKEND_PROXY_TARGET || "").trim();
  const useProxyInDev = process.env.NODE_ENV !== "production";
  const allowDirectBackendFallback = process.env.NEXT_PUBLIC_ALLOW_DIRECT_BACKEND_FALLBACK === "true";
  const apiBases = useMemo(() => {
    const candidates = [
      useProxyInDev ? "/backend" : configuredApiBase || "/backend",
      configuredApiBase,
      useProxyInDev && allowDirectBackendFallback && configuredBackendTarget ? configuredBackendTarget : ""
    ]
      .map((value) => normalizeApiBase(value))
      .filter(Boolean);

    return Array.from(new Set(candidates));
  }, [allowDirectBackendFallback, configuredApiBase, configuredBackendTarget, useProxyInDev]);

  const threadStorageOwnerKey = useMemo(
    () => getThreadStorageOwnerKey(authUser),
    [authUser]
  );
  const bibleLearningTracks = useMemo<BibleLearningTrack[]>(() => {
    const tracks = config?.ai?.bibleLearningTracks;
    return Array.isArray(tracks) ? tracks : [];
  }, [config?.ai?.bibleLearningTracks]);
  const bibleModuleCatalog = useMemo<BibleStudyModuleOption[]>(() => {
    const modules = config?.ai?.bibleStudyModules;
    return Array.isArray(modules) ? modules : [];
  }, [config?.ai?.bibleStudyModules]);
  const bibleModuleIdSet = useMemo(
    () => new Set(bibleModuleCatalog.map((module) => module.id)),
    [bibleModuleCatalog]
  );
  const activeBibleTrack = useMemo(
    () => bibleLearningTracks.find((track) => track.id === studyTrackId) || bibleLearningTracks[0] || null,
    [bibleLearningTracks, studyTrackId]
  );
  const activeBibleProgress = useMemo(() => {
    if (!activeBibleTrack) {
      return null;
    }

    return studyProgress[activeBibleTrack.id] || {
      completedStepIds: [],
      currentStepId: activeBibleTrack.steps[0]?.id || null,
      updatedAt: null
    };
  }, [activeBibleTrack, studyProgress]);
  const activeBibleStep = useMemo(() => {
    if (!activeBibleTrack) {
      return null;
    }

    const currentStepId = activeBibleProgress?.currentStepId || activeBibleTrack.steps[0]?.id || null;
    return activeBibleTrack.steps.find((step) => step.id === currentStepId) || activeBibleTrack.steps[0] || null;
  }, [activeBibleProgress?.currentStepId, activeBibleTrack]);
  const activeBibleCompletionRate = useMemo(() => {
    if (!activeBibleTrack?.steps.length) {
      return 0;
    }

    const completed = new Set(activeBibleProgress?.completedStepIds || []);
    return Math.round((completed.size / activeBibleTrack.steps.length) * 100);
  }, [activeBibleProgress?.completedStepIds, activeBibleTrack]);
  const activeBibleMilestoneSummary = useMemo(() => {
    if (!activeBibleTrack) {
      return {
        unlocked: 0,
        total: 0,
        nextLabel: null as string | null
      };
    }

    const completed = new Set(activeBibleProgress?.completedStepIds || []);
    const milestones = activeBibleTrack.steps
      .map((step, index) => ({
        id: step.id,
        label: getStudyCheckpointLabel(index, activeBibleTrack.steps.length),
        checkpoint: isStudyCheckpointStep(index, activeBibleTrack.steps.length)
      }))
      .filter((entry) => entry.checkpoint);

    return {
      unlocked: milestones.filter((entry) => completed.has(entry.id)).length,
      total: milestones.length,
      nextLabel: milestones.find((entry) => !completed.has(entry.id))?.label || null
    };
  }, [activeBibleProgress?.completedStepIds, activeBibleTrack]);
  const studyMedalHistory = useMemo(() => {
    return bibleLearningTracks
      .flatMap((track) => {
        const progressEntry = studyProgress[track.id];
        const completed = new Set(progressEntry?.completedStepIds || []);
        const updatedAtValue = progressEntry?.updatedAt ? new Date(progressEntry.updatedAt).getTime() : 0;

        return track.steps
          .map((step, index) => ({
            id: `${track.id}:${step.id}`,
            trackId: track.id,
            trackLabel: track.label,
            stepId: step.id,
            stepLabel: step.label,
            medalLabel: getStudyCheckpointLabel(index, track.steps.length),
            checkpoint: isStudyCheckpointStep(index, track.steps.length),
            stepIndex: index,
            updatedAtValue
          }))
          .filter((entry) => entry.checkpoint && completed.has(entry.stepId));
      })
      .sort((left, right) => {
        if (right.updatedAtValue !== left.updatedAtValue) {
          return right.updatedAtValue - left.updatedAtValue;
        }

        if (left.trackLabel !== right.trackLabel) {
          return left.trackLabel.localeCompare(right.trackLabel, "pt-BR");
        }

        return right.stepIndex - left.stepIndex;
      })
      .map(({ checkpoint, stepIndex, updatedAtValue, ...entry }) => entry);
  }, [bibleLearningTracks, studyProgress]);
  const studyMedalSummary = useMemo(() => {
    const total = bibleLearningTracks.reduce((sum, track) => {
      return sum + track.steps.filter((_, index) => isStudyCheckpointStep(index, track.steps.length)).length;
    }, 0);

    return {
      unlocked: studyMedalHistory.length,
      total,
      activeTrackLabel: activeBibleTrack?.label || null,
      activeTrackUnlocked: activeBibleMilestoneSummary.unlocked,
      activeTrackTotal: activeBibleMilestoneSummary.total,
      nextLabel: activeBibleMilestoneSummary.nextLabel
    };
  }, [activeBibleMilestoneSummary, activeBibleTrack?.label, bibleLearningTracks, studyMedalHistory.length]);
  const providerResilienceLabel = useMemo(
    () => buildProviderResilienceLabel(config?.ai?.providers),
    [config?.ai?.providers]
  );
  const activeThread = threads.find((thread) => thread.id === activeThreadId) || threads[0];
  const messages = activeThread?.messages || EMPTY_MESSAGES;
  const landingGreeting = useMemo(() => buildStaticLandingGreeting(), []);
  const activeVoicePersona = useMemo(() => getVoicePersonaOption(selectedVoicePersona), [selectedVoicePersona]);
  const preferredVoice = selectedVoiceName || "browser-default";
  const runtimeVoicePersonas = useMemo<RuntimeVoicePersona[]>(() => {
    const personas = config?.runtime?.voice?.personas;
    return Array.isArray(personas) ? personas : [];
  }, [config?.runtime?.voice?.personas]);
  const activeRuntimeVoicePersona = useMemo(
    () => runtimeVoicePersonas.find((persona) => normalizeVoicePersonaId(persona.id) === selectedVoicePersona) || null,
    [runtimeVoicePersonas, selectedVoicePersona]
  );
  const activeServerVoice = useMemo(() => {
    if (!config?.features?.serverAudioSpeech || !activeRuntimeVoicePersona?.serverAudioAvailable) {
      return "";
    }

    return String(activeRuntimeVoicePersona.voice || activeRuntimeVoicePersona.id || "").trim();
  }, [activeRuntimeVoicePersona, config?.features?.serverAudioSpeech]);
  const shouldUseServerVoiceAudio = Boolean(activeServerVoice);
  const requestedVoiceOutput = activeServerVoice || preferredVoice;
  const bargeInEnabled = config?.runtime?.voice?.bargeIn !== false;
  const voiceSignalMode: VoiceSignalMode = voiceStatus === "speaking"
    ? "output"
    : voiceStatus === "listening"
      ? "input"
      : "idle";
  const voiceSignalLevel = voiceSignalMode === "output"
    ? voiceOutputLevel
    : voiceSignalMode === "input"
      ? voiceInputLevel
      : 0;
  const voiceOutputEngine: "server" | "browser" | "muted" = !speakerEnabled
    ? "muted"
    : shouldUseServerVoiceAudio
      ? "server"
      : "browser";
  const voiceStatusLabel = useMemo(
    () => getVoiceStatusLabel(voiceStatus, voiceInterimTranscript),
    [voiceInterimTranscript, voiceStatus]
  );
  const latestAssistantVoiceText = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message?.role === "assistant" && message.content.trim()) {
        return message.content.trim();
      }
    }

    return "";
  }, [messages]);
  const latestUserVoiceText = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message?.role === "user" && message.content.trim()) {
        return message.content.trim();
      }
    }

    return "";
  }, [messages]);
  const voiceRecoveryHint = useMemo(() => {
    if (!voiceConversationMode) {
      return null;
    }

    if (!micSupported) {
      return "Microfone indisponivel para este fluxo continuo neste navegador/dispositivo.";
    }

    if (!speakerSupported) {
      return "A resposta em voz alta nao esta disponivel neste navegador/dispositivo.";
    }

    return getVoiceRecoveryHint(requestError);
  }, [micSupported, requestError, speakerSupported, voiceConversationMode]);
  const voiceSessionReady = voiceConversationMode && (voiceStatus !== "connecting" || Boolean(voiceSession?.sessionId));
  const studyVoiceActive = surface === "study" && (voiceConversationMode || inlineVoiceComposerActive || micListening);
  const studyMascotMode = useMemo<StudyMascotMode>(() => {
    if (studyCelebrationActive) {
      return "celebrating";
    }

    if (surface !== "study") {
      return "idle";
    }

    if (voiceStatus === "speaking" || voiceSignalMode === "output") {
      return "speaking";
    }

    if (
      studyVoiceActive
      || voiceStatus === "connecting"
      || voiceStatus === "listening"
      || voiceStatus === "processing"
    ) {
      return "listening";
    }

    return "idle";
  }, [studyCelebrationActive, studyVoiceActive, surface, voiceSignalMode, voiceStatus]);
  const studyMascotStatusLabel = useMemo(() => {
    if (studyMascotMode === "celebrating") {
      return activeBibleStep
        ? `Etapa ${activeBibleStep.label} concluida. Continue no mapa para manter o ritmo.`
        : "Etapa concluida. Continue no mapa para manter o ritmo.";
    }

    if (studyMascotMode === "speaking" || studyMascotMode === "listening") {
      return voiceStatusLabel;
    }

    if (activeBibleStep) {
      return `Agora: ${activeBibleStep.label}. ${activeBibleStep.goal}`;
    }

    if (studyModeEnabled) {
      return "Trilha ativa. Escolha a proxima etapa no painel lateral.";
    }

    return "Escolha uma trilha biblica para iniciar a experiencia guiada.";
  }, [activeBibleStep, studyMascotMode, studyModeEnabled, voiceStatusLabel]);
  const resolvedDeviceVoiceLabel = useMemo(() => {
    if (shouldUseServerVoiceAudio) {
      return `Servidor: ${activeRuntimeVoicePersona?.label || activeVoicePersona.label}`;
    }

    const current = voiceOptions.find((option) => option.value === preferredVoice);
    return current?.label || "Padrao do navegador";
  }, [activeRuntimeVoicePersona?.label, activeVoicePersona.label, preferredVoice, shouldUseServerVoiceAudio, voiceOptions]);
  const activePersonaSpeech = useMemo(
    () => buildPersonaSpeechSettings(activeVoicePersona, preferredVoice),
    [activeVoicePersona, preferredVoice]
  );

  useEffect(() => {
    if (!studyCelebrationActive) {
      return;
    }

    const timer = window.setTimeout(() => {
      setStudyCelebrationActive(false);
    }, 4200);

    return () => window.clearTimeout(timer);
  }, [studyCelebrationActive]);

  const requestJsonWithFailover = useCallback(async (route: string, init: RequestInit, timeoutMs = 20_000) => {
    let lastError: unknown = null;
    const attempts: string[] = [];

    for (let index = 0; index < apiBases.length; index += 1) {
      const base = apiBases[index];
      const url = buildApiUrl(base, route);
      try {
        const response = await resilientFetch(url, {
          ...init,
          timeoutMs,
          forceRetry: false
        });

        const raw = await response.text();
        const payload = (() => {
          try {
            return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
          } catch {
            return {};
          }
        })();
        if (!response.ok) {
          const rawHint = String(raw || "").replace(/\s+/g, " ").slice(0, 180);
          const message = buildBackendFailureMessage(route, response.status, payload, rawHint);
          const wrapped = new Error(message) as Error & { status?: number };
          wrapped.status = response.status;
          attempts.push(`${url} -> HTTP ${response.status}`);
          throw wrapped;
        }

        return payload as Record<string, unknown>;
      } catch (error) {
        lastError = error;
        if (!attempts.some((item) => item.startsWith(url))) {
          attempts.push(`${url} -> ${String((error as { message?: string })?.message || "falha de rede")}`);
        }
        const hasNextBase = index < apiBases.length - 1;
        if (!hasNextBase || !shouldTryNextApiBase(error)) {
          const enriched = new Error(
            `Falha ao acessar backend (${route}). Tentativas: ${attempts.join(" | ")}. Verifique se a API esta ativa e se o proxy /backend aponta para a porta correta.`
          ) as Error & { status?: number };
          enriched.status = Number((error as { status?: number })?.status || 0) || undefined;
          throw enriched;
        }
      }
    }

    throw lastError || new Error("Falha de conexao com backend.");
  }, [apiBases]);

  const syncInlineVoiceComposerMode = useCallback((next: boolean) => {
    inlineVoiceComposerActiveRef.current = next;
    setInlineVoiceComposerActive(next);
  }, []);

  const releaseVoiceCaptureResources = useCallback(() => {
    silenceDetectorRef.current?.stop();
    silenceDetectorRef.current = null;
    setVoiceInputLevel(0);

    const stream = captureStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    captureStreamRef.current = null;
  }, []);

  const releaseVoiceRecorder = useCallback((mode: "cancel" | "detach" = "cancel") => {
    if (mode === "cancel") {
      voiceRecorderRef.current?.cancel();
    }
    voiceRecorderRef.current = null;
  }, []);

  const releaseVoiceInterruptMonitor = useCallback(() => {
    if (voiceInterruptArmTimerRef.current !== null) {
      window.clearTimeout(voiceInterruptArmTimerRef.current);
      voiceInterruptArmTimerRef.current = null;
    }

    voiceInterruptDetectorRef.current?.stop();
    voiceInterruptDetectorRef.current = null;

    const interruptStream = voiceInterruptStreamRef.current;
    voiceInterruptStreamRef.current = null;
    interruptStream?.getTracks().forEach((track) => track.stop());
  }, []);

  const releaseVoiceOutputMonitor = useCallback(() => {
    if (voiceOutputSyntheticTimerRef.current !== null) {
      window.clearInterval(voiceOutputSyntheticTimerRef.current);
      voiceOutputSyntheticTimerRef.current = null;
    }

    voiceOutputMonitorRef.current?.stop();
    voiceOutputMonitorRef.current = null;
    setVoiceOutputLevel(0);
  }, []);

  const startSyntheticVoiceOutputMonitor = useCallback(() => {
    releaseVoiceOutputMonitor();

    const pattern = [1, 3, 5, 2, 4, 2];
    let index = 0;
    setVoiceOutputLevel(pattern[0] || 0);

    voiceOutputSyntheticTimerRef.current = window.setInterval(() => {
      index = (index + 1) % pattern.length;
      setVoiceOutputLevel(pattern[index] || 0);
    }, 120);
  }, [releaseVoiceOutputMonitor]);

  function queueVoiceConversationResume(delayMs = 420) {
    if (typeof window === "undefined") {
      return;
    }

    if (voiceConversationResumeTimerRef.current !== null) {
      window.clearTimeout(voiceConversationResumeTimerRef.current);
    }

    voiceConversationResumeTimerRef.current = window.setTimeout(() => {
      voiceConversationResumeTimerRef.current = null;

      if (
        !voiceConversationModeRef.current
        || voiceConversationPausedRef.current
        || voiceCaptureModeRef.current !== "idle"
        || speechPlaybackRef.current
        || voiceBargeInPendingRef.current
      ) {
        return;
      }

      void startRealtimeVoiceCapture({ autoSubmit: true }).catch((error) => {
        voiceConversationModeRef.current = false;
        voiceConversationPausedRef.current = false;
        setVoiceConversationMode(false);
        setVoiceConversationPaused(false);
        setVoiceStatus("idle");
        setRequestError(
          error instanceof Error
            ? error.message
            : "Nao foi possivel retomar a conversa por voz."
        );
      });
    }, delayMs);
  }

  const stopPlayback = useCallback((nextStatus: VoiceStatus = "idle") => {
    releaseVoiceInterruptMonitor();
    releaseVoiceOutputMonitor();
    speechPlaybackRef.current?.cancel();
    speechPlaybackRef.current = null;
    setVoicePreviewActive(false);
    setVoiceStatus((current) => current === "speaking" ? nextStatus : current);
  }, [releaseVoiceInterruptMonitor, releaseVoiceOutputMonitor]);

  const ensureVoiceSession = useCallback(async () => {
    if (
      voiceSessionRef.current
      && voiceSessionRef.current.status !== "closed"
      && String(voiceSessionRef.current.voice?.output || "browser-default") === requestedVoiceOutput
    ) {
      return voiceSessionRef.current;
    }

    voiceSessionRef.current = null;
    setVoiceSession(null);

    const payload = parseRealtimeSessionEnvelopePayload(await requestJsonWithFailover(
      "/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": authUser?.id || getScopeId()
        },
        body: JSON.stringify({
          locale: "pt-BR",
          transport: "sse",
          voice: requestedVoiceOutput,
          outputVoice: requestedVoiceOutput,
          metadata: {
            surface: "web-next",
            autoSpeech: speakerEnabled,
            persona: selectedVoicePersona,
            serverVoice: activeServerVoice || null
          },
          vad: {
            enabled: true,
            threshold: 0.045,
            silenceMs: 1400
          }
        })
      },
      15_000
    ));

    const sessionRecord = payload.session;
    const session: RealtimeVoiceSession = {
      sessionId: String(sessionRecord.sessionId || ""),
      status: String(sessionRecord.status || "active"),
      locale: String(sessionRecord.locale || "pt-BR"),
      transport: String(sessionRecord.transport || "sse"),
      voice: (sessionRecord.voice || null) as RealtimeVoiceSession["voice"],
      vad: (sessionRecord.vad || null) as RealtimeVoiceSession["vad"]
    };

    if (!session.sessionId) {
      throw new Error("Nao foi possivel abrir sessao de voz realtime.");
    }

    voiceSessionRef.current = session;
    setVoiceSession(session);
    return session;
  }, [activeServerVoice, authUser?.id, requestJsonWithFailover, requestedVoiceOutput, selectedVoicePersona, speakerEnabled]);

  const pushVoiceEvent = useCallback(async (
    sessionId: string,
    type: string,
    payload: Record<string, unknown> = {},
    options?: { text?: string; final?: boolean; direction?: string }
  ) => {
    await requestJsonWithFailover(
      `/v1/realtime/sessions/${sessionId}/events`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": authUser?.id || getScopeId()
        },
        body: JSON.stringify({
          type,
          direction: options?.direction || "client",
          final: options?.final !== false,
          text: options?.text || "",
          payload
        })
      },
      10_000
    ).catch(() => null);
  }, [authUser?.id, requestJsonWithFailover]);

  const normalizeRealtimeTranscription = useCallback(async (
    sessionId: string | null,
    transcript: string,
    final = true
  ) => {
    const trimmed = String(transcript || "").trim();
    if (!trimmed) {
      return "";
    }

    const payload = parseRealtimeTranscriptionPayload(await requestJsonWithFailover(
      "/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": authUser?.id || getScopeId()
        },
        body: JSON.stringify({
          sessionId,
          transcript: trimmed,
          language: "pt-BR",
          final,
          source: "browser_microphone"
        })
      },
      12_000
    ));

    return String(payload?.text || trimmed).trim();
  }, [authUser?.id, requestJsonWithFailover]);

  const requestSpeechManifest = useCallback(async (
    sessionId: string | null,
    input: string,
    options?: SpeechManifestRequestOptions
  ) => {
    const cleaned = buildSpeechSafeText(input);
    if (!cleaned) {
      return null;
    }

    const returnServerAudio = options?.forceServerAudio ?? shouldUseServerVoiceAudio;

    const payload = parseRealtimeSpeechEnvelopePayload(await requestJsonWithFailover(
      "/v1/audio/speech",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": authUser?.id || getScopeId()
        },
        body: JSON.stringify({
          sessionId,
          input: cleaned,
          language: activePersonaSpeech.language,
          voice: requestedVoiceOutput,
          outputVoice: requestedVoiceOutput,
          rate: activePersonaSpeech.rate,
          pitch: activePersonaSpeech.pitch,
          autoPlay: true,
          returnAudio: returnServerAudio
        })
      },
      12_000
    ));

    return normalizeRealtimeSpeechManifest(payload.speech, cleaned);
  }, [activePersonaSpeech.language, activePersonaSpeech.pitch, activePersonaSpeech.rate, authUser?.id, requestJsonWithFailover, requestedVoiceOutput, shouldUseServerVoiceAudio]);

  async function requestAssistantResponseRealtime(
    question: string,
    context: GIOMAskContext,
    voiceSessionId: string
  ) {
    const safeContext = sanitizeContextForApi(context);
    const payload = parseRealtimeVoiceResponseEnvelopePayload(await requestJsonWithFailover(
      `/v1/realtime/sessions/${voiceSessionId}/respond`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": authUser?.id || getScopeId()
        },
        body: JSON.stringify({
          input: question,
          voice: requestedVoiceOutput,
          language: activePersonaSpeech.language,
          rate: activePersonaSpeech.rate,
          pitch: activePersonaSpeech.pitch,
          context: safeContext,
          appendInputEvent: true,
          chunkDelayMs: 90,
          maxChunkChars: 120,
          returnAudio: shouldUseServerVoiceAudio
        })
      },
      95_000
    ));

    const responseRecord = payload.response;
    const speechRecord = normalizeRealtimeSpeechManifest(payload.speech, "");
    const answer = extractAnswer(responseRecord) || String(responseRecord.text || "").trim();
    const speech = speechRecord?.text ? normalizeRealtimeSpeechManifest(speechRecord, answer) : null;

    return {
      answer: answer || "Resposta vazia do servidor.",
      metadata: extractAssistantResponseMetadata(responseRecord),
      speech
    };
  }

  const requestStreamWithFailover = useCallback(async (route: string, init: RequestInit, timeoutMs = 30_000) => {
    let lastError: unknown = null;
    const attempts: string[] = [];

    for (let index = 0; index < apiBases.length; index += 1) {
      const base = apiBases[index];
      const url = buildApiUrl(base, route);
      try {
        const response = await resilientFetch(url, {
          ...init,
          timeoutMs,
          forceRetry: false
        });

        if (!response.ok || !response.body) {
          const raw = await response.text().catch(() => "");
          const payload = (() => {
            try {
              return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
            } catch {
              return {};
            }
          })();
          const rawHint = String(raw || "").replace(/\s+/g, " ").slice(0, 180);
          const message = buildBackendFailureMessage(route, response.status, payload, rawHint);
          const wrapped = new Error(message) as Error & { status?: number };
          wrapped.status = response.status;
          attempts.push(`${url} -> HTTP ${response.status}`);
          throw wrapped;
        }

        return response;
      } catch (error) {
        lastError = error;
        if (!attempts.some((item) => item.startsWith(url))) {
          attempts.push(`${url} -> ${String((error as { message?: string })?.message || "falha de rede")}`);
        }
        const hasNextBase = index < apiBases.length - 1;
        if (!hasNextBase || !shouldTryNextApiBase(error)) {
          const enriched = new Error(
            `Falha ao abrir stream (${route}). Tentativas: ${attempts.join(" | ")}. Verifique se a API esta ativa e se o proxy /backend aponta para a porta correta.`
          ) as Error & { status?: number };
          enriched.status = Number((error as { status?: number })?.status || 0) || undefined;
          throw enriched;
        }
      }
    }

    throw lastError || new Error("Falha de conexao com backend.");
  }, [apiBases]);

  const appendVoiceTranscript = useCallback(async (sessionId: string | null, transcript: string) => {
    const normalized = String(transcript || "").trim();
    if (!normalized) {
      return "";
    }

    setInput((current) => `${current}${current.trim() ? " " : ""}${normalized}`.trim());
    setVoiceInterimTranscript("");

    if (sessionId) {
      await pushVoiceEvent(sessionId, "transcription.appended", {
        transcript: normalized
      }, {
        text: normalized,
        final: true
      });
    }

    return normalized;
  }, [pushVoiceEvent]);

  const normalizeRealtimeCapturedAudio = useCallback(async (
    sessionId: string | null,
    capture: WavAudioCaptureResult
  ) => {
    const payload = parseRealtimeTranscriptionPayload(await requestJsonWithFailover(
      "/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": authUser?.id || getScopeId()
        },
        body: JSON.stringify({
          sessionId,
          audioDataUrl: capture.audioDataUrl,
          mimeType: capture.mimeType,
          sampleRate: capture.sampleRate,
          channels: capture.channels,
          language: "pt-BR",
          final: true,
          source: "browser_microphone_server_capture"
        })
      },
      25_000
    ));

    return String(payload?.text || "").trim();
  }, [authUser?.id, requestJsonWithFailover]);

  const limits = useMemo(() => getPlanLimits(authUser), [authUser]);
  const messagesUsed = usage?.messages || 0;
  const imagesUsed = usage?.images || 0;
  const documentsUsed = usage?.documents || 0;

  const messagesRemaining = Number.isFinite(limits.messages) ? Math.max(0, limits.messages - messagesUsed) : Number.POSITIVE_INFINITY;
  const imagesRemaining = Number.isFinite(limits.images) ? Math.max(0, limits.images - imagesUsed) : Number.POSITIVE_INFINITY;
  const documentsRemaining = Number.isFinite(limits.documents) ? Math.max(0, limits.documents - documentsUsed) : Number.POSITIVE_INFINITY;

  const canUseUploads = Boolean(limits.uploads && config?.uploads?.enabled !== false);
  const canUseTools = Boolean(
    limits.tools && (
      !config?.features
      || config.features.imageGeneration !== false
      || config.features.documentGeneration !== false
    )
  );
  const authSupportsMagicLink = Boolean(config?.features?.auth && config?.supabaseUrl && config?.supabaseAnonKey);

  const availableDocFormats = useMemo(() => {
    const configured = config?.ai?.documentGeneration?.formats;
    if (!Array.isArray(configured) || !configured.length) {
      return ["pdf", "docx", "xlsx", "pptx", "txt", "md"];
    }

    const values = configured
      .map((entry) => String(entry?.id || entry?.format || "").trim().toLowerCase())
      .filter(Boolean);

    return values.length ? values : ["pdf", "docx", "xlsx", "pptx", "txt", "md"];
  }, [config]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setSpeakerSupported(Boolean(isBrowserSpeechSynthesisSupported() || config?.features?.serverAudioSpeech));
    const browserSpeechRecognitionFallback = isBrowserAudioCaptureSupported();
    const browserWavRecorderSupported = isBrowserWavRecorderSupported();
    const serverCaptureSupported = Boolean(config?.features?.serverAudioTranscriptions) && browserWavRecorderSupported;

    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructorLike;
      webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
    };

    const SpeechCtor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechCtor) {
      setMicSupported(serverCaptureSupported);
      speechRecognitionRef.current = null;
      return;
    }

    const recognition = new SpeechCtor();
    recognition.lang = "pt-BR";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
      setMicListening(true);
      setRequestError(null);
      setVoiceStatus("connecting");
      setVoiceInterimTranscript("");
      stopPlayback("connecting");
      voiceCapturedSinceStartRef.current = false;
      void ensureVoiceSession()
        .then((session) => pushVoiceEvent(session.sessionId, "session.listening_started", {
          microphone: true,
          vad: true
        }))
        .finally(() => {
          setVoiceStatus("listening");
        });
    };

    recognition.onend = () => {
      const inlineComposerCapture = inlineVoiceComposerActiveRef.current;
      setMicListening(false);
      voiceCaptureModeRef.current = "idle";
      releaseVoiceCaptureResources();
      setVoiceInterimTranscript("");
      if (inlineComposerCapture) {
        syncInlineVoiceComposerMode(false);
      }
      const sessionId = voiceSessionRef.current?.sessionId || null;
      if (sessionId) {
        void pushVoiceEvent(sessionId, "session.listening_stopped", {
          autoSubmitted: voiceShouldAutoSubmitRef.current && voiceCapturedSinceStartRef.current
        });
      }

      if (voiceShouldAutoSubmitRef.current && voiceCapturedSinceStartRef.current) {
        voiceShouldAutoSubmitRef.current = false;
        voiceCapturedSinceStartRef.current = false;
        setVoiceStatus("processing");
        requestAnimationFrame(() => {
          void submitMessageRef.current?.();
        });
        return;
      }

      voiceShouldAutoSubmitRef.current = false;
      voiceCapturedSinceStartRef.current = false;
      setVoiceStatus(() => voiceConversationPausedRef.current ? "paused" : "idle");
    };

    recognition.onerror = (event) => {
      const inlineComposerCapture = inlineVoiceComposerActiveRef.current;
      setMicListening(false);
      voiceCaptureModeRef.current = "idle";
      releaseVoiceCaptureResources();
      setVoiceInterimTranscript("");
      if (inlineComposerCapture) {
        syncInlineVoiceComposerMode(false);
      }
      voiceShouldAutoSubmitRef.current = false;
      voiceCapturedSinceStartRef.current = false;
      if ((voiceConversationPausedRef.current || inlineComposerCapture) && (event.error === "aborted" || !event.error)) {
        setVoiceStatus(voiceConversationPausedRef.current ? "paused" : "idle");
        return;
      }
      if (event.error && event.error !== "no-speech") {
        setRequestError(speechErrorMessage(event.error));
      }
      if (voiceSessionRef.current?.sessionId) {
        void pushVoiceEvent(voiceSessionRef.current.sessionId, "session.error", {
          error: event.error || "speech_error"
        });
      }
      setVoiceStatus("idle");
    };

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results.item(i);
        if (!result) continue;
        const chunk = result.item(0)?.transcript || "";
        if (result.isFinal) {
          finalTranscript += `${chunk} `;
        } else {
          interimTranscript += `${chunk} `;
        }
      }

      const interim = interimTranscript.trim();
      setVoiceInterimTranscript(interim);

      const sessionId = voiceSessionRef.current?.sessionId || null;
      if (sessionId && interim && Date.now() - lastVoicePartialSentAtRef.current > 900) {
        lastVoicePartialSentAtRef.current = Date.now();
        void pushVoiceEvent(sessionId, "transcription.partial", {
          transcript: interim
        }, {
          text: interim,
          final: false
        });
      }

      if (!finalTranscript.trim()) return;

      const finalText = finalTranscript.trim();
      voiceCapturedSinceStartRef.current = true;
      void (async () => {
        const normalized = await normalizeRealtimeTranscription(sessionId, finalText, true).catch(() => finalText);
        await appendVoiceTranscript(sessionId, normalized);
      })();
    };

    speechRecognitionRef.current = recognition;
    setMicSupported(Boolean(SpeechCtor) || browserSpeechRecognitionFallback || serverCaptureSupported);

    return () => {
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      releaseVoiceRecorder();
      releaseVoiceCaptureResources();
      try {
        recognition.stop();
      } catch {
        // noop
      }
      speechRecognitionRef.current = null;
    };
  }, [appendVoiceTranscript, config?.features?.serverAudioSpeech, config?.features?.serverAudioTranscriptions, ensureVoiceSession, normalizeRealtimeTranscription, pushVoiceEvent, releaseVoiceCaptureResources, releaseVoiceRecorder, stopPlayback, syncInlineVoiceComposerMode]);

  useEffect(() => {
    if (!authReady || !authUser) {
      return;
    }

    const storedThreads = readThreadsFromStorage(threadStorageOwnerKey);
    guestThreadActivityRef.current = false;
    if (storedThreads?.length) {
      hydratedGuestThreadsHadMessagesRef.current = storedThreads.some((thread) => thread.messages.length > 0);
      setThreads(storedThreads);
      setActiveThreadId(storedThreads[0].id);
    } else {
      const fallback = createThread();
      hydratedGuestThreadsHadMessagesRef.current = false;
      setThreads([fallback]);
      setActiveThreadId(fallback.id);
    }
    setIsHydrated(true);
  }, [authReady, authUser, threadStorageOwnerKey]);

  useEffect(() => {
    setWeatherLocation(readStoredWeatherLocation());
  }, []);

  useEffect(() => {
    const storedVoiceSettings = readStoredVoiceSettings();
    setSpeakerEnabled(Boolean(storedVoiceSettings.speakerEnabled));
    setSelectedVoicePersona(storedVoiceSettings.selectedVoicePersona === "diana" ? "diana" : "giom");
    setSelectedVoiceName(String(storedVoiceSettings.selectedVoiceName || "browser-default"));
    setVoicePreferencesReady(true);
  }, []);

  useEffect(() => {
    const resolvedVoiceName = resolvePersonaBrowserVoiceName(selectedVoicePersona, voiceOptions);
    setSelectedVoiceName(resolvedVoiceName);
  }, [selectedVoicePersona, voiceOptions]);

  useEffect(() => {
    voiceConversationModeRef.current = voiceConversationMode;
  }, [voiceConversationMode]);

  useEffect(() => {
    voiceConversationPausedRef.current = voiceConversationPaused;
  }, [voiceConversationPaused]);

  useEffect(() => {
    if (typeof window === "undefined" || !isBrowserSpeechSynthesisSupported()) {
      setVoiceOptions(buildBrowserVoiceOptions());
      return;
    }

    const syncVoices = () => {
      setVoiceOptions(buildBrowserVoiceOptions());
    };

    syncVoices();
    window.speechSynthesis.addEventListener("voiceschanged", syncVoices);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", syncVoices);
    };
  }, []);

  useEffect(() => {
    // Sidebar inicia fechada em qualquer viewport; o usuario abre manualmente.
    setSidebarOpen(false);
  }, []);

  useEffect(() => {
    if (!voicePreferencesReady) {
      return;
    }

    writeStoredVoiceSettings({
      speakerEnabled,
      selectedVoicePersona,
      selectedVoiceName: preferredVoice
    });
  }, [preferredVoice, selectedVoicePersona, speakerEnabled, voicePreferencesReady]);

  useEffect(() => {
    setAuthReady(false);
    setConfigLoaded(false);
    void requestJsonWithFailover("/config", {
      method: "GET"
    }, 15_000)
      .then((payload) => setConfig(parseRuntimeConfigPayload(payload) as RuntimeConfig))
      .catch(() => setConfig(null))
      .finally(() => setConfigLoaded(true));
  }, [requestJsonWithFailover]);

  // Warm-up: dispara um GET leve em /config para
  // pré-estabelecer a conexão keep-alive com o backend. Quando o usuário
  // enviar a primeira mensagem, a conexão TCP já existirá e não cairá por
  // socket idle / ECONNRESET no primeiro request.
  useEffect(() => {
    void fetch("/backend/config", { method: "GET", cache: "no-store" }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!configLoaded) {
      return;
    }

    setAuthReady(false);

    const authEnabled = Boolean(config?.features?.auth && config?.supabaseUrl && config?.supabaseAnonKey);
    if (!authEnabled || !config?.supabaseUrl || !config?.supabaseAnonKey) {
      supabaseRef.current = null;
      setAuthUser(readLocalSession() || createGuestIdentity());
      setAuthReady(true);
      return;
    }

    const client = createClient(String(config.supabaseUrl), String(config.supabaseAnonKey));
    supabaseRef.current = client;

    void client.auth.getUser()
      .then(({ data }) => {
        const nextIdentity = data.user ? mapSupabaseUser(data.user) : createGuestIdentity();
        writeLocalSession(data.user ? nextIdentity : null);
        setAuthUser(nextIdentity);
        setAuthReady(true);
      })
      .catch(() => {
        // Network/auth provider hiccups must not break hydration or app bootstrap.
        setAuthUser(readLocalSession() || createGuestIdentity());
        setAuthReady(true);
      });

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((_event, session) => {
      const nextIdentity = session?.user ? mapSupabaseUser(session.user) : createGuestIdentity();
      writeLocalSession(session?.user ? nextIdentity : null);
      setAuthUser(nextIdentity);
      setAuthReady(true);
    });

    return () => {
      subscription.unsubscribe();
      supabaseRef.current = null;
    };
  }, [config, configLoaded]);

  useEffect(() => {
    if (!authReady || !authUser || !config) {
      setLearningProfileReady(false);
      setLearningProfileOwnerId(null);
      return;
    }

    const fallbackTrack = bibleLearningTracks[0] || null;
    let cancelled = false;

    setLearningProfileReady(false);
    setLearningProfileOwnerId(null);
    setStudyModeEnabled(false);
    setStudyTrackId(fallbackTrack?.id || null);
    setSelectedBibleStudyModules(normalizeStudyModuleIds(fallbackTrack?.bibleStudyModules || [], bibleModuleIdSet));
    setPreferredBibleCode(String(fallbackTrack?.preferredBibleCode || "NAA").trim() || "NAA");
    setStudyMinistryFocus(String(fallbackTrack?.ministryFocus || "").trim());
    setStudyDepthPreference(normalizeStudyDepthPreference(fallbackTrack?.depthPreference));
    setStudyProgress(ensureTrackProgressEntry({}, fallbackTrack));

    void requestJsonWithFailover(
      "/memory/profile",
      {
        method: "GET",
        headers: {
          "X-User-Id": authUser.id
        }
      },
      15_000
    )
      .then((payload) => {
        if (cancelled) {
          return;
        }

        const memoryPayload = payload as MemoryProfilePayload;
        const profile = memoryPayload?.profile && typeof memoryPayload.profile === "object"
          ? memoryPayload.profile as Record<string, unknown>
          : {};
        const storedTrackId = String(profile.studyTrackId || "").trim();
        const resolvedTrack = bibleLearningTracks.find((track) => track.id === storedTrackId) || fallbackTrack;
        const nextProgress = ensureTrackProgressEntry(
          normalizeBibleLearningProgress(profile.studyProgress),
          resolvedTrack
        );
        const nextSelectedModules = Array.isArray(profile.selectedBibleStudyModules)
          ? normalizeStudyModuleIds(profile.selectedBibleStudyModules, bibleModuleIdSet)
          : resolveStudyModuleSelection(
              profile.bibleStudyModules,
              bibleModuleIdSet,
              resolvedTrack?.bibleStudyModules || []
            );

        setStudyModeEnabled(Boolean(profile.studyModeEnabled));
        setStudyTrackId(resolvedTrack?.id || null);
        setSelectedBibleStudyModules(nextSelectedModules);
        setPreferredBibleCode(
          String(profile.preferredBibleCode || resolvedTrack?.preferredBibleCode || "NAA").trim() || "NAA"
        );
        setStudyMinistryFocus(
          String(profile.studyMinistryFocus || profile.ministryFocus || resolvedTrack?.ministryFocus || "").trim()
        );
        setStudyDepthPreference(
          normalizeStudyDepthPreference(
            profile.studyDepthPreference || profile.depthPreference || resolvedTrack?.depthPreference
          )
        );
        setStudyProgress(nextProgress);
        setLearningProfileOwnerId(authUser.id);
        setLearningProfileReady(true);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setLearningProfileOwnerId(authUser.id);
        setLearningProfileReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [authReady, authUser, bibleLearningTracks, bibleModuleIdSet, config, requestJsonWithFailover]);

  useEffect(() => {
    if (!authUser || !learningProfileReady || learningProfileOwnerId !== authUser.id) {
      return;
    }

    const persistTimer = window.setTimeout(() => {
      void requestJsonWithFailover(
        "/memory/profile",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": authUser.id
          },
          body: JSON.stringify({
            profile: {
              studyModeEnabled,
              studyTrackId: activeBibleTrack?.id || null,
              selectedBibleStudyModules,
              preferredBibleCode,
              studyMinistryFocus,
              studyDepthPreference,
              studyProgress,
              assistantProfile: activeBibleTrack?.assistantProfile || undefined,
              ministryFocus: studyMinistryFocus || undefined,
              depthPreference: studyDepthPreference
            },
            activeModules: activeBibleTrack?.activeModules || [],
            bibleStudyModules: selectedBibleStudyModules,
            promptPacks: activeBibleTrack?.promptPacks || []
          })
        },
        15_000
      ).catch(() => undefined);
    }, 450);

    return () => {
      window.clearTimeout(persistTimer);
    };
  }, [
    activeBibleTrack,
    authUser,
    learningProfileOwnerId,
    learningProfileReady,
    preferredBibleCode,
    requestJsonWithFailover,
    selectedBibleStudyModules,
    studyDepthPreference,
    studyMinistryFocus,
    studyModeEnabled,
    studyProgress
  ]);

  useEffect(() => {
    if (!isHydrated || !authUser) return;
    writeThreadsToStorage(threadStorageOwnerKey, threads);
  }, [authUser, isHydrated, threadStorageOwnerKey, threads]);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  useEffect(() => {
    const previous = messageUploadPreviewsRef.current;

    for (const [messageId, previews] of Object.entries(previous)) {
      if (!Object.prototype.hasOwnProperty.call(messageUploadPreviews, messageId)) {
        revokeUploadPreviews(previews);
      }
    }

    messageUploadPreviewsRef.current = messageUploadPreviews;
  }, [messageUploadPreviews]);

  useEffect(() => {
    return () => {
      for (const previews of Object.values(messageUploadPreviewsRef.current)) {
        revokeUploadPreviews(previews);
      }
    };
  }, []);

  useEffect(() => {
    const container = chatRef.current;
    if (!container || !stickToBottom) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "auto" });
  }, [messages, isSending, stickToBottom]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [input]);

  useEffect(() => {
    if (!authUser) {
      setUsage(null);
      return;
    }

    const records = readUsageStorage();
    const dateKey = getTodayKey();
    let record = records.find((item) => item.userId === authUser.id && item.dateKey === dateKey) || null;

    if (!record) {
      record = {
        dateKey,
        userId: authUser.id,
        messages: 0,
        images: 0,
        documents: 0
      };
      writeUsageStorage([record, ...records.filter((item) => !(item.userId === authUser.id && item.dateKey === dateKey))]);
    }

    setUsage(record);
  }, [authUser]);

  useEffect(() => {
    if (!isHydrated || !authUser) return;

    if (authUser.source !== "guest") {
      guestLandingResetRef.current = false;
      hydratedGuestThreadsHadMessagesRef.current = false;
      guestThreadActivityRef.current = false;
      return;
    }

    if (guestLandingResetRef.current) return;
    if (guestThreadActivityRef.current || !hydratedGuestThreadsHadMessagesRef.current) return;

    const hasAnyMessage = threadsRef.current.some((thread) => thread.messages.length > 0);
    if (!hasAnyMessage) return;

    const fresh = createThread();
    setThreads([fresh]);
    setActiveThreadId(fresh.id);
    hydratedGuestThreadsHadMessagesRef.current = false;
    guestThreadActivityRef.current = false;
    guestLandingResetRef.current = true;
  }, [authUser, isHydrated]);

  function markGuestThreadActivity() {
    guestThreadActivityRef.current = true;
  }

  function updateUsage(changes: Partial<UsageRecord>) {
    if (!authUser || !usage) return;

    const next: UsageRecord = {
      ...usage,
      ...changes,
      userId: usage.userId,
      dateKey: usage.dateKey
    };

    const existing = readUsageStorage();
    const filtered = existing.filter((item) => !(item.userId === next.userId && item.dateKey === next.dateKey));
    writeUsageStorage([next, ...filtered]);
    setUsage(next);
  }

  function updateActiveThread(updater: (thread: ChatThread) => ChatThread) {
    markGuestThreadActivity();
    startTransition(() => {
      setThreads((current) =>
        current.map((thread) => {
          if (thread.id !== activeThread?.id) return thread;
          return updater(thread);
        })
      );
    });
  }

  function handleChatScroll() {
    const container = chatRef.current;
    if (!container) return;
    const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
    setStickToBottom(remaining <= AUTO_SCROLL_THRESHOLD);
  }

  function scrollToBottom(smooth = false) {
    const container = chatRef.current;
    if (!container) return;
    setStickToBottom(true);
    container.scrollTo({ top: container.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }

  function handleNewChat() {
    const isGuest = !authUser || authUser.source === "guest";
    const hasMessages = activeThread && activeThread.messages.length > 0;

    if (isGuest && hasMessages) {
      setShowGuestNewChatModal(true);
      return;
    }

    confirmNewChat();
  }

  function confirmNewChat() {
    setShowGuestNewChatModal(false);
    const fresh = createThread();
    markGuestThreadActivity();
    startTransition(() => {
      setThreads((current) => [fresh, ...current]);
      setActiveThreadId(fresh.id);
    });
    setRequestError(null);
    setInput("");
    setPendingFiles([]);
    if (typeof window !== "undefined" && window.innerWidth <= 980) {
      setSidebarOpen(false);
    }
  }

  function handleSelectThread(threadId: string) {
    setActiveThreadId(threadId);
    if (typeof window !== "undefined" && window.innerWidth <= 980) {
      setSidebarOpen(false);
    }
  }

  function getThreadSnippet(thread: ChatThread) {
    const last = thread.messages[thread.messages.length - 1];
    if (!last?.content) return "Conversa pronta para continuar";
    return last.content.replace(/\s+/g, " ").slice(0, 80);
  }

  function addFilesFromInput(fileList: FileList | File[] | null) {
    const selectedFiles = fileList ? Array.from(fileList) : [];
    if (!selectedFiles.length) return;

    setPendingFiles((current) => {
      const next = [...current, ...selectedFiles].slice(0, MAX_INLINE_ATTACHMENTS);
      return next;
    });
    setRequestError(null);
  }

  function removePendingFile(index: number) {
    setPendingFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function focusComposer() {
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  function handleToggleStudyMode() {
    const fallbackTrack = activeBibleTrack || bibleLearningTracks[0] || null;

    if (fallbackTrack) {
      setStudyTrackId(fallbackTrack.id);
      setStudyProgress((current) => ensureTrackProgressEntry(current, fallbackTrack));
    }

    setStudyModeEnabled((current) => {
      const next = !current;
      if (next && fallbackTrack && selectedBibleStudyModules.length === 0) {
        setSelectedBibleStudyModules(normalizeStudyModuleIds(fallbackTrack.bibleStudyModules, bibleModuleIdSet));
      }
      return next;
    });
  }

  function handleSelectStudyTrack(trackId: string) {
    const track = bibleLearningTracks.find((item) => item.id === trackId);
    if (!track) {
      return;
    }

    setStudyModeEnabled(true);
    setStudyTrackId(track.id);
    setSelectedBibleStudyModules(normalizeStudyModuleIds(track.bibleStudyModules, bibleModuleIdSet));
    setPreferredBibleCode(String(track.preferredBibleCode || "NAA").trim() || "NAA");
    setStudyMinistryFocus(String(track.ministryFocus || "").trim());
    setStudyDepthPreference(normalizeStudyDepthPreference(track.depthPreference));
    setStudyProgress((current) => ensureTrackProgressEntry(current, track));
  }

  function handleSelectStudyStep(trackId: string, stepId: string) {
    const track = bibleLearningTracks.find((item) => item.id === trackId);
    const step = track?.steps.find((item) => item.id === stepId);
    if (!track || !step) {
      return;
    }

    setStudyModeEnabled(true);
    setStudyTrackId(track.id);
    setSelectedBibleStudyModules(
      normalizeStudyModuleIds([...track.bibleStudyModules, ...step.moduleIds], bibleModuleIdSet)
    );
    setStudyProgress((current) => {
      const nextState = ensureTrackProgressEntry(current, track);
      return {
        ...nextState,
        [track.id]: {
          ...nextState[track.id],
          currentStepId: step.id,
          updatedAt: new Date().toISOString()
        }
      };
    });
  }

  function handleToggleStudyStepDone(trackId: string, stepId: string) {
    const track = bibleLearningTracks.find((item) => item.id === trackId);
    if (!track) {
      return;
    }

    const alreadyDone = Boolean(studyProgress[track.id]?.completedStepIds?.includes(stepId));

    setStudyModeEnabled(true);
    setStudyTrackId(track.id);
    setStudyProgress((current) => {
      const nextState = ensureTrackProgressEntry(current, track);
      const existingEntry = nextState[track.id] || {
        completedStepIds: [],
        currentStepId: track.steps[0]?.id || null,
        updatedAt: null
      };
      const completed = new Set(existingEntry.completedStepIds);
      const alreadyDone = completed.has(stepId);

      if (alreadyDone) {
        completed.delete(stepId);
      } else {
        completed.add(stepId);
      }

      const orderedCompletedIds = track.steps
        .map((step) => step.id)
        .filter((id) => completed.has(id));
      const nextCurrentStepId = alreadyDone
        ? stepId
        : track.steps.find((step) => !completed.has(step.id))?.id || stepId;

      return {
        ...nextState,
        [track.id]: {
          completedStepIds: orderedCompletedIds,
          currentStepId: nextCurrentStepId,
          updatedAt: new Date().toISOString()
        }
      };
    });

    if (!alreadyDone) {
      setStudyCelebrationActive(true);
    }
  }

  function handleToggleStudyModule(moduleId: string) {
    if (!bibleModuleIdSet.has(moduleId)) {
      return;
    }

    if (activeBibleTrack) {
      setStudyTrackId(activeBibleTrack.id);
      setStudyProgress((current) => ensureTrackProgressEntry(current, activeBibleTrack));
    }

    setStudyModeEnabled(true);
    setSelectedBibleStudyModules((current) => {
      const next = current.includes(moduleId)
        ? current.filter((id) => id !== moduleId)
        : [...current, moduleId];

      return normalizeStudyModuleIds(next, bibleModuleIdSet);
    });
  }

  function handlePreferredBibleCodeChange(value: string) {
    setStudyModeEnabled(true);
    setPreferredBibleCode(String(value || "NAA").trim() || "NAA");
  }

  function handleStudyMinistryFocusChange(value: string) {
    setStudyModeEnabled(true);
    setStudyMinistryFocus(String(value || "").trim());
  }

  function handleStudyDepthPreferenceChange(value: string) {
    setStudyModeEnabled(true);
    setStudyDepthPreference(normalizeStudyDepthPreference(value));
  }

  function handleApplyStudyStarter(prompt: string) {
    setStudyModeEnabled(true);
    setRequestError(null);
    setInput(String(prompt || "").trim());
    focusComposer();
  }

  async function uploadFile(file: File): Promise<GIOMUploadAsset> {
    const maxBytes = config?.uploads?.maxBytes || 2_000_000;
    if (file.size > maxBytes) {
      throw new Error(`O anexo excede ${(maxBytes / 1024 / 1024).toFixed(1)} MB.`);
    }

    const payload = await requestJsonWithFailover(
      "/upload",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": authUser?.id || getScopeId()
        },
        body: JSON.stringify({
          name: file.name,
          type: file.type || "application/octet-stream",
          data: await readFileAsBase64(file)
        })
      },
      25_000
    );

    return payload as unknown as GIOMUploadAsset;
  }

  async function requestAssistantResponseStandard(question: string, context: GIOMAskContext, sessionId: string | null): Promise<AssistantResponseResult> {
    const safeContext = sanitizeContextForApi(context);

    const runAsk = async (contextPayload: GIOMAskContext | Record<string, unknown>, retryAttempt = 1) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-User-Id": authUser?.id || getScopeId()
      };

      if (sessionId) {
        headers["X-Session-Id"] = sessionId;
      }

      return parseAskResponsePayload(await requestJsonWithFailover(
        "/ask",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            question,
            sessionId,
            context: {
              ...contextPayload,
              clientRetryAttempt: retryAttempt
            }
          })
        },
        60_000
      ));
    };

    let payload: Record<string, unknown>;
    try {
      payload = await runAsk(safeContext);
    } catch (error) {
      const status = Number((error as { status?: number })?.status || 0);
      const hasContext = Object.keys(safeContext).length > 0;
      if (status >= 500 && hasContext) {
        payload = await runAsk({ channel: "web-next", migrationStage: 4 });
      } else {
        throw error;
      }
    }

    if (shouldRetryGenericFallbackPayload(payload as Record<string, unknown>)) {
      payload = await runAsk({
        ...safeContext,
        retryingAfterGenericFallback: true
      }, 2);
    }

    return {
      answer: extractAnswer(payload as Record<string, unknown>) || "Resposta vazia do servidor.",
      metadata: extractAssistantResponseMetadata(payload as Record<string, unknown>)
    };
  }

  async function requestAssistantResponseStream(
    question: string,
    context: GIOMAskContext,
    sessionId: string | null,
    onProgress: (partial: string) => void
  ): Promise<AssistantResponseResult> {
    const streamReadTimeoutMs = 20_000;
    const streamFirstAnswerTimeoutMs = 18_000;
    const streamStallTimeoutMs = 18_000;
    const safeContext = sanitizeContextForApi(context);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-User-Id": authUser?.id || getScopeId()
    };

    if (sessionId) {
      headers["X-Session-Id"] = sessionId;
    }

    const response = await requestStreamWithFailover(
      "/ask/stream",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ question, sessionId, context: safeContext })
      },
      65_000
    );

    if (!response.body) {
      throw new Error("Streaming indisponivel no momento.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalAnswer = "";
    let completionMetadata: AssistantResponseMetadata | null = null;
    const streamStartedAt = Date.now();
    let lastProgressAt = streamStartedAt;
    let receivedAnswer = false;

    const readNextChunk = async () => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      try {
        return await Promise.race([
          reader.read(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              reject(new Error("Streaming sem atividade por muito tempo."));
            }, streamReadTimeoutMs);
          })
        ]);
      } finally {
        if (timer != null) {
          clearTimeout(timer);
        }
      }
    };

    const assertStreamProgress = () => {
      const now = Date.now();
      if (!receivedAnswer && now - streamStartedAt > streamFirstAnswerTimeoutMs) {
        throw new Error("Streaming demorou demais para iniciar a resposta.");
      }

      if (receivedAnswer && now - lastProgressAt > streamStallTimeoutMs) {
        throw new Error("Streaming ficou sem progresso por muito tempo.");
      }
    };

    const processPacket = (packet: string) => {
      const parsed = parseSSEPacket(packet);
      if (!parsed) return "continue" as const;

      if (parsed.event === "chunk") {
        const data = parsed.data as { fullText?: string; chunk?: string };
        finalAnswer = data.fullText || `${finalAnswer}${data.chunk || ""}`;
        receivedAnswer = true;
        lastProgressAt = Date.now();
        onProgress(finalAnswer);
        return "continue" as const;
      }

      if (parsed.event === "complete") {
        const data = parsed.data as { response?: string; metadata?: Record<string, unknown> };
        finalAnswer = data.response || finalAnswer;
        completionMetadata = extractAssistantResponseMetadata({ data });
        receivedAnswer = true;
        lastProgressAt = Date.now();

        if (Boolean(data.metadata?.fallback) && isGenericAssistantFallback(finalAnswer)) {
          return "fallback" as const;
        }

        onProgress(finalAnswer);
        return "complete" as const;
      }

      if (parsed.event === "error") {
        const data = parsed.data as { error?: string };
        throw new Error(data.error || "Falha no streaming.");
      }

      return "continue" as const;
    };

    while (true) {
      const { done, value } = await readNextChunk();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const packets = buffer.split("\n\n");
      buffer = packets.pop() || "";

      for (const packet of packets) {
        const outcome = processPacket(packet);
        if (outcome === "fallback") {
          return requestAssistantResponseStandard(question, context, sessionId);
        }
        if (outcome === "complete") {
          return {
            answer: finalAnswer,
            metadata: completionMetadata
          };
        }
      }

      assertStreamProgress();
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      const trailingPackets = buffer.split("\n\n").map((packet) => packet.trim()).filter(Boolean);
      for (const packet of trailingPackets) {
        const outcome = processPacket(packet);
        if (outcome === "fallback") {
          return requestAssistantResponseStandard(question, context, sessionId);
        }
        if (outcome === "complete") {
          return {
            answer: finalAnswer,
            metadata: completionMetadata
          };
        }
      }
    }

    assertStreamProgress();

    if (!finalAnswer) {
      throw new Error("Streaming encerrado sem resposta.");
    }

    return {
      answer: finalAnswer,
      metadata: completionMetadata
    };
  }

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    if (authLoading) return;

    const email = normalizeEmail(authEmail);
    const password = authPassword.trim();
    const displayName = authName.trim();

    if (!email) {
      setAuthError("Informe seu email para continuar.");
      return;
    }

    if (authStep === "email") {
      setAuthStep("details");
      setAuthError(null);
      setAuthNotice(null);
      return;
    }

    if (!authSupportsMagicLink) {
      if (!password) {
        setAuthError("Informe sua senha para continuar.");
        return;
      }

      if (password.length < 6) {
        setAuthError("A senha precisa ter pelo menos 6 caracteres.");
        return;
      }
    }

    setAuthLoading(true);
    setAuthError(null);
    setAuthNotice(null);

    const supabase = supabaseRef.current;
    try {
      if (supabase) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: authMode === "sign-up",
            emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
            data: {
              full_name: displayName || email
            }
          }
        });

        if (error) throw error;
        setAuthNotice(
          authMode === "sign-up"
            ? "Enviamos um link ou codigo de acesso para concluir a criacao da conta."
            : "Enviamos um link ou codigo de acesso para entrar."
        );
        setAuthPassword("");
      } else {
        const accounts = readLocalAccounts();

        if (authMode === "sign-up") {
          if (accounts.some((account) => account.email === email)) {
            throw new Error("Ja existe uma conta com esse email.");
          }

          const created: LocalAuthAccount = {
            id: makeId("local-user"),
            email,
            fullName: displayName || email,
            password
          };
          const nextAccounts = [created, ...accounts];
          writeLocalAccounts(nextAccounts);

          const identity: AuthIdentity = {
            id: created.id,
            email: created.email,
            fullName: created.fullName,
            plan: "Free",
            source: "local"
          };
          writeLocalSession(identity);
          setAuthUser(identity);
          setAuthPassword("");
          setShowAuthScreen(false);
        } else {
          const account = accounts.find((item) => item.email === email && item.password === password);
          if (!account) {
            throw new Error("Credenciais invalidas para modo local.");
          }

          const identity: AuthIdentity = {
            id: account.id,
            email: account.email,
            fullName: account.fullName,
            plan: "Free",
            source: "local"
          };
          writeLocalSession(identity);
          setAuthUser(identity);
          setAuthPassword("");
          setShowAuthScreen(false);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha de autenticacao.";
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleOAuth(provider: Provider) {
    if (oauthLoading) return;
    const supabase = supabaseRef.current;
    if (!supabase) {
      setAuthError("OAuth exige Supabase ativo no backend.");
      return;
    }

    setAuthError(null);
    setOauthLoading(provider);
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo
      }
    });

    if (error) {
      setAuthError(error.message || "Falha ao iniciar login social.");
      setOauthLoading(null);
      return;
    }
  }

  function continueAsGuest() {
    setAuthUser(createGuestIdentity());
    setShowAuthScreen(false);
  }

  async function handleLogout() {
    setAuthError(null);
    setShowProfile(false);
    const supabase = supabaseRef.current;

    if (supabase) {
      await supabase.auth.signOut();
      setAuthUser(createGuestIdentity());
      return;
    }

    if (authUser?.source !== "guest") {
      writeLocalSession(null);
    }

    setAuthUser(createGuestIdentity());
    setShowAuthScreen(false);
  }

  function handleHeaderAuthAction(mode: AuthMode) {
    if (typeof window !== "undefined") {
      window.location.assign(`/login?mode=${mode}&next=${encodeURIComponent("/chat")}`);
      return;
    }

    setAuthMode(mode);
    setAuthError(null);
    setAuthNotice(null);
    setAuthStep("email");
    if (mode === "sign-in") {
      setAuthPassword("");
    }
    setShowAuthScreen(true);
  }

  // Gate: anonymous users on /chat/bible get redirected to login
  useEffect(() => {
    if (!isHydrated || !authReady || surface !== "study" || typeof window === "undefined") {
      return;
    }

    if (!authUser || authUser.source === "guest") {
      window.location.replace(`/login?mode=sign-in&next=${encodeURIComponent("/chat/bible")}`);
    }
  }, [authReady, authUser, isHydrated, surface]);

  async function copyMessageContent(content: string) {
    if (typeof window === "undefined" || typeof document === "undefined") return false;

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(content);
        return true;
      } catch {
        // Fallback below handles browsers where the async clipboard API is blocked.
      }
    }

    try {
      const textarea = document.createElement("textarea");
      textarea.value = content;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.style.pointerEvents = "none";
      textarea.style.inset = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  }

  function editPrompt(value: string) {
    setInput(value);
    focusComposer();
  }

  function handleDeleteThread(threadId: string) {
    markGuestThreadActivity();
    startTransition(() => {
      setThreads((current) => {
        const filtered = current.filter((thread) => thread.id !== threadId);
        if (!filtered.length) {
          const fresh = createThread();
          setActiveThreadId(fresh.id);
          return [fresh];
        }

        if (threadId === activeThreadId) {
          setActiveThreadId(filtered[0].id);
        }

        return filtered;
      });
    });
  }

  const stopServerSideVoiceCapture = useCallback(async (options?: { autoSubmit?: boolean; reason?: string }) => {
    if (voiceCaptureModeRef.current !== "server" || voiceCaptureFinishingRef.current) {
      return;
    }

    voiceCaptureFinishingRef.current = true;
    const autoSubmit = options?.autoSubmit !== false;
    const reason = options?.reason || "manual_stop";
    const inlineComposerCapture = inlineVoiceComposerActiveRef.current;
    const sessionId = voiceSessionRef.current?.sessionId || null;
    const recorder = voiceRecorderRef.current;
    releaseVoiceRecorder("detach");

    try {
      setMicListening(false);
      setVoiceInterimTranscript("");

      const capture = await recorder?.stop();
      releaseVoiceCaptureResources();
      voiceCaptureModeRef.current = "idle";

      if (sessionId) {
        void pushVoiceEvent(sessionId, "session.listening_stopped", {
          autoSubmitted: autoSubmit,
          reason
        });
      }

      if (!capture) {
        if (inlineComposerCapture) {
          syncInlineVoiceComposerMode(false);
        }
        voiceShouldAutoSubmitRef.current = false;
        voiceCapturedSinceStartRef.current = false;
        setVoiceStatus("idle");
        return;
      }

      const normalized = await normalizeRealtimeCapturedAudio(sessionId, capture);
      if (!normalized) {
        if (inlineComposerCapture) {
          syncInlineVoiceComposerMode(false);
        }
        voiceShouldAutoSubmitRef.current = false;
        voiceCapturedSinceStartRef.current = false;
        setVoiceStatus("idle");
        return;
      }

      voiceCapturedSinceStartRef.current = true;
      await appendVoiceTranscript(sessionId, normalized);
      voiceShouldAutoSubmitRef.current = false;

      if (autoSubmit) {
        setVoiceStatus("processing");
        requestAnimationFrame(() => {
          void submitMessageRef.current?.();
        });
        return;
      }

      if (inlineComposerCapture) {
        syncInlineVoiceComposerMode(false);
      }
      setVoiceStatus("idle");
    } catch (error) {
      releaseVoiceCaptureResources();
      voiceCaptureModeRef.current = "idle";
      if (inlineComposerCapture) {
        syncInlineVoiceComposerMode(false);
      }
      voiceShouldAutoSubmitRef.current = false;
      voiceCapturedSinceStartRef.current = false;
      setVoiceStatus("idle");
      throw error;
    } finally {
      voiceCaptureFinishingRef.current = false;
    }
  }, [appendVoiceTranscript, normalizeRealtimeCapturedAudio, pushVoiceEvent, releaseVoiceCaptureResources, releaseVoiceRecorder, syncInlineVoiceComposerMode]);

  const startServerSideVoiceCapture = useCallback(async (options?: { autoSubmit?: boolean }) => {
    if (!isBrowserWavRecorderSupported()) {
      throw new Error("Captura de audio local indisponivel neste navegador/dispositivo.");
    }

    const autoSubmit = options?.autoSubmit !== false;
    stopPlayback("idle");
    setRequestError(null);
    setVoiceStatus("connecting");
    setVoiceInterimTranscript("");
    setVoiceInputLevel(0);
    voiceCapturedSinceStartRef.current = false;
    voiceShouldAutoSubmitRef.current = autoSubmit;
    voiceCaptureFinishingRef.current = false;

    const session = await ensureVoiceSession().catch(() => null);
    const sessionId = session?.sessionId || null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      captureStreamRef.current = stream;
      voiceRecorderRef.current = await createWavAudioRecorder(stream, {
        targetSampleRate: session?.vad?.sampleRate || 16_000,
        channelCount: 1
      });
      voiceCaptureModeRef.current = "server";
      setMicListening(true);

      try {
        silenceDetectorRef.current = await createSilenceDetector(stream, {
          threshold: session?.vad?.threshold || 0.045,
          silenceMs: session?.vad?.silenceMs || 1400,
          onLevel: (level) => {
            setVoiceInputLevel(toVoiceLevelBucket(level));
          },
          onSpeechStart: () => {
            setVoiceStatus("listening");
            if (sessionId) {
              void pushVoiceEvent(sessionId, "vad.speech_started", {
                threshold: session?.vad?.threshold || 0.045,
                mode: "server"
              }, {
                final: false
              });
            }
          },
          onSpeechEnd: () => {
            if (sessionId) {
              void pushVoiceEvent(sessionId, "vad.speech_ended", {
                silenceMs: session?.vad?.silenceMs || 1400,
                mode: "server"
              });
            }

            void stopServerSideVoiceCapture({
              autoSubmit: voiceShouldAutoSubmitRef.current,
              reason: "vad_silence"
            }).catch((error) => {
              setRequestError(
                error instanceof Error
                  ? error.message
                  : "Nao foi possivel processar o audio capturado no servidor."
              );
            });
          }
        });
      } catch {
        if (sessionId) {
          void pushVoiceEvent(sessionId, "vad.unavailable", {
            reason: "server_capture_vad_unavailable"
          });
        }
      }

      if (sessionId) {
        void pushVoiceEvent(sessionId, "session.listening_started", {
          microphone: true,
          vad: true,
          mode: "server"
        });
      }

      setVoiceStatus("listening");
    } catch (error) {
      voiceCaptureModeRef.current = "idle";
      setMicListening(false);
      releaseVoiceRecorder();
      releaseVoiceCaptureResources();
      throw error;
    }
  }, [ensureVoiceSession, pushVoiceEvent, releaseVoiceCaptureResources, releaseVoiceRecorder, stopPlayback, stopServerSideVoiceCapture]);

  const startBrowserRecognitionCapture = useCallback(async (options?: { autoSubmit?: boolean }) => {
    const recognition = speechRecognitionRef.current;
    if (!recognition) {
      throw new Error("Microfone nao suportado neste navegador/dispositivo.");
    }

    const autoSubmit = options?.autoSubmit !== false;
    voiceCaptureModeRef.current = "browser";
    stopPlayback("idle");
    setRequestError(null);
    setVoiceStatus("connecting");
    setVoiceInputLevel(0);
    voiceShouldAutoSubmitRef.current = autoSubmit;
    voiceCapturedSinceStartRef.current = false;

    const session = await ensureVoiceSession().catch(() => null);
    const sessionId = session?.sessionId || null;

    if (isBrowserAudioCaptureSupported()) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        captureStreamRef.current = stream;
        silenceDetectorRef.current = await createSilenceDetector(stream, {
          threshold: session?.vad?.threshold || 0.045,
          silenceMs: session?.vad?.silenceMs || 1400,
          onLevel: (level) => {
            setVoiceInputLevel(toVoiceLevelBucket(level));
          },
          onSpeechStart: () => {
            setVoiceStatus("listening");
            if (sessionId) {
              void pushVoiceEvent(sessionId, "vad.speech_started", {
                threshold: session?.vad?.threshold || 0.045
              }, {
                final: false
              });
            }
          },
          onSpeechEnd: () => {
            if (sessionId) {
              void pushVoiceEvent(sessionId, "vad.speech_ended", {
                silenceMs: session?.vad?.silenceMs || 1400
              });
            }
            try {
              recognition.stop();
            } catch {
              // noop
            }
          }
        });
      } catch {
        if (sessionId) {
          void pushVoiceEvent(sessionId, "vad.unavailable", {
            reason: "microphone_access_denied_or_unavailable"
          });
        }
      }
    }

    try {
      recognition.start();
    } catch (error) {
      voiceCaptureModeRef.current = "idle";
      releaseVoiceCaptureResources();
      throw error;
    }
  }, [ensureVoiceSession, pushVoiceEvent, releaseVoiceCaptureResources, stopPlayback]);

  async function startRealtimeVoiceCapture(options?: { autoSubmit?: boolean }) {
    const autoSubmit = options?.autoSubmit !== false;
    const shouldPreferServerCapture = Boolean(config?.features?.serverAudioTranscriptions) && isBrowserWavRecorderSupported();
    if (shouldPreferServerCapture) {
      try {
        await startServerSideVoiceCapture({ autoSubmit });
        return;
      } catch (error) {
        if (!speechRecognitionRef.current) {
          throw error;
        }

        console.warn("Captura server-side falhou, caindo para SpeechRecognition do navegador.", error);
      }
    }

    if (!speechRecognitionRef.current) {
      throw new Error("Microfone nao suportado neste navegador/dispositivo.");
    }

    await startBrowserRecognitionCapture({ autoSubmit });
  }

  function armVoiceInterruptMonitor(sessionId: string | null) {
    if (typeof window === "undefined" || !bargeInEnabled || !voiceConversationModeRef.current || !isBrowserAudioCaptureSupported()) {
      return;
    }

    releaseVoiceInterruptMonitor();

    voiceInterruptArmTimerRef.current = window.setTimeout(() => {
      voiceInterruptArmTimerRef.current = null;

      if (!voiceConversationModeRef.current || !speechPlaybackRef.current || voiceCaptureModeRef.current !== "idle") {
        return;
      }

      navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      }).then(async (stream) => {
        if (!voiceConversationModeRef.current || !speechPlaybackRef.current || voiceCaptureModeRef.current !== "idle") {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        voiceInterruptStreamRef.current = stream;
        try {
          voiceInterruptDetectorRef.current = await createSilenceDetector(stream, {
            threshold: Math.min(0.16, Math.max(0.075, Number(voiceSessionRef.current?.vad?.threshold || 0.045) + 0.035)),
            silenceMs: 520,
            minSpeechMs: 180,
            onSpeechStart: () => {
              if (!voiceConversationModeRef.current || !speechPlaybackRef.current || voiceCaptureModeRef.current !== "idle") {
                return;
              }

              voiceBargeInPendingRef.current = true;
              setRequestError(null);
              releaseVoiceInterruptMonitor();

              if (sessionId) {
                void pushVoiceEvent(sessionId, "speech.barge_in", {
                  mode: "voice_conversation",
                  persona: selectedVoicePersona
                }, {
                  final: false
                });
              }

              stopPlayback("listening");
              setVoiceStatus("listening");

              void startRealtimeVoiceCapture({ autoSubmit: true })
                .catch((error) => {
                  setVoiceStatus("idle");
                  setRequestError(
                    error instanceof Error
                      ? error.message
                      : "Nao foi possivel retomar a escuta por voz."
                  );
                })
                .finally(() => {
                  voiceBargeInPendingRef.current = false;
                });
            }
          });
        } catch {
          stream.getTracks().forEach((track) => track.stop());
          voiceInterruptStreamRef.current = null;
        }
      }).catch(() => undefined);
    }, 820);
  }

  async function speakAssistantReply(text: string, preloadedManifest?: RealtimeSpeechManifest | null) {
    if (!voiceConversationModeRef.current || voiceConversationPausedRef.current || !speakerEnabled || !speakerSupported) {
      return;
    }

    const safeText = buildSpeechSafeText(text);
    if (!safeText) {
      return;
    }

    let sessionId: string | null = null;
  let outputMonitorCancelled = false;
    try {
      const session = await ensureVoiceSession().catch(() => null);
      sessionId = session?.sessionId || null;
      const manifest = preloadedManifest || await requestSpeechManifest(sessionId, safeText).catch(() => null);
      stopPlayback("idle");
      setVoiceInputLevel(0);
      setVoiceOutputLevel(0);
      setVoiceStatus("speaking");

      if (sessionId) {
        void pushVoiceEvent(sessionId, "speech.playback_started", {
          textLength: safeText.length
        }, {
          text: safeText
        });
      }

      const browserFallback = (): PlaybackController => ({
        ...speakWithBrowser({
          text: manifest?.text || safeText,
          language: manifest?.language || activePersonaSpeech.language,
          voiceName: resolvePlaybackVoiceName(manifest?.voice, activePersonaSpeech.voiceName, activeServerVoice),
          rate: manifest?.rate || activePersonaSpeech.rate,
          pitch: manifest?.pitch || activePersonaSpeech.pitch
        }),
        sourceKind: "browser"
      });

      let controller = playServerAudio(manifest) || browserFallback();
      speechPlaybackRef.current = controller;

      if (controller.sourceKind === "server" && controller.audioElement) {
        const audioElement = controller.audioElement;
        const audioElementWithCapture = audioElement as HTMLAudioElement & {
          captureStream?: () => MediaStream;
        };
        const captureStream = typeof audioElementWithCapture.captureStream === "function"
          ? audioElementWithCapture.captureStream()
          : null;

        if (captureStream) {
          createAudioLevelMonitor(captureStream, {
            onLevel: (level) => {
              setVoiceOutputLevel(toVoiceLevelBucket(level));
            }
          }).then((monitor) => {
            if (outputMonitorCancelled) {
              monitor.stop();
              return;
            }

            voiceOutputMonitorRef.current = monitor;
          }).catch(() => {
            if (!outputMonitorCancelled) {
              startSyntheticVoiceOutputMonitor();
            }
          });
        } else {
          startSyntheticVoiceOutputMonitor();
        }
      } else {
        startSyntheticVoiceOutputMonitor();
      }

      if (voiceConversationModeRef.current) {
        armVoiceInterruptMonitor(sessionId);
      }

      try {
        await controller.promise;
      } catch (error) {
        if (!resolveServerAudioSource(manifest)) {
          throw error;
        }

        controller = browserFallback();
        speechPlaybackRef.current = controller;
        startSyntheticVoiceOutputMonitor();
        await controller.promise;
      }

      if (sessionId) {
        void pushVoiceEvent(sessionId, "speech.playback_completed", {
          textLength: safeText.length
        }, {
          text: safeText
        });
      }
    } catch (error) {
      console.warn("Nao foi possivel reproduzir a resposta em voz alta.", error);
      if (sessionId) {
        void pushVoiceEvent(sessionId, "speech.playback_failed", {
          error: error instanceof Error ? error.message : "speech_playback_failed"
        });
      }
    } finally {
      outputMonitorCancelled = true;
      releaseVoiceInterruptMonitor();
      releaseVoiceOutputMonitor();
      speechPlaybackRef.current = null;
      setVoiceStatus((current) => {
        if (current !== "speaking") {
          return current;
        }

        return voiceConversationPausedRef.current ? "paused" : "idle";
      });

      if (voiceConversationModeRef.current && !voiceConversationPausedRef.current) {
        queueVoiceConversationResume(420);
      }
    }
  }

  async function submitMessage(event?: FormEvent) {
    event?.preventDefault();
    if (isSending || !activeThread || !authUser) return;

    const typedQuestion = input.trim();
    const submittedFiles = pendingFiles.slice();
    const hasPendingUploads = submittedFiles.length > 0;
    if (!typedQuestion && !hasPendingUploads) return;

    const question = typedQuestion || (
      submittedFiles.length === 1
        ? `Analise o arquivo enviado "${submittedFiles[0].name}" e responda com base somente nele.`
        : `Analise os ${submittedFiles.length} arquivos enviados e responda com base somente neles.`
    );
    const userFacingQuestion = typedQuestion || (
      submittedFiles.length === 1
        ? `Analisar arquivo: ${submittedFiles[0].name}`
        : `Analisar ${submittedFiles.length} arquivos enviados`
    );

    const toolIntent = detectToolIntent(question, availableDocFormats);
    const responsePresentation = detectResponsePresentation(question);
    const sessionId = activeThread.id;
    const realtimeVoiceSessionId = voiceSessionRef.current?.sessionId || null;
    const conversationHistory = buildConversationHistory(activeThread.messages);

    if (toolIntent) {
      if (!canUseTools) {
        setRequestError("Geracao de imagem/documento exige ferramentas ativas no ambiente atual.");
        return;
      }
    }

    if (Number.isFinite(messagesRemaining) && messagesRemaining <= 0) {
      setRequestError("Voce atingiu o limite diario de mensagens do plano atual.");
      return;
    }

    if (submittedFiles.length && !canUseUploads) {
      setRequestError("Upload esta liberado somente apos login completo.");
      return;
    }

    setRequestError(null);
    setInput("");
    setPendingFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setIsSending(true);
    setStickToBottom(true);

    const userMessage: ChatMessage = {
      id: makeId("user"),
      role: "user",
      content: userFacingQuestion,
      uploadName: submittedFiles.length ? submittedFiles.map((file) => file.name).join(", ") : null,
      uploadNames: submittedFiles.length ? submittedFiles.map((file) => file.name) : [],
      createdAt: new Date().toISOString()
    };
    const pendingId = makeId("pending");
    const pendingMessage: ChatMessage = {
      id: pendingId,
      role: "assistant",
      content: "",
      pending: true,
      artifactPrompt: toolIntent?.prompt || null,
      requestQuestion: question,
      requestedResponseCard: responsePresentation?.card || "text",
      requestedResponseVariant: responsePresentation?.variant || null,
      createdAt: new Date().toISOString()
    };

    updateActiveThread((thread) => ({
      ...thread,
      title: thread.messages.length <= 1 ? userFacingQuestion.slice(0, 42) || thread.title : thread.title,
      updatedAt: new Date().toISOString(),
      messages: [...thread.messages, userMessage, pendingMessage]
    }));

    if (submittedFiles.length) {
      void buildUploadPreviews(submittedFiles)
        .then((previews) => {
          setMessageUploadPreviews((current) => ({
            ...current,
            [userMessage.id]: previews
          }));
        })
        .catch(() => {
          setMessageUploadPreviews((current) => ({
            ...current,
            [userMessage.id]: []
          }));
        });
    }

    try {
      const uploads = submittedFiles.length
        ? await Promise.all(submittedFiles.map(async (file) => await uploadFile(file)))
        : [];
      const upload = uploads[0] || null;
      const requestedForecastDays = inferWeatherForecastDays(question);
      let resolvedWeatherLocation: WeatherLocationContext | null = weatherLocation
        ? {
            ...weatherLocation,
            forecastDays: requestedForecastDays
          }
        : null;
      let instructionSuffix = "";

      if (responsePresentation?.variant === "weather" && !resolvedWeatherLocation) {
        try {
          resolvedWeatherLocation = await requestWeatherLocationFromBrowser(requestedForecastDays);
          setWeatherLocation(resolvedWeatherLocation);
          writeStoredWeatherLocation(resolvedWeatherLocation);
        } catch {
          instructionSuffix = " Sem localizacao valida, nao diga que voce nao tem acesso ao clima. Peca a cidade do usuario ou oriente ativar localizacao em uma frase curta.";
        }
      }

      const studyInstruction = studyModeEnabled
        ? buildBibleStudyInstruction(
            activeBibleTrack,
            activeBibleProgress?.currentStepId,
            bibleModuleCatalog,
            selectedBibleStudyModules,
            studyDepthPreference
          )
        : "";
      const resolvedInstructions = [
        responsePresentation?.instructions || "Responda em texto limpo, sem markdown visual desnecessario.",
        instructionSuffix.trim(),
        studyInstruction
      ].filter(Boolean).join(" ");

      const context: GIOMAskContext = {
        channel: "web-next",
        migrationStage: 4,
        uploadId: upload?.id || null,
        uploadIds: uploads.map((item) => item.id),
        uploadName: upload?.name || null,
        uploadNames: uploads.map((item) => item.name),
        uploadType: upload?.type || null,
        plan: authUser.plan,
        source: authUser.source,
        assistantProfile: studyModeEnabled ? activeBibleTrack?.assistantProfile : undefined,
        activeModules: studyModeEnabled ? activeBibleTrack?.activeModules || [] : undefined,
        bibleStudyModules: studyModeEnabled ? selectedBibleStudyModules : undefined,
        promptPacks: studyModeEnabled ? activeBibleTrack?.promptPacks || [] : undefined,
        preferredBibleCode: studyModeEnabled ? preferredBibleCode : undefined,
        ministryFocus: studyModeEnabled ? (studyMinistryFocus || undefined) : undefined,
        depthPreference: studyModeEnabled ? studyDepthPreference : undefined,
        preferredResponseCard: responsePresentation?.card || "text",
        preferredResponseVariant: responsePresentation?.variant || undefined,
        instructions: resolvedInstructions,
        conversationHistory,
        weatherLocation: resolvedWeatherLocation
          ? {
              label: resolvedWeatherLocation.label || "Local atual",
              latitude: resolvedWeatherLocation.latitude,
              longitude: resolvedWeatherLocation.longitude,
              forecastDays: resolvedWeatherLocation.forecastDays || 3,
              timezone: resolvedWeatherLocation.timezone || "auto",
              source: resolvedWeatherLocation.source || "browser_geolocation",
              accuracyMeters: resolvedWeatherLocation.accuracyMeters ?? null,
              capturedAt: resolvedWeatherLocation.capturedAt || null
            }
          : null
      };

      const applyPartial = (partial: string, pending = true) => {
        updateActiveThread((thread) => ({
          ...thread,
          updatedAt: new Date().toISOString(),
          messages: thread.messages.map((item) =>
            item.id === pendingId ? { ...item, content: partial, pending } : item
          )
        }));
      };

      const requestFallbackAssistantAnswer = async (): Promise<AssistantResponseResult> => {
        if (config?.features?.streaming !== false) {
          try {
            return await requestAssistantResponseStream(question, context, sessionId, (partial) => {
              applyPartial(partial, true);
            });
          } catch (streamError) {
            console.warn("Streaming falhou, caindo para resposta padrao.", streamError);
            return await requestAssistantResponseStandard(question, context, sessionId);
          }
        }

        return await requestAssistantResponseStandard(question, context, sessionId);
      };

      let assistantResult: AssistantResponseResult = {
        answer: "",
        metadata: null
      };
      let voiceSpeechManifest: RealtimeSpeechManifest | null = null;
      let usedRealtimeVoiceResponse = false;
      if (toolIntent) {
        const artifact = await generateToolArtifact(toolIntent.mode, toolIntent.prompt, toolIntent.format);
        updateActiveThread((thread) => ({
          ...thread,
          updatedAt: new Date().toISOString(),
          messages: thread.messages.map((item) =>
            item.id === pendingId
              ? {
                  ...item,
                  content: artifact.mode === "image"
                    ? "Imagem pronta. Ajuste o prompt pelo icone de editar se quiser refinar o resultado."
                    : "Documento pronto para download.",
                  pending: false,
                  generatedImage: artifact.generatedImage || null,
                  generatedDocument: artifact.generatedDocument || null,
                  artifactPrompt: toolIntent.prompt
                }
              : item
          )
        }));
        setVoiceStatus("idle");
        setIsSending(false);
        return;
      }

      const shouldUseRealtimeVoiceResponse = Boolean(realtimeVoiceSessionId) && voiceStatus === "processing" && !hasPendingUploads;
      if (shouldUseRealtimeVoiceResponse && realtimeVoiceSessionId) {
        try {
          const realtimeResponse = await requestAssistantResponseRealtime(question, context, realtimeVoiceSessionId);
          assistantResult = {
            answer: realtimeResponse.answer,
            metadata: realtimeResponse.metadata
          };
          voiceSpeechManifest = realtimeResponse.speech;
          usedRealtimeVoiceResponse = true;
        } catch (realtimeVoiceError) {
          console.warn("Resposta realtime de voz falhou, caindo para /ask.", realtimeVoiceError);
          assistantResult = await requestFallbackAssistantAnswer();
        }
      } else {
        assistantResult = await requestFallbackAssistantAnswer();
      }

      const answer = coerceAssistantReply(question, assistantResult.answer, responsePresentation);

      updateActiveThread((thread) => ({
        ...thread,
        updatedAt: new Date().toISOString(),
        messages: thread.messages.map((item) =>
          item.id === pendingId
            ? {
                ...item,
                content: answer,
                pending: false,
                ...assistantResult.metadata
              }
            : item
        )
      }));

      if (!usedRealtimeVoiceResponse && voiceSessionRef.current?.sessionId) {
        void pushVoiceEvent(voiceSessionRef.current.sessionId, "assistant.response_completed", {
          textLength: answer.length
        }, {
          text: answer
        });
      }

      if (voiceConversationModeRef.current && speakerEnabled && speakerSupported && !voiceConversationPausedRef.current) {
        void speakAssistantReply(answer, voiceSpeechManifest);
      } else if (voiceStatus === "processing") {
        setVoiceStatus(voiceConversationPausedRef.current ? "paused" : "idle");
        if (voiceConversationModeRef.current && !voiceConversationPausedRef.current) {
          queueVoiceConversationResume(320);
        }
      }

      updateUsage({ messages: messagesUsed + 1 });
    } catch (error) {
      if (submittedFiles.length) {
        setPendingFiles(submittedFiles);
      }
      const fallback = error instanceof Error ? error.message : "Falha de conexao com o backend.";
      setRequestError(fallback);
      setVoiceStatus("idle");
      updateActiveThread((thread) => ({
        ...thread,
        updatedAt: new Date().toISOString(),
        messages: thread.messages.map((item) =>
          item.id === pendingId
            ? {
                ...item,
                content: "Nao consegui responder agora. Verifique backend e tente novamente.",
                pending: false
              }
            : item
        )
      }));
    } finally {
      setIsSending(false);
    }
  }

  async function generateToolArtifact(mode: ToolMode, prompt: string, requestedFormat?: string) {
    if (!authUser) {
      throw new Error("Autenticacao indisponivel para gerar conteudo.");
    }

    if (!canUseTools) {
      throw new Error("Recursos avancados liberados somente para usuario logado.");
    }

    if (mode === "image" && Number.isFinite(imagesRemaining) && imagesRemaining <= 0) {
      throw new Error("Limite diario de imagens atingido no plano atual.");
    }

    if (mode === "document" && Number.isFinite(documentsRemaining) && documentsRemaining <= 0) {
      throw new Error("Limite diario de documentos atingido no plano atual.");
    }

    if (mode === "image") {
      const payload = await requestJsonWithFailover(
        "/generate/image",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": authUser.id
          },
          body: JSON.stringify({
            prompt,
            locale: "pt-BR"
          })
        },
        35_000
      );

      const image = asRecord(payload?.image);
      const mimeType = String(image.mimeType || "image/png");
      const base64 = String(image.base64 || "");

      if (!base64) {
        throw new Error("Nao foi possivel obter a imagem gerada.");
      }

      updateUsage({ images: imagesUsed + 1 });
      return {
        mode,
        generatedImage: { mimeType, base64 },
        generatedDocument: null
      };
    }

    const format = String(requestedFormat || DEFAULT_DOC_FORMAT);

    const payload = await requestJsonWithFailover(
      "/generate/document",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": authUser.id
        },
        body: JSON.stringify({
          prompt,
          format,
          title: deriveDocumentTitle(prompt),
          locale: "pt-BR",
          context: {
            assistantProfile: "auto"
          }
        })
      },
      35_000
    );

    const doc = asRecord(payload?.document);
    const base64 = String(doc.base64 || "");
    if (!base64) {
      throw new Error("Nao foi possivel obter o documento gerado.");
    }

    const generatedDocument: GeneratedDocument = {
      fileName: String(doc.fileName || `documento.${format}`),
      mimeType: String(doc.mimeType || "application/octet-stream"),
      base64,
      previewText: sanitizeArtifactPreviewText(String(payload?.previewText || doc.previewText || "Documento pronto para download."))
    };
    updateUsage({ documents: documentsUsed + 1 });
    return {
      mode,
      generatedImage: null,
      generatedDocument
    };
  }

  useEffect(() => {
    voiceSessionRef.current = voiceSession;
  }, [voiceSession]);

  useEffect(() => {
    if (!voiceSession?.sessionId) {
      return;
    }

    const interval = window.setInterval(() => {
      void requestJsonWithFailover(
        `/v1/realtime/sessions/${voiceSession.sessionId}/keepalive`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": authUser?.id || getScopeId()
          },
          body: JSON.stringify({})
        },
        10_000
      ).catch(() => undefined);
    }, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [authUser?.id, requestJsonWithFailover, voiceSession?.sessionId]);

  useEffect(() => {
    submitMessageRef.current = async () => {
      await submitMessage();
    };
  });

  useEffect(() => {
    return () => {
      if (voiceConversationResumeTimerRef.current !== null) {
        window.clearTimeout(voiceConversationResumeTimerRef.current);
      }
      voiceBargeInPendingRef.current = false;
      voiceConversationPausedRef.current = false;
      releaseVoiceInterruptMonitor();
      releaseVoiceOutputMonitor();
      stopPlayback("idle");
      releaseVoiceCaptureResources();
    };
  }, [releaseVoiceCaptureResources, releaseVoiceInterruptMonitor, releaseVoiceOutputMonitor, stopPlayback]);

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") {
      return;
    }

    if (event.shiftKey) {
      event.preventDefault();
      const target = event.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const nextValue = `${input.slice(0, start)}\n${input.slice(end)}`;
      setInput(nextValue);

      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const nextCursor = start + 1;
        textarea.selectionStart = nextCursor;
        textarea.selectionEnd = nextCursor;
      });
      return;
    }

    if (event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    void submitMessage();
  }

  function stopVoiceConversationMode() {
    setVoiceQuickModalOpen(false);
    syncInlineVoiceComposerMode(false);
    voiceConversationModeRef.current = false;
    voiceConversationPausedRef.current = false;
    setVoiceConversationMode(false);
    setVoiceConversationPaused(false);
    voiceBargeInPendingRef.current = false;
    voiceShouldAutoSubmitRef.current = false;
    voiceCapturedSinceStartRef.current = false;
    setVoiceInterimTranscript("");

    if (voiceConversationResumeTimerRef.current !== null) {
      window.clearTimeout(voiceConversationResumeTimerRef.current);
      voiceConversationResumeTimerRef.current = null;
    }

    releaseVoiceInterruptMonitor();
    stopPlayback("idle");

    if (voiceCaptureModeRef.current === "server") {
      void stopServerSideVoiceCapture({
        autoSubmit: false,
        reason: "voice_mode_closed"
      }).catch(() => {
        setVoiceStatus("idle");
      });
      return;
    }

    releaseVoiceCaptureResources();
    setMicListening(false);
    voiceCaptureModeRef.current = "idle";

    try {
      speechRecognitionRef.current?.stop();
    } catch {
      // noop
    }

    setVoiceStatus("idle");
  }

  function startVoiceConversationMode(options?: { enableSpeaker?: boolean }) {
    if (!speakerSupported) {
      setRequestError("Conversa por voz exige leitura em voz alta disponivel neste navegador/dispositivo.");
      return;
    }

    const recognition = speechRecognitionRef.current;
    const canUseServerCapture = Boolean(config?.features?.serverAudioTranscriptions) && isBrowserWavRecorderSupported();
    if (!recognition && !canUseServerCapture) {
      setRequestError("Microfone nao suportado neste navegador/dispositivo.");
      return;
    }

    if (voiceConversationResumeTimerRef.current !== null) {
      window.clearTimeout(voiceConversationResumeTimerRef.current);
      voiceConversationResumeTimerRef.current = null;
    }

    voiceBargeInPendingRef.current = false;
    voiceConversationPausedRef.current = false;
    setVoiceQuickModalOpen(false);
    syncInlineVoiceComposerMode(false);
    releaseVoiceInterruptMonitor();
    setVoiceConversationPaused(false);
    if (options?.enableSpeaker !== false) {
      setSpeakerEnabled(true);
    }
    setRequestError(null);
    voiceConversationModeRef.current = true;
    setVoiceConversationMode(true);

    void startRealtimeVoiceCapture({ autoSubmit: true }).catch((error) => {
      voiceConversationModeRef.current = false;
      setVoiceConversationMode(false);
      releaseVoiceCaptureResources();
      setVoiceStatus("idle");
      setRequestError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel iniciar o microfone. Permita o acesso no navegador e tente novamente."
      );
    });
  }

  startVoiceConversationModeRef.current = startVoiceConversationMode;

  async function pauseVoiceConversationMode() {
    if (!voiceConversationModeRef.current || voiceConversationPausedRef.current) {
      return;
    }

    voiceConversationPausedRef.current = true;
    setVoiceConversationPaused(true);
    voiceBargeInPendingRef.current = false;
    voiceShouldAutoSubmitRef.current = false;
    voiceCapturedSinceStartRef.current = false;
    setVoiceInterimTranscript("");

    if (voiceConversationResumeTimerRef.current !== null) {
      window.clearTimeout(voiceConversationResumeTimerRef.current);
      voiceConversationResumeTimerRef.current = null;
    }

    releaseVoiceInterruptMonitor();
    stopPlayback("paused");

    if (voiceCaptureModeRef.current === "server") {
      await stopServerSideVoiceCapture({
        autoSubmit: false,
        reason: "voice_mode_paused"
      }).catch(() => undefined);
      setVoiceStatus("paused");
      return;
    }

    if (voiceCaptureModeRef.current === "browser") {
      releaseVoiceCaptureResources();
      setMicListening(false);
      voiceCaptureModeRef.current = "idle";

      try {
        speechRecognitionRef.current?.stop();
      } catch {
        // noop
      }
    }

    setVoiceStatus("paused");
  }

  function resumeVoiceConversationMode() {
    if (!voiceConversationModeRef.current) {
      startVoiceConversationMode();
      return;
    }

    if (!voiceConversationPausedRef.current) {
      return;
    }

    startVoiceConversationMode({
      enableSpeaker: false
    });
  }

  function toggleVoiceConversationPause() {
    if (voiceConversationPausedRef.current) {
      resumeVoiceConversationMode();
      return;
    }

    void pauseVoiceConversationMode();
  }

  function recoverVoiceConversationMode() {
    setRequestError(null);

    if (voiceConversationPausedRef.current) {
      resumeVoiceConversationMode();
      return;
    }

    if (!voiceConversationModeRef.current) {
      startVoiceConversationMode({
        enableSpeaker: speakerEnabled
      });
      return;
    }

    const keepSpeakerEnabled = speakerEnabled;
    stopVoiceConversationMode();
    requestAnimationFrame(() => {
      startVoiceConversationMode({
        enableSpeaker: keepSpeakerEnabled
      });
    });
  }

  function openVoiceSettings() {
    setShowProfile(true);
  }

  function openVoiceQuickModal() {
    if (!micSupported) {
      setRequestError("Microfone nao suportado neste navegador/dispositivo.");
      return;
    }

    if (voiceConversationModeRef.current) {
      stopVoiceConversationMode();
    }

    setRequestError(null);
    setVoiceQuickModalOpen(true);
  }

  function startInlineVoiceCapture(persona: VoicePersonaId) {
    const normalizedPersona = persona === "diana" ? "diana" : "giom";
    const recognition = speechRecognitionRef.current;
    const canUseServerCapture = Boolean(config?.features?.serverAudioTranscriptions) && isBrowserWavRecorderSupported();

    if (!recognition && !canUseServerCapture) {
      setVoiceQuickModalOpen(false);
      setRequestError("Microfone nao suportado neste navegador/dispositivo.");
      return;
    }

    if (voiceConversationModeRef.current) {
      stopVoiceConversationMode();
    }

    setSelectedVoicePersona(normalizedPersona);
    setVoiceQuickModalOpen(false);
    setRequestError(null);
    setVoiceInterimTranscript("");
    syncInlineVoiceComposerMode(true);

    if (speakerSupported) {
      setSpeakerEnabled(true);
    }

    void startRealtimeVoiceCapture({ autoSubmit: false }).catch((error) => {
      syncInlineVoiceComposerMode(false);
      setVoiceStatus("idle");
      setRequestError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel iniciar o ditado por voz."
      );
    });
  }

  function startVoiceConversationFromModal(persona: VoicePersonaId) {
    const normalizedPersona = persona === "diana" ? "diana" : "giom";

    flushSync(() => {
      setSelectedVoicePersona(normalizedPersona);
      setVoiceQuickModalOpen(false);
      setRequestError(null);
    });

    startVoiceConversationModeRef.current?.();
  }

  function stopInlineVoiceCapture() {
    setVoiceQuickModalOpen(false);

    if (!inlineVoiceComposerActiveRef.current) {
      return;
    }

    voiceShouldAutoSubmitRef.current = false;
    setVoiceInterimTranscript("");

    if (voiceCaptureModeRef.current === "server") {
      void stopServerSideVoiceCapture({
        autoSubmit: false,
        reason: "inline_dictation_stopped"
      }).catch((error) => {
        syncInlineVoiceComposerMode(false);
        setVoiceStatus("idle");
        setRequestError(
          error instanceof Error
            ? error.message
            : "Nao foi possivel encerrar o ditado por voz."
        );
      });
      return;
    }

    if (voiceCaptureModeRef.current === "browser") {
      try {
        speechRecognitionRef.current?.stop();
      } catch {
        syncInlineVoiceComposerMode(false);
        setVoiceStatus("idle");
      }
      return;
    }

    syncInlineVoiceComposerMode(false);
    setVoiceStatus("idle");
  }

  function stopVoicePreview() {
    voiceBargeInPendingRef.current = false;
    stopPlayback("idle");
    setVoicePreviewActive(false);
  }

  async function previewSelectedVoicePersona() {
    if (!speakerSupported) {
      setRequestError("Leitura em voz alta indisponivel neste navegador/dispositivo.");
      return;
    }

    if (voiceConversationModeRef.current) {
      stopVoiceConversationMode();
    }

    setRequestError(null);
    voiceBargeInPendingRef.current = false;
    releaseVoiceInterruptMonitor();
    stopPlayback("idle");
    setVoicePreviewActive(true);

    try {
      const serverPreviewManifest = shouldUseServerVoiceAudio
        ? await requestSpeechManifest(null, activeVoicePersona.previewText, {
            forceServerAudio: true
          }).catch(() => null)
        : null;

      const controller = playServerAudio(serverPreviewManifest) || speakWithBrowser({
        text: activeVoicePersona.previewText,
        language: activePersonaSpeech.language,
        voiceName: activePersonaSpeech.voiceName,
        rate: activePersonaSpeech.rate,
        pitch: activePersonaSpeech.pitch
      });

      speechPlaybackRef.current = controller;
      await controller.promise;
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel reproduzir a amostra da voz selecionada."
      );
    } finally {
      speechPlaybackRef.current = null;
      setVoicePreviewActive(false);
    }
  }

  function toggleVoiceConversationMute() {
    if (!speakerSupported) {
      setRequestError("Leitura em voz alta indisponivel neste navegador/dispositivo.");
      return;
    }

    setSpeakerEnabled((current) => {
      const next = !current;
      if (!next) {
        stopPlayback(voiceConversationPausedRef.current ? "paused" : "idle");
      }
      return next;
    });
  }

  function toggleMicrophone() {
    if (inlineVoiceComposerActiveRef.current) {
      stopInlineVoiceCapture();
      return;
    }

    if (voiceConversationMode) {
      stopVoiceConversationMode();
      return;
    }

    // Bible study surface → full voice conversation with teacher
    if (surface === "study") {
      startVoiceConversationMode();
      return;
    }

    // Normal chat → dictation: fill input, user reviews and sends
    startInlineVoiceCapture(selectedVoicePersona);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = event.target.files ? Array.from(event.target.files) : [];
    addFilesFromInput(selectedFiles);
    event.target.value = "";
  }

  function renderAssistantMessage(message: ChatMessage) {
    return (
      <MessageRichContent
        message={message}
        onCopyText={copyMessageContent}
        onEditText={editPrompt}
      />
    );
  }

  if (!isHydrated || !authReady) {
    return (
      <main id="appShell" className="chatgpt-shell"></main>
    );
  }

  if (!authUser) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <p className="auth-kicker">GIOM Workspace</p>
          <h1>Preparando modo anonimo...</h1>
        </section>
      </main>
    );
  }

  return (
    <>
      {!sidebarOpen && !voiceConversationMode ? (
        <button
          id="mobileMenuBtn"
          type="button"
          className="sidebar-toggle-mobile"
          aria-label="Abrir sidebar"
          title="Abrir sidebar"
          onClick={() => setSidebarOpen(true)}
        >
          <IconSidebar />
        </button>
      ) : null}

      <div id="appShell" className={`chatgpt-shell ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
      <ChatSidebar
        activeThreadId={activeThread?.id || ""}
        authUser={authUser}
        formatRelativeDate={formatRelativeDate}
        getInitials={getInitials}
        getThreadSnippet={getThreadSnippet}
        onDeleteThread={handleDeleteThread}
        onLogout={() => void handleLogout()}
        onNavigateBible={() => { window.location.assign("/chat/bible"); }}
        onNavigateChat={() => { window.location.assign("/chat"); }}
        onNewChat={handleNewChat}
        onSelectThread={handleSelectThread}
        onShowProfile={() => setShowProfile(true)}
        onToggleSidebar={() => setSidebarOpen((current) => !current)}
        onUpgrade={() => void handleHeaderAuthAction("sign-up")}
        sidebarOpen={sidebarOpen}
        studyPanel={(
          <BibleStudyPanel
            mascotMode={studyMascotMode}
            mascotStatusLabel={studyMascotStatusLabel}
            mascotVoiceEnabled={surface === "study" && (speakerSupported || voiceConversationMode)}
            moduleCatalog={bibleModuleCatalog}
            onApplyStarter={handleApplyStudyStarter}
            onPreferredBibleCodeChange={handlePreferredBibleCodeChange}
            onSelectStep={handleSelectStudyStep}
            onSelectTrack={handleSelectStudyTrack}
            onStudyDepthPreferenceChange={handleStudyDepthPreferenceChange}
            onStudyMinistryFocusChange={handleStudyMinistryFocusChange}
            onToggleModule={handleToggleStudyModule}
            onToggleStepDone={handleToggleStudyStepDone}
            onToggleStudyMode={handleToggleStudyMode}
            preferredBibleCode={preferredBibleCode}
            progressState={studyProgress}
            providerStatusLabel={providerResilienceLabel}
            selectedModuleIds={selectedBibleStudyModules}
            studyDepthPreference={studyDepthPreference}
            studyMinistryFocus={studyMinistryFocus}
            studyModeEnabled={studyModeEnabled}
            studyTrackId={studyTrackId}
            tracks={bibleLearningTracks}
          />
        )}
        surface={surface === "study" ? "study" : "chat"}
        threads={threads}
      />

      <button
        id="sidebarScrim"
        type="button"
        className={`sidebar-scrim ${sidebarOpen ? "visible" : ""}`}
        aria-label="Fechar sidebar"
        title="Fechar sidebar"
        tabIndex={sidebarOpen ? 0 : -1}
        onClick={() => setSidebarOpen(false)}
      />

      <main className={`chatgpt-main ${messages.length === 0 && !voiceConversationMode ? "landing-mode" : ""}`}>
        {voiceConversationMode ? (
          <VoiceConversationOverlay
            assistantText={latestAssistantVoiceText || null}
            inputDisabled={isSending}
            inputValue={input}
            interimTranscript={voiceInterimTranscript}
            microphoneReady={micSupported}
            onClose={stopVoiceConversationMode}
            onInputChange={setInput}
            onOpenSettings={openVoiceSettings}
            onRetry={recoverVoiceConversationMode}
            onSubmitInput={() => { void submitMessage(); }}
            onToggleMute={toggleVoiceConversationMute}
            onTogglePause={toggleVoiceConversationPause}
            open={voiceConversationMode}
            muted={!speakerEnabled}
            outputEngine={voiceOutputEngine}
            paused={voiceConversationPaused}
            personaId={selectedVoicePersona}
            personaLabel={activeVoicePersona.label}
            personaTone={activeVoicePersona.tone}
            recoveryHint={voiceRecoveryHint}
            sessionReady={voiceSessionReady}
            signalLevel={voiceSignalLevel}
            signalMode={voiceSignalMode}
            status={voiceStatus}
            statusLabel={voiceStatusLabel}
            submitEnabled={Boolean(input.trim())}
            userQuote={latestUserVoiceText || null}
          />
        ) : (
          <>
            <ChatHeader
              authUser={authUser}
              getInitials={getInitials}
              onHeaderAuthAction={handleHeaderAuthAction}
              onNewChat={handleNewChat}
              onShowProfile={() => setShowProfile(true)}
              onToggleSidebar={() => setSidebarOpen((current) => !current)}
              sidebarOpen={sidebarOpen}
              surfaceLabel={surface === "study" ? "Fale Biblico" : "ChatGPT"}
              surface={surface === "study" ? "study" : "chat"}
            />

            {surface === "study" && messages.length > 0 ? (
              <BibleStudyWorkspaceBanner
                completionRate={activeBibleCompletionRate}
                depthPreference={studyDepthPreference}
                medalProgressLabel={activeBibleMilestoneSummary.total ? `${activeBibleMilestoneSummary.unlocked}/${activeBibleMilestoneSummary.total}` : null}
                ministryFocus={studyMinistryFocus}
                moduleCount={selectedBibleStudyModules.length}
                nextMedalLabel={activeBibleMilestoneSummary.nextLabel}
                statusLabel={studyMascotStatusLabel}
                stepGoal={activeBibleStep?.goal || null}
                stepLabel={activeBibleStep?.label || null}
                trackLabel={activeBibleTrack?.label || null}
                voiceEnabled={speakerSupported || voiceConversationMode}
              />
            ) : null}

            <ChatConversation
              chatRef={chatRef}
              getMessageUploads={getMessageUploads}
              getMessageUploadPreviews={(message) => getMessageUploadPreviews(message, messageUploadPreviews)}
              landingGreeting={landingGreeting}
              messages={messages}
              onChatScroll={handleChatScroll}
              onScrollToBottom={() => scrollToBottom(true)}
              onSuggestionClick={(text) => { setInput(text); }}
              renderAssistantMessage={renderAssistantMessage}
              stickToBottom={stickToBottom}
              studyHero={surface === "study" ? (
                <BibleStudyHero
                  completionRate={activeBibleCompletionRate}
                  depthPreference={studyDepthPreference}
                  medalHistory={studyMedalHistory.slice(0, 2).map((entry) => `${entry.medalLabel} - ${entry.trackLabel}`)}
                  medalProgressLabel={activeBibleMilestoneSummary.total ? `${activeBibleMilestoneSummary.unlocked}/${activeBibleMilestoneSummary.total}` : null}
                  ministryFocus={studyMinistryFocus}
                  mode={studyMascotMode}
                  moduleCount={selectedBibleStudyModules.length}
                  nextMedalLabel={activeBibleMilestoneSummary.nextLabel}
                  statusLabel={studyMascotStatusLabel}
                  stepLabel={activeBibleStep?.label || null}
                  studyModeEnabled={studyModeEnabled}
                  trackLabel={activeBibleTrack?.label || null}
                  voiceEnabled={speakerSupported || voiceConversationMode}
                />
              ) : null}
              surface={surface === "study" ? "study" : "chat"}
            />

            <ChatComposer
              canUseUploads={canUseUploads}
              fileAccept={config?.uploads?.accept?.join(",")}
              fileInputRef={fileInputRef}
              isGuest={authUser.source === "guest"}
              inlineVoiceActive={inlineVoiceComposerActive}
              inlineVoiceSignalLevel={voiceInputLevel}
              input={input}
              isSending={isSending}
              micListening={micListening}
              microphoneMode={surface === "study" ? "conversation" : "dictation"}
              micSupported={micSupported}
              onCloseVoiceModal={() => setVoiceQuickModalOpen(false)}
              voiceConversationActive={voiceConversationMode}
              onOpenVoiceModal={openVoiceQuickModal}
              voiceStatusLabel={voiceConversationMode || inlineVoiceComposerActive ? voiceStatusLabel : null}
              onComposerKeyDown={onComposerKeyDown}
              onFileChange={handleFileChange}
              onInputChange={setInput}
              onRemovePendingFile={removePendingFile}
              onSelectVoicePersona={(persona) => setSelectedVoicePersona(persona === "diana" ? "diana" : "giom")}
              onStartVoiceConversation={startVoiceConversationFromModal}
              onSubmit={submitMessage}
              onToggleMicrophone={toggleMicrophone}
              pendingFiles={pendingFiles}
              selectedVoicePersona={selectedVoicePersona}
              showVoicePersonaButton={surface === "study" || authUser.source !== "guest"}
              textareaRef={textareaRef}
              voiceModalOpen={voiceQuickModalOpen}
            />

            {requestError && <p className="request-error">{requestError}</p>}
          </>
        )}
      </main>
      </div>

      <ProfileModal
        authUser={authUser}
        documentsUsed={documentsUsed}
        getInitials={getInitials}
        imagesUsed={imagesUsed}
        limits={limits}
        messagesUsed={messagesUsed}
        onClose={() => setShowProfile(false)}
        onPreviewVoicePersona={() => void previewSelectedVoicePersona()}
        onSpeakerEnabledChange={setSpeakerEnabled}
        onStopVoicePreview={stopVoicePreview}
        onUpgrade={() => setRequestError("Upgrade de plano pode ser conectado ao checkout na proxima etapa.")}
        onVoicePersonaChange={(voicePersona) => {
          setSelectedVoicePersona(voicePersona === "diana" ? "diana" : "giom");
          stopPlayback("idle");
        }}
        open={showProfile}
        resolvedVoiceLabel={resolvedDeviceVoiceLabel}
        speakerEnabled={speakerEnabled}
        speakerSupported={speakerSupported}
        voicePreviewActive={voicePreviewActive}
        selectedVoicePersona={selectedVoicePersona}
        studyMedalHistory={studyMedalHistory.slice(0, 6)}
        studyMedalSummary={studyMedalSummary}
        voicePersonaOptions={VOICE_PERSONA_OPTIONS}
      />

      {/* Guest new-chat confirmation modal */}
      {showGuestNewChatModal && (
        <div className="guest-newchat-overlay" role="dialog" aria-modal="true" aria-label="Limpar chat" onClick={() => setShowGuestNewChatModal(false)}>
          <div className="guest-newchat-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="guest-newchat-close" onClick={() => setShowGuestNewChatModal(false)} aria-label="Fechar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" /><line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" /></svg>
            </button>
            <h3 className="guest-newchat-title">Limpar chat atual?</h3>
            <p className="guest-newchat-desc">
              Para iniciar um novo chat, sua conversa atual sera descartada. <strong>Cadastre-se</strong> ou <strong>Entre na sua conta</strong> para salvar os chats.
            </p>
            <div className="guest-newchat-actions">
              <button type="button" className="guest-newchat-clear" onClick={confirmNewChat}>
                Limpar chat
              </button>
              <button
                type="button"
                className="guest-newchat-login"
                onClick={() => {
                  setShowGuestNewChatModal(false);
                  void handleHeaderAuthAction("sign-in");
                }}
              >
                Entrar
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthModal
        authEmail={authEmail}
        authError={authError}
        authLoading={authLoading}
        authMode={authMode}
        authName={authName}
        authNotice={authNotice}
        authPassword={authPassword}
        authStep={authStep}
        authSupportsMagicLink={authSupportsMagicLink}
        authSystemEnabled={Boolean(config?.features?.auth)}
        oauthLoading={oauthLoading}
        onAuthModeChange={handleHeaderAuthAction}
        onClose={() => setShowAuthScreen(false)}
        onContinueAsGuest={continueAsGuest}
        onEmailChange={setAuthEmail}
        onNameChange={setAuthName}
        onOAuth={(provider) => void handleOAuth(provider)}
        onPasswordChange={setAuthPassword}
        onResetEmailStep={() => setAuthStep("email")}
        onSubmit={submitAuth}
        open={showAuthScreen}
      />
    </>
  );
}
