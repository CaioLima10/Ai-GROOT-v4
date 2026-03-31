import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const genericFile = path.join(root, "package.json");

const SAMPLE_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120">
  <rect width="160" height="120" rx="18" fill="#1f2937"/>
  <rect x="12" y="12" width="136" height="96" rx="14" fill="#0f172a" stroke="#38bdf8" stroke-width="3"/>
  <circle cx="48" cy="44" r="12" fill="#22c55e"/>
  <path d="M20 92 L58 58 L84 82 L112 52 L140 92 Z" fill="#60a5fa"/>
  <text x="20" y="104" fill="#e5e7eb" font-family="Segoe UI, Arial, sans-serif" font-size="12">GIOM image preview</text>
</svg>`;

const SAMPLE_PDF = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Count 1 /Kids [3 0 R] >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 180] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 63 >>
stream
BT
/F1 18 Tf
36 120 Td
(GIOM PDF Preview Test) Tj
0 -28 Td
/F1 12 Tf
(Primeira pagina renderizada) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000355 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
425
%%EOF
`;

async function createSampleFixtures() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "giom-upload-check-"));
  const svgPath = path.join(tempDir, "sample-image.svg");
  const pdfPath = path.join(tempDir, "sample-document.pdf");

  await fs.writeFile(svgPath, SAMPLE_SVG, "utf8");
  await fs.writeFile(pdfPath, SAMPLE_PDF, "utf8");

  return { tempDir, svgPath, pdfPath };
}

async function inspectSelection(page) {
  return await page.evaluate(() => {
    const selectedFiles = Array.from(document.querySelectorAll(".composer-selected-file"));
    const selectedBar = document.querySelector(".composer-selected-files");
    const previewImage = document.querySelector(".composer-selected-file-image");
    const requestError = document.querySelector(".request-error");
    const sendButton = document.querySelector("#sendBtn");
    const input = document.querySelector("#fileInput");

    return {
      selectedCount: selectedFiles.length,
      selectedText: selectedBar?.textContent?.replace(/\s+/g, " ").trim() || "",
      hasRenderedPreviewImage: Boolean(previewImage),
      requestError: requestError?.textContent?.replace(/\s+/g, " ").trim() || "",
      sendDisabled: sendButton instanceof HTMLButtonElement ? sendButton.disabled : null,
      inputDisabled: input instanceof HTMLInputElement ? input.disabled : null
    };
  });
}

async function inspectPostSend(page) {
  return await page.evaluate(() => {
    const selectedFiles = Array.from(document.querySelectorAll(".composer-selected-file"));
    const userMessages = Array.from(document.querySelectorAll(".chat-message.user"));
    const lastUserMessage = userMessages.at(-1);
    const sentFile = Array.from(lastUserMessage?.querySelectorAll(".sent-file-copy strong") || []).at(-1);
    const sentMeta = Array.from(lastUserMessage?.querySelectorAll(".sent-file-copy small") || []).at(-1);
    const sentPreviewCard = lastUserMessage?.querySelector(".sent-file-card, .sent-file-chip");
    const sentImageOnlyCard = lastUserMessage?.querySelector(".sent-image-card");
    const sentImageOnly = lastUserMessage?.querySelector(".sent-image-card-image");
    const sentPreviewImage = lastUserMessage?.querySelector(".sent-file-card-image");
    const sentPreviewFrame = lastUserMessage?.querySelector(".sent-file-card-preview");
    const textarea = document.querySelector("#msg");

    return {
      selectedCountAfterSend: selectedFiles.length,
      lastSentFileName: sentFile?.textContent?.trim() || "",
      lastSentMeta: sentMeta?.textContent?.trim() || "",
      hasSentImageOnlyCard: Boolean(sentImageOnlyCard),
      hasSentImageOnly: Boolean(sentImageOnly),
      hasSentPreviewCard: Boolean(sentPreviewCard),
      hasSentPreviewImage: Boolean(sentPreviewImage),
      sentPreviewKind:
        sentImageOnly
          ? "image-large"
          : sentPreviewFrame instanceof HTMLElement && sentPreviewFrame.classList.contains("is-pdf")
            ? "pdf"
            : sentPreviewFrame instanceof HTMLElement && sentPreviewFrame.classList.contains("is-generic")
              ? "document"
              : sentPreviewImage
                ? "image"
                : "none",
      textareaValue: textarea instanceof HTMLTextAreaElement ? textarea.value : null
    };
  });
}

async function runUploadScenario(page, filePath, selectionDelay = 600, sendDelay = 1400) {
  await page.reload({ waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForSelector("#fileInput", { state: "attached", timeout: 30_000 });
  await page.setInputFiles("#fileInput", filePath);
  await page.waitForTimeout(selectionDelay);
  const selection = await inspectSelection(page);
  await page.click("#sendBtn");
  await page.waitForTimeout(sendDelay);
  const sent = await inspectPostSend(page);
  return { selection, sent };
}

async function main() {
  const fixtures = await createSampleFixtures();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const diagnosticsPath = path.join(root, "reports", "check-composer-upload-diagnostic.png");
  const consoleMessages = [];
  const pageErrors = [];
  const failingResponses = [];

  page.on("console", (message) => {
    consoleMessages.push(`${message.type()}: ${message.text()}`);
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error?.stack || error?.message || String(error));
  });

  page.on("response", (response) => {
    if (response.status() >= 500) {
      failingResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  try {
    await page.goto("http://localhost:3002", { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForSelector("#fileInput", { state: "attached", timeout: 30_000 });
    const genericResult = await runUploadScenario(page, genericFile, 500, 1400);
    const imageResult = await runUploadScenario(page, fixtures.svgPath, 700, 1500);
    const pdfResult = await runUploadScenario(page, fixtures.pdfPath, 1800, 1800);

    console.log(JSON.stringify({ genericResult, imageResult, pdfResult }, null, 2));
  } catch (error) {
    await fs.mkdir(path.dirname(diagnosticsPath), { recursive: true });
    await page.screenshot({ path: diagnosticsPath, fullPage: true }).catch(() => { });
    const diagnostics = await page.evaluate(() => ({
      bodyText: document.body?.innerText?.replace(/\s+/g, " ").trim().slice(0, 500) || "",
      hasAppShell: Boolean(document.querySelector("#appShell")),
      hasFileInput: Boolean(document.querySelector("#fileInput")),
      hasAuthShell: Boolean(document.querySelector(".auth-shell")),
      hasRequestError: document.querySelector(".request-error")?.textContent?.replace(/\s+/g, " ").trim() || "",
      title: document.title
    })).catch(() => ({
      bodyText: "",
      hasAppShell: false,
      hasFileInput: false,
      hasAuthShell: false,
      hasRequestError: "",
      title: ""
    }));

    console.error(JSON.stringify({ diagnosticsPath, diagnostics, pageErrors, consoleMessages, failingResponses }, null, 2));
    throw error;
  } finally {
    await page.close();
    await browser.close();
    await fs.rm(fixtures.tempDir, { recursive: true, force: true });
  }
}

await main();
