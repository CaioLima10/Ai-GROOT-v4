// Avaliação simples de qualidade para respostas e sessões

const NEGATIVE_PATTERNS = [
  /resposta inválida/i,
  /falha ao/i,
  /erro interno/i,
  /não foi possível/i
]

export function evaluateInteractionQuality({ userMessage, aiResponse }) {
  const issues = []
  const response = String(aiResponse || '')
  const prompt = String(userMessage || '')

  if (!response || response.length < 15) {
    issues.push('very_short_response')
  }

  if (NEGATIVE_PATTERNS.some(r => r.test(response))) {
    issues.push('error_like_response')
  }

  const hasCode = response.includes('```')
  const wantsCode = /(código|code|exemplo|snippet)/i.test(prompt)
  if (wantsCode && !hasCode && response.length < 120) {
    issues.push('missing_code_example')
  }

  let score = 0.75
  if (issues.includes('very_short_response')) score -= 0.2
  if (issues.includes('error_like_response')) score -= 0.3
  if (issues.includes('missing_code_example')) score -= 0.1

  score = Math.max(0, Math.min(1, score))

  return {
    score,
    issues,
    shouldLearn: score >= 0.45
  }
}

export function evaluateSessionQuality({ evaluations = [] }) {
  if (evaluations.length === 0) {
    return { score: 0.7, status: 'unknown' }
  }

  const avg = evaluations.reduce((sum, item) => sum + (item.score || 0), 0) / evaluations.length
  const status = avg >= 0.75 ? 'healthy' : avg >= 0.5 ? 'mixed' : 'low'
  return { score: Math.round(avg * 100) / 100, status }
}
