import { DEFAULT_ASSISTANT_PROFILE, getAssistantProfile } from "../../shared-config/src/assistantProfiles.js"
import {
  AI_LEARNING_RULES,
  AI_OPERATING_PRINCIPLES,
  AI_RESEARCH_RULES,
  AI_SAFETY_BOUNDARIES
} from "../../shared-config/src/aiConstitution.js"
import { getBibleStudyModules, inferBibleStudyModules } from "../../shared-config/src/bibleStudyModules.js"
import {
  DEFAULT_PROMPT_PACKS,
  describePromptPacks,
  getPromptPacks
} from "../../shared-config/src/promptPacks.js"
import { describeResearchCapabilities } from "../../shared-config/src/researchCapabilities.js"
import { DEFAULT_ACTIVE_MODULES, getDomainModules, inferDomainModules } from "../../shared-config/src/domainModules.js"

function resolveAudience(task = "", context = {}, userStyle = "natural") {
  const text = String(task || "").toLowerCase()

  if (context?.depthPreference === "advanced" || /\b(avancad|profund|expert|nivel alto|detalhado tecnico)\b/i.test(text)) {
    return "advanced"
  }

  if (context?.ageGroup === "minor" || userStyle === "beginner" || /\b(iniciante|leigo|basico|explica simples|facil)\b/i.test(text)) {
    return "beginner"
  }

  return "adaptive"
}

function buildPreferenceNotes(preferences = {}, userStyle = "natural") {
  const notes = []

  if (preferences.verbosity === "short") {
    notes.push("Comece pela resposta curta e direta.")
  }

  if (preferences.verbosity === "detailed") {
    notes.push("Nao economize contexto util; organize a explicacao em blocos claros.")
  }

  if (preferences.examples) {
    notes.push("Inclua exemplos praticos quando ajudarem.")
  }

  if (preferences.noEmojis) {
    notes.push("Nao use emojis.")
  }

  if (preferences.safetyLevel === "strict") {
    notes.push("Seja mais cauteloso em temas sensiveis.")
  }

  if (preferences.ageGroup === "minor") {
    notes.push("Considere que o usuario pode ser menor de idade e mantenha o conteudo estritamente apropriado.")
  }

  if (userStyle === "urgent") {
    notes.push("Va ao ponto rapidamente e priorize a solucao utilizavel.")
  }

  if (userStyle === "casual") {
    notes.push("Mantenha um tom leve e natural, sem perder precisao.")
  }

  return notes
}

function buildAudienceGuidance(audience = "adaptive") {
  if (audience === "beginner") {
    return [
      "Explique em linguagem simples, com etapas curtas e exemplos concretos.",
      "Nao assuma conhecimento previo desnecessario."
    ]
  }

  if (audience === "advanced") {
    return [
      "Pode aprofundar tecnicamente sem simplificar demais.",
      "Inclua tradeoffs, estrutura conceitual e detalhes de implementacao quando relevantes."
    ]
  }

  return [
    "Comece acessivel por padrao.",
    "Se o usuario demonstrar dominio ou pedir mais profundidade, aumente o nivel tecnico sem mudar de tom."
  ]
}

function buildDomainExcellenceGuidance(activeModules = []) {
  if (!Array.isArray(activeModules) || activeModules.length === 0) {
    return []
  }

  const ids = new Set(activeModules.map(module => module.id))
  const notes = []

  if (ids.has("developer")) {
    notes.push("Em software, atue como combinacao de staff engineer, debugger, arquiteto e code reviewer.")
  }

  if (ids.has("research")) {
    notes.push("Em pesquisa, diferencie pergunta, evidencia, fonte, confianca, lacuna e sintese.")
  }

  if (ids.has("cybersecurity")) {
    notes.push("Em ciberseguranca, permaneça estritamente no lado defensivo, legal e etico.")
  }

  if (ids.has("bible") || ids.has("history_archaeology")) {
    notes.push("Em biblia, historia e arqueologia, separe texto, contexto, evidencia, tradicao e interpretacao.")
  }

  if (ids.has("math_science")) {
    notes.push("Em matematica e ciencias, use metodo, definicoes, verificacao e transparencia sobre premissas.")
  }

  return notes
}

function buildLearningSummary(memoryContext = {}) {
  const userProfile = memoryContext?.userProfile || {}
  const topics = Array.isArray(userProfile.topics) ? userProfile.topics : []
  const preferences = []

  if (userProfile.style) preferences.push(`estilo ${userProfile.style}`)
  if (userProfile.verbosity) preferences.push(`verbosidade ${userProfile.verbosity}`)
  if (userProfile.locale) preferences.push(`locale ${userProfile.locale}`)
  if (userProfile.assistantProfile) preferences.push(`perfil ${userProfile.assistantProfile}`)

  const lines = []
  if (topics.length > 0) {
    lines.push(`Topicos recorrentes aprendidos: ${topics.slice(0, 8).join(", ")}.`)
  }
  if (preferences.length > 0) {
    lines.push(`Preferencias aprendidas: ${preferences.join(", ")}.`)
  }
  if (memoryContext?.learningSummary) {
    lines.push(`Padroes recentes: ${memoryContext.learningSummary}.`)
  }

  return lines.length > 0 ? lines.join(" ") : "Sem padroes aprendidos relevantes alem do contexto recente."
}

function buildKnownFactsSummary(memoryContext = {}) {
  if (memoryContext?.knownFactsText) {
    return memoryContext.knownFactsText
  }

  const knownFacts = memoryContext?.knownFacts || {}
  const lines = []

  if (knownFacts.name) lines.push(`Nome: ${knownFacts.name}`)
  if (knownFacts.workDomain) lines.push(`Area: ${knownFacts.workDomain}`)
  if (knownFacts.responseStyle) lines.push(`Preferencia de resposta: ${knownFacts.responseStyle}`)
  if (knownFacts.role) lines.push(`Funcao: ${knownFacts.role}`)

  return lines.join(" | ")
}

export function buildAssistantPrompt({ task = "", context = {}, memoryContext = {}, ragContext = {}, userStyle = "natural" }) {
  const storedPreferences = memoryContext?.userProfile || {}
  const profileId = context.assistantProfile || storedPreferences.assistantProfile || DEFAULT_ASSISTANT_PROFILE
  const profile = getAssistantProfile(profileId)

  const requestedModules = inferDomainModules(
    task,
    context.activeModules || storedPreferences.activeModules || DEFAULT_ACTIVE_MODULES
  )
  const activeModules = getDomainModules(requestedModules)
  const requestedBibleStudyModules = activeModules.some(module => module.id === "bible")
    ? inferBibleStudyModules(
        task,
        context.bibleStudyModules || storedPreferences.bibleStudyModules || []
      )
    : []
  const bibleStudyModules = getBibleStudyModules(requestedBibleStudyModules)
  const promptPacks = getPromptPacks(
    context.promptPacks || storedPreferences.promptPacks || DEFAULT_PROMPT_PACKS
  )
  const audience = resolveAudience(task, context, userStyle)
  const researchCapabilities = describeResearchCapabilities(context.researchCapabilities || {})
  const promptPackSummary = describePromptPacks(promptPacks.map(promptPack => promptPack.id))

  const preferenceNotes = buildPreferenceNotes(
    {
      ...storedPreferences,
      ...context
    },
    userStyle
  )

  const memorySummary = memoryContext?.contextSummary
    ? `Contexto recente do usuario: ${memoryContext.contextSummary}.`
    : "Ainda sem contexto acumulado relevante."
  const recentConversation = memoryContext?.recentConversationText
    ? `Trecho recente da conversa:\n${memoryContext.recentConversationText}`
    : "Sem trecho recente adicional da conversa."
  const knownFactsSummary = buildKnownFactsSummary(memoryContext)
  const learnedSummary = buildLearningSummary(memoryContext)

  const ragSummary = ragContext?.enriched && ragContext?.context
    ? `Conhecimento recuperado: ${String(ragContext.context).slice(0, 900)}`
    : "Sem recuperacao de conhecimento adicional para esta pergunta."

  const extraInstructions = context.instructions
    ? `\nINSTRUCOES EXTRAS DO CLIENTE:\n- ${String(context.instructions).trim()}`
    : ""

  const moduleLines = activeModules.length > 0
    ? activeModules
        .map(module => `- ${module.label}: ${module.instructions.join(" ")}`)
        .join("\n")
    : "- Geral: responda com equilibrio entre clareza, profundidade e objetividade."

  const bibleModuleLines = bibleStudyModules.length > 0
    ? `\nSUBMODULOS BIBLICOS:\n${bibleStudyModules
        .map(module => `- ${module.label}: ${module.instructions.join(" ")}`)
        .join("\n")}`
    : ""

  const domainExcellence = buildDomainExcellenceGuidance(activeModules)
  const promptPackLines = promptPacks.length > 0
    ? promptPacks
        .map(promptPack => `- ${promptPack.label}: ${promptPack.instructions.join(" ")}`)
        .join("\n")
    : "- Use apenas a constituicao principal do GIOM."

  const systemPrompt = `Voce e GIOM, um assistente premium multiespecialista.

IDENTIDADE E TOM:
- Perfil ativo: ${profile.label}
- Descricao: ${profile.summary}
- Tom base: ${profile.tone}
- Seja fluido, humano, gentil, tecnicamente forte e muito claro.
- Ensine como um professor animado e genial, mas sem teatralidade.
- Deixe assuntos muito dificeis faceis de entender.
- Se o usuario pedir profundidade, entregue nivel avancado de verdade.

CONSTITUICAO PROFISSIONAL:
${AI_OPERATING_PRINCIPLES.map(item => `- ${item}`).join("\n")}
${AI_RESEARCH_RULES.map(item => `- ${item}`).join("\n")}
${AI_LEARNING_RULES.map(item => `- ${item}`).join("\n")}
${AI_SAFETY_BOUNDARIES.map(item => `- ${item}`).join("\n")}

COMPORTAMENTO:
${profile.instructions.map(item => `- ${item}`).join("\n")}
${buildAudienceGuidance(audience).map(item => `- ${item}`).join("\n")}
${domainExcellence.map(item => `- ${item}`).join("\n")}
${preferenceNotes.map(item => `- ${item}`).join("\n")}

ESPECIALIZACOES ATIVAS:
${moduleLines}
${bibleModuleLines}

PROMPT PACKS PROFISSIONAIS:
- ${promptPackSummary.summary}
${promptPackSummary.lines.map(item => `- ${item}`).join("\n")}
${promptPackLines}

PESQUISA E FERRAMENTAS:
- ${researchCapabilities.summary}
${researchCapabilities.lines.map(item => `- ${item}`).join("\n")}
- Se o usuario perguntar o que voce consegue fazer hoje, responda usando estas capacidades de execucao, nao usando frases sobre "minha ultima atualizacao".

MEMORIA, APRENDIZADO E CONTEXTO:
- ${memorySummary}
- ${knownFactsSummary ? `Fatos explicitos do usuario aprendidos: ${knownFactsSummary}.` : "Sem fatos explicitos do usuario confirmados ainda."}
- ${recentConversation}
- ${learnedSummary}
- ${ragSummary}
${extraInstructions}

REGRAS DE SAIDA:
- Responda no idioma principal do usuario, preferindo portugues do Brasil quando a conversa estiver em portugues.
- Seja objetivo antes de ser longo.
- Se houver risco, incerteza ou divergencia de escola, diga isso com clareza.
- Em fatos atuais, legislacao, noticias, precos ou informacoes mutaveis, nao finja atualizacao se a pesquisa ao vivo nao estiver disponivel.
- Em perguntas sobre suas capacidades, limites, acesso web, Google, Bing, Yahoo, navegador, memoria ou RAG, descreva o estado operacional atual desta execucao com linguagem concreta e sem mencionar corte de treinamento.
- Em ciberseguranca, mantenha o foco em defesa, auditoria, resposta e prevencao.
- Em conteudo sexual, trate apenas de educacao, saude, consentimento e seguranca; recuse pornografia explicita.
- Quando apropriado, entregue passos, exemplos, tabelas curtas ou codigo.
- Nao invente fontes nem afirmacoes factuais especificas sem base.
- Nao pareca robotico, pedante ou artificialmente empolgado.`

  return {
    profileId,
    profile,
    activeModules: activeModules.map(module => module.id),
    bibleStudyModules: bibleStudyModules.map(module => module.id),
    promptPacks: promptPacks.map(promptPack => promptPack.id),
    audience,
    systemPrompt
  }
}
