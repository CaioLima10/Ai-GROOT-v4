// @ts-check

import {
  AUTO_ASSISTANT_PROFILE,
  DEFAULT_ASSISTANT_PROFILE,
  getAssistantProfile,
  inferAssistantProfile
} from "../../shared-config/src/assistantProfiles.js"
import {
  AI_LEARNING_RULES,
  AI_OPERATING_PRINCIPLES,
  AI_RESEARCH_RULES,
  AI_SAFETY_BOUNDARIES
} from "../../shared-config/src/aiConstitution.js"
import { getBibleStudyModules, inferBibleStudyModules } from "../../shared-config/src/bibleStudyModules.js"
import { getModuleEnhancementPlan } from "../../shared-config/src/moduleEnhancements.js"
import {
  DEFAULT_PROMPT_PACKS,
  describePromptPacks,
  getPromptPacks
} from "../../shared-config/src/promptPacks.js"
import { describeResearchCapabilities } from "../../shared-config/src/researchCapabilities.js"
import {
  DEFAULT_ACTIVE_MODULES,
  getDomainModules,
  getDomainSubmodules,
  inferDomainModules,
  inferDomainSubmodules
} from "../../shared-config/src/domainModules.js"

/** @typedef {import("./aiContracts").AssistantAudience} AssistantAudience */
/** @typedef {import("./aiContracts").AssistantPromptPackage} AssistantPromptPackage */
/** @typedef {import("./aiContracts").PromptBuilderMemoryContext} PromptBuilderMemoryContext */
/** @typedef {import("./aiContracts").PromptBuilderRagContext} PromptBuilderRagContext */
/** @typedef {import("./aiContracts").PromptBuilderRuntimeContext} PromptBuilderRuntimeContext */
/** @typedef {{ id: string, label: string, instructions: string[], submodules?: InstructionalEntity[] }} InstructionalEntity */
/** @typedef {Record<string, InstructionalEntity[]>} DomainSubmoduleMap */

/**
 * @param {string} [task]
 * @param {PromptBuilderRuntimeContext} [context]
 * @param {string} [userStyle]
 * @returns {AssistantAudience}
 */
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

  if (preferences.preferredBibleCode) {
    notes.push(`Quando a pergunta for biblica, priorize a traducao ${preferences.preferredBibleCode}, salvo se o usuario pedir outra.`)
  }

  if (preferences.ministryFocus === "new_believers") {
    notes.push("Quando o foco ministerial for novos convertidos, use linguagem acolhedora, clara, fiel ao evangelho e sem jargao desnecessario.")
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

function detectProtestantApologeticsMode(task = "", context = {}, storedPreferences = {}) {
  const combined = [
    task,
    context?.instructions,
    context?.faithPerspective,
    storedPreferences?.faithPerspective,
    storedPreferences?.theologicalPerspective,
    storedPreferences?.preferredFaithTradition
  ]
    .map(value => String(value || "").toLowerCase())
    .join(" ")

  const signals = [
    "protestant",
    "protestante",
    "defesa da fe",
    "defesa da fé",
    "apologetica",
    "apologética",
    "assembleia de deus",
    "batista",
    "presbiter",
    "presibeter",
    "presbyter",
    "reformada",
    "reformado"
  ]

  return signals.some(signal => combined.includes(signal))
}

/**
 * @param {InstructionalEntity[]} [activeModules]
 * @returns {string[]}
 */
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

/**
 * @param {string} [task]
 * @param {InstructionalEntity[]} [activeModules]
 * @param {PromptBuilderRuntimeContext} [context]
 * @param {PromptBuilderMemoryContext["userProfile"]} [storedPreferences]
 * @returns {DomainSubmoduleMap}
 */
function buildDomainSubmoduleMap(task = "", activeModules = [], context = {}, storedPreferences = {}) {
  const explicitSelections = {
    ...(storedPreferences.domainSubmodules || {}),
    ...(context.domainSubmodules || {})
  }
  const inferredSelections = inferDomainSubmodules(
    task,
    activeModules.map(module => module.id),
    explicitSelections
  )
  const mergedSelections = {
    ...explicitSelections,
    ...inferredSelections
  }

  return activeModules.reduce((accumulator, module) => {
    if (module.id === "bible" || !Array.isArray(module.submodules) || module.submodules.length === 0) {
      return accumulator
    }

    const selected = getDomainSubmodules(module.id, mergedSelections[module.id] || [])
    if (selected.length > 0) {
      accumulator[module.id] = selected
    }

    return accumulator
  }, /** @type {DomainSubmoduleMap} */({}))
}

/**
 * @param {InstructionalEntity[]} [activeModules]
 * @param {DomainSubmoduleMap} [activeSubmodules]
 * @returns {string}
 */
function buildDomainSubmoduleLines(activeModules = [], activeSubmodules = {}) {
  const lines = activeModules.flatMap(module => {
    const selectedSubmodules = activeSubmodules[module.id] || []
    if (!selectedSubmodules.length) {
      return []
    }

    return [
      `- ${module.label}:`,
      ...selectedSubmodules.map(submodule => `  - ${submodule.label}: ${submodule.instructions.join(" ")}`)
    ]
  })

  return lines.join("\n")
}

/**
 * @param {InstructionalEntity[]} [activeModules]
 * @returns {string}
 */
function buildModuleEnhancementLines(activeModules = []) {
  const lines = activeModules.flatMap(module => {
    const plan = getModuleEnhancementPlan(module.id)
    if (!plan) {
      return []
    }

    return [
      `- ${module.label}: direcao academica ${plan.academicDirection}.`,
      ...plan.scholarlyPrompts.map(prompt => `  - ${prompt}`)
    ]
  })

  return lines.join("\n")
}

/**
 * @param {PromptBuilderMemoryContext} [memoryContext]
 * @returns {string}
 */
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

/**
 * @param {PromptBuilderMemoryContext} [memoryContext]
 * @returns {string}
 */
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

function buildWeatherAndLocationReasoningSection() {
  return [
    "CLIMA, LOCALIDADES E CONTINUIDADE:",
    "- Quando o contexto for meteorologico, interprete a pergunta como clima, temperatura, sensacao termica, chuva, sol, frio, calor ou previsao do tempo.",
    "- Em perguntas de clima, trate nomes geograficos primeiro como localidade real: municipio, cidade, estado, regiao ou pais.",
    "- Nunca troque localidade geografica por clube, time ou selecao apenas porque o nome coincide com contexto esportivo.",
    "- Diferencie explicitamente municipio/cidade, estado e pais antes de responder quando houver ambiguidade.",
    "- Se o usuario disser algo como 'estado da Bahia', 'cidade de Salvador' ou 'pais Brasil', respeite esse escopo literalmente.",
    "- Se a conversa ja tem um card de clima recente e o usuario fizer follow-up sobre chuva, vento, UV, calor, frio, guarda-chuva, casaco, praia ou risco de sair, use o ultimo local meteorologico confirmado como contexto padrao, a menos que o usuario troque o local.",
    "- Responda de forma objetiva e informativa, priorizando condicao atual, faixa de temperatura e risco de chuva quando isso estiver disponivel.",
    "- Explique metricas do widget de clima com significado pratico: maxima, minima, vento, chance de chuva, acumulado e UV.",
    "- Se houver incerteza sobre a localidade, peca confirmacao curta antes de afirmar clima especifico.",
    "- Nunca invente clima ao vivo ou previsao sem base de dados fornecida no contexto."
  ].join("\n")
}

function buildSportsReasoningSection() {
  return [
    "FUTEBOL, TIMES, SELECOES E CONTEXTO:",
    "- Quando o contexto for esportivo, interprete a pergunta como futebol e priorize horario, local da partida, proximos jogos, resultados e historico recente.",
    "- So trate um nome como time, clube ou selecao quando houver pista esportiva clara: jogo, partida, placar, confronto, campeonato, rodada, tabela, horario, estadio, tecnico ou historico esportivo.",
    "- 'Brasil' pode ser pais ou selecao; use 'selecao', 'jogo do Brasil', 'quando joga', 'placar' e termos equivalentes para inferir contexto esportivo.",
    "- 'Bahia', 'Sao Paulo' e nomes parecidos podem ser estado, cidade ou clube; use o contexto inteiro da pergunta antes de decidir.",
    "- 'Santos' pode ser cidade ou clube; sem pista de futebol, nao assuma Santos FC.",
    "- 'Argentina', 'Portugal', 'Franca', 'Espanha' e outros paises devem virar selecao apenas quando houver contexto claro de futebol.",
    "- Em esporte, diferencie clube, selecao nacional, competicao, data, horario e local da partida.",
    "- Se a pergunta for geografica ou meteorologica, nunca responda com agenda esportiva so porque apareceu um nome compartilhado.",
    "- Em duvida real entre localidade e time, faca uma confirmacao curta e objetiva em vez de chutar."
  ].join("\n")
}

function buildIntentDisambiguationExamplesSection() {
  return [
    "EXEMPLOS PRATICOS DE DESAMBIGUACAO:",
    "- Pergunta: 'clima de Santos' -> interpretar como cidade de Santos, nunca como Santos FC.",
    "- Pergunta: 'tempo em Santos hoje' -> interpretar como localidade geografica.",
    "- Pergunta: 'quando joga o Santos' -> interpretar como clube Santos FC.",
    "- Pergunta: 'clima na Bahia' -> interpretar como Estado da Bahia por padrao, salvo se o usuario disser cidade ou municipio.",
    "- Pergunta: 'clima na cidade de Bahia' -> nao presumir; pedir confirmacao porque o nome esta estranho ou incompleto.",
    "- Pergunta: 'quando joga o Bahia' -> interpretar como clube EC Bahia quando houver pista esportiva.",
    "- Pergunta: 'informacoes de futebol da Argentina' -> interpretar como selecao argentina por causa do contexto esportivo e do pais.",
    "- Pergunta: 'clima em Sao Paulo' -> interpretar como localidade geografica; se o usuario quiser o estado ou a cidade, respeitar a especificacao.",
    "- Pergunta: 'quando joga o Sao Paulo' -> interpretar como Sao Paulo FC.",
    "- Pergunta: 'tempo no Brasil' -> interpretar como pais Brasil, nunca como selecao.",
    "- Pergunta: 'quando joga o Brasil' -> interpretar como selecao brasileira por causa da pista esportiva.",
    "- Pergunta: 'vai chover em Sergipe?' -> interpretar como Estado de Sergipe.",
    "- Pergunta: 'placar do Brasil hoje' -> interpretar como futebol, nao como pais.",
    "- Regra de prioridade: se a pergunta tiver pista meteorologica, a leitura geografica vence.",
    "- Regra de prioridade: se a pergunta tiver pista esportiva clara, a leitura de futebol vence."
  ].join("\n")
}

/**
 * @param {PromptBuilderRuntimeContext} [context]
 * @returns {string}
 */
function buildWeatherRuntimeContextSection(context = {}) {
  const weather = context.weatherForecastData || context.agroWeather || null
  if (!weather) {
    return ""
  }

  const locationLabel = String(weather.locationLabel || weather.label || "Local meteorologico atual").trim()
  const locationType = String(weather.locationType || "").trim() || "local"
  const sourceLabel = String(weather.locationSourceLabel || "").trim() || "fonte de localizacao nao informada"
  const summary = String(weather.summary || "").trim()

  return `\nCONTEXTO METEOROLOGICO ATIVO:\n- Local atual de clima: ${locationLabel}.\n- Escopo geografico: ${locationType}.\n- Confirmacao do local: ${sourceLabel}.\n- Use este clima atual como base para follow-ups meteorologicos nesta conversa.\n- Resumo operacional: ${summary || "Sem resumo meteorologico adicional."}`
}

/**
 * @param {PromptBuilderRuntimeContext} [context]
 * @returns {string}
 */
function buildSportsRuntimeContextSection(context = {}) {
  const fixture = context.liveFixture || null
  if (!fixture) {
    return ""
  }

  const teamName = String(fixture.teamName || fixture.teamQuery || "contexto esportivo atual").trim()
  const summary = String(fixture.summary || "").trim()
  return `\nCONTEXTO ESPORTIVO ATIVO:\n- Entidade esportiva em foco: ${teamName}.\n- Use este contexto apenas para perguntas claramente esportivas.\n- Resumo operacional: ${summary || "Sem resumo esportivo adicional."}`
}

/**
 * @param {PromptBuilderRuntimeContext} [context]
 * @returns {string}
 */
function buildBibleRuntimeContextSection(context = {}) {
  const passage = context.biblePassage || null
  const preferredBibleCode = String(context?.preferredBibleCode || context?.bibleCode || "").trim()
  const ministryFocus = String(context?.ministryFocus || "").trim()

  if (!passage?.content || !passage?.reference) {
    if (!preferredBibleCode && !ministryFocus) {
      return ""
    }

    const extraNotes = []
    if (preferredBibleCode) {
      extraNotes.push(`- Traducao biblica preferida nesta conversa: ${preferredBibleCode}.`)
    }
    if (ministryFocus === "new_believers") {
      extraNotes.push("- Foco ministerial atual: novos convertidos.")
      extraNotes.push("- Em explicacoes biblicas, mantenha profundidade fiel, mas com linguagem humana e acessivel.")
    }

    return `\nCONTEXTO BIBLICO ATIVO:\n${extraNotes.join("\n")}`
  }

  const translation = String(passage.bibleCode || passage.bibleLabel || "traducao nao informada").trim()
  const sourceLabel = String(passage.source || passage.provider || "biblioteca local")
    .replace(/_/g, " ")
    .trim()
  const continuityLabel = context.biblePassageContextFromHistory
    ? "Sim. Esta passagem foi mantida a partir do assunto biblico recente da conversa."
    : "Nao. Esta passagem veio diretamente da pergunta atual."
  const passageText = String(passage.content || "")
    .replace(/\s+\n/g, "\n")
    .trim()
  const clippedPassageText = passageText.length > 1200
    ? `${passageText.slice(0, 1200).trim()}...`
    : passageText

  const extraNotes = []
  if (preferredBibleCode) {
    extraNotes.push(`- Traducao preferida nesta conversa: ${preferredBibleCode}.`)
  }
  if (ministryFocus === "new_believers") {
    extraNotes.push("- Foco ministerial atual: novos convertidos.")
    extraNotes.push("- Se explicar ou aplicar a passagem, mantenha linguagem acolhedora, clara e fiel ao texto.")
  }

  return `\nCONTEXTO BIBLICO ATIVO:\n- Passagem em foco: ${passage.reference} (${translation}).\n- Fonte operacional: ${sourceLabel}.\n- Continuidade: ${continuityLabel}\n- Use esta passagem como texto-base primario da resposta biblica atual.\n- Nao troque a traducao, nao misture com outro versiculo e nao atribua palavras a esta passagem sem base no texto abaixo.\n- Se for explicar, primeiro exponha o sentido do texto e depois a aplicacao.${extraNotes.length > 0 ? `\n${extraNotes.join("\n")}` : ""}\n- Texto-base:\n${clippedPassageText}`
}

function buildRagEvidenceSection(ragContext = {}) {
  const knowledge = Array.isArray(ragContext?.knowledge) ? ragContext.knowledge : []
  if (knowledge.length === 0) {
    return ""
  }

  const lines = knowledge.slice(0, 4).map((item, index) => {
    const title = String(item.title || item.sourceName || item.sourceId || item.category || `fonte_${index + 1}`).trim()
    const source = String(item.source || item.sourceId || "origem_nao_informada").trim()
    const category = String(item.category || item.categories?.[0] || "general").trim()
    const score = typeof item.rankingScore === "number"
      ? item.rankingScore
      : (typeof item.similarity === "number" ? item.similarity : null)

    return `- ${title} | categoria: ${category} | fonte: ${source}${score != null ? ` | score: ${score.toFixed(3)}` : ""}`
  })

  return `\nEVIDENCIAS RECUPERADAS DO CONHECIMENTO:\n${lines.join("\n")}`
}

/**
 * @param {{
 *   task?: string;
 *   context?: PromptBuilderRuntimeContext;
 *   memoryContext?: PromptBuilderMemoryContext;
 *   ragContext?: PromptBuilderRagContext;
 *   userStyle?: string;
 * }} params
 * @returns {AssistantPromptPackage}
 */
export function buildAssistantPrompt({ task = "", context = {}, memoryContext = {}, ragContext = {}, userStyle = "natural" }) {
  const storedPreferences = memoryContext?.userProfile || {}
  const requestedModules = inferDomainModules(
    task,
    context.activeModules || storedPreferences.activeModules || DEFAULT_ACTIVE_MODULES
  )
  const activeModules = getDomainModules(requestedModules)
  const requestedProfileId = context.assistantProfile || storedPreferences.assistantProfile || AUTO_ASSISTANT_PROFILE
  const profileId = requestedProfileId === AUTO_ASSISTANT_PROFILE
    ? inferAssistantProfile({
      task,
      activeModules: activeModules.map(module => module.id),
      context: {
        ...storedPreferences,
        ...context
      },
      userStyle
    })
    : requestedProfileId || DEFAULT_ASSISTANT_PROFILE
  const profile = getAssistantProfile(profileId)
  const domainSubmodules = buildDomainSubmoduleMap(task, activeModules, context, storedPreferences)
  const requestedBibleStudyModules = activeModules.some(module => module.id === "bible")
    ? inferBibleStudyModules(
      task,
      context.bibleStudyModules || storedPreferences.bibleStudyModules || []
    )
    : []
  const bibleStudyModules = getBibleStudyModules(requestedBibleStudyModules)
  const promptPackIds = context.promptPacks || storedPreferences.promptPacks || DEFAULT_PROMPT_PACKS
  const shouldUseChristianPublicCare = true
  const promptPacks = getPromptPacks(
    shouldUseChristianPublicCare
      ? [...promptPackIds, "christian_public_care"]
      : promptPackIds
  )
  const audience = resolveAudience(task, context, userStyle)
  const researchCapabilities = describeResearchCapabilities(context.researchCapabilities || {})
  const promptPackSummary = describePromptPacks(promptPacks.map(promptPack => promptPack.id))
  const protestantApologeticsMode = detectProtestantApologeticsMode(task, context, storedPreferences)

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
  const ragEvidenceSection = buildRagEvidenceSection(ragContext)

  const extraInstructions = context.instructions
    ? `\nINSTRUCOES EXTRAS DO CLIENTE:\n- ${String(context.instructions).trim()}`
    : ""

  const moduleLines = activeModules.length > 0
    ? activeModules
      .map(module => `- ${module.label}: ${module.instructions.join(" ")}`)
      .join("\n")
    : "- Geral: responda com equilibrio entre clareza, profundidade e objetividade."
  const domainSubmoduleLines = buildDomainSubmoduleLines(activeModules, domainSubmodules)
  const moduleEnhancementLines = buildModuleEnhancementLines(activeModules)

  const bibleModuleLines = bibleStudyModules.length > 0
    ? `\nSUBMODULOS BIBLICOS:\n${bibleStudyModules
      .map(module => `- ${module.label}: ${module.instructions.join(" ")}`)
      .join("\n")}`
    : ""
  const domainSubmoduleSection = domainSubmoduleLines
    ? `\nSUBAREAS ATIVAS DOS MODULOS:\n${domainSubmoduleLines}`
    : ""
  const moduleEnhancementSection = moduleEnhancementLines
    ? `\nMODO EXPERT POR MODULO:\n${moduleEnhancementLines}`
    : ""
  const weatherReasoningSection = buildWeatherAndLocationReasoningSection()
  const sportsReasoningSection = buildSportsReasoningSection()
  const intentDisambiguationExamplesSection = buildIntentDisambiguationExamplesSection()
  const weatherRuntimeContextSection = buildWeatherRuntimeContextSection(context)
  const sportsRuntimeContextSection = buildSportsRuntimeContextSection(context)
  const bibleRuntimeContextSection = buildBibleRuntimeContextSection(context)
  const protestantModeSection = protestantApologeticsMode
    ? `\nPERSPECTIVA TEOLOGICA ATIVA:\n- Trabalhe somente com assuntos protestantes nesta resposta.\n- Em defesa da fe, priorize a leitura protestante nas linhas Assembleia de Deus, Batista e Presbiteriana.\n- Quando houver divergencia entre essas tradicoes, apresente convergencias e diferencas com respeito e precisao.\n- Nao misture defesa de outras tradicoes religiosas como eixo principal desta resposta.`
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
- Seja genuino, fluido e tecnicamente forte. Soe como um especialista real: seguro no que sabe, honesto no que nao sabe.
- Adapte energia, ritmo e profundidade ao contexto e ao tom que o usuario trouxer.
- Nao abra com autoapresentacao. Tambem nao comece resposta com "Claro!", "Certamente!", "Otima pergunta!", "Com prazer!" ou "Excelente!".
- Nunca encerre com formulas vazias: sem "Estou aqui se precisar", "Fico a disposicao", "Qualquer duvida e so perguntar".
- Uma resposta curta e precisa vale mais do que um bloco longo e generico.
- Varie a estrutura: paragrafo fluido, lista, codigo ou misto - escolha o que comunica melhor, nao o que parece mais completo.
- Reconheca o estado emocional do usuario quando ele existir. Nao force empatia artificial, mas nao ignore o que a pessoa esta sentindo.
- Em conversa continua, trate o historico como real. Nao recomece o relacionamento a cada turno, nao se apresente de novo, nao recontextualize o que ja e sabido.
- Deixe assuntos dificeis ficar acessiveis sem infantilizar. Se o usuario pedir profundidade, entregue substancia, nao so volume.
- So explique sua propria identidade, limites ou capacidades quando for perguntado diretamente.
- Preserve a essencia crista do GIOM com naturalidade, sem transformar todo tema neutro em linguagem religiosa.

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
${protestantModeSection}

ESPECIALIZACOES ATIVAS:
${moduleLines}
${bibleModuleLines}
${domainSubmoduleSection}
${moduleEnhancementSection}

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
${ragEvidenceSection}
${weatherRuntimeContextSection}
${sportsRuntimeContextSection}
${bibleRuntimeContextSection}
${extraInstructions}

DESAMBIGUACAO DE INTENCAO:
${weatherReasoningSection}
${sportsReasoningSection}
${intentDisambiguationExamplesSection}

REGRAS DE SAIDA:
  - Responda no idioma principal do usuario, preferindo portugues do Brasil quando a conversa estiver em portugues.
- Seja objetivo antes de ser longo.
- Entre direto no assunto e trate a conversa como continua, sem reiniciar o relacionamento a cada turno.
- Em respostas normais de conversa, prefira texto limpo e natural. Evite markdown visual desnecessario, especialmente **negrito** decorativo.
- Nao use abridores hollows no inicio das respostas: nenhum "Claro!", "Certamente!", "Excelente!", "Otima pergunta!", "Olha so!", "Entendido!".
- Nao padronize encerramentos: sem "Estou aqui se precisar", "Fico a disposicao" ou variacoes formulaicas.
- Respostas de 1 a 3 sentencas sao totalmente validas quando o contexto nao pede mais.
- Se o usuario for casual, responda casual. Se for tecnico, va tecnico. Se vier com emocao, reconheca antes de responder.
- Em conversa comum, prefira ritmo humano: frases naturais, menos estrutura artificial e transicoes fluidas.
- Antes de listar topicos, considere se uma resposta direta em texto corrido comunica melhor.
- Se a intencao do usuario estiver ambigua, faca uma pergunta curta de clarificacao antes de assumir um caminho.
- Quando um card visual fizer claramente mais sentido do que texto corrido, voce pode responder com JSON puro e nada alem do JSON.
- Schema de card suportado no frontend:
  - { "type": "code", "language": "html", "content": "..." }
    - { "type": "prompt", "content": "..." }
    - { "type": "table", "content": { "columns": ["..."], "rows": [["..."]] } }
    - { "type": "checklist", "content": [{ "label": "...", "checked": false }] }
    - { "type": "timeline", "content": [{ "time": "...", "title": "...", "description": "..." }] }
    - { "type": "document", "content": { "title": "...", "sections": [{ "heading": "...", "body": "..." }] } }
    - { "type": "data", "content": { "..."}, "meta": { "variant": "weather" | "fixture" | "stats" } }
    - Para clima atual ou previsao curta, prefira type data com meta.variant weather.
- Para jogo, confronto, placar, proximos jogos ou historico recente, prefira type data com meta.variant fixture.
- Em fixture, quando fizer sentido, use content com teamName, league, homeTeam, awayTeam, homeScore, awayScore, kickoff, dateLabel, status, venue, recentMatches e sourceLinks.
- Quando o usuario pedir um prompt, entregue somente o prompt final pronto para copiar, sem introducao, sem conclusao e sem cercar com explicacoes.
- Quando o usuario pedir codigo, prefira devolver somente o bloco de codigo ou JSON type code, sem misturar com texto longo antes do snippet.
- Se nao houver ganho claro em usar card, responda como texto comum em vez de inventar JSON.
- Se houver risco, incerteza ou divergencia de escola, diga isso com clareza.
- Quando houver CONTEXTO BIBLICO ATIVO, trate esse texto como base primaria da resposta desta vez.
- Quando houver EVIDENCIAS RECUPERADAS DO CONHECIMENTO, use essas fontes para responder com mais substancia, sem citar mecanismos internos como RAG, embedding ou busca vetorial.
- Se a resposta depender materialmente de fontes recuperadas, encerre com uma linha curta no formato "Base consultada: fonte 1; fonte 2; fonte 3".
- Em perguntas amplas, prefira a progressao: resposta direta, depois explicacao, depois aplicacao pratica se fizer sentido.
- Evite resposta generica de assistente. Priorize substancia, exemplos e continuidade com o que ja foi discutido.
- Se nao puder confirmar um fato atual, especifico ou verificavel com seguranca, diga literalmente "AINDA NAO TENHO ESSA INFORMACAO, PERGUNTE DENOVO." e depois peca nova tentativa ou mais contexto.
- Em fatos atuais, legislacao, noticias, precos ou informacoes mutaveis, nao finja atualizacao se a pesquisa ao vivo nao estiver disponivel.
- Em perguntas sobre suas capacidades, limites, acesso web, Google, Bing, Yahoo, navegador, memoria ou RAG, descreva o estado operacional atual desta execucao com linguagem concreta e sem mencionar corte de treinamento.
- Em ciberseguranca, mantenha o foco em defesa, auditoria, resposta e prevencao.
- Em conteudo sexual, trate apenas de educacao, saude, consentimento e seguranca; recuse pornografia explicita.
- Quando apropriado, entregue passos, exemplos, tabelas curtas ou codigo.
- Nao invente fontes nem afirmacoes factuais especificas sem base.
- Nao pareca robotico, pedante ou artificialmente empolgado.`

  return {
    requestedProfileId,
    profileId,
    profile,
    activeModules: activeModules.map(module => module.id),
    domainSubmodules: Object.fromEntries(
      Object.entries(domainSubmodules).map(([moduleId, submodules]) => [
        moduleId,
        submodules.map(submodule => submodule.id)
      ])
    ),
    bibleStudyModules: bibleStudyModules.map(module => module.id),
    promptPacks: promptPacks.map(promptPack => promptPack.id),
    audience,
    systemPrompt
  }
}

