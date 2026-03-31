function tokenize(text = "") {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9_\u00C0-\u024F]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
}

export function computeRelevance(question = "", answer = "") {
  if (!question || !answer) return 0

  const qTokens = Array.from(new Set(tokenize(question)))
  if (qTokens.length === 0) return 0

  const answerText = String(answer).toLowerCase()
  let hits = 0

  for (const token of qTokens) {
    if (answerText.includes(token)) hits++
  }

  return Math.max(0, Math.min(1, hits / qTokens.length))
}
