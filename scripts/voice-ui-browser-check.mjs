import { chromium } from "playwright"
import fs from "node:fs/promises"
import path from "node:path"

import { resolveFrontendBaseUrl } from "./lib/resolveFrontendBaseUrl.mjs"

const REPORT_DIR = path.join(process.cwd(), "reports")
const REPORT_PATH = path.join(REPORT_DIR, "voice-ui-browser-check.json")
const INTRO_SHOT = path.join(REPORT_DIR, "voice-ui-intro.png")
const SELECT_SHOT = path.join(REPORT_DIR, "voice-ui-select.png")
const LISTENING_SHOT = path.join(REPORT_DIR, "voice-ui-listening.png")
const SPEAKING_SHOT = path.join(REPORT_DIR, "voice-ui-speaking.png")

function textOrEmpty(value) {
  return String(value || "").trim()
}

async function ensureDir() {
  await fs.mkdir(REPORT_DIR, { recursive: true })
}

const { baseUrl } = await resolveFrontendBaseUrl({ timeoutMs: 8_000 })
const browserBaseUrl = (() => {
  try {
    const normalized = new URL(baseUrl)
    if (normalized.hostname === '127.0.0.1') {
      normalized.hostname = 'localhost'
    }
    return normalized.toString().replace(/\/$/, '')
  } catch {
    return baseUrl
  }
})()
await ensureDir()

const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--autoplay-policy=no-user-gesture-required"
  ]
})

const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  permissions: ["microphone"]
})

const page = await context.newPage()
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
  await context.grantPermissions(["microphone"], { origin: browserBaseUrl })
  await page.goto(browserBaseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 })
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {})
  await page.waitForSelector('#msg, [aria-label="Escolher voz para conversa por voz"], [aria-label="Abrir experiencia de voz"]', { timeout: 30_000 })

  const voiceLaunchButton = page.locator('[aria-label="Escolher voz para conversa por voz"], [aria-label="Abrir experiencia de voz"]').first()
  await voiceLaunchButton.waitFor({ timeout: 15_000 })

  const launchState = await voiceLaunchButton.evaluate((element) => ({
    disabled: element instanceof HTMLButtonElement ? element.disabled : false,
    label: element.getAttribute("aria-label") || element.getAttribute("title") || ""
  }))

  await voiceLaunchButton.click()
  await page.waitForSelector('[aria-label="Escolher voz para conversa por voz"]', { timeout: 10_000 })
  await page.screenshot({ path: INTRO_SHOT, fullPage: true })

  const introState = await page.evaluate(() => ({
    title: document.querySelector(".voice-quick-intro h2")?.textContent?.trim() || "",
    note: document.querySelector(".voice-quick-note")?.textContent?.trim() || "",
    continueDisabled: Boolean(document.querySelector(".voice-quick-primary")?.hasAttribute("disabled"))
  }))

  await page.getByRole("button", { name: "Continuar" }).click()
  await page.waitForSelector('.voice-quick-choice-grid', { timeout: 10_000 })
  await page.getByRole("button", { name: /GIOM Masculino/i }).click()
  await page.screenshot({ path: SELECT_SHOT, fullPage: true })

  const choiceState = await page.evaluate(() => ({
    activePersona: document.querySelector('.voice-quick-choice.is-active strong')?.textContent?.trim() || "",
    roleLabel: document.querySelector('.voice-quick-choice.is-active small')?.textContent?.trim() || "",
    description: document.querySelector('.voice-quick-selected-copy')?.textContent?.trim() || ""
  }))

  await page.getByRole("button", { name: "Iniciar novo chat" }).click()
  await page.waitForSelector('.voice-chat-shell', { timeout: 20_000 })
  await page.waitForTimeout(2500)

  const voiceInput = page.locator('.voice-chat-input')
  await voiceInput.fill('Teste digitado no overlay')
  const typedValue = await voiceInput.inputValue()
  const sendEnabled = await page.locator('.voice-chat-send').isEnabled()

  await page.screenshot({ path: LISTENING_SHOT, fullPage: true })

  const listeningState = await page.evaluate(() => {
    const shell = document.querySelector('.voice-chat-shell')
    const scape = document.querySelector('.voice-chat-wave-scape')
    const frontLayer = document.querySelector('.voice-chat-wave-layer.layer-front')
    const highlight = document.querySelector('.voice-chat-wave-highlight')
    const inputField = document.querySelector('.voice-chat-inputfield')
    const inputActions = document.querySelector('.voice-chat-inputactions')
    const scapeStyle = scape ? getComputedStyle(scape) : null
    const frontStyle = frontLayer ? getComputedStyle(frontLayer) : null
    const highlightStyle = highlight ? getComputedStyle(highlight) : null
    const inputFieldStyle = inputField ? getComputedStyle(inputField) : null
    const inputActionsStyle = inputActions ? getComputedStyle(inputActions) : null

    return {
      persona: shell?.getAttribute('data-persona') || '',
      status: shell?.getAttribute('data-status') || '',
      signalLevel: shell?.getAttribute('data-signal-level') || '',
      typedValue: document.querySelector('.voice-chat-input')?.value || '',
      sendIconVisible: Boolean(document.querySelector('.voice-chat-send svg')),
      micIconVisible: Boolean(document.querySelector('.voice-chat-mic svg')),
      actionGroupVisible: Boolean(inputActions),
      statusLine: Array.from(document.querySelectorAll('.voice-chat-statusline span')).map((node) => node.textContent?.trim() || ''),
      disclaimer: document.querySelector('.voice-chat-disclaimer')?.textContent?.trim() || '',
      layout: inputFieldStyle && inputActionsStyle ? {
        inputPaddingRight: inputFieldStyle.paddingRight,
        actionsGap: inputActionsStyle.gap,
        actionsBorderLeftWidth: inputActionsStyle.borderLeftWidth
      } : null,
      waves: scapeStyle && frontStyle && highlightStyle ? {
        scapeTransform: scapeStyle.transform,
        frontOpacity: frontStyle.opacity,
        frontAnimation: frontStyle.animationName,
        frontFilter: frontStyle.filter,
        highlightOpacity: highlightStyle.opacity,
        highlightAnimation: highlightStyle.animationName
      } : null
    }
  })

  await page.evaluate(() => {
    const shell = document.querySelector('.voice-chat-shell')
    if (shell) {
      shell.setAttribute('data-status', 'speaking')
      shell.setAttribute('data-signal-level', '5')
    }
  })
  await page.waitForTimeout(450)
  await page.screenshot({ path: SPEAKING_SHOT, fullPage: true })

  const speakingState = await page.evaluate(() => {
    const scape = document.querySelector('.voice-chat-wave-scape')
    const frontLayer = document.querySelector('.voice-chat-wave-layer.layer-front')
    const highlight = document.querySelector('.voice-chat-wave-highlight')
    const scapeStyle = scape ? getComputedStyle(scape) : null
    const frontStyle = frontLayer ? getComputedStyle(frontLayer) : null
    const highlightStyle = highlight ? getComputedStyle(highlight) : null

    return {
      waves: scapeStyle && frontStyle && highlightStyle ? {
        scapeTransform: scapeStyle.transform,
        frontOpacity: frontStyle.opacity,
        frontAnimation: frontStyle.animationName,
        frontFilter: frontStyle.filter,
        frontHeight: frontStyle.height,
        highlightOpacity: highlightStyle.opacity,
        highlightAnimation: highlightStyle.animationName
      } : null
    }
  })

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    browserBaseUrl,
    launchState,
    introState,
    choiceState,
    typingState: {
      typedValue,
      sendEnabled
    },
    listeningState,
    speakingState,
    pageErrors,
    requestFailures,
    screenshots: {
      intro: path.relative(process.cwd(), INTRO_SHOT),
      select: path.relative(process.cwd(), SELECT_SHOT),
      listening: path.relative(process.cwd(), LISTENING_SHOT),
      speaking: path.relative(process.cwd(), SPEAKING_SHOT)
    },
    checks: {
      voiceButtonEnabled: launchState.disabled === false,
      introContinueEnabled: introState.continueDisabled === false,
      microphoneReady: listeningState.statusLine.includes('Microfone pronto'),
      typingWorks: typedValue === 'Teste digitado no overlay' && sendEnabled,
      micIconVisible: listeningState.micIconVisible === true,
      inputActionsGrouped: listeningState.actionGroupVisible === true,
      overlayOpened: Boolean(textOrEmpty(listeningState.persona)),
      speakingVisualActive: textOrEmpty(speakingState.waves?.frontAnimation) !== 'none' && Number.parseFloat(speakingState.waves?.highlightOpacity || '0') >= 0.5
    }
  }

  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  const diagnostics = await page.evaluate(() => ({
    title: document.title,
    bodyText: document.body.innerText.slice(0, 600),
    appShellChildren: document.querySelector('#appShell')?.children.length || 0,
    buttons: Array.from(document.querySelectorAll('button')).slice(0, 20).map((button) => ({
      text: button.textContent?.trim() || '',
      aria: button.getAttribute('aria-label') || '',
      title: button.getAttribute('title') || ''
    })),
    inputs: Array.from(document.querySelectorAll('input, textarea')).slice(0, 20).map((element) => ({
      id: element.id || '',
      className: element.className || '',
      placeholder: element.getAttribute('placeholder') || ''
    }))
  })).catch(() => null)

  await fs.writeFile(
    REPORT_PATH,
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      baseUrl,
      browserBaseUrl,
      error: {
        name: error instanceof Error ? error.name : 'Error',
        message: error instanceof Error ? error.message : String(error)
      },
      diagnostics,
      pageErrors,
      requestFailures
    }, null, 2)}\n`,
    'utf8'
  )

  throw error
} finally {
  await context.close()
  await browser.close()
}