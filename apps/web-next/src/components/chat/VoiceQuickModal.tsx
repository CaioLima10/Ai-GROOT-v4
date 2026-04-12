import { useEffect, useState } from "react";

type VoicePersonaId = "giom" | "diana";

type VoiceQuickModalProps = {
  micSupported: boolean;
  onClose: () => void;
  onSelectPersona: (persona: VoicePersonaId) => void;
  onStartConversation: (persona: VoicePersonaId) => void;
  open: boolean;
  personaId: VoicePersonaId;
};

const PERSONA_OPTIONS: Array<{
  description: string;
  id: VoicePersonaId;
  label: string;
  roleLabel: string;
  subtitle: string;
}> = [
  {
    id: "giom",
    label: "GIOM",
    roleLabel: "Masculino",
    subtitle: "Fala firme, direta e serena.",
    description: "Voz masculina do agente GIOM, com timbre azul e resposta mais objetiva."
  },
  {
    id: "diana",
    label: "DIANA",
    roleLabel: "Feminino",
    subtitle: "Fala calorosa, leve e envolvente.",
    description: "Voz feminina da agente DIANA, com timbre rosa e resposta mais acolhedora."
  }
];

const INTRO_BENEFITS = [
  {
    title: "Conversas naturais",
    description: "Sente e reage a interrupcoes, humor e muito mais."
  },
  {
    title: "GIOM e DIANA",
    description: "Escolha entre a voz masculina do GIOM e a voz feminina da DIANA."
  },
  {
    title: "Personalizada para voce",
    description: "Pode usar memoria e instrucoes personalizadas para ajustar as respostas."
  },
  {
    title: "O controle e todo seu",
    description: "Gravacoes de audio sao salvas e voce pode exclui-las quando quiser."
  }
];

export function VoiceQuickModal({
  micSupported,
  onClose,
  onSelectPersona,
  onStartConversation,
  open,
  personaId
}: VoiceQuickModalProps) {
  const [stage, setStage] = useState<"intro" | "select">("intro");
  const [selectedPersonaId, setSelectedPersonaId] = useState<VoicePersonaId>(personaId);

  useEffect(() => {
    if (!open) {
      const timer = window.setTimeout(() => {
        setStage("intro");
        setSelectedPersonaId(personaId);
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [open, personaId]);

  if (!open) {
    return null;
  }

  const activePersona = PERSONA_OPTIONS.find((option) => option.id === selectedPersonaId) || PERSONA_OPTIONS[0];
  const introNote = micSupported
    ? "GIOM e DIANA podem cometer erros. Confira informacoes importantes. Os limites de uso podem ser alterados."
    : "O microfone nao esta disponivel neste navegador ou dispositivo.";

  function handleContinue() {
    if (!micSupported) {
      return;
    }

    setStage("select");
  }

  function handleStart() {
    onSelectPersona(activePersona.id);
    onStartConversation(activePersona.id);
  }

  return (
    <div className="voice-quick-backdrop" onClick={onClose}>
      <section
        className="voice-quick-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Escolher voz para conversa por voz"
        onClick={(event) => event.stopPropagation()}
      >
        {stage === "intro" ? (
          <div className="voice-quick-intro">
            <h2>Diga oi para a Voz</h2>
            <div className="voice-quick-benefits">
              {INTRO_BENEFITS.map((benefit) => (
                <article key={benefit.title} className="voice-quick-benefit">
                  <div className="voice-quick-benefit-icon"></div>
                  <div>
                    <strong>{benefit.title}</strong>
                    <p>{benefit.description}</p>
                  </div>
                </article>
              ))}
            </div>
            <p className="voice-quick-note">{introNote}</p>
            <button type="button" className="voice-quick-primary" onClick={handleContinue} disabled={!micSupported}>
              Continuar
            </button>
          </div>
        ) : (
          <div className="voice-quick-selector">
            <h2>Escolha uma voz</h2>

            <div className="voice-quick-choice-grid" role="radiogroup" aria-label="Escolha entre GIOM e DIANA">
              {PERSONA_OPTIONS.map((option) => {
                const isActive = option.id === selectedPersonaId;

                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`voice-quick-choice ${isActive ? "is-active" : ""}`}
                    data-persona={option.id}
                    onClick={() => setSelectedPersonaId(option.id)}
                    aria-label={`${option.label} ${option.roleLabel}`}
                  >
                    <div className="voice-quick-choice-orb" data-persona={option.id} aria-hidden="true">
                      <span className="voice-quick-choice-ripple ripple-one"></span>
                      <span className="voice-quick-choice-ripple ripple-two"></span>
                      <span className="voice-quick-choice-liquid layer-one"></span>
                      <span className="voice-quick-choice-liquid layer-two"></span>
                      <span className="voice-quick-choice-glow"></span>
                    </div>
                    <strong>{option.label}</strong>
                    <small>{option.roleLabel}</small>
                    <span>{option.subtitle}</span>
                  </button>
                );
              })}
            </div>

            <div className="voice-quick-active-copy">
              <strong>{activePersona.label}</strong>
              <span>{activePersona.roleLabel}</span>
            </div>

            <p className="voice-quick-selected-copy">{activePersona.description}</p>

            <button type="button" className="voice-quick-primary" onClick={handleStart} disabled={!micSupported}>
              Iniciar novo chat
            </button>
            <button type="button" className="voice-quick-secondary" onClick={onClose}>
              Cancelar
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
