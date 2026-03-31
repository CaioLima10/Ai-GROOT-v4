export function normalizeAnswerText(answer) {
  const responseText = typeof answer === "string"
    ? answer
    : (answer?.response ?? answer?.answer ?? "")

  return String(responseText || "").trim()
}

export function shouldKeepIdentityPreamble(question = "") {
  return /\b(quem\s+(?:e|é)\s+(?:voce|você|o giom)|se apresente|apresente-se|o que voce faz|o que você faz|o que voce consegue|o que você consegue|suas capacidades|seus limites|who are you|what can you do)\b/i.test(String(question || ""))
}

export function isPromptCardPreferred(context = {}) {
  return String(context?.preferredResponseCard || "").trim().toLowerCase() === "prompt"
}

function stripDecorativeAssistantLead(text = "") {
  return String(text || "")
    .replace(/^(?:aqui\s+esta|aqui\s+está|segue|claro|perfeito|combinado|beleza)[!,.:\s-]*/i, "")
    .replace(/^(?:vou\s+te\s+passar|posso\s+te\s+passar|te\s+passo)[!,.:\s-]*/i, "")
    .replace(/^(?:use\s+este\s+prompt|prompt\s+pronto|prompt\s+final|prompt\s+sugerido)\s*[:\-]\s*/i, "")
    .replace(/^(?:prompt|resposta|resultado)\s*[:\-]\s*/i, "")
    .trim()
}

function unescapeJsonLikeString(value = "") {
  return String(value || "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, "\"")
    .replace(/\\\\/g, "\\")
    .trim()
}

function extractPromptContentFromJsonLike(text = "") {
  const source = String(text || "").trim()
  if (!source) return ""

  try {
    const parsed = JSON.parse(source)
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

export function buildPromptCardResponse(responseText = "") {
  const source = extractPromptContentFromJsonLike(responseText)
    || (() => {
      const blockMatch = String(responseText || "").match(/```(?:prompt|text|txt)?\s*([\s\S]*?)\s*```/i)
      return blockMatch?.[1] ? blockMatch[1] : responseText
    })()
  const cleaned = stripDecorativeAssistantLead(source)
  if (!cleaned) return null

  return JSON.stringify({
    type: "prompt",
    content: cleaned
  })
}

export function buildFixtureCardResponse(context = {}) {
  const fixture = context?.liveFixture
  if (!fixture || fixture.error) return null

  const recentMatches = Array.isArray(fixture.recentMatches) ? fixture.recentMatches : []
  const nextMatches = Array.isArray(fixture.nextMatches) ? fixture.nextMatches : []
  const hasUpcomingFixture = Boolean(fixture.hasUpcomingFixture)
  const wantsHistory = Boolean(fixture.wantsHistory)
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
      nextMatches,
      recentMatches,
      liveMatches: Array.isArray(fixture.liveMatches) ? fixture.liveMatches : [],
      verification: fixture.verification && typeof fixture.verification === "object" ? fixture.verification : null,
      timeVerification: fixture.timeVerification || fixture.verification?.clock || null,
      sourceLinks: Array.isArray(fixture.sourceLinks) ? fixture.sourceLinks : []
    },
    meta: {
      variant: "fixture",
      provider: fixture.provider || "thesportsdb_verified"
    }
  })
}

function inferFixtureSubjectLabel(question = "", context = {}) {
  const liveFixture = context?.liveFixture
  if (String(liveFixture?.teamName || "").trim()) {
    return String(liveFixture.teamName).trim()
  }

  const normalizedQuestion = String(question || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  const commonTeams = [
    ["brasil", "Brasil"],
    ["selecao brasileira", "Brasil"],
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

  for (const [token, label] of commonTeams) {
    if (normalizedQuestion.includes(token)) {
      return label
    }
  }

  const extractedMatch = String(question || "").match(
    /(?:proximo(?:s)? jogo(?:s)?(?: do| da| de)?|próximo(?:s)? jogo(?:s)?(?: do| da| de)?|quando joga(?: o| a)?|partida(?:s)?(?: do| da| de)?|historico(?: do| da| de)?|histórico(?: do| da| de)?|retrospecto(?: do| da| de)?|ultim(?:o|os|a|as)\s+(?:jogo|jogos|partida|partidas|resultado|resultados)(?: do| da| de)?)(.+)$/i
  )

  return String(extractedMatch?.[1] || "Agenda esportiva")
    .replace(/[?.,!]/g, "")
    .trim()
}

export function buildFixtureIntentFallback(question = "", context = {}) {
  const liveFixture = context?.liveFixture
  const hasRecentMatches = Array.isArray(liveFixture?.recentMatches) && liveFixture.recentMatches.length > 0
  const teamLabel = inferFixtureSubjectLabel(question, context)
  const note = !String(question || "").trim()
    ? "Me diga o time, clube ou selecao para eu abrir o card esportivo."
    : (!liveFixture || liveFixture.error)
      ? "Nao consegui confirmar a agenda ao vivo agora. Para evitar data errada, este widget fica em modo seguro ate a proxima consulta."
      : !liveFixture.hasUpcomingFixture && !hasRecentMatches
        ? "Nao encontrei confronto confirmado ou historico recente nesta consulta ao vivo."
        : "Nao consegui montar o card esportivo completo agora."

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
