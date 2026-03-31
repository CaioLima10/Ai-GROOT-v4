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
  /\b(abuso|ass(é|e)dio|viol(ê|e)ncia dom(é|e)stica)\b/i,
  /\b(porn(o|ografia)?|nsfw|sexo expl[ií]cito|conte[uú]do adulto expl[ií]cito)\b/i,
  /\b(crian(ç|c)a|menor de idade|adolescente)\b[\s\S]{0,40}\b(sexo|sexual|porn|nude)\b/i,
  /\b(roubar|furtar|fraudar|golpear|falsificar|hackear|invadir|phishing|malware|ransomware|roubar senha)\b/i
]

const FACT_PATTERNS = [
  {
    key: 'name',
    regex: /(?:^|[.!?,]\s*|\se\s+)meu nome (?:e|é)\s+([a-z\u00c0-\u017f][a-z\u00c0-\u017f\s'-]{1,40})(?=[,.!?]|$)/i
  },
  {
    key: 'workDomain',
    regex: /(?:^|[.!?,]\s*|\se\s+)(?:eu trabalho com|trabalho com|atuo com|minha area (?:e|é)|minha área (?:e|é))\s+(?!como\b|qual\b|diga\b|dizer\b)([^.,\n]{2,80}?)(?=\s+e\s+prefiro|\s+e\s+gosto|[.,\n]|$)/i
  },
  {
    key: 'responseStyle',
    regex: /(?:^|[.!?,]\s*|\se\s+)(?:eu\s+)?prefiro respostas?\s+([^.,\n]{2,80}?)(?=[.,\n]|$)/i
  },
  {
    key: 'role',
    regex: /(?:^|[.!?,]\s*|\se\s+)eu sou (?:um|uma)\s+([^.,\n]{2,80}?)(?=[.,\n]|$)/i
  }
]

const SUSPICIOUS_FACT_VALUE_PATTERNS = [
  /\bagora diga\b/i,
  /\bqual (?:e|é)\b/i,
  /\bcomo prefiro\b/i,
  /\buma unica frase\b/i,
  /\buma única frase\b/i,
  /\blembra\b/i
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
  const bibleCodeMatch = String(text || '').toUpperCase().match(/\b(NAA|ARC|ACF|AA|ARA|NVI|NVT|BJ|KJA|KJF)\b/)

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

  if (
    bibleCodeMatch?.[1]
    && /\b(prefiro|prefere|uso|usar|mantenha|mantem|mantenha a|na|no|com a|com)\b/i.test(String(text || ""))
  ) {
    preferences.preferredBibleCode = bibleCodeMatch[1]
  }

  if (/\b(novos convertidos|novo convertido|novas convertidas|discipulado inicial|recem convertido|recém convertido)\b/i.test(input)) {
    preferences.ministryFocus = "new_believers"
  }

  return preferences
}

export function mergePreferences(existing = {}, updates = {}) {
  return {
    ...existing,
    ...updates
  }
}

export function extractIdentityFacts(text = '') {
  const input = String(text || '')
  const facts = {}

  FACT_PATTERNS.forEach(({ key, regex }) => {
    const match = input.match(regex)
    if (!match?.[1]) return

    const cleanedValue = match[1]
      .trim()
      .replace(/[.?!]+$/, '')

    if (!cleanedValue || SUSPICIOUS_FACT_VALUE_PATTERNS.some(pattern => pattern.test(cleanedValue))) {
      return
    }

    facts[key] = cleanedValue
  })

  return facts
}

export function sanitizeKnownFacts(facts = {}) {
  return Object.entries(facts || {}).reduce((acc, [key, value]) => {
    const normalizedValue = String(value || '').trim()
    if (!normalizedValue) {
      return acc
    }

    if (SUSPICIOUS_FACT_VALUE_PATTERNS.some(pattern => pattern.test(normalizedValue))) {
      return acc
    }

    acc[key] = normalizedValue
    return acc
  }, {})
}

export function mergeKnownFacts(existing = {}, incoming = {}) {
  return Object.entries(sanitizeKnownFacts(incoming) || {}).reduce((acc, [key, value]) => {
    if (typeof value === 'string' && value.trim()) {
      acc[key] = value.trim()
    }
    return acc
  }, sanitizeKnownFacts(existing))
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
  const facts = extractIdentityFacts(userMessage)

  return {
    skip: false,
    topics,
    preferences,
    facts,
    style: userStyle || 'natural',
    confidence: Math.max(0.4, Math.min(0.9, qualityScore))
  }
}
