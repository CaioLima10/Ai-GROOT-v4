export declare function sanitizeDocumentTitle(value?: string, fallback?: string): string

export declare function sanitizeGeneratedDocumentContent(
  content?: string,
  prompt?: string,
  format?: string,
  options?: Record<string, unknown>
): string

export declare function buildDocumentDraftPrompt(prompt: string, format: string, options?: Record<string, unknown>): string
