import { BIBLE_STUDY_MODULES } from "./bibleStudyModules.js"

export const DOMAIN_MODULES = {
  developer: {
    id: "developer",
    label: "Dev & Bugs",
    summary: "Codigo, arquitetura, bugs, GitHub, docs e stack moderna.",
    keywords: ["codigo", "code", "bug", "erro", "github", "api", "react", "node", "sql", "deploy"],
    instructions: [
      "Pense como engenheiro de software senior.",
      "Explique causas, diagnostico, correcoes e prevencao.",
      "Quando fizer sentido, forneca codigo, testes e passos de validacao."
    ]
  },
  bible: {
    id: "bible",
    label: "Biblia & Teologia",
    summary: "Estudo biblico, idiomas originais, historia, igreja primitiva e teologia.",
    keywords: ["biblia", "teologia", "hebraico", "aramaico", "grego", "igreja", "pastor", "evangelho"],
    submodules: BIBLE_STUDY_MODULES.map(module => ({
      id: module.id,
      label: module.label
    })),
    instructions: [
      "Atue como pesquisador biblico reverente, claro e criterioso.",
      "Diferencie texto biblico, contexto historico, tradicao protestante, tradicao catolica e discussoes academicas.",
      "Quando houver divergencia doutrinaria, diga claramente onde ha consenso e onde ha interpretacao.",
      "Se o usuario pedir uma linha pastoral especifica, explique a perspectiva sem fingir citacao literal ou fonte inexistente."
    ]
  },
  games_logic: {
    id: "games_logic",
    label: "Jogos & Logica",
    summary: "Xadrez, dama, campo minado, RPG, cubo magico e musica aplicada a estudo e treino.",
    keywords: ["xadrez", "dama", "campo minado", "rpg", "cubo", "musica", "tabuleiro", "abertura"],
    instructions: [
      "Explique regras, estrategia, erros comuns, treino e tomada de decisao.",
      "Use passos curtos, exemplos e exercicios quando o usuario estiver aprendendo."
    ]
  },
  math_science: {
    id: "math_science",
    label: "Matematica & Ciencias",
    summary: "Matematica, logica, programacao, fisica, quimica e biologia em varios niveis.",
    keywords: ["matematica", "logica", "fisica", "quimica", "biologia", "algoritmo", "programacao"],
    instructions: [
      "Explique fundamentos, intuicao, formula, exemplo e verificacao.",
      "Escalone do basico ao avancado conforme o usuario pedir."
    ]
  },
  agribusiness: {
    id: "agribusiness",
    label: "Agronegocio",
    summary: "Solo, satelite, GPS, plantio, colheita, agricultura de precisao e diagnostico operacional.",
    keywords: ["agro", "agronegocio", "solo", "plantio", "colheita", "gps", "satelite", "fazenda"],
    instructions: [
      "Foque em diagnostico pratico, observacao de campo, monitoramento, produtividade e risco operacional.",
      "Quando houver recomendacao sensivel de manejo, diga que validacao local com agronomo e essencial."
    ]
  },
  finance: {
    id: "finance",
    label: "Financeiro",
    summary: "Financas pessoais, corporativas, operacoes, risco e contexto global/local.",
    keywords: ["financeiro", "financas", "investimento", "caixa", "orcamento", "contabilidade", "mercado"],
    instructions: [
      "Explique conceitos, risco, cenarios e impacto pratico.",
      "Nao trate como recomendacao regulatoria individual; destaque incerteza e necessidade de validacao profissional quando aplicavel."
    ]
  }
}

export const DEFAULT_ACTIVE_MODULES = ["developer"]

export function listDomainModules() {
  return Object.values(DOMAIN_MODULES).map(module => ({
    id: module.id,
    label: module.label,
    summary: module.summary,
    submodules: module.submodules || []
  }))
}

export function getDomainModule(moduleId) {
  return DOMAIN_MODULES[moduleId] || null
}

export function getDomainModules(moduleIds = []) {
  return moduleIds
    .map(moduleId => getDomainModule(moduleId))
    .filter(Boolean)
}

export function inferDomainModules(task = "", explicitModules = []) {
  const normalized = String(task || "").toLowerCase()
  const explicit = new Set(Array.isArray(explicitModules) ? explicitModules : [])

  Object.values(DOMAIN_MODULES).forEach(module => {
    if (module.keywords.some(keyword => normalized.includes(keyword))) {
      explicit.add(module.id)
    }
  })

  if (explicit.size === 0) {
    explicit.add(DEFAULT_ACTIVE_MODULES[0])
  }

  return Array.from(explicit)
}
