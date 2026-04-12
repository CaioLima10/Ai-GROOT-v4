export function normalizeAnswerText(answer: any): string {
  const responseText = typeof answer === "string"
    ? answer
    : (answer?.response ?? answer?.answer ?? "")

  return String(responseText || "").trim()
}

export function shouldKeepIdentityPreamble(question = ""): boolean {
  return /\b(quem\s+(?:e|é)\s+(?:voce|você|o giom)|se apresente|apresente-se|o que voce faz|o que você faz|o que voce consegue|o que você consegue|suas capacidades|seus limites|who are you|what can you do)\b/i.test(String(question || ""))
}

export function isPromptCardPreferred(context: Record<string, unknown> = {}): boolean {
  return String((context as any)?.preferredResponseCard || "").trim().toLowerCase() === "prompt"
}

export function isTableCardPreferred(context: Record<string, unknown> = {}): boolean {
  return String((context as any)?.preferredResponseCard || "").trim().toLowerCase() === "table"
}

const COMMON_SPORTS_SUBJECTS: Array<[string, string]> = [
  ["selecao brasileira", "Brasil"],
  ["selecao brasileira", "Brasil"],
  ["brasil", "Brasil"],
  ["botafogo", "Botafogo"],
  ["flamengo", "Flamengo"],
  ["palmeiras", "Palmeiras"],
  ["corinthians", "Corinthians"],
  ["sao paulo", "Sao Paulo"],
  ["santos", "Santos"],
  ["gremio", "Gremio"],
  ["internacional", "Internacional"],
  ["inter", "Internacional"]
]

function stripDecorativeAssistantLead(text = ""): string {
  return String(text || "")
    .replace(/^(?:aqui\s+esta|aqui\s+está|segue|claro|perfeito|combinado|beleza)[!,.:\s-]*/i, "")
    .replace(/^(?:vou\s+te\s+passar|posso\s+te\s+passar|te\s+passo)[!,.:\s-]*/i, "")
    .replace(/^(?:use\s+este\s+prompt|prompt\s+pronto(?:\s*\(copia\s+e\s+cola\))?|prompt\s+final|prompt\s+sugerido)\s*[:\-]?\s*/i, "")
    .replace(/^(?:prompt|resposta|resultado)\s*[:\-]\s*/i, "")
    .replace(/^escrita\s*/i, "")
    .trim()
}

function stripPromptFallbackNoise(text = ""): string {
  return String(text || "")
    .replace(/\bnao consegui responder a esta pergunta no momento[\s\S]*$/i, "")
    .replace(/\bnao consegui processar sua pergunta neste momento[\s\S]*$/i, "")
    .trim()
}

function buildPromptContextText(context: Record<string, unknown> = {}): string {
  const historyBuckets = [
    (context as any)?.requestConversationHistory,
    (context as any)?.sessionConversationHistory,
    (context as any)?.conversationHistory,
    (context as any)?.history
  ]

  return historyBuckets
    .flatMap((bucket) => Array.isArray(bucket) ? bucket : [])
    .map((entry) => String((entry as any)?.content || (entry as any)?.text || (entry as any)?.message || "").trim())
    .filter(Boolean)
    .join("\n")
}

function questionRequestsPrompt(question = ""): boolean {
  return /\b(prompt|copia e cola|copie e cole)\b/i.test(String(question || ""))
}

function hasOnboardingPromptContext(question = "", context: Record<string, unknown> = {}): boolean {
  const source = [
    question,
    buildPromptContextText(context),
    (context as any)?.artifactPrompt,
    (context as any)?.memorySummary,
    (context as any)?.summary
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join("\n")

  return /\b(onboarding|implantacao|implantação|kickoff|go[-\s]?live|ativacao|ativação|adocao|adoção)\b/i.test(source)
}

function questionRequestsStudyPrompt(question = ""): boolean {
  return /\b(estudar|estudo|devocional|meditacao|meditação|reflexao|reflexão|plano de leitura)\b/i.test(String(question || ""))
}

function looksLikePromptInstructions(text = ""): boolean {
  const trimmed = String(text || "").trim()
  if (!trimmed) return false

  const normalized = trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  if (/\b(atue como|voce e|você é|sua tarefa|objetivo|entregue|responda|mantenha|use|gere|crie|foco|restricoes|restrições|contexto|tom|papel)\b/.test(normalized)) {
    return true
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length >= 3 && lines.some((line) => /[:;]/.test(line))) {
    return true
  }

  return false
}

function extractPromptObjective(question = ""): string {
  return String(question || "")
    .replace(/\b(?:ainda\s+sem\s+arquivo|sem\s+gerar\s+arquivo|no\s+mesmo\s+assunto|no\s+mesmo\s+estilo|agora|por\s+favor)\b/gi, " ")
    .replace(/\b(?:me\s+de|me\s+d[eê]|gere|gera|crie|cria|faca|faça|monte|escreva)\b/gi, " ")
    .replace(/\b(?:um|uma)\s+prompt(?:\s+curto)?\b/gi, " ")
    .replace(/\b(?:copia\s+e\s+cola|copie\s+e\s+cole)\b/gi, " ")
    .replace(/[?!.]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function buildPromptFallback(question = "", context: Record<string, unknown> = {}): string | null {
  if (!questionRequestsPrompt(question)) {
    return null
  }

  if (hasOnboardingPromptContext(question, context)) {
    return [
      "Atue como analista de onboarding de clientes.",
      "Mapeie a etapa atual, os principais bloqueios e o primeiro marco de valor esperado.",
      "Entregue um plano curto com prioridade, responsavel, prazo e follow-up imediato.",
      "Mantenha tom executivo, objetivo e orientado a reduzir atrito na implantacao."
    ].join("\n")
  }

  const objective = extractPromptObjective(question)
  if (questionRequestsStudyPrompt(question)) {
    return [
      "Atue como mentor biblico e guia de estudo devocional.",
      objective ? `Monte um plano curto para ${objective}.` : "Monte um plano curto de estudo biblico com continuidade do contexto anterior.",
      "Para cada etapa, entregue tema central, texto-base, pergunta de reflexao, aplicacao pratica e oracao curta.",
      "Mantenha fidelidade ao texto, linguagem humana e tom pastoral."
    ].join("\n")
  }

  return [
    "Atue como especialista que vai assumir esta conversa em continuidade.",
    objective ? `Tarefa: ${objective}.` : "Tarefa: assuma o contexto anterior e execute a proxima etapa pedida pelo usuario.",
    "Entregue resposta curta, clara, acionavel e com proximo passo recomendado.",
    "Mantenha tom humano, objetivo e sem repetir contexto desnecessario."
  ].join("\n")
}

function unescapeJsonLikeString(value = ""): string {
  return String(value || "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, "\"")
    .replace(/\\\\/g, "\\")
    .trim()
}

function extractPromptContentFromJsonLike(text = ""): string {
  const source = String(text || "").trim()
  if (!source) return ""

  try {
    const parsed: any = JSON.parse(source)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const content = parsed.content ?? parsed.text ?? parsed.prompt ?? parsed.body
      if (typeof content === "string" && content.trim()) {
        return content.trim()
      }
    }
  } catch {
    // keep graceful fallback below
  }

  const fencedMatch = source.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fencedMatch?.[1]) {
    const nested = extractPromptContentFromJsonLike(fencedMatch[1])
    if (nested) return nested
  }

  const contentMatch = source.match(/"content"\s*:\s*"([\s\S]*?)"\s*(?:,\s*"[\w-]+"\s*:|\})/i)
  if (contentMatch?.[1]) {
    return unescapeJsonLikeString(contentMatch[1])
  }

  return ""
}

export function buildPromptCardResponse(responseText = "", question = "", context: Record<string, unknown> = {}): string | null {
  const source = extractPromptContentFromJsonLike(responseText)
    || (() => {
      const blockMatch = String(responseText || "").match(/```(?:prompt|text|txt)?\s*([\s\S]*?)\s*```/i)
      return blockMatch?.[1] ? blockMatch[1] : responseText
    })()
  const cleaned = stripPromptFallbackNoise(stripDecorativeAssistantLead(source))
  const fallbackPrompt = buildPromptFallback(question, context)
  const cleanedLooksLikePrompt = looksLikePromptInstructions(cleaned)
  const promptBody = cleaned
    && !/^(nao consegui responder|nao consegui processar)\b/i.test(cleaned)
    && (!fallbackPrompt || cleanedLooksLikePrompt)
    ? cleaned
    : fallbackPrompt
  if (!promptBody) return null

  return JSON.stringify({
    type: "prompt",
    content: promptBody
  })
}

function buildCalendarFromClockMeta(clock: Record<string, any> | null, fallbackTimezone = "Etc/UTC") {
  if (!clock || typeof clock !== "object") return null
  const nowUtc = String(clock.nowUtc || clock.fetchedAt || "").trim()
  const fetchedAt = String(clock.fetchedAt || clock.nowUtc || "").trim()
  const timezone = String(clock.timezone || fallbackTimezone || "Etc/UTC").trim() || "Etc/UTC"
  const parsedNowMs = Date.parse(nowUtc)
  const parsedFetchedAtMs = Date.parse(fetchedAt)
  if (!Number.isFinite(parsedNowMs) || !Number.isFinite(parsedFetchedAtMs)) {
    return null
  }

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(new Date(parsedNowMs))
    const year = parts.find((part) => part.type === "year")?.value
    const month = parts.find((part) => part.type === "month")?.value
    const day = parts.find((part) => part.type === "day")?.value
    const hour = parts.find((part) => part.type === "hour")?.value
    const minute = parts.find((part) => part.type === "minute")?.value
    const second = parts.find((part) => part.type === "second")?.value
    if (!(year && month && day && hour && minute && second)) return null

    return {
      verified: clock.verified === true,
      source: String(clock.source || "worldtimeapi"),
      timezone,
      nowUtc,
      fetchedAt,
      date: `${year}-${month}-${day}`,
      year: Number(year),
      month: Number(month),
      day: Number(day),
      hour: Number(hour),
      minute: Number(minute),
      second: Number(second)
    }
  } catch {
    return null
  }
}

function enrichFixtureEntryWithCalendar(entry: Record<string, any> = {}) {
  const timestampMs = Number(entry.timestampMs || 0)
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
    return null
  }

  const kickoffIso = new Date(timestampMs).toISOString()
  return {
    ...entry,
    kickoffIso,
    calendar: {
      year: Number(kickoffIso.slice(0, 4)),
      month: Number(kickoffIso.slice(5, 7)),
      day: Number(kickoffIso.slice(8, 10)),
      hour: Number(kickoffIso.slice(11, 13)),
      minute: Number(kickoffIso.slice(14, 16)),
      second: Number(kickoffIso.slice(17, 19))
    }
  }
}

export function buildFixtureCardResponse(context: Record<string, any> = {}): string | null {
  const fixture = context?.liveFixture
  if (!fixture || fixture.error) return null

  const timeVerification = fixture.timeVerification || fixture.verification?.clock || null
  const calendar = buildCalendarFromClockMeta(timeVerification, "Etc/UTC")
  if (!calendar) {
    const fallbackQuestion = String(context?.originalQuestion || context?.question || "").trim()
    return buildFixtureIntentFallback(fallbackQuestion, {
      liveFixture: {
        ...fixture,
        hasUpcomingFixture: false,
        wantsHistory: false,
        nextMatches: Array.isArray(fixture?.nextMatches) ? fixture.nextMatches : [],
        recentMatches: Array.isArray(fixture?.recentMatches) ? fixture.recentMatches : []
      }
    })
  }

  const recentMatches = Array.isArray(fixture.recentMatches)
    ? fixture.recentMatches
      .map((entry: Record<string, any>) => enrichFixtureEntryWithCalendar(entry))
      .filter(Boolean)
    : []
  const nextMatches = Array.isArray(fixture.nextMatches)
    ? fixture.nextMatches
      .map((entry: Record<string, any>) => enrichFixtureEntryWithCalendar(entry))
      .filter(Boolean)
    : []
  const liveMatches = Array.isArray(fixture.liveMatches)
    ? fixture.liveMatches
      .map((entry: Record<string, any>) => enrichFixtureEntryWithCalendar(entry))
      .filter(Boolean)
    : []
  const hasUpcomingFixture = Boolean(fixture.hasUpcomingFixture) && nextMatches.length > 0
  const wantsHistory = Boolean(fixture.wantsHistory) && recentMatches.length > 0
  if (!hasUpcomingFixture && !wantsHistory) return null

  const fallbackMatch = !hasUpcomingFixture && wantsHistory && recentMatches.length > 0
    ? recentMatches[0]
    : null
  const boardHomeTeam = fixture.homeTeam || fallbackMatch?.homeTeam || fixture.teamName || "Mandante"
  const boardAwayTeam = fixture.awayTeam || fallbackMatch?.awayTeam || ""
  const boardHomeScore = fixture.homeScore ?? fallbackMatch?.homeScore ?? null
  const boardAwayScore = fixture.awayScore ?? fallbackMatch?.awayScore ?? null
  const boardKickoff = fixture.kickoff || fallbackMatch?.kickoff || "--:--"
  const boardDateLabel = fixture.dateLabel || fallbackMatch?.dateLabel || "Em breve"
  const boardStatus = fixture.status || fallbackMatch?.status || (fixture.wantsHistory ? "historico" : "agendado")
  const boardVenue = fixture.venue || fallbackMatch?.venue || ""

  return JSON.stringify({
    type: "data",
    content: {
      teamName: fixture.teamName || fixture.teamQuery || "",
      subjectType: fixture.subjectType || "",
      league: fixture.league || "Agenda esportiva",
      teamBadge: fixture.teamBadge || null,
      teamCountry: fixture.teamCountry || "",
      teamVenue: fixture.teamVenue || "",
      homeTeam: boardHomeTeam,
      awayTeam: boardAwayTeam,
      homeScore: boardHomeScore,
      awayScore: boardAwayScore,
      homeBadge: fixture.homeBadge || fallbackMatch?.homeBadge || null,
      awayBadge: fixture.awayBadge || fallbackMatch?.awayBadge || null,
      kickoff: boardKickoff,
      dateLabel: boardDateLabel,
      status: boardStatus,
      venue: boardVenue,
      note: fixture.summary || boardVenue || "",
      hasUpcomingFixture,
      calendar,
      date: calendar.date,
      year: calendar.year,
      month: calendar.month,
      day: calendar.day,
      hour: calendar.hour,
      minute: calendar.minute,
      second: calendar.second,
      nextMatches,
      recentMatches,
      liveMatches,
      verification: fixture.verification && typeof fixture.verification === "object" ? fixture.verification : null,
      timeVerification,
      sourceLinks: Array.isArray(fixture.sourceLinks) ? fixture.sourceLinks : []
    },
    meta: {
      variant: "fixture",
      provider: fixture.provider || "thesportsdb_verified"
    }
  })
}

function normalizeLooseText(value = ""): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function inferCommonSportsSubjectLabel(source = ""): string {
  const normalizedSource = normalizeLooseText(source)
  for (const [token, label] of COMMON_SPORTS_SUBJECTS) {
    if (normalizedSource.includes(token)) {
      return label
    }
  }

  return ""
}

function inferFixtureSubjectLabel(question = "", context: Record<string, any> = {}): string {
  const liveFixture = context?.liveFixture
  if (String(liveFixture?.teamName || "").trim()) {
    return String(liveFixture.teamName).trim()
  }

  const questionLabel = inferCommonSportsSubjectLabel(question)
  if (questionLabel) {
    return questionLabel
  }

  const historyLabel = inferCommonSportsSubjectLabel(buildPromptContextText(context))
  if (historyLabel) {
    return historyLabel
  }

  const extractedMatch = String(question || "").match(
    /(?:proximo(?:s)? jogo(?:s)?(?: do| da| de)?|próximo(?:s)? jogo(?:s)?(?: do| da| de)?|quando joga(?: o| a)?|partida(?:s)?(?: do| da| de)?|historico(?: do| da| de)?|histórico(?: do| da| de)?|retrospecto(?: do| da| de)?|ultim(?:o|os|a|as)\s+(?:jogo|jogos|partida|partidas|resultado|resultados)(?: do| da| de)?)(.+)$/i
  )

  return String(extractedMatch?.[1] || "Agenda esportiva")
    .replace(/[?.,!]/g, "")
    .trim()
}

export function buildFixtureIntentFallback(question = "", context: Record<string, any> = {}): string {
  const liveFixture = context?.liveFixture
  const hasRecentMatches = Array.isArray(liveFixture?.recentMatches) && liveFixture.recentMatches.length > 0
  const teamLabel = inferFixtureSubjectLabel(question, context)
  const subjectDetail = teamLabel && teamLabel !== "Agenda esportiva" ? ` de ${teamLabel}` : ""
  const recognizedSubject = Boolean(teamLabel && teamLabel !== "Agenda esportiva")
  const note = !String(question || "").trim()
    ? recognizedSubject
      ? `Nao encontrei horario confirmado${subjectDetail} agora. Se quiser, eu tambem posso tentar por campeonato ou adversario.`
      : "Me diga o time, clube ou selecao para eu abrir o card esportivo."
    : (!liveFixture || liveFixture.error)
      ? recognizedSubject
        ? `Nao consegui confirmar o proximo jogo${subjectDetail} agora. Para evitar horario errado, mantive o card em modo seguro ate a proxima consulta.`
        : `Nao consegui confirmar a agenda ao vivo${subjectDetail} agora. Para evitar data errada, este widget fica em modo seguro ate a proxima consulta.`
      : !liveFixture.hasUpcomingFixture && !hasRecentMatches
        ? recognizedSubject
          ? `No momento nao encontrei partida confirmada${subjectDetail} nesta consulta ao vivo. Se quiser, eu tambem posso tentar por campeonato ou adversario.`
          : `Nao encontrei confronto confirmado${subjectDetail} ou historico recente nesta consulta ao vivo.`
        : `Nao consegui montar o card esportivo completo${subjectDetail} agora.`

  return JSON.stringify({
    type: "data",
    content: {
      teamName: teamLabel || "Agenda esportiva",
      subjectType: liveFixture?.subjectType || "",
      league: liveFixture?.league || "Agenda esportiva",
      teamBadge: liveFixture?.teamBadge || null,
      teamCountry: liveFixture?.teamCountry || "",
      teamVenue: liveFixture?.teamVenue || "",
      homeTeam: teamLabel || "Time",
      awayTeam: "",
      homeScore: null,
      awayScore: null,
      homeBadge: null,
      awayBadge: null,
      kickoff: "--:--",
      dateLabel: "Sem confirmacao",
      status: !liveFixture || liveFixture.error ? "ao vivo indisponivel" : "sem confirmacao",
      venue: "",
      note,
      hasUpcomingFixture: false,
      nextMatches: Array.isArray(liveFixture?.nextMatches) ? liveFixture.nextMatches : [],
      recentMatches: hasRecentMatches ? liveFixture.recentMatches : [],
      liveMatches: Array.isArray(liveFixture?.liveMatches) ? liveFixture.liveMatches : [],
      verification: liveFixture?.verification && typeof liveFixture.verification === "object" ? liveFixture.verification : null,
      timeVerification: liveFixture?.timeVerification || liveFixture?.verification?.clock || null,
      sourceLinks: Array.isArray(liveFixture?.sourceLinks) ? liveFixture.sourceLinks : []
    },
    meta: {
      variant: "fixture",
      provider: liveFixture?.provider || "sports_fallback"
    }
  })
}

function looksLikeStructuredTableResponse(text = ""): boolean {
  const trimmed = String(text || "").trim()
  if (!trimmed) return false

  if (/^\s*```(?:json)?[\s\S]*"type"\s*:\s*"table"/i.test(trimmed)) {
    return true
  }

  if (/^\s*\{[\s\S]*"type"\s*:\s*"table"/i.test(trimmed)) {
    return true
  }

  const lines = trimmed.split(/\r?\n/)
  return lines.length >= 3
    && lines[0].includes("|")
    && /^\s*\|?\s*[:-]+[-| :]*\|?\s*$/.test(lines[1] || "")
}

function cleanComparisonTerm(value = ""): string {
  return String(value || "")
    .replace(/^(?:o|a|os|as|um|uma)\s+/i, "")
    .replace(/[?.,!]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function extractComparisonTerms(question = ""): [string, string] | null {
  const patterns = [
    /\bcomparando\s+(.+?)\s+e\s+(.+?)(?:\s+(?:em|sobre|no contexto de)\b|[?.!,]|$)/i,
    /\bcompare\s+(.+?)\s+e\s+(.+?)(?:\s+(?:em|sobre|no contexto de)\b|[?.!,]|$)/i,
    /\b(.+?)\s+(?:vs|versus)\s+(.+?)(?:\s+(?:em|sobre|no contexto de)\b|[?.!,]|$)/i
  ]

  for (const pattern of patterns) {
    const match = String(question || "").match(pattern)
    const left = cleanComparisonTerm(match?.[1] || "")
    const right = cleanComparisonTerm(match?.[2] || "")
    if (left && right) {
      return [left, right]
    }
  }

  return null
}

function buildRomansEightComparisonTable(terms: [string, string] | string[] = []) {
  const [left, right] = terms
  if (!left || !right) return null

  const normalizedLeft = normalizeLooseText(left)
  const normalizedRight = normalizeLooseText(right)
  const hasGuilt = normalizedLeft.includes("culpa") || normalizedRight.includes("culpa")
  const hasSecurity = normalizedLeft.includes("seguranca") || normalizedRight.includes("seguranca")
  if (!hasGuilt || !hasSecurity) {
    return null
  }

  const guiltLabel = normalizedLeft.includes("culpa") ? left : right
  const securityLabel = guiltLabel === left ? right : left

  return {
    columns: ["Aspecto", guiltLabel, securityLabel],
    rows: [
      ["Leitura central", "Peso da condenacao e da acusacao ligadas ao pecado.", "Seguranca de quem esta em Cristo e vive no Espirito."],
      ["Tom dominante", "Medo, autocobranca e senso de divida moral.", "Confianca, filiacao e esperanca sustentadas por Deus."],
      ["Base em Romanos 8", "Romanos 8 abre negando a condenacao final para quem esta em Cristo.", "Romanos 8 fecha afirmando que nada separa do amor de Deus."],
      ["Aplicacao pratica", "Levar a culpa para a cruz e abandonar a autossuficiencia.", "Descansar na obra de Cristo e caminhar com obediencia confiante."]
    ]
  }
}

function buildGenericComparisonTable(question = "", terms: [string, string] | string[] = []) {
  const [left, right] = terms
  if (!left || !right) return null

  const topicMatch = String(question || "").match(/\b(?:em|sobre|no contexto de)\s+([^?.!]+)$/i)
  const topic = String(topicMatch?.[1] || "").replace(/[?.,!]+$/g, "").trim()
  const topicSuffix = topic ? ` no contexto de ${topic}` : ""

  return {
    columns: ["Aspecto", left, right],
    rows: [
      ["Definicao", `${left} observado${topicSuffix}.`, `${right} observado${topicSuffix}.`],
      ["Foco principal", `Onde ${left} ganha mais peso${topicSuffix}.`, `Onde ${right} ganha mais peso${topicSuffix}.`],
      ["Risco ou tensao", `Qual cuidado pratico envolve ${left}.`, `Qual cuidado pratico envolve ${right}.`],
      ["Aplicacao", `Pergunta-chave: como lidar melhor com ${left}?`, `Pergunta-chave: como fortalecer ${right}?`]
    ]
  }
}

export function buildTableCardResponse(responseText = "", question = "", context: Record<string, unknown> = {}): string | null {
  if (!isTableCardPreferred(context)) {
    return null
  }

  const source = String(responseText || "").trim()
  if (looksLikeStructuredTableResponse(source)) {
    return source
  }

  const comparisonTerms = extractComparisonTerms(question)
  const payload = (/\bromanos\s+8\b/i.test(String(question || "")) && comparisonTerms
    ? buildRomansEightComparisonTable(comparisonTerms)
    : null)
    || buildGenericComparisonTable(question, comparisonTerms || [])

  if (!payload) {
    return null
  }

  return JSON.stringify({
    type: "table",
    content: payload
  })
}
