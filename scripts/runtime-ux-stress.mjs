import { chromium } from "@playwright/test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import "dotenv/config"
import {
  formatRecentLogs,
  startNodeProcess,
  startNpmProcess,
  stopChildProcess,
  waitForAnyUrl,
  waitForUrl
} from "./runtime-qa-support.mjs"

const frontendPort = Number(process.env.QA_FRONTEND_PORT || process.env.WEB_PORT || 3003)
const backendPort = Number(process.env.QA_BACKEND_PORT || process.env.API_PORT || process.env.PORT || 3001)
const FRONTEND_URL = process.env.QA_FRONTEND_URL || `http://localhost:${frontendPort}`
const BACKEND_URL = process.env.QA_BACKEND_URL || `http://localhost:${backendPort}`
const REPORT_PATH = path.join(process.cwd(), "reports", "runtime-ux-stress.json")

function issue(problem, cause, fix, validate) {
  return { problem, cause, fix, validate }
}

async function persistReport(report) {
  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true })
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8")
}

async function waitComposerReady(page, timeout = 120_000) {
  await page.waitForFunction(() => {
    const msg = document.querySelector("#msg")
    return Boolean(msg && !msg.disabled)
  }, undefined, { timeout })
}

async function sendMessage(page, text) {
  await waitComposerReady(page)
  await page.locator("#msg").fill(text)
  await page.keyboard.press("Enter")
}

async function sendWithAttachment(page, filePath, text) {
  await waitComposerReady(page)
  await page.setInputFiles("#fileInput", filePath)
  await page.waitForSelector(".composer-selected-file", { timeout: 20_000 })
  await page.locator("#msg").fill(text)
  await page.locator("#sendBtn").click()
}

function createReport(checks, issues, steps, extras = {}) {
  return {
    generatedAt: new Date().toISOString(),
    baseUrl: FRONTEND_URL,
    backendUrl: BACKEND_URL,
    checks,
    issues,
    steps,
    summary: {
      totalChecks: checks.length,
      passed: checks.filter((entry) => entry.ok).length,
      failed: checks.filter((entry) => !entry.ok).length
    },
    ...extras
  }
}

async function run() {
  const checks = []
  const issues = []
  const steps = []
  const diagnostics = {}
  let frontendRuntime = null
  let backendRuntime = null
  let browser = null
  let context = null
  let mobile = null

  const markStep = (name, details = "ok") => {
    steps.push({
      name,
      details,
      at: new Date().toISOString()
    })
    console.log(`[STRESS] ${name} -> ${details}`)
  }

  const backendReadyUrls = [
    `${BACKEND_URL}/capabilities`,
    `${BACKEND_URL}/config`,
    `${BACKEND_URL}/health`
  ]

  const execute = async () => {
    const backendUpInitially = await waitForAnyUrl(backendReadyUrls, {
      timeoutMs: 8_000,
      accept: (response) => response.status >= 200 && response.status < 600
    })

    if (!backendUpInitially) {
      backendRuntime = startNodeProcess("apps/api/src/server.js", {
        label: "stress-backend",
        env: {
          PORT: String(backendPort),
          API_PORT: String(backendPort),
          NODE_ENV: "test"
        }
      })
      markStep("backend_start", `spawned pid=${backendRuntime.child.pid}`)

      const backendUp = await waitForAnyUrl(backendReadyUrls, {
        timeoutMs: 90_000,
        accept: (response) => response.status >= 200 && response.status < 600
      })

      if (!backendUp) {
        throw new Error("Backend nao subiu em tempo habil")
      }
    } else {
      markStep("backend_start", "reusing existing backend")
    }

    const frontendUpInitially = await waitForUrl(FRONTEND_URL, { timeoutMs: 8_000 })
    if (!frontendUpInitially) {
      frontendRuntime = startNpmProcess(["--workspace", "web-next", "run", "dev", "--", "-p", String(frontendPort)], {
        label: "stress-frontend"
      })
      markStep("frontend_start", `spawned pid=${frontendRuntime.child.pid}`)

      const frontendUp = await waitForUrl(FRONTEND_URL, { timeoutMs: 120_000 })
      if (!frontendUp) {
        throw new Error("Frontend nao subiu em tempo habil")
      }
    } else {
      markStep("frontend_start", "reusing existing frontend")
    }

    browser = await chromium.launch({ headless: true })
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()

    await page.goto(FRONTEND_URL, { waitUntil: "domcontentloaded" })
    await page.waitForSelector("#chat", { timeout: 30_000 })
    await waitComposerReady(page)
    markStep("desktop_ready")

    const beforeCount = await page.evaluate(() => document.querySelectorAll(".message").length)

    for (let i = 1; i <= 3; i += 1) {
      await sendMessage(page, `Stress mensagem ${i}`)
    }

    await waitComposerReady(page)
    const afterSequenceCount = await page.evaluate(() => document.querySelectorAll(".message").length)
    const sequenceOk = afterSequenceCount > beforeCount
    checks.push({ name: "sequential_messages", ok: sequenceOk })

    if (!sequenceOk) {
      issues.push(issue(
        "Sequencia de mensagens nao aumentou o historico visivel.",
        "Renderizacao do stream pode estar falhando em mensagens consecutivas.",
        "Revalidar append/render de mensagens para envios em serie.",
        "Enviar 3 mensagens seguidas e confirmar crescimento de .message no DOM."
      ))
    }

    await waitComposerReady(page)
    await page.locator("#msg").fill("Stress rajada enter")
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press("Enter")
    }

    await page.waitForTimeout(800)
    const singleThinking = await page.evaluate(() => document.querySelectorAll("article[data-thinking='true']").length <= 1)
    checks.push({ name: "burst_enter_single_thinking", ok: singleThinking })

    if (!singleThinking) {
      issues.push(issue(
        "Rajada de Enter gerou multiplos estados de thinking.",
        "Bloqueio de envio concorrente nao esta protegendo a UI em cliques/teclas repetidas.",
        "Garantir guarda de estado isSending antes de criar thinking message.",
        "Pressionar Enter rapidamente e validar article[data-thinking='true'] <= 1."
      ))
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "groot-stress-"))
    const fileA = path.join(tempDir, "stress-a.txt")
    const fileB = path.join(tempDir, "stress-b.txt")
    await fs.writeFile(fileA, "anexo stress A", "utf8")
    await fs.writeFile(fileB, "anexo stress B", "utf8")

    await sendWithAttachment(page, fileA, "Mensagem com anexo A")
    await sendWithAttachment(page, fileB, "Mensagem com anexo B")

    await waitComposerReady(page)
    const attachmentHistoryStable = await page.evaluate(() => {
      const previewStillMounted = Boolean(document.querySelector(".composer-selected-file"))
      const sentChips = document.querySelectorAll(".message.user .sent-file-chip, .message.user .sent-file-card").length
      return !previewStillMounted && sentChips >= 2
    })
    checks.push({ name: "repeated_attachment_history_stable", ok: attachmentHistoryStable })

    if (!attachmentHistoryStable) {
      issues.push(issue(
        "Anexos repetidos deixaram preview preso ou nao apareceram corretamente no historico.",
        "O fluxo de limpeza do composer e a persistencia dos chips enviados podem estar fora de ordem.",
        "Garantir limpeza do preview apos cada envio e manter os arquivos no bubble da mensagem do usuario.",
        "Enviar dois anexos consecutivos e validar dois chips/cartoes de arquivo com preview limpo no composer."
      ))
    }

    mobile = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const mobilePage = await mobile.newPage()
    await mobilePage.goto(FRONTEND_URL, { waitUntil: "domcontentloaded" })
    await waitComposerReady(mobilePage, 30_000)

    let mobileFlowOk = false
    try {
      await mobilePage.waitForSelector("#mobileMenuBtn", { timeout: 15_000 })
      await mobilePage.evaluate(() => {
        const button = document.querySelector("#mobileMenuBtn")
        if (!button) return
        button.setAttribute("data-debug-clicks", "0")
        button.addEventListener("click", (event) => {
          const current = Number(button.getAttribute("data-debug-clicks") || "0")
          button.setAttribute("data-debug-clicks", String(current + 1))
          document.body.setAttribute("data-last-mobile-click-target", (event?.target && event.target.id) || "unknown")
        })
      })
      diagnostics.mobileBefore = await mobilePage.evaluate(() => ({
        buttonRect: document.querySelector("#mobileMenuBtn")?.getBoundingClientRect().toJSON?.() || null,
        appShellClass: document.querySelector("#appShell")?.className || "",
        scrimClass: document.querySelector("#sidebarScrim")?.className || "",
        buttonDisplay: getComputedStyle(document.querySelector("#mobileMenuBtn")).display,
        buttonVisibility: getComputedStyle(document.querySelector("#mobileMenuBtn")).visibility,
        sidebarTransform: getComputedStyle(document.querySelector("#sidebar")).transform,
        hitTargetAtCenter: (() => {
          const button = document.querySelector("#mobileMenuBtn")
          if (!button) return ""
          const rect = button.getBoundingClientRect()
          const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
          return target instanceof HTMLElement ? `${target.tagName.toLowerCase()}#${target.id}.${target.className}` : ""
        })()
      }))
      await mobilePage.click("#mobileMenuBtn")
      await mobilePage.waitForFunction(() => {
        const shell = document.querySelector("#appShell")
        return Boolean(shell && shell.classList.contains("sidebar-open"))
      }, undefined, { timeout: 10_000 })

      await mobilePage.click("#sidebarScrim")
      await mobilePage.waitForFunction(() => {
        const shell = document.querySelector("#appShell")
        return Boolean(shell && !shell.classList.contains("sidebar-open"))
      }, undefined, { timeout: 10_000 })

      mobileFlowOk = true
    } catch {
      mobileFlowOk = false
    } finally {
      diagnostics.mobileAfter = await mobilePage.evaluate(() => ({
        appShellClass: document.querySelector("#appShell")?.className || "",
        scrimClass: document.querySelector("#sidebarScrim")?.className || "",
        sidebarTransform: getComputedStyle(document.querySelector("#sidebar")).transform,
        buttonDebugClicks: document.querySelector("#mobileMenuBtn")?.getAttribute("data-debug-clicks") || "0",
        lastMobileClickTarget: document.body.getAttribute("data-last-mobile-click-target") || ""
      })).catch(() => null)
    }

    checks.push({ name: "mobile_open_close_quick", ok: mobileFlowOk })
    if (!mobileFlowOk) {
      issues.push(issue(
        "Fluxo mobile abrir/fechar sidebar falhou sob teste rapido.",
        "Sincronizacao de classes de estado pode estar inconsistente no mobile.",
        "Padronizar toggleSidebar e fechamento por scrim.",
        "Em 390x844, abrir por botao e fechar por scrim com sucesso."
      ))
    }
  }

  try {
    await execute()

    const report = createReport(checks, issues, steps, { diagnostics })
    await persistReport(report)

    console.log(`Runtime stress checks: ${report.summary.passed}/${report.summary.totalChecks} passed`)
    console.log(`Issues found: ${issues.length}`)
  } catch (error) {
    const report = createReport(
      checks,
      [
        ...issues,
        issue(
          "Falha ao executar stress runtime.",
          error instanceof Error ? error.message : "Erro inesperado",
          "Verificar readiness do backend/frontend e sincronismo de eventos do frontend sob carga.",
          "Executar npm run qa:stress-runtime e analisar logs recentes do report."
        )
      ],
      steps,
      {
        diagnostics: {
          ...diagnostics,
          backendLogs: formatRecentLogs(backendRuntime?.logs, 30),
          frontendLogs: formatRecentLogs(frontendRuntime?.logs, 30)
        }
      }
    )

    await persistReport(report)
    throw error
  } finally {
    if (mobile) {
      await mobile.close().catch(() => {})
    }
    if (context) {
      await context.close().catch(() => {})
    }
    if (browser) {
      await browser.close().catch(() => {})
    }
    await stopChildProcess(frontendRuntime?.child).catch(() => {})
    await stopChildProcess(backendRuntime?.child).catch(() => {})
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
