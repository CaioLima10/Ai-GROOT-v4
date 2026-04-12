import { useEffect, useState, type ReactNode, type RefObject } from "react";
import type { MessageUploadPreview } from "@/lib/uploadPreviews";
import { IconFile } from "./ChatIcons";
import type { ChatMessage } from "./types";

type WorkspaceSurface = "chat" | "study";

type ChatConversationProps = {
  chatRef: RefObject<HTMLElement | null>;
  getMessageUploads: (message: ChatMessage) => string[];
  getMessageUploadPreviews: (message: ChatMessage) => MessageUploadPreview[];
  landingGreeting: {
    suffix?: string;
    title: string;
    subtitle: string;
  };
  messages: ChatMessage[];
  onChatScroll: () => void;
  onScrollToBottom: () => void;
  onSuggestionClick?: (text: string) => void;
  renderAssistantMessage: (message: ChatMessage) => ReactNode;
  stickToBottom: boolean;
  studyHero?: ReactNode;
  surface?: WorkspaceSurface;
};

const CHAT_SUGGESTIONS = [
  { icon: "IA", label: "Explique um conceito", text: "Explique de forma clara e objetiva o que e inteligencia artificial" },
  { icon: "TXT", label: "Escreva um texto", text: "Escreva um email profissional de apresentacao" },
  { icon: "DATA", label: "Analise dados", text: "Analise os pros e contras de trabalhar remotamente" },
  { icon: "JS", label: "Gere codigo", text: "Crie um componente React de formulario de contato com validacao" }
];

const STUDY_SUGGESTIONS = [
  { icon: "ROM", label: "Estude uma passagem", text: "Faca uma analise exegetica de Romanos 8:28-30" },
  { icon: "SLM", label: "Devocional", text: "Prepare um devocional sobre o Salmo 23 para estudo em grupo" },
  { icon: "PA", label: "Teologia", text: "Explique a doutrina da justificacao pela fe em Paulo" },
  { icon: "EX", label: "Contexto historico", text: "Descreva o contexto historico do exilio babilonico" }
];

export function ChatConversation({
  chatRef,
  getMessageUploads,
  getMessageUploadPreviews,
  landingGreeting,
  messages,
  onChatScroll,
  onScrollToBottom,
  onSuggestionClick,
  renderAssistantMessage,
  stickToBottom,
  studyHero,
  surface
}: ChatConversationProps) {
  const [expandedImage, setExpandedImage] = useState<{ name: string; src: string } | null>(null);
  const landingSuffix = landingGreeting.suffix || "Peca no chat o que quiser. Se voce pedir imagem, documento ou codigo, o GIOM entende e gera sem mostrar menu de ferramenta.";
  const suggestions = surface === "study" ? STUDY_SUGGESTIONS : CHAT_SUGGESTIONS;

  useEffect(() => {
    if (!expandedImage) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setExpandedImage(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expandedImage]);

  return (
    <>
      <section id="chat" className="chat-stream" ref={chatRef} onScroll={onChatScroll}>
        <div id="chatStreamInner" className="chat-stream-inner">
          {messages.length === 0 ? (
            <section
              className={`hero-launch ${surface === "chat" ? "hero-launch-chatgpt" : ""} ${surface === "study" ? "hero-launch-study" : ""}`}
              aria-label="Mensagem inicial do chat"
            >
              {surface === "study" && studyHero ? (
                <>
                  {studyHero}
                  {onSuggestionClick ? (
                    <div className="hero-suggestions" aria-label="Sugestoes de conversa">
                      {suggestions.map((suggestion) => (
                        <button
                          key={suggestion.label}
                          type="button"
                          className="hero-suggestion-card"
                          onClick={() => onSuggestionClick(suggestion.text)}
                        >
                          <span className="hero-suggestion-icon" aria-hidden="true">{suggestion.icon}</span>
                          <span className="hero-suggestion-label">{suggestion.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="hero-copy-stack">
                    <h1 className="hero-title">{landingGreeting.title}</h1>
                    {(surface === "chat" || landingGreeting.subtitle) ? (
                      <p className="hero-subtitle">
                        {surface === "chat"
                          ? [landingGreeting.subtitle, landingSuffix].filter(Boolean).join(" ")
                          : landingGreeting.subtitle}
                      </p>
                    ) : null}
                  </div>
                  {surface !== "chat" && onSuggestionClick ? (
                    <div className="hero-suggestions" aria-label="Sugestoes de conversa">
                      {suggestions.map((suggestion) => (
                        <button
                          key={suggestion.label}
                          type="button"
                          className="hero-suggestion-card"
                          onClick={() => onSuggestionClick(suggestion.text)}
                        >
                          <span className="hero-suggestion-icon" aria-hidden="true">{suggestion.icon}</span>
                          <span className="hero-suggestion-label">{suggestion.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </section>
          ) : (
            messages.map((message) => {
              const uploads = getMessageUploads(message);
              const uploadPreviews = getMessageUploadPreviews(message);
              const imagePreviews = uploadPreviews.filter(
                (preview): preview is MessageUploadPreview & { kind: "image"; src: string } =>
                  preview.kind === "image" && typeof preview.src === "string" && preview.src.length > 0
              );
              const nonImagePreviews = uploadPreviews.filter((preview) => preview.kind !== "image" || !preview.src);
              const imageGalleryClassName = [
                "sent-image-gallery",
                imagePreviews.length > 4 ? "is-scroll" : `count-${Math.min(Math.max(imagePreviews.length, 1), 4)}`
              ].join(" ");

              return (
                <article
                  key={message.id}
                  className={`message chat-message ${message.role}`}
                  data-role={message.role}
                  data-thinking={message.pending ? "true" : "false"}
                >
                  <div className="bubble">
                    {uploads.length > 0 && (
                      <div className="sent-upload-stack">
                        {imagePreviews.length > 0 && (
                          <div className={imageGalleryClassName} aria-label={`Galeria com ${imagePreviews.length} imagens enviadas`}>
                            {imagePreviews.map((preview, index) => (
                              <button
                                key={`${message.id}-image-preview-${index}`}
                                type="button"
                                className="sent-image-card"
                                onClick={() => setExpandedImage({ name: preview.name, src: preview.src! })}
                                title={`Abrir ${preview.name} em tamanho original`}
                                aria-label={`Abrir ${preview.name} em tamanho original`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element -- upload previews use local blob/data URLs */}
                                <img
                                  className="sent-image-card-image"
                                  src={preview.src}
                                  alt={`Imagem enviada: ${preview.name}`}
                                  loading="lazy"
                                />
                              </button>
                            ))}
                          </div>
                        )}

                        {uploadPreviews.length > 0 ? (
                          nonImagePreviews.length > 0 ? (
                            <div className="sent-file-list" aria-label="Arquivos enviados">
                              {nonImagePreviews.map((preview, index) => (
                                <article key={`${message.id}-file-preview-${index}`} className="sent-file-card">
                                  <div
                                    className={[
                                      "sent-file-card-preview",
                                      preview.kind === "pdf" ? "is-pdf" : "",
                                      preview.kind === "document" ? "is-generic" : ""
                                    ].filter(Boolean).join(" ")}
                                  >
                                    {preview.src ? (
                                      <>
                                        {/* eslint-disable-next-line @next/next/no-img-element -- upload previews use local blob/data URLs */}
                                        <img
                                          className="sent-file-card-image"
                                          src={preview.src}
                                          alt={`Preview de ${preview.name}`}
                                          loading="lazy"
                                        />
                                      </>
                                    ) : (
                                      <span className="sent-file-card-fallback" aria-hidden="true">
                                        {preview.badge}
                                      </span>
                                    )}
                                  </div>
                                  <div className="sent-file-copy">
                                    <strong title={preview.name}>{preview.name}</strong>
                                    <small>{preview.meta}</small>
                                  </div>
                                </article>
                              ))}
                            </div>
                          ) : null
                        ) : (
                          <div className="sent-file-list" aria-label="Arquivos enviados">
                            {uploads.map((fileName, index) => {
                              const extension = fileName.split(".").pop()?.toUpperCase() || "FILE";
                              return (
                                <article key={`${message.id}-file-${index}`} className="sent-file-chip">
                                  <IconFile />
                                  <div className="sent-file-copy">
                                    <strong title={fileName}>{fileName}</strong>
                                    <small>{extension}</small>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {message.pending ? (
                      <div className="thinking-bubble">
                        <span>Processando</span>
                        <div className="leaf-loader" aria-hidden="true">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>
                    ) : message.role === "user" ? (
                      <p>{message.content}</p>
                    ) : (
                      renderAssistantMessage(message)
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      {!stickToBottom ? (
        <button id="scrollBottomBtn" className="jump-bottom" type="button" onClick={onScrollToBottom}>
          Ir para o fim
        </button>
      ) : null}

      {expandedImage ? (
        <div
          className="image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Imagem ampliada: ${expandedImage.name}`}
          onClick={() => setExpandedImage(null)}
        >
          <button
            type="button"
            className="image-lightbox-close"
            onClick={() => setExpandedImage(null)}
            aria-label="Fechar imagem ampliada"
            title="Fechar"
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- lightbox renders a local blob/data URL */}
          <img
            className="image-lightbox-image"
            src={expandedImage.src}
            alt={`Imagem ampliada: ${expandedImage.name}`}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
