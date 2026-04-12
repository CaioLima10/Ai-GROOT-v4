import { BibleMascotPanel } from "./BibleMascotPanel";

type BibleStudyHeroProps = {
  completionRate: number;
  depthPreference: string;
  medalHistory: string[];
  medalProgressLabel?: string | null;
  ministryFocus: string;
  mode: "idle" | "listening" | "speaking" | "celebrating";
  moduleCount: number;
  nextMedalLabel?: string | null;
  statusLabel?: string | null;
  stepLabel?: string | null;
  studyModeEnabled?: boolean;
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

export function BibleStudyHero({
  completionRate,
  depthPreference,
  medalHistory,
  medalProgressLabel = null,
  ministryFocus,
  mode,
  moduleCount,
  nextMedalLabel = null,
  statusLabel,
  stepLabel,
  studyModeEnabled = false,
  trackLabel,
  voiceEnabled = false,
}: BibleStudyHeroProps) {
  return (
    <div className="study-hero-stack">
      <BibleMascotPanel
        medalProgressLabel={medalProgressLabel}
        mode={mode}
        nextMedalLabel={nextMedalLabel}
        progressPercent={completionRate}
        statusLabel={statusLabel}
        stepLabel={stepLabel}
        studyModeEnabled={studyModeEnabled}
        trackLabel={trackLabel}
        variant="hero"
        voiceEnabled={voiceEnabled}
      />

      <div className="study-hero-grid" aria-label="Guia rapido da aba Fale Biblico">
        <article className="study-hero-card">
          <span className="study-hero-card-label">Fluxo</span>
          <strong>Trilha, conversa e revisao no mesmo lugar</strong>
          <p>O desktop pode mostrar objetivo, etapa atual e tutor ao mesmo tempo sem copiar a navegacao mobile.</p>
        </article>
        <article className="study-hero-card">
          <span className="study-hero-card-label">Configuracao</span>
          <strong>{formatDepthLabel(depthPreference)} + {formatMinistryLabel(ministryFocus)}</strong>
          <p>{moduleCount} modulos ativos para manter o estudo alinhado ao seu contexto de leitura.</p>
        </article>
        <article className="study-hero-card">
          <span className="study-hero-card-label">Proximo passo</span>
          <strong>{stepLabel || "Selecione uma etapa para iniciar"}</strong>
          <p>{nextMedalLabel ? `Proxima medalha: ${nextMedalLabel}.` : "Use os atalhos abaixo para abrir uma passagem, pedir exegese, montar um devocional ou entrar em voz."}</p>
          {medalProgressLabel || medalHistory.length > 0 ? (
            <div className="study-hero-medal-strip">
              {medalProgressLabel ? <span className="study-hero-medal-pill primary">{medalProgressLabel} medalhas</span> : null}
              {medalHistory.slice(0, 2).map((entry) => (
                <span key={entry} className="study-hero-medal-pill">{entry}</span>
              ))}
            </div>
          ) : null}
        </article>
      </div>
    </div>
  );
}
