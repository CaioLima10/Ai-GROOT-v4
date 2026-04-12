function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function buildLanguageRuntimeErrorPayload(error, publicMessage, code) {
  return {
    success: false,
    error: publicMessage,
    details: process.env.NODE_ENV === "development" ? getErrorMessage(error) : undefined,
    code
  }
}

export function registerEnterpriseAdminRoutes(app, deps) {
  const {
    requireAdmin,
    buildHealthSnapshot,
    aiGateway,
    grootAdvancedRAG,
    AI_SERVICE_SLUG,
    memoryContextMetrics,
    memoryMetricsNodeId,
    getLanguageRuntimeStatus,
    cleanupLanguageRuntimeCache,
    traceStore,
    toolRegistry,
    jobManager,
    voiceRuntime,
    longMemoryRuntime,
    localVoiceRuntime
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
      const filter = {
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

  app.get("/runtime/traces/recent", requireAdmin, (req, res) => {
    try {
      res.json({
        success: true,
        traces: traceStore.getRecentTraces({
          limit: req.query.limit,
          requestId: req.query.requestId,
          status: req.query.status,
          kind: req.query.kind,
          event: req.query.event
        })
      })
    } catch {
      res.status(500).json({ error: "Failed to get recent traces" })
    }
  })

  app.get("/runtime/traces/summary", requireAdmin, (_req, res) => {
    try {
      res.json({
        success: true,
        summary: traceStore.getSummary()
      })
    } catch {
      res.status(500).json({ error: "Failed to get trace summary" })
    }
  })

  app.get("/runtime/tools", requireAdmin, (_req, res) => {
    try {
      res.json({
        success: true,
        tools: toolRegistry.listTools(),
        summary: toolRegistry.getSummary(),
        recentExecutions: toolRegistry.getRecentExecutions(25)
      })
    } catch {
      res.status(500).json({ error: "Failed to get tool registry state" })
    }
  })

  app.get("/runtime/jobs", requireAdmin, (req, res) => {
    try {
      res.json({
        success: true,
        summary: jobManager.getSummary(),
        jobs: jobManager.listJobs({
          limit: req.query.limit,
          status: req.query.status,
          type: req.query.type,
          ownerKey: req.query.ownerKey
        })
      })
    } catch {
      res.status(500).json({ error: "Failed to get async jobs" })
    }
  })

  app.get("/runtime/jobs/:jobId", requireAdmin, (req, res) => {
    try {
      const job = jobManager.getJob(req.params.jobId, { includePayload: true })
      if (!job) {
        return res.status(404).json({ success: false, error: "Job not found", code: "JOB_NOT_FOUND" })
      }

      res.json({
        success: true,
        job
      })
    } catch {
      res.status(500).json({ error: "Failed to get async job" })
    }
  })

  app.get("/runtime/voice/sessions", requireAdmin, (req, res) => {
    try {
      res.json({
        success: true,
        summary: voiceRuntime.getSummary(),
        providers: localVoiceRuntime?.getStatus?.() || null,
        sessions: voiceRuntime.listSessions(Number(req.query.limit || 50) || 50)
      })
    } catch {
      res.status(500).json({ error: "Failed to get realtime voice sessions" })
    }
  })

  app.get("/runtime/memory/summary", requireAdmin, (_req, res) => {
    try {
      res.json({
        success: true,
        summary: longMemoryRuntime.getSummary(),
        recentCompactions: longMemoryRuntime.getRecentCompactions(25)
      })
    } catch {
      res.status(500).json({ error: "Failed to get long memory summary" })
    }
  })

  app.get("/runtime/memory/profiles", requireAdmin, (req, res) => {
    try {
      res.json({
        success: true,
        profiles: longMemoryRuntime.listRecentProfiles(req.query.limit || 25)
      })
    } catch {
      res.status(500).json({ error: "Failed to get long memory profiles" })
    }
  })

  app.get("/runtime/memory/sessions", requireAdmin, (req, res) => {
    try {
      res.json({
        success: true,
        sessions: longMemoryRuntime.listRecentSessions(req.query.limit || 25)
      })
    } catch {
      res.status(500).json({ error: "Failed to get long memory sessions" })
    }
  })

  app.get("/admin", requireAdmin, (_req, res) => {
    res.json({
      service: AI_SERVICE_SLUG,
      admin: true,
      note: "UI de admin legada removida do runtime oficial. Use /metrics, /metrics/json, /logs, /runtime/traces/*, /runtime/tools, /runtime/jobs, /runtime/voice/sessions, /runtime/memory/* e /runtime/language/status.",
      endpoints: {
        health: "/health",
        metrics: "/metrics",
        metricsJson: "/metrics/json",
        memoryContextMetrics: "/metrics/memoryContext",
        logs: "/logs",
        traceSummary: "/runtime/traces/summary",
        tracesRecent: "/runtime/traces/recent",
        tools: "/runtime/tools",
        jobs: "/runtime/jobs",
        voiceSessions: "/runtime/voice/sessions",
        longMemorySummary: "/runtime/memory/summary",
        longMemoryProfiles: "/runtime/memory/profiles",
        longMemorySessions: "/runtime/memory/sessions",
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
