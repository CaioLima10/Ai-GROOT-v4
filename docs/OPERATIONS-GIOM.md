# GIOM Operations Runbook (Local + Production Mindset)

## Objective

Keep GIOM stable, observable, and recoverable with minimal downtime.

## 1. Service Topology

- Frontend (Next.js): `apps/web-next` on port `3001`
- Backend (Express): `apps/api/src/server.js` on port `3000`
- Front to Back bridge: Next rewrite `/backend/:path* -> http://localhost:3000/:path*`
- Chat endpoints used by frontend:
  - `POST /backend/ask`
  - `POST /backend/ask/stream`
  - `GET /backend/config`
- Supabase is configured by backend `/config` and consumed by frontend auth bootstrap.

## 2. Critical Connection Map

- Front API base resolver:
  - `apps/web-next/src/app/page.tsx` -> `apiBase`
- Front auth bootstrap:
  - `apps/web-next/src/app/page.tsx` -> reads `/config`, then `createClient(supabaseUrl, supabaseAnonKey)`
- Next proxy rewrite:
  - `apps/web-next/next.config.ts`
- Backend runtime config and health:
  - `apps/api/src/enterpriseServer.js` -> `/config`, `/health`
- Backend chat handlers:
  - `apps/api/src/enterpriseServer.js` -> `/ask`, `/ask/stream`
- AI orchestration:
  - `core/aiBrain.js`
  - `core/aiProviders.js`
  - `core/enterprise/StreamingAIGateway.js`

## 3. Golden Startup (Recommended)

Use the supervisor so both services restart automatically:

```bash
npm run ops:supervisor
```

Alternative manual startup:

```bash
npm run dev
npm run web-next:dev
```

## 4. Health Checklist (Run Every Time)

Fast check:

```bash
npm run ops:check
```

Continuous watch:

```bash
npm run ops:watch
```

Strict mode (warnings fail pipeline):

```bash
npm run ops:check:strict
```

What it validates:

- backend `/health`
- backend `/config`
- frontend root
- frontend proxy `/backend/config`
- real chat request through `/backend/ask`
- stream handshake through `/backend/ask/stream`
- provider readiness from `/config`
- Supabase health endpoint using runtime anon key

## 5. SLO-style Targets (Local Ops)

- Availability target (chat request path): >= 99% during active session
- p95 response for `/backend/ask`: <= 12s local
- Critical error budget:
  - 0 unresolved `Failed to fetch` in normal operation
  - 0 cases where frontend is up but backend unavailable for > 60s

## 6. Incident Playbook: "Failed to fetch"

1. Run `npm run ops:check`.
2. If frontend fails:
   - verify port `3001` listener
   - restart frontend or run `npm run ops:supervisor`
3. If backend fails:
   - verify port `3000` listener
   - ensure only `node apps/api/src/server.js` owns port `3000`
4. If providers degraded/cooldown:
   - inspect provider summary in `/config`
   - retry after cooldown or fix API credentials and quotas
5. If Supabase fails:
   - verify `/config` has `supabaseUrl` + `supabaseAnonKey`
   - test `<SUPABASE_URL>/auth/v1/health`

## 7. Mandatory Operational Practices

- Always start stack with `ops:supervisor` during development sessions.
- Keep one active backend process on `3000`.
- Never point frontend directly to random URL in `NEXT_PUBLIC_API_BASE_URL` unless intentional.
- Keep environment variables consistent across terminals.
- Keep `reports/ops-runtime-health.jsonl` for postmortem analysis.

## 8. What Causes Oscillation Most Often

- Running only frontend or only backend.
- Port collision with stale Node processes.
- Shell session without required environment variables.
- Provider cooldown/auth failures interpreted as generic network failures.

## 9. Operational Command Pack

```bash
npm run ops:supervisor
npm run ops:check
npm run ops:watch
npm run health
npm run metrics
```

## 10. Scale-up Next Steps (Without touching app behavior)

- Add external uptime monitor hitting `/backend/config` and `/backend/ask` synthetic checks.
- Centralize logs and alerts for backend provider status transitions.
- Run periodic stress tests (`qa:stress-runtime`) before major releases.
- Add canary environment with same checks before production deploy.
