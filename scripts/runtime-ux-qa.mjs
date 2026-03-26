import { chromium } from "@playwright/test"
import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const BASE_URL = "http://localhost:3000"
const REPORT_PATH = path.join(process.cwd(), "reports", "runtime-ux-qa.json")

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
  const child = spawn("npm run dev", {
    shell: true,
    cwd: process.cwd(),
    stdio: "pipe",
    env: process.env
  })

  child.stdout.on("data", () => {})
  child.stderr.on("data", () => {})
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

async function run() {
  const issues = []
  const checks = []
  let server

  try {
    server = startDevServer()
    const up = await waitForServer(`${BASE_URL}/health`)
    if (!up) {
      throw new Error("Servidor não subiu em tempo hábil para QA runtime")
    }

    const browser = await chromium.launch({ headless: true })

    const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await desktop.newPage()

    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" })

    await page.waitForSelector("#chat", { timeout: 8000 })
    checks.push({ name: "load_chat", ok: true })

    await page.locator("#msg").fill("Teste de fluxo runtime 1")
    await page.keyboard.press("Enter")

    await page.waitForTimeout(300)
    const hasWorkingState = await page.evaluate(() => {
      const sendBtn = document.querySelector("#sendBtn")
      return Boolean(sendBtn?.classList.contains("is-working"))
    })

    if (!hasWorkingState) {
      issues.push(createIssue(
        "Estado de loading do envio não ficou evidente no início da requisição.",
        "Transição de estado pode estar curta demais ou removida antes da primeira pintura.",
        "Manter classe is-working por no mínimo um frame visível e sincronizar com request start/end.",
        "Enviar mensagem e confirmar botão com estado de progresso por pelo menos 200ms."
      ))
    }
    checks.push({ name: "send_loading_state", ok: hasWorkingState })

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

    await page.waitForFunction(() => {
      const sendBtn = document.querySelector("#sendBtn")
      return Boolean(sendBtn && !sendBtn.disabled)
    }, { timeout: 15000 })

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "groot-qa-"))
    const txtFile = path.join(tempDir, "qa-sample.txt")
    await fs.writeFile(txtFile, "arquivo de teste runtime", "utf8")

    await page.setInputFiles("#fileInput", txtFile)
    await page.waitForSelector("#filePreview .file-chip", { timeout: 4000 })

    const hasFileChip = await page.locator("#filePreview .file-chip").count()
    checks.push({ name: "attachment_chip", ok: hasFileChip > 0 })

    await page.locator("#msg").fill("Teste com anexo")
    await page.locator("#sendBtn").click()
    await page.waitForTimeout(450)

    const chipUploading = await page.evaluate(() => Boolean(document.querySelector("#filePreview .file-chip.is-uploading")))
    if (!chipUploading) {
      issues.push(createIssue(
        "Chip de anexo não mostrou estado visual de upload durante envio.",
        "Render do preview pode estar sendo limpo cedo demais ou sem flag uploading.",
        "Renderizar chip com classe is-uploading e spinner até concluir uploadPendingFile.",
        "Anexar arquivo e confirmar classe is-uploading no preview durante requisição."
      ))
    }
    checks.push({ name: "attachment_upload_state", ok: chipUploading })

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
      const sidebar = document.querySelector(".sidebar")
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

    let settingsVisible = false
    const settingsLocator = page.locator('[data-view="settings"]')
    const settingsClickable = await settingsLocator.isVisible().catch(() => false)
    if (settingsClickable) {
      await settingsLocator.click({ timeout: 3000 }).catch(() => {})
      settingsVisible = await page.evaluate(() => {
        const settings = document.querySelector("#view-settings")
        return Boolean(settings && settings.classList.contains("active"))
      })
    }

    if (!settingsVisible) {
      const profileTrigger = page.locator("#profileTrigger")
      const profileVisible = await profileTrigger.isVisible().catch(() => false)
      if (profileVisible) {
        await profileTrigger.click({ timeout: 3000 }).catch(() => {})
        const settingsAction = page.locator('[data-action="profile-settings"]')
        const settingsActionVisible = await settingsAction.isVisible().catch(() => false)
        if (settingsActionVisible) {
          await settingsAction.click({ timeout: 3000 }).catch(() => {})
          settingsVisible = await page.evaluate(() => {
            const settings = document.querySelector("#view-settings")
            return Boolean(settings && settings.classList.contains("active"))
          })
        }
      }
    }

    checks.push({ name: "settings_navigation", ok: settingsVisible })
    if (!settingsVisible) {
      issues.push(createIssue(
        "Configurações não abriram por navegação direta nem via menu de perfil.",
        "Fluxo de acesso a settings está inconsistente entre estados visuais da interface.",
        "Garantir rota de acesso a settings funcional por ao menos um caminho sempre visível.",
        "Validar abertura de settings por sidebar e menu de perfil em estado anônimo e autenticado."
      ))
    }

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const mobilePage = await mobile.newPage()
    await mobilePage.goto(BASE_URL, { waitUntil: "domcontentloaded" })
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
      baseUrl: BASE_URL,
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
