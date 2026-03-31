const uploadQuestionStopWords = new Set([
  "que", "qual", "quais", "sobre", "arquivo", "imagem", "documento", "pdf", "doc", "docx", "ppt", "pptx", "xlsx", "planilha", "neste", "nesse", "nesse", "deste", "dessa", "desse", "com", "para", "uma", "uns", "umas", "tem", "temos", "temos", "temos", "me", "mostre", "fale", "diga", "explique", "responda", "base", "somente", "nele", "nela", "dele", "dela"
])

function stripMarkupForSearch(text = "", deps) {
  return deps.decodeXmlEntities(String(text || ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/[\{\}\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function buildUploadSearchLines(extraction = {}, deps) {
  const rawText = String(extraction?.text || "").trim()
  if (!rawText) {
    return []
  }

  const lines = rawText
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)

  const xmlTextMatches = Array.from(rawText.matchAll(/>([^<>\n]{2,220})</g))
    .map((match) => stripMarkupForSearch(match[1], deps))
    .filter(Boolean)

  const flattenedMarkup = stripMarkupForSearch(rawText, deps)
    .split(/\s{2,}|(?<=[.!?])\s+/g)
    .map((line) => line.trim())
    .filter((line) => line.length >= 3)

  return deps.dedupeParagraphs([
    ...lines,
    ...xmlTextMatches,
    ...flattenedMarkup
  ])
}

function extractUploadTaggedValue(lines = [], keys = [], deps) {
  for (const line of lines) {
    const match = String(line || "").match(/^([^:]{2,80}):\s*(.+)$/)
    if (!match) {
      continue
    }

    const key = deps.normalizeTextForDeduplication(match[1])
    if (keys.some((candidate) => key.includes(deps.normalizeTextForDeduplication(candidate)))) {
      return match[2].trim()
    }
  }

  return ""
}

function extractUploadNumberedItems(lines = []) {
  return lines
    .map((line) => String(line || "").match(/^\d+[.)]\s*(.+)$/)?.[1]?.trim() || "")
    .filter(Boolean)
}

function parseUploadTableRows(lines = [], deps) {
  const tableLines = lines.filter((line) => line.includes(" | "))
  if (tableLines.length < 2) {
    return []
  }

  const headers = tableLines[0]
    .split(/\s+\|\s+/g)
    .map((cell) => cell.trim())
    .filter(Boolean)

  if (headers.length < 2) {
    return []
  }

  return tableLines.slice(1).map((line) => {
    const cells = line
      .split(/\s+\|\s+/g)
      .map((cell) => cell.trim())
      .filter(Boolean)

    const byHeader = {}
    headers.forEach((header, index) => {
      byHeader[deps.normalizeTextForDeduplication(header)] = cells[index] || ""
    })

    return {
      cells,
      byHeader
    }
  }).filter((row) => row.cells.length > 0)
}

function formatUploadSentence(value = "", prefix = "") {
  const cleaned = String(value || "")
    .replace(/^[\s:;-]+/g, "")
    .replace(/\s+/g, " ")
    .trim()

  if (!cleaned) {
    return ""
  }

  const sentence = /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9]/.test(cleaned)
    ? cleaned
    : `${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`

  return `${prefix}${sentence}`.replace(/\s+/g, " ").replace(/\.\s*$/, ".").trim() + (/[.!?]$/.test(sentence) ? "" : ".")
}

function buildUploadExtractionUnavailableResponse(context = {}) {
  const uploadName = String(context?.uploadName || "arquivo enviado").trim()
  const extraction = context?.uploadExtraction || {}
  const suffix = extraction?.kind === "image"
    ? `Nao consegui extrair texto OCR confiavel de ${uploadName} nesta execucao.`
    : `Nao consegui extrair texto confiavel de ${uploadName} nesta execucao.`

  return `AINDA NAO TENHO ESSA INFORMACAO, PERGUNTE DENOVO. ${suffix}`
}

function pickBestUploadLine(question = "", lines = [], deps) {
  const tokens = deps.normalizeTextForDeduplication(question)
    .split(/\s+/g)
    .filter((token) => token.length >= 3 && !uploadQuestionStopWords.has(token))

  if (tokens.length === 0) {
    return ""
  }

  let bestLine = ""
  let bestScore = 0

  for (const line of lines) {
    const normalizedLine = deps.normalizeTextForDeduplication(line)
    if (!normalizedLine) {
      continue
    }

    let score = 0
    for (const token of tokens) {
      if (normalizedLine.includes(token)) {
        score += 1
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestLine = String(line || "").trim()
    }
  }

  return bestScore > 0 ? bestLine : ""
}

function buildUploadShortSummary(lines = [], deps) {
  const objective = extractUploadTaggedValue(lines, ["objetivo principal", "objetivo"], deps)
  const project = extractUploadTaggedValue(lines, ["projeto"], deps)
  if (objective && project) {
    return `O arquivo trata de ${project} e quer ${objective.replace(/^[A-Z]/, (char) => char.toLowerCase())}`.replace(/\.\s*$/, ".")
  }
  if (objective) {
    return formatUploadSentence(objective, "Resumo curto: ")
  }

  const firstNumbered = extractUploadNumberedItems(lines).slice(0, 2)
  if (firstNumbered.length > 0) {
    return `Resumo curto: o arquivo destaca ${firstNumbered.join(" e ")}.`
  }

  const bestLine = lines.find((line) => line.length > 12 && !/^planilha:/i.test(line))
  return bestLine ? formatUploadSentence(bestLine, "Resumo curto: ") : ""
}

function isGenericUploadOverviewQuestion(question = "") {
  return /\b(analise|analisa|analisar|descreva|descreve|resuma|resumo|o que (?:tem|ha|há|aparece|mostra|esta|está|da para ver|dá para ver)|qual conteudo|qual conteúdo|do que se trata|sobre o arquivo|sobre a imagem|me diga o que|base somente nele|base somente nela)\b/i.test(String(question || ""))
}

function buildUploadVisibleHighlights(lines = [], limit = 6) {
  return lines
    .map((line) => String(line || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => (
      !/^pagina\s+\d+$/i.test(line)
      && !/^planilha:/i.test(line)
      && !/^slide\s+\d+$/i.test(line)
      && line.length >= 3
    ))
    .slice(0, limit)
}

function buildDeterministicImageOverviewResponse(context = {}, lines = []) {
  const extraction = context?.uploadExtraction || {}
  const highlights = buildUploadVisibleHighlights(lines, 6)
  if (highlights.length === 0) {
    return buildUploadExtractionUnavailableResponse(context)
  }

  const quality = String(extraction?.quality || "").trim().toLowerCase()
  const lead = quality === "high"
    ? "O OCR conseguiu ler texto util da imagem, mas isso nao confirma sozinho o contexto completo da tela."
    : quality === "medium"
      ? "A leitura da imagem veio parcial, entao vou me limitar ao que o OCR conseguiu confirmar."
      : "A leitura da imagem veio limitada, entao vou me limitar ao que foi extraido."

  const caution = "Nao vou afirmar que e tela de login, cadastro, promocao, erro ou outro fluxo sem isso estar escrito claramente na imagem."

  if (highlights.length === 1) {
    return [
      lead,
      `O principal texto que consigo confirmar na imagem e: "${highlights[0]}".`,
      caution
    ].join("\n")
  }

  return [
    lead,
    "Consigo confirmar na imagem estes textos ou elementos visiveis:",
    ...highlights.map((line, index) => `${index + 1}. ${line.replace(/\.\s*$/, "")}.`),
    caution
  ].join("\n")
}

function isUploadCapabilityQuestion(question = "") {
  return /\b(o que voce consegue (?:ler|abrir|gerar|fazer|suportar)|o que você consegue (?:ler|abrir|gerar|fazer|suportar)|quais arquivos|quais formatos|capacidade|capacidades|limites|suite office|office completa|ler hoje)\b/i.test(String(question || ""))
}

export function resolveDeterministicUploadResponse(question = "", context = {}, deps) {
  if (!context?.uploadId || !context?.uploadExtraction) {
    return null
  }

  const visibleQuestion = String(context?.originalQuestion || question || "").trim()
  if (!visibleQuestion || deps.isWeatherQuestion(visibleQuestion) || deps.isFixtureQuestion(visibleQuestion, context) || isUploadCapabilityQuestion(visibleQuestion)) {
    return null
  }

  const extraction = context.uploadExtraction
  const extractionText = String(extraction?.text || "").trim()
  if (!extractionText) {
    return buildUploadExtractionUnavailableResponse(context)
  }

  const lines = buildUploadSearchLines(extraction, deps)
  const normalizedQuestion = deps.normalizeTextForDeduplication(visibleQuestion)
  const numberedItems = extractUploadNumberedItems(lines)
  const tableRows = parseUploadTableRows(lines, deps)

  if (
    (extraction.kind === "image" || extraction.kind === "pdf")
    && /\b(frase|texto|escrito|transcri(?:va|ver|ção|cao)?|literal|o que esta escrito|o que está escrito)\b/i.test(visibleQuestion)
  ) {
    const contentLines = lines.filter((line) => (
      line
      && !/^pagina\s+\d+$/i.test(line)
      && !/^planilha:/i.test(line)
      && !/^slide\s+\d+$/i.test(line)
    ))
    const flattened = contentLines.join(" ").replace(/\s+/g, " ").trim()
    const shouldQuoteWholeContent = extraction.kind === "image"
      || (extraction.kind === "pdf" && Number(extraction.fullTextLength || 0) <= 320)

    if (flattened && shouldQuoteWholeContent) {
      return extraction.kind === "image"
        ? `A frase extraida da imagem e: "${flattened}".`
        : `A frase extraida do PDF e: "${flattened}".`
    }
  }

  if (extraction.kind === "image" && isGenericUploadOverviewQuestion(visibleQuestion)) {
    return buildDeterministicImageOverviewResponse(context, lines)
  }

  if (normalizedQuestion.includes("prioridad")) {
    if (numberedItems.length > 0) {
      return [
        "As prioridades do documento sao:",
        ...numberedItems.slice(0, 6).map((item, index) => `${index + 1}. ${item.replace(/\.\s*$/, "")}.`)
      ].join("\n")
    }

    const priorityLine = pickBestUploadLine("prioridades", lines, deps)
    if (priorityLine) {
      return formatUploadSentence(priorityLine, "As prioridades do documento sao: ")
    }
  }

  if (normalizedQuestion.includes("objetivo") || normalizedQuestion.includes("validar")) {
    const objective = extractUploadTaggedValue(lines, ["objetivo principal", "objetivo"], deps)
      || pickBestUploadLine("objetivo validar", lines, deps)
    if (objective) {
      return formatUploadSentence(objective, "O objetivo principal do arquivo e ")
    }
  }

  if (normalizedQuestion.includes("diretriz") || normalizedQuestion.includes("orientacao")) {
    const guideline = extractUploadTaggedValue(lines, ["diretriz central", "orientacao principal", "diretriz", "orientacao"], deps)
      || pickBestUploadLine("diretriz orientacao inventar", lines, deps)
    if (guideline) {
      return formatUploadSentence(guideline, "A diretriz principal do arquivo e ")
    }
  }

  if (normalizedQuestion.includes("mensagem chave") || normalizedQuestion.includes("mensagem-chave")) {
    const keyMessage = extractUploadTaggedValue(lines, ["mensagem chave", "mensagem-chave", "mensagem central"], deps)
      || pickBestUploadLine("mensagem chave conteudo real arquivo", lines, deps)
    if (keyMessage) {
      return formatUploadSentence(keyMessage, "A mensagem-chave do arquivo e ")
    }
  }

  if (normalizedQuestion.includes("encerramento")) {
    const closingGuidance = extractUploadTaggedValue(lines, ["encerramento"], deps)
      || pickBestUploadLine("encerramento parcial claramente", lines, deps)
    if (closingGuidance) {
      return formatUploadSentence(closingGuidance, "O encerramento orienta que ")
    }
  }

  if (normalizedQuestion.includes("politic") || normalizedQuestion.includes("policy")) {
    const uploadPolicy = extractUploadTaggedValue(lines, ["policy", "politica"], deps)
      || pickBestUploadLine("policy politica upload detalhes ausentes", lines, deps)
    if (uploadPolicy) {
      return formatUploadSentence(uploadPolicy, "A politica de upload registrada e ")
    }
  }

  if (normalizedQuestion.includes("score") || normalizedQuestion.includes("meta")) {
    const scoreTarget = extractUploadTaggedValue(lines, ["scoretarget", "score target", "meta"], deps)
      || pickBestUploadLine("scoretarget meta", lines, deps)
    if (scoreTarget) {
      return formatUploadSentence(scoreTarget, "A meta registrada e ")
    }
  }

  if (tableRows.length > 0 && (normalizedQuestion.includes("teste") || normalizedQuestion.includes("obrigatorio"))) {
    const targetTerms = normalizedQuestion.includes("obrigatorio")
      ? ["obrigatorio", "obrigatório"]
      : ["em teste", "teste"]

    const matchedRow = tableRows.find((row) => {
      const status = deps.normalizeTextForDeduplication(row.byHeader.status || row.cells[row.cells.length - 1] || "")
      return targetTerms.some((term) => status.includes(deps.normalizeTextForDeduplication(term)))
    })

    if (matchedRow) {
      const item = matchedRow.byHeader.tarefa || matchedRow.byHeader.item || matchedRow.cells[0] || ""
      if (item) {
        return normalizedQuestion.includes("obrigatorio")
          ? `O item marcado como obrigatorio e ${item}.`
          : `O item com status em teste e ${item}.`
      }
    }
  }

  if (/\b(resuma|resumo|uma frase|frase curta)\b/i.test(visibleQuestion)) {
    const summary = buildUploadShortSummary(lines, deps)
    if (summary) {
      return summary
    }
  }

  const bestLine = pickBestUploadLine(visibleQuestion, lines, deps)
  if (bestLine) {
    return formatUploadSentence(bestLine)
  }

  return formatUploadSentence(lines.find((line) => !/^planilha:/i.test(line)) || "") || null
}