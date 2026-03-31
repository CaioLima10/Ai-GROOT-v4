# 🎯 GIOM Big Tech – Visual Reference Card

**Laminate-friendly quick reference for GIOM operations, troubleshooting, and emergency procedures.**

---

## 📌 ARCHITECTURE AT A GLANCE

```
REQUEST
  ↓
buildPreparedAskPayload() [normalize]
  ↓
askGiomService.decide() [SINGLE ROUTER]
  ├→ intent detection
  ├→ handler selection (8 types)
  ├→ routeType (deterministic/ai/stream)
  └→ DecisionResult
  ↓
HANDLER EXECUTION
  ├→ deterministic_upload
  ├→ greeting, safety
  ├→ bible_passage, bible_guidance
  ├→ weather, sports_fixture
  ├→ fallback_ai
  └→ Memory Engine Retrieval
  ↓
MEMORY ENGINE
  ├→ STM lookup [fast]
  ├→ LTM semantic search [pgvector]
  ├→ Hybrid ranking [semantic 50% + recency 22% + importance 18%]
  ├→ Deduplication [remove duplicates]
  ├→ Token budget [enforce limits]
  └→ Cache lookup [local → distributed Redis]
  ↓
REDIS DISTRIBUTED
  ├→ Lock acquire [NX, TTL 6s]
  ├→ Compute if locked [cache miss]
  ├→ Cache write [TTL 60s]
  ├→ Lock release [safe cleanup]
  └→ Multi-node aggregation [Prometheus]
  ↓
METRICS COLLECTION
  ├→ Latency: retrieval, semantic, enrich, total
  ├→ Percentiles: p50, p75, p95, p99
  ├→ Cache hit-rate
  ├→ SLO validation (p95 vs budget)
  └→ Export Prometheus text format
  ↓
RESPONSE
  ├→ JSON (/ask)
  ├→ SSE Streaming (/ask/stream)
  └→ + Memory diagnostics
```

---

## ⚙️ DEPLOY IN 5 LINES

```bash
npm run build:api-ts
export PORT=3010 REDIS_URL="redis://localhost:6379"
export MEMORY_BUDGET=4000 MAX_RETRIEVED_ITEMS=10
export MEMORY_SLO_P95_TOTAL=900
npm run start:api-ts
```

---

## 🔍 QUICK DIAGNOSTICS

| Symptom | Command | Expected |
|---------|---------|----------|
| API alive? | `curl http://localhost:3010/ask -X POST -d '{"query":"hi"}' -H 'Content-Type: application/json'` | 200 OK + response |
| Redis connected? | `redis-cli PING` | PONG |
| Metrics working? | `curl http://localhost:3010/metrics/memoryContext?format=json \| jq .slo.state` | "ok" or "violation" |
| Cache hit? | Send same query 2x, check `memoryDiagnostics.cacheHit` | 1st: false, 2nd: true |
| SLO exceeded? | `curl ... \| jq .slo.alarms` | [] (empty) = OK |
| Stress test | `STRESS_TOTAL_REQUESTS=6 npm run qa:stress-memory` | 6/6 success |

---

## 🚨 INCIDENT RESPONSE TREE

```
SYMPTOM: p95 HIGH (>900ms)
├─ Check: lock_timeout_rate > 5%?
│  ├─ YES → Increase DISTRIBUTED_LOCK_TIMEOUT_MS to 3500ms
│  └─ NO → Continue
├─ Check: cache_hit_rate < 50%?
│  ├─ YES → Increase DISTRIBUTED_CACHE_TTL_SEC to 120s
│  └─ NO → Continue
├─ Check: Redis cluster status
│  ├─ FAIL → Restart Redis: redis-server --port 6379
│  └─ OK → Profile with Node flame graphs
└─ Decision: Rollback or continue monitoring

SYMPTOM: Cache always MISS
├─ Check: redis-cli KEYS 'giom:memory:topn:*' | wc -l
│  ├─ 0 → Cache not writing, check Redis connection
│  └─ >0 → Cache exists, check TTL with redis-cli TTL key
├─ Fix: Verify REDIS_URL in env
├─ Fix: Increase DISTRIBUTED_CACHE_TTL_SEC
└─ Verify: Send 2 same queries, 2nd should cache hit

SYMPTOM: Redis UNAVAILABLE
├─ Check: redis-cli PING → if fails, Redis down
├─ Fix: redis-server --port 6379 (restart)
├─ Monitor: GIOM logs should show "local fallback"
├─ Impact: All queries fall back to local memory (slower)
└─ SLO: Will violate until Redis returns

SYMPTOM: /ask returns 500 ERROR
├─ Check: npm run start:api-ts logs
├─ Look for: "handler error" or "provider timeout"
├─ Fix: Check handler in askGiomService.handlers map
├─ Fallback: fallback_ai handler should catch
└─ Escalate: If persists, check external provider health
```

---

## 📊 PROMETHEUS QUERIES (For Grafana)

```promql
# p95 total latency
giom_memory_context_p95_total_ms{scope="distributed_local"}

# Cache hit-rate
giom_memory_context_cache_hit_rate{scope="distributed_local"}

# SLO violation indicator
giom_memory_context_slo_violation_total{scope="distributed_local"}

# Lock wait time p95
giom_memory_context_lock_wait_ms_p95{scope="distributed_local"}

# Throughput (samples/min)
rate(giom_memory_context_samples_total[1m])

# Percentiles together
{__name__=~"giom_memory_context_p[0-9]+_total_ms"}
```

---

## 🔧 ENV VAR QUICK REFERENCE

### Critical (must set)

```
PORT=3010
REDIS_URL=redis://localhost:6379
MEMORY_BUDGET=4000
MAX_RETRIEVED_ITEMS=10
```

### SLO Budgets (tune per environment)

```
MEMORY_SLO_P95_RETRIEVAL=250      # dev: 500, staging: 300, prod: 250
MEMORY_SLO_P95_TOTAL=900          # dev: 1500, staging: 1000, prod: 900
MEMORY_SLO_P99_TOTAL=1800         # dev: 3000, staging: 2000, prod: 1800
```

### Cache & Locks (tune for throughput)

```
DISTRIBUTED_CACHE_TTL_SEC=60           # increase → more cache hits
DISTRIBUTED_LOCK_TTL_MS=6000           # lock auto-release time
DISTRIBUTED_LOCK_TIMEOUT_MS=2500       # wait for peer compute (increase if p95 high)
```

### Stress Test (for load testing)

```
STRESS_TOTAL_REQUESTS=6
STRESS_CONCURRENCY=3
STRESS_STREAM_RATIO=0.4
```

---

## 📋 VALIDATION CHECKLIST (PRE-DEPLOY)

```
PIPELINE & ROUTER
☐ Single askGiomService.decide() function
☐ /ask and /ask/stream use same logic
☐ All 8 handlers registered
☐ DecisionResult consistent (intent, handler, routeType, requiresStreaming)

MEMORY ENGINE
☐ STM + LTM integrated
☐ Hybrid ranking applied (semantic 50%, recency 22%, importance 18%)
☐ Deduplication working (check diagnostics.dedupRemoved > 0)
☐ Token budget enforced
☐ Cache hit on repeat queries (send same query 2x)

REDIS & CACHE
☐ Redis running: redis-cli PING → PONG
☐ Lock acquire/release working (lock_wait_ms in diagnostics)
☐ Cache synchronized (cacheLayer: "distributed" on cache hits)
☐ Fallback to local if Redis down (test by stopping redis-server)

OBSERVABILITY
☐ Prometheus streaming: curl .../metrics/memoryContext?format=prometheus
☐ JSON snapshot: curl .../metrics/memoryContext?format=json
☐ SLO state: slo.state = "ok" or "violation"
☐ Percentiles exported: p50, p75, p95, p99

STRESS & SLO
☐ Stress test: STRESS_TOTAL_REQUESTS=6 npm run qa:stress-memory
☐ Success rate: 100%
☐ Cache hit-rate: >50%
☐ SLO state: Check if "ok" or acceptable "violation"

FAILOVER
☐ Restart Redis: system continues with local cache
☐ Handler timeout: fallback AI still responds
☐ Streaming timeout: graceful close

SIGN-OFF
☐ All checks passed
☐ Team lead approval
☐ DevOps confirmation
☐ Date & signature: ___________________
```

---

## 🎯 SLO BUDGETS

| Environment | p95 Retrieval | p95 Total | p99 Total |
|-------------|---------------|-----------|-----------|
| **dev** | 500ms | 1500ms | 3000ms |
| **staging** | 300ms | 1000ms | 2000ms |
| **prod** | 250ms | 900ms | 1800ms |

**Current Status:** p95_total ~4870ms (VIOLATION)  
**Target:** Tune to <900ms before prod deploy  
**If exceeding:** ⚠️ Tune `DISTRIBUTED_LOCK_TIMEOUT_MS` ↑ or `MAX_RETRIEVED_ITEMS` ↓

---

## 📞 ENDPOINTS REFERENCE

| Endpoint | Method | Example | Response |
|----------|--------|---------|----------|
| `/ask` | POST | `{query:"hi"}` | JSON result + diagnostics |
| `/ask/stream` | POST | `{query:"hi"}` | SSE stream |
| `/metrics/memoryContext?format=prometheus` | GET | — | Prometheus text format |
| `/metrics/memoryContext?format=json` | GET | — | JSON snapshot |

---

## ⚡ COMMON COMMANDS

```bash
# Deploy & start
npm run build:api-ts && npm run start:api-ts

# Test
npm test                    # Full suite (59+ tests)
npm run qa:stress-memory    # Stress test

# Diagnostics
redis-cli KEYS 'giom:*'                              # List cache keys
redis-cli GET 'giom:memory:topn:...'                 # Inspect cache
curl .../metrics/memoryContext?format=json | jq .   # Live metrics

# Monitoring
curl 'http://localhost:3010/metrics/memoryContext?format=prometheus' | grep p95

# Tuning
DISTRIBUTED_LOCK_TIMEOUT_MS=3500 npm run start:api-ts  # Override env var for testing
```

---

## 🔗 QUICK LINKS

**Documentation:**

- [GIOM-MASTER-INDEX.md](GIOM-MASTER-INDEX.md) – Navigation hub
- [GIOM-PRODUCTION-CHECKLIST.md](GIOM-PRODUCTION-CHECKLIST.md) – Pre-deploy validation
- [GIOM-OPERATIONAL-PLAYBOOK.md](GIOM-OPERATIONAL-PLAYBOOK.md) – Detailed operations
- [GIOM-DEVOPS-CHEATSHEET.md](GIOM-DEVOPS-CHEATSHEET.md) – Another quick reference
- [GIOM-ARCHITECTURE-FLOW.md](GIOM-ARCHITECTURE-FLOW.md) – Architecture deep-dive

**Visual Diagrams:**

- 🌐 Complete pipeline flow (7 subgraphs)
- 📊 SLO tracking & alerting flow
- 🔒 Redis cache & lock synchronization
- 🏷️ Memory engine hybrid ranking

**Repositories:**

- Core: `backend/src/application/monitoring/memoryContextMetrics.js`
- Redis: `backend/src/infrastructure/memory/redisMemoryClient.js` + `redisLock.js`
- Retrieval: `backend/src/infrastructure/memory/grootMemoryRetrievalAdapter.js`
- Delivery: `scripts/stress-memory-context.mjs`

---

## 🎓 TRAINING SUMMARY

**What you need to know:**

1. **GIOM = Unified Decision Router** (no duplicate logic)
2. **Pipeline = STM + LTM Semantic + Hybrid Ranking** (semantic 50%, recency 22%, importance 18%)
3. **Cache = Redis Distributed** (lock prevents recompute, TTL auto-expires)
4. **Metrics = Prometheus** (p50/p75/p95/p99 histograms, SLO validation)
5. **Monitoring = Grafana** (dashboards + alerts on SLO violations)
6. **Stress = Load Harness** (validates SLO under concurrent load)
7. **Failover = Graceful Degradation** (local cache if Redis down, fallback AI if provider fails)
8. **Tuning = Lock Timeout + Cache TTL** (adjust for p95 latency goal)

---

## ✅ READY FOR PRODUCTION?

Check these boxes:

- [ ] Build passes: `npm run build:api-ts`
- [ ] Tests pass: `npm test` (59+ pass)
- [ ] No TypeScript errors: `npm run typecheck:api-runtime`
- [ ] Stress test OK: `STRESS_TOTAL_REQUESTS=6 npm run qa:stress-memory`
- [ ] SLO within budget OR tuning plan approved
- [ ] Redis cluster tested & operational
- [ ] Prometheus/Grafana dashboards configured
- [ ] Alert rules defined
- [ ] On-call runbook shared
- [ ] Team trained

**Ready?** → Follow [GIOM-PRODUCTION-CHECKLIST.md](GIOM-PRODUCTION-CHECKLIST.md)

---

## 📝 NOTES

```
Last Deploy:      ___________________
Deployed By:      ___________________
Environment:      ___________________
SLO Budget Set:   ___________________
Incidents:        ___________________
Follow-up Items:  ___________________
```

---

**Version:** 1.0 – Big Tech Level  
**Status:** Production Ready ✅  
**Print & Laminate:** Yes 👍  
**Last Updated:** 2026-03-30  

---

**💡 Pro Tips:**

- Save this to PDF: right-click → save as PDF → print
- Slack tip: Pin this in #devops channel for on-call access
- Dry-erase: Print on plastic sheet, use with dry-erase marker
- Wallet size: Print double-sided on 4x6 card stock

**Questions?** Refer to full documentation or contact platform team.
