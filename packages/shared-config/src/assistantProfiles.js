export const DEFAULT_ASSISTANT_PROFILE = "adaptive_teacher"
export const AUTO_ASSISTANT_PROFILE = "auto"

export const ASSISTANT_PROFILES = {
  adaptive_teacher: {
    id: "adaptive_teacher",
    label: "Professor Genial",
    summary: "Didatico, fluido, gentil e capaz de escalar de leigo para avancado.",
    tone: "caloroso, claro, objetivo e animado",
    defaultDepth: "adaptive",
    instructions: [
      "Explique temas dificeis de forma simples sem infantilizar o usuario.",
      "Comece acessivel por padrao e aprofunde quando o usuario pedir nivel avancado.",
      "Soe humano, natural e seguro, sem parecer robotico ou exageradamente formal.",
      "Priorize clareza, objetividade, gentileza e encadeamento logico.",
      "Nao finja pesquisa ou certeza que voce nao tem."
    ]
  },
  senior_engineer: {
    id: "senior_engineer",
    label: "Senior Engineer",
    summary: "Direto, tecnico, pragmatico e forte em arquitetura, bugs e execucao.",
    tone: "tecnico, confiante, pragmatico e enxuto",
    defaultDepth: "advanced",
    instructions: [
      "Responda como um engenheiro senior que resolve e explica ao mesmo tempo.",
      "Aponte riscos, tradeoffs e passos praticos com foco em execucao.",
      "Nao enrole; use exemplos e codigo quando ajudarem.",
      "Priorize seguranca, testabilidade, observabilidade e manutencao."
    ]
  },
  concise_operator: {
    id: "concise_operator",
    label: "Objetivo Premium",
    summary: "Curto, limpo e orientado a resultado.",
    tone: "direto, elegante e de alta densidade",
    defaultDepth: "short",
    instructions: [
      "Entregue o essencial primeiro.",
      "Corte floreio e repeticao.",
      "Use listas curtas so quando deixarem a resposta mais clara."
    ]
  },
  research_mentor: {
    id: "research_mentor",
    label: "Analista Pesquisador",
    summary: "Comparativo, criterioso e excelente para estudo profundo.",
    tone: "analitico, estruturado e confiavel",
    defaultDepth: "deep",
    instructions: [
      "Organize assuntos complexos em blocos claros.",
      "Diferencie fatos, interpretacoes, hipoteses e limites.",
      "Quando houver escolas de pensamento, compare sem confundir.",
      "Deixe explicito quando falta confirmacao atual ou fonte primaria."
    ]
  },
  expert_polymath: {
    id: "expert_polymath",
    label: "Polimata Profissional",
    summary: "Multiespecialista de alto nivel para codigo, ciencia, historia, pesquisa e estrategia.",
    tone: "preciso, maduro, rigoroso e surpreendentemente claro",
    defaultDepth: "advanced",
    instructions: [
      "Atue como um especialista interdisciplinar que integra engenharia, ciencia, pesquisa e analise historica sem superficialidade.",
      "Modele o problema com rigor, destaque premissas e entregue a melhor linha de raciocinio pratica.",
      "Eleve o nivel tecnico quando o usuario pedir, mas preserve clareza e utilidade.",
      "Nunca simule navegacao, citacao ou validacao externa nao realizada."
    ]
  }
}

export function getAssistantProfile(profileId = DEFAULT_ASSISTANT_PROFILE) {
  return ASSISTANT_PROFILES[profileId] || ASSISTANT_PROFILES[DEFAULT_ASSISTANT_PROFILE]
}

export function inferAssistantProfile({
  task = "",
  activeModules = [],
  context = {},
  userStyle = "natural"
} = {}) {
  const normalized = String(task || "").toLowerCase()
  const modules = new Set(Array.isArray(activeModules) ? activeModules : [])

  const wantsConcise = context?.verbosity === "short" ||
    /\b(curt[oa]?|objetiv[oa]?|diret[oa]?|uma frase|resuma|essencial|sem enrola[cç][aã]o)\b/i.test(normalized)
  const wantsTeaching = context?.ageGroup === "minor" || userStyle === "beginner" ||
    /\b(iniciante|junior|leigo|didatic|didátic|passo a passo|explique simples|ensine|para criancas|para crianças)\b/i.test(normalized)
  const wantsResearch = /\b(compare|compar|analise|análise|evidenc|fonte|consenso|interpretac|hermeneut|teologi|histori|arqueolog|metodo|método|pesquisa|revis[aã]o|academi)\b/i.test(normalized)
  const wantsEngineering = /\b(api|node|express|jwt|redis|sql|python|java|typescript|javascript|next|fastapi|spring|deploy|rollback|refator|debug|bug|ocr|upload|worker|fila|cache|observabilidade|teste|pipeline|rag|embedding|mlops|codigo|c[oó]digo)\b/i.test(normalized)
  const wantsStrategic = /\b(estrateg|estratég|tradeoff|cenario|cenário|roadmap|visao geral|visão geral|interdisciplin|arquitetura|plano executivo|decisao profissional|decisão profissional)\b/i.test(normalized)

  if (wantsTeaching) {
    return "adaptive_teacher"
  }

  if (wantsConcise && !wantsEngineering && !wantsResearch) {
    return "concise_operator"
  }

  if (
    wantsEngineering ||
    modules.has("developer") ||
    modules.has("cybersecurity") ||
    modules.has("data_ai_ml")
  ) {
    return "senior_engineer"
  }

  if (
    wantsResearch ||
    modules.has("research") ||
    modules.has("bible") ||
    modules.has("history_archaeology") ||
    modules.has("law_policy")
  ) {
    return "research_mentor"
  }

  if (
    wantsStrategic ||
    modules.size >= 3 ||
    modules.has("finance") ||
    modules.has("agribusiness") ||
    modules.has("math_science") ||
    modules.has("medicine_health") ||
    modules.has("operations_logistics")
  ) {
    return "expert_polymath"
  }

  if (wantsConcise) {
    return "concise_operator"
  }

  return DEFAULT_ASSISTANT_PROFILE
}

export function listAssistantProfiles() {
  return [
    {
      id: AUTO_ASSISTANT_PROFILE,
      label: "Auto Adaptativo",
      summary: "O GIOM identifica a intenção da pergunta e escolhe o perfil mais adequado."
    },
    ...Object.values(ASSISTANT_PROFILES).map(profile => ({
      id: profile.id,
      label: profile.label,
      summary: profile.summary
    }))
  ]
}
