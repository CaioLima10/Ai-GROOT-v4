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
const REPORT_PATH = path.join(process.cwd(), "reports", "runtime-ux-qa.json")

function createIssue(problem, cause, fix, validate) {
  return {
    problem,
    cause,
    fix,
    validate
  }
}

async function persistReport(report) {
  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true })
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8")
}

async function waitComposerReady(page, timeout = 20_000) {
  await page.waitForFunction(() => {
    const msg = document.querySelector("#msg")
    const fileInput = document.querySelector("#fileInput")
    return Boolean(msg && !msg.disabled && fileInput)
  }, undefined, { timeout })
}

function createRuntimeSummary(checks, issues, steps, extras = {}) {
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
  const issues = []
  const checks = []
  const steps = []
  let backendRuntime = null
  let frontendRuntime = null
  let browser = null
  let desktop = null
  let mobile = null

  const markStep = (name, details = "ok") => {
    const entry = {
      name,
      details,
      at: new Date().toISOString()
    }
    steps.push(entry)
    console.log(`[QA] ${name} -> ${details}`)
  }

  const backendReadyUrls = [
    `${BACKEND_URL}/config`,
    `${BACKEND_URL}/capabilities`,
    `${BACKEND_URL}/health`
  ]

  const runChecks = async () => {
    const backendUpInitially = await waitForAnyUrl(backendReadyUrls, {
      timeoutMs: 8_000,
      accept: (response) => response.status >= 200 && response.status < 600
    })

    if (!backendUpInitially) {
      backendRuntime = startNodeProcess("apps/api/src/server.js", {
        label: "qa-backend",
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
        throw new Error(`Backend nao subiu em tempo habil em ${BACKEND_URL}`)
      }
    } else {
      markStep("backend_start", "reusing existing backend")
    }

    const frontendUpInitially = await waitForUrl(FRONTEND_URL, { timeoutMs: 8_000 })
    if (!frontendUpInitially) {
      frontendRuntime = startNpmProcess(["--workspace", "web-next", "run", "dev", "--", "-p", String(frontendPort)], {
        label: "qa-frontend"
      })
      markStep("frontend_start", `spawned pid=${frontendRuntime.child.pid}`)

      const frontendUp = await waitForUrl(FRONTEND_URL, { timeoutMs: 120_000 })
      if (!frontendUp) {
        throw new Error(`Frontend nao subiu em tempo habil em ${FRONTEND_URL}`)
      }
    } else {
      markStep("frontend_start", "reusing existing frontend")
    }

    browser = await chromium.launch({ headless: true })
    markStep("browser_launch")

    desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await desktop.newPage()

    await page.goto(FRONTEND_URL, { waitUntil: "domcontentloaded" })
    await page.waitForSelector("#chat", { timeout: 8_000 })
    checks.push({ name: "load_chat", ok: true })
    markStep("desktop_load_chat")

    await page.locator("#msg").fill("Teste de fluxo runtime 1")
    await page.keyboard.press("Enter")

    const hasWorkingState = await page.waitForFunction(() => {
      const sendBtn = document.querySelector("#sendBtn")
      return Boolean(sendBtn?.classList.contains("is-working") || sendBtn?.disabled)
    }, undefined, { timeout: 2_500 }).then(() => true).catch(() => false)

    if (!hasWorkingState) {
      issues.push(createIssue(
        "Estado de loading do envio não ficou evidente no início da requisição.",
        "Transição de estado pode estar curta demais ou removida antes da primeira pintura.",
        "Manter classe is-working sincronizada com o início e o fim da requisição.",
        "Enviar mensagem e confirmar botão com estado de progresso logo após o submit."
      ))
    }
    checks.push({ name: "send_loading_state", ok: hasWorkingState })

    await page.waitForTimeout(250)
    const thinkingCount = await page.evaluate(() => document.querySelectorAll("article[data-thinking='true']").length)
    if (thinkingCount > 1) {
      issues.push(createIssue(
        "Animação de pensando duplicada detectada.",
        "Mais de uma instância de thinking bubble montada simultaneamente.",
        "Garantir unicidade removendo instância anterior antes de appendThinkingMessage.",
        "Disparar mensagens rápidas e validar no DOM que article[data-thinking='true'] <= 1."
      ))
    }
    checks.push({ name: "thinking_single_instance", ok: thinkingCount <= 1 })

    await waitComposerReady(page, 20_000)
    markStep("desktop_first_response_ready")

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "groot-qa-"))
    const txtFile = path.join(tempDir, "qa-sample.txt")
    await fs.writeFile(txtFile, "arquivo de teste runtime", "utf8")

    await page.setInputFiles("#fileInput", txtFile)
    await page.waitForSelector(".composer-selected-file", { timeout: 4_000 })

    const hasFileChip = await page.locator(".composer-selected-file").count()
    checks.push({ name: "attachment_chip", ok: hasFileChip > 0 })

    await page.locator("#msg").fill("Teste com anexo")
    await page.locator("#sendBtn").click()
    await page.waitForSelector(".chat-message.user .sent-file-chip, .chat-message.user .sent-file-card", { timeout: 15_000 }).catch(() => {})

    const sentFileChipVisible = await page.evaluate(() => Boolean(
      document.querySelector(".chat-message.user .sent-file-chip, .chat-message.user .sent-file-card")
    ))
    if (!sentFileChipVisible) {
      issues.push(createIssue(
        "Mensagem enviada com anexo não exibiu o arquivo no histórico do chat.",
        "O upload pode estar chegando ao backend sem refletir o nome do arquivo no bubble do usuário.",
        "Persistir uploadName/uploadNames na mensagem local antes da resposta final.",
        "Enviar arquivo e confirmar .sent-file-chip ou .sent-file-card na mensagem do usuário."
      ))
    }
    checks.push({ name: "attachment_sent_chip", ok: sentFileChipVisible })

    await waitComposerReady(page, 30_000)
    markStep("desktop_attachment_response_ready")

    await page.evaluate(() => {
      const list = document.querySelector("#chatStreamInner")
      if (!list) return
      for (let index = 0; index < 35; index += 1) {
        const node = document.createElement("div")
        node.textContent = `mock message ${index}`
        node.style.padding = "14px"
        node.style.margin = "8px 0"
        node.style.borderRadius = "12px"
        node.style.background = "rgba(255,255,255,0.04)"
        list.appendChild(node)
      }
      const chat = document.querySelector("#chat")
      if (chat) {
        chat.scrollTop = 0
        chat.dispatchEvent(new Event("scroll"))
      }
    })

    await page.waitForTimeout(200)
    const scrollContext = await page.evaluate(() => {
      const chat = document.querySelector("#chat")
      const button = document.querySelector("#scrollBottomBtn")
      if (!chat || !button) {
        return { hasOverflow: false, visible: false }
      }
      const hasOverflow = chat.scrollHeight > chat.clientHeight + 12
      const visible = !button.classList.contains("hidden")
      return { hasOverflow, visible }
    })

    if (scrollContext.hasOverflow && !scrollContext.visible) {
      issues.push(createIssue(
        "Botão de ir para o fim não apareceu com chat longe do final.",
        "Threshold de visibilidade do scroll pode estar alto ou evento de scroll não sincronizou.",
        "Revalidar syncScrollButton com cálculo de remaining e trigger em todo scroll.",
        "Popular chat, subir para o topo e verificar botão visível."
      ))
    }
    checks.push({ name: "scroll_button_visibility", ok: !scrollContext.hasOverflow || scrollContext.visible })

    if (scrollContext.visible) {
      await page.locator("#scrollBottomBtn").click()
      await page.waitForTimeout(300)
      const atBottom = await page.evaluate(() => {
        const chat = document.querySelector("#chat")
        if (!chat) return false
        const remaining = chat.scrollHeight - chat.scrollTop - chat.clientHeight
        return remaining < 24
      })
      checks.push({ name: "scroll_to_bottom_action", ok: atBottom })
      if (!atBottom) {
        issues.push(createIssue(
          "Ação do botão de scroll não levou ao final do chat.",
          "scrollChatToBottom pode não estar sendo forçado em clique manual.",
          "No clique, chamar scrollChatToBottom com force=true.",
          "Clicar botão e validar remaining < 24 no container #chat."
        ))
      }
    }

    const sidebarStable = await page.evaluate(async () => {
      const sidebar = document.querySelector("#sidebar")
      const chat = document.querySelector("#chat")
      if (!sidebar || !chat) return false
      const before = sidebar.getBoundingClientRect().top
      chat.scrollTop = chat.scrollHeight
      chat.dispatchEvent(new Event("scroll"))
      await new Promise((resolve) => setTimeout(resolve, 120))
      const after = sidebar.getBoundingClientRect().top
      return Math.abs(before - after) < 2
    })
    checks.push({ name: "sidebar_position_stable", ok: sidebarStable })

    if (!sidebarStable) {
      issues.push(createIssue(
        "Sidebar desloca durante scroll do chat.",
        "Posicionamento da coluna lateral pode estar acoplado ao fluxo rolável.",
        "Isolar área rolável somente no chat e manter sidebar fora do container com overflow.",
        "Rolar o chat ao máximo e medir top da sidebar antes/depois."
      ))
    }

    let authModalVisible = false
    const authButton = page.locator("#topAuthLoginBtn")
    const authButtonVisible = await authButton.isVisible().catch(() => false)
    if (authButtonVisible) {
      await authButton.click({ timeout: 3_000 }).catch(() => {})
      authModalVisible = await page.locator("#authModal").isVisible().catch(() => false)
    }

    checks.push({ name: "auth_modal_open", ok: authModalVisible })
    if (!authModalVisible) {
      issues.push(createIssue(
        "Modal de autenticacao não abriu a partir do CTA principal.",
        "Fluxo guest pode estar sem gatilho visível ou sem troca de estado para a modal.",
        "Garantir que o CTA de login abra a modal em qualquer viewport.",
        "Clicar no botão de login e validar #authModal visível."
      ))
    }

    let authModalClosed = false
    if (authModalVisible) {
      await page.locator("#closeAuthModalBtn").click({ timeout: 3_000 }).catch(() => {})
      await page.waitForTimeout(150)
      authModalClosed = await page.locator("#authModal").isHidden().catch(() => false)
    }

    checks.push({ name: "auth_modal_close", ok: authModalClosed })
    if (authModalVisible && !authModalClosed) {
      issues.push(createIssue(
        "Modal de autenticacao abriu, mas não fechou pelo botão principal.",
        "Estado local da modal pode estar sem sincronismo com o botão de fechar.",
        "Garantir que o botão Fechar sempre desmonte o diálogo.",
        "Abrir #authModal e fechar por #closeAuthModalBtn."
      ))
    }

    mobile = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const mobilePage = await mobile.newPage()
    await mobilePage.goto(FRONTEND_URL, { waitUntil: "domcontentloaded" })
    await waitComposerReady(mobilePage, 30_000)
    const mobileMenuLocator = mobilePage.locator("#mobileMenuBtn")
    await mobilePage.waitForSelector("#mobileMenuBtn", { timeout: 15_000 }).catch(() => {})
    const mobileMenuAvailable = await mobileMenuLocator.isVisible().catch(() => false)

    if (!mobileMenuAvailable) {
      checks.push({ name: "mobile_sidebar_open", ok: false })
      checks.push({ name: "mobile_sidebar_close", ok: false })
      issues.push(createIssue(
        "Controle de menu mobile não ficou disponível na viewport pequena.",
        "Botão de abertura da sidebar está oculto por regra de estado/layout.",
        "Garantir que #mobileMenuBtn fique acessível em telas mobile.",
        "Abrir em 390x844 e validar botão de menu visível e clicável."
      ))
    } else {
      let opened = false
      try {
        await mobileMenuLocator.click({ timeout: 5_000 })
        await mobilePage.waitForFunction(() => {
          const shell = document.querySelector("#appShell")
          return Boolean(shell && shell.classList.contains("sidebar-open"))
        }, undefined, { timeout: 10_000 })
        opened = true
      } catch {
        opened = false
      }

      checks.push({ name: "mobile_sidebar_open", ok: Boolean(opened) })

      let closed = false
      if (opened) {
        try {
          await mobilePage.locator("#sidebarScrim").click({ timeout: 5_000 })
          await mobilePage.waitForFunction(() => {
            const shell = document.querySelector("#appShell")
            return Boolean(shell && !shell.classList.contains("sidebar-open"))
          }, undefined, { timeout: 10_000 })
          closed = true
        } catch {
          closed = false
        }
      }

      checks.push({ name: "mobile_sidebar_close", ok: Boolean(closed) })

      if (!opened || !closed) {
        issues.push(createIssue(
          "Sidebar mobile não abre/fecha com consistência.",
          "Classe sidebar-open pode não estar sincronizada com scrim e botão.",
          "Padronizar toggleSidebar para mobile e fechar por scrim/Escape.",
          "Abrir menu no mobile e fechar no scrim, validando classe do app shell."
        ))
      }
    }
  }

  try {
    await runChecks()

    const report = createRuntimeSummary(checks, issues, steps)
    await persistReport(report)

    console.log(`Runtime QA checks: ${report.summary.passed}/${report.summary.totalChecks} passed`)
    console.log(`Issues found: ${issues.length}`)
  } catch (error) {
    const report = createRuntimeSummary(
      checks,
      [
        ...issues,
        createIssue(
          "Falha ao executar QA runtime.",
          error instanceof Error ? error.message : "Erro inesperado",
          "Verificar readiness do backend/frontend, seletores do frontend e lifecycle de processos do QA.",
          "Executar npm run qa:runtime e analisar logs recentes do report."
        )
      ],
      steps,
      {
        diagnostics: {
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
    if (desktop) {
      await desktop.close().catch(() => {})
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
