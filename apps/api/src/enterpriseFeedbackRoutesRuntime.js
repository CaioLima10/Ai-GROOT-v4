export function registerEnterpriseFeedbackRoutes(app, deps) {
  const { grootMemoryConnector } = deps

  app.post("/feedback", async (req, res) => {
    try {
      const { requestId, rating, comment } = req.body || {}
      if (!requestId || typeof rating !== "number") {
        return res.status(400).json({ error: "Feedback inválido", code: "INVALID_FEEDBACK" })
      }

      const userId = req.get("X-User-Id") || req.ip || "default_user"
      await grootMemoryConnector.saveFeedback(userId, requestId, rating, comment)

      res.json({ success: true })
    } catch {
      res.status(500).json({ error: "Falha ao salvar feedback" })
    }
  })
}