/**
 * @param {{ routeQuestion: string, payload: import("../buildPreparedAskPayload.d.ts").PreparedAskPayload, ports: Record<string, any> }} input
 */
export async function greetingHandler({ routeQuestion, payload, ports }) {
  const greetingSignals = ports.greeting.detect(routeQuestion)
  if (!greetingSignals?.isGreetingOnly) return null

  return {
    handled: true,
    intent: "greeting",
    handler: "greetingHandler",
    responseText: ports.greeting.build(routeQuestion, payload.context),
    routeType: "deterministic",
    diagnostics: {
      hasGreeting: Boolean(greetingSignals.hasGreeting),
      hasWellBeing: Boolean(greetingSignals.hasWellBeing)
    }
  }
}
