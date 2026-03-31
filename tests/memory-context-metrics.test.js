import assert from "node:assert/strict"
import test from "node:test"

import { createMemoryContextMetricsCollector } from "../backend/src/application/monitoring/memoryContextMetrics.js"

test("memory context metrics collector computes p95/p99 and route traces", () => {
  const collector = createMemoryContextMetricsCollector({ maxSamples: 300 })

  for (let i = 1; i <= 100; i += 1) {
    collector.record({
      route: i % 2 === 0 ? "ask" : "ask_stream",
      requestId: `req_${i}`,
      sessionId: `s_${Math.ceil(i / 5)}`,
      payloadId: `payload_${i}`,
      handlerId: i % 2 === 0 ? "deterministic" : "streaming",
      diagnostics: {
        candidateCount: 20 + i,
        dedupedCount: 10 + i,
        selectedTurns: 8,
        contextTokens: 280,
        budget: {
          appliedFallback: i % 10 === 0
        },
        semantic: {
          meanSemanticScore: i / 100,
          retrievalAccuracyProxy: i / 100
        },
        timings: {
          retrievalMs: i,
          semanticMs: i + 10,
          enrichMs: i + 20,
          totalMs: i + 30
        }
      }
    })
  }

  const snapshot = collector.snapshot()

  assert.equal(snapshot.samples, 100)
  assert.equal(snapshot.latency.retrievalMs.p50, 50)
  assert.equal(snapshot.latency.retrievalMs.p75, 75)
  assert.equal(snapshot.latency.retrievalMs.p95, 95)
  assert.equal(snapshot.latency.retrievalMs.p99, 99)
  assert.equal(typeof snapshot.latency.retrievalMs.histogram["100"], "number")
  assert.equal(snapshot.byRoute.ask.count, 50)
  assert.equal(snapshot.byRoute.ask_stream.count, 50)
  assert.equal(typeof snapshot.quality.retrievalAccuracyProxy.mean, "number")
  assert.ok(snapshot.throughput.fallbackRate > 0)
  assert.equal(snapshot.slo.state, "ok")
  assert.ok(Array.isArray(snapshot.recentTraces))
  assert.ok(snapshot.recentTraces.length > 0)

  const last = snapshot.recentTraces[snapshot.recentTraces.length - 1]
  assert.equal(last.requestId, "req_100")
  assert.equal(last.payloadId, "payload_100")
})

test("memory context metrics collector triggers SLO violations", () => {
  const collector = createMemoryContextMetricsCollector({
    maxSamples: 300,
    slos: {
      retrievalP95BudgetMs: 40,
      totalP95BudgetMs: 80,
      totalP99MaxBudgetMs: 100
    }
  })

  for (let i = 0; i < 30; i += 1) {
    collector.record({
      route: "ask",
      diagnostics: {
        timings: {
          retrievalMs: 60 + i,
          totalMs: 120 + i
        }
      }
    })
  }

  const snapshot = collector.snapshot()
  assert.equal(snapshot.slo.state, "violation")
  assert.ok(snapshot.slo.alarms.length >= 2)
})

test("memory context metrics collector exports prometheus text", async () => {
  const collector = createMemoryContextMetricsCollector({ maxSamples: 300 })

  for (let i = 0; i < 10; i += 1) {
    collector.record({
      route: "ask",
      diagnostics: {
        cacheHit: i % 2 === 0,
        timings: {
          retrievalMs: 20 + i,
          semanticMs: 10 + i,
          enrichMs: 30 + i,
          totalMs: 50 + i
        }
      }
    })
  }

  const text = await collector.exportPrometheus()
  assert.ok(text.includes("# HELP giom_memory_context_samples_total"))
  assert.ok(text.includes("giom_memory_context_latency_retrieval_ms_bucket"))
  assert.ok(text.includes("giom_memory_context_slo_violation"))
})
