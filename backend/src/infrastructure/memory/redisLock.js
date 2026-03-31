function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function createLockToken() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export async function acquireDistributedLock({
  distributedClient,
  key,
  ttlMs = 5000
}) {
  if (!distributedClient?.setNx || !key) return null

  const token = createLockToken()
  const acquired = await distributedClient.setNx(`lock:${key}`, token, ttlMs)
  return acquired ? token : null
}

export async function releaseDistributedLock({
  distributedClient,
  key,
  token
}) {
  if (!distributedClient || !key || !token) return false

  if (typeof distributedClient.delIfValue === "function") {
    return distributedClient.delIfValue(`lock:${key}`, token)
  }

  const current = typeof distributedClient.getString === "function"
    ? await distributedClient.getString(`lock:${key}`)
    : null

  if (current !== token) return false
  if (typeof distributedClient.del !== "function") return false
  await distributedClient.del(`lock:${key}`)
  return true
}

export async function waitForDistributedLock({
  distributedClient,
  key,
  ttlMs = 5000,
  timeoutMs = 2500,
  retryIntervalMs = 35
}) {
  if (!distributedClient || !key) {
    return {
      token: null,
      waitedMs: 0,
      timedOut: false
    }
  }

  const startedAt = Date.now()
  while ((Date.now() - startedAt) < timeoutMs) {
    const token = await acquireDistributedLock({
      distributedClient,
      key,
      ttlMs
    })

    if (token) {
      return {
        token,
        waitedMs: Date.now() - startedAt,
        timedOut: false
      }
    }

    await sleep(retryIntervalMs)
  }

  return {
    token: null,
    waitedMs: Date.now() - startedAt,
    timedOut: true
  }
}
