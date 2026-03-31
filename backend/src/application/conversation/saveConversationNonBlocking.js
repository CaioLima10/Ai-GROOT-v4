/**
 * @param {{
 *   connector: { saveConversation: (userId: string, question: string, responseText: string, metadata?: Record<string, unknown>) => Promise<unknown> },
 *   logger?: { error?: (requestId: string, code: string, payload: Record<string, unknown>) => void }
 * }} deps
 */
export function createSaveConversationNonBlocking({ connector, logger }) {
  return function saveConversationNonBlocking(userId, question, responseText, metadata = {}, requestId = "") {
    connector.saveConversation(userId, question, responseText, metadata).catch((error) => {
      try {
        logger?.error?.(requestId || "save_conversation", "SAVE_CONVERSATION_FAILED", {
          error: error?.message || String(error || "unknown_error")
        })
      } catch (_) {
        // Preserve fire-and-forget semantics even if logger is unavailable.
      }
    })
  }
}
