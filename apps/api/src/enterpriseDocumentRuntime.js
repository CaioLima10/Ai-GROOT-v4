export function sanitizeDocumentTitle(value = "", fallback = "Documento GIOM") {
  const normalized = String(value || "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return normalized || fallback
}

function normalizeDocumentPromptText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function extractRequestedCount(prompt = "", fallback = 4) {
  const normalized = normalizeDocumentPromptText(prompt)
  const numericMatch = normalized.match(/\b(\d{1,2})\s+(?:itens|etapas|marcos|pontos|slides?|linhas)\b/)
  if (!numericMatch?.[1]) return fallback
  return Math.max(2, Math.min(Number(numericMatch[1]) || fallback, 8))
}

function extractDocumentSubject(prompt = "") {
  const cleaned = String(prompt || "")
    .replace(/^(?:agora\s+|por favor\s+|voce pode\s+|voces podem\s+)?/i, "")
    .replace(/^(?:gere|gera|crie|cria|faca|fa[aç]a|produza|redija|escreva|monte)\s+/i, "")
    .replace(/^(?:um|uma)\s+/i, "")
    .replace(/\b(?:documento|arquivo|pdf|docx|xlsx|pptx|planilha|apresentacao|apresentação|slides?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/[.?!,:;]+$/g, "")
    .trim()

  return cleaned || "plano de trabalho"
}

function buildFallbackTimeline(prompt = "", count = 4) {
  const subject = extractDocumentSubject(prompt)
  const steps = [
    `1. Semana 1: alinhar escopo de ${subject}, responsaveis e criterio de sucesso.`,
    `2. Semana 2: preparar insumos, acessos, materiais e dependencias criticas.`,
    `3. Semana 3: executar a entrega inicial, acompanhar bloqueios e ajustar prioridade.`,
    `4. Semana 4: validar resultado, consolidar aprendizados e definir proximo ciclo.`,
    `5. Semana 5: ampliar execucao com base no que funcionou e reduzir gargalos remanescentes.`,
    `6. Semana 6: fechar pendencias, registrar padrao operacional e revisar metas.`
  ]

  return steps.slice(0, Math.max(2, Math.min(count, steps.length))).join("\n")
}

function buildFallbackChecklist(prompt = "", count = 4) {
  const subject = extractDocumentSubject(prompt)
  const items = [
    `1. Confirmar objetivo, escopo e dono principal de ${subject}.`,
    "2. Mapear dependencias, riscos e itens que podem travar a entrega.",
    "3. Organizar materiais, acessos e fontes de informacao necessarias.",
    "4. Definir prazo curto para a primeira validacao com follow-up claro.",
    "5. Registrar status, bloqueios e proxima acao por responsavel.",
    "6. Revisar resultado inicial e ajustar a prioridade seguinte."
  ]

  return items.slice(0, Math.max(2, Math.min(count, items.length))).join("\n")
}

function buildFallbackTable(prompt = "") {
  const subject = extractDocumentSubject(prompt)
  return [
    "| Etapa | Objetivo | Responsavel | Prazo |",
    "| --- | --- | --- | --- |",
    `| Descoberta | Entender contexto e escopo de ${subject} | Owner do projeto | Curto prazo |`,
    "| Preparacao | Liberar acessos, materiais e dados de base | Operacao | Curto prazo |",
    "| Execucao inicial | Entregar primeiro resultado visivel | Time responsavel | Esta semana |",
    "| Revisao | Validar qualidade, risco e proximo passo | Lideranca + owner | Proxima revisao |"
  ].join("\n")
}

function buildFallbackOnboardingPlan(prompt = "", count = 4) {
  const items = [
    "1. Mapear a etapa atual do onboarding, os bloqueios e o primeiro marco de valor esperado.",
    "2. Confirmar responsavel, prazo curto e criterio de sucesso para cada frente prioritaria.",
    "3. Liberar acessos, materiais e checklist de implantacao inicial sem pendencias criticas.",
    "4. Registrar follow-up imediato com o cliente e proximo checkpoint executivo.",
    "5. Revisar sinais de adocao e ajustar o plano conforme risco real da implantacao.",
    "6. Consolidar aprendizados e transformar o fluxo em padrao repetivel."
  ]

  return items.slice(0, Math.max(2, Math.min(count, items.length))).join("\n")
}

function buildFallbackGenericPlan(prompt = "", count = 4) {
  const subject = extractDocumentSubject(prompt)
  const items = [
    `1. Definir objetivo, publico e resultado esperado para ${subject}.`,
    "2. Organizar estrutura, prioridades e insumos necessarios para a entrega.",
    "3. Executar a primeira versao com foco no que gera valor mais cedo.",
    "4. Revisar clareza, risco e proximos passos antes da publicacao final.",
    "5. Registrar ajustes, responsaveis e prazos da rodada seguinte.",
    "6. Fechar com sintese objetiva e criterio de acompanhamento."
  ]

  return items.slice(0, Math.max(2, Math.min(count, items.length))).join("\n")
}

function isLowSignalDocumentContent(value = "") {
  const normalized = normalizeDocumentPromptText(value)
  if (!normalized) {
    return true
  }

  if (/^(resumo|preview|conteudo|conteudo base|limite|documento|documento pronto)(\s*:)?$/.test(normalized)) {
    return true
  }

  const words = normalized.split(/\s+/).filter(Boolean)
  return words.length <= 3 && /^(resumo|preview|conteudo|limite|documento)\b/.test(normalized)
}

export function sanitizeGeneratedDocumentContent(content = "", prompt = "", format = "", options = {}) {
  const source = String(content || "")
  const normalizedPrompt = normalizeDocumentPromptText(prompt || options.title || "")
  const requestedCount = extractRequestedCount(prompt || options.title || "", format === "xlsx" ? 4 : 3)

  const cleaned = source
    .replace(/\bnao consegui responder a esta pergunta no momento[\s\S]*$/i, "")
    .replace(/\bnao consegui processar sua pergunta neste momento[\s\S]*$/i, "")
    .replace(/\beu gero esses arquivos com conhecimento interno[\s\S]*$/i, "")
    .replace(/\bnao confunda isso com suite office completa[\s\S]*$/i, "")
    .replace(/\boffice aqui significa geracao basica[\s\S]*$/i, "")
    .replace(/\bainda nao integrado[\s\S]*$/i, "")
    .replace(/\b(?:resumo|limite)\s*:\s*eu gero esses arquivos[\s\S]*$/i, "")
    .trim()

  const looksContaminated = !cleaned
    || isLowSignalDocumentContent(cleaned)
    || /^(nao consegui responder|nao consegui processar)\b/i.test(cleaned)
    || /\b(eu gero esses arquivos|suite office completa|office aqui significa|conhecimento interno|ainda nao integrado)\b/i.test(cleaned)

  if (!looksContaminated) {
    return cleaned
  }

  if (/\b(cronograma|linha do tempo|timeline|marcos)\b/.test(normalizedPrompt)) {
    return buildFallbackTimeline(prompt, requestedCount)
  }

  if (/\b(checklist|passo a passo|tarefas|todo|to-do)\b/.test(normalizedPrompt)) {
    return buildFallbackChecklist(prompt, requestedCount)
  }

  if (/\b(tabela|planilha|xlsx|colunas)\b/.test(normalizedPrompt) || String(format || "").trim().toLowerCase() === "xlsx") {
    return buildFallbackTable(prompt)
  }

  if (/\bonboarding\b/.test(normalizedPrompt)) {
    return buildFallbackOnboardingPlan(prompt, requestedCount)
  }

  return buildFallbackGenericPlan(prompt, requestedCount)
}

export function buildDocumentDraftPrompt(prompt, format, options = {}) {
  const locale = String(options.locale || "pt-BR")
  const style = String(options.style || "natural")
  const focusAreas = Array.isArray(options.activeModules) && options.activeModules.length > 0
    ? options.activeModules.join(", ")
    : "general"
  const requestedTitle = sanitizeDocumentTitle(options.title || "", "")
  const formatLabel = String(format || "").toUpperCase()

  const formatInstructions = {
    pdf: "Escreva um texto final bem estruturado, com titulo, secoes curtas e paragrafos limpos para exportacao em PDF.",
    docx: "Escreva um conteudo final profissional, em secoes claras, pronto para virar DOCX.",
    xlsx: "Escreva preferencialmente uma tabela em markdown ou CSV simples quando fizer sentido; se nao fizer, entregue linhas objetivas que possam virar planilha.",
    pptx: "Estruture o conteudo como apresentacao executiva com titulo e blocos curtos por slide.",
    svg: "Escreva um conteudo visual curto, com frases fortes e pouco texto por linha.",
    html: "Entregue um conteudo direto e estruturado, sem scripts.",
    json: "Entregue JSON valido, sem markdown e sem comentarios.",
    md: "Entregue markdown limpo, sem cercas de codigo.",
    txt: "Entregue texto puro limpo, sem markdown."
  }

  return [
    `Crie o conteudo final de um documento ${formatLabel}.`,
    requestedTitle ? `Titulo desejado: ${requestedTitle}.` : null,
    `Idioma principal: ${locale}.`,
    `Estilo de saida: ${style}.`,
    `Areas de foco desta conversa: ${focusAreas}.`,
    formatInstructions[format] || "Entregue um documento claro, profissional e pronto para exportacao.",
    "Regras:",
    "1. Nao descreva o que voce esta fazendo.",
    "2. Nao use cercas de codigo, salvo se o proprio formato pedir texto bruto.",
    "3. Entregue apenas o conteudo final do documento.",
    "4. Se houver risco ou conteudo proibido, recuse com seguranca em vez de produzir o documento.",
    "5. Nao fale sobre capacidades, limites, RAG, Office, navegador, web, memoria interna ou sobre como o arquivo sera gerado.",
    "6. Se o pedido for plano, checklist, tabela, cronograma ou prompt, entregue exatamente esse artefato em formato final.",
    `Objetivo do documento: ${prompt}`
  ].filter(Boolean).join("\n")
}
