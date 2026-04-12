export type GeneratedImage = {
  mimeType: string;
  base64: string;
};

export type GeneratedDocument = {
  fileName: string;
  mimeType: string;
  base64: string;
  previewText: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  providerAttempted?: string | null;
  providerUsed?: string | null;
  providerFallback?: boolean;
  fallbackFrom?: string | null;
  fallbackReason?: string | null;
  uploadName?: string | null;
  uploadNames?: string[];
  generatedImage?: GeneratedImage | null;
  generatedDocument?: GeneratedDocument | null;
  artifactPrompt?: string | null;
  requestQuestion?: string | null;
  requestedResponseCard?: string | null;
  requestedResponseVariant?: string | null;
  createdAt: string;
};

export type ChatThread = {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
};

export type AuthMode = "sign-in" | "sign-up";

export type AuthIdentity = {
  id: string;
  email: string;
  fullName: string;
  plan: "Free" | "Pro";
  source: "supabase" | "local" | "guest";
};

export type AuthStep = "email" | "details";

export type BibleStudyModuleOption = {
  id: string;
  label: string;
  summary: string;
  categories: string[];
};

export type BibleLearningTrackStep = {
  id: string;
  label: string;
  summary: string;
  goal: string;
  promptStarter: string;
  moduleIds: string[];
};

export type BibleLearningTrack = {
  id: string;
  label: string;
  summary: string;
  assistantProfile: string;
  activeModules: string[];
  bibleStudyModules: string[];
  promptPacks: string[];
  preferredBibleCode: string;
  ministryFocus?: string;
  depthPreference?: string;
  steps: BibleLearningTrackStep[];
};

export type BibleLearningProgressEntry = {
  completedStepIds: string[];
  currentStepId?: string | null;
  updatedAt?: string | null;
};

export type BibleLearningProgressState = Record<string, BibleLearningProgressEntry>;
