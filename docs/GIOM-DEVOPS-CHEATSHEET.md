# ⚡ GIOM DevOps Cheat Sheet – Deploy, QA & Monitoring

**One-page quick reference for GIOM Big Tech deployment, stress testing, and observability.**

---

## 1️⃣ Deploy in 5 Minutes

```bash
# Build
npm run build:api-ts

# Config
export PORT=3010
export REDIS_URL="redis://localhost:6379"  # OR REDIS_CLUSTER_URLS for cluster
export GIOM_BASE_URL="http://localhost:3010"
export MEMORY_BUDGET=4000
export MAX_RETRIEVED_ITEMS=10
export MEMORY_SLO_P95_RETRIEVAL=250
export MEMORY_SLO_P95_TOTAL=900
export MEMORY_SLO_P99_TOTAL=1800

# Start
npm run start:api-ts

# Validate (in another terminal)
curl http://localhost:3010/ask -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"hello"}'
```

✅ **Done!** API running on <http://localhost:3010>

---

## 2️⃣ Core Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/ask` | POST | Single request, JSON response |
| `/ask/stream` | POST | Streaming response, SSE format |
| `/metrics/memoryContext?format=prometheus&includeDistributed=true` | GET | Prometheus text export |
| `/metrics/memoryContext?format=json` | GET | JSON snapshot |

---

## 3️⃣ Pipeline Architecture

```
/ask or /ask/stream
    ↓
buildPreparedAskPayload() [normalize payload]
    ↓
askGiomService.decide() [SINGLE router → intent, handler, routeType]
    ↓
Handler Executor [deterministic, greeting, safety, bible, weather, sports, ai, fallback]
    ↓
Memory Engine [STM + LTM semantic + hybrid ranking + dedup + token budget]
    ↓
Redis Distributed Cache + Lock [top-N cache + anti-recompute lock]
    ↓
Response [JSON or streamed]
```

---

## 4️⃣ Memory Engine Quick Config

```bash
MEMORY_BUDGET=4000                    # tokens/request (reduce = less context)
MAX_RETRIEVED_ITEMS=10                # top-N pool (reduce = faster search)
DISTRIBUTED_CACHE_TTL_SEC=60          # cache expiry (increase = more hits)
DISTRIBUTED_LOCK_TTL_MS=6000          # lock auto-release (adjust if contention)
DISTRIBUTED_LOCK_TIMEOUT_MS=2500      # wait for peer compute (increase if high latency)

# Ranking weights (must sum ≈ 1.0)
RANKING_SEMANTIC_WEIGHT=0.50          # semantic similarity
RANKING_RECENCY_WEIGHT=0.20           # recent memories
RANKING_IMPORTANCE_WEIGHT=0.20        # important flag
# sourceBoost applied per handler
```

---

## 5️⃣ Redis Setup (Choose One)

### Single-Node

```bash
redis-server --port 6379
# or: brew install redis && redis-server
export REDIS_URL="redis://localhost:6379"
```

### Cluster (3+ nodes)

```bash
redis-server --port 6379 --cluster-enabled yes
redis-server --port 6380 --cluster-enabled yes
redis-server --port 6381 --cluster-enabled yes
redis-cli --cluster create 127.0.0.1:6379 127.0.0.1:6380 127.0.0.1:6381
export REDIS_CLUSTER_URLS="redis://127.0.0.1:6379,redis://127.0.0.1:6380,redis://127.0.0.1:6381"
```

### Verify

```bash
redis-cli PING  # Single-node
# PONG

redis-cli -c CLUSTER INFO  # Cluster
# cluster_state:ok
```

---

## 6️⃣ Stress Test & SLO

```bash
# Quick test (6 requests)
STRESS_TOTAL_REQUESTS=6 STRESS_CONCURRENCY=3 npm run qa:stress-memory

# Extended test (100 concurrent)
STRESS_TOTAL_REQUESTS=100 STRESS_CONCURRENCY=20 npm run qa:stress-memory

# Output: reports/memory-context-stress.json
```

**Metrics to check:**

```bash
cat reports/memory-context-stress.json | jq '{
  success_rate: .execution.success_rate,
  cache_hit_rate: .memory_context.cache_hit_rate,
  p95_latency_ms: .latency.p95_ms,
  slo_state: .memory_context.slo_state
}'

# Expected:
# success_rate: 1.0
# cache_hit_rate: >0.6 (hits on repeat queries)
# p95_latency_ms: <3500-4000
# slo_state: "ok" or "violation"
```

---

## 7️⃣ Metrics & SLO Monitoring

### View Current Metrics

```bash
# Prometheus format (for Grafana scrape)
curl "http://localhost:3010/metrics/memoryContext?format=prometheus&includeDistributed=true"

# JSON format (for quick check)
curl "http://localhost:3010/metrics/memoryContext?format=json" | jq '.{ p95_retrieval_ms, p95_total_ms, slo_state, cache_hit_rate, lock_timeout_rate }'
```

### SLO Budgets by Environment

| Metric | Dev | Staging | Prod |
|--------|-----|---------|------|
| p95_retrieval | 500ms | 300ms | 250ms |
| p95_total | 1500ms | 1000ms | 900ms |
| p99_total | 3000ms | 2000ms | 1800ms |

### SLO Violation → Incident

```bash
# If slo_state = "violation":
# 1. Check lock_timeout_rate (should be <5%)
# 2. Check cache_hit_rate (should be >50%)
# 3. Run stress test to confirm
# 4. Tune: reduce MAX_RETRIEVED_ITEMS or increase DISTRIBUTED_LOCK_TIMEOUT_MS
```

---

## 8️⃣ Failover & Incident

### Redis Unavailable

```bash
# Check status
redis-cli PING  # If fails → Redis down

# Fix: Restart single-node
redis-server --port 6379

# Fix: Cluster node down
redis-cli -c CLUSTER NODES | grep fail  # Find down node
# Restart that node: redis-server --port <port> --cluster-enabled yes

# GIOM fallback: Uses local cache until Redis reconnects (no restart needed)
```

### Handler Provider Timeout

```bash
# GIOM continues with fallback AI handler
# Non-blocking, graceful degradation
# Monitor fallback_rate in Grafana
```

### High p95 Latency

```bash
# Root cause analysis
curl "http://localhost:3010/metrics/memoryContext?format=json" | jq '{
  lock_timeout_rate,
  cache_hit_rate,
  p95_retrieval_ms,
  p95_semantic_ms,
  p95_total_ms
}'

# If lock_timeout_rate >5%: increase DISTRIBUTED_LOCK_TIMEOUT_MS
# If cache_hit_rate <50%: increase DISTRIBUTED_CACHE_TTL_SEC
# If p95_semantic_ms >200ms: optimize pgvector index or query
```

---

## 9️⃣ Grafana Dashboard

### Add Prometheus Datasource

```
URL: http://<prometheus>:9090
Scrape job GIOM: http://localhost:3010/metrics/memoryContext?format=prometheus&includeDistributed=true
Scrape interval: 30s
```

### Key Panels

- **p50/p75/p95/p99 Latency**: retrieval, semantic, enrich, total
- **Cache Hit-Rate**: % of successful cache lookups
- **Lock Wait-Time**: p95/p99 of lock acquisition
- **SLO Violations**: Red indicator if giom_memory_context_slo_violation_total > 0
- **Throughput**: samples/second by node

### Alert Rules (Prometheus)

```yaml
- alert: GiomMemoryP95Violation
  expr: giom_memory_context_p95_total_ms > 900
  for: 5m
  annotations: {severity: "critical", summary: "GIOM p95 > 900ms"}

- alert: GiomCacheHitLow
  expr: giom_memory_context_cache_hit_rate < 0.5
  for: 10m
  annotations: {severity: "warning", summary: "Cache hit-rate < 50%"}

- alert: GiomRedisDown
  expr: giom_memory_context_cache_layer_local > 0
  for: 1m
  annotations: {severity: "warning", summary: "Redis unavailable, local fallback active"}
```

---

## 🔟 QA & Validation Before Deploy

```bash
# 1. Build
npm run build:api-ts

# 2. Tests pass
npm test                                        # 59+ pass, 0 fail
node --test tests/memory-context-metrics.test.js
node --test tests/semantic-retrieval-engine.test.js

# 3. Type safe
npm run typecheck:api-runtime                   # 0 errors

# 4. Stress validated
STRESS_TOTAL_REQUESTS=6 npm run qa:stress-memory

# 5. Decision Router verified
# - Single askGiomService.decide() function
# - /ask and /ask/stream use same pipeline
# - No duplicate decision logic

# 6. Memory Engine verified
# - STM + LTM working
# - Ranking scores visible in diagnostics
# - Cache hit/miss on repeat queries
# - Dedup removing duplicates
```

---

## 📋 Quick Reference

### npm Scripts

```bash
npm run build:api-ts              # Compile TS → JS
npm run start:api-ts              # Start API on PORT
npm test                          # Run all tests
npm run qa:stress-memory          # Stress harness → reports/memory-context-stress.json
npm run typecheck:api-runtime     # Type check
```

### Key Files

```
backend/src/application/monitoring/memoryContextMetrics.js    # Metrics collector
backend/src/infrastructure/memory/redisMemoryClient.js         # Redis wrapper
backend/src/infrastructure/memory/redisLock.js                 # Lock primitives
backend/src/infrastructure/memory/grootMemoryRetrievalAdapter.js  # Top-N with cache
apps/api/src/enterpriseServer.js                              # Runtime bootstrap
scripts/stress-memory-context.mjs                             # Stress harness
tests/memory-context-metrics.test.js                          # Metrics tests
tests/semantic-retrieval-engine.test.js                       # Retrieval tests
```

### Endpoints Summary

```
POST /ask                        → JSON response
POST /ask/stream                 → Streamed response
GET /metrics/memoryContext?format=prometheus&includeDistributed=true  → Prometheus
GET /metrics/memoryContext?format=json                        → JSON
```

### Env Vars Summary

```
PORT                    # API port
REDIS_URL               # Single-node Redis
REDIS_CLUSTER_URLS      # Multi-node Redis
MEMORY_BUDGET           # Tokens/request
MAX_RETRIEVED_ITEMS     # Top-N pool
MEMORY_SLO_P95_TOTAL    # SLO budget
STRESS_TOTAL_REQUESTS   # Stress test size
STRESS_CONCURRENCY      # Parallel requests
```

---

### Lock Tuning Reference

| Issue | Parameter | Action |
|-------|-----------|--------|
| Lock contention high | DISTRIBUTED_LOCK_TTL_MS | ↑ Increase to 8000ms |
| Lock timeout rate >5% | DISTRIBUTED_LOCK_TIMEOUT_MS | ↑ Increase to 3500ms |
| Cache misses high | DISTRIBUTED_CACHE_TTL_SEC | ↑ Increase to 120s |
| p95 latency high | MAX_RETRIEVED_ITEMS | ↓ Decrease to 5 |

---

**Status:** Production Ready ✅  
**Last Updated:** 2026-03-30  
**Next Review:** 2026-04-06
