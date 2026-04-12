import type { EmailOtpType, SupabaseClient, User } from "@supabase/supabase-js";

import type { AuthIdentity } from "@/components/chat/types";

export type RuntimeAuthConfigLike = {
  supabaseUrl?: string | null;
  supabaseAnonKey?: string | null;
  features?: {
    auth?: boolean | null;
  };
};

export type LocalAuthAccount = {
  id: string;
  email: string;
  fullName: string;
  password: string;
};

const SCOPE_STORAGE_KEY = "giom-web-next-scope";
const LOCAL_AUTH_ACCOUNTS_KEY = "giom-web-next-auth-accounts";
const LOCAL_AUTH_SESSION_KEY = "giom-web-next-auth-session";
const SUPABASE_AUTH_SEARCH_KEYS = [
  "code",
  "error",
  "error_code",
  "error_description",
  "token_hash",
  "type"
] as const;
const SUPABASE_AUTH_HASH_KEYS = [
  "access_token",
  "expires_at",
  "expires_in",
  "provider_refresh_token",
  "provider_token",
  "refresh_token",
  "token_type",
  "type"
] as const;
const SUPABASE_EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "email",
  "email_change",
  "invite",
  "magiclink",
  "recovery",
  "signup"
]);

export const DEFAULT_CHAT_PATH = "/chat";
export const DEFAULT_STUDY_PATH = "/chat/bible";

export function makeBrowserId(prefix = "auth") {
  const uuid = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}-${uuid}`;
}

export function getScopeId() {
  if (typeof window === "undefined") {
    return "web-next-local";
  }

  const existing = window.localStorage.getItem(SCOPE_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created = makeBrowserId("scope");
  window.localStorage.setItem(SCOPE_STORAGE_KEY, created);
  return created;
}

export function normalizeEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}

export function createGuestIdentity(): AuthIdentity {
  return {
    id: getScopeId(),
    email: "guest@local",
    fullName: "Convidado",
    plan: "Free",
    source: "guest"
  };
}

export function mapSupabaseUser(user: User): AuthIdentity {
  const fullName = String(user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Usuario");

  return {
    id: user.id,
    email: String(user.email || ""),
    fullName,
    plan: "Free",
    source: "supabase"
  };
}

export function readLocalAccounts() {
  if (typeof window === "undefined") {
    return [] as LocalAuthAccount[];
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_AUTH_ACCOUNTS_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as LocalAuthAccount[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeLocalAccounts(accounts: LocalAuthAccount[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCAL_AUTH_ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function readLocalSession() {
  if (typeof window === "undefined") {
    return null as AuthIdentity | null;
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_AUTH_SESSION_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as AuthIdentity;
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
}

export function writeLocalSession(identity: AuthIdentity | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!identity) {
    window.localStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
    return;
  }

  window.localStorage.setItem(LOCAL_AUTH_SESSION_KEY, JSON.stringify(identity));
}

export function normalizeNextPath(value: string | null, fallback = DEFAULT_CHAT_PATH) {
  const trimmed = String(value || "").trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  return trimmed;
}

export function getWorkspaceEntryPath(pathname?: string | null) {
  return String(pathname || "").startsWith(DEFAULT_STUDY_PATH)
    ? DEFAULT_STUDY_PATH
    : DEFAULT_CHAT_PATH;
}

export function buildAbsoluteAuthRedirectUrl(nextPath: string) {
  if (typeof window === "undefined") {
    return undefined;
  }

  return new URL(nextPath, window.location.origin).toString();
}

export function isRuntimeAuthEnabled(config: RuntimeAuthConfigLike | null | undefined) {
  return Boolean(config?.features?.auth && config?.supabaseUrl && config?.supabaseAnonKey);
}

function normalizeOtpType(value: string | null) {
  const normalized = String(value || "").trim() as EmailOtpType;
  return SUPABASE_EMAIL_OTP_TYPES.has(normalized) ? normalized : null;
}

function cleanupSupabaseAuthUrl() {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  let changed = false;

  for (const key of SUPABASE_AUTH_SEARCH_KEYS) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }

  const rawHash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  if (rawHash) {
    const hashParams = new URLSearchParams(rawHash);

    for (const key of SUPABASE_AUTH_HASH_KEYS) {
      if (hashParams.has(key)) {
        hashParams.delete(key);
        changed = true;
      }
    }

    const nextHash = hashParams.toString();
    url.hash = nextHash ? `#${nextHash}` : "";
  }

  if (!changed) {
    return;
  }

  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export async function finalizeSupabaseAuthRedirect(client: SupabaseClient) {
  if (typeof window === "undefined") {
    return null as AuthIdentity | null;
  }

  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (code) {
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error) {
      throw error;
    }

    cleanupSupabaseAuthUrl();
    return data.session?.user ? mapSupabaseUser(data.session.user) : null;
  }

  const tokenHash = url.searchParams.get("token_hash");
  const otpType = normalizeOtpType(url.searchParams.get("type"));
  if (tokenHash && otpType) {
    const { data, error } = await client.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType
    });

    if (error) {
      throw error;
    }

    cleanupSupabaseAuthUrl();
    return data.user ? mapSupabaseUser(data.user) : null;
  }

  return null;
}

export async function resolveSupabaseIdentity(client: SupabaseClient) {
  const finalizedIdentity = await finalizeSupabaseAuthRedirect(client);
  if (finalizedIdentity) {
    return finalizedIdentity;
  }

  const {
    data: { session },
    error: sessionError
  } = await client.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (session?.user) {
    cleanupSupabaseAuthUrl();
    return mapSupabaseUser(session.user);
  }

  const { data, error } = await client.auth.getUser();
  if (error) {
    throw error;
  }

  cleanupSupabaseAuthUrl();
  return data.user ? mapSupabaseUser(data.user) : null;
}
