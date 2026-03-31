export declare function isInterpretiveBibleQuestion(question?: string): boolean

export declare function isBibleFollowUpQuestion(question?: string): boolean

export declare function extractBibleCodeHint(text?: string): string

export declare function extractRecentBibleContextFromHistory(history?: unknown[]): {
  canonical: string
  human: string
  bibleCode: string
} | null

export declare function mergeRuntimeInstructions(base?: string, extra?: string): string

export declare function cleanBibleQuotedText(text?: string): string

export declare function extractBiblePassageExcerpt(passage?: Record<string, unknown>, maxLength?: number): string

export declare function extractBibleIdeaClauses(text?: string): string[]

export declare function inferMinistryFocusFromText(text?: string): string

export declare function extractBibleConversationPreferencesFromHistory(history?: unknown[]): Record<string, string> | null

export declare function buildBibleInterpretiveFallback(question?: string, context?: Record<string, unknown>): string | null

export declare function isWeakBibleInterpretiveResponse(text?: string): boolean

export declare function buildGospelCoreFallback(question?: string, context?: Record<string, unknown>): string | null

export declare function resolveDeterministicBibleGuidanceResponse(question?: string, context?: Record<string, unknown>): string | null

export declare function refineBibleInterpretiveResponse(question?: string, responseText?: string, context?: Record<string, unknown>): string

export declare function resolveDeterministicBiblePassageResponse(question?: string, context?: Record<string, unknown>): string | null
