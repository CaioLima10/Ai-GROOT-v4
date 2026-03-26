import { chromium } from "@playwright/test"
import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const BASE_URL = "http://localhost:3000"
const REPORT_PATH = path.join(process.cwd(), "reports", "runtime-ux-stress.json")

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

function issue(problem, cause, fix, validate) {
  return { problem, cause, fix, validate }
}

async function waitComposerReady(page, timeout = 20000) {
  await page.waitForFunction(() => {
    const send = document.querySelector("#sendBtn")
    const msg = document.querySelector("#msg")
    return Boolean(send && msg && !send.disabled && !msg.disabled)
  }, { timeout })
}

async function sendMessage(page, text) {
  await waitComposerReady(page)
  await page.locator("#msg").fill(text)
  await page.keyboard.press("Enter")
}

async function sendWithAttachment(page, filePath, text) {
  await waitComposerReady(page)
  await page.setInputFiles("#fileInput", filePath)
  await page.waitForSelector("#filePreview .file-chip", { timeout: 5000 })
  await page.locator("#msg").fill(text)
  await page.locator("#sendBtn").click()
}

async function run() {
  const checks = []
  const issues = []
  let server

  try {
    server = startDevServer()
    const serverUp = await waitForServer(`${BASE_URL}/health`)
    if (!serverUp) {
      throw new Error("Servidor não subiu em tempo hábil")
    }

    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()

    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" })
    await page.waitForSelector("#chat", { timeout: 10000 })

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
        "Sequência de mensagens não aumentou o histórico visível.",
        "Renderização do stream pode estar falhando em mensagens consecutivas.",
        "Revalidar append/render de mensagens para envios em série.",
        "Enviar 3 mensagens seguidas e confirmar crescimento de .message no DOM."
      ))
    }

    // 2) Rajada de Enter: não deve criar múltiplos thinking simultâneos
    await waitComposerReady(page)
    await page.locator("#msg").fill("Stress rajada enter")
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press("Enter")
    }

    await page.waitForTimeout(600)
    const singleThinking = await page.evaluate(() => document.querySelectorAll("article[data-thinking='true']").length <= 1)
    checks.push({ name: "burst_enter_single_thinking", ok: singleThinking })

    if (!singleThinking) {
      issues.push(issue(
        "Rajada de Enter gerou múltiplos estados de thinking.",
        "Bloqueio de envio concorrente não está protegendo a UI em cliques/teclas repetidas.",
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
    const noStuckUploading = await page.evaluate(() => !document.querySelector("#filePreview .file-chip.is-uploading"))
    checks.push({ name: "repeated_attachment_no_stuck_state", ok: noStuckUploading })

    if (!noStuckUploading) {
      issues.push(issue(
        "Estado de upload ficou preso após anexos repetidos.",
        "Limpeza do preview pode não estar ocorrendo no finally do fluxo de envio.",
        "Garantir clearPendingFile e reset visual após cada ciclo.",
        "Enviar dois anexos consecutivos e validar ausência de .is-uploading no final."
      ))
    }

    // 4) Responsividade funcional rápida
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const mobilePage = await mobile.newPage()
    await mobilePage.goto(BASE_URL, { waitUntil: "domcontentloaded" })
    const mobileFlowOk = await mobilePage.evaluate(() => {
      const button = document.querySelector("#mobileMenuBtn")
      const shell = document.querySelector("#appShell")
      const scrim = document.querySelector("#sidebarScrim")
      if (!button || !shell || !scrim) return false
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
      const opened = shell.classList.contains("sidebar-open")
      scrim.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
      const closed = !shell.classList.contains("sidebar-open")
      return opened && closed
    })

    checks.push({ name: "mobile_open_close_quick", ok: mobileFlowOk })
    if (!mobileFlowOk) {
      issues.push(issue(
        "Fluxo mobile abrir/fechar sidebar falhou sob teste rápido.",
        "Sincronização de classes de estado pode estar inconsistente no mobile.",
        "Padronizar toggleSidebar e fechamento por scrim.",
        "Em 390x844, abrir por botão e fechar por scrim com sucesso."
      ))
    }

    await mobile.close()
    await context.close()
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

    console.log(`Runtime stress checks: ${report.summary.passed}/${report.summary.totalChecks} passed`)
    console.log(`Issues found: ${issues.length}`)
  } finally {
    if (server && !server.killed) {
      server.kill()
    }
  }
}

run().catch(async (error) => {
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    checks: [],
    issues: [
      issue(
        "Falha ao executar stress runtime.",
        error.message || "Erro inesperado",
        "Verificar servidor local e dependências do Playwright.",
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
