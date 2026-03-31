// @ts-check

import { isWeatherCardPreferred, isWeatherQuestion } from "./weatherRuntime.js"

function normalizeIntentText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function hasSportsIntentCue(question = "") {
  return /\b(jogo|jogos|partida|partidas|placar|agenda esportiva|agenda de jogos|confronto|campeonato|quando joga|proximo jogo|proximos jogos|proximo confronto|historico|retrospecto|ultimos jogos|ultimos resultados|ultimos 5|serie a|serie b|brasileirao|libertadores|copa do brasil|copa do mundo|eliminatorias|horario|estadio|selecao)\b/.test(normalizeIntentText(question))
}

function hasStrongSportsEntity(question = "") {
  return /\b(botafogo|flamengo|palmeiras|corinthians|gremio|internacional|spfc|sao paulo fc|santos fc|selecao brasileira|bahia ec|ec bahia|esporte clube bahia)\b/.test(normalizeIntentText(question))
}

function isBrazilNationalTeamQuestion(question = "") {
  const normalized = normalizeIntentText(question)
  return /\bbrasil\b/.test(normalized) && /\b(jogo|partida|placar|quando joga|campeonato|copa|selecao|eliminatorias)\b/.test(normalized)
}

export function isFixtureQuestion(question = "", _context = {}) {
  if (isWeatherQuestion(question)) return false
  return hasSportsIntentCue(question) || hasStrongSportsEntity(question) || isBrazilNationalTeamQuestion(question)
}

export function isFixtureCardPreferred(question = "", context = {}) {
  const preferredVariant = String(context?.preferredResponseVariant || "").trim().toLowerCase()
  if (preferredVariant === "fixture") return true
  return isFixtureQuestion(question, context)
}

export function isSportsScheduleRelevant(question = "", context = {}) {
  if (String(context?.preferredResponseVariant || "").trim().toLowerCase() === "fixture") return true
  if (isWeatherQuestion(question)) return false
  return hasSportsIntentCue(question) || hasStrongSportsEntity(question) || isBrazilNationalTeamQuestion(question)
}

export function shouldInjectGoogleLiveSearch(question = "", context = {}, options = {}) {
  if (options.googleSearchConfigured !== true) return false
  if (isWeatherCardPreferred(question, context) || isFixtureCardPreferred(question, context)) return false
  return /\b(hoje|agora|tempo real|ao vivo|atualizado|atualizadas|ultimas|ultimos|noticias|preco|cotacao|quando|proximo)\b/.test(normalizeIntentText(question))
}
