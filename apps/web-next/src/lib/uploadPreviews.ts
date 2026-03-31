export type MessageUploadPreview = {
  badge: string;
  kind: "image" | "pdf" | "document" | "generic";
  meta: string;
  name: string;
  src: string | null;
};

function isObjectUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith("blob:");
}

const IMAGE_FILE_RE = /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic|heif)$/i;
const PDF_FILE_RE = /\.pdf$/i;
const TEXT_DOC_EXTENSIONS = new Set([
  "txt",
  "md",
  "json",
  "jsonl",
  "csv",
  "tsv",
  "log",
  "sql",
  "xml",
  "yml",
  "yaml",
  "html",
  "css",
  "js",
  "ts",
  "tsx",
  "jsx",
  "py",
  "java",
  "go",
  "rs",
  "c",
  "cpp",
  "cs",
  "php",
  "rb"
]);

function getFileExtension(file: File) {
  return (file.name.split(".").pop() || "").trim().toLowerCase();
}

export function isImageLike(file: File) {
  return file.type.startsWith("image/") || IMAGE_FILE_RE.test(file.name);
}

export function isPdfLike(file: File) {
  return file.type === "application/pdf" || PDF_FILE_RE.test(file.name);
}

export function getFileBadge(file: File) {
  if (isImageLike(file)) return "IMG";
  if (isPdfLike(file)) return "PDF";
  return (getFileExtension(file) || "file").slice(0, 4).toUpperCase();
}

export function getFileMeta(file: File) {
  if (isImageLike(file)) {
    const subtype = file.type.replace("image/", "").trim();
    return (subtype || getFileExtension(file) || "imagem").toUpperCase();
  }

  if (isPdfLike(file)) {
    return "PDF";
  }

  const extension = getFileExtension(file);
  if (extension) {
    return extension.toUpperCase();
  }

  return file.type || "Documento";
}

function getPreviewScale(width: number, height: number, maxWidth = 180, maxHeight = 128) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  return Math.min(maxWidth / safeWidth, maxHeight / safeHeight, 1.4);
}

async function renderImagePreview(file: File) {
  try {
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}

async function renderPdfPreview(file: File) {
  try {
    const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
    const workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    if (pdfjs.GlobalWorkerOptions.workerSrc !== workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    }

    const data = new Uint8Array(await file.arrayBuffer());
    const loadingTask = pdfjs.getDocument({ data });
    const pdf = await loadingTask.promise;

    try {
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const scale = getPreviewScale(viewport.width, viewport.height);
      const scaledViewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return null;

      canvas.width = Math.ceil(scaledViewport.width);
      canvas.height = Math.ceil(scaledViewport.height);

      await page.render({
        canvasContext: context,
        viewport: scaledViewport
      }).promise;

      return canvas.toDataURL("image/png");
    } finally {
      await pdf.destroy();
    }
  } catch {
    return null;
  }
}

async function readDocumentSnippet(file: File) {
  const extension = getFileExtension(file);
  const textLike =
    file.type.startsWith("text/") ||
    file.type.includes("json") ||
    file.type.includes("xml") ||
    file.type.includes("javascript") ||
    file.type.includes("csv") ||
    TEXT_DOC_EXTENSIONS.has(extension);

  if (!textLike) {
    return "";
  }

  try {
    const text = await file.text();
    return text
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 140);
  } catch {
    return "";
  }
}

async function renderDocumentPreview(file: File) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;

  canvas.width = 180;
  canvas.height = 128;

  context.fillStyle = "#111827";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#f8fafc";
  context.strokeStyle = "#e2e8f0";
  context.lineWidth = 1;
  context.beginPath();
  context.roundRect(18, 10, 108, 108, 12);
  context.fill();
  context.stroke();

  context.fillStyle = "#ef4444";
  context.fillRect(18, 10, 108, 18);

  context.fillStyle = "#ffffff";
  context.font = "700 10px 'Segoe UI', Arial, sans-serif";
  context.fillText(getFileMeta(file), 26, 22);

  context.fillStyle = "#334155";
  context.font = "600 11px 'Segoe UI', Arial, sans-serif";
  const lines = [];
  const snippet = await readDocumentSnippet(file);
  if (snippet) {
    const words = snippet.split(" ");
    let currentLine = "";
    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (candidate.length > 24 && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = candidate;
      }
      if (lines.length >= 4) break;
    }
    if (currentLine && lines.length < 4) {
      lines.push(currentLine);
    }
  } else {
    lines.push(file.name.slice(0, 24));
    lines.push("Documento enviado");
    lines.push("Pronto para leitura");
  }

  lines.slice(0, 4).forEach((line, index) => {
    context.fillText(line, 28, 44 + index * 15);
  });

  context.strokeStyle = "#cbd5e1";
  context.lineWidth = 1;
  for (let index = 0; index < 4; index += 1) {
    context.beginPath();
    context.moveTo(28, 88 + index * 6);
    context.lineTo(108, 88 + index * 6);
    context.stroke();
  }

  context.fillStyle = "#e5e7eb";
  context.font = "700 13px 'Segoe UI', Arial, sans-serif";
  context.fillText(getFileBadge(file), 141, 34);

  context.fillStyle = "#9ca3af";
  context.font = "600 11px 'Segoe UI', Arial, sans-serif";
  context.fillText("Preview", 141, 52);
  context.fillText("doc", 141, 66);

  return canvas.toDataURL("image/png");
}

export async function buildUploadPreview(file: File): Promise<MessageUploadPreview> {
  if (isImageLike(file)) {
    return {
      badge: "IMG",
      kind: "image",
      meta: getFileMeta(file),
      name: file.name,
      src: await renderImagePreview(file)
    };
  }

  if (isPdfLike(file)) {
    return {
      badge: "PDF",
      kind: "pdf",
      meta: "PDF",
      name: file.name,
      src: await renderPdfPreview(file)
    };
  }

  return {
    badge: getFileBadge(file),
    kind: "document",
    meta: getFileMeta(file),
    name: file.name,
    src: await renderDocumentPreview(file)
  };
}

export async function buildUploadPreviews(files: File[]) {
  return await Promise.all(files.map(async (file) => await buildUploadPreview(file)));
}

export function revokeUploadPreviews(previews: MessageUploadPreview[] | null | undefined) {
  if (!Array.isArray(previews) || !previews.length) return;

  for (const preview of previews) {
    const source = preview?.src;
    if (isObjectUrl(source)) {
      URL.revokeObjectURL(source);
    }
  }
}
