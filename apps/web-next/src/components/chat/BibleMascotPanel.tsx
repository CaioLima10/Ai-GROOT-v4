type BibleMascotMode = "idle" | "listening" | "speaking" | "celebrating";

type BibleMascotPanelProps = {
  medalProgressLabel?: string | null;
  nextMedalLabel?: string | null;
  mode: BibleMascotMode;
  progressPercent: number;
  statusLabel?: string | null;
  stepLabel?: string | null;
  studyModeEnabled?: boolean;
  trackLabel?: string | null;
  variant?: "compact" | "hero";
  voiceEnabled?: boolean;
};

type MascotContent = {
  badge: string;
  body: string;
  sprite: string;
  title: string;
};

const MASCOT_CONTENT: Record<BibleMascotMode, MascotContent> = {
  idle: {
    badge: "Pronto",
    title: "Seu tutor esta pronto para abrir a proxima etapa",
    body: "Ative uma trilha, escolha uma etapa do mapa e use o mascote para manter o estudo claro e constante.",
    sprite: "/branding/fale-biblico/sprites/hero/scribe-default.png",
  },
  listening: {
    badge: "Ouvindo",
    title: "O mascote entrou no modo de escuta e acompanhamento",
    body: "A conversa por voz esta captando sua pratica e o tutor fica atento ao que voce acabou de dizer.",
    sprite: "/branding/fale-biblico/sprites/poses/study-chat.png",
  },
  speaking: {
    badge: "Falando",
    title: "O tutor esta respondendo em tempo real",
    body: "Use este estado para conversa guiada, repeticao, leitura em voz alta e pratica com retorno imediato.",
    sprite: "/branding/fale-biblico/sprites/lipsync/ai-extended.png",
  },
  celebrating: {
    badge: "Concluido",
    title: "Mais uma etapa foi vencida na trilha biblica",
    body: "A celebracao reforca progresso visivel, medalha liberada e ritmo constante de estudo.",
    sprite: "/branding/fale-biblico/sprites/poses/thumbs-up.png",
  },
};

function buildProgressLabel(progressPercent: number, studyModeEnabled: boolean) {
  if (progressPercent > 0) {
    return `${progressPercent}% da trilha concluido`;
  }

  if (studyModeEnabled) {
    return "Trilha ativa agora";
  }

  return "Escolha uma trilha para comecar";
}

export function BibleMascotPanel({
  medalProgressLabel = null,
  nextMedalLabel = null,
  mode,
  progressPercent,
  statusLabel,
  stepLabel,
  studyModeEnabled = false,
  trackLabel,
  variant = "compact",
  voiceEnabled = false,
}: BibleMascotPanelProps) {
  const content = MASCOT_CONTENT[mode];
  const chips = [
    buildProgressLabel(progressPercent, studyModeEnabled),
    trackLabel ? `Trilha: ${trackLabel}` : "",
    stepLabel ? `Etapa: ${stepLabel}` : "",
    medalProgressLabel ? `Medalhas: ${medalProgressLabel}` : "",
    nextMedalLabel ? `Proxima: ${nextMedalLabel}` : "",
    voiceEnabled ? "Voz pronta" : "Texto guiado",
  ].filter(Boolean);

  return (
    <section
      className={`study-mascot-card ${variant}`}
      data-mode={mode}
      aria-label={`Mascote do Fale Biblico em estado ${content.badge}`}
    >
      <div className="study-mascot-copy">
        <span className="study-mascot-badge">{content.badge}</span>
        <div className="study-mascot-heading">
          <h2 className="study-mascot-title">{content.title}</h2>
          <p className="study-mascot-body">{content.body}</p>
        </div>

        <div className="study-mascot-chip-row">
          {chips.map((chip) => (
            <span key={chip} className={`study-mascot-chip ${chip.startsWith("Medalhas:") || chip.startsWith("Proxima:") ? "medal" : ""}`}>
              {chip}
            </span>
          ))}
        </div>

        {statusLabel ? <p className="study-mascot-status">{statusLabel}</p> : null}
      </div>

      <div className="study-mascot-art">
        <span className="study-mascot-glow" aria-hidden="true" />
        <span className="study-mascot-ring ring-a" aria-hidden="true" />
        <span className="study-mascot-ring ring-b" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element -- product mascot is a static local public asset */}
        <img
          className="study-mascot-image"
          src={content.sprite}
          alt={`Mascote do Fale Biblico em estado ${content.badge}`}
          loading="lazy"
        />
      </div>
    </section>
  );
}
