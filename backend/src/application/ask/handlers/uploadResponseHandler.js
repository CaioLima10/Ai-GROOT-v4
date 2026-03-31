/**
 * @param {{ routeQuestion: string, payload: import("../buildPreparedAskPayload.d.ts").PreparedAskPayload, ports: Record<string, any> }} input
 */
export async function uploadResponseHandler({ routeQuestion, payload, ports }) {
  const responseText = ports.deterministicUpload.resolve(routeQuestion, payload.context)
  if (!responseText) return null

  return {
    handled: true,
    intent: "deterministic_upload",
    handler: "uploadResponseHandler",
    responseText,
    routeType: "deterministic"
  }
}
