import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { IconMic, IconPlus, IconSend, IconVolume } from "./ChatIcons";
import { VoiceQuickModal } from "./VoiceQuickModal";
import {
  buildUploadPreviews,
  getFileBadge,
  getFileMeta,
  revokeUploadPreviews,
  type MessageUploadPreview
} from "@/lib/uploadPreviews";

type VoicePersonaId = "giom" | "diana";

type ChatComposerProps = {
  canUseUploads: boolean;
  fileAccept?: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  isGuest: boolean;
  inlineVoiceActive: boolean;
  inlineVoiceSignalLevel: number;
  input: string;
  isSending: boolean;
  micListening: boolean;
  microphoneMode?: "dictation" | "conversation";
  micSupported: boolean;
  onCloseVoiceModal: () => void;
  voiceConversationActive: boolean;
  onOpenVoiceModal: () => void;
  voiceStatusLabel?: string | null;
  onComposerKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onInputChange: (value: string) => void;
  onRemovePendingFile: (index: number) => void;
  onSelectVoicePersona: (persona: VoicePersonaId) => void;
  onStartVoiceConversation: (persona: VoicePersonaId) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleMicrophone: () => void;
  pendingFiles: File[];
  selectedVoicePersona: VoicePersonaId;
  showVoicePersonaButton?: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  voiceModalOpen: boolean;
};

export function ChatComposer({
  canUseUploads,
  fileAccept,
  fileInputRef,
  isGuest,
  inlineVoiceActive,
  inlineVoiceSignalLevel,
  input,
  isSending,
  micListening,
  microphoneMode = "dictation",
  micSupported,
  onCloseVoiceModal,
  voiceConversationActive,
  onOpenVoiceModal,
  voiceStatusLabel,
  onComposerKeyDown,
  onFileChange,
  onInputChange,
  onRemovePendingFile,
  onSelectVoicePersona,
  onStartVoiceConversation,
  onSubmit,
  onToggleMicrophone,
  pendingFiles,
  selectedVoicePersona,
  showVoicePersonaButton = true,
  textareaRef,
  voiceModalOpen
}: ChatComposerProps) {
  const [previews, setPreviews] = useState<MessageUploadPreview[]>([]);
  const previewsRef = useRef<MessageUploadPreview[]>([]);
  const personaLabel = selectedVoicePersona === "diana" ? "DIANA" : "GIOM";
  const isConversationMode = microphoneMode === "conversation";
  const composerSignalLevel = Math.max(0, Math.min(Math.round(inlineVoiceSignalLevel), 5));
  const sendReady = Boolean(input.trim() || pendingFiles.length);
  const useVoicePill = isGuest && !sendReady && !isConversationMode && !inlineVoiceActive;
  const showSendButton = isSending || !isGuest || sendReady || pendingFiles.length > 0 || isConversationMode || showVoicePersonaButton;

  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  useEffect(() => {
    return () => {
      revokeUploadPreviews(previewsRef.current);
    };
  }, []);

  useEffect(() => {
    let isDisposed = false;

    if (!pendingFiles.length) {
      const currentPreviews = previewsRef.current;
      revokeUploadPreviews(currentPreviews);
      previewsRef.current = [];

      if (currentPreviews.length) {
        Promise.resolve().then(() => {
          if (!isDisposed) {
            setPreviews([]);
          }
        });
      }

      return () => {
        isDisposed = true;
      };
    }

    async function buildPreviews() {
      const nextPreviews = await buildUploadPreviews(pendingFiles);

      if (isDisposed) {
        revokeUploadPreviews(nextPreviews);
        return;
      }

      setPreviews((current) => {
        revokeUploadPreviews(current);
        return nextPreviews;
      });
    }

    void buildPreviews();

    return () => {
      isDisposed = true;
    };
  }, [pendingFiles]);

  return (
    <>
      <form id="composerShell" className="composer-shell" onSubmit={onSubmit}>
        <div className={`composer ${isGuest ? "is-guest" : "is-authenticated"}`}>
          {inlineVoiceActive && (
            <div
              className="composer-voice-inline"
              data-persona={selectedVoicePersona}
              data-signal-level={composerSignalLevel}
            >
              <div className="composer-voice-inline-copy">
                <span className="composer-voice-inline-kicker">Ditado ativo</span>
                <strong>{personaLabel} esta ouvindo e preenchendo o texto antes do envio.</strong>
              </div>

              <div className="composer-voice-inline-orb" aria-hidden="true">
                <span className="composer-voice-inline-ring ring-one"></span>
                <span className="composer-voice-inline-ring ring-two"></span>
                <span className="composer-voice-inline-wave wave-one"></span>
                <span className="composer-voice-inline-wave wave-two"></span>
                <div className="composer-voice-inline-core">
                  <small>{selectedVoicePersona === "diana" ? "Feminina" : "Masculina"}</small>
                  <strong>{personaLabel}</strong>
                </div>
              </div>
            </div>
          )}

        {pendingFiles.length > 0 && (
          <div className="composer-selected-files" aria-live="polite" aria-label="Arquivos prontos para envio">
            {pendingFiles.map((file, index) => (
              <div
                key={`${file.name}-${file.size}-${index}-selected`}
                className={`composer-selected-file ${isSending ? "is-uploading" : ""}`}
                title={file.name}
              >
                <div className={`composer-selected-file-preview is-${previews[index]?.kind || "generic"}`}>
                  {previews[index]?.src ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element -- upload previews use local blob/data URLs */}
                      <img
                        src={previews[index]?.src}
                        alt={`Preview de ${file.name}`}
                        className="composer-selected-file-image"
                      />
                    </>
                  ) : (
                    <div className="composer-selected-file-fallback">
                      {previews[index]?.badge || getFileBadge(file)}
                    </div>
                  )}
                </div>
                <div className="composer-selected-file-copy">
                  <strong title={file.name}>{file.name}</strong>
                  <small>{previews[index]?.meta || getFileMeta(file)}</small>
                </div>
                <button
                  type="button"
                  className="composer-selected-file-remove"
                  onClick={() => onRemovePendingFile(index)}
                  aria-label={`Remover ${file.name}`}
                  title={`Remover ${file.name}`}
                  disabled={isSending}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

          <div className="composer-row">
            <button
              type="button"
              className="icon-btn"
              onClick={() => fileInputRef.current?.click()}
              title={canUseUploads ? "Adicionar arquivos" : "Upload bloqueado no modo atual"}
              disabled={!canUseUploads || isSending}
            >
              <IconPlus />
            </button>

            {showVoicePersonaButton && (
              <button
                type="button"
                className={`icon-btn voice-persona-btn ${voiceModalOpen ? "is-open" : ""}`}
                onClick={onOpenVoiceModal}
                title="Escolher voz para conversa por voz"
                aria-label="Escolher voz para conversa por voz"
                disabled={!micSupported || isSending || inlineVoiceActive}
              >
                <IconVolume />
              </button>
            )}

            <input
              id="fileInput"
              ref={fileInputRef}
              type="file"
              hidden
              multiple
              onChange={onFileChange}
              disabled={!canUseUploads || isSending}
              accept={
                fileAccept ||
                "image/*,.pdf,.zip,.docx,.xlsx,.pptx,.txt,.md,.svg,.json,.js,.ts,.tsx,.jsx,.py,.java,.go,.rs,.c,.cpp,.cs,.php,.rb,.html,.css,.xml,.yml,.yaml,.log,.csv,.sql"
              }
            />

            <div className="composer-input-slot">
              <textarea
                id="msg"
                ref={textareaRef}
                value={input}
                onChange={(event) => onInputChange(event.target.value)}
                onKeyDown={onComposerKeyDown}
                placeholder="Pergunte alguma coisa"
                rows={1}
                disabled={isSending}
              />
            </div>

            {useVoicePill ? (
              <button
                type="button"
                className={`voice-pill-btn ${voiceModalOpen ? "is-open" : ""}`}
                onClick={onOpenVoiceModal}
                title="Abrir experiencia de voz"
                aria-label="Abrir experiencia de voz"
                disabled={!micSupported || isSending}
              >
                <IconVolume />
                <span>Voz</span>
              </button>
            ) : (
              <button
                type="button"
                className={`icon-btn ${voiceConversationActive || inlineVoiceActive || micListening ? "active" : ""}`}
                onClick={onToggleMicrophone}
                title={micSupported
                  ? isConversationMode
                    ? voiceConversationActive
                      ? "Encerrar conversa por voz"
                      : "Iniciar conversa por voz com o GIOM"
                    : inlineVoiceActive
                      ? "Encerrar ditado por voz"
                      : "Gravar voz para preencher o texto"
                  : "Microfone indisponivel"}
                aria-label={isConversationMode
                  ? voiceConversationActive
                    ? "Encerrar conversa por voz"
                    : "Iniciar conversa por voz"
                  : inlineVoiceActive
                    ? "Encerrar ditado por voz"
                    : "Gravar voz para preencher o texto"}
                disabled={!micSupported || isSending}
              >
                <IconMic />
              </button>
            )}

            {showSendButton ? (
              <button
                id="sendBtn"
                type="submit"
                className={`send-btn ${sendReady && !inlineVoiceActive ? "ready" : ""} ${isSending ? "is-working" : ""}`}
                disabled={isSending || inlineVoiceActive || !sendReady}
                title="Enviar mensagem"
                aria-label="Enviar mensagem"
              >
                <IconSend />
              </button>
            ) : null}
        </div>

        </div>
        <p className="composer-disclaimer">
          {voiceStatusLabel ? `${voiceStatusLabel} · ` : ""}
          Giom e uma IA e pode cometer erros.
        </p>
      </form>

      {(showVoicePersonaButton || isGuest) && (
        <VoiceQuickModal
          micSupported={micSupported}
          onClose={onCloseVoiceModal}
          onSelectPersona={onSelectVoicePersona}
          onStartConversation={onStartVoiceConversation}
          open={voiceModalOpen}
          personaId={selectedVoicePersona}
        />
      )}
    </>
  );
}
