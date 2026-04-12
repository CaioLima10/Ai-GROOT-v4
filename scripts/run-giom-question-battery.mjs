import path from "node:path"
import { mkdir, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { chromium } from "playwright"

import { resolveFrontendBaseUrl } from "./lib/resolveFrontendBaseUrl.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..")
const { baseUrl } = await resolveFrontendBaseUrl()
const timestamp = new Date().toISOString().replace(/[.:]/g, "-")
const reportDir = path.join(repoRoot, "reports", "giom-question-battery", timestamp)
const questionOffset = Math.max(0, Number(process.env.QUESTION_OFFSET || 0) || 0)
const questionLimit = Math.max(0, Number(process.env.QUESTION_LIMIT || 0) || 0)

const questions = [
  "Resuma para mim o Livro de Genesis",
  "crie uma planilha sobre quais os melhores ferramentas de dev para front end e beck end",
  "qual clima de hoje de sao paulo-sp brasil",
  "qual proximo jogo do santos fc?",
  "qual horario de agora , dia mes e ano",
  "faca um prompt de como ler a biblia do inicio ao fim",
  "crie uma imagem de um foguinho",
  "gere uma imagem da logo do santos so que azul",
  "gere um pdf com o primeiro capitulo de genesis da biblia sagrada",
  "faca uma cronologia do nascimento e da resureicao de cristo",
  "crie para mim um mapa mental de estudo biblico",
  "crie um cronograma de arquiologia do periodo de moises",
  "me indique os melhores livros de pensadores cristaos do momento e faca um resumo",
  "fale sobre escatologia",
  "fale sobre angeologia biblica",
  "crie um prompt de como estudar"
]

const activeQuestions = questionLimit > 0
  ? questions.slice(questionOffset, questionOffset + questionLimit)
  : questions.slice(questionOffset)

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
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
    const inputValue = document.querySelector("#msg")?.value || ""
    const messages = Array.from(document.querySelectorAll("article.message.chat-message")).map((element, index) => {
      const bubble = element.querySelector(".bubble")
      const role = element.getAttribute("data-role") || ""
      const thinking = element.getAttribute("data-thinking") === "true"
      const text = (bubble?.textContent || "").replace(/\s+/g, " ").trim()
      const images = Array.from(element.querySelectorAll("img")).map((img) => ({
        alt: img.getAttribute("alt") || "",
        src: img.getAttribute("src") || ""
      }))
      const links = Array.from(element.querySelectorAll("a")).map((anchor) => ({
        text: (anchor.textContent || "").trim(),
        href: anchor.getAttribute("href") || ""
      }))

      return {
        index,
        role,
        thinking,
        text,
        imageCount: images.length,
        linkCount: links.length,
        images,
        links
      }
    })

    return {
      requestError,
      inputValue,
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

async function focusLatestExchange(page) {
  await page.evaluate(() => {
    const messages = Array.from(document.querySelectorAll("article.message.chat-message"))
    const lastUser = [...messages].reverse().find((element) => element.getAttribute("data-role") === "user")
    const lastAssistant = [...messages].reverse().find((element) => element.getAttribute("data-role") === "assistant")
    const target = lastUser || lastAssistant || messages[messages.length - 1] || null
    target?.scrollIntoView({ behavior: "auto", block: "start" })
  })
  await sleep(300)
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
    const hasAnswerContent = Boolean(lastAssistant && (lastAssistant.text || lastAssistant.imageCount > 0 || lastAssistant.linkCount > 0))

    if (!lastPending && (hasAnswerContent || latestState.requestError)) {
      const signature = JSON.stringify({
        requestError: latestState.requestError,
        messageCount: latestState.messageCount,
        assistantText: lastAssistant?.text || "",
        assistantImages: lastAssistant?.imageCount || 0,
        assistantLinks: lastAssistant?.linkCount || 0
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

async function runQuestion(browser, question, index) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
  const page = await context.newPage()
  const questionSlug = `${String(index + 1).padStart(2, "0")}-${slugify(question)}`
  const questionDir = path.join(reportDir, questionSlug)
  const networkEvents = []
  const consoleMessages = []
  const pageErrors = []
  const downloads = []

  await mkdir(questionDir, { recursive: true })

  page.on("console", (message) => {
    consoleMessages.push({
      type: message.type(),
      text: message.text()
    })
  })

  page.on("pageerror", (error) => {
    pageErrors.push({
      message: error.message,
      stack: error.stack || ""
    })
  })

  page.on("response", (response) => {
    const request = response.request()
    const requestUrl = request.url()
    if (!requestUrl.includes("/backend/ask")) {
      return
    }

    networkEvents.push({
      url: requestUrl,
      method: request.method(),
      status: response.status(),
      resourceType: request.resourceType()
    })
  })

  page.on("download", async (download) => {
    const fileName = download.suggestedFilename()
    const targetPath = path.join(questionDir, fileName)
    await download.saveAs(targetPath)
    downloads.push({
      fileName,
      targetPath
    })
  })

  try {
    await waitForComposer(page)
    await submitQuestion(page, question)

    const state = await waitForAssistantAnswer(page)
    const lastAssistant = [...state.messages].reverse().find((message) => message.role === "assistant") || null
    const screenshotPath = path.join(questionDir, `${questionSlug}.png`)

    await focusLatestExchange(page)
    await page.screenshot({ path: screenshotPath, fullPage: true })

    const result = {
      question,
      questionSlug,
      screenshotPath,
      requestError: state.requestError,
      inputValue: state.inputValue,
      messageCount: state.messageCount,
      lastAssistant,
      networkEvents,
      consoleMessages,
      pageErrors,
      downloads
    }

    await writeFile(
      path.join(questionDir, `${questionSlug}.json`),
      JSON.stringify(result, null, 2),
      "utf8"
    )

    return {
      question,
      questionSlug,
      screenshotPath,
      requestError: state.requestError,
      answerSnippet: normalizeText(lastAssistant?.text || "").slice(0, 500),
      imageCount: lastAssistant?.imageCount || 0,
      linkCount: lastAssistant?.linkCount || 0,
      downloads: downloads.map((entry) => entry.fileName),
      networkStatuses: networkEvents.map((entry) => entry.status)
    }
  } catch (error) {
    const screenshotPath = path.join(questionDir, `${questionSlug}-error.png`)

    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => { })

    return {
      question,
      questionSlug,
      screenshotPath,
      error: error instanceof Error ? error.message : String(error),
      requestError: "",
      answerSnippet: "",
      imageCount: 0,
      linkCount: 0,
      downloads: [],
      networkStatuses: networkEvents.map((entry) => entry.status)
    }
  } finally {
    await context.close()
    await sleep(1_250)
  }
}

await mkdir(reportDir, { recursive: true })

console.log(`GIOM battery starting at ${baseUrl}`)
console.log(`Questions selected: ${activeQuestions.length}`)

const browser = await chromium.launch({ headless: true })

try {
  const results = []

  for (let index = 0; index < activeQuestions.length; index += 1) {
    console.log(`Running question ${index + 1}/${activeQuestions.length}`)
    const result = await runQuestion(browser, activeQuestions[index], questionOffset + index)
    results.push(result)
    console.log(`[${index + 1}/${activeQuestions.length}] ${result.questionSlug}`)
    console.log(result.error ? `error=${result.error}` : `answer=${result.answerSnippet.slice(0, 160)}`)

    await writeFile(
      path.join(reportDir, "summary.partial.json"),
      JSON.stringify({
        baseUrl,
        reportDir,
        totalQuestions: activeQuestions.length,
        completedAt: new Date().toISOString(),
        results
      }, null, 2),
      "utf8"
    )
  }

  const summary = {
    baseUrl,
    reportDir,
    totalQuestions: activeQuestions.length,
    completedAt: new Date().toISOString(),
    results
  }

  await writeFile(path.join(reportDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8")
  console.log(JSON.stringify(summary, null, 2))
} catch (error) {
  const failure = {
    baseUrl,
    reportDir,
    totalQuestions: activeQuestions.length,
    completedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error)
  }

  await writeFile(path.join(reportDir, "summary.error.json"), JSON.stringify(failure, null, 2), "utf8")
  console.error(JSON.stringify(failure, null, 2))
  process.exitCode = 1
} finally {
  await browser.close()
}