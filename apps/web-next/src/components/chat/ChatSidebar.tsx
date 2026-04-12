import { useState, type ReactNode } from "react";
import { IconSidebar } from "./ChatIcons";
import type { AuthIdentity, ChatThread } from "./types";

type WorkspaceSurface = "chat" | "study";

type ChatSidebarProps = {
  activeThreadId: string;
  authUser: AuthIdentity;
  formatRelativeDate: (value: string) => string;
  getInitials: (identity: AuthIdentity | null) => string;
  getThreadSnippet: (thread: ChatThread) => string;
  onDeleteThread: (threadId: string) => void;
  onLogout: () => void;
  onNavigateBible: () => void;
  onNavigateChat: () => void;
  onNewChat: () => void;
  onSelectThread: (threadId: string) => void;
  onShowProfile: () => void;
  onToggleSidebar: () => void;
  onUpgrade: () => void;
  sidebarOpen: boolean;
  studyPanel?: ReactNode;
  surface: WorkspaceSurface;
  threads: ChatThread[];
};

const IconChat = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
  </svg>
);

const IconSearch = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" strokeLinecap="round" />
  </svg>
);

const IconImage = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-4.5-4.5L8 19" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconApps = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="4" y="4" width="6" height="6" rx="1.5" />
    <rect x="14" y="4" width="6" height="6" rx="1.5" />
    <rect x="4" y="14" width="6" height="6" rx="1.5" />
    <rect x="14" y="14" width="6" height="6" rx="1.5" />
  </svg>
);

const IconCompass = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2.4 6.4-6.6 2.6 2.6-6.6 6.4-2.4z" strokeLinejoin="round" />
  </svg>
);

const IconCode = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <path d="m8 16-4-4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m16 8 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconFolder = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z" strokeLinejoin="round" />
  </svg>
);

const IconSparkles = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" strokeLinejoin="round" />
  </svg>
);

const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinejoin="round" />
  </svg>
);

const IconHelp = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeLinecap="round" />
    <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" />
  </svg>
);

const IconLogout = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round" />
  </svg>
);

const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconChevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <polyline points="9 6 15 12 9 18" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconBrand = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M12 3.5c2.2-1.2 5 .2 5.4 2.7.1.7.7 1.3 1.4 1.5 2.4.6 3.5 3.5 2.1 5.5-.4.6-.4 1.4 0 2 1.4 2-.1 4.9-2.6 5.1-.7.1-1.3.5-1.6 1.2-1.1 2.3-4.3 2.9-6.2 1.1-.5-.5-1.3-.7-2-.4-2.3.9-4.8-.8-4.9-3.2 0-.7-.4-1.4-1-1.8-2-1.4-2.1-4.5-.2-6.1.6-.5.8-1.2.7-1.9-.3-2.5 1.8-4.6 4.3-4.3.7.1 1.4-.1 1.9-.7A4.2 4.2 0 0 1 12 3.5z" strokeLinejoin="round" />
    <path d="M9.8 8.6c1.2-1 3-1 4.2 0 1.2 1 1.5 2.7.7 4-.7 1.2-2.2 1.9-3.6 1.5-1.4-.3-2.5-1.5-2.7-2.9" strokeLinecap="round" />
  </svg>
);

export function ChatSidebar({
  activeThreadId,
  authUser,
  formatRelativeDate,
  getInitials,
  getThreadSnippet,
  onDeleteThread,
  onLogout,
  onNavigateBible,
  onNavigateChat,
  onNewChat,
  onSelectThread,
  onShowProfile,
  onToggleSidebar,
  onUpgrade,
  sidebarOpen,
  studyPanel,
  surface,
  threads
}: ChatSidebarProps) {
  const isGuest = authUser.source === "guest";
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const navItems = isGuest
    ? [
        { key: "new", label: "Novo chat", icon: <IconChat />, action: onNewChat },
        { key: "search", label: "Buscar em chats", icon: <IconSearch />, action: undefined },
        { key: "images", label: "Imagens", icon: <IconImage />, action: undefined }
      ]
    : [
        { key: "new", label: "Novo chat", icon: <IconChat />, action: onNewChat },
        { key: "search", label: "Buscar em chats", icon: <IconSearch />, action: undefined },
        { key: "images", label: "Imagens", icon: <IconImage />, action: undefined },
        { key: "apps", label: "Aplicativos", icon: <IconApps />, action: undefined },
        { key: "research", label: "Investigacao", icon: <IconCompass />, action: undefined },
        { key: "codex", label: "Codex", icon: <IconCode />, action: undefined },
        { key: "projects", label: "Projetos", icon: <IconFolder />, action: undefined }
      ];

  return (
    <aside id="sidebar" className="chatgpt-sidebar sidebar">
      <div className="sidebar-top-row">
        <button type="button" className="sidebar-brand-button" onClick={onNavigateChat} aria-label="Abrir chat principal">
          <IconBrand />
        </button>

        <button
          type="button"
          className="sidebar-inline-toggle"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? "Fechar sidebar" : "Abrir sidebar"}
          title={sidebarOpen ? "Fechar sidebar" : "Abrir sidebar"}
        >
          <IconSidebar />
        </button>
      </div>

      <div className="sidebar-content">
        <nav className="sidebar-nav sidebar-nav-primary" aria-label="Navegacao principal">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`sidebar-nav-item ${item.key === "new" && surface === "chat" ? "active" : ""}`}
              onClick={item.action}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}

          {!isGuest ? (
            <button
              type="button"
              className={`sidebar-nav-item sidebar-nav-study-entry ${surface === "study" ? "active" : ""}`}
              onClick={onNavigateBible}
            >
              <IconSparkles />
              <span>Fale Biblico</span>
            </button>
          ) : null}
        </nav>

        {surface === "study" && !isGuest ? (
          <div className="sidebar-study-surface">
            {studyPanel}
          </div>
        ) : null}

        {!isGuest && (
          <div className="history-section">
            <p className="history-section-label">Recentes</p>
            <div className="history-list">
              {threads.map((thread) => (
                <div key={thread.id} className={`history-item ${thread.id === activeThreadId ? "active" : ""}`}>
                  <button className="history-item-main" type="button" onClick={() => onSelectThread(thread.id)}>
                    <strong>{thread.title}</strong>
                    <p className="history-item-snippet">{getThreadSnippet(thread)}</p>
                    <small className="history-item-meta">
                      {formatRelativeDate(thread.updatedAt)} | {thread.messages.length} msgs
                    </small>
                  </button>
                  <button
                    className="history-item-delete"
                    type="button"
                    onClick={() => onDeleteThread(thread.id)}
                    aria-label={`Excluir conversa ${thread.title}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="sidebar-bottom">
          {isGuest ? (
            <>
              <div className="sidebar-bottom-links">
                <button type="button" className="sidebar-bottom-link" onClick={onUpgrade}>
                  <IconSparkles />
                  <span>Confira planos e precos</span>
                </button>
                <button type="button" className="sidebar-bottom-link" onClick={onShowProfile}>
                  <IconSettings />
                  <span>Configuracoes</span>
                </button>
                <button type="button" className="sidebar-bottom-link" disabled>
                  <IconHelp />
                  <span>Ajuda</span>
                </button>
              </div>
              <div className="guest-upgrade-card">
                <strong className="guest-upgrade-title">Receba respostas personalizadas para voce</strong>
                <p className="guest-upgrade-hint">
                  Entre para receber respostas com base em chats salvos, alem de criar imagens e carregar arquivos.
                </p>
                <button type="button" className="guest-upgrade-btn" onClick={onUpgrade}>
                  Entrar
                </button>
              </div>
            </>
          ) : (
            <>
              {String(authUser.plan || "").toLowerCase().includes("free") ? (
                <button type="button" className="sidebar-offer-btn" onClick={onUpgrade}>
                  <IconSparkles />
                  <span>Resgatar oferta</span>
                </button>
              ) : null}

              <div className={`sidebar-profile-menu ${profileMenuOpen ? "is-open" : ""}`}>
                {profileMenuOpen && (
                  <div className="sidebar-profile-dropdown" role="menu">
                    <button type="button" className="sidebar-profile-dropdown-item" role="menuitem" onClick={() => { setProfileMenuOpen(false); onShowProfile(); }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 20h9" strokeLinecap="round" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinejoin="round" /></svg>
                      <span>Personalizacao</span>
                    </button>
                    <button type="button" className="sidebar-profile-dropdown-item" role="menuitem" onClick={() => { setProfileMenuOpen(false); onShowProfile(); }}>
                      <IconUser />
                      <span>Perfil</span>
                    </button>
                    <button type="button" className="sidebar-profile-dropdown-item" role="menuitem" onClick={() => { setProfileMenuOpen(false); onShowProfile(); }}>
                      <IconSettings />
                      <span>Configuracoes</span>
                    </button>
                    <button type="button" className="sidebar-profile-dropdown-item" role="menuitem" disabled>
                      <IconHelp />
                      <span>Ajuda</span>
                      <span className="sidebar-profile-dropdown-trailing">
                        <IconChevronRight />
                      </span>
                    </button>
                    <div className="sidebar-profile-dropdown-divider" />
                    <button type="button" className="sidebar-profile-dropdown-item is-logout" role="menuitem" onClick={() => { setProfileMenuOpen(false); onLogout(); }}>
                      <IconLogout />
                      <span>Sair</span>
                    </button>
                  </div>
                )}
                <button
                  className="sidebar-profile-pill"
                  type="button"
                  onClick={() => setProfileMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                >
                  <div className="avatar">{getInitials(authUser)}</div>
                  <div className="sidebar-profile-pill-info">
                    <strong>{authUser.fullName}</strong>
                    <small>{authUser.plan}</small>
                  </div>
                  <span className={`sidebar-profile-chevron ${profileMenuOpen ? "is-open" : ""}`}>
                    <IconChevron />
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
