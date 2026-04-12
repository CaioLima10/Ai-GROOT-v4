import type { ChangeEvent, FormEvent } from "react";

import { IconMic, IconPlus, IconSend } from "./ChatIcons";

type VoiceConversationOverlayProps = {
  assistantText?: string | null;
  inputDisabled?: boolean;
  inputValue: string;
  interimTranscript?: string;
  microphoneReady?: boolean;
  onClose: () => void;
  onInputChange: (value: string) => void;
  onOpenSettings: () => void;
  onRetry: () => void;
  onSubmitInput: () => void;
  onToggleMute: () => void;
  onTogglePause: () => void;
  open: boolean;
  outputEngine?: "server" | "browser" | "muted";
  muted?: boolean;
  paused?: boolean;
  personaId?: "giom" | "diana";
  personaLabel: string;
  personaTone: string;
  recoveryHint?: string | null;
  sessionReady?: boolean;
  signalLevel?: number;
  signalMode?: "idle" | "input" | "output";
  status: "idle" | "connecting" | "listening" | "processing" | "speaking" | "paused";
  statusLabel: string;
  submitEnabled?: boolean;
  userQuote?: string | null;
};

function buildOutputEngineLabel(outputEngine: NonNullable<VoiceConversationOverlayProps["outputEngine"]>) {
  if (outputEngine === "server") {
    return "Servidor local";
  }

  if (outputEngine === "browser") {
    return "Navegador";
  }

  return "Silenciada";
}

function buildVoiceHeadline(status: VoiceConversationOverlayProps["status"]) {
  if (status === "connecting") {
    return "Conectando a conversa por voz";
  }

  if (status === "listening") {
    return "Estou ouvindo voce";
  }

  if (status === "processing") {
    return "Pensando na resposta";
  }

  if (status === "speaking") {
    return "Respondendo em voz alta";
  }

  if (status === "paused") {
    return "Conversa em pausa";
  }

  return "Conversa por voz pronta";
}

function buildVoiceSupport(status: VoiceConversationOverlayProps["status"], personaLabel: string) {
  if (status === "connecting") {
    return "Abrindo o canal de voz e preparando o microfone para a conversa continua.";
  }

  if (status === "listening") {
    return `${personaLabel} esta ouvindo em tempo real e volta a responder sem voce apertar nada.`;
  }

  if (status === "processing") {
    return `${personaLabel} esta montando a resposta antes de voltar a falar em voz alta.`;
  }

  if (status === "speaking") {
    return `${personaLabel} esta falando agora. Se voce entrar com a sua voz, a resposta e interrompida e a escuta volta.`;
  }

  if (status === "paused") {
    return `${personaLabel} ficou em espera. Retome quando quiser para voltar ao fluxo continuo de ouvir e responder.`;
  }

  return "Tudo pronto. Pode falar quando quiser para iniciar a conversa por voz.";
}

function buildVoiceFootnote(personaTone: string, muted: boolean, paused: boolean) {
  const parts = [personaTone, "modo continuo"];

  if (paused) {
    parts.push("em pausa");
  } else if (muted) {
    parts.push("voz silenciada");
  } else {
    parts.push("interrupcao por voz pronta");
  }

  return parts.join(" · ");
}

export function VoiceConversationOverlay({
  assistantText,
  inputDisabled = false,
  inputValue,
  interimTranscript,
  microphoneReady = false,
  onClose,
  onInputChange,
  onOpenSettings,
  onRetry,
  onSubmitInput,
  onToggleMute,
  onTogglePause,
  open,
  outputEngine = "browser",
  muted = false,
  paused = false,
  personaId = "giom",
  personaLabel,
  personaTone,
  recoveryHint,
  sessionReady = false,
  signalLevel = 0,
  signalMode = "idle",
  status,
  statusLabel,
  submitEnabled = false,
  userQuote
}: VoiceConversationOverlayProps) {
  if (!open) {
    return null;
  }

  const safeSignalLevel = Math.max(0, Math.min(5, Math.round(signalLevel || 0)));
  const responseText = assistantText?.trim() || buildVoiceSupport(status, personaLabel);
  const quoteText = interimTranscript?.trim() || userQuote?.trim() || "";
  const helperText = paused
    ? "Microfone e voz da IA ficam em espera ate voce retomar a sessao."
    : muted
      ? "A resposta em voz alta esta silenciada, mas a conversa continua ativa e volta a ouvir sozinha."
      : interimTranscript && status === "listening"
        ? interimTranscript
        : status === "speaking"
          ? "Fale agora para cortar a resposta e voltar para escuta imediata."
          : statusLabel;

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    onInputChange(event.target.value);
  }

  function handleInputSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submitEnabled || inputDisabled) {
      return;
    }

    onSubmitInput();
  }

  return (
    <section className="voice-conversation-backdrop" aria-label="Conversa por voz com a IA">
      <div
        className="voice-chat-shell"
        data-persona={personaId}
        data-signal-level={safeSignalLevel}
        data-signal-mode={signalMode}
        data-status={status}
      >
        <header className="voice-chat-header">
          <div className="voice-chat-title">
            <strong>{personaLabel}</strong>
            <span>Voz</span>
          </div>

          <button type="button" className="voice-chat-offer">
            Promocao gratuita
          </button>

          <div className="voice-chat-tools">
            <button type="button" className="voice-chat-tool" onClick={onOpenSettings} aria-label="Abrir configuracoes de voz">
              Ajustes
            </button>
            <button
              type="button"
              className={`voice-chat-tool ${paused ? "is-active" : ""}`}
              onClick={onTogglePause}
              aria-label={paused ? "Retomar conversa" : "Pausar conversa"}
            >
              {paused ? "Retomar" : "Pausar"}
            </button>
          </div>
        </header>

        <div className="voice-chat-body">
          {quoteText ? (
            <div className="voice-chat-echo-row">
              <div className="voice-chat-echo">“{quoteText}”</div>
            </div>
          ) : <div className="voice-chat-echo-row" />}

          <div className="voice-chat-center">
            <div className="voice-chat-response">
              <p>{responseText}</p>
            </div>

            {recoveryHint ? (
              <div className="voice-chat-recovery" role="status" aria-live="polite">
                <span>{recoveryHint}</span>
                <button type="button" onClick={onRetry}>Tentar novamente</button>
              </div>
            ) : null}
          </div>
        </div>

        <footer className="voice-chat-footer">
          <div className="voice-chat-waveband" aria-hidden="true">
            <div className="voice-chat-wave-scape">
              <span className="voice-chat-wave-layer layer-back"></span>
              <span className="voice-chat-wave-layer layer-mid"></span>
              <span className="voice-chat-wave-layer layer-front"></span>
              <span className="voice-chat-wave-highlight"></span>
            </div>
          </div>

          <form className="voice-chat-inputbar" onSubmit={handleInputSubmit}>
            <button type="button" className="voice-chat-plus" onClick={onOpenSettings} aria-label="Abrir ajustes">
              <IconPlus />
            </button>

            <div className="voice-chat-inputfield">
              <input
                type="text"
                className="voice-chat-input"
                value={inputValue}
                onChange={handleInputChange}
                placeholder="Digite uma mensagem"
                aria-label="Digitar mensagem durante a conversa por voz"
                autoComplete="off"
                spellCheck={false}
                disabled={inputDisabled}
              />
            </div>

            <div className="voice-chat-inputactions">
              <button
                type="button"
                className={`voice-chat-mic ${muted ? "is-muted" : ""}`}
                onClick={onToggleMute}
                aria-label={muted ? "Ativar voz da IA" : "Silenciar voz da IA"}
              >
                <IconMic />
              </button>

              <button
                type="submit"
                className="voice-chat-send"
                aria-label="Enviar mensagem digitada"
                disabled={!submitEnabled || inputDisabled}
              >
                <IconSend />
              </button>

              <button type="button" className="voice-chat-end" onClick={onClose}>
                Encerrar
              </button>
            </div>
          </form>
          <div className="voice-chat-statusline">
            <span>{buildVoiceHeadline(status)}</span>
            <span>{microphoneReady ? "Microfone pronto" : "Microfone indisponivel"}</span>
            <span>{buildOutputEngineLabel(outputEngine)}</span>
            <span>{sessionReady ? "Sessao conectada" : "Preparando"}</span>
          </div>
          <p className="voice-chat-disclaimer">
            {helperText} · {buildVoiceFootnote(personaTone, muted, paused)}
          </p>
        </footer>
      </div>
    </section>
  );
}