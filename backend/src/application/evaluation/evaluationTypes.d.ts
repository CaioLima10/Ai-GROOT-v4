export interface EvaluationInput {
  question: string
  answer: string
  context?: unknown
  memoryContext?: unknown
  intent?: string
  handler?: string
  latencyMs?: number
}

export type EvaluationClassification = "EXCELLENT" | "GOOD" | "WARNING" | "CRITICAL"

export interface EvaluationResult {
  score: number
  relevance: number
  groundedness: number
  correctness: number
  hallucinationRisk: number
  latencyScore: number
  classification: EvaluationClassification
  status: "healthy" | "warning" | "critical"
  flags: string[]
  issues: string[]
}
