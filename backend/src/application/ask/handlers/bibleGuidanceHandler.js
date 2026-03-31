/**
 * @param {{ routeQuestion: string, payload: import("../buildPreparedAskPayload.d.ts").PreparedAskPayload, ports: Record<string, any> }} input
 */
export async function bibleGuidanceHandler({ routeQuestion, payload, ports }) {
  const responseText = ports.bible.guidance.resolve(routeQuestion, payload.context)
  if (!responseText) return null

  return {
    handled: true,
    intent: "bible_guidance",
    handler: "bibleGuidanceHandler",
    responseText,
    routeType: "deterministic"
  }
}
