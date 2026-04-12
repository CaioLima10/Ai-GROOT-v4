import type { Provider } from "@supabase/supabase-js";
import type { FormEvent } from "react";
import type { AuthMode, AuthStep } from "./types";

type AuthModalProps = {
  authEmail: string;
  authError: string | null;
  authLoading: boolean;
  authMode: AuthMode;
  authName: string;
  authNotice: string | null;
  authPassword: string;
  authStep: AuthStep;
  authSupportsMagicLink: boolean;
  authSystemEnabled: boolean;
  oauthLoading: Provider | null;
  onAuthModeChange: (mode: AuthMode) => void;
  onClose: () => void;
  onContinueAsGuest: () => void;
  onEmailChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onOAuth: (provider: Provider) => void;
  onPasswordChange: (value: string) => void;
  onResetEmailStep: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  open: boolean;
};

const IconClose = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
    <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
  </svg>
);

const IconGoogle = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const IconApple = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16.37 12.84c-.02-2.23 1.83-3.3 1.91-3.35-1.04-1.52-2.65-1.72-3.22-1.74-1.37-.15-2.68.81-3.37.81-.7 0-1.78-.79-2.93-.77-1.51.02-2.91.88-3.69 2.24-1.58 2.73-.4 6.77 1.13 8.97.75 1.07 1.64 2.28 2.8 2.24 1.12-.05 1.54-.72 2.89-.72 1.35 0 1.73.72 2.91.69 1.2-.02 1.96-1.08 2.7-2.16.86-1.25 1.22-2.46 1.24-2.52-.03-.01-2.36-.91-2.37-3.69zM14.17 6.31c.62-.75 1.03-1.78.92-2.81-.89.04-1.97.59-2.61 1.34-.57.67-1.08 1.74-.94 2.77.99.08 2-.5 2.63-1.3z" />
  </svg>
);

const IconPhone = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.88.33 1.75.62 2.58a2 2 0 0 1-.45 2.11L8 9.68a16 16 0 0 0 6.32 6.32l1.27-1.28a2 2 0 0 1 2.11-.45c.83.29 1.7.5 2.58.62A2 2 0 0 1 22 16.92z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function AuthModal({
  authEmail,
  authError,
  authLoading,
  authMode,
  authName,
  authNotice,
  authPassword,
  authStep,
  authSupportsMagicLink,
  authSystemEnabled,
  oauthLoading,
  onAuthModeChange,
  onClose,
  onContinueAsGuest,
  onEmailChange,
  onNameChange,
  onOAuth,
  onPasswordChange,
  onResetEmailStep,
  onSubmit,
  open
}: AuthModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div
        className="auth-centered-modal"
        role="dialog"
        aria-label="Entrar ou cadastrar-se"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="auth-close-btn" onClick={onClose} aria-label="Fechar">
          <IconClose />
        </button>

        <h2 className="auth-centered-title">Entrar ou cadastrar-se</h2>
        <p className="auth-centered-subtitle">
          Voce vai poder aproveitar respostas inteligentes e, alem disso, carregar imagens, arquivos e muito mais.
        </p>

        {/* Social buttons */}
        <div className="auth-centered-social">
          <button
            type="button"
            className="auth-social-btn"
            onClick={() => onOAuth("google")}
            disabled={!authSystemEnabled || oauthLoading !== null}
          >
            <IconGoogle />
            <span>{oauthLoading === "google" ? "Conectando..." : "Continuar com o Google"}</span>
          </button>
          <button type="button" className="auth-social-btn auth-social-btn-static">
            <IconApple />
            <span>Continuar com a Apple</span>
          </button>
          <button type="button" className="auth-social-btn auth-social-btn-static">
            <IconPhone />
            <span>Continuar com o telefone</span>
          </button>
        </div>

        {/* Divider */}
        <div className="auth-centered-divider">
          <span>OU</span>
        </div>

        {/* Email form */}
        <form className="auth-centered-form" onSubmit={onSubmit}>
          <input
            type="email"
            className="auth-centered-input"
            value={authEmail}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="Endereco de e-mail"
          />

          {authStep === "details" && authMode === "sign-up" && (
            <input
              type="text"
              className="auth-centered-input"
              value={authName}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Como devo te chamar?"
            />
          )}

          {authStep === "details" && !authSupportsMagicLink && (
            <input
              type="password"
              className="auth-centered-input"
              value={authPassword}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="Senha"
            />
          )}

          <button type="submit" className="auth-centered-submit" disabled={authLoading || oauthLoading !== null}>
            {authLoading ? "Aguarde..." : "Continuar"}
          </button>

          {authStep === "details" && (
            <button type="button" className="auth-centered-back" onClick={onResetEmailStep}>
              Alterar email
            </button>
          )}
        </form>

        {authNotice && <p className="auth-notice">{authNotice}</p>}
        {authError && <p className="request-error auth-error">{authError}</p>}

        <p className="auth-centered-footer">
          Ao enviar mensagens para o ChatGPT, voce aceita nossos Termos e reconhece nossa Politica de Privacidade.
        </p>
      </div>
    </div>
  );
}
