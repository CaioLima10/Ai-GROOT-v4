import path from "node:path"
import { mkdir, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { chromium } from "playwright"

import { resolveFrontendBaseUrl } from "./lib/resolveFrontendBaseUrl.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..")
const { baseUrl } = await resolveFrontendBaseUrl()
const timestamp = new Date().toISOString().replace(/[.:]/g, "-")
const reportDir = path.join(repoRoot, "reports", "giom-conversation-continuity", timestamp)

const scenario = {
  seedPrompt: "Meu nome e Gabriel e estamos estudando o Livro de Genesis. Responda apenas: entendido.",
  recallPrompt: "Qual e meu nome e qual livro estamos estudando agora?",
  continuationPrompt: "Continue no mesmo assunto e faca 3 topicos curtos sobre esse livro.",
  isolationPrompt: "Sem olhar outras conversas, qual e meu nome e qual livro estavamos estudando?"
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForComposer(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 })
  await page.waitForSelector("#msg", { timeout: 60_000 })
  await page.waitForSelector("#sendBtn", { timeout: 60_000 })
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => { })
  await page.waitForFunction(
    () => window.localStorage.getItem("giom-web-next-threads") !== null,
    { timeout: 15_000 }
  )
  await sleep(1_000)
}

async function captureConversationState(page) {
  return await page.evaluate(() => {
    const requestError = document.querySelector(".request-error")?.textContent?.trim() || ""
    const messages = Array.from(document.querySelectorAll("article.message.chat-message")).map((element, index) => {
      const bubble = element.querySelector(".bubble")
      const role = element.getAttribute("data-role") || ""
      const thinking = element.getAttribute("data-thinking") === "true"
      const text = (bubble?.textContent || "").replace(/\s+/g, " ").trim()

      return {
        index,
        role,
        thinking,
        text
      }
    })

    return {
      requestError,
      title: document.title,
      url: window.location.href,
      messageCount: messages.length,
      messages
    }
  })
}

async function waitForSubmissionStart(page, question, timeoutMs = 12_000) {
  const startedAt = Date.now()
  const expectedQuestion = normalizeText(question)

  while (Date.now() - startedAt < timeoutMs) {
    const state = await captureConversationState(page)
    const lastUser = [...state.messages].reverse().find((message) => message.role === "user")
    const normalizedUserText = normalizeText(lastUser?.text || "")
    const hasMatchingUserMessage = Boolean(
      normalizedUserText &&
      (normalizedUserText === expectedQuestion ||
        normalizedUserText.includes(expectedQuestion) ||
        expectedQuestion.includes(normalizedUserText))
    )
    const hasPendingAssistant = state.messages.some((message) => message.role === "assistant" && message.thinking)

    if (state.requestError || hasMatchingUserMessage || hasPendingAssistant) {
      return true
    }

    await sleep(250)
  }

  return false
}

async function submitQuestion(page, question) {
  await page.fill("#msg", question)
  await page.waitForFunction(() => {
    const input = document.querySelector("#msg")
    const sendButton = document.querySelector("#sendBtn")
    return Boolean(input?.value?.trim()) && Boolean(sendButton) && !sendButton.disabled
  }, { timeout: 10_000 })

  const attempts = [
    async () => {
      await page.click("#sendBtn")
    },
    async () => {
      await page.focus("#msg")
      await page.keyboard.press("Enter")
    },
    async () => {
      await page.evaluate(() => {
        document.querySelector("#composerShell")?.requestSubmit()
      })
    }
  ]

  for (let index = 0; index < attempts.length; index += 1) {
    await attempts[index]()
    if (await waitForSubmissionStart(page, question)) {
      return
    }

    if (index < attempts.length - 1) {
      await page.fill("#msg", question)
      await sleep(500)
    }
  }

  throw new Error("Question submission did not start in the chat UI.")
}

async function waitForAssistantAnswer(page, timeoutMs = 180_000) {
  const startedAt = Date.now()
  let stableSignature = ""
  let stableCount = 0
  let latestState = null

  while (Date.now() - startedAt < timeoutMs) {
    latestState = await captureConversationState(page)
    const lastAssistant = [...latestState.messages].reverse().find((message) => message.role === "assistant")
    const lastPending = latestState.messages[latestState.messages.length - 1]?.thinking === true
    const hasAnswerContent = Boolean(lastAssistant && lastAssistant.text)

    if (!lastPending && (hasAnswerContent || latestState.requestError)) {
      const signature = JSON.stringify({
        requestError: latestState.requestError,
        messageCount: latestState.messageCount,
        assistantText: lastAssistant?.text || ""
      })

      if (signature === stableSignature) {
        stableCount += 1
      } else {
        stableSignature = signature
        stableCount = 1
      }

      if (stableCount >= 3) {
        return latestState
      }
    }

    await sleep(1_500)
  }

  return latestState || await captureConversationState(page)
}

async function askTurn(page, label, question) {
  await submitQuestion(page, question)
  const state = await waitForAssistantAnswer(page)
  const lastAssistant = [...state.messages].reverse().find((message) => message.role === "assistant") || null

  return {
    label,
    question,
    requestError: state.requestError,
    answer: normalizeText(lastAssistant?.text || ""),
    messageCount: state.messageCount
  }
}

async function clickNewChat(page) {
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"))
    const target = buttons.find((button) => {
      const text = button.textContent || ""
      if (!text.includes("+ Novo chat")) return false
      const style = window.getComputedStyle(button)
      return style.visibility !== "hidden" && style.display !== "none" && button.getClientRects().length > 0
    })

    if (!target) {
      throw new Error("Visible new-chat button not found.")
    }

    target.click()
  })
  await page.waitForFunction(
    () => document.querySelectorAll("article.message.chat-message").length === 0,
    { timeout: 15_000 }
  )
  await page.waitForSelector("#msg", { timeout: 10_000 })
  await sleep(800)
}

function evaluateTurn(answer, terms) {
  const normalized = normalizeText(answer).toLowerCase()
  return terms.every((term) => normalized.includes(term))
}

function evaluateContinuation(answer) {
  const normalized = normalizeText(answer).toLowerCase()
  if (!normalized) return false
  if (/continuando de onde paramos:\s*(meu nome|qual e meu nome|continue no mesmo assunto)/i.test(normalized)) {
    return false
  }

  const mentionsGenesis = normalized.includes("genesis")
  const hasListShape = /(1\.|- )/.test(normalized)
  return mentionsGenesis && hasListShape
}

await mkdir(reportDir, { recursive: true })

console.log(`GIOM continuity battery starting at ${baseUrl}`)

const browser = await chromium.launch({ headless: true })

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
  const page = await context.newPage()

  await waitForComposer(page)

  const sameThread = []
  sameThread.push(await askTurn(page, "seed", scenario.seedPrompt))
  sameThread.push(await askTurn(page, "recall", scenario.recallPrompt))
  sameThread.push(await askTurn(page, "continuation", scenario.continuationPrompt))

  const sameThreadScreenshot = path.join(reportDir, "same-thread.png")
  await page.screenshot({ path: sameThreadScreenshot, fullPage: true })

  await clickNewChat(page)

  const isolatedTurn = await askTurn(page, "new-thread-recall", scenario.isolationPrompt)
  const isolatedScreenshot = path.join(reportDir, "new-thread.png")
  await page.screenshot({ path: isolatedScreenshot, fullPage: true })

  const summary = {
    baseUrl,
    reportDir,
    completedAt: new Date().toISOString(),
    checks: {
      sameThreadRecallOk: evaluateTurn(sameThread[1]?.answer || "", ["gabriel", "genesis"]),
      sameThreadContinuationOk: evaluateContinuation(sameThread[2]?.answer || ""),
      newThreadIsolationOk: !evaluateTurn(isolatedTurn.answer || "", ["gabriel", "genesis"])
    },
    sameThread,
    isolatedTurn,
    screenshots: {
      sameThreadScreenshot,
      isolatedScreenshot
    }
  }

  await writeFile(path.join(reportDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8")
  console.log(JSON.stringify(summary, null, 2))

  await context.close()
} catch (error) {
  const failure = {
    baseUrl,
    reportDir,
    completedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error)
  }

  await writeFile(path.join(reportDir, "summary.error.json"), JSON.stringify(failure, null, 2), "utf8")
  console.error(JSON.stringify(failure, null, 2))
  process.exitCode = 1
} finally {
  await browser.close()
}