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
  uploadName?: string | null;
  uploadNames?: string[];
  generatedImage?: GeneratedImage | null;
  generatedDocument?: GeneratedDocument | null;
  artifactPrompt?: string | null;
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
