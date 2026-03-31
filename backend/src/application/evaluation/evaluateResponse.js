import { computeFinalScore, classifyScore, mapClassificationToStatus } from "./scoringEngine.js"
import { computeRelevance } from "./heuristics/relevance.js"
import { computeGroundedness } from "./heuristics/groundedness.js"
import { computeHallucinationRisk } from "./heuristics/hallucination.js"
import { computeCorrectness } from "./heuristics/correctness.js"
import { computeLatencyScore } from "./heuristics/latency.js"

export async function evaluateResponse(input = {}) {
  const {
    question = "",
    answer = "",
    context = null,
    memoryContext = null,
    latencyMs = 0
  } = input

  const referenceContext = context || memoryContext
  const relevance = computeRelevance(question, answer)
  const groundedness = computeGroundedness(answer, referenceContext)
  const hallucinationRisk = computeHallucinationRisk(answer, referenceContext)
  const correctness = computeCorrectness(answer)
  const latencyScore = computeLatencyScore(latencyMs)

  const score = computeFinalScore({
    relevance,
    groundedness,
    correctness,
    hallucinationRisk,
    latencyScore
  })

  const classification = classifyScore(score)
  const status = mapClassificationToStatus(classification)

  const flags = []
  if (hallucinationRisk > 0.4) flags.push("HIGH_HALLUCINATION")
  if (score < 0.4) flags.push("LOW_QUALITY")
  if (latencyMs > 1000) flags.push("SLOW_RESPONSE")

  return {
    score,
    relevance,
    groundedness,
    correctness,
    hallucinationRisk,
    latencyScore,
    classification,
    status,
    flags,
    issues: [...flags]
  }
}
