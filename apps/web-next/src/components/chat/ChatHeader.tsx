import { IconSidebar } from "./ChatIcons";
import type { AuthIdentity, AuthMode } from "./types";

type ChatHeaderProps = {
  authUser: AuthIdentity;
  getInitials: (identity: AuthIdentity | null) => string;
  onHeaderAuthAction: (mode: AuthMode) => void;
  onNewChat: () => void;
  onShowProfile: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
};

export function ChatHeader({
  authUser,
  getInitials,
  onHeaderAuthAction,
  onNewChat,
  onShowProfile,
  onToggleSidebar,
  sidebarOpen
}: ChatHeaderProps) {
  return (
    <header className="top-status">
      <div className="top-status-left">
        <button
          id="mobileMenuBtn"
          type="button"
          className="sidebar-toggle-mobile"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? "Fechar sidebar" : "Abrir sidebar"}
          title={sidebarOpen ? "Fechar sidebar" : "Abrir sidebar"}
        >
          <IconSidebar />
        </button>
        {sidebarOpen ? (
          <span className="top-status-title">GIOM GPT</span>
        ) : (
          <div className="sidebar-collapsed-bar" aria-label="Controles com sidebar fechada">
            <span className="sidebar-collapsed-logo">GIOM</span>
            <button type="button" className="sidebar-collapsed-new" onClick={onNewChat}>
              + Novo chat
            </button>
            <button
              type="button"
              className="sidebar-collapsed-open"
              onClick={onToggleSidebar}
              aria-label="Abrir sidebar"
              title="Abrir sidebar"
            >
              <IconSidebar />
            </button>
          </div>
        )}
      </div>
      {authUser.source === "guest" ? (
        <div className="top-status-actions" aria-label="Acoes de autenticacao">
          <button id="topAuthLoginBtn" type="button" className="top-auth-login" onClick={() => onHeaderAuthAction("sign-in")}>
            Login
          </button>
          <button id="topAuthSignupBtn" type="button" className="top-auth-signup" onClick={() => onHeaderAuthAction("sign-up")}>
            Inscreva-se
          </button>
        </div>
      ) : (
        <button type="button" className="top-profile-pill" onClick={onShowProfile}>
          <span className="avatar">{getInitials(authUser)}</span>
          <span>{authUser.fullName}</span>
        </button>
      )}
    </header>
  );
}
