"use client";

import { createClient, type Provider, type SupabaseClient, type User } from "@supabase/supabase-js";
import { AuthModal } from "@/components/chat/AuthModal";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatConversation } from "@/components/chat/ChatConversation";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { IconSidebar } from "@/components/chat/ChatIcons";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ProfileModal } from "@/components/chat/ProfileModal";
import { buildUploadPreviews, revokeUploadPreviews, type MessageUploadPreview } from "@/lib/uploadPreviews";
import type {
  AuthIdentity,
  AuthMode,
  AuthStep,
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
  };
  uploads?: {
    enabled?: boolean;
    maxBytes?: number;
    accept?: string[];
  };
  ai?: {
    documentGeneration?: {
      formats?: Array<{ id?: string; format?: string }>;
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
const WEATHER_LOCATION_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const EMPTY_MESSAGES: ChatMessage[] = [];
const DEFAULT_DOC_FORMAT = "pdf";
const MAX_INLINE_ATTACHMENTS = 12;
const MAX_CONVERSATION_HISTORY_ITEMS = 10;
const MAX_CONVERSATION_HISTORY_ITEM_CHARS = 900;
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
  const baseContent = String(message.content || "").trim();
  const artifactContext: string[] = [];

  if (message.generatedDocument?.previewText) {
    artifactContext.push(
      `Documento gerado (${message.generatedDocument.fileName}): ${message.generatedDocument.previewText}`
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

function readThreadsFromStorage() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(THREADS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChatThread[];
    return Array.isArray(parsed) && parsed.length ? parsed : null;
  } catch {
    return null;
  }
}

function getScopeId() {
  if (typeof window === "undefined") return "web-next-local";
  const existing = window.localStorage.getItem(SCOPE_STORAGE_KEY);
  if (existing) return existing;
  const created = makeId("scope");
  window.localStorage.setItem(SCOPE_STORAGE_KEY, created);
  return created;
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

function buildLandingGreeting(userName?: string | null) {
  const hour = new Date().getHours();
  const periodGreeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const firstName = String(userName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0];
  const safeName = firstName ? `, ${firstName}` : "";

  return {
    title: `${periodGreeting}${safeName}! Tudo bem?`,
    subtitle: "Shalom, eu sou o GIOM. O que podemos fazer hoje?"
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
    .replace(/^(gere|gera|crie|cria|faca|produza|redija|escreva|monte)\s+/i, "")
    .trim();
  return normalized.slice(0, 48) || "Documento GIOM";
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
        if (typeof payloadContent === "string" && payloadContent.trim()) {
          return {
            type: "prompt" as const,
            content: payloadContent.trim()
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
      content: unescapeJsonLikeString(contentMatch[1])
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
            heading: "Resumo",
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
  const [threads, setThreads] = useState<ChatThread[]>([createThread()]);
  const [activeThreadId, setActiveThreadId] = useState<string>("");
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [input, setInput] = useState("");
  const [messageUploadPreviews, setMessageUploadPreviews] = useState<Record<string, MessageUploadPreview[]>>({});
  const [isSending, setIsSending] = useState(false);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  const [authReady, setAuthReady] = useState(true);
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
  const [weatherLocation, setWeatherLocation] = useState<WeatherLocationContext | null>(null);

  const [micSupported, setMicSupported] = useState(false);
  const [micListening, setMicListening] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const chatRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const threadsRef = useRef<ChatThread[]>(threads);
  const messageUploadPreviewsRef = useRef<Record<string, MessageUploadPreview[]>>({});
  const guestLandingResetRef = useRef(false);

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

  const activeThread = threads.find((thread) => thread.id === activeThreadId) || threads[0];
  const messages = activeThread?.messages || EMPTY_MESSAGES;
  const landingGreeting = useMemo(() => buildLandingGreeting(authUser?.fullName), [authUser?.fullName]);

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
          const message = String(
            (payload as { error?: string })?.error ||
            (payload as { details?: string })?.details ||
            (rawHint ? `Erro HTTP ${response.status}: ${rawHint}` : `Erro HTTP ${response.status}`)
          );
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
            `Falha ao acessar backend (${route}). Tentativas: ${attempts.join(" | ")}`
          ) as Error & { status?: number };
          enriched.status = Number((error as { status?: number })?.status || 0) || undefined;
          throw enriched;
        }
      }
    }

    throw lastError || new Error("Falha de conexao com backend.");
  }, [apiBases]);

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
          const message = String(
            (payload as { error?: string })?.error ||
            (payload as { details?: string })?.details ||
            (rawHint ? `Erro HTTP ${response.status}: ${rawHint}` : `Erro HTTP ${response.status}`)
          );
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
            `Falha ao abrir stream (${route}). Tentativas: ${attempts.join(" | ")}`
          ) as Error & { status?: number };
          enriched.status = Number((error as { status?: number })?.status || 0) || undefined;
          throw enriched;
        }
      }
    }

    throw lastError || new Error("Falha de conexao com backend.");
  }, [apiBases]);

  const limits = useMemo(() => getPlanLimits(authUser), [authUser]);
  const messagesUsed = usage?.messages || 0;
  const imagesUsed = usage?.images || 0;
  const documentsUsed = usage?.documents || 0;

  const messagesRemaining = Number.isFinite(limits.messages) ? Math.max(0, limits.messages - messagesUsed) : Number.POSITIVE_INFINITY;
  const imagesRemaining = Number.isFinite(limits.images) ? Math.max(0, limits.images - imagesUsed) : Number.POSITIVE_INFINITY;
  const documentsRemaining = Number.isFinite(limits.documents) ? Math.max(0, limits.documents - documentsUsed) : Number.POSITIVE_INFINITY;

  const canUseUploads = Boolean(limits.uploads && config?.uploads?.enabled !== false);
  const canUseTools = Boolean(limits.tools && (config?.features?.imageGeneration || config?.features?.documentGeneration));
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

    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructorLike;
      webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
    };

    const SpeechCtor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechCtor) {
      setMicSupported(false);
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
    };

    recognition.onend = () => {
      setMicListening(false);
    };

    recognition.onerror = (event) => {
      setMicListening(false);
      if (event.error && event.error !== "no-speech") {
        setRequestError(speechErrorMessage(event.error));
      }
    };

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results.item(i);
        if (!result) continue;
        const chunk = result.item(0)?.transcript || "";
        if (result.isFinal) {
          transcript += `${chunk} `;
        }
      }

      if (!transcript.trim()) return;
      setInput((current) => `${current}${current.trim() ? " " : ""}${transcript.trim()}`.trim());
    };

    speechRecognitionRef.current = recognition;
    setMicSupported(true);

    return () => {
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      try {
        recognition.stop();
      } catch {
        // noop
      }
      speechRecognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const storedThreads = readThreadsFromStorage();
    if (storedThreads?.length) {
      setThreads(storedThreads);
      setActiveThreadId(storedThreads[0].id);
    } else {
      const fallback = createThread();
      setThreads([fallback]);
      setActiveThreadId(fallback.id);
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    setWeatherLocation(readStoredWeatherLocation());
  }, []);

  useEffect(() => {
    // Sidebar inicia fechada em qualquer viewport; o usuario abre manualmente.
    setSidebarOpen(false);
  }, []);

  useEffect(() => {
    void requestJsonWithFailover("/config", {
      method: "GET"
    }, 15_000)
      .then((payload) => setConfig(payload as RuntimeConfig))
      .catch(() => setConfig(null));
  }, [requestJsonWithFailover]);

  // Warm-up: dispara um GET leve em /config para
  // pré-estabelecer a conexão keep-alive com o backend. Quando o usuário
  // enviar a primeira mensagem, a conexão TCP já existirá e não cairá por
  // socket idle / ECONNRESET no primeiro request.
  useEffect(() => {
    void fetch("/backend/config", { method: "GET", cache: "no-store" }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!config) return;

    const authEnabled = Boolean(config.features?.auth && config.supabaseUrl && config.supabaseAnonKey);
    if (!authEnabled) {
      setAuthUser(readLocalSession() || createGuestIdentity());
      setAuthReady(true);
      return;
    }

    const client = createClient(String(config.supabaseUrl), String(config.supabaseAnonKey));
    supabaseRef.current = client;

    void client.auth.getUser()
      .then(({ data }) => {
        setAuthUser(data.user ? mapSupabaseUser(data.user) : createGuestIdentity());
        setAuthReady(true);
      })
      .catch(() => {
        // Network/auth provider hiccups must not break hydration or app bootstrap.
        setAuthUser(createGuestIdentity());
        setAuthReady(true);
      });

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ? mapSupabaseUser(session.user) : createGuestIdentity());
    });

    return () => subscription.unsubscribe();
  }, [config]);

  useEffect(() => {
    if (!isHydrated) return;
    window.localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(threads));
  }, [threads, isHydrated]);

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
      return;
    }

    if (guestLandingResetRef.current) return;

    const hasAnyMessage = threadsRef.current.some((thread) => thread.messages.length > 0);
    if (!hasAnyMessage) return;

    const fresh = createThread();
    setThreads([fresh]);
    setActiveThreadId(fresh.id);
    guestLandingResetRef.current = true;
  }, [authUser, isHydrated]);

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
    const fresh = createThread();
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

  async function requestAssistantResponseStandard(question: string, context: GIOMAskContext, sessionId: string | null) {
    const safeContext = sanitizeContextForApi(context);

    const runAsk = async (contextPayload: GIOMAskContext | Record<string, unknown>, retryAttempt = 1) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-User-Id": authUser?.id || getScopeId()
      };

      if (sessionId) {
        headers["X-Session-Id"] = sessionId;
      }

      return await requestJsonWithFailover(
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
      );
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

    return extractAnswer(payload as Record<string, unknown>) || "Resposta vazia do servidor.";
  }

  async function requestAssistantResponseStream(
    question: string,
    context: GIOMAskContext,
    sessionId: string | null,
    onProgress: (partial: string) => void
  ) {
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
        const data = parsed.data as { response?: string; metadata?: { fallback?: boolean } };
        finalAnswer = data.response || finalAnswer;
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
          return finalAnswer;
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
          return finalAnswer;
        }
      }
    }

    assertStreamProgress();

    if (!finalAnswer) {
      throw new Error("Streaming encerrado sem resposta.");
    }

    return finalAnswer;
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
    setAuthMode(mode);
    setAuthError(null);
    setAuthNotice(null);
    setAuthStep("email");
    if (mode === "sign-in") {
      setAuthPassword("");
    }
    setShowAuthScreen(true);
  }

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
        preferredResponseCard: responsePresentation?.card || "text",
        preferredResponseVariant: responsePresentation?.variant || undefined,
        instructions: `${responsePresentation?.instructions || "Responda em texto limpo, sem markdown visual desnecessario."}${instructionSuffix}`,
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

      let answer = "";
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
                    : `Documento pronto. ${artifact.generatedDocument?.previewText || "Voce pode baixar ou ajustar o prompt."}`,
                  pending: false,
                  generatedImage: artifact.generatedImage || null,
                  generatedDocument: artifact.generatedDocument || null,
                  artifactPrompt: toolIntent.prompt
                }
              : item
          )
        }));
        setIsSending(false);
        return;
      }

      if (config?.features?.streaming !== false) {
        try {
          answer = await requestAssistantResponseStream(question, context, sessionId, (partial) => {
            applyPartial(partial, true);
          });
        } catch (streamError) {
          console.warn("Streaming falhou, caindo para resposta padrao.", streamError);
          answer = await requestAssistantResponseStandard(question, context, sessionId);
        }
      } else {
        answer = await requestAssistantResponseStandard(question, context, sessionId);
      }

      updateActiveThread((thread) => ({
        ...thread,
        updatedAt: new Date().toISOString(),
        messages: thread.messages.map((item) =>
          item.id === pendingId ? { ...item, content: answer, pending: false } : item
        )
      }));

      updateUsage({ messages: messagesUsed + 1 });
    } catch (error) {
      if (submittedFiles.length) {
        setPendingFiles(submittedFiles);
      }
      const fallback = error instanceof Error ? error.message : "Falha de conexao com o backend.";
      setRequestError(fallback);
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
      previewText: String(payload?.previewText || doc.previewText || "Documento pronto para download.")
    };
    updateUsage({ documents: documentsUsed + 1 });
    return {
      mode,
      generatedImage: null,
      generatedDocument
    };
  }

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

  function toggleMicrophone() {
    const recognition = speechRecognitionRef.current;
    if (!recognition) {
      setRequestError("Microfone nao suportado neste navegador/dispositivo.");
      return;
    }

    setRequestError(null);
    try {
      if (micListening) {
        recognition.stop();
      } else {
        recognition.start();
      }
    } catch {
      setRequestError("Nao foi possivel iniciar o microfone. Permita o acesso no navegador e tente novamente.");
    }
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
      <button
        id="mobileMenuBtn"
        type="button"
        className="sidebar-toggle-mobile"
        aria-controls="sidebar"
        aria-label={sidebarOpen ? "Fechar sidebar" : "Abrir sidebar"}
        title={sidebarOpen ? "Fechar sidebar" : "Abrir sidebar"}
        onClick={() => setSidebarOpen((current) => !current)}
      >
        <IconSidebar />
      </button>

      <div id="appShell" className={`chatgpt-shell ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
      <ChatSidebar
        activeThreadId={activeThread?.id || ""}
        authUser={authUser}
        formatRelativeDate={formatRelativeDate}
        getInitials={getInitials}
        getThreadSnippet={getThreadSnippet}
        onDeleteThread={handleDeleteThread}
        onLogout={() => void handleLogout()}
        onNewChat={handleNewChat}
        onSelectThread={handleSelectThread}
        onShowProfile={() => setShowProfile(true)}
        onToggleSidebar={() => setSidebarOpen((current) => !current)}
        onUpgrade={() => void handleHeaderAuthAction("sign-up")}
        sidebarOpen={sidebarOpen}
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

      <main className={`chatgpt-main ${messages.length === 0 ? "landing-mode" : ""}`}>
        <ChatHeader
          authUser={authUser}
          getInitials={getInitials}
          onHeaderAuthAction={handleHeaderAuthAction}
          onNewChat={handleNewChat}
          onShowProfile={() => setShowProfile(true)}
          onToggleSidebar={() => setSidebarOpen((current) => !current)}
          sidebarOpen={sidebarOpen}
        />

        <ChatConversation
          chatRef={chatRef}
          getMessageUploads={getMessageUploads}
          getMessageUploadPreviews={(message) => getMessageUploadPreviews(message, messageUploadPreviews)}
          landingGreeting={landingGreeting}
          messages={messages}
          onChatScroll={handleChatScroll}
          onScrollToBottom={() => scrollToBottom(true)}
          renderAssistantMessage={renderAssistantMessage}
          stickToBottom={stickToBottom}
        />

        <ChatComposer
          canUseUploads={canUseUploads}
          fileAccept={config?.uploads?.accept?.join(",")}
          fileInputRef={fileInputRef}
          input={input}
          isSending={isSending}
          micListening={micListening}
          micSupported={micSupported}
          onComposerKeyDown={onComposerKeyDown}
          onFileChange={handleFileChange}
          onInputChange={setInput}
          onRemovePendingFile={removePendingFile}
          onSubmit={submitMessage}
          onToggleMicrophone={toggleMicrophone}
          pendingFiles={pendingFiles}
          textareaRef={textareaRef}
        />

        {requestError && <p className="request-error">{requestError}</p>}
      </main>

      <ProfileModal
        authUser={authUser}
        documentsUsed={documentsUsed}
        getInitials={getInitials}
        imagesUsed={imagesUsed}
        limits={limits}
        messagesUsed={messagesUsed}
        onClose={() => setShowProfile(false)}
        onUpgrade={() => setRequestError("Upgrade de plano pode ser conectado ao checkout na proxima etapa.")}
        open={showProfile}
      />

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
      </div>
    </>
  );
}
