import type { Express, RequestHandler } from "express"

import { registerEnterpriseVoiceRoutes as registerEnterpriseVoiceRoutesRuntime } from "../src/enterpriseVoiceRoutesRuntime.js"

type RecordLike = Record<string, any>

type EnterpriseVoiceRouteDeps = {
  askLimiter: RequestHandler
  voiceRuntime: RecordLike
  writeSSE: (...args: unknown[]) => unknown
  askGiom: (...args: unknown[]) => Promise<unknown>
  buildRuntimeConversationContext: (...args: unknown[]) => Promise<unknown> | unknown
  traceStore?: RecordLike
  longMemoryRuntime?: RecordLike
  localVoiceRuntime?: RecordLike
}

export const registerEnterpriseVoiceRoutes: (app: Express, deps: EnterpriseVoiceRouteDeps) => void =
  registerEnterpriseVoiceRoutesRuntime as (app: Express, deps: EnterpriseVoiceRouteDeps) => void