import { IconSidebar } from "./ChatIcons";
import type { AuthIdentity, AuthMode } from "./types";

type WorkspaceSurface = "chat" | "study";

type ChatHeaderProps = {
  authUser: AuthIdentity;
  getInitials: (identity: AuthIdentity | null) => string;
  onHeaderAuthAction: (mode: AuthMode) => void;
  onNewChat: () => void;
  onShowProfile: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  surface: WorkspaceSurface;
  surfaceLabel?: string;
};

const IconPencil = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <path d="M12 20h9" strokeLinecap="round" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" strokeLinejoin="round" />
  </svg>
);

const IconChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconInvite = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="9" cy="7" r="4" />
    <path d="M19 8v6" strokeLinecap="round" />
    <path d="M22 11h-6" strokeLinecap="round" />
  </svg>
);

const IconMessageBubble = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.3 8.3 0 0 1-3.44-.73L3 21l1.75-5.26A8.5 8.5 0 1 1 21 11.5z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function ChatHeader({
  authUser,
  getInitials,
  onHeaderAuthAction,
  onNewChat,
  onShowProfile,
  onToggleSidebar,
  sidebarOpen,
  surface,
  surfaceLabel
}: ChatHeaderProps) {
  const title = surfaceLabel || (surface === "study" ? "ChatGPT" : "ChatGPT");

  return (
    <header className="top-status">
      <div className="top-status-left">
        {sidebarOpen ? (
          <button type="button" className="top-status-model" aria-label="Selecionar workspace">
            <span className="top-status-title">{title}</span>
            <IconChevronDown />
          </button>
        ) : (
          <div className="sidebar-collapsed-bar" aria-label="Controles com sidebar fechada">
            <button
              type="button"
              className="sidebar-collapsed-open"
              onClick={onToggleSidebar}
              aria-label="Abrir sidebar"
              title="Abrir sidebar"
            >
              <IconSidebar />
            </button>
            <button type="button" className="top-status-model sidebar-collapsed-model" aria-label="Selecionar workspace">
              <span className="sidebar-collapsed-logo">{title}</span>
              <IconChevronDown />
            </button>
            <button
              type="button"
              className="sidebar-collapsed-new"
              onClick={onNewChat}
              title="Novo chat"
            >
              <IconPencil />
            </button>
          </div>
        )}
      </div>

      {authUser.source === "guest" ? (
        <div className="top-status-actions" aria-label="Acoes de autenticacao">
          <button id="topAuthLoginBtn" type="button" className="top-auth-login" onClick={() => onHeaderAuthAction("sign-in")}>
            Entrar
          </button>
          <button id="topAuthSignupBtn" type="button" className="top-auth-signup" onClick={() => onHeaderAuthAction("sign-up")}>
            Cadastre-se gratuitamente
          </button>
        </div>
      ) : (
        <div className="top-utility-bar" aria-label="Ferramentas do workspace">
          <button type="button" className="top-utility-btn" onClick={onShowProfile} aria-label="Convidar colaborador">
            <IconInvite />
          </button>
          <button type="button" className="top-utility-btn" onClick={onShowProfile} aria-label="Abrir perfil e configuracoes">
            <IconMessageBubble />
          </button>
          <button type="button" className="top-profile-pill" onClick={onShowProfile} aria-label="Perfil">
            <span className="avatar">{getInitials(authUser)}</span>
          </button>
        </div>
      )}
    </header>
  );
}
