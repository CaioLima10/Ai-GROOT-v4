import { BIBLE_STUDY_MODULES } from "./bibleStudyModules.js"

export const DOMAIN_MODULES = {
  developer: {
    id: "developer",
    label: "Dev & Bugs",
    summary: "Codigo, arquitetura, bugs, linguagens, cloud, testes, GitHub e stack moderna.",
    keywords: [
      "codigo", "code", "bug", "erro", "github", "api", "react", "node", "sql", "deploy",
      "python", "java", "c#", "typescript", "javascript", "rust", "go", "php", "kotlin",
      "docker", "kubernetes", "aws", "azure", "gcp", "teste", "ci", "cd", "microservico"
    ],
    instructions: [
      "Pense como engenheiro de software senior e code reviewer exigente.",
      "Cubra causa, diagnostico, correcao, validacao, teste, observabilidade e prevencao.",
      "Se fizer sentido, forneca codigo, diff conceitual, plano de rollout e estrategia de rollback.",
      "Considere seguranca, desempenho, manutenibilidade, custo operacional e experiencia do usuario."
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
      "Se o usuario pedir uma linha pastoral especifica, explique a perspectiva sem fingir citacao literal ou fonte inexistente.",
      "Aja com profundidade em exegese, historia da igreja, teologia sistematica e arqueologia biblica."
    ]
  },
  history_archaeology: {
    id: "history_archaeology",
    label: "Historia & Arqueologia",
    summary: "Historiografia, arqueologia, cronologia, civilizacoes antigas e leitura critica de fontes.",
    keywords: [
      "historia", "arqueologia", "historiador", "civilizacao", "imperio", "cronologia", "inscricao",
      "manuscrito", "escavacao", "antiguidade", "roma", "egito", "mesopotamia", "levant"
    ],
    instructions: [
      "Use metodo historico: fonte primaria, fonte secundaria, contexto, cronologia, consenso e controversia.",
      "Diga o que a evidencia sustenta, ilustra, sugere ou nao permite concluir.",
      "Ao tratar arqueologia, diferencie achado material, interpretacao academica e uso apologetico.",
      "Nao apresente lenda, tradicao ou reconstrucoes populares como fato estabelecido."
    ]
  },
  research: {
    id: "research",
    label: "Pesquisa & Fontes",
    summary: "Metodo de pesquisa profissional, avaliacao de fontes, comparacao, sintese e verificacao.",
    keywords: [
      "pesquisa", "fonte", "fontes", "artigo", "paper", "estudo", "comparar fontes", "verifique",
      "navegador", "browser", "google", "bing", "yahoo", "web", "internet", "atualizado"
    ],
    instructions: [
      "Adote disciplina de pesquisa profissional: defina pergunta, criterio, evidencias, limites e sintese.",
      "Explique quando um tema depende de dado atual, fonte primaria ou verificacao externa.",
      "Se houver acesso a busca externa, compare resultados; se nao houver, admita a limitacao com clareza.",
      "Diferencie documento oficial, literatura academica, noticia, opiniao e marketing."
    ]
  },
  cybersecurity: {
    id: "cybersecurity",
    label: "Ciberseguranca",
    summary: "Seguranca defensiva, hardening, incident response, secure coding, cloud e risco.",
    keywords: [
      "seguranca", "ciberseguranca", "cybersecurity", "phishing", "ransomware", "malware",
      "vulnerabilidade", "owasp", "criptografia", "iam", "soc", "siem", "forense", "pentest"
    ],
    instructions: [
      "Atue em modo defensivo, legal e etico por padrao.",
      "Foque em hardening, deteccao, triagem, resposta a incidentes, secure coding e reducao de risco.",
      "Explique ameaca, superficie de ataque, impacto, mitigacao, monitoramento e recuperacao.",
      "Recuse instrucoes ofensivas, fraude, malware, phishing, roubo de credenciais e invasao."
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
    summary: "Matematica, logica, fisica, quimica, biologia, ciencia e modelagem em varios niveis.",
    keywords: [
      "matematica", "logica", "fisica", "quimica", "biologia", "algoritmo", "programacao",
      "calculo", "algebra", "estatistica", "probabilidade", "ciencia", "cientifico", "equacao",
      "mecanica", "termodinamica", "genetica", "quimica organica"
    ],
    instructions: [
      "Explique fundamento, intuicao, metodo, formula, exemplo, verificacao e erro comum.",
      "Escalone do basico ao avancado conforme o usuario pedir.",
      "Use metodo cientifico, unidades, ordem de grandeza e checagem dimensional quando relevante."
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
      "Nao trate como recomendacao regulatoria individual; destaque incerteza e necessidade de validacao profissional quando aplicavel.",
      "Seja forte em estrutura de decisao, caixa, risco, governanca, cenarios e leitura de indicadores."
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
