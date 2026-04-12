import { withTimeout } from "../../shared/async/withTimeout.js"

function getErrorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback
}

/**
 * @param {{
 *   aiGateway: { getHealthStatus: () => Promise<Record<string, unknown>> },
 *   grootAdvancedRAG: { getAdvancedStats: () => Promise<Record<string, unknown>> },
 *   service: string,
 *   version: string,
 *   timeoutMs?: number
 * }} deps
 */
export async function buildHealthSnapshot({
  aiGateway,
  grootAdvancedRAG,
  service,
  version,
  timeoutMs = Number(process.env.HEALTH_TIMEOUT_MS || 4000)
}) {
  const [healthResult, knowledgeResult] = await Promise.all([
    withTimeout(
      aiGateway.getHealthStatus(),
      timeoutMs,
      "provider_health_timeout"
    )
      .then((value) => ({ ok: true, value }))
      .catch((error) => ({
        ok: false,
        error: getErrorMessage(error, "provider_health_failed")
      })),
    withTimeout(
      grootAdvancedRAG.getAdvancedStats(),
      timeoutMs,
      "knowledge_health_timeout"
    )
      .then((value) => ({ ok: true, value }))
      .catch((error) => ({
        ok: false,
        error: getErrorMessage(error, "knowledge_health_failed")
      }))
  ])

  const providerHealth = healthResult.ok && healthResult.value && typeof healthResult.value === "object"
    ? healthResult.value
    : {}
  const knowledge = knowledgeResult.ok
    ? knowledgeResult.value
    : {
        status: "unavailable",
        error: knowledgeResult.error
      }
  const degradedReasons = []

  if (!healthResult.ok) {
    degradedReasons.push(`providers:${healthResult.error}`)
  }

  if (!knowledgeResult.ok) {
    degradedReasons.push(`knowledge:${knowledgeResult.error}`)
  }

  return {
    ...providerHealth,
    status: degradedReasons.length === 0 ? "healthy" : "degraded",
    service,
    version,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    knowledge,
    ...(degradedReasons.length > 0 ? { degradedReasons } : {})
  }
}
