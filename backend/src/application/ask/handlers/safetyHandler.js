/**
 * @param {{ routeQuestion: string, payload: import("../buildPreparedAskPayload.d.ts").PreparedAskPayload, ports: Record<string, any> }} input
 */
export async function safetyHandler({ routeQuestion, payload, ports }) {
  const safePayload = ports.safety.resolve(routeQuestion, payload.context)
  if (!safePayload) return null

  return {
    handled: true,
    intent: "safety",
    handler: "safetyHandler",
    responseText: safePayload.responseText,
    routeType: "deterministic",
    diagnostics: {
      safety: safePayload.safety || null
    }
  }
}
