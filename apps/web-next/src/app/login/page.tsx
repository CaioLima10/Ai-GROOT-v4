"use client";

import { createClient, type Provider, type SupabaseClient } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AuthModal } from "@/components/chat/AuthModal";
import type { AuthMode, AuthStep } from "@/components/chat/types";
import {
  buildAbsoluteAuthRedirectUrl,
  createGuestIdentity,
  isRuntimeAuthEnabled,
  makeBrowserId,
  mapSupabaseUser,
  normalizeEmail,
  normalizeNextPath,
  readLocalAccounts,
  readLocalSession,
  resolveSupabaseIdentity,
  writeLocalAccounts,
  writeLocalSession,
  type LocalAuthAccount
} from "@/lib/authSession";
import { resilientFetch } from "@/lib/resilientFetch";
import { parseRuntimeConfigPayload } from "@groot/shared-config/src/runtimeSchemas.js";

type RuntimeConfig = {
  supabaseUrl?: string | null;
  supabaseAnonKey?: string | null;
  features?: {
    auth?: boolean;
  };
};

function LoginPageFallback() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="auth-kicker">GIOM Workspace</p>
        <h1>Carregando autenticacao...</h1>
        <p className="auth-subtitle">Preparando o fluxo de entrada separado da area de chat.</p>
      </section>
    </main>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [configReady, setConfigReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [authStep, setAuthStep] = useState<AuthStep>("email");
  const [authLoading, setAuthLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<Provider | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const supabaseRef = useRef<SupabaseClient | null>(null);

  const nextPath = useMemo(
    () => normalizeNextPath(searchParams.get("next")),
    [searchParams]
  );
  const redirectTarget = useMemo(() => buildAbsoluteAuthRedirectUrl(nextPath), [nextPath]);
  const authSupportsMagicLink = isRuntimeAuthEnabled(config);

  useEffect(() => {
    const routeMode = searchParams.get("mode") === "sign-up" ? "sign-up" : "sign-in";
    setAuthMode(routeMode);
    setAuthStep("email");
    setAuthError(null);
    setAuthNotice(null);
    setAuthPassword("");
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    void resilientFetch("/backend/config", {
      method: "GET",
      timeoutMs: 5_000,
      forceRetry: false
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("config_unavailable");
        }

        return await response.json();
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setConfig(parseRuntimeConfigPayload(payload) as RuntimeConfig);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setConfig(null);
      })
      .finally(() => {
        if (!cancelled) {
          setConfigReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!configReady) {
      return;
    }

    const localSession = readLocalSession();
    const authEnabled = isRuntimeAuthEnabled(config);

    if (!authEnabled && localSession && localSession.source !== "guest") {
      router.replace(nextPath);
      return;
    }

    if (!authEnabled) {
      return;
    }

    const client = createClient(String(config?.supabaseUrl), String(config?.supabaseAnonKey), {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true
      }
    });
    supabaseRef.current = client;

    void resolveSupabaseIdentity(client)
      .then((identity) => {
        if (identity) {
          writeLocalSession(identity);
          router.replace(nextPath);
          return;
        }

        if (localSession?.source === "supabase") {
          writeLocalSession(null);
        }
      })
      .catch(() => undefined);

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        writeLocalSession(mapSupabaseUser(session.user));
        router.replace(nextPath);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [config, configReady, nextPath, router]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authLoading) {
      return;
    }

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
            emailRedirectTo: redirectTarget,
            data: {
              full_name: displayName || email
            }
          }
        });

        if (error) {
          throw error;
        }

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
            id: makeBrowserId("local-user"),
            email,
            fullName: displayName || email,
            password
          };
          writeLocalAccounts([created, ...accounts]);

          writeLocalSession({
            id: created.id,
            email: created.email,
            fullName: created.fullName,
            plan: "Free",
            source: "local"
          });
          router.replace(nextPath);
        } else {
          const account = accounts.find((item) => item.email === email && item.password === password);
          if (!account) {
            throw new Error("Credenciais invalidas para modo local.");
          }

          writeLocalSession({
            id: account.id,
            email: account.email,
            fullName: account.fullName,
            plan: "Free",
            source: "local"
          });
          router.replace(nextPath);
        }
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Falha de autenticacao.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleOAuth(provider: Provider) {
    if (oauthLoading) {
      return;
    }

    const supabase = supabaseRef.current;
    if (!supabase) {
      setAuthError("OAuth exige Supabase ativo no backend.");
      return;
    }

    setAuthError(null);
    setOauthLoading(provider);

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectTarget
      }
    });

    if (error) {
      setAuthError(error.message || "Falha ao iniciar login social.");
      setOauthLoading(null);
    }
  }

  function continueAsGuest() {
    writeLocalSession(createGuestIdentity());
    router.replace(nextPath);
  }

  function handleAuthModeChange(mode: AuthMode) {
    setAuthMode(mode);
    setAuthStep("email");
    setAuthError(null);
    setAuthNotice(null);
    setAuthPassword("");
    router.replace(`/login?mode=${mode}&next=${encodeURIComponent(nextPath)}`);
  }

  if (!configReady) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <p className="auth-kicker">GIOM Workspace</p>
          <h1>Carregando autenticacao...</h1>
          <p className="auth-subtitle">Preparando o fluxo de entrada separado da area de chat.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
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
        onAuthModeChange={handleAuthModeChange}
        onClose={() => router.replace(nextPath)}
        onContinueAsGuest={continueAsGuest}
        onEmailChange={setAuthEmail}
        onNameChange={setAuthName}
        onOAuth={(provider) => void handleOAuth(provider)}
        onPasswordChange={setAuthPassword}
        onResetEmailStep={() => setAuthStep("email")}
        onSubmit={submitAuth}
        open
      />
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
