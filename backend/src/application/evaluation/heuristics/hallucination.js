function normalizeContext(context) {
  if (!context) return ""
  if (typeof context === "string") return context.toLowerCase()
  try {
    return JSON.stringify(context).toLowerCase()
  } catch {
    return String(context).toLowerCase()
  }
}

function tokenize(text = "") {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9_\u00C0-\u024F]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
}

export function computeHallucinationRisk(answer = "", context = null) {
  if (!answer) return 1
  const ctx = normalizeContext(context)
  if (!ctx) return 0.6

  const tokens = tokenize(answer)
  if (tokens.length === 0) return 0.6

  let unknown = 0
  for (const token of tokens) {
    if (!ctx.includes(token)) unknown++
  }

  return Math.max(0, Math.min(1, unknown / tokens.length))
}
