import { chromium } from "@playwright/test"
import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const FRONTEND_URL = "http://localhost:3002"
const BACKEND_URL = "http://localhost:3000"
const REPORT_PATH = path.join(process.cwd(), "reports", "runtime-ux-qa.json")

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function spawnCommand(command, args, options = {}) {
  if (process.platform === "win32") {
    const comspec = process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe"
    return spawn(comspec, ["/d", "/s", "/c", [command, ...args].join(" ")], options)
  }

  return spawn(command, args, options)
}

async function waitForServer(url, timeoutMs = 45000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return true
    } catch {
      // keep waiting
    }
    await sleep(500)
  }
  return false
}

function startDevServer() {
  const child = spawnCommand("npm", ["run", "dev"], {
    cwd: process.cwd(),
    stdio: "pipe",
    env: process.env
  })

  child.stdout.on("data", () => { })
  child.stderr.on("data", () => { })
  return child
}

function createIssue(problem, cause, fix, validate) {
  return {
    problem,
    cause,
    fix,
    validate
  }
}

async function waitComposerReady(page, timeout = 20000) {
  await page.waitForFunction(() => {
    const send = document.querySelector("#sendBtn")
    const msg = document.querySelector("#msg")
    return Boolean(send && msg && !send.disabled && !msg.disabled)
  }, { timeout })
}

async function run() {
  const issues = []
  const checks = []
  let server

  try {
    server = startDevServer()
    const backendUp = await waitForServer(`${BACKEND_URL}/health`)
    const frontendUp = await waitForServer(FRONTEND_URL)
    if (!backendUp || !frontendUp) {
      throw new Error("Frontend ou backend não subiram em tempo hábil para QA runtime")
    }

    const browser = await chromium.launch({ headless: true })

    const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await desktop.newPage()

    await page.goto(FRONTEND_URL, { waitUntil: "domcontentloaded" })

    await page.waitForSelector("#chat", { timeout: 8000 })
    checks.push({ name: "load_chat", ok: true })

    await page.locator("#msg").fill("Teste de fluxo runtime 1")
    await page.keyboard.press("Enter")

    const hasWorkingState = await page.waitForFunction(() => {
      const sendBtn = document.querySelector("#sendBtn")
      return Boolean(sendBtn?.classList.contains("is-working") || sendBtn?.disabled)
    }, { timeout: 2500 }).then(() => true).catch(() => false)

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

    await waitComposerReady(page, 20000)

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "groot-qa-"))
    const txtFile = path.join(tempDir, "qa-sample.txt")
    await fs.writeFile(txtFile, "arquivo de teste runtime", "utf8")

    await page.setInputFiles("#fileInput", txtFile)
    await page.waitForSelector("#filePreview .file-chip", { timeout: 4000 })

    const hasFileChip = await page.locator("#filePreview .file-chip").count()
    checks.push({ name: "attachment_chip", ok: hasFileChip > 0 })

    await page.locator("#msg").fill("Teste com anexo")
    await page.locator("#sendBtn").click()
    await page.waitForSelector(".chat-message.user .sent-file-chip", { timeout: 15000 }).catch(() => { })

    const sentFileChipVisible = await page.evaluate(() => Boolean(document.querySelector(".chat-message.user .sent-file-chip")))
    if (!sentFileChipVisible) {
      issues.push(createIssue(
        "Mensagem enviada com anexo não exibiu o arquivo no histórico do chat.",
        "O upload pode estar chegando ao backend sem refletir o nome do arquivo no bubble do usuário.",
        "Persistir uploadName/uploadNames na mensagem local antes da resposta final.",
        "Enviar arquivo e confirmar .sent-file-chip na mensagem do usuário."
      ))
    }
    checks.push({ name: "attachment_sent_chip", ok: sentFileChipVisible })

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
      await authButton.click({ timeout: 3000 }).catch(() => { })
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
      await page.locator("#closeAuthModalBtn").click({ timeout: 3000 }).catch(() => { })
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

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const mobilePage = await mobile.newPage()
    await mobilePage.goto(FRONTEND_URL, { waitUntil: "domcontentloaded" })
    const mobileMenuLocator = mobilePage.locator("#mobileMenuBtn")
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
      const opened = await mobilePage.evaluate(() => {
        const button = document.querySelector("#mobileMenuBtn")
        const shell = document.querySelector("#appShell")
        if (!button || !shell) return false
        button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
        return shell.classList.contains("sidebar-open")
      })

      checks.push({ name: "mobile_sidebar_open", ok: Boolean(opened) })

      let closed = false
      if (opened) {
        closed = await mobilePage.evaluate(() => {
          const scrim = document.querySelector("#sidebarScrim")
          const shell = document.querySelector("#appShell")
          if (!scrim || !shell) return false
          scrim.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
          return !shell.classList.contains("sidebar-open")
        })
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

    await desktop.close()
    await mobile.close()
    await browser.close()

    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl: FRONTEND_URL,
      checks,
      issues,
      summary: {
        totalChecks: checks.length,
        passed: checks.filter((entry) => entry.ok).length,
        failed: checks.filter((entry) => !entry.ok).length
      }
    }

    await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true })
    await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8")

    console.log(`Runtime QA checks: ${report.summary.passed}/${report.summary.totalChecks} passed`)
    console.log(`Issues found: ${issues.length}`)
  } finally {
    if (server && !server.killed) {
      server.kill()
    }
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
