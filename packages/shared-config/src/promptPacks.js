export const DEFAULT_PROMPT_PACKS = [
  "chatgpt_reasoning",
  "github_copilot_engineering",
  "gemini_research"
]

export const PROMPT_PACKS = {
  chatgpt_reasoning: {
    id: "chatgpt_reasoning",
    label: "Chat Reasoning",
    summary: "Raciocinio estruturado, clareza progressiva e resposta util antes de floreio.",
    source: "inspirado em fluxos profissionais de assistentes conversacionais",
    instructions: [
      "Estruture a resposta por objetivo, premissas, abordagem, resultado e proximos passos quando isso ajudar.",
      "Comece pela melhor resposta pratica e depois aprofunde.",
      "Quando houver ambiguidade, torne as suposicoes explicitas sem fingir certeza."
    ]
  },
  github_copilot_engineering: {
    id: "github_copilot_engineering",
    label: "Copilot Engineering",
    summary: "Pareamento de codigo, diffs minimais, validação e foco em implementação.",
    source: "inspirado em workflows de copilotos de engenharia",
    instructions: [
      "Pense como pair programmer senior orientado a entregar codigo utilizavel.",
      "Prefira passos concretos, patches pequenos, plano de teste e verificacao pos-mudanca.",
      "Ao lidar com bugs, destaque causa provavel, diagnostico, correcao e como evitar regressao."
    ]
  },
  gemini_research: {
    id: "gemini_research",
    label: "Research Synthesis",
    summary: "Sintese comparativa, visao multimodal e disciplina de pesquisa com transparência.",
    source: "inspirado em assistentes de pesquisa multimodal",
    instructions: [
      "Quando pesquisar ou sintetizar conhecimento, compare evidencias, recortes e confianca.",
      "Diferencie observacao, inferencia, fonte, lacuna e recomendacao.",
      "Se a busca ao vivo nao estiver disponivel, diga isso claramente e trabalhe com memoria e RAG."
    ]
  }
}

export function getPromptPack(promptPackId) {
  return PROMPT_PACKS[promptPackId] || null
}

export function getPromptPacks(promptPackIds = DEFAULT_PROMPT_PACKS) {
  const ids = Array.isArray(promptPackIds) && promptPackIds.length > 0
    ? promptPackIds
    : DEFAULT_PROMPT_PACKS

  return Array.from(new Set(ids))
    .map(promptPackId => getPromptPack(promptPackId))
    .filter(Boolean)
}

export function listPromptPacks() {
  return Object.values(PROMPT_PACKS).map(promptPack => ({
    id: promptPack.id,
    label: promptPack.label,
    summary: promptPack.summary,
    source: promptPack.source
  }))
}

export function describePromptPacks(promptPackIds = DEFAULT_PROMPT_PACKS) {
  const promptPacks = getPromptPacks(promptPackIds)
  if (promptPacks.length === 0) {
    return {
      summary: "Sem prompt packs adicionais ativos alem da constituicao principal do GIOM.",
      lines: []
    }
  }

  return {
    summary: `Prompt packs ativos: ${promptPacks.map(promptPack => promptPack.label).join(", ")}.`,
    lines: promptPacks.map(promptPack => `${promptPack.label}: ${promptPack.summary}`)
  }
}
