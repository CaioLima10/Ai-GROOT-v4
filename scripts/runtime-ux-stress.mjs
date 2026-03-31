import { chromium } from "@playwright/test"
import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const FRONTEND_URL = "http://localhost:3002"
const BACKEND_URL = "http://localhost:3000"
const REPORT_PATH = path.join(process.cwd(), "reports", "runtime-ux-stress.json")

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

async function waitForAnyServer(urls, timeoutMs = 45000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    for (const url of urls) {
      try {
        const response = await fetch(url)
        if (response.ok) {
          return true
        }
      } catch {
        // keep waiting
      }
    }
    await sleep(500)
  }
  return false
}

function startNpmScript(scriptName) {
  const child = spawnCommand("npm", ["run", scriptName], {
    cwd: process.cwd(),
    stdio: "pipe",
    env: process.env
  })

  child.stdout.on("data", () => { })
  child.stderr.on("data", () => { })
  return child
}

function issue(problem, cause, fix, validate) {
  return { problem, cause, fix, validate }
}

async function waitComposerReady(page, timeout = 120000) {
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
  await page.waitForSelector(".composer-selected-file", { timeout: 20000 })
  await page.locator("#msg").fill(text)
  await page.locator("#sendBtn").click()
}

async function run() {
  const checks = []
  const issues = []
  let frontendServer = null
  let backendServer = null

  try {
    const backendUpInitially = await waitForAnyServer([
      `${BACKEND_URL}/capabilities`,
      `${BACKEND_URL}/config`,
      `${BACKEND_URL}/health`
    ], 8000)

    if (!backendUpInitially) {
      backendServer = startNpmScript("dev:api")
      const backendUp = await waitForAnyServer([
        `${BACKEND_URL}/capabilities`,
        `${BACKEND_URL}/config`,
        `${BACKEND_URL}/health`
      ], 90000)

      if (!backendUp) {
        throw new Error("Backend nao subiu em tempo habil")
      }
    }

    const frontendUpInitially = await waitForServer(FRONTEND_URL, 8000)
    if (!frontendUpInitially) {
      frontendServer = startNpmScript("dev:web")
      const frontendUp = await waitForServer(FRONTEND_URL, 90000)
      if (!frontendUp) {
        throw new Error("Frontend nao subiu em tempo habil")
      }
    }

    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()

    await page.goto(FRONTEND_URL, { waitUntil: "domcontentloaded" })
    await page.waitForSelector("#chat", { timeout: 30000 })
    await waitComposerReady(page)

    const beforeCount = await page.evaluate(() => document.querySelectorAll(".message").length)

    // 1) Sequencia de mensagens normais
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

    // 2) Rajada de Enter: nao deve criar multiplos thinking simultaneos
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

    // 3) Envio com anexos repetidos
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

    // 4) Responsividade funcional rapida
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const mobilePage = await mobile.newPage()
    await mobilePage.goto(FRONTEND_URL, { waitUntil: "domcontentloaded" })

    let mobileFlowOk = false
    try {
      await mobilePage.waitForSelector("#mobileMenuBtn", { timeout: 15000 })
      await mobilePage.click("#mobileMenuBtn")
      await mobilePage.waitForFunction(() => {
        const shell = document.querySelector("#appShell")
        return Boolean(shell && shell.classList.contains("sidebar-open"))
      }, undefined, { timeout: 10000 })

      await mobilePage.click("#sidebarScrim")
      await mobilePage.waitForFunction(() => {
        const shell = document.querySelector("#appShell")
        return Boolean(shell && !shell.classList.contains("sidebar-open"))
      }, undefined, { timeout: 10000 })

      mobileFlowOk = true
    } catch {
      mobileFlowOk = false
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

    await mobile.close()
    await context.close()
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

    console.log(`Runtime stress checks: ${report.summary.passed}/${report.summary.totalChecks} passed`)
    console.log(`Issues found: ${issues.length}`)
  } finally {
    if (frontendServer && !frontendServer.killed) {
      frontendServer.kill()
    }
    if (backendServer && !backendServer.killed) {
      backendServer.kill()
    }
  }
}

run().catch(async (error) => {
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: FRONTEND_URL,
    checks: [],
    issues: [
      issue(
        "Falha ao executar stress runtime.",
        error.message || "Erro inesperado",
        "Verificar servidor local e dependencias do Playwright.",
        "Executar npm run qa:stress-runtime e analisar logs."
      )
    ],
    summary: {
      totalChecks: 0,
      passed: 0,
      failed: 1
    }
  }

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true })
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8")
  console.error(error)
  process.exit(1)
})
