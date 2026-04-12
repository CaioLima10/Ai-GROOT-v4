import type { AuthIdentity } from "./types";

const SETTINGS_SECTIONS = [
  "Geral",
  "Notificacoes",
  "Personalizacao",
  "Aplicativos",
  "Controlar dados",
  "Seguranca",
  "Controles parentais",
  "Conta"
];

const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
    <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
  </svg>
);

type VoiceOption = {
  id: string;
  label: string;
  summary?: string;
  tone?: string;
};

type StudyMedalHistoryItem = {
  id: string;
  medalLabel: string;
  stepLabel: string;
  trackLabel: string;
};

type StudyMedalSummary = {
  unlocked: number;
  total: number;
  activeTrackLabel: string | null;
  activeTrackUnlocked: number;
  activeTrackTotal: number;
  nextLabel: string | null;
};

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
  onPreviewVoicePersona: () => void;
  onSpeakerEnabledChange: (enabled: boolean) => void;
  onStopVoicePreview: () => void;
  onUpgrade: () => void;
  onVoicePersonaChange: (voicePersona: string) => void;
  open: boolean;
  resolvedVoiceLabel: string;
  speakerEnabled: boolean;
  speakerSupported: boolean;
  studyMedalHistory: StudyMedalHistoryItem[];
  studyMedalSummary: StudyMedalSummary;
  voicePreviewActive: boolean;
  selectedVoicePersona: string;
  voicePersonaOptions: VoiceOption[];
};

export function ProfileModal({
  authUser,
  documentsUsed,
  getInitials,
  imagesUsed,
  limits,
  messagesUsed,
  onClose,
  onPreviewVoicePersona,
  onSpeakerEnabledChange,
  onStopVoicePreview,
  onUpgrade,
  onVoicePersonaChange,
  open,
  resolvedVoiceLabel,
  speakerEnabled,
  speakerSupported,
  studyMedalHistory,
  studyMedalSummary,
  voicePreviewActive,
  selectedVoicePersona,
  voicePersonaOptions
}: ProfileModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="profile-backdrop" onClick={onClose}>
      <aside className="settings-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="settings-layout">
          <nav className="settings-sidebar" aria-label="Navegacao das configuracoes">
            <button type="button" className="settings-close-btn" onClick={onClose} aria-label="Fechar configuracoes">
              <IconClose />
            </button>
            <div className="settings-nav-list">
              {SETTINGS_SECTIONS.map((section, index) => (
                <button
                  key={section}
                  type="button"
                  className={`settings-nav-item ${index === 0 ? "active" : ""}`}
                >
                  <span>{section}</span>
                </button>
              ))}
            </div>
          </nav>

          <section className="settings-content">
            <header className="settings-content-head">
              <h2>Geral</h2>
            </header>

            <article className="settings-security-card">
              <div>
                <strong>Proteja sua conta</strong>
                <p>Adicione uma autenticacao multifatorial para ajudar a proteger sua conta ao entrar.</p>
              </div>
              <button type="button" className="settings-outline-btn">Configurar MFA</button>
            </article>

            <div className="settings-row-list">
              <div className="settings-row">
                <span>Aparencia</span>
                <strong>Sistema</strong>
              </div>
              <div className="settings-row">
                <span>Cor de enfase</span>
                <strong>Padrao</strong>
              </div>
              <div className="settings-row">
                <span>Idioma</span>
                <strong>Autodetectar</strong>
              </div>
              <div className="settings-row settings-row-multiline">
                <div>
                  <span>Linguagem falada</span>
                  <small>Para obter melhores resultados, selecione o idioma principal que voce fala.</small>
                </div>
                <strong>Autodetectar</strong>
              </div>
            </div>

            <section className="voice-settings voice-settings-chatgpt">
              <div className="voice-settings-head">
                <div>
                  <h3>Voz</h3>
                  <p>Somente visualmente alinhado com a experiencia de configuracoes da referencia.</p>
                </div>

                <label className="voice-toggle">
                  <input
                    type="checkbox"
                    checked={speakerEnabled}
                    disabled={!speakerSupported}
                    onChange={(event) => onSpeakerEnabledChange(event.target.checked)}
                  />
                  <span>Responder em voz alta</span>
                </label>
              </div>

              <div className="voice-persona-grid" role="radiogroup" aria-label="Persona de voz da IA">
                {voicePersonaOptions.map((option) => {
                  const active = selectedVoicePersona === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`voice-persona-card ${active ? "active" : ""}`}
                      onClick={() => onVoicePersonaChange(option.id)}
                      data-active={active ? "true" : "false"}
                    >
                      <strong>{option.label}</strong>
                      {option.tone ? <small>{option.tone}</small> : null}
                      {option.summary ? <span>{option.summary}</span> : null}
                    </button>
                  );
                })}
              </div>

              <label className="voice-select-field">
                <span>Voz resolvida neste dispositivo</span>
                <div className="voice-select-readonly">{resolvedVoiceLabel}</div>
              </label>

              <div className="voice-preview-actions">
                <button
                  type="button"
                  className="voice-preview-btn"
                  onClick={voicePreviewActive ? onStopVoicePreview : onPreviewVoicePersona}
                  disabled={!speakerSupported}
                >
                  {voicePreviewActive ? "Parar amostra" : "Ouvir amostra da voz"}
                </button>
              </div>
            </section>

            <section className="study-achievements-card" aria-label="Medalhas do Fale Biblico">
              <div className="study-achievements-head">
                <div>
                  <h3>Medalhas do Fale Biblico</h3>
                  <p>Resumo persistente da trilha ativa e historico recente dos checkpoints concluidos.</p>
                </div>
              </div>

              <div className="study-achievements-grid">
                <article className="study-achievement-tile">
                  <span>Total liberado</span>
                  <strong>{studyMedalSummary.unlocked}/{studyMedalSummary.total}</strong>
                </article>
                <article className="study-achievement-tile">
                  <span>{studyMedalSummary.activeTrackLabel ? "Trilha ativa" : "Trilha"}</span>
                  <strong>
                    {studyMedalSummary.activeTrackLabel
                      ? `${studyMedalSummary.activeTrackUnlocked}/${studyMedalSummary.activeTrackTotal}`
                      : "Nenhuma"}
                  </strong>
                </article>
                <article className="study-achievement-tile highlight">
                  <span>Proxima medalha</span>
                  <strong>{studyMedalSummary.nextLabel || "Colecao completa"}</strong>
                </article>
              </div>

              <div className="study-achievement-history">
                {studyMedalHistory.length > 0 ? (
                  studyMedalHistory.map((medal) => (
                    <article key={medal.id} className="study-achievement-row">
                      <div>
                        <strong>{medal.medalLabel}</strong>
                        <span>{medal.trackLabel}</span>
                      </div>
                      <small>{medal.stepLabel}</small>
                    </article>
                  ))
                ) : (
                  <p className="study-achievement-empty">Conclua checkpoints no mapa para montar seu historico de blocos.</p>
                )}
              </div>
            </section>

            <div className="settings-account-footer">
              <div className="profile-id">
                <div className="avatar large">{getInitials(authUser)}</div>
                <div>
                  <strong>{authUser.fullName}</strong>
                  <small>{authUser.email}</small>
                </div>
              </div>

              <div className="usage-grid">
                <article>
                  <h4>Mensagens</h4>
                  <p>{messagesUsed}/{Number.isFinite(limits.messages) ? limits.messages : "infinito"}</p>
                </article>
                <article>
                  <h4>Imagens</h4>
                  <p>{imagesUsed}/{Number.isFinite(limits.images) ? limits.images : "infinito"}</p>
                </article>
                <article>
                  <h4>Documentos</h4>
                  <p>{documentsUsed}/{Number.isFinite(limits.documents) ? limits.documents : "infinito"}</p>
                </article>
              </div>

              <button type="button" className="upgrade-btn" onClick={onUpgrade}>
                Upgrade para Pro
              </button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
