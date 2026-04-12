import type { Express } from "express"

type BiblePassageRequest = {
  bibleId: string
  bibleCode: string
  passage: string
}

type BiblePassagePayload = {
  source?: string
  provider?: string
} & Record<string, unknown>

type EnterpriseBibleRouteDeps = {
  fetchBiblePassage: (input: BiblePassageRequest) => Promise<BiblePassagePayload | undefined>
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function buildBibleRequestId() {
  return `bible_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export function registerEnterpriseBibleRoutes(app: Express, deps: EnterpriseBibleRouteDeps) {
  const { fetchBiblePassage } = deps

  app.get("/bible/passage", async (req, res) => {
    const requestId = buildBibleRequestId()

    try {
      const passage = String(req.query.passage || "").trim()
      const bibleId = String(req.query.bibleId || "").trim()
      const bibleCode = String(req.query.bibleCode || "").trim()

      if (!passage) {
        return res.status(400).json({
          error: "Passagem nao informada. Use ?passage=JHN.3.16",
          code: "MISSING_PASSAGE",
          requestId
        })
      }

      const data = await fetchBiblePassage({ bibleId, bibleCode, passage })

      res.json({
        data,
        source: data?.source || data?.provider || "youversion",
        requestId
      })
    } catch (error) {
      res.status(500).json({
        error: "Falha ao consultar a Biblia",
        details: process.env.NODE_ENV === "development" ? getErrorMessage(error) : undefined,
        code: "BIBLE_API_ERROR",
        requestId
      })
    }
  })
}