export async function createRedisMemoryClient(options = {}) {
  const redisUrl = String(options.redisUrl || process.env.REDIS_URL || "").trim()
  const clusterUrls = String(options.clusterUrls || process.env.REDIS_CLUSTER_URLS || "")
    .split(",")
    .map(entry => entry.trim())
    .filter(Boolean)

  if (!redisUrl && clusterUrls.length === 0) return null

  try {
    const redis = await import("redis")
    const client = clusterUrls.length > 0
      ? redis.createCluster({
        rootNodes: clusterUrls.map(url => ({ url })),
        defaults: {
          socket: {
            reconnectStrategy(retries) {
              return Math.min(2000, 50 * Math.max(1, retries))
            }
          }
        }
      })
      : redis.createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy(retries) {
            return Math.min(2000, 50 * Math.max(1, retries))
          }
        }
      })

    client.on("error", (error) => {
      const logger = options.logger
      if (logger?.warn) {
        logger.warn("redis_memory_client_error", {
          message: error?.message || "redis_error"
        })
      }
    })

    await client.connect()

    const prefix = String(options.prefix || process.env.MEMORY_REDIS_PREFIX || "ai-groot:memory")

    return {
      enabled: true,
      mode: clusterUrls.length > 0 ? "cluster" : "single",
      async getString(key) {
        const value = await client.get(`${prefix}:${key}`)
        return value == null ? null : String(value)
      },
      async getJson(key) {
        const value = await client.get(`${prefix}:${key}`)
        if (!value) return null
        try {
          return JSON.parse(value)
        } catch {
          return null
        }
      },
      async setJson(key, value, ttlSeconds = 0) {
        const serialized = JSON.stringify(value)
        const redisKey = `${prefix}:${key}`
        if (ttlSeconds > 0) {
          await client.set(redisKey, serialized, { EX: Math.max(1, Math.floor(ttlSeconds)) })
          return
        }
        await client.set(redisKey, serialized)
      },
      async setNx(key, value, ttlMs = 5000) {
        const redisKey = `${prefix}:${key}`
        const result = await client.set(redisKey, String(value), {
          NX: true,
          PX: Math.max(100, Math.floor(Number(ttlMs || 0)))
        })
        return result === "OK"
      },
      async del(key) {
        await client.del(`${prefix}:${key}`)
      },
      async delIfValue(key, expectedValue) {
        const redisKey = `${prefix}:${key}`
        const script = "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end"

        try {
          const deleted = await client.eval(script, {
            keys: [redisKey],
            arguments: [String(expectedValue)]
          })
          return Number(deleted || 0) > 0
        } catch {
          const current = await client.get(redisKey)
          if (current !== String(expectedValue)) return false
          const deleted = await client.del(redisKey)
          return Number(deleted || 0) > 0
        }
      },
      async scanKeys(pattern = "*", limit = 200) {
        const fullPattern = `${prefix}:${pattern}`
        const keys = []

        if (typeof client.scanIterator === "function") {
          for await (const key of client.scanIterator({ MATCH: fullPattern, COUNT: 100 })) {
            keys.push(String(key).replace(`${prefix}:`, ""))
            if (keys.length >= limit) break
          }
          return keys
        }

        if (typeof client.keys === "function") {
          const found = await client.keys(fullPattern)
          return (found || []).slice(0, limit).map(key => String(key).replace(`${prefix}:`, ""))
        }

        return []
      },
      async close() {
        try {
          await client.quit()
        } catch {
          // no-op
        }
      }
    }
  } catch (error) {
    const logger = options.logger
    if (logger?.warn) {
      logger.warn("redis_memory_client_unavailable", {
        message: error?.message || "redis_unavailable"
      })
    }
    return null
  }
}
