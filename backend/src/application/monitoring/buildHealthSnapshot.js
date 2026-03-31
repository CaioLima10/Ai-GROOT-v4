import { withTimeout } from "../../shared/async/withTimeout.js"

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
  const [health, knowledge] = await withTimeout(
    Promise.all([
      aiGateway.getHealthStatus(),
      grootAdvancedRAG.getAdvancedStats()
    ]),
    timeoutMs,
    "health_check_timeout"
  )

  return {
    status: "healthy",
    service,
    version,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    knowledge,
    ...health
  }
}
