import fs from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const files = {
  html: path.join(root, "apps/web/public/index.html"),
  css: path.join(root, "apps/web/public/style.css"),
  js: path.join(root, "apps/web/public/chat.js"),
  api: path.join(root, "apps/api/src/enterpriseServer.js"),
  env: path.join(root, ".env"),
  report: path.join(root, "reports/frontend-ui-audit.json")
}

function normalizeScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)))
}

function statusFor(score) {
  if (score >= 95) return "excellent"
  if (score >= 85) return "strong"
  if (score >= 70) return "solid"
  if (score >= 55) return "mixed"
  return "weak"
}

function computeCategory(name, checks) {
  const totalWeight = checks.reduce((sum, check) => sum + (check.weight || 1), 0)
  const earned = checks.reduce((sum, check) => sum + (check.pass ? (check.weight || 1) : 0), 0)
  const score = totalWeight > 0 ? (earned / totalWeight) * 100 : 0
  return {
    name,
    score: normalizeScore(score),
    status: statusFor(score),
    checks: checks.map(({ label, pass, detail }) => ({ label, pass, detail }))
  }
}

function has(text, pattern) {
  return pattern.test(text)
}

function hasConfiguredEnv(envText, key) {
  const match = envText.match(new RegExp(`^${key}=(.*)$`, "m"))
  if (!match) return false
  const value = String(match[1] || "").trim()
  return Boolean(value) && !/your_|placeholder|changeme|dummy|test|example/i.test(value)
}

const [html, css, js, api, env] = await Promise.all([
  fs.readFile(files.html, "utf8"),
  fs.readFile(files.css, "utf8"),
  fs.readFile(files.js, "utf8"),
  fs.readFile(files.api, "utf8"),
  fs.readFile(files.env, "utf8").catch(() => "")
])

const categories = [
  computeCategory("layout_shell", [
    { label: "App shell oficial", pass: has(html, /id="appShell"/), detail: "Estrutura raiz do chat." },
    { label: "Sidebar dedicada", pass: has(html, /class="sidebar"/), detail: "Coluna lateral fixa/painel." },
    { label: "Topbar dedicada", pass: has(html, /class="topbar"/), detail: "Barra superior separada." },
    { label: "Hero de entrada", pass: has(html, /class="landing-hero"/), detail: "Estado inicial mais guiado." },
    { label: "Recentes no sidebar", pass: has(html, /id="sidebarHistoryList"/), detail: "Lista de chats recentes." },
    { label: "Busca lateral", pass: has(html, /id="sidebarHistorySearch"/), detail: "Busca local em recentes." }
  ]),
  computeCategory("sidebar_navigation", [
    { label: "Novo chat", pass: has(html, /id="newChatBtn"/), detail: "Atalho principal de conversa." },
    { label: "Atalhos sem emoji cru", pass: has(html, /<span class="nav-icon">\s*<svg/i), detail: "Ícones SVG mais profissionais." },
    { label: "Perfil no rodapé", pass: has(html, /id="profileTrigger"/), detail: "Conta acessível no rodapé." },
    { label: "Menu de perfil", pass: has(html, /id="profileMenu"/), detail: "Ações rápidas de conta." },
    { label: "Busca de recentes", pass: has(js, /renderSidebarHistory/), detail: "Sidebar realmente alimentado por JS." },
    { label: "Limpeza de busca", pass: has(html, /id="clearHistorySearchBtn"/), detail: "Reset rápido da busca lateral." },
    { label: "Threads reais com retomada", pass: has(js, /thread|conversationId|chatThreads|threadList/i), detail: "Sem threads reais, ainda estamos mais perto de histórico rápido do que de navegação completa.", weight: 2 }
  ]),
  computeCategory("composer_and_input", [
    { label: "Composer primário", pass: has(html, /class="composer-primary"/), detail: "Input principal organizado em linha." },
    { label: "Centro do composer para anexo + texto", pass: has(html, /class="composer-center"/), detail: "Anexo e textarea compartilham o mesmo núcleo visual." },
    { label: "Textarea auto-resize", pass: has(js, /function autoResizeTextarea/), detail: "Altura cresce com o texto." },
    { label: "Enter envia", pass: has(js, /event\.key === "Enter"[\s\S]*sendMessage\(\)/), detail: "Envio rápido no teclado." },
    { label: "Anexo", pass: has(html, /id="attachBtn"/), detail: "Upload visual acessível." },
    { label: "Voz", pass: has(html, /id="voiceBtn"/) && has(js, /toggleVoiceInput/), detail: "Ditado ligado ao front." },
    { label: "Enviar com estado", pass: has(js, /setSendButtonWorking/), detail: "Botão muda ao trabalhar." },
    { label: "Quick tools", pass: has(html, /data-tool-template="image"/), detail: "Imagem/docs acessíveis sem decorar comandos." },
    { label: "Preview de arquivo inline", pass: has(js, /renderFilePreview/) && has(html, /id="filePreview"/), detail: "Anexo aparece dentro da área do composer." }
  ]),
  computeCategory("scroll_and_flow", [
    { label: "Container de chat com scroll dedicado", pass: has(css, /\.chat-stream\s*\{[\s\S]*overflow-y:\s*auto/), detail: "Scroll isolado do chat." },
    { label: "Composer sticky", pass: has(css, /\.composer-wrap\s*\{[\s\S]*position:\s*sticky/), detail: "Input fixo no fundo." },
    { label: "Scroll to bottom", pass: has(html, /id="scrollBottomBtn"/) && has(js, /syncScrollButton/), detail: "Botão de retorno ao fim." },
    { label: "Auto-scroll pós-resposta", pass: has(js, /function scrollChatToBottom/), detail: "Fluxo contínuo da conversa." },
    { label: "Modo landing -> conversa", pass: has(js, /function syncChatMode/), detail: "Tela inicial vira conversa sem quebrar." },
    { label: "Toggle de sidebar", pass: has(js, /function toggleSidebar/) && has(css, /sidebar-collapsed|sidebar-open/), detail: "Sidebar pode abrir e fechar sem gambiarra visual." }
  ]),
  computeCategory("message_presentations", [
    { label: "Ações por mensagem", pass: has(js, /buildMessageActions/), detail: "Copiar, editar, baixar, reutilizar." },
    { label: "Ações não poluem mensagem do usuário", pass: has(js, /message\.role !== "assistant"/), detail: "A trilha de ações ficou mais discreta e profissional." },
    { label: "Preview de documento", pass: has(js, /buildDocumentNode/) && has(css, /\.message-document-preview/), detail: "Documento fica visualizável no chat." },
    { label: "Preview de imagem", pass: has(js, /buildMediaNode/) && has(css, /\.message-media img/), detail: "Imagem renderizada na conversa." },
    { label: "Bloco de código", pass: has(js, /renderCodeBlock/), detail: "Código com toolbar de cópia." },
    { label: "Tabela rica", pass: has(js, /rich-table-wrap/), detail: "Tabelas estilizadas." },
    { label: "Timeline", pass: has(js, /timeline-block/), detail: "Linha do tempo renderizada." },
    { label: "Versículo destacado", pass: has(js, /verse-card/), detail: "Versos com cartão próprio." },
    { label: "Edição inline real", pass: has(js, /contenteditable|inline-editor|monaco|editor surface/i), detail: "Hoje o fluxo é levar ao editor, não editar inline como suite completa.", weight: 2 }
  ]),
  computeCategory("auth_and_settings", [
    { label: "Botão topbar entrar", pass: has(html, /id="topbarAccountBtn"/), detail: "Acesso rápido à conta." },
    { label: "Botão topbar criar conta", pass: has(html, /id="topbarSignupBtn"/), detail: "CTA extra quando anônimo." },
    { label: "Modal de login", pass: has(html, /id="loginModal"/), detail: "Entrada centralizada." },
    { label: "Configurações separadas", pass: has(html, /id="view-settings"/), detail: "Avançado vai para Configurações." },
    { label: "Perfil base configurável", pass: has(html, /id="assistantProfileSelect"/), detail: "Perfil em auto/manual." },
    { label: "Módulos configuráveis", pass: has(html, /data-module-toggle/), detail: "Especializações controláveis." },
    { label: "Prompt packs configuráveis", pass: has(html, /data-prompt-pack-toggle/), detail: "Packs profissionais expostos." }
  ]),
  computeCategory("file_understanding", [
    { label: "Upload route", pass: has(api, /app\.post\("\/upload"/), detail: "Backend recebe anexos com ciclo próprio." },
    { label: "Extração de PDF", pass: has(api, /extractTextFromPdf/), detail: "PDF entra no contexto textual." },
    { label: "Extração DOCX", pass: has(api, /extractTextFromDocx/), detail: "DOCX pode ser lido." },
    { label: "Extração XLSX", pass: has(api, /extractTextFromSpreadsheet/), detail: "Planilhas entram como texto tabular." },
    { label: "Extração PPTX", pass: has(api, /extractTextFromPptx/), detail: "Apresentações também entram no contexto." },
    { label: "OCR de imagem", pass: has(api, /extractTextFromImage/) && has(env, /^UPLOAD_OCR_ENABLED=true$/m), detail: "Screenshots e imagens com texto podem ser lidas por OCR." },
    { label: "Capacidade visual declarada", pass: has(api, /visualImageUnderstanding:\s*uploadOcrEnabled/), detail: "A configuração pública reflete o estado visual atual." }
  ]),
  computeCategory("document_generation", [
    { label: "Endpoint de documento", pass: has(api, /app\.post\("\/generate\/document"/), detail: "Backend de geração existe." },
    { label: "Parser de comando /pdf etc", pass: has(js, /function parseDocumentCommand/), detail: "Front entende comandos de docs." },
    { label: "Quick tools de docs", pass: has(html, /data-tool-template="pdf"/), detail: "Acesso visual a documentos." },
    { label: "Preview + download", pass: has(js, /documentDataUrl/) && has(js, /documentPreviewText/), detail: "Resposta traz arquivo e prévia." },
    { label: "Config anuncia docs", pass: has(api, /documentGeneration:\s*\{\s*enabled:\s*true/), detail: "Config do runtime expõe docs." },
    { label: "Botões no chat", pass: has(js, /Baixar arquivo/) && has(js, /Ver prévia/), detail: "Ações de documento prontas." },
    { label: "Edição nativa de documento", pass: has(js, /editDocument|openDocumentEditor|document editor/i), detail: "Ainda não há editor de documento embutido no front.", weight: 2 }
  ]),
  computeCategory("image_generation", [
    { label: "Endpoint de imagem", pass: has(api, /app\.post\("\/generate\/image"/), detail: "Backend de geração existe." },
    { label: "Parser de comando /image", pass: has(js, /function parseImageCommand/), detail: "Front entende comando de imagem." },
    { label: "Quick action de imagem", pass: has(html, /data-tool-template="image"/), detail: "Imagem acessível no composer." },
    { label: "Preview da imagem no chat", pass: has(js, /imageDataUrl/) && has(js, /Baixar imagem/), detail: "Render e download prontos." },
    { label: "Config anuncia imagem", pass: has(api, /imageGeneration:\s*\{/), detail: "Config do runtime expõe imagem." },
    { label: "Leitura OCR conectada", pass: has(api, /extractTextFromImage/) && has(env, /^UPLOAD_OCR_ENABLED=true$/m), detail: "Imagem pode entrar via OCR antes da resposta." },
    { label: "Provider configurado", pass: hasConfiguredEnv(env, "HUGGINGFACE_API_KEY"), detail: "Sem provider real, a feature não fecha 100%." , weight: 3},
    { label: "Edição/inpainting", pass: !has(api, /imageEditingEnabled:\s*false/), detail: "O backend ainda declara edição de imagem como indisponível.", weight: 2 }
  ]),
  computeCategory("performance_boot", [
    { label: "Bootstrap assíncrono", pass: has(js, /async function bootstrapRuntime/), detail: "Carga pesada tirada do boot principal." },
    { label: "Init pinta antes do runtime", pass: has(js, /renderChatHistory\(\)[\s\S]*setView\("chat"\)[\s\S]*bootstrapRuntime/), detail: "Tela aparece antes de saúde/memória." },
    { label: "Speech init isolado", pass: has(js, /initSpeechRecognition\(\)/), detail: "Voz inicializada sem travar tudo." },
    { label: "Carga de config separada", pass: has(js, /await loadConfig\(\)/), detail: "Config carregada em fluxo dedicado." },
    { label: "Scroll assistivo", pass: has(js, /syncScrollButton/), detail: "Menos esforço de navegação em conversas longas." },
    { label: "Bundle dividido/lazy", pass: has(js, /import\(/), detail: "Ainda é um front grande em arquivo único, sem lazy loading real.", weight: 2 }
  ])
]

const overall = normalizeScore(categories.reduce((sum, category) => sum + category.score, 0) / categories.length)

const report = {
  generatedAt: new Date().toISOString(),
  mode: "static_frontend_runtime_audit",
  overall,
  status: statusFor(overall),
  categories,
  notes: [
    "Esta auditoria mede estrutura, wiring e sinais de runtime do frontend oficial em apps/web/public.",
    "A geração de imagem só fecha 100% quando o backend tiver provider real configurado.",
    "Leitura de imagem, nesta execução, é OCR-based: boa para screenshots e imagens com texto, não para visão semântica completa.",
    "Documentos estão melhor que imagem porque o backend já anuncia geração nativa ativa."
  ]
}

await fs.mkdir(path.dirname(files.report), { recursive: true })
await fs.writeFile(files.report, `${JSON.stringify(report, null, 2)}\n`, "utf8")

console.log(`Frontend UI audit: ${report.overall}% (${report.status})`)
for (const category of categories) {
  console.log(`- ${category.name}: ${category.score}% (${category.status})`)
}
