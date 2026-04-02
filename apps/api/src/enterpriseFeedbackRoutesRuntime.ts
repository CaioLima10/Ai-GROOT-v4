import type { Express, Request } from "express"

type GrootMemoryConnectorLike = {
  saveFeedback: (userId: string, requestId: string, rating: number, comment: unknown) => Promise<unknown>
}

type EnterpriseFeedbackRouteDeps = {
  grootMemoryConnector: GrootMemoryConnectorLike
}

type FeedbackBody = {
  requestId?: unknown
  rating?: unknown
  comment?: unknown
}

function getRequestUserId(req: Request) {
  return req.get("X-User-Id") || req.ip || "default_user"
}

export function registerEnterpriseFeedbackRoutes(app: Express, deps: EnterpriseFeedbackRouteDeps) {
  const { grootMemoryConnector } = deps

  app.post("/feedback", async (req, res) => {
    try {
      const body = (req.body ?? {}) as FeedbackBody
      const { requestId, rating, comment } = body

      if (!requestId || typeof rating !== "number") {
        return res.status(400).json({ error: "Feedback invalido", code: "INVALID_FEEDBACK" })
      }

      const userId = getRequestUserId(req)
      await grootMemoryConnector.saveFeedback(userId, String(requestId), rating, comment)

      res.json({ success: true })
    } catch {
      res.status(500).json({ error: "Falha ao salvar feedback" })
    }
  })
}