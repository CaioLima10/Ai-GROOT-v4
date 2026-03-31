function clamp01(value) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

export function computeFinalScore(metrics = {}) {
  const relevance = clamp01(metrics.relevance)
  const groundedness = clamp01(metrics.groundedness)
  const correctness = clamp01(metrics.correctness)
  const hallucinationRisk = clamp01(metrics.hallucinationRisk)
  const latencyScore = clamp01(metrics.latencyScore)

  const raw =
    0.35 * relevance +
    0.30 * groundedness +
    0.20 * correctness +
    0.10 * latencyScore -
    0.25 * hallucinationRisk

  return clamp01(raw)
}

export function classifyScore(score) {
  const normalized = clamp01(score)
  if (normalized > 0.8) return "EXCELLENT"
  if (normalized > 0.6) return "GOOD"
  if (normalized > 0.4) return "WARNING"
  return "CRITICAL"
}

export function mapClassificationToStatus(classification) {
  if (classification === "EXCELLENT" || classification === "GOOD") return "healthy"
  if (classification === "WARNING") return "warning"
  return "critical"
}
