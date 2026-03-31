import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { IconMic, IconPlus, IconSend } from "./ChatIcons";
import {
  buildUploadPreviews,
  getFileBadge,
  getFileMeta,
  revokeUploadPreviews,
  type MessageUploadPreview
} from "@/lib/uploadPreviews";

type ChatComposerProps = {
  canUseUploads: boolean;
  fileAccept?: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  input: string;
  isSending: boolean;
  micListening: boolean;
  micSupported: boolean;
  onComposerKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onInputChange: (value: string) => void;
  onRemovePendingFile: (index: number) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleMicrophone: () => void;
  pendingFiles: File[];
  textareaRef: RefObject<HTMLTextAreaElement | null>;
};

export function ChatComposer({
  canUseUploads,
  fileAccept,
  fileInputRef,
  input,
  isSending,
  micListening,
  micSupported,
  onComposerKeyDown,
  onFileChange,
  onInputChange,
  onRemovePendingFile,
  onSubmit,
  onToggleMicrophone,
  pendingFiles,
  textareaRef
}: ChatComposerProps) {
  const [previews, setPreviews] = useState<MessageUploadPreview[]>([]);
  const previewsRef = useRef<MessageUploadPreview[]>([]);

  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  useEffect(() => {
    return () => {
      revokeUploadPreviews(previewsRef.current);
    };
  }, []);

  useEffect(() => {
    if (!pendingFiles.length) {
      setPreviews((current) => {
        revokeUploadPreviews(current);
        return [];
      });
      return;
    }

    let isDisposed = false;

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
    <form id="composerShell" className="composer-shell" onSubmit={onSubmit}>
      <div className="composer">
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
                    <img
                      src={previews[index]?.src}
                      alt={`Preview de ${file.name}`}
                      className="composer-selected-file-image"
                    />
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
              placeholder="No que esta pensando agora?"
              rows={1}
              disabled={isSending}
            />
          </div>

          <button
            type="button"
            className={`icon-btn ${micListening ? "active" : ""}`}
            onClick={onToggleMicrophone}
            title={micSupported ? (micListening ? "Parar gravacao" : "Ditado por voz") : "Microfone indisponivel"}
            aria-label={micListening ? "Parar gravacao" : "Iniciar ditado por voz"}
            disabled={!micSupported || isSending}
          >
            <IconMic />
          </button>

          <button
            id="sendBtn"
            type="submit"
            className={`send-btn ${input.trim() || pendingFiles.length ? "ready" : ""} ${isSending ? "is-working" : ""}`}
            disabled={isSending || (!input.trim() && !pendingFiles.length)}
            title="Enviar mensagem"
            aria-label="Enviar mensagem"
          >
            <IconSend />
          </button>
        </div>
      </div>
      <p className="composer-disclaimer">Giom e uma IA e pode cometer erros.</p>
    </form>
  );
}
