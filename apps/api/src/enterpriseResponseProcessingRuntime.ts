export declare function getCompatContext(modelId: string, extras?: Record<string, unknown>): Record<string, unknown>

export declare function resolveDeterministicFixtureResponseCore(question?: string, context?: Record<string, unknown>, deps?: Record<string, unknown>): string | null

export declare function resolveDeterministicWeatherResponseCore(question?: string, context?: Record<string, unknown>, deps?: Record<string, unknown>): string | null

export declare function requiresVerifiedFreshDataCore(question?: string, context?: Record<string, unknown>, deps?: Record<string, unknown>): boolean

export declare function buildUnknownInformationResponseCore(question?: string, context?: Record<string, unknown>, options?: Record<string, unknown>, deps?: Record<string, unknown>): string

export declare function postProcessAssistantResponseCore(question?: string, responseText?: string, context?: Record<string, unknown>, deps?: Record<string, unknown>): string

export declare function buildOperationalContingencyResponseCore(question?: string, context?: Record<string, unknown>, reason?: string, deps?: Record<string, unknown>): string

export declare function resolveSafetyChatPayloadCore(question: string, context?: Record<string, unknown>, deps?: Record<string, unknown>): {
  safety: unknown
  responseText: string
} | null

export declare function isAgroWeatherRelevantCore(question?: string, context?: Record<string, unknown>, deps?: Record<string, unknown>): boolean

