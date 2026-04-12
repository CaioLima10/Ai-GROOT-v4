function buildRuntimeId(prefix = "job") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function sanitizeValue(value, depth = 0) {
  if (depth > 2) {
    return "[depth_limit]"
  }

  if (value == null) {
    return value
  }

  if (typeof value === "string") {
    return value.length > 240 ? `${value.slice(0, 237)}...` : value
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value
  }

  if (Array.isArray(value)) {
    return value.slice(0, 10).map((entry) => sanitizeValue(entry, depth + 1))
  }

  if (typeof value === "object") {
    return Object.entries(value).slice(0, 16).reduce((acc, [key, entry]) => {
      acc[key] = sanitizeValue(entry, depth + 1)
      return acc
    }, {})
  }

  return String(value)
}

function pushBoundedJobs(map, maxJobs) {
  if (map.size <= maxJobs) {
    return
  }

  const removable = Array.from(map.values())
    .filter((job) => job.status === "done" || job.status === "failed")
    .sort((left, right) => Date.parse(left.updatedAt || left.createdAt || 0) - Date.parse(right.updatedAt || right.createdAt || 0))

  while (map.size > maxJobs && removable.length > 0) {
    const job = removable.shift()
    map.delete(job.jobId)
  }
}

function toPublicJob(job, options = {}) {
  if (!job) return null

  const includeResult = options.includeResult !== false
  const includePayload = options.includePayload === true

  return {
    jobId: job.jobId,
    type: job.type,
    status: job.status,
    requestId: job.requestId,
    ownerKey: job.ownerKey,
    metadata: job.metadata || null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt || null,
    finishedAt: job.finishedAt || null,
    durationMs: job.durationMs || null,
    error: job.error || null,
    payload: includePayload ? sanitizeValue(job.payload) : undefined,
    result: includeResult ? job.result ?? null : undefined
  }
}

export function createEnterpriseJobManager(options = {}) {
  const jobs = new Map()
  const queue = []
  const concurrency = Math.max(1, Number(options.concurrency || 2))
  const maxJobs = Math.max(50, Number(options.maxJobs || 500))
  const logger = options.logger || null
  const traceStore = options.traceStore || null
  let activeJobs = 0

  async function processNext() {
    if (activeJobs >= concurrency) {
      return
    }

    const jobId = queue.shift()
    if (!jobId) {
      return
    }

    const job = jobs.get(jobId)
    if (!job || job.status !== "queued") {
      return processNext()
    }

    activeJobs += 1
    const startedAtMs = Date.now()
    job.status = "running"
    job.startedAt = new Date(startedAtMs).toISOString()
    job.updatedAt = job.startedAt

    try {
      const result = traceStore
        ? await traceStore.withTrace({
          requestId: job.requestId,
          traceId: job.traceId,
          kind: "job",
          name: `job:${job.type}`,
          timeoutMs: job.timeoutMs,
          metadata: {
            jobId: job.jobId,
            type: job.type
          }
        }, ({ signal }) => job.handler({
          jobId: job.jobId,
          requestId: job.requestId,
          ownerKey: job.ownerKey,
          signal
        }))
        : await job.handler({
          jobId: job.jobId,
          requestId: job.requestId,
          ownerKey: job.ownerKey,
          signal: null
        })

      const finishedAtMs = Date.now()
      job.status = "done"
      job.result = result
      job.durationMs = finishedAtMs - startedAtMs
      job.finishedAt = new Date(finishedAtMs).toISOString()
      job.updatedAt = job.finishedAt
      logger?.info?.(job.requestId, "ASYNC_JOB_COMPLETED", {
        jobId: job.jobId,
        type: job.type,
        durationMs: job.durationMs
      })
    } catch (error) {
      const finishedAtMs = Date.now()
      job.status = "failed"
      job.error = {
        message: getErrorMessage(error),
        code: error?.code || null
      }
      job.durationMs = finishedAtMs - startedAtMs
      job.finishedAt = new Date(finishedAtMs).toISOString()
      job.updatedAt = job.finishedAt
      logger?.error?.(job.requestId, "ASYNC_JOB_FAILED", {
        jobId: job.jobId,
        type: job.type,
        durationMs: job.durationMs,
        error: job.error.message,
        code: job.error.code
      })
    } finally {
      activeJobs -= 1
      pushBoundedJobs(jobs, maxJobs)
      void processNext()
    }
  }

  function enqueue(definition = {}) {
    const jobId = buildRuntimeId("job")
    const now = new Date().toISOString()
    const job = {
      jobId,
      traceId: definition.traceId || null,
      requestId: String(definition.requestId || buildRuntimeId("jobreq")).trim(),
      ownerKey: String(definition.ownerKey || "system").trim() || "system",
      type: String(definition.type || "generic").trim() || "generic",
      metadata: sanitizeValue(definition.metadata || {}),
      payload: definition.payload || null,
      handler: definition.handler,
      timeoutMs: Math.max(100, Number(definition.timeoutMs || 60_000)),
      status: "queued",
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      result: null,
      error: null
    }

    if (typeof job.handler !== "function") {
      throw new Error("Async job handler is required")
    }

    jobs.set(jobId, job)
    queue.push(jobId)
    logger?.info?.(job.requestId, "ASYNC_JOB_QUEUED", {
      jobId,
      type: job.type
    })
    void processNext()

    return toPublicJob(job, { includeResult: false })
  }

  function getJob(jobId, options = {}) {
    return toPublicJob(jobs.get(String(jobId || "").trim()), options)
  }

  function getInternalJob(jobId) {
    return jobs.get(String(jobId || "").trim()) || null
  }

  function listJobs(filter = {}) {
    const status = String(filter.status || "").trim().toLowerCase()
    const type = String(filter.type || "").trim().toLowerCase()
    const ownerKey = String(filter.ownerKey || "").trim()
    const limit = Math.max(1, Math.min(Number(filter.limit || 50) || 50, 200))

    return Array.from(jobs.values())
      .filter((job) => {
        if (status && String(job.status || "").toLowerCase() !== status) {
          return false
        }
        if (type && String(job.type || "").toLowerCase() !== type) {
          return false
        }
        if (ownerKey && String(job.ownerKey || "") !== ownerKey) {
          return false
        }
        return true
      })
      .sort((left, right) => Date.parse(right.updatedAt || right.createdAt || 0) - Date.parse(left.updatedAt || left.createdAt || 0))
      .slice(0, limit)
      .map((job) => toPublicJob(job))
  }

  function getSummary() {
    const values = Array.from(jobs.values())
    return {
      queued: values.filter((job) => job.status === "queued").length,
      running: values.filter((job) => job.status === "running").length,
      done: values.filter((job) => job.status === "done").length,
      failed: values.filter((job) => job.status === "failed").length,
      total: values.length,
      concurrency,
      activeJobs
    }
  }

  return {
    enqueue,
    getInternalJob,
    getJob,
    getSummary,
    listJobs
  }
}
