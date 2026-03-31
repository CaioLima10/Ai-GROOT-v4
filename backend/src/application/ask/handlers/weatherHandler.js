/**
 * @param {{ routeQuestion: string, payload: import("../buildPreparedAskPayload.d.ts").PreparedAskPayload, ports: Record<string, any> }} input
 */
export async function weatherHandler({ routeQuestion, payload, ports }) {
  const responseText = ports.weather.resolve(routeQuestion, payload.context)
  if (!responseText) return null

  return {
    handled: true,
    intent: "weather",
    handler: "weatherHandler",
    responseText,
    routeType: "deterministic"
  }
}
