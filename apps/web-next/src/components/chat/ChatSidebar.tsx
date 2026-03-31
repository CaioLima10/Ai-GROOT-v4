import { IconSidebar } from "./ChatIcons";
import type { AuthIdentity, ChatThread } from "./types";

type ChatSidebarProps = {
  activeThreadId: string;
  authUser: AuthIdentity;
  formatRelativeDate: (value: string) => string;
  getInitials: (identity: AuthIdentity | null) => string;
  getThreadSnippet: (thread: ChatThread) => string;
  onDeleteThread: (threadId: string) => void;
  onLogout: () => void;
  onNewChat: () => void;
  onSelectThread: (threadId: string) => void;
  onShowProfile: () => void;
  onToggleSidebar: () => void;
  onUpgrade: () => void;
  sidebarOpen: boolean;
  threads: ChatThread[];
};

export function ChatSidebar({
  activeThreadId,
  authUser,
  formatRelativeDate,
  getInitials,
  getThreadSnippet,
  onDeleteThread,
  onLogout,
  onNewChat,
  onSelectThread,
  onShowProfile,
  onToggleSidebar,
  onUpgrade,
  sidebarOpen,
  threads
}: ChatSidebarProps) {
  return (
    <aside id="sidebar" className="chatgpt-sidebar sidebar">
      <button
        type="button"
        className="sidebar-inline-toggle"
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? "Fechar sidebar" : "Abrir sidebar"}
        title={sidebarOpen ? "Fechar sidebar" : "Abrir sidebar"}
      >
        <IconSidebar />
      </button>

      <div className="sidebar-content">
        <button className="new-chat-btn" type="button" onClick={onNewChat}>
          + Novo chat
        </button>

        {authUser.source !== "guest" && (
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
                  x
                </button>
              </div>
            ))}
          </div>
        )}

        {authUser.source !== "guest" ? (
          <div className="profile-card">
            <button className="profile-open-btn" type="button" onClick={onShowProfile}>
              <div className="avatar">{getInitials(authUser)}</div>
              <div>
                <strong>{authUser.fullName}</strong>
                <small>
                  {authUser.plan} | {authUser.source === "supabase" ? "Cloud" : "Local"}
                </small>
              </div>
            </button>
            <button className="logout-btn" type="button" onClick={onLogout}>
              Sair
            </button>
          </div>
        ) : (
          <div className="guest-upgrade-card">
            <button type="button" className="guest-upgrade-btn" onClick={onUpgrade}>
              Upgrade
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
