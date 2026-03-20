// GROOT Learning Engine - sinais leves de aprendizado (seguro e local-first)

const STOPWORDS = new Set([
  'a', 'o', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'para', 'por',
  'com', 'sem', 'um', 'uma', 'uns', 'umas', 'no', 'na', 'nos', 'nas', 'ao', 'aos',
  'à', 'às', 'que', 'se', 'ser', 'estar', 'ter', 'tem', 'tinha', 'foi', 'vai',
  'eu', 'você', 'vc', 'ele', 'ela', 'eles', 'elas', 'me', 'te', 'lhe', 'minha',
  'meu', 'seu', 'sua', 'seus', 'suas', 'isso', 'isto', 'aquilo', 'aqui', 'ali',
  'pra', 'porque', 'porquê', 'como', 'quando', 'onde', 'qual', 'quais'
])

const SENSITIVE_PATTERNS = [
  /\b(suic(i|í)dio|me matar|quero morrer|tirar minha vida)\b/i,
  /\b(depress(a|ã)o|ansiedade|p(â|a)n(i|í)co|autoles(ã|a)o|auto[-\s]?agress(ã|a)o)\b/i,
  /\b(abuso|ass(é|e)dio|viol(ê|e)ncia dom(é|e)stica)\b/i
]

export function isSensitive(text = '') {
  const input = String(text || '')
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(input))
}

export function extractTopics(text = '', maxTopics = 3) {
  const tokens = String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(token => token.length > 3 && !STOPWORDS.has(token))

  const counts = new Map()
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1)
  }

  return Array.from(counts.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxTopics)
    .map(([token]) => token)
}

export function detectPreferences(text = '') {
  const input = String(text).toLowerCase()
  const preferences = {}

  if (input.match(/\b(sem|não use|nao use)\s+emoj/i)) {
    preferences.noEmojis = true
  }

  if (input.match(/\b(resuma|resumido|curto|objetivo|direto)\b/)) {
    preferences.verbosity = 'short'
  }

  if (input.match(/\b(detalhado|completo|passo a passo|explica melhor)\b/)) {
    preferences.verbosity = 'detailed'
  }

  if (input.match(/\b(portugu(ê|e)s|pt-br|pt)\b/)) {
    preferences.locale = 'pt-BR'
  }

  if (input.match(/\b(english|ingl(ê|e)s)\b/)) {
    preferences.locale = 'en-US'
  }

  if (input.match(/\b(exemplo|exemplos|com exemplo)\b/)) {
    preferences.examples = true
  }

  return preferences
}

export function mergePreferences(existing = {}, updates = {}) {
  return {
    ...existing,
    ...updates
  }
}

export function buildLearningSignals({ userMessage, aiResponse, userStyle, qualityScore = 0.8 }) {
  if (isSensitive(userMessage) || isSensitive(aiResponse)) {
    return { skip: true, reason: 'sensitive_content' }
  }

  if (qualityScore < 0.45) {
    return { skip: true, reason: 'low_quality' }
  }

  const topics = extractTopics(userMessage, 4)
  const preferences = detectPreferences(userMessage)

  return {
    skip: false,
    topics,
    preferences,
    style: userStyle || 'natural',
    confidence: Math.max(0.4, Math.min(0.9, qualityScore))
  }
}
