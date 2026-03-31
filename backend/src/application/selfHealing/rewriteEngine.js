function normalizeProviderAnswer(rawAnswer, normalizeFn) {
  if (typeof normalizeFn === "function") {
    try {
      const normalized = normalizeFn(rawAnswer)
      if (normalized) return String(normalized)
    } catch (_) {
      // fallback below
    }
  }

  if (typeof rawAnswer === "string") return rawAnswer
  if (rawAnswer && typeof rawAnswer === "object") {
    return String(rawAnswer.response || rawAnswer.answer || rawAnswer.text || "")
  }
  return ""
}

export async function rewriteResponse({
  question,
  originalAnswer,
  issues,
  aiProvider,
  normalizeAnswer
}) {
  if (!aiProvider || typeof aiProvider.ask !== "function") {
    return String(originalAnswer || "")
  }

  const prompt = [
    "Voce e um sistema de correcao de respostas.",
    "Reescreva a resposta para ficar clara, objetiva e util.",
    "Nao invente informacoes.",
    "",
    `Pergunta: ${question}`,
    `Resposta original: ${originalAnswer}`,
    `Problemas detectados: ${(issues || []).join(", ") || "nenhum"}`,
    "",
    "Resposta final melhorada:"
  ].join("\n")

  try {
    const improvedRaw = await aiProvider.ask(prompt, {
      selfHealing: true,
      issues: issues || [],
      originalQuestion: question
    })
    const improved = normalizeProviderAnswer(improvedRaw, normalizeAnswer).trim()
    return improved || String(originalAnswer || "")
  } catch (_) {
    return String(originalAnswer || "")
  }
}
