export interface MemoryPort {
  getContext(input: {
    userId: string
    sessionId?: string | null
    query: string
    intent?: string
    topic?: string | null
    limit?: number
    activeModules?: string[]
    bibleStudyModules?: string[]
    conversationHistory?: Array<{ role: string, content: string, created_at?: string }>
  }): Promise<{
    contextSummary?: string
    summary?: string
    knownFactsText?: string
    recentConversationText?: string
    conversationTurns?: Array<{ role: string, content: string, created_at?: string }>
    history?: Array<{ user: string, ai: string, timestamp?: string }>
    userProfile?: Record<string, unknown>
    diagnostics?: Record<string, unknown>
  }>
}

export interface ConversationMemoryPort {
  getRecentTurns(input: { userId: string, sessionId?: string | null, limit?: number }): Array<{ role: string, content: string, created_at?: string }>
  appendTurn(input: { userId: string, sessionId?: string | null, role: "user" | "assistant", content: string, created_at?: string }): void
}

export interface RetrievalPort {
  retrieveRelevant(input: {
    userId: string
    sessionId?: string | null
    query: string
    intent?: string
    topic?: string | null
    limit?: number
    activeModules?: string[]
    bibleStudyModules?: string[]
    conversationHistory?: Array<{ role: string, content: string, created_at?: string }>
  }): Promise<{
    contextSummary?: string
    summary?: string
    knownFactsText?: string
    recentConversationText?: string
    conversationTurns?: Array<{ role: string, content: string, created_at?: string }>
    history?: Array<{ user: string, ai: string, timestamp?: string }>
    userProfile?: Record<string, unknown>
    diagnostics?: Record<string, unknown>
  }>
}

export interface EmbeddingProviderPort {
  embedText(input: { text: string }): Promise<{ embedding: number[], cached: boolean, dimensions: number }>
  embedBatch(input: { texts: string[] }): Promise<Array<{ text: string, embedding: number[], cached: boolean, dimensions: number }>>
  cosineSimilarity(input: { left: number[], right: number[] }): number
}

export interface SemanticMemoryStorePort {
  upsertMany(input: {
    userId: string
    sessionId?: string | null
    items: Array<{
      id?: string
      text: string
      embedding: number[]
      type: "user" | "assistant" | "summary" | "fact" | "history"
      created_at?: string
      metadata?: Record<string, unknown>
    }>
  }): Promise<{ inserted: number, skipped: number }>

  searchSimilar(input: {
    userId: string
    sessionId?: string | null
    queryEmbedding: number[]
    limit?: number
    minSimilarity?: number
    allowedTypes?: Array<"user" | "assistant" | "summary" | "fact" | "history">
  }): Array<{
    id: string
    text: string
    type: "user" | "assistant" | "summary" | "fact" | "history"
    created_at: string
    semanticScore: number
    metadata?: Record<string, unknown>
  }>
}
