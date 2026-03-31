/**
 * @param {{ routeQuestion: string, payload: import("../buildPreparedAskPayload.d.ts").PreparedAskPayload, ports: Record<string, any> }} input
 */
export async function fixtureHandler({ routeQuestion, payload, ports }) {
  const responseText = ports.fixture.resolve(routeQuestion, payload.context)
  if (!responseText) return null

  return {
    handled: true,
    intent: "sports_fixture",
    handler: "fixtureHandler",
    responseText,
    routeType: "deterministic"
  }
}
