import fs from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const files = {
  page: path.join(root, "apps/web-next/src/app/page.tsx"),
  css: path.join(root, "apps/web-next/src/app/globals.css"),
  renderer: path.join(root, "apps/web-next/src/components/messages/MessageRenderer.tsx"),
  layout: path.join(root, "apps/web-next/src/app/layout.tsx"),
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

const [page, css, renderer, layout, api, env] = await Promise.all([
  fs.readFile(files.page, "utf8"),
  fs.readFile(files.css, "utf8"),
  fs.readFile(files.renderer, "utf8"),
  fs.readFile(files.layout, "utf8"),
  fs.readFile(files.api, "utf8"),
  fs.readFile(files.env, "utf8").catch(() => "")
])

const categories = [
  computeCategory("shell_navigation", [
    { label: "App shell oficial", pass: has(page, /id="appShell"/), detail: "Shell principal com estado aberto/fechado." },
    { label: "Sidebar oficial", pass: has(page, /id="sidebar"/), detail: "Coluna lateral do chat novo." },
    { label: "Scrim mobile", pass: has(page, /id="sidebarScrim"/), detail: "Fechamento seguro em viewport pequena." },
    { label: "Menu mobile", pass: has(page, /id="mobileMenuBtn"/), detail: "Entrada de navegacao no mobile." },
    { label: "Shell responsivo", pass: has(css, /\.chatgpt-shell\.sidebar-open/) && has(css, /@media \(max-width: 980px\)/), detail: "Layout adaptado para desktop e mobile." },
    { label: "Entrada inicial clara", pass: has(page, /hero-title/) && has(page, /hero-subtitle/), detail: "Estado inicial orientado a conversa." }
  ]),
  computeCategory("composer_and_input", [
    { label: "Composer oficial", pass: has(page, /id="composerShell"/), detail: "Form principal de envio." },
    { label: "Textarea principal", pass: has(page, /id="msg"/), detail: "Campo de mensagem com contrato estável." },
    { label: "Envio por submit", pass: has(page, /onSubmit=\{submitMessage\}/), detail: "Fluxo padrão do chat." },
    { label: "Enter controlado", pass: has(page, /onKeyDown=\{onComposerKeyDown\}/), detail: "Teclado integrado ao envio." },
    { label: "Upload inline", pass: has(page, /id="fileInput"/) && has(page, /id="filePreview"/), detail: "Preview de anexos dentro do composer." },
    { label: "Ditado por voz", pass: has(page, /toggleMicrophone/) && has(page, /IconMic/), detail: "Entrada de voz pronta no front novo." },
    { label: "Estado de envio", pass: has(page, /id="sendBtn"/) && has(page, /is-working/), detail: "Botão com estado operacional durante request." }
  ]),
  computeCategory("conversation_flow", [
    { label: "Chat com scroll proprio", pass: has(css, /\.chat-stream\s*\{[\s\S]*overflow-y:\s*auto/), detail: "Rolagem isolada do feed." },
    { label: "Composer sticky", pass: has(css, /\.composer-shell\s*\{[\s\S]*position:\s*sticky/), detail: "Input fica acessivel no rodape." },
    { label: "Botao de salto", pass: has(page, /id="scrollBottomBtn"/), detail: "Atalho para voltar ao fim da conversa." },
    { label: "Mensagens mapeadas", pass: has(page, /messages\.map/) && has(page, /className=\{`message chat-message/), detail: "Feed estruturado em itens rastreaveis." },
    { label: "Loading de pensamento", pass: has(page, /thinking-bubble/) && has(page, /data-thinking=/), detail: "Estado de processamento visivel." },
    { label: "Threads locais", pass: has(page, /THREADS_STORAGE_KEY/) && has(page, /createThread/), detail: "Historico novo ja funciona sem o legado." }
  ]),
  computeCategory("message_renderer", [
    { label: "Renderer dedicado", pass: has(page, /MessageRenderer/), detail: "Feed rico desacoplado do shell." },
    { label: "Codigo", pass: has(renderer, /CodeBlock/) && has(renderer, /tokenizeCode/), detail: "Bloco de codigo com destaque." },
    { label: "Documento", pass: has(renderer, /DocumentBlock/) && has(renderer, /Download documento/), detail: "Documento com preview e download." },
    { label: "Imagem", pass: has(renderer, /ImageBlock/) && has(renderer, /Download imagem/), detail: "Imagem pronta para revisao e download." },
    { label: "Tabela e timeline", pass: has(renderer, /TableBlock/) && has(renderer, /TimelineBlock/), detail: "Estruturas ricas para respostas analiticas." },
    { label: "Checklist e dados", pass: has(renderer, /ChecklistBlock/) && has(renderer, /DataBlock/), detail: "Respostas operacionais interativas." }
  ]),
  computeCategory("auth_and_guest_flow", [
    { label: "Login no topo", pass: has(page, /id="topAuthLoginBtn"/), detail: "Entrada rapida para visitantes." },
    { label: "Signup no topo", pass: has(page, /id="topAuthSignupBtn"/), detail: "CTA de conversao acessivel." },
    { label: "Modal de autenticacao", pass: has(page, /id="authModal"/) && has(page, /closeAuthModalBtn/), detail: "Fluxo de entrada desacoplado do legado." },
    { label: "Guest mode", pass: has(page, /continueAsGuest/) && has(page, /source: "guest"/), detail: "Uso anonimo continua suportado." },
    { label: "Supabase opcional", pass: has(page, /createClient/) && has(page, /supabaseUrl/), detail: "Auth cloud mantido sem acoplar o boot." },
    { label: "Persistencia local", pass: has(page, /LOCAL_AUTH_SESSION_KEY/) && has(page, /window\.localStorage/), detail: "Sessao local e historico resilientes." }
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
    { label: "Deteccao por linguagem natural", pass: has(page, /detectToolIntent/) && has(page, /DEFAULT_DOC_FORMAT/), detail: "Prompt comum vira pedido de documento." },
    { label: "Preview + download", pass: has(renderer, /DocumentBlock/) && has(renderer, /Download documento/), detail: "Resposta traz previa e arquivo." },
    { label: "Config anuncia docs", pass: has(api, /documentGeneration:\s*\{\s*enabled:\s*true/), detail: "Config do runtime expõe docs." },
    { label: "Botões no chat", pass: has(renderer, /Download documento/) && has(renderer, /Preview ativo/), detail: "Ações de documento prontas." },
    { label: "Formatos configuraveis", pass: has(page, /availableDocFormats/) && has(api, /listDocumentFormats/), detail: "Front e back compartilham formatos suportados." }
  ]),
  computeCategory("image_generation", [
    { label: "Endpoint de imagem", pass: has(api, /app\.post\("\/generate\/image"/), detail: "Backend de geração existe." },
    { label: "Deteccao por prompt", pass: has(page, /detectToolIntent/) && has(page, /mode: "image"/), detail: "Front entende pedido de imagem sem menu legado." },
    { label: "Preview da imagem no chat", pass: has(renderer, /ImageBlock/) && has(renderer, /Download imagem/), detail: "Render e download prontos." },
    { label: "Config anuncia imagem", pass: has(api, /imageGeneration:\s*\{/), detail: "Config do runtime expõe imagem." },
    { label: "Leitura OCR conectada", pass: has(api, /extractTextFromImage/) && has(env, /^UPLOAD_OCR_ENABLED=true$/m), detail: "Imagem pode entrar via OCR antes da resposta." },
    { label: "Provider configurado", pass: hasConfiguredEnv(env, "HUGGINGFACE_API_KEY"), detail: "Sem provider real, a feature não fecha 100%." , weight: 3},
    { label: "Edição/inpainting", pass: !has(api, /imageEditingEnabled:\s*false/), detail: "O backend ainda declara edição de imagem como indisponível.", weight: 2 }
  ]),
  computeCategory("production_readiness", [
    { label: "Proxy resiliente", pass: has(page, /resilientFetch/) && has(page, /shouldTryNextApiBase/), detail: "Rede preparada para contingencias." },
    { label: "Build sem Google Fonts remotas", pass: !has(layout, /next\/font\/google/), detail: "Build reproduzivel sem fetch externo de fontes." },
    { label: "CSS responsivo consistente", pass: has(css, /@media \(max-width: 980px\)/) && has(css, /@media \(max-width: 640px\)/), detail: "Quebras mobile corrigidas." },
    { label: "Runtime de observabilidade", pass: has(api, /app\.get\("\/health"/) && has(api, /app\.get\("\/config"/), detail: "Frontend oficial conversa com endpoints operacionais." },
    { label: "Contrato de QA estavel", pass: has(page, /id="chat"/) && has(page, /id="sendBtn"/) && has(page, /id="fileInput"/), detail: "Seletores estaveis para automacao." }
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
    "Esta auditoria mede estrutura, wiring e sinais de runtime do frontend oficial em apps/web-next.",
    "A geração de imagem só fecha 100% quando o backend tiver provider real configurado.",
    "Leitura de imagem, nesta execução, é OCR-based: boa para screenshots e imagens com texto, não para visão semântica completa.",
    "Documentos estao mais maduros que imagem porque o backend ja anuncia geracao nativa ativa."
  ]
}

await fs.mkdir(path.dirname(files.report), { recursive: true })
await fs.writeFile(files.report, `${JSON.stringify(report, null, 2)}\n`, "utf8")

console.log(`Frontend UI audit: ${report.overall}% (${report.status})`)
for (const category of categories) {
  console.log(`- ${category.name}: ${category.score}% (${category.status})`)
}
