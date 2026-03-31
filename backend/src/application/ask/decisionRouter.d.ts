import type { PreparedAskPayload } from "./buildPreparedAskPayload.d.ts"
import type { IntentType, ExternalDataPort } from "./askGiom.d.ts"

export interface DecisionResult {
  intent: IntentType
  handlerName: string
  routeType: "deterministic" | "ai" | "stream"
  requiresStreaming: boolean
  decisionMs: number
  checks: Array<{ intent: string, matched: boolean, handlerName: string, durationMs: number }>
}

export interface DecisionRouterPorts {
  deterministicUpload: ExternalDataPort
  greeting: { detect(question: string): { isGreetingOnly?: boolean } }
  safety: { resolve(question: string, context: Record<string, unknown>): { responseText: string } | null }
  bible: {
    passages: ExternalDataPort
    guidance: ExternalDataPort
  }
  weather: ExternalDataPort
  fixture: ExternalDataPort
}

export declare function createDecisionRouter(config: {
  ports: DecisionRouterPorts
  logger?: { info?: Function, error?: Function }
  now?: () => number
}): {
  decide(preparedPayload: PreparedAskPayload, options?: { mode?: "standard" | "stream" }): DecisionResult
}
