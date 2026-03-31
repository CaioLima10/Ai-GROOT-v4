import fs from "fs/promises"
import path from "path"

const DEFAULT_OUT_DIR = path.join(process.cwd(), "knowledge", "docs", "giom-mega-pack")
const DEFAULT_COUNT = 5000

const DOMAIN_BLUEPRINTS = [
  {
    id: "language_communication",
    category: "language",
    tags: ["language", "communication", "interpretation", "internet_dialogue"],
    modules: ["language", "communication", "reasoning"],
    titles: ["Comunicacao digital", "Interpretacao contextual", "Tom de conversa", "Clareza argumentativa", "Etiqueta online"],
    focuses: ["ambiguidades", "emojis", "registro formal", "registro informal", "pedidos objetivos"],
    scenarios: ["chat de suporte", "mensagem curta", "duvida urgente", "pedido educado", "conversa em rede social"]
  },
  {
    id: "developer_docs_ai",
    category: "developer",
    tags: ["developer", "docs", "ai", "rag", "software_architecture"],
    modules: ["developer", "reasoning", "documentation"],
    titles: ["Documentacao tecnica", "Arquitetura RAG", "Fluxo de debugging", "Contratos de runtime", "Qualidade de software"],
    focuses: ["logs", "telemetria", "prompts", "OCR", "pipeline de ingestao"],
    scenarios: ["investigacao de erro", "revisao de PR", "projeto novo", "ajuste de API", "documentacao interna"]
  },
  {
    id: "theology_protestant",
    category: "theology",
    tags: ["theology", "protestant", "doctrine", "church_history"],
    modules: ["research", "theology", "teaching"],
    titles: ["Doutrina biblica", "Teologia sistematica", "Historia da igreja", "Pregacao expositiva", "Vida cristã"],
    focuses: ["graca", "justificacao", "santificacao", "discipulado", "aplicacao pastoral"],
    scenarios: ["estudo biblico", "classe de escola", "aconselhamento", "pregacao", "devocional"]
  },
  {
    id: "archaeology_history",
    category: "research",
    tags: ["archaeology", "history", "near_east", "evidence"],
    modules: ["research", "history", "analysis"],
    titles: ["Arqueologia biblica", "Contexto historico", "Fontes antigas", "Inscricoes", "Metodologia historica"],
    focuses: ["escavacoes", "cronologia", "evidencia material", "fontes primarias", "limites de inferencia"],
    scenarios: ["comparar evidencias", "responder ceticismo", "explicar contexto", "resumir achado", "ensino introdutorio"]
  },
  {
    id: "math_science_core",
    category: "math_science",
    tags: ["math_science", "physics", "chemistry", "biology", "logic"],
    modules: ["education", "reasoning", "science"],
    titles: ["Matematica aplicada", "Fisica conceitual", "Quimica basica", "Biologia estrutural", "Raciocinio cientifico"],
    focuses: ["proporcao", "energia", "reacoes", "sistemas vivos", "verificacao experimental"],
    scenarios: ["explicar para iniciante", "comparar conceitos", "resolver passo a passo", "revisao escolar", "uso pratico"]
  },
  {
    id: "agribusiness_operations",
    category: "agribusiness",
    tags: ["agribusiness", "operations", "field_management", "decision_support"],
    modules: ["operations", "analysis", "agro"],
    titles: ["Gestao no agro", "Planejamento de safra", "Operacao rural", "Indicadores de campo", "Tomada de decisao"],
    focuses: ["clima", "custos", "janela operacional", "produtividade", "risco"],
    scenarios: ["planejar semana", "avaliar risco", "orientar produtor", "resumir relatorio", "priorizar tarefa"]
  },
  {
    id: "finance_business",
    category: "finance",
    tags: ["finance", "business", "analysis", "risk_management"],
    modules: ["finance", "analysis", "planning"],
    titles: ["Financas pessoais", "Gestao de caixa", "Decisao economica", "Analise de custo", "Planejamento financeiro"],
    focuses: ["orcamento", "margem", "risco", "cenarios", "prioridade"],
    scenarios: ["reduzir gastos", "avaliar compra", "organizar caixa", "explicar indicador", "comparar estrategias"]
  },
  {
    id: "education_pedagogy",
    category: "education",
    tags: ["education", "pedagogy", "learning_design", "feedback"],
    modules: ["education", "communication", "teaching"],
    titles: ["Ensino adaptativo", "Feedback ao aluno", "Planejamento de aula", "Explicacao gradual", "Avaliacao formativa"],
    focuses: ["exemplo", "repeticao espaçada", "checagem de compreensao", "atividade pratica", "nivel de dificuldade"],
    scenarios: ["ensino basico", "reforco", "explicacao curta", "atividade guiada", "revisao final"]
  },
  {
    id: "medicine_health_literacy",
    category: "health",
    tags: ["health", "medicine", "literacy", "care_guidance"],
    modules: ["health", "education", "safety"],
    titles: ["Saude explicada", "Leitura de sintomas", "Cuidados gerais", "Educacao em saude", "Triagem informativa"],
    focuses: ["sinais de alerta", "autocuidado", "limite de orientacao", "encaminhamento", "clareza"],
    scenarios: ["orientacao inicial", "entender exame", "explicar risco", "resumir cuidado", "quando procurar ajuda"]
  },
  {
    id: "cybersecurity_practice",
    category: "security",
    tags: ["security", "cybersecurity", "risk", "hardening"],
    modules: ["security", "developer", "analysis"],
    titles: ["Seguranca operacional", "Boas praticas defensivas", "Controle de acesso", "Analise de risco", "Resposta a incidente"],
    focuses: ["credenciais", "phishing", "logs", "permissoes", "superficie de ataque"],
    scenarios: ["alerta interno", "orientar equipe", "checklist rapido", "investigar anomalia", "reduzir risco"]
  },
  {
    id: "literature_arts",
    category: "arts",
    tags: ["literature", "arts", "interpretation", "creativity"],
    modules: ["education", "communication", "analysis"],
    titles: ["Analise literaria", "Criacao artistica", "Interpretacao de obra", "Movimento artistico", "Expressao criativa"],
    focuses: ["metafora", "narrativa", "estilo", "contexto cultural", "simbolismo"],
    scenarios: ["comentario de texto", "orientacao criativa", "historico do movimento", "comparacao de obras", "analise critica"]
  },
  {
    id: "environmental_sustainability",
    category: "environment",
    tags: ["environment", "sustainability", "ecology", "climate"],
    modules: ["science", "analysis", "planning"],
    titles: ["Ecologia pratica", "Sustentabilidade ambiental", "Impacto climatico", "Gestao de recursos", "Adaptacao ecologica"],
    focuses: ["biodiversidade", "carbono", "agua", "energia renovavel", "resiliencia"],
    scenarios: ["orientacao ambiental", "decisao sustentavel", "mitigacao de risco", "comunicacao sobre clima", "projeto ecologico"]
  },
  {
    id: "psychology_behavior",
    category: "psychology",
    tags: ["psychology", "behavior", "mental_health", "cognition"],
    modules: ["health", "education", "analysis"],
    titles: ["Psicologia aplicada", "Comportamento humano", "Saude mental basica", "Cognacao e emocao", "Bem estar psicologico"],
    focuses: ["motivacao", "estresse", "relacionamento", "autoconhecimento", "resiliencia emocional"],
    scenarios: ["orientacao pessoal", "entender comportamento", "apoio emocional", "diagnostico inicial", "desenvolvimento pessoal"]
  },
  {
    id: "law_governance",
    category: "legal",
    tags: ["law", "governance", "rights", "civic_responsibility"],
    modules: ["research", "analysis", "planning"],
    titles: ["Direito aplicado", "Governanca civica", "Direitos e deveres", "Processo legal basico", "Compliance organizacional"],
    focuses: ["contrato", "propriedade", "regulacao", "responsabilidade", "conformidade"],
    scenarios: ["consultoria rapida", "esclarecimento legal", "explicar direito", "analise de risco", "orientacao regulatoria"]
  },
  {
    id: "art_design",
    category: "design",
    tags: ["design", "visual", "ux", "innovation"],
    modules: ["developer", "communication", "analysis"],
    titles: ["Design visual", "Experiencia do usuario", "Inovacao em design", "Composicao estetica", "Design sistemas"],
    focuses: ["paleta de cores", "tipografia", "usabilidade", "acessibilidade", "consistencia visual"],
    scenarios: ["feedback de design", "conceito visual", "revisao de UX", "orientacao de projeto", "analise comparativa"]
  },
  {
    id: "nutrition_wellness",
    category: "health",
    tags: ["health", "nutrition", "wellness", "diet"],
    modules: ["health", "education", "planning"],
    titles: ["Nutricao pratica", "Bem estar integral", "Planejamento alimentar", "Alimento e energia", "Estilo de vida saudavel"],
    focuses: ["macronutriente", "hidratacao", "suplemento", "dieta equilibrada", "mudanca habito"],
    scenarios: ["orientacao alimentar", "duvida sobre alimento", "planejamento nutricional", "explicar beneficio", "objetivo de saude"]
  },
  {
    id: "music_performance",
    category: "arts",
    tags: ["music", "performance", "composition", "interpretation"],
    modules: ["education", "communication", "analysis"],
    titles: ["Tecnica musical", "Pratica performatica", "Composicao e arranjo", "Historia da musica", "Expressao sonora"],
    focuses: ["ritmo", "melodia", "harmonia", "expressividade", "tecnica instrumental"],
    scenarios: ["orientacao musical", "analise de peca", "critica construtiva", "conceito artistico", "desenvolvimento artistica"]
  },
  {
    id: "philosophy_ethics",
    category: "philosophy",
    tags: ["philosophy", "ethics", "epistemology", "metaphysics"],
    modules: ["research", "reasoning", "teaching"],
    titles: ["Filosofia aplicada", "Etica decisoria", "Epistemologia pratica", "Metafisica basica", "Logica e argumento"],
    focuses: ["direito e dever", "verdade e conhecimento", "realidade e percepcao", "raciocinio valido", "dilema moral"],
    scenarios: ["exploracao filosofica", "analise etica", "debate conceitual", "questionamento profundo", "argumentacao critica"]
  },
  {
    id: "sports_physiology",
    category: "health",
    tags: ["sports", "physiology", "training", "performance"],
    modules: ["health", "science", "planning"],
    titles: ["Fisiologia do esporte", "Treinamento atletico", "Preformance de pico", "Recuperacao e prevencao", "Mecanica corporal"],
    focuses: ["condicao fisica", "periodizacao", "lesao presopcao", "nutriacao atletica", "mental training"],
    scenarios: ["planejamento de treino", "orientacao de performance", "prevencao de lesao", "recuperacao pos esforco", "analise tecnico"]
  },
  {
    id: "urban_planning",
    category: "planning",
    tags: ["urban", "planning", "infrastructure", "community"],
    modules: ["analysis", "planning", "operations"],
    titles: ["Planejamento urbano", "Infraestrutura comunitaria", "Mobilidade urbana", "Espaco publico", "Desenvolvimento de regiao"],
    focuses: ["transporte", "area verde", "habitacao", "seguranca urbana", "vitalidade comunitaria"],
    scenarios: ["analise urbana", "consulta comunitaria", "projeto de regiao", "diagnostico de problema", "proposta de solucao"]
  },
  {
    id: "data_analytics",
    category: "developer",
    tags: ["data", "analytics", "business_intelligence", "statistics"],
    modules: ["developer", "analysis", "planning"],
    titles: ["Analise de dados", "Inteligencia de negocio", "Estatistica aplicada", "Visualizacao de dados", "Modelagem preditiva"],
    focuses: ["metrica", "segmentacao", "previsao", "correlacao", "decisao baseada em dado"],
    scenarios: ["interpretacao de relatorio", "analise exploratoria", "recomendacao baseada dado", "diagnostico de problema", "previsao de cenario"]
  }
]

function parseArgs() {
  const args = process.argv.slice(2)
  const config = {
    outDir: DEFAULT_OUT_DIR,
    count: DEFAULT_COUNT,
    startIndex: 0
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

function buildDomainDoc(domain, globalIndex) {
  const ordinal = String(globalIndex + 1).padStart(5, "0")
  const titleStem = pick(domain.titles, globalIndex)
  const focus = pick(domain.focuses, globalIndex, 1)
  const scenario = pick(domain.scenarios, globalIndex, 2)
  const title = `GIOM Mega Pack ${ordinal} - ${titleStem} - ${focus}`
  const slug = slugify(`${domain.id}-${ordinal}-${titleStem}-${focus}-${scenario}`)
  const source = `local.generated.${domain.id}.${slug}`

  const sections = [
    "---",
    `title: ${title}`,
    `category: ${domain.category}`,
    `language: pt`,
    `source: ${source}`,
    `rights: user_generated_internal`,
    `categories: ${domain.tags.join(", ")}`,
    `modules: ${domain.modules.join(",")}`,
    `updatedAt: ${nowIsoDay()}`,
    "---",
    "",
    `# ${title}`,
    "",
    "## Objetivo",
    `Fortalecer o GIOM em ${titleStem.toLowerCase()} com foco em ${focus}, profundidade contextual e resposta pratica para o cenario de ${scenario}.`,
    "",
    "## Contexto operacional",
    `Quando a conversa envolve ${focus}, a IA deve detectar a intencao exata, separar fatos de interpretacoes e responder com linguagem clara para o contexto de ${scenario}.`,
    `O comportamento esperado inclui reconhecer nivel do usuario, evitar generalizacoes soltas e adaptar a resposta sem perder rigor tecnico ou pedagogico.`,
    "",
    "## Protocolo de interpretacao",
    "1. Identificar a pergunta principal e a secundaria.",
    `2. Verificar se ${focus} exige definicao, comparacao, diagnostico, orientacao ou resumo.`,
    "3. Declarar limite quando faltarem dados e propor a proxima verificacao util.",
    "4. Responder primeiro de forma direta e depois expandir com estrutura.",
    "",
    "## Regras de qualidade",
    `- Priorizar utilidade concreta para ${scenario}.`,
    `- Preservar consistencia entre conceito, exemplo e conclusao em ${titleStem.toLowerCase()}.`,
    "- Informar incerteza sem travar a resposta.",
    "- Evitar excesso de jargao quando houver alternativa mais clara.",
    "",
    "## Mini corpus orientado",
    `Paragrafo A: Em ${titleStem.toLowerCase()}, boas respostas dependem de contexto, vocabulario controlado e criterio explicito para nao confundir o usuario quando o tema tocar em ${focus}.`,
    `Paragrafo B: No cenario de ${scenario}, a resposta ideal combina resumo inicial, passos praticos, risco principal e caminho de verificacao, mantendo rastreabilidade do raciocinio.`,
    `Paragrafo C: A IA deve mostrar por que a orientacao faz sentido, quais premissas estao sendo usadas e como ajustar a resposta se o usuario trouxer novos dados.`,
    "",
    "## Exemplos aplicados",
    `- Exemplo 1: explicar ${focus} para um iniciante sem perder precisao.`,
    `- Exemplo 2: comparar duas abordagens possiveis para ${scenario}.`,
    `- Exemplo 3: transformar uma pergunta vaga sobre ${titleStem.toLowerCase()} em um plano de acao verificavel.`,
    "",
    "## Checklist final",
    "- A resposta ficou contextualizada?",
    "- A conclusao e verificavel?",
    "- O usuario consegue agir a partir do texto?",
    "- Ha uma forma mais simples de dizer o mesmo sem perder qualidade?",
    ""
  ]

  return {
    fileName: `${slug}.md`,
    content: sections.join("\n"),
    category: domain.category,
    source
  }
}

async function main() {
  const config = parseArgs()
  await fs.mkdir(config.outDir, { recursive: true })

  const domainCounts = {}
  for (let index = 0; index < config.count; index += 1) {
    const globalIndex = config.startIndex + index
    const domain = DOMAIN_BLUEPRINTS[globalIndex % DOMAIN_BLUEPRINTS.length]
    const doc = buildDomainDoc(domain, globalIndex)
    await fs.writeFile(path.join(config.outDir, doc.fileName), doc.content, "utf8")
    domainCounts[domain.id] = (domainCounts[domain.id] || 0) + 1
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    outDir: config.outDir,
    count: config.count,
    startIndex: config.startIndex,
    uniqueSourcesPlanned: config.count,
    domainCounts
  }

  await fs.writeFile(
    path.join(config.outDir, "PACK-SUMMARY.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8"
  )

  console.log(`MEGA_PACK_OK ${config.outDir}`)
  console.log(`DOCS_GENERATED ${config.count}`)
  console.log(`UNIQUE_SOURCES_PLANNED ${config.count}`)
}

main().catch((error) => {
  console.error(`MEGA_PACK_ERROR ${error.message}`)
  process.exit(1)
})
