export const DEFAULT_LOCAL_EMBEDDING_DIMENSIONS = 384
export const DEFAULT_OLLAMA_EMBEDDING_DIMENSIONS = 768
export const DEFAULT_OPENAI_EMBEDDING_DIMENSIONS = 1536

function parseDimension(value, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 64) {
    return fallback
  }

  return Math.floor(parsed)
}

export function getLocalEmbeddingDimensions() {
  return parseDimension(process.env.LOCAL_EMBEDDING_DIMENSIONS, DEFAULT_LOCAL_EMBEDDING_DIMENSIONS)
}

export function getOllamaEmbeddingDimensions() {
  return parseDimension(process.env.OLLAMA_EMBEDDING_DIMENSIONS, DEFAULT_OLLAMA_EMBEDDING_DIMENSIONS)
}

export function getOpenAIEmbeddingDimensions() {
  return parseDimension(process.env.OPENAI_EMBEDDING_DIMENSIONS, DEFAULT_OPENAI_EMBEDDING_DIMENSIONS)
}
