import fs from "fs/promises"
import path from "path"

const WORKSPACE_ROOT = process.cwd()
const DEFAULT_REPORT = path.join(WORKSPACE_ROOT, "reports", "knowledge-health-report.json")
const DEFAULT_OUT_DIR = path.join(WORKSPACE_ROOT, "knowledge", "docs", "robust-real-all")

function parseArgs() {
  const args = process.argv.slice(2)
  const cfg = {
    report: DEFAULT_REPORT,
    outDir: DEFAULT_OUT_DIR,
    perModule: 3,
    startIndex: 0
  }

  const reportIdx = args.indexOf("--report")
  if (reportIdx >= 0 && args[reportIdx + 1]) {
    cfg.report = path.resolve(WORKSPACE_ROOT, args[reportIdx + 1])
  }

  const outIdx = args.indexOf("--out-dir")
  if (outIdx >= 0 && args[outIdx + 1]) {
    cfg.outDir = path.resolve(WORKSPACE_ROOT, args[outIdx + 1])
  }

  const perIdx = args.indexOf("--per-module")
  if (perIdx >= 0 && args[perIdx + 1]) {
    cfg.perModule = Math.max(1, Number(args[perIdx + 1]) || 3)
  }

  const startIdx = args.indexOf("--start-index")
  if (startIdx >= 0 && args[startIdx + 1]) {
    cfg.startIndex = Math.max(0, Number(args[startIdx + 1]) || 0)
  }

  return cfg
}

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function pick(list = [], index = 0, offset = 0) {
  if (!Array.isArray(list) || list.length === 0) return "general"
  return String(list[(index + offset) % list.length] || "general")
}

function nowIsoDay() {
  return new Date().toISOString().slice(0, 10)
}

function moduleToCategory(moduleName) {
  if (moduleName === "private_library") return "knowledge"
  if (moduleName.includes("bible") || moduleName.includes("theology")) return "bible"
  if (moduleName.includes("security") || moduleName.includes("cyber")) return "security"
  if (moduleName.includes("finance")) return "finance"
  if (moduleName.includes("agro") || moduleName.includes("agribusiness")) return "agribusiness"
  if (moduleName.includes("language") || moduleName.includes("communication")) return "language"
  if (moduleName.includes("education") || moduleName.includes("teaching")) return "education"
  if (moduleName.includes("developer") || moduleName.includes("code") || moduleName.includes("typescript") || moduleName.includes("javascript")) return "developer"
  if (moduleName.includes("research") || moduleName.includes("analysis")) return "research"
  return "research"
}

function buildDoc(moduleName, submoduleName, categories, ordinal) {
  const category = moduleToCategory(moduleName)
  const themeBank = [
    "diagnostico operacional orientado a evidencia",
    "protocolo de resposta com rastreabilidade",
    "criterio de qualidade para decisao real",
    "validacao de risco e consistencia",
    "execucao por etapas com checkpoint"
  ]
  const scenarioBank = [
    "atendimento de usuario em tempo real",
    "revisao de conteudo tecnico",
    "planejamento tatico semanal",
    "checagem de consistencia antes de publicar",
    "resposta sob incerteza com transparencia"
  ]

  const indexNum = Number(ordinal)
  const theme = pick(themeBank, indexNum)
  const scenario = pick(scenarioBank, indexNum, 1)
  const title = `Robust Real ${String(indexNum).padStart(6, "0")} - ${moduleName} - ${submoduleName}`
  const slug = slugify(`${moduleName}-${submoduleName}-${String(indexNum).padStart(6, "0")}`)
  const source = `local.generated.robust.${moduleName}.${slug}`

  const content = [
    "---",
    `title: ${title}`,
    `category: ${category}`,
    "language: pt",
    `source: ${source}`,
    "rights: user_generated_internal",
    `categories: ${[category, moduleName, submoduleName, ...categories].filter(Boolean).join(",")}`,
    `modules: ${[moduleName, submoduleName, "analysis", "reasoning"].filter(Boolean).join(",")}`,
    `updatedAt: ${nowIsoDay()}`,
    "---",
    "",
    `# ${title}`,
    "",
    "## Contexto tecnico",
    `Este documento robusto foi criado para fortalecer o modulo ${moduleName} e o submodulo ${submoduleName}, com foco em ${theme}.`,
    `A aplicacao principal e ${scenario}, priorizando resposta util, verificavel e segura para operacao real.`,
    "",
    "## Protocolo de leitura e resposta",
    "1. Delimitar objetivo, restricoes e dados confirmados no pedido.",
    "2. Separar fato observado, inferencia plausivel e hipotese de trabalho.",
    "3. Estruturar a resposta em resumo executivo, plano de acao e validacao final.",
    "4. Explicitar risco residual, limite de confianca e proximo checkpoint.",
    "",
    "## Criterios de qualidade",
    "- Coerencia interna entre premissa, analise e conclusao.",
    "- Linguagem objetiva sem jargao inutil.",
    "- Decisao orientada por evidencias e nao por palpite.",
    "- Transparencia quando faltar dado para cravar conclusao.",
    "",
    "## Conteudo aplicado",
    `No modulo ${moduleName}, erros recorrentes aparecem quando o contexto da pergunta nao e fixado; por isso, o primeiro bloco da resposta deve ancorar escopo, nivel tecnico e resultado esperado.`,
    `Para ${submoduleName}, a abordagem mais robusta e comparar opcoes com criterio explicito de risco, custo, impacto e prazo, mostrando por que uma opcao e preferivel no cenario atual.`,
    `Quando houver conflito entre velocidade e qualidade, priorizar uma resposta incremental: primeiro o minimo seguro para agir, depois o aprofundamento com evidencias adicionais.`,
    "",
    "## Exemplo de uso",
    `Pergunta simulada: como melhorar ${submoduleName} sem perder confiabilidade?`,
    "Resposta esperada: identificar gargalo principal, listar tres acoes por prioridade, definir metrica de sucesso e indicar gatilho de revisao.",
    "",
    "## Checklist final",
    "- O texto ficou acionavel para quem vai executar?",
    "- O risco principal foi explicitado?",
    "- Existe plano de validacao apos a acao?",
    "- A conclusao evita afirmacoes absolutas sem evidencias?",
    ""
  ].join("\n")

  return {
    fileName: `${slug}.md`,
    content,
    source,
    moduleName,
    submoduleName,
    category
  }
}

async function main() {
  const cfg = parseArgs()
  const raw = await fs.readFile(cfg.report, "utf8")
  const report = JSON.parse(raw)

  const moduleRows = Array.isArray(report?.stats?.modules) ? report.stats.modules : []
  const categoryRows = Array.isArray(report?.stats?.categories) ? report.stats.categories : []
  const categories = categoryRows.map((row) => String(row?.[0] || "").trim().toLowerCase()).filter(Boolean)

  if (moduleRows.length === 0) {
    throw new Error("Nenhum modulo encontrado no health report")
  }

  await fs.mkdir(cfg.outDir, { recursive: true })

  const generated = []
  let cursor = cfg.startIndex

  for (const row of moduleRows) {
    const moduleName = String(row?.[0] || "").trim().toLowerCase()
    if (!moduleName) continue

    const guessedSubmodule = moduleName.includes("_")
      ? moduleName.split("_").slice(1).join("_")
      : pick(categories, cursor)

    for (let i = 0; i < cfg.perModule; i += 1) {
      const submoduleName = i === 0 ? guessedSubmodule : pick(categories, cursor, i)
      const doc = buildDoc(moduleName, submoduleName, categories.slice(0, 6), cursor + 1)
      await fs.writeFile(path.join(cfg.outDir, doc.fileName), doc.content, "utf8")
      generated.push(doc)
      cursor += 1
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    reportFile: cfg.report,
    outDir: cfg.outDir,
    perModule: cfg.perModule,
    moduleCount: moduleRows.length,
    docsGenerated: generated.length,
    modulesCovered: [...new Set(generated.map((d) => d.moduleName))].length,
    submodulesCovered: [...new Set(generated.map((d) => d.submoduleName))].length
  }

  await fs.writeFile(path.join(cfg.outDir, "PACK-SUMMARY.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8")

  console.log(`ROBUST_REAL_PACK_OK ${cfg.outDir}`)
  console.log(`MODULES_COVERED ${summary.modulesCovered}`)
  console.log(`SUBMODULES_COVERED ${summary.submodulesCovered}`)
  console.log(`DOCS_GENERATED ${summary.docsGenerated}`)
}

main().catch((error) => {
  console.error(`ROBUST_REAL_PACK_ERROR ${error.message}`)
  process.exit(1)
})
