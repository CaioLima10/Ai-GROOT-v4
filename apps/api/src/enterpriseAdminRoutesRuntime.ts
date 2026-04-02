import type { Express, RequestHandler } from "express"

type MetricsLike = {
  exportMetrics: (format: string) => string
  getSummary: () => unknown
  getProviderStats: () => unknown
  getErrorSummary: () => unknown
  getTopUsers: (limit: number) => unknown
}

type LoggerLike = {
  getLogs: (filter: Record<string, unknown>) => unknown
  getLogSummary: () => unknown
}

type AiGatewayLike = {
  metrics: MetricsLike
  logger: LoggerLike
}

type HealthSnapshotInput = {
  aiGateway: AiGatewayLike
  grootAdvancedRAG: unknown
  service: string
  version: string
}

type MemoryContextMetricsLike = {
  exportPrometheus: (input: { includeDistributed: boolean }) => Promise<string>
  snapshotDistributed: () => Promise<unknown>
  snapshot: () => unknown
}

type EnterpriseAdminRouteDeps = {
  requireAdmin: RequestHandler
  buildHealthSnapshot: (input: HealthSnapshotInput) => Promise<unknown>
  aiGateway: AiGatewayLike
  grootAdvancedRAG: unknown
  AI_SERVICE_SLUG: string
  memoryContextMetrics: MemoryContextMetricsLike
  memoryMetricsNodeId: string
  getLanguageRuntimeStatus: () => Promise<Record<string, unknown>>
  cleanupLanguageRuntimeCache: () => Promise<unknown>
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function buildLanguageRuntimeErrorPayload(error: unknown, publicMessage: string, code: string) {
  return {
    success: false,
    error: publicMessage,
    details: process.env.NODE_ENV === "development" ? getErrorMessage(error) : undefined,
    code
  }
}

export function registerEnterpriseAdminRoutes(app: Express, deps: EnterpriseAdminRouteDeps) {
  const {
    requireAdmin,
    buildHealthSnapshot,
    aiGateway,
    grootAdvancedRAG,
    AI_SERVICE_SLUG,
    memoryContextMetrics,
    memoryMetricsNodeId,
    getLanguageRuntimeStatus,
    cleanupLanguageRuntimeCache
  } = deps

  app.get("/health", async (_req, res) => {
    try {
      const snapshot = await buildHealthSnapshot({
        aiGateway,
        grootAdvancedRAG,
        service: AI_SERVICE_SLUG,
        version: "2.0.0"
      })
      res.json(snapshot)
    } catch (error) {
      res.status(503).json({
        status: "unhealthy",
        error: getErrorMessage(error)
      })
    }
  })

  app.get("/metrics", requireAdmin, async (_req, res) => {
    try {
      const metrics = aiGateway.metrics.exportMetrics("prometheus")
      res.set("Content-Type", "text/plain")
      res.send(metrics)
    } catch {
      res.status(500).json({ error: "Failed to get metrics" })
    }
  })

  app.get("/metrics/json", requireAdmin, (_req, res) => {
    try {
      res.json({
        summary: aiGateway.metrics.getSummary(),
        providers: aiGateway.metrics.getProviderStats(),
        errors: aiGateway.metrics.getErrorSummary(),
        topUsers: aiGateway.metrics.getTopUsers(5)
      })
    } catch {
      res.status(500).json({ error: "Failed to get metrics" })
    }
  })

  app.get("/metrics/memoryContext", requireAdmin, async (req, res) => {
    try {
      const includeDistributed = String(req.query.includeDistributed || "false").toLowerCase() === "true"
      const format = String(req.query.format || "json").toLowerCase()

      if (format === "prometheus") {
        const metricsText = await memoryContextMetrics.exportPrometheus({ includeDistributed })
        res.set("Content-Type", "text/plain; version=0.0.4")
        return res.send(metricsText)
      }

      const snapshot = includeDistributed
        ? await memoryContextMetrics.snapshotDistributed()
        : memoryContextMetrics.snapshot()

      res.json({
        success: true,
        distributed: includeDistributed,
        nodeId: memoryMetricsNodeId,
        memoryContext: snapshot
      })
    } catch {
      res.status(500).json({ error: "Failed to get memory context metrics" })
    }
  })

  app.get("/logs", requireAdmin, (req, res) => {
    try {
      const filter: Record<string, unknown> = {
        level: req.query.level,
        requestId: req.query.requestId,
        event: req.query.event,
        since: req.query.since,
        until: req.query.until
      }

      const logs = aiGateway.logger.getLogs(filter)
      res.json({ logs, summary: aiGateway.logger.getLogSummary() })
    } catch {
      res.status(500).json({ error: "Failed to get logs" })
    }
  })

  app.get("/admin", requireAdmin, (_req, res) => {
    res.json({
      service: AI_SERVICE_SLUG,
      admin: true,
      note: "UI de admin legada removida do runtime oficial. Use /metrics, /metrics/json, /logs e /runtime/language/status.",
      endpoints: {
        health: "/health",
        metrics: "/metrics",
        metricsJson: "/metrics/json",
        memoryContextMetrics: "/metrics/memoryContext",
        logs: "/logs",
        languageRuntimeStatus: "/runtime/language/status",
        languageRuntimeCleanup: "/runtime/language/cache/cleanup"
      }
    })
  })

  app.get("/runtime/language/status", requireAdmin, async (_req, res) => {
    try {
      const status = await getLanguageRuntimeStatus()
      res.json({
        success: true,
        runtime: "language",
        ...status
      })
    } catch (error) {
      res.status(500).json(
        buildLanguageRuntimeErrorPayload(
          error,
          "Falha ao consultar status do language runtime",
          "LANGUAGE_RUNTIME_STATUS_FAILED"
        )
      )
    }
  })

  app.post("/runtime/language/cache/cleanup", requireAdmin, async (_req, res) => {
    try {
      const cleanup = await cleanupLanguageRuntimeCache()
      const status = await getLanguageRuntimeStatus()
      res.json({
        success: true,
        runtime: "language",
        cleanup,
        ...status
      })
    } catch (error) {
      res.status(500).json(
        buildLanguageRuntimeErrorPayload(
          error,
          "Falha ao limpar cache do language runtime",
          "LANGUAGE_RUNTIME_CACHE_CLEANUP_FAILED"
        )
      )
    }
  })
}