import { critiqueResponse } from "./critiqueEngine.js"
import { rewriteResponse } from "./rewriteEngine.js"

export async function selfHealResponse({
  evaluation,
  question,
  answer,
  aiProvider,
  normalizeAnswer,
  threshold = 0.6,
  timeoutMs = 3500
}) {
  const score = Number(evaluation?.score || 0)
  if (score >= threshold) {
    return {
      finalAnswer: String(answer || ""),
      healed: false,
      issues: []
    }
  }

  const critique = await critiqueResponse({ question, answer })
  if (!critique.hasIssues) {
    return {
      finalAnswer: String(answer || ""),
      healed: false,
      issues: []
    }
  }

  const healPromise = rewriteResponse({
    question,
    originalAnswer: answer,
    issues: critique.issues,
    aiProvider,
    normalizeAnswer
  })

  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => resolve(String(answer || "")), Math.max(250, Number(timeoutMs) || 3500))
  })

  const improved = await Promise.race([healPromise, timeoutPromise])

  return {
    finalAnswer: String(improved || answer || ""),
    healed: String(improved || "").trim() && String(improved).trim() !== String(answer || "").trim(),
    issues: critique.issues
  }
}
