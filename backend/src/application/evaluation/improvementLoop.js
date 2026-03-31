import { writeEvaluationDataset } from "./feedbackIngestion.js"

export async function processEvaluation(evaluation, payload = {}, result = {}) {
  const score = Number(evaluation?.score || 0)
  const shouldPersistMemory = score >= 0.5

  const action = {
    shouldPersistMemory,
    memoryBoost: score > 0.8 ? 1.15 : 1,
    markedForRetraining: score < 0.5,
    score
  }

  try {
    await writeEvaluationDataset({
      question: payload?.question || payload?.normalizedQuestion || "",
      answer: result?.responseText || "",
      evaluation,
      metadata: {
        intent: payload?.intent || null,
        handler: payload?.handler || null,
        requestId: payload?.requestId || null
      }
    })
  } catch (_) {
    // Dataset collection must never interrupt the ask pipeline.
  }

  return action
}
