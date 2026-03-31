const UNCERTAIN_PATTERNS = ["talvez", "acho", "nao sei", "não sei", "possivelmente", "provavelmente"]

export function computeCorrectness(answer = "") {
  const text = String(answer || "").trim().toLowerCase()
  if (!text) return 0

  let score = 0.4
  if (text.length >= 40) score += 0.2
  if (text.length >= 120) score += 0.15

  const hasSentenceBoundary = /[.!?]/.test(text)
  if (hasSentenceBoundary) score += 0.1

  if (UNCERTAIN_PATTERNS.some((pattern) => text.includes(pattern))) {
    score -= 0.2
  }

  return Math.max(0, Math.min(1, score))
}
