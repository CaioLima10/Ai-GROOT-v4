import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

import { resolveFrontendBaseUrl } from "./lib/resolveFrontendBaseUrl.mjs";

const { baseUrl: url } = await resolveFrontendBaseUrl();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

const consoleMessages = [];
const pageErrors = [];
const requestFailures = [];
const resourceStatuses = [];

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

page.on("requestfailed", (request) => {
  requestFailures.push({
    url: request.url(),
    resourceType: request.resourceType(),
    failure: request.failure()?.errorText || "unknown"
  });
});

page.on("response", async (response) => {
  const request = response.request();
  const urlValue = response.url();
  if (
    urlValue.includes("/_next/") ||
    request.resourceType() === "script" ||
    request.resourceType() === "document"
  ) {
    resourceStatuses.push({
      url: urlValue,
      resourceType: request.resourceType(),
      status: response.status()
    });
  }
});

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(4_000);

  const snapshot = await page.evaluate(() => ({
    title: document.title,
    appShellClass: document.querySelector("#appShell")?.className || "",
    appShellText: document.querySelector("#appShell")?.textContent?.trim().slice(0, 400) || "",
    bodyText: document.body.innerText.trim().slice(0, 800),
    authModalVisible: !!document.querySelector("#authModal"),
    mobileMenuVisible: (() => {
      const button = document.querySelector("#mobileMenuBtn");
      if (!(button instanceof HTMLElement)) return false;
      const style = getComputedStyle(button);
      return style.display !== "none" && style.visibility !== "hidden";
    })(),
    hasComposer: !!document.querySelector("textarea"),
    hasHeader: !!document.querySelector(".top-status"),
    hasChatMain: !!document.querySelector(".chatgpt-main"),
    hasSidebar: !!document.querySelector("#sidebar")
  }));

  await page.screenshot({ path: "reports/front-runtime.png", fullPage: true });
  await writeFile(
    "reports/front-runtime.json",
    JSON.stringify({ url, snapshot, consoleMessages, pageErrors, requestFailures, resourceStatuses }, null, 2),
    "utf8"
  );

  console.log(JSON.stringify({
    url,
    snapshot,
    consoleCount: consoleMessages.length,
    pageErrorCount: pageErrors.length,
    requestFailureCount: requestFailures.length,
    resourceStatusCount: resourceStatuses.length
  }, null, 2));
} finally {
  await browser.close();
}
