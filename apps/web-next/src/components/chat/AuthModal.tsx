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
    <div className="modal-backdrop" onClick={onClose}>
      <section
        id="authModal"
        className="modal-card auth-modal-card"
        role="dialog"
        aria-label="Entrar ou criar conta"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="auth-modal-layout">
          <aside className="auth-panel-brand">
            <p className="auth-kicker">GIOM Workspace</p>
            <h2>Email first. Social sem atrito. Ferramentas prontas.</h2>
            <p className="auth-subtitle">
              O fluxo principal agora prioriza email com link ou codigo quando Supabase estiver ativo. Isso reduz friccao,
              evita senha fraca e fica mais proximo da experiencia do ChatGPT.
            </p>
            <ul className="auth-benefit-list">
              <li>Entrar por email em um passo</li>
              <li>Google e GitHub mantidos sem alterar a logica</li>
              <li>Fallback local com senha quando o auth cloud nao estiver ativo</li>
            </ul>
          </aside>

          <div className="auth-panel-form">
            <header className="modal-head auth-modal-head">
              <div>
                <h2>{authMode === "sign-in" ? "Entrar" : "Criar conta"}</h2>
                <p>{authSupportsMagicLink ? "Use email para receber acesso seguro." : "Ambiente local usando email e senha."}</p>
              </div>
              <button id="closeAuthModalBtn" type="button" onClick={onClose}>
                Fechar
              </button>
            </header>

            <div className="auth-tabs" aria-label="Modo de autenticacao">
              <button type="button" className={authMode === "sign-in" ? "active" : ""} onClick={() => onAuthModeChange("sign-in")}>
                Login
              </button>
              <button type="button" className={authMode === "sign-up" ? "active" : ""} onClick={() => onAuthModeChange("sign-up")}>
                Criar conta
              </button>
            </div>

            <form className="auth-form auth-form-modern" onSubmit={onSubmit}>
              <label>
                Email
                <input
                  type="email"
                  value={authEmail}
                  onChange={(event) => onEmailChange(event.target.value)}
                  placeholder="voce@empresa.com"
                  autoComplete="email"
                />
              </label>

              {authStep === "details" && authMode === "sign-up" && (
                <label>
                  Nome
                  <input
                    type="text"
                    value={authName}
                    onChange={(event) => onNameChange(event.target.value)}
                    placeholder="Como devo te chamar?"
                    autoComplete="name"
                  />
                </label>
              )}

              {authStep === "details" && !authSupportsMagicLink && (
                <label>
                  Senha
                  {authMode === "sign-in" ? (
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(event) => onPasswordChange(event.target.value)}
                      placeholder="Minimo 6 caracteres"
                      autoComplete="current-password"
                    />
                  ) : (
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(event) => onPasswordChange(event.target.value)}
                      placeholder="Minimo 6 caracteres"
                      autoComplete="new-password"
                    />
                  )}
                </label>
              )}

              <button type="submit" disabled={authLoading || oauthLoading !== null}>
                {authLoading
                  ? "Aguarde..."
                  : authStep === "email"
                    ? "Continuar com email"
                    : authSupportsMagicLink
                      ? authMode === "sign-in"
                        ? "Enviar link de acesso"
                        : "Enviar convite de acesso"
                      : authMode === "sign-in"
                        ? "Entrar"
                        : "Criar conta"}
              </button>

              {authStep === "details" && (
                <button type="button" className="auth-secondary-action" onClick={onResetEmailStep}>
                  Alterar email
                </button>
              )}
            </form>

            <div className="auth-divider">
              <span>ou</span>
            </div>

            <div className="auth-social-grid auth-social-grid-stack">
              <button
                type="button"
                className="oauth-btn"
                onClick={() => onOAuth("google")}
                disabled={!authSystemEnabled || oauthLoading !== null}
              >
                {oauthLoading === "google" ? "Conectando..." : "Continuar com Google"}
              </button>
              <button
                type="button"
                className="oauth-btn"
                onClick={() => onOAuth("github")}
                disabled={!authSystemEnabled || oauthLoading !== null}
              >
                {oauthLoading === "github" ? "Conectando..." : "Continuar com GitHub"}
              </button>
            </div>

            <button type="button" className="guest-btn" onClick={onContinueAsGuest}>
              Continuar anonimo
            </button>

            {authNotice && <p className="auth-notice">{authNotice}</p>}
            {authError && <p className="request-error auth-error">{authError}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
