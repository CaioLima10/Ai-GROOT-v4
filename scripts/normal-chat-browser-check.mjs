import { chromium } from "playwright"
import fs from "node:fs/promises"
import path from "node:path"

import { resolveFrontendBaseUrl } from "./lib/resolveFrontendBaseUrl.mjs"

const REPORT_DIR = path.join(process.cwd(), "reports")
const REPORT_PATH = path.join(REPORT_DIR, "normal-chat-browser-check.json")

async function ensureDir() {
  await fs.mkdir(REPORT_DIR, { recursive: true })
}

const { baseUrl } = await resolveFrontendBaseUrl({ timeoutMs: 8_000 })
await ensureDir()

const browser = await chromium.launch({
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"]
})

const page = await browser.newPage({
  viewport: { width: 1440, height: 960 }
})

const pageErrors = []
const requestFailures = []

page.on("pageerror", (error) => {
  pageErrors.push({
    message: error.message,
    stack: error.stack || ""
  })
})

page.on("requestfailed", (request) => {
  requestFailures.push({
    url: request.url(),
    resourceType: request.resourceType(),
    failure: request.failure()?.errorText || "unknown"
  })
})

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 })
  await page.waitForSelector("#msg", { timeout: 30_000 })
  await page.fill("#msg", "oi")
  await page.click("#sendBtn")

  await page.waitForFunction(() => {
    const pending = document.querySelector('[data-role="assistant"][data-thinking="true"]')
    const assistantMessages = document.querySelectorAll('[data-role="assistant"] .bubble')
    return !pending && assistantMessages.length > 0
  }, { timeout: 45_000 })

  await page.waitForTimeout(1_500)

  const result = await page.evaluate(() => ({
    assistantCount: document.querySelectorAll('[data-role="assistant"]').length,
    providerBadgeCount: document.querySelectorAll('.message-provider-status').length,
    voiceOverlayOpen: Boolean(document.querySelector('.voice-chat-shell')),
    speechSynthesisSpeaking: typeof window.speechSynthesis !== 'undefined' ? window.speechSynthesis.speaking : false,
    speechSynthesisPending: typeof window.speechSynthesis !== 'undefined' ? window.speechSynthesis.pending : false,
    assistantText: document.querySelector('[data-role="assistant"] .bubble')?.textContent?.trim() || ""
  }))

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    result,
    pageErrors,
    requestFailures,
    checks: {
      assistantAnswered: result.assistantCount > 0 && result.assistantText.length > 0,
      providerBadgeHidden: result.providerBadgeCount === 0,
      voiceOverlayClosed: result.voiceOverlayOpen === false,
      speechSynthesisIdle: result.speechSynthesisSpeaking === false && result.speechSynthesisPending === false
    }
  }

  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8")
  console.log(JSON.stringify(report, null, 2))
} finally {
  await page.close()
  await browser.close()
}