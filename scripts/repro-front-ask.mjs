import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

import { resolveFrontendBaseUrl } from "./lib/resolveFrontendBaseUrl.mjs";

const { baseUrl: url } = await resolveFrontendBaseUrl();
const question = process.env.ASK_QUESTION || "me explique em uma frase o que e inteligencia artificial";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();

const consoleMessages = [];
const pageErrors = [];
const apiTraffic = [];

page.on("console", (message) => {
  consoleMessages.push({
    type: message.type(),
    text: message.text()
  });
});

page.on("pageerror", (error) => {
  pageErrors.push({
    message: error.message,
    stack: error.stack || ""
  });
});

page.on("response", async (response) => {
  const request = response.request();
  const requestUrl = request.url();
  if (!requestUrl.includes("/backend/ask")) return;

  let bodyText = "";
  try {
    bodyText = await response.text();
  } catch {
    bodyText = "";
  }

  apiTraffic.push({
    url: requestUrl,
    method: request.method(),
    status: response.status(),
    requestBody: request.postData() || "",
    responseBody: bodyText.slice(0, 4000)
  });
});

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector("#msg", { timeout: 30_000 });
  await page.fill("#msg", question);
  await page.click("#sendBtn");
  await page.waitForTimeout(12_000);

  const snapshot = await page.evaluate(() => ({
    bodyText: document.body.innerText.trim().slice(0, 2000),
    requestError: document.querySelector(".request-error")?.textContent?.trim() || "",
    messageCount: document.querySelectorAll("[data-message-role], .message-bubble, .chat-stream article").length,
    textareaValue: document.querySelector("#msg")?.value || ""
  }));

  await page.screenshot({ path: "reports/repro-front-ask.png", fullPage: true });
  await writeFile(
    "reports/repro-front-ask.json",
    JSON.stringify({ url, question, snapshot, consoleMessages, pageErrors, apiTraffic }, null, 2),
    "utf8"
  );

  console.log(JSON.stringify({
    url,
    question,
    snapshot,
    apiCalls: apiTraffic.map((entry) => ({ url: entry.url, status: entry.status })),
    consoleCount: consoleMessages.length,
    pageErrorCount: pageErrors.length
  }, null, 2));
} finally {
  await browser.close();
}
