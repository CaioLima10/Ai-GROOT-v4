function percentile(values = [], p = 95) {
  if (!Array.isArray(values) || values.length === 0) return 0
  const sorted = values.slice().sort((a, b) => a - b)
  const rank = Math.ceil((p / 100) * sorted.length) - 1
  const index = Math.max(0, Math.min(sorted.length - 1, rank))
  return sorted[index]
}

function mean(values = []) {
  if (!Array.isArray(values) || values.length === 0) return 0
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length
}

function buildHistogram(values = [], buckets = []) {
  const safeBuckets = Array.isArray(buckets)
    ? buckets.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
    : []
  const histogram = {}

  for (const bucket of safeBuckets) {
    histogram[String(bucket)] = 0
  }
  histogram["+Inf"] = 0

  for (const rawValue of values) {
    const value = Number(rawValue)
    if (!Number.isFinite(value)) continue
    let placed = false
    for (const bucket of safeBuckets) {
      if (value <= bucket) {
        histogram[String(bucket)] += 1
        placed = true
        break
      }
    }
    if (!placed) {
      histogram["+Inf"] += 1
    }
  }

  return histogram
}

function buildLatencyStats(values = [], buckets = []) {
  return {
    p50: percentile(values, 50),
    p75: percentile(values, 75),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
    mean: mean(values),
    histogram: buildHistogram(values, buckets)
  }
}

function buildPrometheusLines(snapshot, options = {}) {
  const lines = []
  const prefix = String(options.prefix || "giom_memory_context")
  const scope = String(options.scope || "local")
  const nodeId = String(snapshot?.node?.nodeId || options.nodeId || "unknown")
  const samples = Number(snapshot?.samples || 0)

  const addGauge = (name, help, value, labels = {}) => {
    const labelEntries = {
      node: nodeId,
      scope,
      ...labels
    }
    const labelText = Object.entries(labelEntries)
      .map(([key, val]) => `${key}="${String(val).replace(/"/g, '\\"')}"`)
      .join(",")
    lines.push(`# HELP ${name} ${help}`)
    lines.push(`# TYPE ${name} gauge`)
    lines.push(`${name}{${labelText}} ${Number(value || 0)}`)
  }

  const addHistogram = (metricName, help, histogram = {}, meanValue = 0) => {
    const buckets = Object.keys(histogram)
      .filter(bucket => bucket !== "+Inf")
      .map(Number)
      .filter(Number.isFinite)
      .sort((a, b) => a - b)

    lines.push(`# HELP ${metricName} ${help}`)
    lines.push(`# TYPE ${metricName} histogram`)

    let cumulative = 0
    for (const bucket of buckets) {
      cumulative += Number(histogram[String(bucket)] || 0)
      lines.push(`${metricName}_bucket{node="${nodeId}",scope="${scope}",le="${bucket}"} ${cumulative}`)
    }

    cumulative += Number(histogram["+Inf"] || 0)
    lines.push(`${metricName}_bucket{node="${nodeId}",scope="${scope}",le="+Inf"} ${cumulative}`)
    lines.push(`${metricName}_count{node="${nodeId}",scope="${scope}"} ${samples}`)
    lines.push(`${metricName}_sum{node="${nodeId}",scope="${scope}"} ${Number(meanValue || 0) * samples}`)
  }

  addGauge(`${prefix}_samples_total`, "Total rolling samples in memory context collector", samples)

  const latency = snapshot?.latency || {}
  for (const stage of ["retrievalMs", "semanticMs", "enrichMs", "totalMs"]) {
    const stats = latency?.[stage] || {}
    const stageLabel = stage.replace(/Ms$/, "")
    addGauge(`${prefix}_latency_p50_ms`, `P50 latency for ${stageLabel} stage`, stats.p50, { stage: stageLabel })
    addGauge(`${prefix}_latency_p75_ms`, `P75 latency for ${stageLabel} stage`, stats.p75, { stage: stageLabel })
    addGauge(`${prefix}_latency_p95_ms`, `P95 latency for ${stageLabel} stage`, stats.p95, { stage: stageLabel })
    addGauge(`${prefix}_latency_p99_ms`, `P99 latency for ${stageLabel} stage`, stats.p99, { stage: stageLabel })
    addGauge(`${prefix}_latency_mean_ms`, `Mean latency for ${stageLabel} stage`, stats.mean, { stage: stageLabel })

    if (stats?.histogram && typeof stats.histogram === "object") {
      addHistogram(
        `${prefix}_latency_${stageLabel}_ms`,
        `Latency histogram for ${stageLabel} stage in milliseconds`,
        stats.histogram,
        stats.mean
      )
    }
  }

  const throughput = snapshot?.throughput || {}
  addGauge(`${prefix}_candidate_count_avg`, "Average candidate count", throughput.candidateCountAvg)
  addGauge(`${prefix}_deduped_count_avg`, "Average deduped count", throughput.dedupedCountAvg)
  addGauge(`${prefix}_selected_turns_avg`, "Average selected turn count", throughput.selectedTurnsAvg)
  addGauge(`${prefix}_context_tokens_avg`, "Average context tokens", throughput.contextTokensAvg)
  addGauge(`${prefix}_fallback_rate`, "Fallback usage rate", throughput.fallbackRate)
  addGauge(`${prefix}_cache_hit_rate`, "Cache hit rate", throughput.cacheHitRate)

  const quality = snapshot?.quality || {}
  addGauge(`${prefix}_semantic_score_mean`, "Mean semantic score", quality?.semanticScore?.mean)
  addGauge(`${prefix}_retrieval_accuracy_proxy_mean`, "Mean retrieval accuracy proxy", quality?.retrievalAccuracyProxy?.mean)

  const slo = snapshot?.slo || {}
  addGauge(`${prefix}_slo_violation`, "SLO violation status (1=violation, 0=ok)", slo.state === "violation" ? 1 : 0)
  addGauge(`${prefix}_slo_alarm_count`, "Total SLO alarms", Array.isArray(slo.alarms) ? slo.alarms.length : 0)

  return `${lines.join("\n")}\n`
}

function countHistogramAtOrBelow(histogram = {}, threshold) {
  const numericThreshold = Number(threshold)
  if (!Number.isFinite(numericThreshold)) return 0
  return Object.entries(histogram).reduce((total, [bucket, count]) => {
    if (bucket === "+Inf") return total
    const bucketValue = Number(bucket)
    if (!Number.isFinite(bucketValue)) return total
    if (bucketValue <= numericThreshold) {
      return total + Number(count || 0)
    }
    return total
  }, 0)
}

function aggregateClusterLatency(perNode = [], field = "totalMs") {
  const aggregateHistogram = {}
  let sampleCount = 0
  let weightedMeanNumerator = 0
  let worstP95 = 0
  let worstP99 = 0

  for (const node of perNode) {
    const stats = node?.latency?.[field]
    if (!stats) continue

    worstP95 = Math.max(worstP95, Number(stats.p95 || 0))
    worstP99 = Math.max(worstP99, Number(stats.p99 || 0))

    const nodeSamples = Number(node?.samples || 0)
    sampleCount += nodeSamples
    weightedMeanNumerator += Number(stats.mean || 0) * nodeSamples

    const histogram = stats.histogram && typeof stats.histogram === "object" ? stats.histogram : {}
    for (const [bucket, count] of Object.entries(histogram)) {
      aggregateHistogram[bucket] = Number(aggregateHistogram[bucket] || 0) + Number(count || 0)
    }
  }

  return {
    worstP95,
    worstP99,
    weightedMean: sampleCount > 0 ? (weightedMeanNumerator / sampleCount) : 0,
    histogram: aggregateHistogram,
    sampleCount
  }
}

function buildSloReport({ latency = {}, slos = {}, samples = 0 }) {
  const retrievalP95BudgetMs = Number(slos.retrievalP95BudgetMs || 250)
  const totalP95BudgetMs = Number(slos.totalP95BudgetMs || 900)
  const totalP99MaxBudgetMs = Number(slos.totalP99MaxBudgetMs || 1800)

  const retrievalP95 = Number(latency?.retrievalMs?.p95 || 0)
  const totalP95 = Number(latency?.totalMs?.p95 || 0)
  const totalP99 = Number(latency?.totalMs?.p99 || 0)

  const alarms = []
  if (samples > 0 && retrievalP95 > retrievalP95BudgetMs) {
    alarms.push({
      metric: "retrievalMs.p95",
      value: retrievalP95,
      budget: retrievalP95BudgetMs,
      severity: "high"
    })
  }
  if (samples > 0 && totalP95 > totalP95BudgetMs) {
    alarms.push({
      metric: "totalMs.p95",
      value: totalP95,
      budget: totalP95BudgetMs,
      severity: "high"
    })
  }
  if (samples > 0 && totalP99 > totalP99MaxBudgetMs) {
    alarms.push({
      metric: "totalMs.p99",
      value: totalP99,
      budget: totalP99MaxBudgetMs,
      severity: "critical"
    })
  }

  const totalHistogram = latency?.totalMs?.histogram || {}
  const totalOnBudget = countHistogramAtOrBelow(totalHistogram, totalP95BudgetMs)
  const totalWithinBudgetRate = samples > 0 ? (totalOnBudget / samples) : 1

  return {
    budgets: {
      retrievalP95BudgetMs,
      totalP95BudgetMs,
      totalP99MaxBudgetMs
    },
    state: alarms.length > 0 ? "violation" : "ok",
    alarms,
    compliance: {
      totalWithinP95BudgetRate: totalWithinBudgetRate
    }
  }
}

export function createMemoryContextMetricsCollector(options = {}) {
  const maxSamples = Math.max(200, Number(options.maxSamples || process.env.MEMORY_METRICS_MAX_SAMPLES || 5000))
  const histogramBuckets = Array.isArray(options.histogramBuckets)
    ? options.histogramBuckets
    : [10, 25, 50, 75, 100, 150, 200, 300, 500, 800, 1200, 1800, 2500]
  const slos = {
    retrievalP95BudgetMs: Number(options?.slos?.retrievalP95BudgetMs || process.env.MEMORY_SLO_RETRIEVAL_P95_MS || 250),
    totalP95BudgetMs: Number(options?.slos?.totalP95BudgetMs || process.env.MEMORY_SLO_TOTAL_P95_MS || 900),
    totalP99MaxBudgetMs: Number(options?.slos?.totalP99MaxBudgetMs || process.env.MEMORY_SLO_TOTAL_P99_MS || 1800)
  }
  const distributedClient = options.distributedClient
  const distributedNodeId = String(options.nodeId || process.env.MEMORY_METRICS_NODE_ID || process.env.HOSTNAME || `node_${process.pid}`)
  const distributedFlushIntervalMs = Math.max(2_000, Number(options.distributedFlushIntervalMs || process.env.MEMORY_METRICS_FLUSH_MS || 5000))
  const distributedStaleMs = Math.max(10_000, Number(options.distributedStaleMs || process.env.MEMORY_METRICS_STALE_MS || 120_000))
  let lastDistributedFlushMs = 0
  const samples = []

  const pushSample = (sample) => {
    samples.push(sample)
    if (samples.length > maxSamples) {
      samples.splice(0, samples.length - maxSamples)
    }
  }

  return {
    record(input = {}) {
      const diagnostics = input?.diagnostics && typeof input.diagnostics === "object" ? input.diagnostics : {}
      const timings = diagnostics?.timings && typeof diagnostics.timings === "object" ? diagnostics.timings : {}
      const retrieval = diagnostics?.retrieval && typeof diagnostics.retrieval === "object" ? diagnostics.retrieval : {}
      const semantic = diagnostics?.semantic && typeof diagnostics.semantic === "object" ? diagnostics.semantic : {}

      pushSample({
        ts: Date.now(),
        trace: {
          requestId: String(input.requestId || ""),
          sessionId: String(input.sessionId || ""),
          payloadId: String(input.payloadId || ""),
          handlerId: String(input.handlerId || "")
        },
        route: String(input.route || "unknown"),
        cacheHit: Boolean(
          input?.cacheHit ??
          diagnostics?.cacheHit ??
          diagnostics?.retrieval?.cacheHit
        ),
        candidateCount: Number(diagnostics.candidateCount || 0),
        dedupedCount: Number(diagnostics.dedupedCount || 0),
        selectedTurns: Number(diagnostics.selectedTurns || 0),
        contextTokens: Number(diagnostics.contextTokens || 0),
        trimmedTurnsForBudget: Number(diagnostics?.budget?.trimmedTurnsForBudget || 0),
        appliedFallback: Boolean(diagnostics?.budget?.appliedFallback),
        semanticScoreMean: Number(semantic.meanSemanticScore || retrieval?.semantic?.meanSemanticScore || 0),
        retrievalAccuracyProxy: Number(semantic.retrievalAccuracyProxy || retrieval?.semantic?.retrievalAccuracyProxy || 0),
        timings: {
          stmFetchMs: Number(timings.stmFetchMs || 0),
          retrievalMs: Number(timings.retrievalMs || retrieval.retrievalMs || 0),
          semanticMs: Number(timings.semanticMs || retrieval.semanticMs || 0),
          enrichMs: Number(timings.enrichMs || 0),
          totalMs: Number(timings.totalMs || 0)
        }
      })

      if (distributedClient?.setJson && (Date.now() - lastDistributedFlushMs) >= distributedFlushIntervalMs) {
        lastDistributedFlushMs = Date.now()
        const payload = {
          nodeId: distributedNodeId,
          updatedAt: new Date().toISOString(),
          snapshot: this.snapshot()
        }
        void distributedClient.setJson(
          `metrics:memoryContext:node:${distributedNodeId}`,
          payload,
          Math.max(30, Math.floor(distributedStaleMs / 1000))
        ).catch(() => { })
      }
    },

    snapshot() {
      const retrievalValues = samples.map(sample => sample.timings.retrievalMs).filter(value => Number.isFinite(value))
      const semanticValues = samples.map(sample => sample.timings.semanticMs).filter(value => Number.isFinite(value))
      const enrichValues = samples.map(sample => sample.timings.enrichMs).filter(value => Number.isFinite(value))
      const totalValues = samples.map(sample => sample.timings.totalMs).filter(value => Number.isFinite(value))

      const semanticScoreValues = samples.map(sample => sample.semanticScoreMean).filter(value => Number.isFinite(value))
      const retrievalAccuracyValues = samples.map(sample => sample.retrievalAccuracyProxy).filter(value => Number.isFinite(value))

      const byRoute = samples.reduce((acc, sample) => {
        const route = sample.route || "unknown"
        if (!acc[route]) {
          acc[route] = {
            count: 0,
            p95TotalMs: 0,
            p99TotalMs: 0
          }
        }
        acc[route].count += 1
        return acc
      }, {})

      for (const route of Object.keys(byRoute)) {
        const routeTotals = samples
          .filter(sample => sample.route === route)
          .map(sample => sample.timings.totalMs)
          .filter(value => Number.isFinite(value))
        byRoute[route].p95TotalMs = percentile(routeTotals, 95)
        byRoute[route].p99TotalMs = percentile(routeTotals, 99)
      }

      const recentTraces = samples.slice(-25).map(sample => ({
        ts: sample.ts,
        route: sample.route,
        requestId: sample.trace.requestId,
        sessionId: sample.trace.sessionId,
        payloadId: sample.trace.payloadId,
        handlerId: sample.trace.handlerId,
        totalMs: sample.timings.totalMs,
        retrievalMs: sample.timings.retrievalMs,
        semanticMs: sample.timings.semanticMs,
        candidateCount: sample.candidateCount,
        dedupedCount: sample.dedupedCount,
        selectedTurns: sample.selectedTurns,
        semanticScoreMean: sample.semanticScoreMean,
        retrievalAccuracyProxy: sample.retrievalAccuracyProxy,
        contextTokens: sample.contextTokens,
        appliedFallback: sample.appliedFallback
      }))

      return {
        node: {
          nodeId: distributedNodeId
        },
        samples: samples.length,
        latency: {
          retrievalMs: buildLatencyStats(retrievalValues, histogramBuckets),
          semanticMs: buildLatencyStats(semanticValues, histogramBuckets),
          enrichMs: buildLatencyStats(enrichValues, histogramBuckets),
          totalMs: buildLatencyStats(totalValues, histogramBuckets)
        },
        quality: {
          semanticScore: {
            mean: mean(semanticScoreValues),
            p95: percentile(semanticScoreValues, 95)
          },
          retrievalAccuracyProxy: {
            mean: mean(retrievalAccuracyValues),
            p95: percentile(retrievalAccuracyValues, 95)
          }
        },
        throughput: {
          candidateCountAvg: mean(samples.map(sample => sample.candidateCount)),
          dedupedCountAvg: mean(samples.map(sample => sample.dedupedCount)),
          selectedTurnsAvg: mean(samples.map(sample => sample.selectedTurns)),
          contextTokensAvg: mean(samples.map(sample => sample.contextTokens)),
          cacheHitRate: samples.length === 0
            ? 0
            : (samples.filter(sample => sample.cacheHit).length / samples.length),
          fallbackRate: samples.length === 0
            ? 0
            : (samples.filter(sample => sample.appliedFallback).length / samples.length)
        },
        slo: buildSloReport({
          latency: {
            retrievalMs: buildLatencyStats(retrievalValues, histogramBuckets),
            totalMs: buildLatencyStats(totalValues, histogramBuckets)
          },
          slos,
          samples: samples.length
        }),
        byRoute,
        recentTraces
      }
    },

    async snapshotDistributed() {
      const local = this.snapshot()
      if (!distributedClient?.scanKeys || !distributedClient?.getJson) {
        return {
          ...local,
          cluster: {
            enabled: false,
            reason: "distributed_client_unavailable",
            nodes: {
              [distributedNodeId]: local
            }
          }
        }
      }

      const keys = await distributedClient.scanKeys("metrics:memoryContext:node:*", 200)
      const nowMs = Date.now()
      const nodes = {}

      for (const key of keys) {
        const payload = await distributedClient.getJson(key)
        const nodeId = String(payload?.nodeId || key.split(":").pop() || "unknown")
        const updatedAtMs = Date.parse(String(payload?.updatedAt || ""))
        if (!Number.isFinite(updatedAtMs)) continue
        if ((nowMs - updatedAtMs) > distributedStaleMs) continue
        if (payload?.snapshot && typeof payload.snapshot === "object") {
          nodes[nodeId] = payload.snapshot
        }
      }

      nodes[distributedNodeId] = local

      const perNode = Object.values(nodes)
      const totalSamples = perNode.reduce((sum, node) => sum + Number(node?.samples || 0), 0)
      const aggTotal = aggregateClusterLatency(perNode, "totalMs")
      const aggRetrieval = aggregateClusterLatency(perNode, "retrievalMs")

      return {
        ...local,
        cluster: {
          enabled: true,
          nodeCount: Object.keys(nodes).length,
          totalSamples,
          totalMs: {
            weightedMean: aggTotal.weightedMean,
            worstP95: aggTotal.worstP95,
            worstP99: aggTotal.worstP99,
            histogram: aggTotal.histogram
          },
          retrievalMs: {
            weightedMean: aggRetrieval.weightedMean,
            worstP95: aggRetrieval.worstP95,
            worstP99: aggRetrieval.worstP99,
            histogram: aggRetrieval.histogram
          },
          nodes
        }
      }
    },

    async exportPrometheus({ includeDistributed = false } = {}) {
      const snapshot = includeDistributed
        ? await this.snapshotDistributed()
        : this.snapshot()

      const localProm = buildPrometheusLines(snapshot, {
        prefix: "giom_memory_context",
        scope: includeDistributed ? "distributed_local" : "local"
      })

      if (!includeDistributed || !snapshot?.cluster?.enabled) {
        return localProm
      }

      const clusterLines = []
      const nodes = snapshot?.cluster?.nodes && typeof snapshot.cluster.nodes === "object"
        ? snapshot.cluster.nodes
        : {}

      for (const [nodeId, nodeSnapshot] of Object.entries(nodes)) {
        const scoped = {
          ...nodeSnapshot,
          node: {
            nodeId
          }
        }
        clusterLines.push(buildPrometheusLines(scoped, {
          prefix: "giom_memory_context",
          scope: "distributed_node"
        }))
      }

      return `${localProm}${clusterLines.join("\n")}`
    }
  }
}
