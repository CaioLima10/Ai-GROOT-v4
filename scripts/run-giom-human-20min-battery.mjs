import path from "node:path"
import { mkdir, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { chromium } from "playwright"

import { resolveFrontendBaseUrl } from "./lib/resolveFrontendBaseUrl.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..")
const { baseUrl } = await resolveFrontendBaseUrl()
const targetDurationMs = Math.max(60_000, Number(process.env.GIOM_BATTERY_DURATION_MS || (20 * 60 * 1000)))
const timestamp = new Date().toISOString().replace(/[.:]/g, "-")
const reportDir = path.join(repoRoot, "reports", "giom-human-20min-battery", timestamp)

const roboticOpeners = [
  /^(claro|certamente|excelente|otima pergunta|ótima pergunta|com prazer|ol[aá] s[oó]|entendido)[!,. ]/i
]

const roboticClosers = [
  /estou aqui se precisar/i,
  /fico a disposicao/i,
  /qualquer duvida e so perguntar/i,
  /qualquer dúvida é só perguntar/i
]

const scenarioThreads = [
  {
    id: "engineering_professional",
    label: "Engenharia profissional",
    turns: [
      {
        id: "eng_seed",
        category: ["tone", "continuity"],
        question: "Estamos revisando uma API Node para reduzir latencia e melhorar clareza para o time. Responda apenas: combinado.",
        expectAll: [/combinado/i],
        forbid: [/latencia/i, /claridade/i, /time/i]
      },
      {
        id: "eng_plan",
        category: ["tone", "continuity", "human_flow"],
        question: "Com esse foco, me de 3 frentes objetivas para comecar.",
        expectAll: [/(1\.|- )/i],
        expectAny: [/latencia/i, /observ/i, /contrat/i, /cache/i, /fila/i, /medir/i]
      },
      {
        id: "eng_second_point",
        category: ["reference_resolution", "continuity", "human_flow"],
        question: "Pegue o segundo ponto e detalhe sem repetir a lista inteira.",
        expectAny: [/medir/i, /observ/i, /metrica/i, /m[eé]trica/i, /sinal/i, /telemet/i],
        forbid: [/1\..*2\..*3\./i]
      },
      {
        id: "eng_pronoun_reference",
        category: ["reference_resolution", "continuity"],
        question: "Quando eu disser 'isso', estou falando desse segundo ponto. O que devo medir primeiro?",
        expectAny: [/p95/i, /p99/i, /erro/i, /latencia/i, /latência/i, /tempo/i, /fila/i, /throughput/i]
      },
      {
        id: "eng_small_team",
        category: ["correction_handling", "human_flow", "tone"],
        question: "Nosso time e pequeno, entao simplifique isso para algo que caiba em uma semana.",
        expectAny: [/semana/i, /prioridade/i, /primeiro/i, /enxut/i, /minimo viavel|minimo viável/i, /gargalo/i, /dependencia|dependência/i],
        forbid: [/princ[ií]pios b[aá]sicos/i, /conversa continua/i, /desambigu/i, /cards e json/i]
      },
      {
        id: "eng_topic_shift_jwt",
        category: ["topic_shift", "tone", "human_flow"],
        question: "Mudando de assunto: explique JWT para um gerente de produto, sem jargao.",
        expectAny: [/login/i, /identidade/i, /permiss/i, /permissão/i, /acesso/i, /sess[aã]o/i],
        forbid: [/p95/i, /observ/i, /latencia/i, /latência/i]
      },
      {
        id: "eng_return_to_api",
        category: ["continuity", "reference_resolution", "tone"],
        question: "Agora volte ao plano da API e feche em duas frases executivas.",
        expectAny: [/api/i, /latencia/i, /latência/i, /medir/i, /prioridade/i],
        forbid: [/jwt/i, /token/i]
      }
    ]
  },
  {
    id: "bible_pastoral",
    label: "Biblico pastoral",
    turns: [
      {
        id: "bible_seed",
        category: ["tone", "continuity"],
        question: "Agora estamos estudando Romanos 8 e quero um tom maduro, sem pieguice. Responda apenas: ok.",
        expectAll: [/^ok\.?$/i]
      },
      {
        id: "bible_theme",
        category: ["tone", "continuity", "human_flow"],
        question: "Qual e o eixo central desse capitulo em 3 linhas curtas?",
        expectAny: [/roman/i, /esp[ií]rito/i, /condena/i, /seguran/i, /filhos/i]
      },
      {
        id: "bible_application",
        category: ["human_flow", "tone", "continuity"],
        question: "Aplique isso para alguem ansioso, mas sem soar artificial.",
        expectAny: [/ansios/i, /medo/i, /seguran/i, /descanso/i, /firmeza/i],
        forbid: [/claro!/i, /estou aqui se precisar/i]
      },
      {
        id: "bible_reference_text",
        category: ["reference_resolution", "continuity"],
        question: "Quando eu disser 'esse texto', continue em Romanos 8. Esse texto fala mais de culpa ou de seguranca?",
        expectAny: [/culpa/i, /seguran/i, /roman/i],
        forbid: [/Romanos 8 \(NAA\) 1/i, /24 versiculos/i, /24 versículos/i]
      },
      {
        id: "bible_topic_shift_study_plan",
        category: ["topic_shift", "tone", "human_flow"],
        question: "Agora outro assunto: me monte um estudo biblico semanal de 4 blocos.",
        expectAll: [/(1\.|- )/i],
        expectAny: [/leitura/i, /observa/i, /aplica/i, /ora[cç][aã]o/i, /revis[aã]o/i],
        forbid: [/culpa/i, /seguran/i]
      },
      {
        id: "bible_return_with_prayer",
        category: ["continuity", "reference_resolution", "tone"],
        question: "Volte a esse texto e feche com uma oracao curta.",
        expectAny: [/senhor/i, /deus/i, /am[eé]m/i, /roman/i]
      }
    ]
  },
  {
    id: "capabilities_transparency",
    label: "Capacidades e transparência",
    turns: [
      {
        id: "cap_live_web",
        category: ["capabilities", "tone", "human_flow"],
        question: "Hoje voce consegue pesquisar Google ao vivo e verificar informacoes atuais?",
        expectAny: [/nao/i, /não/i, /sem pesquisa web ao vivo/i, /nao consigo verificar agora/i, /não consigo verificar agora/i]
      },
      {
        id: "cap_professional_tone",
        category: ["capabilities", "tone"],
        question: "Responda isso de forma profissional, sem parecer um robo.",
        expectAny: [/pesquisa web ao vivo/i, /base curada/i, /mem[oó]ria conversacional/i, /rag/i],
        forbid: [/sou uma ia/i, /otima pergunta/i, /excelente/i]
      },
      {
        id: "cap_practical_strengths",
        category: ["capabilities", "human_flow", "tone"],
        question: "Entao diga em termos praticos o que voce consegue fazer bem nesta execucao.",
        expectAny: [/analisar/i, /organizar/i, /resumir/i, /explicar/i, /contexto/i, /mem[oó]ria/i]
      },
      {
        id: "cap_current_data_rule",
        category: ["capabilities", "tone"],
        question: "Se eu pedir um dado muito atual, como voce deve responder?",
        expectAny: [/ainda nao tenho essa informacao/i, /ainda não tenho essa informação/i, /nao inventar/i, /não inventar/i, /pedir nova tentativa/i, /mais contexto/i]
      }
    ]
  },
  {
    id: "memory_same_thread",
    label: "Memoria no mesmo chat",
    turns: [
      {
        id: "mem_seed",
        category: ["continuity", "thread_isolation"],
        question: "Meu nome e Marina e estamos tratando de onboarding de clientes. Responda apenas: registrado.",
        expectAll: [/registrado/i]
      },
      {
        id: "mem_recall_same_thread",
        category: ["continuity", "thread_isolation", "reference_resolution"],
        question: "Qual e meu nome e qual assunto estamos tratando?",
        expectAll: [/marina/i],
        expectAny: [/onboarding/i, /clientes/i]
      }
    ]
  },
  {
    id: "memory_new_thread_isolation",
    label: "Isolamento entre chats",
    turns: [
      {
        id: "mem_recall_new_thread",
        category: ["thread_isolation"],
        question: "Sem olhar outras conversas, qual e meu nome e qual assunto estamos tratando?",
        expectAny: [/nao consegui responder/i, /não consegui responder/i, /nao tenho essa informacao/i, /não tenho essa informação/i, /preciso que voce diga/i, /preciso que você diga/i],
        forbid: [/marina/i, /onboarding/i, /clientes/i]
      }
    ]
  }
]

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function countTurns(threads = []) {
  return threads.reduce((sum, thread) => sum + (Array.isArray(thread.turns) ? thread.turns.length : 0), 0)
}

async function waitForComposer(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 })
  await page.waitForSelector("#msg", { timeout: 60_000 })
  await page.waitForSelector("#sendBtn", { timeout: 60_000 })
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => { })
  await page.waitForFunction(
    () => window.localStorage.getItem("giom-web-next-threads") !== null,
    { timeout: 15_000 }
  ).catch(() => { })
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

      return {
        index,
        role,
        thinking,
        text
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
      normalizedUserText
      && (normalizedUserText === expectedQuestion
        || normalizedUserText.includes(expectedQuestion)
        || expectedQuestion.includes(normalizedUserText))
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
  await sleep(1_000)
}

function validateTurnResponse(turn, answer, requestError = "") {
  const text = String(answer || "")
  const normalized = normalizeText(text)
  const failures = []
  const notes = []

  if (requestError) {
    failures.push(`request_error:${requestError}`)
  }

  if (!normalized) {
    failures.push("empty_response")
  }

  if (roboticOpeners.some((pattern) => pattern.test(normalized))) {
    failures.push("robotic_opener")
  }

  if (roboticClosers.some((pattern) => pattern.test(normalized))) {
    failures.push("robotic_closer")
  }

  if (/Continuando de onde paramos:/i.test(normalized)) {
    failures.push("robotic_continuation")
  }

  if (Array.isArray(turn.expectAll)) {
    for (const pattern of turn.expectAll) {
      if (!pattern.test(text)) {
        failures.push(`missing_expected:${pattern}`)
      }
    }
  }

  if (Array.isArray(turn.expectAny) && turn.expectAny.length > 0) {
    const matched = turn.expectAny.some((pattern) => pattern.test(text))
    if (!matched) {
      failures.push("missing_any_expected")
    }
  }

  if (Array.isArray(turn.forbid)) {
    for (const pattern of turn.forbid) {
      if (pattern.test(text)) {
        failures.push(`forbidden_match:${pattern}`)
      }
    }
  }

  if (/\p{Extended_Pictographic}/u.test(text)) {
    notes.push("emoji_detected")
  }

  const firstWords = normalized.split(/\s+/).slice(0, 4).join(" ")

  return {
    passed: failures.length === 0,
    failures,
    notes,
    openerSignature: firstWords
  }
}

function aggregateResults(turnResults = []) {
  const categoryTotals = {}
  const categoryPass = {}
  const openerCounts = {}
  let requestErrorCount = 0
  let roboticFlags = 0

  for (const result of turnResults) {
    if (result.requestError) requestErrorCount += 1
    if (result.validation.failures.some((item) => /robotic_/.test(item))) roboticFlags += 1

    const opener = result.validation.openerSignature
    if (opener) {
      openerCounts[opener] = (openerCounts[opener] || 0) + 1
    }

    for (const category of result.category || []) {
      categoryTotals[category] = (categoryTotals[category] || 0) + 1
      if (result.validation.passed) {
        categoryPass[category] = (categoryPass[category] || 0) + 1
      }
    }
  }

  const categories = Object.keys(categoryTotals).sort().map((category) => ({
    category,
    total: categoryTotals[category],
    passed: categoryPass[category] || 0,
    score: categoryTotals[category] > 0
      ? Number(((categoryPass[category] || 0) / categoryTotals[category]).toFixed(3))
      : 0
  }))

  const repeatedOpeners = Object.entries(openerCounts)
    .filter(([, count]) => count >= 3)
    .sort((left, right) => right[1] - left[1])
    .map(([signature, count]) => ({ signature, count }))

  const passedTurns = turnResults.filter((result) => result.validation.passed).length
  const score = turnResults.length > 0
    ? Number((Math.max(0, (passedTurns / turnResults.length) - (roboticFlags * 0.01))).toFixed(3))
    : 0

  return {
    totalTurns: turnResults.length,
    passedTurns,
    failedTurns: turnResults.length - passedTurns,
    requestErrorCount,
    roboticFlags,
    repeatedOpeners,
    categories,
    score
  }
}

async function runTurn(page, turn, counters) {
  const turnStartedAt = Date.now()
  await submitQuestion(page, turn.question)
  const state = await waitForAssistantAnswer(page)
  const lastAssistant = [...state.messages].reverse().find((message) => message.role === "assistant") || null
  const answer = normalizeText(lastAssistant?.text || "")
  const validation = validateTurnResponse(turn, answer, state.requestError)

  counters.completedTurns += 1
  const elapsedMs = Date.now() - counters.sessionStartedAt
  const remainingTurns = Math.max(0, counters.totalTurns - counters.completedTurns)
  const remainingTargetMs = Math.max(0, targetDurationMs - elapsedMs)
  const thinkPauseMs = remainingTurns > 0
    ? Math.max(0, Math.min(55_000, Math.round(remainingTargetMs / (remainingTurns + 1))))
    : 0

  return {
    id: turn.id,
    category: Array.isArray(turn.category) ? turn.category : [],
    question: turn.question,
    answer,
    requestError: state.requestError,
    messageCount: state.messageCount,
    responseTimeMs: Date.now() - turnStartedAt,
    validation,
    thinkPauseMs
  }
}

await mkdir(reportDir, { recursive: true })

console.log(`GIOM human communication battery starting at ${baseUrl}`)
console.log(`Target duration: ${Math.round(targetDurationMs / 60_000)} minutes`)

const browser = await chromium.launch({ headless: true })

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
  const page = await context.newPage()
  const consoleMessages = []
  const pageErrors = []
  const networkEvents = []
  const threadSnapshots = []
  const turnResults = []

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
    if (!requestUrl.includes("/backend/ask")) return

    networkEvents.push({
      url: requestUrl,
      method: request.method(),
      status: response.status(),
      resourceType: request.resourceType(),
      timestamp: new Date().toISOString()
    })
  })

  await waitForComposer(page)

  const counters = {
    totalTurns: countTurns(scenarioThreads),
    completedTurns: 0,
    sessionStartedAt: Date.now()
  }

  for (let threadIndex = 0; threadIndex < scenarioThreads.length; threadIndex += 1) {
    const thread = scenarioThreads[threadIndex]
    if (threadIndex > 0) {
      await clickNewChat(page)
    }

    console.log(`\n[Thread ${threadIndex + 1}/${scenarioThreads.length}] ${thread.label}`)

    for (let turnIndex = 0; turnIndex < thread.turns.length; turnIndex += 1) {
      const turn = thread.turns[turnIndex]
      console.log(`- Turn ${counters.completedTurns + 1}/${counters.totalTurns}: ${turn.id}`)

      const result = await runTurn(page, turn, counters)
      turnResults.push({
        threadId: thread.id,
        threadLabel: thread.label,
        turnIndex,
        ...result
      })

      console.log(`  responseTimeMs=${result.responseTimeMs} passed=${result.validation.passed}`)
      console.log(`  answer=${result.answer.slice(0, 220)}`)
      if (!result.validation.passed) {
        console.log(`  failures=${result.validation.failures.join(" | ")}`)
      }

      await writeFile(
        path.join(reportDir, "summary.partial.json"),
        JSON.stringify({
          baseUrl,
          targetDurationMs,
          elapsedMs: Date.now() - counters.sessionStartedAt,
          completedTurns: counters.completedTurns,
          totalTurns: counters.totalTurns,
          turnResults,
          aggregate: aggregateResults(turnResults)
        }, null, 2),
        "utf8"
      )

      if (result.thinkPauseMs > 0 && counters.completedTurns < counters.totalTurns) {
        console.log(`  pacingPauseMs=${result.thinkPauseMs}`)
        await page.waitForTimeout(result.thinkPauseMs)
      }
    }

    const screenshotPath = path.join(reportDir, `${String(threadIndex + 1).padStart(2, "0")}-${thread.id}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: true })
    threadSnapshots.push({
      threadId: thread.id,
      label: thread.label,
      screenshotPath
    })
  }

  const finalElapsedMs = Date.now() - counters.sessionStartedAt
  if (finalElapsedMs < targetDurationMs) {
    const remainingMs = targetDurationMs - finalElapsedMs
    console.log(`\nFinal pacing wait to reach target duration: ${remainingMs}ms`)
    await page.waitForTimeout(remainingMs)
  }

  const aggregate = aggregateResults(turnResults)
  const summary = {
    baseUrl,
    reportDir,
    targetDurationMs,
    actualDurationMs: Date.now() - counters.sessionStartedAt,
    completedAt: new Date().toISOString(),
    aggregate,
    threadSnapshots,
    networkSummary: {
      totalAskCalls: networkEvents.length,
      failedAskCalls: networkEvents.filter((event) => event.status >= 400).length
    },
    consoleMessages,
    pageErrors,
    turnResults
  }

  await writeFile(path.join(reportDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8")
  console.log(`\nGIOM human communication battery completed.`)
  console.log(JSON.stringify({
    reportDir,
    actualDurationMinutes: Number((summary.actualDurationMs / 60_000).toFixed(2)),
    score: aggregate.score,
    passedTurns: aggregate.passedTurns,
    failedTurns: aggregate.failedTurns,
    requestErrorCount: aggregate.requestErrorCount,
    roboticFlags: aggregate.roboticFlags,
    repeatedOpeners: aggregate.repeatedOpeners,
    categories: aggregate.categories
  }, null, 2))

  await context.close()
} catch (error) {
  const failure = {
    baseUrl,
    reportDir,
    targetDurationMs,
    completedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error)
  }

  await writeFile(path.join(reportDir, "summary.error.json"), JSON.stringify(failure, null, 2), "utf8")
  console.error(JSON.stringify(failure, null, 2))
  process.exitCode = 1
} finally {
  await browser.close()
}