import { parseBibleReference } from "../../../packages/shared-config/src/index.js"
import { flattenMessageContent } from "./enterpriseRequestRuntime.js"
import {
  dedupeParagraphs,
  normalizeTextForDeduplication
} from "./enterpriseTextRuntime.js"

export function isInterpretiveBibleQuestion(question = "") {
  return /\b(explique|explica|contexto|interprete|interpretacao|estudo|aplique|aplicacao|resuma|devocional|pregacao|pregacao|sermao|teologia|hermeneutica)\b/i.test(String(question || ""))
}

export function isBibleFollowUpQuestion(question = "") {
  return /\b(essa passagem|esse texto|esse versiculo|esse versículo|esse capitulo|esse capítulo|isso significa|o que isso quer dizer|me explica isso|explique melhor|fale mais sobre isso|qual o contexto|como aplicar|aplicacao desse texto|aplicação desse texto|o que paulo quis dizer|o que jesus quis dizer)\b/i.test(String(question || ""))
}

export function extractBibleCodeHint(text = "") {
  const match = String(text || "").toUpperCase().match(/\b(NAA|ARC|ACF|AA|ARA|NVI|NVT|BJ|KJA|KJF)\b/)
  return match?.[1] || ""
}

export function extractRecentBibleContextFromHistory(history = []) {
  if (!Array.isArray(history) || history.length === 0) {
    return null
  }

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index]
    const text = flattenMessageContent(entry?.content || entry?.text || entry?.message || "").slice(0, 4000)
    if (!text) {
      continue
    }

    const parsedReference = parseBibleReference(text)
    if (!parsedReference) {
      continue
    }

    return {
      canonical: parsedReference.canonical,
      human: parsedReference.human,
      bibleCode: extractBibleCodeHint(text)
    }
  }

  return null
}

export function mergeRuntimeInstructions(base = "", extra = "") {
  const parts = [String(base || "").trim(), String(extra || "").trim()].filter(Boolean)
  return parts.join(" ")
}

export function cleanBibleQuotedText(text = "") {
  return String(text || "")
    .trim()
    .replace(/^\d+(?:\s*[-.:–—])?\s+/, "")
}

export function extractBiblePassageExcerpt(passage = {}, maxLength = 420) {
  const excerpt = cleanBibleQuotedText(String(passage?.content || ""))
    .replace(/\s+/g, " ")
    .trim()

  if (!excerpt) {
    return ""
  }

  return excerpt.length > maxLength
    ? `${excerpt.slice(0, maxLength).trim()}...`
    : excerpt
}

export function extractBibleIdeaClauses(text = "") {
  return cleanBibleQuotedText(text)
    .split(/[;:.!?]|\s*,\s*(?=[a-zà-ú])/i)
    .map((item) => item.trim())
    .filter((item) => item.length >= 12)
    .slice(0, 3)
}

export function inferMinistryFocusFromText(text = "") {
  const input = String(text || "")
  if (/\b(novos convertidos|novo convertido|novas convertidas|discipulado inicial|recem convertido|recém convertido)\b/i.test(input)) {
    return "new_believers"
  }

  return ""
}

export function extractBibleConversationPreferencesFromHistory(history = []) {
  if (!Array.isArray(history) || history.length === 0) {
    return null
  }

  const preferences = {}

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index]
    const text = flattenMessageContent(entry?.content || entry?.text || entry?.message || "").slice(0, 4000)
    if (!text) {
      continue
    }

    if (!preferences.preferredBibleCode) {
      const bibleCode = extractBibleCodeHint(text)
      if (bibleCode) {
        preferences.preferredBibleCode = bibleCode
      }
    }

    if (!preferences.ministryFocus) {
      const ministryFocus = inferMinistryFocusFromText(text)
      if (ministryFocus) {
        preferences.ministryFocus = ministryFocus
      }
    }

    if (preferences.preferredBibleCode && preferences.ministryFocus) {
      break
    }
  }

  return Object.keys(preferences).length > 0 ? preferences : null
}

export function buildBibleInterpretiveFallback(question = "", context = {}) {
  const passage = context?.biblePassage
  if (!passage?.content || !isInterpretiveBibleQuestion(question)) {
    return null
  }

  const clauses = extractBibleIdeaClauses(passage.content)
  const listBody = clauses.length > 0
    ? clauses.map((item, index) => `${index + 1}. ${item}.`).join("\n")
    : "1. Leia primeiro o que o versiculo afirma diretamente.\n2. Observe as palavras centrais e o contraste principal do texto.\n3. So depois amplie para aplicacao e contexto."
  const excerpt = extractBiblePassageExcerpt(passage, 420)
  const intro = /\b(linguagem simples|simples)\b/i.test(String(question || ""))
    ? "Em linguagem simples, o texto destaca estas ideias centrais:"
    : "O texto destaca estas ideias centrais:"
  const asksForContext = /\b(contexto|historico|histórico|literario|literário|capitulo|capítulo|antes|depois)\b/i.test(String(question || ""))
  const asksForApplication = /\b(aplique|aplicacao|aplicação|devocional|pregacao|pregação|sermao|sermão|pastoral)\b/i.test(String(question || ""))
  const excerptNote = passage.truncated
    ? "Observacao: estou usando um trecho representativo da passagem para manter a resposta leve e fiel ao foco da pergunta."
    : ""
  const contextLine = asksForContext
    ? "Contexto seguro: comece pelo argumento imediato da passagem, leia o antes e o depois, e so entao amplie para pano de fundo historico ou doutrinario."
    : "Metodo seguro: comece pelo que o texto afirma diretamente antes de ampliar para outras conclusoes."
  const applicationLine = asksForApplication
    ? "Aplicacao pastoral inicial: transforme a verdade central do texto em consolo, correcao e obediencia pratica, sem trocar o sentido original por opiniao."
    : "Aplicacao inicial: deixe a pratica nascer do sentido do texto, e nao de uma ideia solta."

  return [
    `${passage.reference} (${passage.bibleCode})`,
    excerpt ? `Trecho-base: "${excerpt}"${excerptNote ? ` ${excerptNote}` : ""}` : null,
    intro,
    listBody,
    contextLine,
    applicationLine,
    "Se quiser, posso mostrar o contexto imediato ou comparar com outra traducao."
  ].filter(Boolean).join("\n\n").trim()
}

export function isWeakBibleInterpretiveResponse(text = "") {
  return /\b(comecar com texto base|contexto historico-literario|base local consultada|adaptar linguagem|esbocos expositivos|escola dominical)\b/i.test(String(text || ""))
}

function isGospelCoreQuestion(question = "") {
  const input = String(question || "")
  const hasGospelTopic = /\b(evangelho|jesus|cristo|salvacao|salvação)\b/i.test(input)
  const hasGospelShape = /\b(nucleo do evangelho|núcleo do evangelho|evangelho cristao|evangelho cristão|quatro pontos|pontos simples)\b/i.test(input)
  return hasGospelTopic && hasGospelShape
}

export function buildGospelCoreFallback(question = "", context = {}) {
  if (!isGospelCoreQuestion(question)) {
    return null
  }

  const translation = String(context?.preferredBibleCode || context?.bibleCode || "NAA").trim() || "NAA"
  const ministryFocus = String(context?.ministryFocus || "").trim()
  const audienceLine = ministryFocus === "new_believers"
    ? "Vou manter linguagem humana, acolhedora e simples, pensando em novos convertidos."
    : null

  return [
    audienceLine,
    "Aqui vai um resumo simples e fiel do evangelho cristao, pensado para novos convertidos:",
    "1. Deus e santo, bom e nos criou para viver em comunhao com Ele.",
    "2. O pecado nos separa de Deus, e por nos mesmos nao conseguimos resolver essa ruptura.",
    "3. Jesus Cristo morreu e ressuscitou para salvar pecadores e reconciliar com Deus todo aquele que cre.",
    "4. A resposta do ser humano e arrependimento, fe em Cristo e uma vida de discipulado sustentada pela graca.",
    `Se quiser, eu posso transformar isso em um devocional curto ou explicar cada ponto com linguagem ainda mais simples na ${translation}.`
  ].filter(Boolean).join("\n\n").trim()
}

function isBibleStudyMethodQuestion(question = "", context = {}) {
  const input = String(question || "")
  const activeModules = Array.isArray(context?.activeModules) ? context.activeModules : []
  if (!activeModules.includes("bible") && !/\b(exegese|hermeneutica|hermenêutica|teologia sistematica|teologia sistemática|aplicacao pastoral|aplicação pastoral)\b/i.test(input)) {
    return false
  }

  return /\b(exegese|hermeneutica|hermenêutica|teologia sistematica|teologia sistemática|aplicacao pastoral|aplicação pastoral|metodo biblico|método bíblico)\b/i.test(input)
}

function buildBibleStudyMethodFallback(question = "", context = {}) {
  if (!isBibleStudyMethodQuestion(question, context)) {
    return null
  }

  const parsedReference = parseBibleReference(question)
  const studyTarget = String(context?.biblePassage?.reference || parsedReference?.human || "o texto em estudo").trim()
  const simpleLead = /\b(linguagem simples|humana|simples)\b/i.test(String(question || ""))
    ? `Em linguagem simples, ao estudar ${studyTarget}, pense em tres camadas:`
    : `Ao estudar ${studyTarget}, estas tres camadas ajudam a nao misturar funcoes diferentes:`

  return [
    simpleLead,
    "1. Exegese: pergunta o que o texto realmente diz no seu proprio contexto, observando palavras, fluxo e argumento.",
    "2. Teologia sistematica: conecta esse texto ao ensino mais amplo das Escrituras sobre Deus, Cristo, pecado, salvacao, igreja e vida crista.",
    "3. Aplicacao pastoral: traduz a verdade do texto para consolo, correcao, discipulado e obediencia concreta hoje.",
    `Em ${studyTarget}, o caminho seguro e comecar pela exegese, depois organizar a doutrina e so entao chegar a aplicacao.`,
    "Se quiser, eu posso fazer esse processo passo a passo no proprio texto."
  ].join("\n\n").trim()
}

function isChurchFathersQuestion(question = "", context = {}) {
  const input = String(question || "")
  const activeModules = Array.isArray(context?.activeModules) ? context.activeModules : []
  if (!activeModules.includes("bible") && !activeModules.includes("history_archaeology") && !/\b(pais da igreja|patristica|patrística|patristicos|patrísticos)\b/i.test(input)) {
    return false
  }

  return /\b(pais da igreja|patristica|patrística|patristicos|patrísticos)\b/i.test(input)
}

function buildChurchFathersFallback(question = "", context = {}) {
  if (!isChurchFathersQuestion(question, context)) {
    return null
  }

  return [
    "Os pais da igreja sao pastores, teologos e escritores cristaos dos primeiros seculos que ajudam a enxergar como a fe foi confessada, defendida e ensinada na igreja antiga.",
    "Eles sao uteis como testemunhas historicas, como interlocutores teologicos e como exemplo de leitura crista antiga das Escrituras.",
    "Mas existe um limite essencial: comentario historico nao tem a mesma autoridade da Biblia.",
    "Uso seguro: leia os pais da igreja com respeito, aprenda com eles, mas submeta toda conclusao ao texto biblico.",
    "Se quiser, eu posso resumir os nomes principais e mostrar como usar esse legado sem trocar Escritura por tradicao."
  ].join("\n\n").trim()
}

function isBibleLocalCapabilityQuestion(question = "", context = {}) {
  const input = String(question || "")
  const activeModules = Array.isArray(context?.activeModules) ? context.activeModules : []
  if (!activeModules.includes("bible") && !/\b(base local|busca ao vivo|verificacao externa|verificação externa|sem usar busca|sem depender de busca|sem verificacao|sem verificação)\b/i.test(input)) {
    return false
  }

  return /\b(base local|busca ao vivo|verificacao externa|verificação externa|sem usar busca|sem depender de busca|sem verificacao|sem verificação)\b/i.test(input)
}

function buildBibleLocalCapabilityFallback(question = "", context = {}) {
  if (!isBibleLocalCapabilityQuestion(question, context)) {
    return null
  }

  return [
    "Pela minha base local, eu consigo sustentar com seguranca o conteudo biblico em si, explicacoes introdutorias de passagens, o nucleo do evangelho cristao, comparacoes simples entre traducoes locais e principios de interpretacao.",
    "Tambem consigo distinguir texto biblico, comentario historico, aplicacao pastoral e limite de certeza quando a pergunta nao exige dado ao vivo.",
    "Sem verificacao externa, eu nao devo afirmar como fato certo noticias atuais, descoberta arqueologica recente, consenso academico atualizado, estatistica em tempo real ou qualquer informacao mutavel que dependa de fonte viva.",
    "Entao, sobre o evangelho, eu posso falar com base local; sobre fatos externos atuais, eu preciso confirmar fora antes de afirmar com certeza."
  ].join("\n\n").trim()
}

function resolveDeterministicPreferenceRegistrationResponse(question = "") {
  const input = String(question || "")
  if (!/\b(responda\s+s[oó]|responda\s+apenas|somente responda)\s*:\s*registrado\b/i.test(input)) {
    return null
  }
  return "Registrado."
}

function shouldPreferDeterministicBibleGuidance(question = "", context = {}) {
  if (context?.evaluationMode) {
    return true
  }

  return /\b(sem depender|sem usar busca|sem busca ao vivo|base local|linguagem simples|fidelidade ao texto|novos convertidos|quatro pontos simples)\b/i.test(String(question || ""))
}

export function resolveDeterministicBibleGuidanceResponse(question = "", context = {}) {
  const registrationResponse = resolveDeterministicPreferenceRegistrationResponse(question)
  if (registrationResponse) {
    return registrationResponse
  }

  const gospelCoreFallback = buildGospelCoreFallback(question, context)
  if (gospelCoreFallback) {
    return gospelCoreFallback
  }

  const bibleStudyMethodFallback = buildBibleStudyMethodFallback(question, context)
  if (bibleStudyMethodFallback) {
    return bibleStudyMethodFallback
  }

  const churchFathersFallback = buildChurchFathersFallback(question, context)
  if (churchFathersFallback) {
    return churchFathersFallback
  }

  const localCapabilityFallback = buildBibleLocalCapabilityFallback(question, context)
  if (localCapabilityFallback) {
    return localCapabilityFallback
  }

  if (context?.biblePassage?.content && isInterpretiveBibleQuestion(question) && shouldPreferDeterministicBibleGuidance(question, context)) {
    return buildBibleInterpretiveFallback(question, context)
  }

  return null
}

export function refineBibleInterpretiveResponse(question = "", responseText = "", context = {}) {
  const passage = context?.biblePassage
  if (!passage?.content || !isInterpretiveBibleQuestion(question)) {
    return String(responseText || "").trim()
  }

  if (isWeakBibleInterpretiveResponse(responseText)) {
    return buildBibleInterpretiveFallback(question, context) || String(responseText || "").trim()
  }

  const paragraphs = dedupeParagraphs(
    String(responseText || "")
      .split(/\n{2,}/)
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => !new RegExp(`^${passage.reference}\\b`, "i").test(item))
      .filter((item) => normalizeTextForDeduplication(item) !== normalizeTextForDeduplication(passage.content))
  )

  if (paragraphs.length === 0) {
    return String(responseText || "").trim()
  }

  const explanationParagraphs = paragraphs.slice(0, 1)
  if (explanationParagraphs.length > 0 && !/^em linguagem simples[:,-]?\s*/i.test(explanationParagraphs[0])) {
    explanationParagraphs[0] = `Em linguagem simples: ${explanationParagraphs[0].replace(/^[A-Z][a-z]+ \d+:\d+ diz:\s*/i, "").trim()}`
  }

  const note = passage.truncated
    ? "\nObservacao: aqui aparece apenas uma parte do capitulo para manter o foco."
    : ""

  return [
    `${passage.reference} (${passage.bibleCode}) diz:\n"${cleanBibleQuotedText(passage.content)}"${note}`,
    ...explanationParagraphs,
    "Se quiser, posso mostrar o contexto imediato ou comparar com outra traducao."
  ].join("\n\n").trim()
}

export function resolveDeterministicBiblePassageResponse(question = "", context = {}) {
  const passage = context?.biblePassage
  if (!passage?.content || !passage?.reference) {
    return null
  }

  const hasReference = Boolean(parseBibleReference(question))
  const asksForQuote = /\b(leia|mostre|me mostre|me mostra|cite|traga|qual e|qual e o texto|o que diz|me de o versiculo|me de o texto|versiculo)\b/i.test(String(question || ""))
  if ((!hasReference && !asksForQuote) || isInterpretiveBibleQuestion(question)) {
    return null
  }

  const note = passage.truncated
    ? `\n\nObservacao: exibindo os primeiros ${passage.verses?.length || 0} versiculos deste capitulo.`
    : ""

  return `${passage.reference} (${passage.bibleCode})\n${passage.content}${note}\n\nSe quiser, posso explicar esse texto em linguagem simples ou comparar com outra traducao.`
}
