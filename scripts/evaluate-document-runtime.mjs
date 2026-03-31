import { spawn } from "child_process"
import { createWriteStream } from "fs"
import fs from "fs/promises"
import path from "path"
import dotenv from "dotenv"
import PDFDocument from "pdfkit"
import { generateStructuredDocument } from "../packages/ai-core/src/index.js"

dotenv.config()

const SERVER_PORT = Number(process.env.GIOM_DOCUMENT_EVAL_PORT || (3301 + (process.pid % 300)))
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`
const SERVER_ENTRY = "apps/api/dist/server.js"
const REPORT_PATH = path.join(process.cwd(), "reports", "document-runtime-battery.json")
const FIXTURE_DIR = path.join(process.cwd(), "tmp_document_runtime_eval")
const USER_ID = "document_runtime_battery"
const POWERSHELL = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runPowerShell(script, errorPrefix = "Falha no PowerShell") {
  await new Promise((resolve, reject) => {
    const child = spawn(POWERSHELL, ["-NoProfile", "-Command", script], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"]
    })
    let stderr = ""
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk || "")
    })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(stderr.trim() || `${errorPrefix} (${code})`))
    })
  })
}

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function extractAnswer(payload = {}) {
  if (!payload || typeof payload !== "object") return ""
  return String(
    payload.answer ||
    payload.response ||
    payload?.data?.response ||
    payload?.data?.answer ||
    ""
  ).trim()
}

function buildHistoryMessages(turns = []) {
  const history = []
  for (const turn of turns) {
    history.push({ role: "user", content: turn.question })
    history.push({ role: "assistant", content: turn.answer })
  }
  return history
}

function includesAll(text = "", fragments = []) {
  const normalized = normalizeText(text)
  return fragments.every((fragment) => normalized.includes(normalizeText(fragment)))
}

function includesAny(text = "", fragments = []) {
  const normalized = normalizeText(text)
  return fragments.some((fragment) => normalized.includes(normalizeText(fragment)))
}

async function waitForServer(timeoutMs = 15000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${SERVER_URL}/health`)
      if (response.ok) {
        return
      }
    } catch {
      // servidor ainda nao subiu
    }

    await delay(500)
  }

  throw new Error("Servidor nao respondeu dentro do tempo limite")
}

async function uploadDocument(document, userId = USER_ID) {
  const response = await fetch(`${SERVER_URL}/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": userId
    },
    body: JSON.stringify({
      name: document.fileName,
      type: document.mimeType,
      data: document.base64
    })
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.error || `Falha no upload (${response.status})`)
  }

  return payload
}

async function askDocument(question, context = {}, userId = USER_ID) {
  const response = await fetch(`${SERVER_URL}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": userId
    },
    body: JSON.stringify({
      question,
      context
    })
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.error || `Falha no /ask (${response.status})`)
  }

  return {
    payload,
    answer: extractAnswer(payload)
  }
}

async function ensureFixtureDir() {
  await fs.mkdir(FIXTURE_DIR, { recursive: true })
}

async function writeDocumentToDisk(document) {
  await ensureFixtureDir()
  const filePath = path.join(FIXTURE_DIR, document.fileName)
  await fs.writeFile(filePath, Buffer.from(document.base64, "base64"))
  return filePath
}

async function generatePngFixture(filePath, text = "") {
  if (process.platform !== "win32") {
    return false
  }

  const escapedPath = String(filePath).replace(/\\/g, "\\\\").replace(/'/g, "''")
  const escapedText = String(text || "").replace(/'/g, "''")
  const script = [
    "Add-Type -AssemblyName System.Drawing",
    `$bmp = New-Object System.Drawing.Bitmap 1100, 280`,
    "$graphics = [System.Drawing.Graphics]::FromImage($bmp)",
    "$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias",
    "$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit",
    "$graphics.Clear([System.Drawing.Color]::White)",
    `if ('${escapedText}'.Length -gt 0) {`,
    "  $font = New-Object System.Drawing.Font('Arial', 46, [System.Drawing.FontStyle]::Bold)",
    "  $brush = [System.Drawing.Brushes]::Black",
    `  $graphics.DrawString('${escapedText}', $font, $brush, 48, 92)`,
    "}",
    `$bmp.Save('${escapedPath}', [System.Drawing.Imaging.ImageFormat]::Png)`,
    "$graphics.Dispose()",
    "$bmp.Dispose()"
  ].join("; ")

  await runPowerShell(script, "Falha ao gerar PNG")

  return true
}

async function buildImageDocument(fileName, text) {
  await ensureFixtureDir()
  const filePath = path.join(FIXTURE_DIR, fileName)
  const created = await generatePngFixture(filePath, text)
  if (!created) {
    return null
  }

  const buffer = await fs.readFile(filePath)
  return {
    fileName,
    mimeType: "image/png",
    base64: buffer.toString("base64")
  }
}

async function buildScannedPdfDocument(fileName, text) {
  await ensureFixtureDir()
  const imageFileName = `${sanitizeFileStem(fileName) || "scanned-pdf"}.png`
  const imagePath = path.join(FIXTURE_DIR, imageFileName)
  const created = await generatePngFixture(imagePath, text)
  if (!created) {
    return null
  }

  const pdfPath = path.join(FIXTURE_DIR, fileName)
  await fs.rm(pdfPath, { force: true }).catch(() => { })

  await new Promise((resolve, reject) => {
    const stream = createWriteStream(pdfPath)
    const doc = new PDFDocument({ autoFirstPage: false })
    let settled = false

    const finish = (error = null) => {
      if (settled) return
      settled = true
      if (error) {
        reject(error)
        return
      }
      resolve()
    }

    stream.on("finish", () => finish())
    stream.on("error", finish)
    doc.on("error", finish)
    doc.pipe(stream)
    doc.addPage({ size: "A4", margin: 0 })
    doc.image(imagePath, 0, 0, {
      fit: [doc.page.width, doc.page.height],
      align: "center",
      valign: "center"
    })
    doc.end()
  })

  const buffer = await fs.readFile(pdfPath)
  return {
    fileName,
    mimeType: "application/pdf",
    base64: buffer.toString("base64")
  }
}

function sanitizeFileStem(value = "") {
  return String(value || "")
    .replace(/\.[^.]+$/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "runtime-archive"
}

async function buildZipDocument(fileName, files = []) {
  if (process.platform !== "win32") {
    return null
  }

  await ensureFixtureDir()
  const archiveDir = path.join(FIXTURE_DIR, sanitizeFileStem(fileName))
  await fs.rm(archiveDir, { recursive: true, force: true }).catch(() => { })
  await fs.mkdir(archiveDir, { recursive: true })

  for (const file of files) {
    const targetPath = path.join(archiveDir, file.name)
    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.writeFile(targetPath, String(file.content || ""), "utf8")
  }

  const zipPath = path.join(FIXTURE_DIR, fileName)
  await fs.rm(zipPath, { force: true }).catch(() => { })
  const escapedSource = archiveDir.replace(/'/g, "''")
  const escapedZip = zipPath.replace(/'/g, "''")
  await runPowerShell(`Compress-Archive -Path '${escapedSource}\\*' -DestinationPath '${escapedZip}' -Force`, "Falha ao gerar ZIP")

  const buffer = await fs.readFile(zipPath)
  return {
    fileName,
    mimeType: "application/zip",
    base64: buffer.toString("base64")
  }
}

function getSharedContext(upload, history = []) {
  return {
    uploadId: upload.id,
    uploadName: upload.name,
    uploadType: upload.type,
    conversationHistory: buildHistoryMessages(history),
    assistantProfile: "concise_operator",
    activeModules: ["developer", "research"],
    instructions: "Baseie-se somente no arquivo enviado. Se a leitura estiver parcial ou sem OCR confiavel, diga isso claramente e nao invente detalhes.",
    preferredResponseVariant: "text"
  }
}

function buildScenarioDefinitions(imageFixtures = {}) {
  const narrativeContent = [
    "Projeto: bateria documental do GIOM.",
    "Objetivo principal: validar leitura fiel de anexos no runtime.",
    "Prioridades:",
    "1. Clareza de resposta.",
    "2. Memoria de follow-up.",
    "3. Honestidade quando a leitura vier parcial."
  ].join("\n")

  const spreadsheetContent = [
    "Tarefa,Responsavel,Status",
    "Leitura documental,GIOM,ativo",
    "OCR local,GIOM,em teste",
    "Follow-up,GIOM,obrigatorio"
  ].join("\n")

  const presentationContent = [
    "Diretriz central: responder sem inventar.",
    "",
    "Passos:",
    "1. Ler o anexo.",
    "2. Dizer o que realmente foi extraido.",
    "3. Admitir limite quando o texto nao estiver confiavel."
  ].join("\n")

  const markdownContent = [
    "# Guia de leitura documental",
    "",
    "Mensagem central: responder com base no anexo real.",
    "",
    "Checklist:",
    "1. Ler o arquivo inteiro.",
    "2. Responder a pergunta real do usuario.",
    "3. Admitir limite quando a extracao falhar."
  ].join("\n")

  const htmlContent = [
    "<h1>Painel documental</h1>",
    "<p>Mensagem-chave: responder com base no conteudo real do arquivo.</p>",
    "<p>Encerramento: se o arquivo estiver parcial, dizer isso claramente.</p>"
  ].join("\n")

  const jsonContent = JSON.stringify({
    pipeline: {
      ocr: {
        status: "ativo",
        mode: "local"
      },
      upload: {
        policy: "nao inventar detalhes ausentes"
      },
      scoreTarget: 0.98
    },
    review: {
      owner: "GIOM QA"
    }
  }, null, 2)

  const longPdfContent = Array.from({ length: 6 }, (_, index) => [
    `Secao ${index + 1}: bloco operacional ${index + 1}.`,
    "Diagnostico: respostas genericas atrapalham a leitura fiel do anexo.",
    "Risco: misturar a pergunta original com texto colado do arquivo.",
    "Acao: responder usando o conteudo realmente extraido."
  ].join("\n")).join("\n\n") + "\n\nConclusao final: a leitura deve priorizar a pergunta original do usuario e evitar respostas genericas."

  return [
    {
      id: "txt_followup",
      description: "Texto puro com follow-up contextual",
      buildDocument: async () => generateStructuredDocument({
        format: "txt",
        title: "bateria-texto",
        content: narrativeContent,
        fileNameBase: "battery-text"
      }),
      turns: [
        {
          question: "Qual e o objetivo principal do arquivo?",
          assert: (answer) => includesAll(answer, ["validar", "leitura", "anexos"])
        },
        {
          question: "Agora liste as tres prioridades em itens curtos.",
          assert: (answer) => includesAll(answer, ["clareza", "memoria", "honestidade"])
        }
      ]
    },
    {
      id: "pdf_followup",
      description: "PDF textual com pergunta direta e resumo",
      buildDocument: async () => generateStructuredDocument({
        format: "pdf",
        title: "bateria-pdf",
        content: narrativeContent,
        fileNameBase: "battery-pdf"
      }),
      turns: [
        {
          question: "O que o arquivo quer validar?",
          assert: (answer) => includesAll(answer, ["leitura", "anexos"])
        },
        {
          question: "Resuma isso em uma frase curta.",
          assert: (answer) => includesAny(answer, ["leitura fiel", "anexos", "runtime"])
        }
      ]
    },
    {
      id: "pdf_longform",
      description: "PDF longo com conclusao final explicita",
      buildDocument: async () => generateStructuredDocument({
        format: "pdf",
        title: "bateria-pdf-longo",
        content: longPdfContent,
        fileNameBase: "battery-pdf-long"
      }),
      turns: [
        {
          question: "Qual e a conclusao final do relatorio?",
          assert: (answer) => includesAll(answer, ["pergunta original", "respostas genericas"])
        }
      ]
    },
    {
      id: "docx_roundtrip",
      description: "DOCX textual",
      buildDocument: async () => generateStructuredDocument({
        format: "docx",
        title: "bateria-docx",
        content: narrativeContent,
        fileNameBase: "battery-docx"
      }),
      turns: [
        {
          question: "Quais sao as prioridades do documento?",
          assert: (answer) => includesAll(answer, ["clareza", "memoria", "honestidade"])
        }
      ]
    },
    {
      id: "markdown_followup",
      description: "Markdown com checklist e follow-up semantico",
      buildDocument: async () => generateStructuredDocument({
        format: "md",
        title: "bateria-markdown",
        content: markdownContent,
        fileNameBase: "battery-markdown"
      }),
      turns: [
        {
          question: "Qual e a mensagem central do markdown?",
          assert: (answer) => includesAll(answer, ["anexo real"])
        },
        {
          question: "Qual item fala sobre falha na extracao?",
          assert: (answer) => includesAll(answer, ["admitir", "extracao"])
        }
      ]
    },
    {
      id: "html_roundtrip",
      description: "HTML com mensagem-chave e encerramento",
      buildDocument: async () => generateStructuredDocument({
        format: "html",
        title: "bateria-html",
        content: htmlContent,
        fileNameBase: "battery-html"
      }),
      turns: [
        {
          question: "Qual e a mensagem-chave do HTML?",
          assert: (answer) => includesAll(answer, ["conteudo real", "arquivo"])
        },
        {
          question: "Como o HTML orienta o encerramento?",
          assert: (answer) => includesAll(answer, ["parcial", "claramente"])
        }
      ]
    },
    {
      id: "json_lookup",
      description: "JSON com politica de upload e meta de score",
      buildDocument: async () => generateStructuredDocument({
        format: "json",
        title: "bateria-json",
        content: jsonContent,
        fileNameBase: "battery-json"
      }),
      turns: [
        {
          question: "Qual e o status do OCR no JSON?",
          assert: (answer) => includesAll(answer, ["ativo"])
        },
        {
          question: "Qual politica de upload aparece no JSON?",
          assert: (answer) => includesAll(answer, ["nao inventar", "detalhes ausentes"])
        }
      ]
    },
    {
      id: "xlsx_lookup",
      description: "Planilha com lookup simples",
      buildDocument: async () => generateStructuredDocument({
        format: "xlsx",
        title: "bateria-planilha",
        content: spreadsheetContent,
        fileNameBase: "battery-sheet"
      }),
      turns: [
        {
          question: "Qual item esta com status em teste?",
          assert: (answer) => includesAll(answer, ["ocr", "teste"])
        },
        {
          question: "Qual item esta marcado como obrigatorio?",
          assert: (answer) => includesAll(answer, ["follow", "obrigatorio"])
        }
      ]
    },
    {
      id: "pptx_lookup",
      description: "Apresentacao com diretriz central",
      buildDocument: async () => generateStructuredDocument({
        format: "pptx",
        title: "bateria-pptx",
        content: presentationContent,
        fileNameBase: "battery-presentation"
      }),
      turns: [
        {
          question: "Qual e a diretriz central da apresentacao?",
          assert: (answer) => includesAll(answer, ["responder", "inventar"])
        }
      ]
    },
    {
      id: "svg_roundtrip",
      description: "SVG textual",
      buildDocument: async () => generateStructuredDocument({
        format: "svg",
        title: "bateria-svg",
        content: presentationContent,
        fileNameBase: "battery-svg"
      }),
      turns: [
        {
          question: "Qual orientacao principal aparece nesse arquivo?",
          assert: (answer) => includesAll(answer, ["inventar"])
        }
      ]
    },
    {
      id: "zip_mixed",
      description: "ZIP com TXT e JSON para leitura combinada",
      buildDocument: async () => buildZipDocument("battery-archive.zip", [
        {
          name: "nota.txt",
          content: "Resumo do ZIP: o sistema deve responder com base no arquivo certo."
        },
        {
          name: "dados/checklist.json",
          content: JSON.stringify({
            honestidade: "dizer quando o texto nao estiver confiavel"
          }, null, 2)
        }
      ]),
      turns: [
        {
          question: "O que o ZIP diz sobre a base da resposta?",
          assert: (answer) => includesAll(answer, ["arquivo certo"])
        },
        {
          question: "Qual orientacao de honestidade aparece no ZIP?",
          assert: (answer) => includesAll(answer, ["texto", "nao estiver confiavel"])
        }
      ]
    },
    imageFixtures.ocrPositive ? {
      id: "ocr_positive",
      description: "Imagem com OCR positivo",
      buildDocument: async () => imageFixtures.ocrPositive,
      turns: [
        {
          question: "Qual frase aparece na imagem?",
          assert: (answer) => includesAll(answer, ["paz", "graca"])
        }
      ]
    } : null,
    imageFixtures.ocrUiLike ? {
      id: "ocr_ui_honesty",
      description: "Imagem com textos de interface sem permitir inferencia solta",
      buildDocument: async () => imageFixtures.ocrUiLike,
      turns: [
        {
          question: "O que voce consegue confirmar sobre a imagem?",
          assert: (answer) => (
            includesAll(answer, ["novo chat", "pergunte"])
            && includesAny(answer, ["nao vou afirmar", "nao confirma", "nao conclua", "nao vou concluir"])
            && !includesAny(answer, ["parece que e", "parece que é", "provavelmente e", "provavelmente é", "deve ser"])
          )
        }
      ]
    } : null,
    imageFixtures.scannedPdf ? {
      id: "pdf_scanned_ocr",
      description: "PDF escaneado com OCR local",
      buildDocument: async () => imageFixtures.scannedPdf,
      turns: [
        {
          question: "Qual frase aparece no PDF escaneado?",
          assert: (answer) => includesAll(answer, ["graca", "verdade"])
        }
      ]
    } : null,
    imageFixtures.ocrBlank ? {
      id: "ocr_honesty_blank",
      description: "Imagem vazia para testar honestidade",
      buildDocument: async () => imageFixtures.ocrBlank,
      turns: [
        {
          question: "O que esta escrito na imagem?",
          assert: (answer) => includesAny(answer, [
            "nao consegui",
            "nao houve texto",
            "ocr",
            "legivel",
            "descreva"
          ])
        }
      ]
    } : null
  ].filter(Boolean)
}

async function runScenario(scenario) {
  const scenarioUserId = `${USER_ID}_${scenario.id}`
  const document = await scenario.buildDocument()
  if (!document) {
    return {
      id: scenario.id,
      description: scenario.description,
      skipped: true,
      reason: "fixture_unavailable"
    }
  }

  await writeDocumentToDisk(document).catch(() => { })
  const upload = await uploadDocument(document, scenarioUserId)
  const turns = []

  for (const turn of scenario.turns) {
    const context = getSharedContext(upload, turns)
    const { answer } = await askDocument(turn.question, context, scenarioUserId)
    const passed = Boolean(turn.assert(answer))
    turns.push({
      question: turn.question,
      answer,
      passed
    })
  }

  return {
    id: scenario.id,
    description: scenario.description,
    upload,
    turns,
    passed: turns.every((turn) => turn.passed)
  }
}

async function main() {
  await ensureFixtureDir()

  const imageFixtures = {
    ocrPositive: await buildImageDocument("battery-ocr-positive.png", "PAZ E GRACA").catch(() => null),
    ocrUiLike: await buildImageDocument("battery-ocr-ui.png", "NOVO CHAT PERGUNTE ALGUMA COISA SEUS CHATS").catch(() => null),
    scannedPdf: await buildScannedPdfDocument("battery-scanned.pdf", "GRACA E VERDADE").catch(() => null),
    ocrBlank: await buildImageDocument("battery-ocr-blank.png", "").catch(() => null)
  }

  const scenarios = buildScenarioDefinitions(imageFixtures)
  const child = spawn("node", [SERVER_ENTRY], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: String(SERVER_PORT),
      UPLOAD_OCR_ENABLED: "true",
      OCR_LANG: process.env.OCR_LANG || "por+eng"
    }
  })

  child.stdout.on("data", (chunk) => process.stdout.write(chunk))
  child.stderr.on("data", (chunk) => process.stderr.write(chunk))

  try {
    await waitForServer()

    const results = []
    for (const scenario of scenarios) {
      results.push(await runScenario(scenario))
    }

    const executed = results.filter((result) => !result.skipped)
    const passed = executed.filter((result) => result.passed).length
    const totalTurns = executed.reduce((sum, result) => sum + result.turns.length, 0)
    const passedTurns = executed.reduce((sum, result) => sum + result.turns.filter((turn) => turn.passed).length, 0)
    const score = totalTurns > 0 ? passedTurns / totalTurns : 0

    const report = {
      generatedAt: new Date().toISOString(),
      serverUrl: SERVER_URL,
      score,
      scenariosPassed: passed,
      scenariosTotal: executed.length,
      turnsPassed: passedTurns,
      turnsTotal: totalTurns,
      skipped: results.filter((result) => result.skipped).map((result) => ({
        id: result.id,
        reason: result.reason
      })),
      results
    }

    await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true })
    await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf8")

    console.log("document-runtime-battery: success")
    console.log(`Score geral: ${Math.round(score * 100)}%`)
    console.log(`Cenarios aprovados: ${passed}/${executed.length}`)
    console.log(`Turns aprovados: ${passedTurns}/${totalTurns}`)
    console.log(`Relatorio: ${REPORT_PATH}`)

    if (score < 1) {
      process.exitCode = 1
    }
  } finally {
    child.kill("SIGTERM")
    await delay(500)
  }
}

main().catch((error) => {
  console.error("document-runtime-battery falhou:", error.message)
  process.exit(1)
})
