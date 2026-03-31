/**
 * @param {{ routeQuestion: string, payload: import("../buildPreparedAskPayload.d.ts").PreparedAskPayload, ports: Record<string, any> }} input
 */
export async function biblePassageHandler({ routeQuestion, payload, ports }) {
  const responseText = ports.bible.passages.resolve(routeQuestion, payload.context)
  if (!responseText) return null

  return {
    handled: true,
    intent: "bible_passage",
    handler: "biblePassageHandler",
    responseText,
    routeType: "deterministic"
  }
}
