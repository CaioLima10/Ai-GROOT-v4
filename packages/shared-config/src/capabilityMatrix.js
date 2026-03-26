function buildItem(id, label, status, summary, extra = {}) {
  return {
    id,
    label,
    status,
    summary,
    ...extra
  }
}

export function buildCapabilityMatrix(options = {}) {
  const {
    uploadAccept = [],
    ocrEnabled = false,
    docxEnabled = false,
    xlsxEnabled = false,
    pptxEnabled = false,
    imageGenerationEnabled = false,
    imageGenerationProvider = "disabled",
    liveWebEnabled = false,
    browserPdfExport = true,
    serverPdfGeneration = false,
    structuredDocsNative = false,
    documentGenerationFormats = [],
    privacyRedaction = true,
    sensitiveLearningBlocked = true,
    temporaryUploads = true,
    imageControlsEnabled = false,
    visualImageUnderstanding = false,
    imageEditingEnabled = false
  } = options

  const nativeFormats = Array.isArray(documentGenerationFormats)
    ? documentGenerationFormats.map((format) => String(format || "").toUpperCase()).filter(Boolean)
    : []
  const nativeFormatsSummary = nativeFormats.length > 0
    ? nativeFormats.join(", ")
    : "TXT, MD, HTML and JSON"
  const imageControlSurfaceReady = imageGenerationEnabled && imageControlsEnabled

  return {
    status: "runtime_capability_matrix",
    generatedAt: new Date().toISOString(),
    sections: {
      conversation: {
        id: "conversation",
        label: "Conversation Core",
        items: [
          buildItem("chat", "Chat and streaming", "ready", "Conversational responses and streaming chat are active."),
          buildItem("memory", "Short memory and profile", "ready", "Recent history, user profile, summaries and learning patterns are available."),
          buildItem("rag", "Curated knowledge and RAG", "ready", "GIOM can retrieve curated and learned knowledge from the current stack.")
        ]
      },
      research: {
        id: "research",
        label: "Research",
        items: [
          buildItem("live_web", "Live web search", liveWebEnabled ? "ready" : "planned", liveWebEnabled ? "Live web connectors are active in this runtime." : "Google, Bing and Yahoo live search are not integrated in this runtime yet."),
          buildItem("source_honesty", "Source honesty", "ready", "GIOM should describe the difference between local knowledge, RAG and live web access honestly.")
        ]
      },
      files: {
        id: "files",
        label: "Files and multimodal input",
        items: [
          buildItem("text_code_files", "Text and code files", "ready", "Plain text, markdown, JSON, code and config-like files can be ingested as text.", { accept: uploadAccept }),
          buildItem("pdf_read", "PDF reading", "ready", "PDF text extraction is active on the server."),
          buildItem("svg_read", "SVG reading", "ready", "SVG can be treated as readable text when uploaded with file extension."),
          buildItem("zip_archives", "ZIP archive reading", "ready", "ZIP files can be inspected and text-like entries can be extracted from the archive."),
          buildItem("docx_read", "DOCX reading", docxEnabled ? "ready" : "planned", docxEnabled ? "DOCX text extraction is active on the server." : "DOCX parsing is not active in this runtime yet."),
          buildItem("xlsx_read", "XLSX reading", xlsxEnabled ? "ready" : "planned", xlsxEnabled ? "XLSX worksheet extraction is active on the server." : "XLSX parsing is not active in this runtime yet."),
          buildItem("pptx_read", "PPTX reading", pptxEnabled ? "ready" : "planned", pptxEnabled ? "PPTX slide-text extraction is active on the server." : "PPTX parsing is not active in this runtime yet."),
          buildItem("image_ocr", "Image OCR", ocrEnabled ? "ready" : "partial", ocrEnabled ? "Image text extraction via OCR is enabled." : "Image upload is accepted, but OCR depends on UPLOAD_OCR_ENABLED=true."),
          buildItem("image_visual_understanding", "Image understanding", visualImageUnderstanding ? "ready" : (ocrEnabled ? "partial" : "planned"), visualImageUnderstanding ? "This runtime can reason about visual scenes beyond OCR text extraction." : (ocrEnabled ? "This runtime can extract text from images, but not full visual scene understanding." : "Visual image understanding is not active in this runtime yet.")),
          buildItem("office_binary_docs", "Office binary coverage", docxEnabled && xlsxEnabled && pptxEnabled ? "ready" : (docxEnabled || xlsxEnabled || pptxEnabled ? "partial" : "planned"), docxEnabled && xlsxEnabled && pptxEnabled ? "DOCX, XLSX and PPTX basic extraction are available in this runtime." : (docxEnabled || xlsxEnabled || pptxEnabled ? "Part of the Office binary family is available, but coverage is not complete yet." : "Office binary formats are not parsed natively yet.")),
          buildItem("binary_forensics", "Arbitrary binary inspection", "planned", "Generic binary reverse inspection is not a built-in capability yet.")
        ]
      },
      generation: {
        id: "generation",
        label: "Generation and export",
        items: [
          buildItem("image_generation", "Image generation", imageGenerationEnabled ? "ready" : "partial", imageGenerationEnabled ? `Image generation is active via ${imageGenerationProvider}.` : "Image generation requires a configured provider token such as Hugging Face."),
          buildItem("image_controls", "Image prompt controls", imageControlSurfaceReady ? "ready" : (imageGenerationEnabled ? "partial" : "planned"), imageControlSurfaceReady ? "GIOM can control style preset, negative prompt, aspect ratio, dimensions and seed for image generation." : (imageGenerationEnabled ? "Image generation is active, but advanced prompt controls are not fully exposed in this runtime." : "Advanced image controls depend on image generation being active first.")),
          buildItem("image_editing", "Image editing and variations", imageEditingEnabled ? "ready" : "planned", imageEditingEnabled ? "Reference-image editing, inpainting or multi-turn image editing are active." : "Reference-image editing, inpainting and multi-turn image variations are not integrated in this runtime yet."),
          buildItem("browser_pdf_export", "Browser PDF export", browserPdfExport ? "ready" : "planned", browserPdfExport ? "The web UI can export the current chat through the browser print/export flow." : "Browser-side PDF export is not active."),
          buildItem("server_pdf_generation", "Server PDF generation", serverPdfGeneration ? "ready" : "planned", serverPdfGeneration ? "Server-side PDF file generation is active in this runtime." : "Server-side PDF file generation is not implemented yet."),
          buildItem("structured_docs", "Structured document output", structuredDocsNative ? "ready" : "partial", structuredDocsNative ? `GIOM can generate native files in ${nativeFormatsSummary}.` : "GIOM can draft markdown, HTML, JSON and text documents in chat, but not every binary document type as a native file yet.")
        ]
      },
      privacy: {
        id: "privacy",
        label: "Privacy and protection",
        items: [
          buildItem("sensitive_redaction", "Sensitive data redaction", privacyRedaction ? "ready" : "planned", privacyRedaction ? "Sensitive identifiers, cards, tokens, secrets and bank-like data are redacted before persistence." : "Sensitive data redaction is not active."),
          buildItem("sensitive_learning_block", "Sensitive learning block", sensitiveLearningBlocked ? "ready" : "planned", sensitiveLearningBlocked ? "Learning and long-term persistence are blocked when sensitive data is detected." : "Sensitive-learning blocking is not active."),
          buildItem("temporary_uploads", "Temporary upload storage", temporaryUploads ? "ready" : "planned", temporaryUploads ? "Uploads are stored temporarily with TTL cleanup." : "Temporary upload cleanup is not configured."),
          buildItem("security_edges", "Security edges", "ready", "Helmet, rate limits, HPP, CORS and admin protection are active in the API layer.")
        ]
      }
    }
  }
}

export function listCapabilityHighlights(options = {}) {
  const matrix = buildCapabilityMatrix(options)

  return Object.values(matrix.sections).map((section) => ({
    id: section.id,
    label: section.label,
    ready: section.items.filter((item) => item.status === "ready").length,
    partial: section.items.filter((item) => item.status === "partial").length,
    planned: section.items.filter((item) => item.status === "planned").length
  }))
}
