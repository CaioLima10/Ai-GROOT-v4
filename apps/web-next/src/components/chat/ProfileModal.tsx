import type { AuthIdentity } from "./types";

type ProfileModalProps = {
  authUser: AuthIdentity;
  documentsUsed: number;
  getInitials: (identity: AuthIdentity | null) => string;
  imagesUsed: number;
  limits: {
    documents: number;
    images: number;
    messages: number;
  };
  messagesUsed: number;
  onClose: () => void;
  onUpgrade: () => void;
  open: boolean;
};

export function ProfileModal({
  authUser,
  documentsUsed,
  getInitials,
  imagesUsed,
  limits,
  messagesUsed,
  onClose,
  onUpgrade,
  open
}: ProfileModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="profile-backdrop" onClick={onClose}>
      <aside className="profile-sheet" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>Perfil</h2>
          <button type="button" onClick={onClose}>
            Fechar
          </button>
        </header>

        <div className="profile-id">
          <div className="avatar large">{getInitials(authUser)}</div>
          <div>
            <strong>{authUser.fullName}</strong>
            <small>{authUser.email}</small>
          </div>
        </div>

        <div className="profile-plan">
          <strong>Plano atual: {authUser.plan}</strong>
          <small>{authUser.source === "guest" ? "Visitante limitado" : "Conta autenticada"}</small>
        </div>

        <div className="usage-grid">
          <article>
            <h4>Mensagens hoje</h4>
            <p>
              {messagesUsed}/{Number.isFinite(limits.messages) ? limits.messages : "infinito"}
            </p>
          </article>
          <article>
            <h4>Imagens hoje</h4>
            <p>
              {imagesUsed}/{Number.isFinite(limits.images) ? limits.images : "infinito"}
            </p>
          </article>
          <article>
            <h4>Documentos hoje</h4>
            <p>
              {documentsUsed}/{Number.isFinite(limits.documents) ? limits.documents : "infinito"}
            </p>
          </article>
        </div>

        <button type="button" className="upgrade-btn" onClick={onUpgrade}>
          Upgrade para Pro
        </button>
      </aside>
    </div>
  );
}
