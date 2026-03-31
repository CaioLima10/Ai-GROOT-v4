# ✅ GIOM Production Checklist – Big Tech Level

Complete validation matrix for deploying GIOM with unified Decision Router, semantic memory engine, distributed Redis cache, and Prometheus observability to production.

---

## 1️⃣ Deploy & Runtime

- [ ] **Build Updated**
  - `npm run build:api-ts` completes without errors
  - All TypeScript transpiled to JavaScript
  - Distribution artifacts ready in `dist/` or equivalent

- [ ] **Environment Configuration**
  - `PORT` set (default 3010)
  - `REDIS_URL` configured for single-node OR
  - `REDIS_CLUSTER_URLS` configured for cluster mode
  - `GIOM_BASE_URL` matches deployment domain
  - `MEMORY_BUDGET` set per environment (tokens per request)
  - `MAX_RETRIEVED_ITEMS` tuned for retrieval pool size

- [ ] **Runtime Startup**
  - `npm run start:api-ts` starts without errors
  - No port conflicts
  - Logs show successful initialization

- [ ] **Endpoints Validated**
  - `/ask` responds with 200 OK
  - `/ask/stream` streams responses correctly
  - `/metrics/memoryContext?format=prometheus&includeDistributed=true` returns text/plain Prometheus format
  - `/metrics/memoryContext?format=json` returns JSON snapshot

---

## 2️⃣ Decision Router & Pipeline

- [ ] **Single Decision Router Active**
  - `askGiomService.decide()` is the single point for intent/handler selection
  - No duplicate decision logic in controllers

- [ ] **Handler Routing Correct**
  - Handlers registered: `deterministic_upload`, `greeting`, `safety`, `bible_passage`, `bible_guidance`, `weather`, `sports_fixture`, `fallback_ai`
  - Each handler isolated in its own module
  - Handlers receive consistent `DecisionResult` context

- [ ] **DecisionResult Format**
  - Contains: `intent`, `handlerName`, `routeType`, `requiresStreaming`
  - `routeType` values: `"deterministic"`, `"ai"`, `"stream"`
  - `requiresStreaming` boolean drives response encoding

- [ ] **Pipeline Unification**
  - `/ask` and `/ask/stream` both use `buildPreparedAskPayload()` + `askGiomService.decide()`
  - No endpoint-specific override logic
  - Handlers behave identically regardless of request type

---

## 3️⃣ Memory Engine Semantic

- [ ] **STM & LTM Integration**
  - Short-Term Memory (STM) loaded from `runtimeSessionMemoryStore`
  - Long-Term Memory (LTM) loaded from `semanticMemoryStore` (pgvector)
  - Hybrid ranking applied: semantic (40–55%) + recency (20–25%) + importance (15–20%) + sourceBoost

- [ ] **Deduplication Robust**
  - Dedup signatures computed correctly (role + content hash)
  - Duplicates filtered from retrieval results
  - Dedup rate tracked in diagnostics

- [ ] **Token Budget Applied**
  - Budget enforced at payload level
  - Fallback strategy triggered if budget exceeded (reduce top-N, then prune by importance)
  - Budget diagnostics exported in response metadata

- [ ] **Cache Distributed via Redis**
  - Top-N results cached with TTL
  - `distributedCache.getJson(cacheKey)` returns hit on second query
  - `distributedCache.setJson()` persists across node boundaries

- [ ] **Lock Anti-Recompute**
  - Distributed lock acquired before top-N compute
  - Lock token unique per acquisition (timestamp + random)
  - Lock released safely in finally block
  - Lock timeout fallback: waits for peer compute then reads cache

- [ ] **Embeddings Persisted**
  - Text, embedding vector, metadata (userId, sessionId, role, source), created_at stored
  - Semanticstore queryable: `findTopN(embedding, limit)`
  - Metadata queryable for filtering

- [ ] **Reranker Optional Available**
  - Reranker logic available for top candidates
  - Can be toggled per handler or globally

---

## 4️⃣ Redis & Distributed Cache

- [ ] **Single-Node or Cluster Configured**
  - `createRedisMemoryClient()` auto-detects mode from env
  - `REDIS_URL` for single-node setup
  - `REDIS_CLUSTER_URLS` for cluster mode (e.g., `redis://node1:6379,redis://node2:6379`)

- [ ] **Lock Primitives Operational**
  - `acquireDistributedLock()` uses Redis NX (set-if-not-exists) with TTL
  - `releaseDistributedLock()` uses atomic Lua script or fallback `delIfValue()`
  - `waitForDistributedLock()` polls with exponential retry

- [ ] **Cache Synchronized**
  - Top-N cache key pattern: `giom:memory:topn:{sessionId}:{query_hash}`
  - TTL set (default 60s, configurable per environment)
  - Lock key pattern: `giom:lock:topn:{sessionId}:{query_hash}`
  - Lock TTL shorter than cache TTL to avoid orphaned locks

- [ ] **Fallback Local If Redis Fails**
  - If `distributedCache` unavailable, retrieval adapter falls back to local memory cache
  - No single point of failure from Redis outage
  - Diagnostics mark fallback: `cacheLayer: "local"`

---

## 5️⃣ Metrics & Observability

- [ ] **Percentile Collection Active**
  - Latencies recorded: `retrievalMs`, `semanticMs`, `enrichMs`, `totalMs`
  - Percentiles calculated: p50, p75, p95, p99
  - Mean and stddev tracked

- [ ] **Histograms by Bucket**
  - Bucket boundaries defined: [10, 50, 100, 250, 500, 1000, 2000, 5000, 10000] ms
  - Cumulative counts per bucket computed
  - Histogram exported in Prometheus format

- [ ] **Cache Hit-Rate Tracked**
  - Hit count and miss count updated on each retrieval
  - Hit-rate = hits / (hits + misses)
  - Exported as gauge in Prometheus

- [ ] **Lock Wait-Time Captured**
  - `lockWaitMs` recorded after `waitForDistributedLock()`
  - `lockTimedOut` boolean flag on timeout
  - Lock timeout rate tracked (violations/total_attempts)

- [ ] **SLO Tracking Active**
  - SLO budgets defined per environment: `p95_retrieval`, `p95_total`, `p99_total`
  - `buildSloReport()` checks each metric against budget
  - `slo.state` = `"violation"` or `"ok"`
  - Alarm list generated with violations

- [ ] **Snapshot Available**
  - Local snapshot: `memoryContextMetrics.snapshot()` returns single-node view
  - Distributed snapshot: `memoryContextMetrics.snapshotDistributed()` returns cluster aggregation
  - Snapshot includes node ID, scope, all percentiles, histograms, cache hit-rate

- [ ] **Prometheus Export Operational**
  - `exportPrometheus({ includeDistributed })` returns text/plain format
  - Format: `# HELP` + `# TYPE` + metric lines with labels
  - Histogram buckets cumulative: `le="+Inf"` at end
  - Gauge metrics include labels: `node="..."`, `scope="..."`, `stage="..."`

- [ ] **Logs Structured**
  - Handler name, routeType, intent included in logs
  - Memory engine decisions (ranking scores, dedup, fallback) logged
  - Errors captured with stack traces

---

## 6️⃣ Stress Test & SLO Validation

- [ ] **Harness Operational**
  - `npm run qa:stress-memory` executes without errors
  - Configuration via env: `STRESS_TOTAL_REQUESTS`, `STRESS_CONCURRENCY`, `STRESS_STREAM_RATIO`
  - Worker pool pattern processes requests concurrently

- [ ] **Multi-Instance Testing**
  - Simultaneous `/ask` and `/ask/stream` requests sent
  - Multiple handler types exercised in same test run
  - Cache hits/misses measured across instances

- [ ] **Percentiles Validated Against Thresholds**
  - p95 retrieval latency recorded
  - p95 total latency checked vs budget
  - p99 total latency checked vs budget
  - Violations flagged in report

- [ ] **MemoryContext Within Budget**
  - Total latency (retrieval + semantic + enrich) below threshold
  - Token budget not exceeded
  - Fallback strategy triggered if needed

- [ ] **Cache Hit-Rate Acceptable**
  - Hit-rate >= target (e.g., 60% on repeated queries)
  - First-query cache miss expected
  - Multi-node cache sync validated

- [ ] **Lock Contention Minimal**
  - Lock wait-time p95 < 500ms
  - Lock timeout rate < 5%
  - Distributed cache read after timeout succeeds

- [ ] **Reports Generated**
  - `reports/memory-context-stress.json` contains execution summary
  - Prometheus metrics exportable from /metrics endpoint during test
  - Latency samples saved for post-analysis

---

## 7️⃣ Failover & Resilience

- [ ] **Redis Failover Tested**
  - Single-node → cluster switchover: retrieval adapter continues working
  - Cluster → single-node fallback: cache reads succeed
  - Lock primitives work in both modes

- [ ] **Handler Fallback Safe**
  - If external provider (weather, sports, AI) fails, handler returns contingency response
  - No cascading failures from one handler affecting others
  - Fallback AI handler always available as last resort

- [ ] **Streaming Fallback Secure**
  - If `/ask/stream` timeout or provider fail, gracefully close stream
  - Client receives partial response (headers + whatever computed before timeout)
  - No hung connections or orphaned resources

- [ ] **Memory Engine Graceful Degradation**
  - If semantic store unavailable: fall back to STM only
  - If Redis unavailable: use local cache only
  - If lock timeout: read stale cache with diagnostics

---

## 8️⃣ Painel & Alertas (Grafana/Prometheus)

- [ ] **Dashboards Configured**
  - Memory retrieval latency panel: p50, p75, p95, p99 as separate series
  - Cache hit-rate gauge: shows % of successful cache lookups
  - Lock wait-time histogram: p95/p99 of lock acquisition time
  - SLO violations indicator: red flag if `giom_memory_context_slo_violation_total` > 0

- [ ] **Alert Rules Defined**
  - Alert if `p95_total_ms > threshold` (e.g., 900ms)
  - Alert if `cache_hit_rate < threshold` (e.g., 50%)
  - Alert if `lock_wait_p95_ms > threshold` (e.g., 500ms)
  - Alert if `lock_timeout_rate > threshold` (e.g., 5%)

- [ ] **Alert Severity Tiered**
  - Critical: p99_total > 1.5x threshold
  - Warning: p95_total > budget or cache hit-rate < threshold
  - Info: lock timeouts detected but retrieval succeeded

- [ ] **Logs Integrated**
  - Trace records available in central observability system (e.g., DataDog, Splunk, ELK)
  - Handler execution logs include decision context
  - Memory engine decisions logged at debug level

- [ ] **Grafana Datasource Connected**
  - Prometheus scrape job points to `/metrics/memoryContext?format=prometheus&includeDistributed=true`
  - Scrape interval set (default 30s)
  - Labels: `job="giom"`, `instance="<hostname>:<port>"`

---

## 9️⃣ QA & Validation

- [ ] **Full Test Suite Passes**
  - `npm test` returns 59+ pass, 0 fail
  - No regressions in existing tests
  - Memory, semantic retrieval, and metrics tests all green

- [ ] **Focused Memory Tests**
  - `node --test tests/memory-context-metrics.test.js` passes (Prometheus export, SLO tracking)
  - `node --test tests/semantic-retrieval-engine.test.js` passes (distributed cache, lock scenarios)
  - `node --test tests/memory-context-engine.test.js` passes (dedup, ranking, budget)

- [ ] **Stress Test Multi-Node Validated**
  - Stress harness runs on multiple nodes simultaneously
  - Distributed cache synchronized across nodes
  - Metrics aggregated correctly (worst-case p95/p99)

- [ ] **Decision Router Unification Verified**
  - Code audit: single `decide()` function entry point
  - No duplicate decision logic in controllers
  - Controllers pass identical request context to router

- [ ] **/ask and /ask/stream Identical Behavior**
  - Same intent selected for same query
  - Same handler invoked regardless of endpoint
  - Latencies comparable (stream overhead < 5% vs ask)
  - Cache hits/misses aligned across endpoints

- [ ] **Type Safety Checked**
  - `npm run typecheck:api-runtime` passes with 0 errors
  - TypeScript interfaces consistent across modules
  - No implicit `any` types in memory engine

---

## 🔟 Next Upgrades (Big Tech Level 2+)

- [ ] **Lock Optimization**
  - Tune lock TTL for lower false-release rate
  - Adjust retry interval for lock acquisition (exponential backoff)
  - Monitor lock contention in Grafana, adjust concurrency model if needed

- [ ] **Reranker Advanced**
  - Optional semantic reranker for top-N candidates
  - Lexical + embedding + context-aware boosting
  - A/B test reranker impact on relevance

- [ ] **Per-Route Metrics**
  - `/ask` vs `/ask/stream` latency comparison
  - Per-handler latency tracking (deterministic vs AI vs streaming)
  - Per-userId or per-sessionId latency trending

- [ ] **Multi-Region Stress Test**
  - Stress test across multiple geographic regions
  - Validate Redis geo-replication or cluster mode
  - Measure latency QoS across regions

- [ ] **Query Analytics**
  - Track queries by handler type, intent, and latency
  - Identify high-cost queries (slow semantic search)
  - Identify low-relevance queries (low cache hit, poor ranking)

- [ ] **Continuous Profiling**
  - CPU/memory flame graphs during stress
  - Identify bottlenecks in ranking algorithm
  - Profile embeddings computation overhead

---

## 📋 Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| Platform Eng | | | ⏳ Pending |
| DevOps | | | ⏳ Pending |
| QA Lead | | | ⏳ Pending |
| Arch Review | | | ⏳ Pending |

---

## 🔗 Related Documents

- **Playbook Operacional**: [GIOM-OPERATIONAL-PLAYBOOK.md](GIOM-OPERATIONAL-PLAYBOOK.md)
- **Cheat Sheet DevOps**: [GIOM-DEVOPS-CHEATSHEET.md](GIOM-DEVOPS-CHEATSHEET.md)
- **Architecture Flow**: [GIOM-ARCHITECTURE-FLOW.md](GIOM-ARCHITECTURE-FLOW.md)
- **Stress Test Results**: [reports/memory-context-stress.json](../reports/memory-context-stress.json)
- **Prometheus Metrics**: `http://<hostname>:3010/metrics/memoryContext?format=prometheus&includeDistributed=true`
