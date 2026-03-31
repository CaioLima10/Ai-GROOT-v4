export const GIOM_MESSAGE_TYPES: readonly [
  "text",
  "code",
  "document",
  "prompt",
  "checklist",
  "table",
  "timeline",
  "image",
  "video",
  "map",
  "data"
];

export const GIOM_DATA_VARIANTS: readonly ["weather", "fixture", "stats"];

export const ALLOWED_ASK_CONTEXT_KEYS: readonly string[];

export type GIOMMessageType = (typeof GIOM_MESSAGE_TYPES)[number];
export type GIOMDataVariant = (typeof GIOM_DATA_VARIANTS)[number];
export type GIOMRenderableContent = string | Record<string, unknown> | Array<unknown>;

export interface ChecklistItem {
  id?: string;
  label: string;
  checked?: boolean;
}

export interface TableContent {
  columns: string[];
  rows: Array<Array<string | number | boolean | null>>;
}

export interface TimelineItem {
  id?: string;
  title: string;
  time?: string;
  description?: string;
  status?: "done" | "active" | "pending";
}

export interface GIOMMessage {
  id?: string;
  type: GIOMMessageType;
  content: GIOMRenderableContent;
  language?: string;
  meta?: Record<string, unknown>;
}

export interface WeatherLocationContext {
  label?: string;
  latitude: number;
  longitude: number;
  forecastDays?: number;
  timezone?: string;
  source?: string;
  accuracyMeters?: number | null;
  capturedAt?: string | null;
}

export interface ConversationHistoryItem {
  role?: string;
  content?: string;
}

export interface GIOMAskContext {
  channel?: string;
  migrationStage?: number;
  uploadId?: string | null;
  uploadIds?: string[];
  uploadName?: string | null;
  uploadNames?: string[];
  uploadType?: string | null;
  plan?: string;
  source?: string;
  assistantProfile?: string;
  activeModules?: string[];
  domain?: string;
  locale?: string;
  language?: string;
  instructions?: string;
  preferredResponseCard?: string;
  preferredResponseVariant?: string;
  weatherLocation?: WeatherLocationContext | null;
  domainSubmodules?: Record<string, string[]>;
  bibleStudyModules?: string[];
  promptPacks?: string[];
  researchCapabilities?: Record<string, unknown>;
  preferredBibleCode?: string;
  ministryFocus?: string;
  userStyle?: string;
  depthPreference?: string;
  ageGroup?: string;
  verbosity?: string;
  examples?: boolean;
  noEmojis?: boolean;
  safetyLevel?: string;
  evaluationMode?: boolean;
  evaluationScenario?: string;
  conversationHistory?: ConversationHistoryItem[];
}

export interface GIOMUploadAsset {
  id: string;
  name: string;
  type: string;
}

export function normalizeGiomMessageType(value: unknown): GIOMMessageType | null;
export function normalizeGiomDataVariant(value: unknown): GIOMDataVariant | null;
export function isGiomRenderableContent(value: unknown): value is GIOMRenderableContent;
export function sanitizeAskContextValue(
  value: unknown,
  limits?: { maxStringLength?: number; maxArrayItems?: number; maxObjectEntries?: number }
): unknown;
export function sanitizeAskContext(context?: unknown): GIOMAskContext;
export function getAskContextDiagnostics(context?: unknown): {
  contextKeys: string[];
  contextBytes: number;
  droppedKeys: string[];
  rawContextKeys: string[];
};
