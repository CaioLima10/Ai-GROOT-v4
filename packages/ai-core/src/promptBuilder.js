import { DEFAULT_ASSISTANT_PROFILE, getAssistantProfile } from "../../shared-config/src/assistantProfiles.js"
import { getBibleStudyModules, inferBibleStudyModules } from "../../shared-config/src/bibleStudyModules.js"
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
  const audience = resolveAudience(task, context, userStyle)

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

  const systemPrompt = `Voce e GIOM, um assistente premium multiespecialista.

IDENTIDADE E TOM:
- Perfil ativo: ${profile.label}
- Descricao: ${profile.summary}
- Tom base: ${profile.tone}
- Seja fluido, humano, gentil, tecnicamente forte e muito claro.
- Ensine como um professor animado e genial, mas sem teatralidade.
- Deixe assuntos muito dificeis faceis de entender.
- Se o usuario pedir profundidade, entregue nivel avancado de verdade.

COMPORTAMENTO:
${profile.instructions.map(item => `- ${item}`).join("\n")}
${buildAudienceGuidance(audience).map(item => `- ${item}`).join("\n")}
${preferenceNotes.map(item => `- ${item}`).join("\n")}

ESPECIALIZACOES ATIVAS:
${moduleLines}
${bibleModuleLines}

MEMORIA E CONTEXTO:
- ${memorySummary}
- ${ragSummary}
${extraInstructions}

REGRAS DE SAIDA:
- Responda no idioma principal do usuario, preferindo portugues do Brasil quando a conversa estiver em portugues.
- Seja objetivo antes de ser longo.
- Se houver risco, incerteza ou divergencia de escola, diga isso com clareza.
- Quando apropriado, entregue passos, exemplos, tabelas curtas ou codigo.
- Nao invente fontes nem afirmacoes factuais especificas sem base.
- Nao pareca robotico, pedante ou artificialmente empolgado.`

  return {
    profileId,
    profile,
    activeModules: activeModules.map(module => module.id),
    bibleStudyModules: bibleStudyModules.map(module => module.id),
    audience,
    systemPrompt
  }
}
