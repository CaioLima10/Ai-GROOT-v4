# Backend TS Migration - Final Step Plan

## Current Verified Baseline

- Typechecks green:
  - npm run typecheck:api-ts
  - npm run typecheck:api-runtime
- Regressions green:
  - node tests/weather-runtime.test.js
  - node tests/live-research-intents.test.js
  - node tests/live-web-runtime.test.js

## Remaining Gaps

1. Enterprise deep migration still pending:

- apps/api/src/enterpriseServer.js remains the largest coupled implementation; first internal slice already extracted to enterpriseSecurityRuntime (JS+TS), but core route/business blocks still need slicing.

1. Strict coverage for server entrypoints still pending:

- server/smart/legacy/enterprise TS entrypoints exist, but are not yet part of strict api-ts coverage.

1. Runtime build unification still pending:

- Migrated TS entrypoints still coexist with JS runtime files.

## Execution Status

- Stage 1: completed
  - weatherRuntime.ts is strict-checked and included in tsconfig.api-ts.json.
- Stage 2: completed
  - runtimeConversationContext.ts created and included in runtime + strict typechecks.
- Stage 3: in progress
  - server.ts, smartServer.ts, legacyServer.ts, enterpriseServer.ts wrappers/counterparts added and validated in runtime typecheck.
  - first internal enterprise slice extracted from enterpriseServer.js to enterpriseSecurityRuntime.js and enterpriseSecurityRuntime.ts.
- Stage 4: completed
  - strict coverage now includes server.ts, enterpriseServer.ts, smartServer.ts and legacyServer.ts.
  - listed diagnostics from ai-core-index-shim.d.ts, legacyServer.ts and smartServer.ts were resolved.
- Stage 5: started
  - build scaffold added via tsconfig.api-build.json and build scripts.
  - dist runtime path validated: clean/build emits apps/api/dist and generated entry files pass syntax checks.

## Final Staged Plan

### Stage 1 - Finish Weather Strict Migration

Goal:

- Remove // @ts-nocheck from weatherRuntime.ts while keeping behavior unchanged.

Tasks:

1. Extract remaining weather runtime blocks into strict-safe modules (same pattern used for weatherCache, weatherGeocoding, weatherPresentation).
2. Add minimal typed interfaces for weather context and provider payload access.
3. Re-enable strict checks for weatherRuntime.ts and fix residual errors.

Acceptance:

- weatherRuntime.ts has no // @ts-nocheck.
- npm run typecheck:api-ts passes with weatherRuntime.ts included.
- node tests/weather-runtime.test.js passes.

### Stage 2 - Stabilize Runtime Conversation Context

Goal:

- Convert runtimeConversationContext.js to runtimeConversationContext.ts as a low-risk utility migration.

Tasks:

1. Port module to TS with preserved exports/signatures.
2. Replace JS include with TS include in runtime config.
3. Run related regressions.

Acceptance:

- runtimeConversationContext.ts exists and typechecks.
- npm run typecheck:api-runtime passes.

### Stage 3 - Server Entrypoint Migration Track

Goal:

- Migrate server entrypoints safely without behavior regressions.

Tasks:

1. Migrate smartServer.js and server.js first (smaller surface).
2. Then migrate legacyServer.js (compatibility path).
3. Keep enterpriseServer.js for last (largest and most coupled).

Acceptance:

- Each migrated entrypoint has TS counterpart and keeps startup behavior.
- Smoke startup checks pass per entrypoint.

### Stage 4 - Strict Coverage Expansion

Goal:

- Expand strict TS checks from core runtime modules into migrated server modules.

Tasks:

1. Add newly migrated TS entrypoints to tsconfig.api-ts.json incrementally.
2. Resolve strict errors module by module.
3. Keep api-runtime check green throughout.

Acceptance:

- Strict config covers weatherRuntime + migrated entrypoints.
- Both typecheck commands pass.

### Stage 5 - Runtime Build Strategy (Finalization)

Goal:

- Remove dependency on parallel JS/TS duplicates for migrated modules.

Tasks:

1. Decide build path (tsc build or tsx runtime strategy).
2. Produce runtime JS artifacts from TS and align imports.
3. Decommission redundant JS duplicates gradually.

Acceptance:

- One canonical implementation per module (TS source).
- Startup + regression tests pass in build/runtime mode.

## Recommended Execution Order (Shortest Path)

1. Stage 1 (weather strict) - highest unblocker.
2. Stage 2 (runtimeConversationContext).
3. Stage 3 (server.js + smartServer.js).
4. Stage 3 continuation (legacyServer.js + enterpriseServer.js).
5. Stage 4 strict expansion.
6. Stage 5 build finalization.

## Command Checklist Per Stage

Run after each stage:

- npm run typecheck:api-ts
- npm run typecheck:api-runtime
- node tests/weather-runtime.test.js
- node tests/live-research-intents.test.js
- node tests/live-web-runtime.test.js

## Notes

- Removed invalid relative ambient module shim (ai-core-index-shim.d.ts) and corresponding tsconfig include.
- CSS/browser-compat and markdownlint warnings shown in editor are non-blocking for backend TS migration stages.
