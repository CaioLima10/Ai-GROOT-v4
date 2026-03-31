import fs from "fs/promises"
import path from "path"

const DEFAULT_OUT_DIR = path.join(process.cwd(), "knowledge", "docs", "giom-targeted-pack")
const DEFAULT_COUNT = 2000
const DEFAULT_MODULE = "research"

const PROFILE_LIBRARY = {
  bible: {
    module: "bible",
    category: "bible",
    tags: ["bible", "theology", "church_history", "biblical_languages", "study_bibles_resources"],
    relatedModules: ["theology", "church_history", "study_bibles_resources", "research"],
    themes: [
      "contexto historico-canonico",
      "exegese e hermeneutica",
      "sintese doutrinaria",
      "aplicacao pastoral e discipulado",
      "comparacao de traducoes"
    ],
    scenarios: [
      "estudo biblico semanal",
      "preparacao de classe",
      "aconselhamento pastoral",
      "resposta apologetica",
      "resumo expositivo"
    ]
  },
  language: {
    module: "language",
    category: "language",
    tags: ["language", "communication", "reasoning", "interpretation", "didactics"],
    relatedModules: ["communication", "reasoning", "education"],
    themes: [
      "clareza semantica",
      "desambiguacao de pedido",
      "estrutura de resposta",
      "tom conversacional profissional",
      "coerencia argumentativa"
    ],
    scenarios: [
      "chat de suporte",
      "duvida urgente",
      "explicacao para iniciante",
      "resposta tecnica objetiva",
      "conversa em rede social"
    ]
  },
  agribusiness: {
    module: "agribusiness",
    category: "agribusiness",
    tags: ["agribusiness", "operations", "field_management", "decision_support", "risk"],
    relatedModules: ["operations", "analysis", "research", "finance"],
    themes: [
      "janela operacional",
      "priorizacao de talhoes",
      "gargalos logistica-secagem",
      "gestao de risco climatico",
      "telemetria e produtividade"
    ],
    scenarios: [
      "planejamento de safra",
      "turno de colheita",
      "diagnostico de atraso",
      "orientacao ao produtor",
      "comparacao de estrategia"
    ]
  },
  finance: {
    module: "finance",
    category: "finance",
    tags: ["finance", "analysis", "planning", "risk_management", "cash_flow"],
    relatedModules: ["analysis", "research", "education"],
    themes: [
      "orcamento e margem",
      "fluxo de caixa",
      "alocacao de capital",
      "gestao de risco financeiro",
      "decisao economica baseada em cenario"
    ],
    scenarios: [
      "empresa pequena",
      "planejamento mensal",
      "analise de investimento",
      "controle de gastos",
      "priorizacao de pagamento"
    ]
  },
  security: {
    module: "security",
    category: "security",
    tags: ["security", "cybersecurity", "hardening", "risk", "incident_response"],
    relatedModules: ["developer", "analysis", "research"],
    themes: [
      "higiene de credenciais",
      "detecao de anomalia",
      "superficie de ataque",
      "resposta a incidente",
      "mitigacao de risco"
    ],
    scenarios: [
      "alerta interno",
      "investigacao de log",
      "ajuste de acesso",
      "checklist de hardening",
      "treinamento da equipe"
    ]
  },
  developer: {
    module: "developer",
    category: "developer",
    tags: ["developer", "docs", "software_architecture", "debugging", "quality"],
    relatedModules: ["analysis", "documentation", "reasoning", "research"],
    themes: [
      "documentacao executavel",
      "debugging sistematico",
      "contratos de runtime",
      "qualidade de API",
      "arquitetura orientada a evidencias"
    ],
    scenarios: [
      "correcao de bug",
      "review de PR",
      "onboarding tecnico",
      "migracao de stack",
      "hardening de runtime"
    ]
  },
  research: {
    module: "research",
    category: "research",
    tags: ["research", "analysis", "source_criticism", "methodology", "evidence"],
    relatedModules: ["analysis", "education", "reasoning"],
    themes: [
      "metodo de investigacao",
      "diferenca entre fato e inferencia",
      "confianca da fonte",
      "sintese comparativa",
      "limites da conclusao"
    ],
    scenarios: [
      "resumo academico",
      "checagem de afirmacao",
      "analise comparativa",
      "resposta para ceticismo",
      "briefing tecnico"
    ]
  },
  education: {
    module: "education",
    category: "education",
    tags: ["education", "pedagogy", "learning_design", "feedback", "didactics"],
    relatedModules: ["communication", "language", "research"],
    themes: [
      "explicacao por niveis",
      "atividade guiada",
      "checagem de compreensao",
      "feedback formativo",
      "plano de aula"
    ],
    scenarios: [
      "aula introdutoria",
      "reforco de conteudo",
      "revisao para prova",
      "mentoria individual",
      "material de estudo"
    ]
  }
}

function parseArgs() {
  const args = process.argv.slice(2)
  const config = {
    outDir: DEFAULT_OUT_DIR,
    count: DEFAULT_COUNT,
    startIndex: 0,
    module: DEFAULT_MODULE
  }

  const outIdx = args.indexOf("--out-dir")
  if (outIdx >= 0 && args[outIdx + 1]) {
    config.outDir = path.resolve(process.cwd(), args[outIdx + 1])
  }

  const countIdx = args.indexOf("--count")
  if (countIdx >= 0 && args[countIdx + 1]) {
    config.count = Math.max(1, Number(args[countIdx + 1]) || DEFAULT_COUNT)
  }

  const startIdx = args.indexOf("--start-index")
  if (startIdx >= 0 && args[startIdx + 1]) {
    config.startIndex = Math.max(0, Number(args[startIdx + 1]) || 0)
  }

  const moduleIdx = args.indexOf("--module")
  if (moduleIdx >= 0 && args[moduleIdx + 1]) {
    config.module = String(args[moduleIdx + 1]).trim().toLowerCase() || DEFAULT_MODULE
  }

  return config
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
  return list[(index + offset) % list.length]
}

function nowIsoDay() {
  return new Date().toISOString().slice(0, 10)
}

function resolveProfile(moduleName) {
  if (PROFILE_LIBRARY[moduleName]) return PROFILE_LIBRARY[moduleName]

  return {
    module: moduleName,
    category: moduleName,
    tags: [moduleName, "analysis", "reasoning", "documentation", "operations"],
    relatedModules: ["analysis", "research", "education"],
    themes: [
      "fundamentos praticos",
      "diagnostico operacional",
      "criterio de qualidade",
      "decisao baseada em evidencias",
      "aplicacao contextual"
    ],
    scenarios: [
      "duvida de usuario",
      "resposta tecnica",
      "analise de cenario",
      "resumo aplicado",
      "plano de acao"
    ]
  }
}

function buildDoc(profile, globalIndex) {
  const ordinal = String(globalIndex + 1).padStart(6, "0")
  const theme = pick(profile.themes, globalIndex)
  const scenario = pick(profile.scenarios, globalIndex, 1)
  const title = `${profile.module.toUpperCase()} Knowledge ${ordinal} - ${theme}`
  const slug = slugify(`${profile.module}-${ordinal}-${theme}-${scenario}`)
  const source = `local.generated.${profile.module}.${slug}`
  const categories = [...new Set([profile.category, ...profile.tags])]
  const modules = [...new Set([profile.module, ...profile.relatedModules])]

  const content = [
    "---",
    `title: ${title}`,
    `category: ${profile.category}`,
    "language: pt",
    `source: ${source}`,
    "rights: user_generated_internal",
    `categories: ${categories.join(",")}`,
    `modules: ${modules.join(",")}`,
    `updatedAt: ${nowIsoDay()}`,
    "---",
    "",
    `# ${title}`,
    "",
    "## Escopo",
    `Documento tecnico para fortalecer o modulo ${profile.module} em cenarios de ${scenario}, mantendo rastreabilidade, linguagem clara e criterio verificavel.`,
    "",
    "## Contexto de decisao",
    `No contexto de ${scenario}, respostas sobre ${theme} precisam separar sinal util de ruido, explicitar premissas e oferecer caminho pratico de execucao.`,
    `A resposta de alta qualidade deve apresentar limite de confianca, risco principal e proxima verificacao recomendada para evitar erro operacional.`,
    "",
    "## Protocolo GIOM de qualidade",
    "1. Definir objetivo e restricao da pergunta em linguagem direta.",
    "2. Validar quais dados sao fato, quais sao inferencia e quais sao hipotese operacional.",
    "3. Produzir resposta em camadas: resumo executivo, passos acionaveis e verificacao final.",
    "4. Fechar com orientacao de monitoramento para ajuste iterativo.",
    "",
    "## Padrao de resposta recomendado",
    `- Linguagem: objetiva, sem perder profundidade para ${profile.module}.`,
    "- Estrutura: conclusao curta no inicio, evidencia no meio, proxima acao no final.",
    "- Seguranca: explicitar incerteza e nao inventar dados ausentes.",
    "- Consistencia: alinhar recomendacao com risco, custo e impacto esperado.",
    "",
    "## Corpus aplicado",
    `Paragrafo 1: Em ${profile.module}, erros comuns surgem quando se responde sem confirmar o contexto real do usuario; por isso, o primeiro passo deve ser estabilizar escopo e objetivo.`,
    `Paragrafo 2: Quando o tema central e ${theme}, a IA precisa comparar alternativas com criterio concreto, apontar trade-offs e indicar qual opcao reduz risco no curto prazo.`,
    `Paragrafo 3: Em ${scenario}, a resposta util precisa transformar teoria em sequencia executavel, com metricas de acompanhamento e gatilhos de revisao.`,
    "",
    "## Exemplo guiado",
    `Pergunta simulada: \"Como melhorar ${theme} sem perder qualidade?\"`,
    "Resposta esperada: identificar gargalo principal, listar acoes por prioridade, definir indicador de sucesso e sugerir checkpoint de validacao.",
    "",
    "## Checklist de curadoria",
    "- O texto superou o nivel superficial e trouxe criterio tecnico?",
    "- A recomendacao final pode ser executada por uma pessoa real?",
    "- Existe separacao clara entre fato, inferencia e opiniao?",
    "- O documento evita contradicao interna e jargao inutil?",
    ""
  ].join("\n")

  return {
    fileName: `${slug}.md`,
    content,
    source
  }
}

async function main() {
  const config = parseArgs()
  const profile = resolveProfile(config.module)
  await fs.mkdir(config.outDir, { recursive: true })

  for (let index = 0; index < config.count; index += 1) {
    const globalIndex = config.startIndex + index
    const doc = buildDoc(profile, globalIndex)
    await fs.writeFile(path.join(config.outDir, doc.fileName), doc.content, "utf8")
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    outDir: config.outDir,
    count: config.count,
    startIndex: config.startIndex,
    module: profile.module,
    category: profile.category
  }

  await fs.writeFile(path.join(config.outDir, "PACK-SUMMARY.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8")

  console.log(`TARGETED_PACK_OK ${config.outDir}`)
  console.log(`DOCS_GENERATED ${config.count}`)
  console.log(`TARGET_MODULE ${profile.module}`)
}

main().catch((error) => {
  console.error(`TARGETED_PACK_ERROR ${error.message}`)
  process.exit(1)
})
