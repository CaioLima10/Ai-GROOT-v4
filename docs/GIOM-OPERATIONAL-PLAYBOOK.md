# 📘 GIOM Operational Playbook – Big Tech Level

**For: DevOps, QA, Platform Engineering**  
**Status: Production Ready**  
**Last Updated: 2026-03-30**

---

## Table of Contents

1. [Deploy & Infrastructure](#deploy--infrastructure)
2. [Pipeline & Decision Router](#pipeline--decision-router)
3. [Memory Engine Operation](#memory-engine-operation)
4. [Redis & Cache Management](#redis--cache-management)
5. [Metrics & Observability](#metrics--observability)
6. [Stress Testing & SLO](#stress-testing--slo)
7. [Failover & Incident Response](#failover--incident-response)
8. [Monitoring & Alerts](#monitoring--alerts)
9. [QA & Validation](#qa--validation)
10. [Troubleshooting](#troubleshooting)

---

## Deploy & Infrastructure

### Pre-Deployment Checklist

**Hardware & Dependencies:**

- Node.js 18+ installed
- Redis 6.0+ (single-node or cluster)
- PostgreSQL 12+ (for semantic store via pgvector)
- Prometheus/Grafana optional but recommended

**Environment Setup:**

```bash
# 1. Clone and setup
git clone <giom-repo>
cd Ai-GROOT
npm install
npm run build:api-ts

# 2. Configure environment variables
export PORT=3010
export REDIS_URL="redis://localhost:6379"          # Single-node
# OR
export REDIS_CLUSTER_URLS="redis://node1:6379,redis://node2:6379,redis://node3:6379"

export GIOM_BASE_URL="http://localhost:3010"
export MEMORY_BUDGET=4000                          # tokens per request
export MAX_RETRIEVED_ITEMS=10                       # top-N pool size
export MEMORY_SLO_P95_RETRIEVAL=250                 # ms
export MEMORY_SLO_P95_TOTAL=900                     # ms
export MEMORY_SLO_P99_TOTAL=1800                    # ms

# Optional: Admin dashboard key
export ADMIN_DASH_KEY="your-secret-key"

# 3. Start runtime
npm run start:api-ts
```

**Validation:**

```bash
# Check endpoints active
curl http://localhost:3010/ask -X POST -d '{"query":"test"}' -H "Content-Type: application/json"

# Check Prometheus export
curl http://localhost:3010/metrics/memoryContext?format=prometheus&includeDistributed=true
```

---

## Pipeline & Decision Router

### Architecture Overview

```
Request (/ask or /ask/stream)
    ↓
buildPreparedAskPayload (normalize, validate, enrich)
    ↓
askGiomService.decide (SINGLE Decision Router)
    ↓
DecisionResult {intent, handlerName, routeType, requiresStreaming}
    ↓
Handler Executor (deterministic, greeting, ai, fallback, etc.)
    ↓
Response (JSON or streamed)
```

### Handlers

| Handler | Intent | Route Type | Use Case |
|---------|--------|-----------|----------|
| `deterministic_upload` | Upload | Deterministic | File operations |
| `greeting` | Greeting | Deterministic | Welcome messages |
| `safety` | Safety | Deterministic | Content moderation |
| `bible_passage` | Bible lookup | Deterministic | Scripture retrieval |
| `bible_guidance` | Bible advice | AI | Scriptural guidance |
| `weather` | Weather | Deterministic | Weather data |
| `sports_fixture` | Sports | Deterministic | Event schedules |
| `fallback_ai` | Any other | AI/Stream | Default LLM handler |

### Decision Router Logic

The single `askGiomService.decide()` function:

1. Analyzes intent from query
2. Selects handler based on intent and availability
3. Determines routeType: deterministic/ai/stream
4. Sets requiresStreaming flag
5. Returns DecisionResult to executor

**Verify:** No decision logic should exist outside `askGiomService.decide()`.

---

## Memory Engine Operation

### Architecture

```
Input Query
    ↓
STM Lookup (runtimeSessionMemoryStore)
    ↓
LTM Semantic Search (semanticMemoryStore + pgvector)
    ↓
Hybrid Ranking: semantic(40–55%) + recency(20–25%) + importance(15–20%) + sourceBoost
    ↓
Deduplication (role + content hash)
    ↓
Token Budget Check & Fallback
    ↓
Cache Lookup (local then distributed Redis)
    ↓
Lock Acquisition & Compute (or cache read after timeout)
    ↓
Result + Diagnostics
```

### Configuration

```bash
# Memory Engine env vars
MEMORY_BUDGET=4000                    # tokens per request
MAX_RETRIEVED_ITEMS=10                # top-N pool
RANKING_SEMANTIC_WEIGHT=0.50          # 40–55%
RANKING_RECENCY_WEIGHT=0.20           # 20–25%
RANKING_IMPORTANCE_WEIGHT=0.20        # 15–20%
DISTRIBUTED_CACHE_TTL_SEC=60          # cache expiry
DISTRIBUTED_LOCK_TTL_MS=6000          # lock auto-release
DISTRIBUTED_LOCK_TIMEOUT_MS=2500      # lock acquisition timeout
DISTRIBUTED_LOCK_RETRY_INTERVAL_MS=35 # exponential backoff
```

### Monitoring Memory Engine

**Live Query:**

```bash
curl "http://localhost:3010/ask" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"What is Psalm 23?"}' \
  | jq '.memoryDiagnostics'
```

**Expected Output:**

```json
{
  "stmHit": false,
  "ltmHit": true,
  "cacheHit": true,
  "cacheLayer": "distributed",
  "lockAcquired": true,
  "lockWaitMs": 45,
  "semanticScore": 0.89,
  "rankedTopN": 3,
  "dedupRemoved": 1,
  "tokenBudgetUsed": 1250,
  "totalRetrievalMs": 145
}
```

---

## Redis & Cache Management

### Single-Node Setup

```bash
# Install Redis
brew install redis  # macOS
# or
sudo apt-get install redis-server  # Ubuntu

# Start
redis-server --port 6379

# Test
redis-cli ping
# PONG
```

### Cluster Setup

```bash
# Create cluster (3+ nodes recommended)
redis-server --port 6379 --cluster-enabled yes --cluster-node-timeout 5000
redis-server --port 6380 --cluster-enabled yes --cluster-node-timeout 5000
redis-server --port 6381 --cluster-enabled yes --cluster-node-timeout 5000

# Initialize cluster
redis-cli --cluster create 127.0.0.1:6379 127.0.0.1:6380 127.0.0.1:6381

# Verify
redis-cli -c CLUSTER INFO
```

### Cache Inspection

```bash
# Check cache keys
redis-cli KEYS 'giom:memory:topn:*'

# Check lock keys
redis-cli KEYS 'giom:lock:topn:*'

# Get cache entry
redis-cli GET 'giom:memory:topn:session123:query_hash_abc'

# Monitor live commands
redis-cli MONITOR
```

### Failover Procedure

**If Redis unavailable:**

1. Memory engine falls back to local cache only
2. Lock acquisition fails → cache read after timeout succeeds with stale data
3. Metrics reflect fallback: `cacheLayer: "local"`
4. Monitoring alert: "Redis unavailable, local fallback active"

**Recovery:**

```bash
# Restart Redis (single-node)
redis-server --port 6379

# GIOM automatically reconnects, no restart needed
# Monitor /metrics endpoint to confirm cache hits returning
```

---

## Metrics & Observability

### Prometheus Export

**Endpoint:**

```
GET /metrics/memoryContext?format=prometheus&includeDistributed=true
Content-Type: text/plain

# HELP giom_memory_context_samples_total Total samples collected
# TYPE giom_memory_context_samples_total gauge
giom_memory_context_samples_total{node="node_12345",scope="distributed_local",stage="retrieval"} 142

# HELP giom_memory_context_retrieval_ms Retrieval latency in milliseconds
# TYPE giom_memory_context_retrieval_ms histogram
giom_memory_context_retrieval_ms_bucket{node="node_12345",scope="distributed_local",le="10"} 5
giom_memory_context_retrieval_ms_bucket{node="node_12345",scope="distributed_local",le="50"} 18
giom_memory_context_retrieval_ms_bucket{node="node_12345",scope="distributed_local",le="250"} 98
...
```

**Parsing Metrics:**

```bash
# Fetch and parse percentiles
curl "http://localhost:3010/metrics/memoryContext?format=prometheus&includeDistributed=true" | grep "_p95"

# Extract p95 total latency
curl "http://localhost:3010/metrics/memoryContext?format=prometheus&includeDistributed=true" | grep "total.*p95"
```

### SLO Tracking

**View SLO Status:**

```bash
curl "http://localhost:3010/metrics/memoryContext?format=json&includeDistributed=true" \
  | jq '.slo'

# Expected output:
{
  "state": "violation",
  "alarms": [
    {
      "metric": "p95_total",
      "value": 4870,
      "budget": 900,
      "severity": "critical"
    }
  ]
}
```

**SLO Budgets (configurable per environment):**

| Environment | p95_retrieval | p95_total | p99_total |
|-------------|---------------|-----------|-----------|
| dev | 500ms | 1500ms | 3000ms |
| staging | 300ms | 1000ms | 2000ms |
| prod | 250ms | 900ms | 1800ms |

---

## Stress Testing & SLO

### Quick Stress Test

```bash
# Run 6 concurrent requests
STRESS_TOTAL_REQUESTS=6 \
STRESS_CONCURRENCY=3 \
STRESS_STREAM_RATIO=0.4 \
npm run qa:stress-memory

# Output: reports/memory-context-stress.json
```

### Extended Stress Test

```bash
# Run 100 concurrent requests over 2 minutes
STRESS_TOTAL_REQUESTS=100 \
STRESS_CONCURRENCY=20 \
STRESS_STREAM_RATIO=0.5 \
REQUEST_TIMEOUT_MS=120000 \
npm run qa:stress-memory
```

### Interpreting Results

```json
{
  "config": {
    "total_requests": 6,
    "concurrency": 3,
    "stream_ratio": 0.4
  },
  "execution": {
    "total_duration_ms": 3210,
    "success_count": 6,
    "failure_count": 0,
    "success_rate": 1.0
  },
  "latency": {
    "p50_ms": 1245,
    "p75_ms": 2103,
    "p95_ms": 3120,
    "p99_ms": 3120
  },
  "memory_context": {
    "p95_total_ms": 4870,
    "slo_state": "violation",
    "cache_hit_rate": 0.67,
    "lock_timeout_rate": 0.0
  }
}
```

**Interpretation:**

- ✅ 100% success rate
- ✅ Cache hit-rate 67% (acceptable on repeat queries)
- ❌ SLO violation: p95_total 4870ms > budget 900ms
- ⚠️ Action: Tune Redis lock timeouts or increase semantic index performance

---

## Failover & Incident Response

### Scenario: Redis Unavailable

**Detection:**

- Metrics show: `cacheLayer: "local"` instead of `"distributed"`
- Logs show: "Redis connection failed, using local fallback"
- Alert triggered: "Redis unavailable"

**Response:**

1. Check Redis status: `redis-cli ping`
2. If not running, restart: `redis-server --port 6379`
3. If cluster, check cluster status: `redis-cli -c CLUSTER INFO`
4. Monitor GIOM logs: `npm run start:api-ts` (should show reconnection)
5. Verify recovery: Check `/metrics` endpoint, cache hits should resume

### Scenario: Handler Provider Timeout

**Example: Weather service timeout**

**Detection:**

- Logs show: "weather_provider: timeout after 5000ms"
- Response includes: `"fallback": true`

**Response:**

1. Check provider health: `curl https://weather-api.com/health`
2. If provider down, GIOM continues with fallback AI handler
3. No production impact (graceful degradation)
4. Monitor fallback rate in Grafana

### Scenario: Memory Engine High p95 Latency

**Detection:**

- SLO violation: p95_retrieval > 250ms or p95_total > 900ms
- Alert triggered: "GIOM memory engine SLO violation"

**Root Cause Analysis:**

```bash
# 1. Check lock contention
curl "http://localhost:3010/metrics/memoryContext?format=json" \
  | jq '.lock_timeout_rate'

# 2. Check cache hit-rate
curl "http://localhost:3010/metrics/memoryContext?format=json" \
  | jq '.cache_hit_rate'

# 3. Check semantic search performance
# Profile semantic store query: SELECT ... LIMIT 10 ORDER BY embedding <-> query
```

**Remediation:**

- If lock timeouts high: reduce `DISTRIBUTED_LOCK_TTL_MS` or add read replicas to Redis
- If cache hit-rate low: increase `DISTRIBUTED_CACHE_TTL_SEC` or reduce `MAX_RETRIEVED_ITEMS`
- If semantic search slow: build indexes on pgvector, optimize query, or shard by userId

---

## Monitoring & Alerts

### Grafana Dashboard Setup

**Import JSON Dashboard:**

```bash
POST http://grafana:3000/api/dashboards/db \
  -H "Authorization: Bearer $GRAFANA_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d @docs/grafana-giom-dashboard.json
```

**Alert Rules (Prometheus):**

```yaml
groups:
  - name: giom_memory_engine
    rules:
      - alert: GiomMemoryContextSLOViolation
        expr: giom_memory_context_slo_violation_total > 0
        for: 5m
        annotations:
          summary: "GIOM memory context SLO violated"
          severity: "critical"

      - alert: GiomCacheHitRateLow
        expr: giom_memory_context_cache_hit_rate < 0.5
        for: 10m
        annotations:
          summary: "GIOM cache hit-rate below 50%"
          severity: "warning"

      - alert: GiomRedisUnavailable
        expr: giom_memory_context_cache_layer_local > 0
        for: 1m
        annotations:
          summary: "GIOM falling back to local cache (Redis unavailable)"
          severity: "warning"
```

### Logging Strategy

**Log Levels:**

- `ERROR`: Handler failure, Redis connection lost, unexpected exceptions
- `WARN`: Lock timeout, SLO violation, cache miss on hot query
- `INFO`: Handler execution, memory engine decisions, cache hit
- `DEBUG`: Ranking scores, dedup details, token budget breakdown

**Log Aggregation:**
Send logs to central system (ELK, Splunk, DataDog) with tags:

```json
{
  "timestamp": "2026-03-30T15:46:23Z",
  "level": "INFO",
  "service": "giom",
  "handler": "bible_passage",
  "intent": "scripture_lookup",
  "routeType": "deterministic",
  "latencyMs": 145,
  "tags": ["memory-engine", "cache-hit", "distributed"]
}
```

---

## QA & Validation

### Pre-Deployment Tests

```bash
# 1. Unit & Integration Tests
npm test

# 2. Memory Engine Focused Tests
node --test tests/memory-context-metrics.test.js
node --test tests/semantic-retrieval-engine.test.js
node --test tests/memory-context-engine.test.js

# 3. TypeScript Check
npm run typecheck:api-runtime

# 4. Quick Stress (6 requests)
STRESS_TOTAL_REQUESTS=6 npm run qa:stress-memory

# 5. Verify Decision Router
# - Check: Single askGiomService.decide() function
# - Check: No override logic in /ask or /ask/stream controllers
# - Verify DecisionResult format consistency
```

### Post-Deployment Validation

```bash
# 1. Endpoint Health
curl http://localhost:3010/ask -X POST -d '{"query":"hello"}' \
  -H "Content-Type: application/json"

# 2. Prometheus Metrics
curl http://localhost:3010/metrics/memoryContext?format=prometheus \
  | head -20

# 3. SLO Check
curl http://localhost:3010/metrics/memoryContext?format=json \
  | jq '.slo.state'
# Expected: "ok"

# 4. Cache Distributed
# Send same query twice, check cacheHit on second request
curl http://localhost:3010/ask -X POST -d '{"query":"psalm 23"}' \
  -H "Content-Type: application/json" \
  | jq '.memoryDiagnostics.cacheHit'
# First: false, Second: true

# 5. Multi-Node Cache Test
# Run GIOM on two instances, verify cache synchronized
```

---

## Troubleshooting

### Issue: `/ask` returns 500 error

**Diagnosis:**

```bash
# Check logs for handler error
npm run start:api-ts 2>&1 | grep -i error

# Test decision router directly
node -e "
  const service = require('./src/services/askGiomService.js');
  console.log(service.decide({query: 'test', intent: 'unknown'}));
"
```

**Common Causes:**

- Handler not registered in router
- External provider timeout (weather, AI)
- Memory engine exception (embedding, ranking)

**Fix:**

- Verify handler in `askGiomService.handlers` map
- Add try-catch with fallback in handler
- Check embeddings provider connection

---

### Issue: Cache always misses (cache_hit_rate = 0)

**Diagnosis:**

```bash
redis-cli KEYS 'giom:memory:topn:*' | wc -l
# If 0, cache not being written

redis-cli GET 'giom:memory:topn:session123:query_hash'
# If nil, cache not persisting
```

**Common Causes:**

- Redis connection string incorrect
- Cache TTL too short (set to < 1s)
- Lock timeout prevents cache write

**Fix:**

- Verify `REDIS_URL` or `REDIS_CLUSTER_URLS`
- Increase `DISTRIBUTED_CACHE_TTL_SEC` to 60+
- Reduce `DISTRIBUTED_LOCK_TIMEOUT_MS` to allow compute

---

### Issue: p95_total latency exceeds budget

**Diagnosis:**

```bash
# Run stress test with profiling
node --prof scripts/stress-memory-context.mjs

# Analyze profile
node --prof-process isolate-*.log > profile.txt

# Check lock contention
curl "http://localhost:3010/metrics/memoryContext?format=json" \
  | jq '.lock_wait_p95_ms'

# Check semantic search perf
psql -c "EXPLAIN ANALYZE SELECT * FROM semantic_memory ORDER BY embedding <-> '[...]' LIMIT 10"
```

**Common Causes:**

- Semantic embedding search slow (missing pgvector index)
- Lock timeout and fallback wait (2500ms timeout + 1500ms cache wait = 4000ms)
- Token budget fallback reducing result quality

**Fix:**

- Build pgvector index: `CREATE INDEX ON semantic_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`
- Increase `DISTRIBUTED_LOCK_TIMEOUT_MS` to 3500ms or higher
- Reduce token budget to skip tokens instead of re-ranking

---

## Quick Reference

### Env Vars

```bash
PORT                              # API port (default 3010)
REDIS_URL                         # Single-node Redis
REDIS_CLUSTER_URLS                # Multi-node Redis
GIOM_BASE_URL                     # API base URL
MEMORY_BUDGET                     # Tokens per request
MAX_RETRIEVED_ITEMS               # Top-N pool size
MEMORY_SLO_P95_RETRIEVAL          # SLO budget
MEMORY_SLO_P95_TOTAL              # SLO budget
MEMORY_SLO_P99_TOTAL              # SLO budget
```

### npm Scripts

```bash
npm run build:api-ts              # Compile TypeScript
npm run start:api-ts              # Start runtime
npm test                          # Run all tests
npm run qa:stress-memory          # Stress harness
npm run typecheck:api-runtime     # Type checking
```

### Endpoints

```
POST /ask                         # Single request
POST /ask/stream                  # Streaming response
GET /metrics/memoryContext?format=prometheus  # Prometheus export
GET /metrics/memoryContext?format=json        # JSON snapshot
```

---

**Last Reviewed:** 2026-03-30  
**Next Review:** 2026-04-06
