# Enterprise Route TS Migration Plan

## Goal

Keep the production runtime on the existing JS registrars while expanding strict TypeScript coverage over the extracted route surface.

## Route Inventory

| Phase | Route registrar | Approx. lines | Status |
| --- | --- | ---: | --- |
| 1 | apps/api/src/enterpriseFeedbackRoutesRuntime.js | 16 | Completed in TS |
| 1 | apps/api/src/enterpriseKnowledgeRoutesRuntime.js | 25 | Completed in TS |
| 1 | apps/api/src/enterpriseBibleRoutesRuntime.js | 37 | Completed in TS |
| 2 | apps/api/src/enterpriseAdminRoutesRuntime.js | 152 | Completed in TS |
| 2 | apps/api/src/enterprisePublicRoutesRuntime.js | 173 | Completed in TS |
| 2 | apps/api/src/enterpriseCompatRoutesRuntime.js | 165 | Completed in TS |
| 2 | apps/api/src/enterpriseResearchRoutesRuntime.js | 220 | Completed in TS |
| 2 | apps/api/src/enterpriseQualityRoutesRuntime.js | 233 | Completed in TS |
| 3 | apps/api/src/enterpriseMediaRoutesRuntime.js | 309 | Completed in TS |
| 4 | apps/api/src/enterpriseAskRoutesRuntime.js | 746 | Completed in TS |

## Execution Stages

1. Add a reproducible smoke script for the extracted API surface.
2. Port low-risk registrars to TypeScript companions and include them in strict typecheck.
3. Port medium-risk registrars to TypeScript companions without switching runtime imports.
4. Migrate the media registrar after dependency bag cleanup and focused upload validation.
5. Migrate the ask registrar last, after isolating shared request helpers and streaming edge cases.
6. Decide separately whether to flip runtime imports from JS to built TS artifacts after companion coverage, smoke validation and rollback planning.

## Guardrails

- Keep apps/api/src/enterpriseServer.js wired to the JS registrars until the final runtime flip.
- Treat new .ts files as strict validation companions, not behavior changes.
- Validate each batch with TypeScript checks plus HTTP smoke coverage.
- Preserve Bible and compat behavior as non-negotiable regression gates.

## Current State

- All extracted enterprise route registrars now have TypeScript companion files.
- The default source runtime still loads the JS registrars.
- The built runtime now defaults to the compiled TS registrars through `apps/api/src/server.ts`, `apps/api/src/enterpriseServer.ts`, and the bridge module `apps/api/src/enterpriseRouteRegistrarsRuntime.js`.
- Fast rollback is available by setting `GIOM_USE_TS_ROUTE_REGISTRARS=false`, which forces the bridge back to the JS registrars even in the built runtime.
- The compiled route-registrar output is emitted through `apps/api/src/enterpriseRouteRegistrars.ts` and `tsconfig.api-build.json`.
- Validation now covers runtime typecheck, strict typecheck, build emission, source smoke (`3014`), built-runtime smoke (`3015`) and isolated admin smoke with a temporary key.
- PR CI now runs `npm run verify:enterprise:routes:v1` as a blocking gate, and backend deploy validation reuses the same command before Render deploy.

## Current Commands

- npm run typecheck:api-runtime
- npm run typecheck:api-ts
- npm run smoke:enterprise:routes:v1
- npm run smoke:enterprise:routes:built:v1
- npm run smoke:enterprise:routes:built:admin:v1
- npm run audit:enterprise:routes:parity
- npm run verify:enterprise:routes:v1

## Smoke Script Notes

The versioned smoke script intentionally covers only deterministic route behavior:

- public and knowledge routes must return 200
- Bible invalid input must return 400 and a known code
- research routes may return 400 or 503 depending on live capability flags, but must not return 404
- compat, ask and streaming routes must stay reachable
- admin-only checks run when SMOKE_ADMIN_KEY is provided

## JS Retirement Stages

1. Keep JS and TS registrars in lockstep while the source runtime still executes `.js` directly.
2. Enforce parity with `npm run audit:enterprise:routes:parity` so no registrar can drift or be added in only one language.
3. Use the build-only bridge plus `npm run smoke:enterprise:routes:built:admin:v1` as the acceptance gate for the compiled TS path.
4. Only after repeated stable cycles should the project consider replacing direct source-runtime JS loading with generated wrappers or a runtime transpilation strategy.
5. Actual deletion of the JS source registrars is intentionally deferred until the source runtime no longer depends on them.
