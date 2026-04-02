import type { Express, RequestHandler } from "express"

type EvaluationResult = {
  score?: number
  issues?: unknown
} & Record<string, unknown>

type PreparedRuntimeContext = {
  researchCapabilities?: unknown
} & Record<string, unknown>

type BenchmarkTurn = {
  scenarioId: string
  evaluation: EvaluationResult
  metadata?: {
    requestId?: string
  }
}

type BenchmarkResult = {
  summary: {
    score?: number
  } & Record<string, unknown>
  turns: BenchmarkTurn[]
} & Record<string, unknown>

type LoggerLike = {
  error: (requestId: string, event: string, payload: Record<string, unknown>) => void
}

type AiGatewayLike = {
  logger: LoggerLike
}

type GrootMemoryConnectorLike = {
  saveLearningPattern: (userId: string, patternType: string, payload: unknown, score?: number) => Promise<unknown>
}

type EnterpriseQualityRouteDeps = {
  requireAdmin: RequestHandler
  aiGateway: AiGatewayLike
  listEvaluationDimensions: () => unknown
  listEvaluationPacks: () => unknown
  buildRuntimeConversationContext: (
    message: string,
    context: Record<string, unknown>,
    options?: Record<string, unknown>
  ) => Promise<PreparedRuntimeContext>
  askGiom: (message: string, context: PreparedRuntimeContext) => Promise<string>
  evaluateConversationTurn: (input: {
    userMessage: string
    aiResponse: string
    history: unknown[]
    researchCapabilities: unknown
    tags: unknown[]
  }) => EvaluationResult
  persistEvaluationArtifacts: (
    userId: string,
    requestId: string,
    evaluation: EvaluationResult,
    metadata: Record<string, unknown>
  ) => Promise<unknown>
  getResearchCapabilities: () => unknown
  runConversationBenchmark: (input: {
    packId: string
    researchCapabilities: unknown
    requestTurn: (input: {
      scenario: { id: string }
      turn: { question: string; context?: Record<string, unknown> }
      history: unknown[]
    }) => Promise<{
      answer: string
      requestId: string
      metadata: {
        scenarioUserId: string
      }
    }>
  }) => Promise<BenchmarkResult>
  grootMemoryConnector: GrootMemoryConnectorLike
  askGroot: (message: string, context: Record<string, unknown>) => Promise<string>
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function buildRequestId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function buildFailurePayload(error: unknown, publicMessage: string, code: string, requestId: string) {
  return {
    error: publicMessage,
    details: process.env.NODE_ENV === "development" ? getErrorMessage(error) : undefined,
    code,
    requestId
  }
}

function normalizeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function normalizeArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

export function registerEnterpriseQualityRoutes(app: Express, deps: EnterpriseQualityRouteDeps) {
  const {
    requireAdmin,
    aiGateway,
    listEvaluationDimensions,
    listEvaluationPacks,
    buildRuntimeConversationContext,
    askGiom,
    evaluateConversationTurn,
    persistEvaluationArtifacts,
    getResearchCapabilities,
    runConversationBenchmark,
    grootMemoryConnector,
    askGroot
  } = deps

  app.get("/evaluation/packs", requireAdmin, (_req, res) => {
    res.json({
      dimensions: listEvaluationDimensions(),
      packs: listEvaluationPacks(),
      note: "Consciencia operacional avalia honestidade sobre capacidades e limites, sem alegar consciencia real."
    })
  })

  app.post("/evaluation/conversation", requireAdmin, async (req, res) => {
    const requestId = buildRequestId("eval")

    try {
      const body = normalizeObject(req.body)
      const message = String(body.message || "")
      const context = normalizeObject(body.context)
      const history = normalizeArray(body.history)
      const tags = normalizeArray(body.tags)
      const sessionId = body.sessionId

      if (!message.trim()) {
        return res.status(400).json({
          error: "Mensagem obrigatoria para avaliacao",
          code: "EVAL_MESSAGE_REQUIRED"
        })
      }

      const evaluationUserId = String(sessionId || req.get("X-User-Id") || req.ip || "evaluation_user")
      const preparedContext = await buildRuntimeConversationContext(message, context, {
        userId: evaluationUserId,
        requestId,
        evaluationMode: true,
        conversationHistory: history
      })
      const researchCapabilities = preparedContext.researchCapabilities

      const responseText = await askGiom(message, preparedContext)
      const evaluation = evaluateConversationTurn({
        userMessage: message,
        aiResponse: responseText,
        history,
        researchCapabilities,
        tags
      })

      await persistEvaluationArtifacts(evaluationUserId, requestId, evaluation, {
        mode: "conversation_lab",
        contextKeys: Object.keys(context),
        tags
      })

      res.json({
        success: true,
        requestId,
        sessionId: evaluationUserId,
        response: responseText,
        evaluation,
        capabilities: {
          research: researchCapabilities
        }
      })
    } catch (error) {
      aiGateway.logger.error(requestId, "EVALUATION_CONVERSATION_FAILED", {
        error: getErrorMessage(error)
      })
      res.status(500).json(
        buildFailurePayload(error, "Falha ao avaliar conversa", "EVALUATION_FAILED", requestId)
      )
    }
  })

  app.post("/evaluation/run", requireAdmin, async (req, res) => {
    const benchmarkId = buildRequestId("benchmark")

    try {
      const body = normalizeObject(req.body)
      const packId = String(body.packId || "core_diagnostics")
      const benchmarkUserId = `${benchmarkId}_user`

      const benchmark = await runConversationBenchmark({
        packId,
        researchCapabilities: getResearchCapabilities(),
        requestTurn: async ({ scenario, turn, history }) => {
          const requestId = `bench_${scenario.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
          const scenarioUserId = `${benchmarkUserId}_${scenario.id}`
          const context = await buildRuntimeConversationContext(turn.question, {
            ...(turn.context || {}),
            userId: scenarioUserId,
            requestId,
            evaluationMode: true,
            evaluationScenario: scenario.id,
            conversationHistory: history
          })

          const answer = await askGiom(turn.question, context)
          return {
            answer,
            requestId,
            metadata: {
              scenarioUserId
            }
          }
        }
      })

      for (const turn of benchmark.turns) {
        const evaluationRequestId = turn.metadata?.requestId || `${benchmarkId}_${turn.scenarioId}`
        await persistEvaluationArtifacts(benchmarkUserId, evaluationRequestId, turn.evaluation, {
          mode: "benchmark_turn",
          packId,
          scenarioId: turn.scenarioId
        })
      }

      await grootMemoryConnector.saveLearningPattern(
        benchmarkUserId,
        "conversation_benchmark_summary",
        {
          benchmarkId,
          packId,
          summary: benchmark.summary,
          turns: benchmark.turns.map((turn) => ({
            scenarioId: turn.scenarioId,
            score: turn.evaluation.score,
            issues: turn.evaluation.issues
          }))
        },
        benchmark.summary.score
      )

      res.json({
        success: true,
        benchmarkId,
        sessionId: benchmarkUserId,
        ...benchmark
      })
    } catch (error) {
      aiGateway.logger.error(benchmarkId, "BENCHMARK_FAILED", {
        error: getErrorMessage(error)
      })
      res.status(500).json(
        buildFailurePayload(error, "Falha ao rodar benchmark do GIOM", "BENCHMARK_FAILED", benchmarkId)
      )
    }
  })

  app.post("/analyze", async (req, res) => {
    const requestId = buildRequestId("analyze")

    try {
      const body = normalizeObject(req.body)
      const code = String(body.code || "")
      const language = body.language
      const type = body.type || "general"

      if (!code) {
        return res.status(400).json({ error: "Codigo nao fornecido" })
      }

      const context = {
        fileInfo: {
          language,
          type
        },
        analysis: true
      }

      const question = `Analise este codigo ${language}: ${code.substring(0, 10000)}`
      const answer = await askGroot(question, context)

      res.json({
        analysis: answer,
        requestId,
        metadata: {
          codeLength: code.length,
          language,
          type
        }
      })
    } catch (error) {
      aiGateway.logger.error(requestId, "ANALYSIS_FAILED", { error: getErrorMessage(error) })
      res.status(500).json({ error: "Falha na analise" })
    }
  })

  app.post("/review", async (req, res) => {
    const requestId = buildRequestId("review")

    try {
      const body = normalizeObject(req.body)
      const code = String(body.code || "")
      const language = body.language
      const guidelines = normalizeArray(body.guidelines)

      if (!code) {
        return res.status(400).json({ error: "Codigo nao fornecido" })
      }

      const context = {
        fileInfo: {
          language,
          type: "review"
        },
        review: true,
        guidelines
      }

      const question = `Faca um code review deste codigo ${language}, seguindo estas diretrizes: ${guidelines.join(", ")}\n\nCodigo:\n${code}`
      const answer = await askGroot(question, context)

      res.json({
        review: answer,
        requestId,
        metadata: {
          codeLength: code.length,
          language,
          guidelinesCount: guidelines.length
        }
      })
    } catch (error) {
      aiGateway.logger.error(requestId, "REVIEW_FAILED", { error: getErrorMessage(error) })
      res.status(500).json({ error: "Falha no code review" })
    }
  })
}