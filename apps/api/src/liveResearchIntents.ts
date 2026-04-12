import { isLikelyWeatherQuestion } from "../../../packages/shared-config/src/index.js"

interface IntentContext {
  preferredResponseVariant?: string
  [key: string]: unknown
}

interface LiveSearchOptions {
  googleSearchConfigured?: boolean
  [key: string]: unknown
}

function normalizeIntentText(value = ""): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function hasExplicitShortReplyInstruction(question = ""): boolean {
  return /\b(?:responda|responde|retorne|diga)\s+(?:apenas|s[oó]|somente)\b/i.test(String(question || ""))
}

function isCapabilityOrToolingQuestion(question = ""): boolean {
  const normalized = normalizeIntentText(question)
  const asksCapabilities = /\b(o que voce consegue|o que voce realmente tem|quais sao seus limites|como voce funciona|consegue pesquisar|consegue verificar|quais formatos|quais arquivos|le de forma nativa|faz bem nesta execucao|nesta execucao|capacidade|capacidades|limites|ferramentas)\b/.test(normalized)
  const mentionsToolingSurface = /\b(google|bing|yahoo|web|internet|browser|ao vivo|tempo real|formatos|arquivos|pdf|docx|xlsx|pptx|ocr|imagem|pesquisa)\b/.test(normalized)

  return asksCapabilities && mentionsToolingSurface
}

function isWeatherQuestion(question = ""): boolean {
  return isLikelyWeatherQuestion(question)
}

function isWeatherCardPreferred(question = "", context: IntentContext = {}): boolean {
  const preferredVariant = String(context?.preferredResponseVariant || "").trim().toLowerCase()
  if (preferredVariant === "weather") {
    return true
  }
  return Boolean(context?.agroWeather) && isWeatherQuestion(question)
}

function hasSportsIntentCue(question = ""): boolean {
  return /\b(jogo|jogos|partida|partidas|placar|agenda esportiva|agenda de jogos|confronto|quando joga|proximo jogo|proximos jogos|proximo confronto|historico|retrospecto|ultimos jogos|ultimos resultados|ultimos 5|resultado do jogo|escalacao|local do jogo|local da partida|horario do jogo|horario da partida|estadio|onde sera|proxima partida)\b/.test(normalizeIntentText(question))
}

function hasSportsCompetitionCue(question = ""): boolean {
  return /\b(campeonato|serie a|serie b|brasileirao|brasileiro serie|libertadores|copa do brasil|copa do mundo|eliminatorias|selecao)\b/.test(normalizeIntentText(question))
}

function hasAmbiguousSportsSubject(question = ""): boolean {
  return /\b(brasil|bahia|santos|sao paulo|argentina)\b/.test(normalizeIntentText(question))
}

function hasSportsContextAnchor(question = ""): boolean {
  const normalized = normalizeIntentText(question)
  return hasStrongSportsEntity(question)
    || hasAmbiguousSportsSubject(question)
    || hasSportsCompetitionCue(question)
    || /\b(time|clube|selecao)\b/.test(normalized)
}

function hasLiveFixtureTeamName(context: IntentContext = {}): boolean {
  const liveFixture = context?.liveFixture
  return Boolean(liveFixture && typeof liveFixture === "object" && "teamName" in liveFixture && liveFixture.teamName)
}

function hasStrongSportsEntity(question = ""): boolean {
  return /\b(botafogo|flamengo|palmeiras|corinthians|gremio|internacional|spfc|sao paulo fc|santos fc|selecao brasileira|bahia ec|ec bahia|esporte clube bahia)\b/.test(normalizeIntentText(question))
}

function isBrazilNationalTeamQuestion(question = ""): boolean {
  const normalized = normalizeIntentText(question)
  return /\bbrasil\b/.test(normalized) && /\b(jogo|partida|placar|quando joga|campeonato|copa|selecao|eliminatorias)\b/.test(normalized)
}

export function isFixtureQuestion(question = "", _context: IntentContext = {}): boolean {
  if (hasExplicitShortReplyInstruction(question) || isCapabilityOrToolingQuestion(question)) return false
  if (isWeatherQuestion(question)) return false
  return (hasSportsIntentCue(question) && hasSportsContextAnchor(question))
    || hasStrongSportsEntity(question)
    || isBrazilNationalTeamQuestion(question)
}

export function isFixtureCardPreferred(question = "", context: IntentContext = {}): boolean {
  const preferredVariant = String(context?.preferredResponseVariant || "").trim().toLowerCase()
  if (hasExplicitShortReplyInstruction(question) || isCapabilityOrToolingQuestion(question)) return false
  if (preferredVariant === "fixture") {
    return isFixtureQuestion(question, context) || hasLiveFixtureTeamName(context)
  }
  return isFixtureQuestion(question, context)
}

export function isSportsScheduleRelevant(question = "", context: IntentContext = {}): boolean {
  if (hasExplicitShortReplyInstruction(question) || isCapabilityOrToolingQuestion(question)) return false
  if (isWeatherQuestion(question)) return false
  if (String(context?.preferredResponseVariant || "").trim().toLowerCase() === "fixture") {
    return isFixtureQuestion(question, context) || hasLiveFixtureTeamName(context)
  }
  return isFixtureQuestion(question, context)
}

export function shouldInjectGoogleLiveSearch(question = "", context: IntentContext = {}, options: LiveSearchOptions = {}): boolean {
  if (options.googleSearchConfigured !== true) return false
  if (hasExplicitShortReplyInstruction(question) || isCapabilityOrToolingQuestion(question)) return false
  if (isWeatherCardPreferred(question, context) || isFixtureCardPreferred(question, context)) return false
  return /\b(hoje|agora|tempo real|ao vivo|atualizado|atualizadas|ultimas|ultimos|noticias|preco|cotacao|quando|proximo)\b/.test(normalizeIntentText(question))
}
