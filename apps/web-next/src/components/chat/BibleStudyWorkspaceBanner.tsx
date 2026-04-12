type BibleStudyWorkspaceBannerProps = {
  completionRate: number;
  depthPreference: string;
  medalProgressLabel?: string | null;
  ministryFocus: string;
  moduleCount: number;
  nextMedalLabel?: string | null;
  statusLabel?: string | null;
  stepGoal?: string | null;
  stepLabel?: string | null;
  trackLabel?: string | null;
  voiceEnabled?: boolean;
};

function formatDepthLabel(value: string) {
  if (value === "advanced") return "Avancado";
  if (value === "beginner") return "Didatico";
  return "Equilibrado";
}

function formatMinistryLabel(value: string) {
  if (value === "new_believers") return "Novos convertidos";
  if (value === "teaching") return "Ensino e aula";
  if (value === "preaching") return "Pregacao";
  return "Leitura geral";
}

export function BibleStudyWorkspaceBanner({
  completionRate,
  depthPreference,
  medalProgressLabel = null,
  ministryFocus,
  moduleCount,
  nextMedalLabel = null,
  statusLabel,
  stepGoal,
  stepLabel,
  trackLabel,
  voiceEnabled = false,
}: BibleStudyWorkspaceBannerProps) {
  return (
    <section className="study-workspace-banner" aria-label="Resumo do workspace Fale Biblico">
      <div className="study-workspace-copy">
        <div className="study-workspace-kicker-row">
          <span className="study-workspace-kicker">Fale Biblico</span>
          <span className="study-workspace-pill">{voiceEnabled ? "Voz ativa" : "Texto guiado"}</span>
        </div>

        <div className="study-workspace-heading">
          <h2>{trackLabel ? `Trilha ${trackLabel}` : "Workspace de leitura e conversa biblica"}</h2>
          <p>{statusLabel || "Escolha uma etapa, converse com o tutor e mantenha o progresso visivel no desktop."}</p>
        </div>

        <div className="study-workspace-stat-row">
          <article className="study-workspace-stat">
            <strong>{completionRate}%</strong>
            <span>progresso</span>
          </article>
          <article className="study-workspace-stat">
            <strong>{moduleCount}</strong>
            <span>modulos ativos</span>
          </article>
          <article className="study-workspace-stat">
            <strong>{formatDepthLabel(depthPreference)}</strong>
            <span>profundidade</span>
          </article>
          <article className="study-workspace-stat">
            <strong>{formatMinistryLabel(ministryFocus)}</strong>
            <span>contexto</span>
          </article>
          {medalProgressLabel ? (
            <article className="study-workspace-stat medal">
              <strong>{medalProgressLabel}</strong>
              <span>medalhas</span>
            </article>
          ) : null}
        </div>
      </div>

      <div className="study-workspace-lane">
        <div className="study-workspace-step-card">
          <span className="study-workspace-step-label">Etapa atual</span>
          <strong>{stepLabel || "Escolha a proxima etapa"}</strong>
          <p>{stepGoal || "O tutor vai manter contexto, progresso e pratica em um fluxo unico para leitura biblica."}</p>
          {nextMedalLabel ? <small className="study-workspace-step-meta">Proxima medalha: {nextMedalLabel}</small> : null}
        </div>

        <div className="study-workspace-avatar" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- local branding asset */}
          <img src="/branding/fale-biblico/sprites/poses/study-chat.png" alt="" />
        </div>
      </div>
    </section>
  );
}
