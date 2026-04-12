function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

export function registerEnterpriseKnowledgeRoutes(app, deps) {
  const {
    grootAdvancedRAG,
    AI_KNOWLEDGE_SERVICE_SLUG,
    listBibleStudyModules
  } = deps

  app.get("/knowledge/status", async (_req, res) => {
    try {
      const stats = await grootAdvancedRAG.getAdvancedStats()
      res.json({
        service: AI_KNOWLEDGE_SERVICE_SLUG,
        stats,
        bibleStudyModules: listBibleStudyModules()
      })
    } catch (error) {
      res.status(500).json({
        error: "Falha ao obter status da base de conhecimento",
        details: process.env.NODE_ENV === "development" ? getErrorMessage(error) : undefined
      })
    }
  })
}