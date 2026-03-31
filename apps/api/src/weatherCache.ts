export interface TimedCacheEntry<T> {
  value: T
  expiresAt: number
}

export function readTimedCache<T>(cache: Map<string, TimedCacheEntry<T>>, key: string): T | null {
  if (!cache || !key) return null
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key)
    return null
  }
  return entry.value
}

export function writeTimedCache<T>(
  cache: Map<string, TimedCacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number
): T {
  if (!cache || !key) return value
  cache.set(key, { value, expiresAt: Date.now() + ttlMs })
  return value
}
