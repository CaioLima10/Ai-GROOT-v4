import {
  buildPreparedAskPayload,
  buildPreparedAskSeed,
  summarizeUploadExtraction
} from "../../../application/ask/buildPreparedAskPayload.js"

/**
 * HTTP adapter only. Converts Express request + runtime integrations into a pure application payload.
 *
 * @param {{
 *   req: import("express").Request,
 *   requestId: string,
 *   uploads: Map<string, Record<string, unknown>>,
 *   resolveUploadExtraction: (uploadEntry: Record<string, unknown>) => Promise<Record<string, unknown> | null>,
 *   buildUploadExtractionBlock: (uploadEntry: Record<string, unknown>, uploadExtraction: Record<string, unknown>) => string,
 *   buildRuntimeConversationContext?: (question: string, context: Record<string, unknown>, extras: Record<string, unknown>) => Promise<Record<string, unknown>>
 * }} input
 */
export async function buildPreparedAskPayloadFromHttp(input) {
  const {
    req,
    requestId,
    uploads,
    resolveUploadExtraction,
    buildUploadExtractionBlock,
    buildRuntimeConversationContext
  } = input

  const userId = String(req.get("X-User-Id") || req.ip || "default_user")
  const sessionId = req.get("X-Session-Id") || req.body?.sessionId || null
  const timestamp = new Date().toISOString()

  const seed = buildPreparedAskSeed({
    body: req.body || {},
    userId,
    sessionId,
    requestId,
    timestamp,
    ip: req.ip || null,
    userAgent: req.get("User-Agent") || null
  })

  const uploadId = seed.context?.uploadId
  const uploadEntry = uploadId ? uploads.get(String(uploadId)) || null : null

  let uploadExtraction = null
  let uploadPromptBlock = ""
  if (uploadEntry) {
    uploadExtraction = await resolveUploadExtraction(uploadEntry)
    if (uploadExtraction) {
      uploadPromptBlock = buildUploadExtractionBlock(uploadEntry, uploadExtraction)
    }
  }

  const runtimeContext = typeof buildRuntimeConversationContext === "function"
    ? await buildRuntimeConversationContext(seed.normalizedQuestion, seed.context, {
      userAgent: seed.requestMetadata.userAgent,
      ip: seed.requestMetadata.ip,
      userId: seed.requestMetadata.userId,
      timestamp: seed.requestMetadata.timestamp,
      requestId: seed.requestMetadata.requestId,
      sessionId: seed.requestMetadata.sessionId,
      uploadId: uploadEntry?.id || seed.context?.uploadId || null,
      uploadName: uploadEntry?.name || seed.context?.uploadName || null,
      uploadType: uploadEntry?.type || seed.context?.uploadType || null,
      uploadExtraction: uploadExtraction
        ? summarizeUploadExtraction(uploadExtraction)
        : (seed.context?.uploadExtraction || null)
    })
    : {
      ...seed.context,
      uploadId: uploadEntry?.id || seed.context?.uploadId || null,
      uploadName: uploadEntry?.name || seed.context?.uploadName || null,
      uploadType: uploadEntry?.type || seed.context?.uploadType || null,
      uploadExtraction: uploadExtraction
        ? summarizeUploadExtraction(uploadExtraction)
        : (seed.context?.uploadExtraction || null)
    }

  return buildPreparedAskPayload({
    seed,
    runtimeContext,
    uploadEntry,
    uploadExtraction,
    uploadPromptBlock
  })
}
