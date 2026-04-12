import { randomUUID } from "crypto"

function buildRuntimeId(prefix = "rt") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function sanitizeScalar(value) {
  if (value == null) return value
  if (typeof value === "string") {
    return value.length > 240 ? `${value.slice(0, 237)}...` : value
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value
  }
  return String(value)
}

function sanitizeMetadata(value, depth = 0) {
  if (depth > 2) {
    return "[depth_limit]"
  }

  if (value == null) {
    return value
  }

  if (Array.isArray(value)) {
    return value.slice(0, 8).map((entry) => sanitizeMetadata(entry, depth + 1))
  }

  if (typeof value === "object") {
    const entries = Object.entries(value).slice(0, 16)
    return entries.reduce((acc, [key, entryValue]) => {
      acc[key] = sanitizeMetadata(entryValue, depth + 1)
      return acc
    }, {})
  }

  return sanitizeScalar(value)
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function getErrorCode(error) {
  if (error && typeof error === "object" && "code" in error && error.code) {
    return String(error.code)
  }
  return null
}

function pushBounded(store, entry, maxItems) {
  store.push(entry)
  if (store.length > maxItems) {
    store.splice(0, store.length - maxItems)
  }
}

function resolveLogMethod(statusCode) {
  if (statusCode >= 500) return "error"
  if (statusCode >= 400) return "warn"
  return "info"
}

function filterTraceEntry(entry, filter = {}) {
  const requestId = String(filter.requestId || "").trim()
  const status = String(filter.status || "").trim().toLowerCase()
  const kind = String(filter.kind || "").trim().toLowerCase()
  const event = String(filter.event || "").trim().toLowerCase()

  if (requestId && String(entry.requestId || "") !== requestId) {
    return false
  }

  if (status && String(entry.status || "").toLowerCase() !== status) {
    return false
  }

  if (kind && String(entry.kind || "").toLowerCase() !== kind) {
    return false
  }

  if (event && !String(entry.name || entry.event || "").toLowerCase().includes(event)) {
    return false
  }

  return true
}

export function createEnterpriseTraceStore(options = {}) {
  const requestTraces = []
  const operationTraces = []
  const maxRequestTraces = Math.max(50, Number(options.maxRequestTraces || 500))
  const maxOperationTraces = Math.max(100, Number(options.maxOperationTraces || 1_500))
  const logger = options.logger || null
  const service = String(options.service || "giom").trim() || "giom"
  const version = String(options.version || process.env.npm_package_version || "1.0.0").trim()

  function buildRequestTraceContext(req) {
    const incomingRequestId = req.get("X-Request-Id") || req.get("X-Correlation-Id")
    const incomingTraceId = req.get("X-Trace-Id")
    const requestId = String(incomingRequestId || buildRuntimeId("req")).trim()
    const traceId = String(incomingTraceId || randomUUID()).trim()
    const startedAtMs = Date.now()
    const startedAt = new Date(startedAtMs).toISOString()

    return {
      kind: "http",
      id: buildRuntimeId("http"),
      requestId,
      traceId,
      service,
      version,
      method: String(req.method || "GET").toUpperCase(),
      path: String(req.originalUrl || req.url || "/"),
      routePath: String(req.path || req.originalUrl || req.url || "/"),
      ip: req.ip || req.socket?.remoteAddress || null,
      userId: req.get("X-User-Id") || null,
      userAgent: req.get("user-agent") || null,
      startedAt,
      startedAtMs
    }
  }

  function createRequestMiddleware() {
    return (req, res, next) => {
      const context = buildRequestTraceContext(req)
      req.giomTrace = context
      res.locals.giomTrace = context
      res.setHeader("X-Request-Id", context.requestId)
      res.setHeader("X-Trace-Id", context.traceId)

      logger?.info?.(context.requestId, "HTTP_REQUEST_STARTED", {
        traceId: context.traceId,
        method: context.method,
        path: context.path
      })

      let finalized = false
      const finalize = () => {
        if (finalized) {
          return
        }

        finalized = true
        const endedAtMs = Date.now()
        const statusCode = Number(res.statusCode || 200) || 200
        const entry = {
          ...context,
          status: statusCode >= 500 ? "error" : "ok",
          statusCode,
          durationMs: endedAtMs - context.startedAtMs,
          endedAt: new Date(endedAtMs).toISOString(),
          contentLength: Number(res.getHeader("content-length") || 0) || null
        }

        pushBounded(requestTraces, entry, maxRequestTraces)
        const logMethod = resolveLogMethod(statusCode)
        logger?.[logMethod]?.(context.requestId, "HTTP_REQUEST_COMPLETED", {
          traceId: context.traceId,
          method: context.method,
          path: context.path,
          statusCode,
          durationMs: entry.durationMs
        })
      }

      res.on("finish", finalize)
      res.on("close", finalize)
      next()
    }
  }

  async function withTrace(options = {}, executor) {
    const requestId = String(options.requestId || "runtime_trace").trim() || "runtime_trace"
    const traceId = String(options.traceId || randomUUID()).trim()
    const name = String(options.name || options.event || "runtime.operation").trim() || "runtime.operation"
    const kind = String(options.kind || "operation").trim() || "operation"
    const timeoutMs = Math.max(100, Number(options.timeoutMs || 5_000))
    const metadata = sanitizeMetadata(options.metadata || {})
    const startedAtMs = Date.now()
    const startedAt = new Date(startedAtMs).toISOString()
    const controller = new AbortController()
    const spanId = buildRuntimeId("span")
    let timer = null

    try {
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          const timeoutError = new Error(`Timeout ao executar ${name}`)
          timeoutError.code = "TRACE_TIMEOUT"
          timeoutError.statusCode = 504
          reject(timeoutError)
        }, timeoutMs)
      })

      const result = await Promise.race([
        Promise.resolve().then(() => executor({
          requestId,
          traceId,
          spanId,
          signal: controller.signal,
          timeoutMs
        })),
        timeoutPromise
      ])

      const endedAtMs = Date.now()
      const entry = {
        kind,
        id: buildRuntimeId("trace"),
        requestId,
        traceId,
        spanId,
        name,
        service,
        version,
        status: "ok",
        metadata,
        durationMs: endedAtMs - startedAtMs,
        startedAt,
        endedAt: new Date(endedAtMs).toISOString(),
        resultSummary: sanitizeMetadata(options.resultSummary ?? result)
      }

      pushBounded(operationTraces, entry, maxOperationTraces)
      logger?.info?.(requestId, "TRACE_OPERATION_COMPLETED", {
        traceId,
        spanId,
        name,
        kind,
        durationMs: entry.durationMs
      })

      return result
    } catch (error) {
      const endedAtMs = Date.now()
      const entry = {
        kind,
        id: buildRuntimeId("trace"),
        requestId,
        traceId,
        spanId,
        name,
        service,
        version,
        status: "error",
        metadata,
        durationMs: endedAtMs - startedAtMs,
        startedAt,
        endedAt: new Date(endedAtMs).toISOString(),
        error: {
          message: getErrorMessage(error),
          code: getErrorCode(error)
        }
      }

      pushBounded(operationTraces, entry, maxOperationTraces)
      logger?.error?.(requestId, "TRACE_OPERATION_FAILED", {
        traceId,
        spanId,
        name,
        kind,
        durationMs: entry.durationMs,
        error: entry.error.message,
        code: entry.error.code
      })

      throw error
    } finally {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }

  function getRequestContext(req) {
    return req?.giomTrace || null
  }

  function getRecentTraces(filter = {}) {
    const limit = Math.max(1, Math.min(Number(filter.limit || 50) || 50, 200))
    const combined = [
      ...requestTraces,
      ...operationTraces
    ]

    return combined
      .filter((entry) => filterTraceEntry(entry, filter))
      .sort((left, right) => Number(right.startedAtMs || Date.parse(right.startedAt || 0)) - Number(left.startedAtMs || Date.parse(left.startedAt || 0)))
      .slice(0, limit)
  }

  function getSummary() {
    const combined = [...requestTraces, ...operationTraces]
    const summary = {
      service,
      version,
      requests: {
        total: requestTraces.length,
        errors: requestTraces.filter((entry) => entry.status === "error").length
      },
      operations: {
        total: operationTraces.length,
        errors: operationTraces.filter((entry) => entry.status === "error").length
      },
      slowest: [],
      recentErrors: []
    }

    summary.slowest = combined
      .slice()
      .sort((left, right) => Number(right.durationMs || 0) - Number(left.durationMs || 0))
      .slice(0, 10)
      .map((entry) => ({
        kind: entry.kind,
        name: entry.name || entry.path,
        requestId: entry.requestId,
        traceId: entry.traceId,
        durationMs: entry.durationMs,
        status: entry.status
      }))

    summary.recentErrors = combined
      .filter((entry) => entry.status === "error")
      .slice()
      .sort((left, right) => Date.parse(right.endedAt || right.startedAt || 0) - Date.parse(left.endedAt || left.startedAt || 0))
      .slice(0, 10)
      .map((entry) => ({
        kind: entry.kind,
        name: entry.name || entry.path,
        requestId: entry.requestId,
        traceId: entry.traceId,
        durationMs: entry.durationMs,
        error: entry.error?.message || `HTTP ${entry.statusCode || 500}`
      }))

    return summary
  }

  return {
    createRequestMiddleware,
    getRecentTraces,
    getRequestContext,
    getSummary,
    withTrace
  }
}
