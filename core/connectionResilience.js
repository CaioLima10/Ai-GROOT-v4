/**
 * GIOM CONNECTION RESILIENCE
 * ─────────────────────────────────────────────────────────────────
 * Enterprise-grade fetch wrapper used by both backend and frontend:
 *
 *   - Automatic retry with exponential backoff + jitter
 *   - Per-host circuit breaker (open / half-open / closed)
 *   - Request timeout guard
 *   - Idempotent-safe (only retries GET / non-mutation by default)
 *   - Full state transition logging
 *
 * Usage:
 *   import { resilientFetch } from '../core/connectionResilience.js'
 *   const res = await resilientFetch('https://api.example.com/data')
 */

// ─── Circuit Breaker State ────────────────────────────────────────────────────

const CircuitState = Object.freeze({
  CLOSED: "closed",       // normal — requests pass through
  OPEN: "open",           // failing — requests blocked immediately
  HALF_OPEN: "half_open", // recovering — one probe request allowed
})

const circuits = new Map() // key: hostname → CircuitEntry

function getCircuit(hostname) {
  if (!circuits.has(hostname)) {
    circuits.set(hostname, {
      state: CircuitState.CLOSED,
      failures: 0,
      lastFailure: 0,
      lastSuccess: 0,
      openedAt: 0,
    })
  }
  return circuits.get(hostname)
}

function recordSuccess(hostname) {
  const c = getCircuit(hostname)
  if (c.state !== CircuitState.CLOSED) {
    console.log(`[CIRCUIT] ${hostname}: ${c.state} → closed`)
  }
  c.state = CircuitState.CLOSED
  c.failures = 0
  c.lastSuccess = Date.now()
}

function recordFailure(hostname, options) {
  const c = getCircuit(hostname)
  c.failures += 1
  c.lastFailure = Date.now()

  const threshold = options?.failureThreshold ?? 5
  if (c.failures >= threshold && c.state === CircuitState.CLOSED) {
    c.state = CircuitState.OPEN
    c.openedAt = Date.now()
    console.warn(`[CIRCUIT] ${hostname}: closed → OPEN (${c.failures} failures)`)
  } else if (c.state === CircuitState.HALF_OPEN) {
    c.state = CircuitState.OPEN
    c.openedAt = Date.now()
    console.warn(`[CIRCUIT] ${hostname}: half_open → OPEN (probe failed)`)
  }
}

function isCircuitOpen(hostname, options) {
  const c = getCircuit(hostname)
  if (c.state === CircuitState.CLOSED) return false

  const recoveryMs = options?.recoveryTimeMs ?? 30_000
  const sinceOpen = Date.now() - c.openedAt

  if (c.state === CircuitState.OPEN && sinceOpen >= recoveryMs) {
    c.state = CircuitState.HALF_OPEN
    console.log(`[CIRCUIT] ${hostname}: open → half_open (probing)`)
    return false // allow probe
  }

  return c.state === CircuitState.OPEN
}

export function getCircuitStatus() {
  const result = {}
  for (const [host, c] of circuits.entries()) {
    result[host] = { ...c }
  }
  return result
}

// ─── Retry Logic ─────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function computeBackoff(attempt, baseMs = 500, maxMs = 15_000) {
  const exp = Math.min(baseMs * Math.pow(2, attempt), maxMs)
  // Add jitter ±20% to prevent thundering herd
  const jitter = exp * 0.2 * (Math.random() * 2 - 1)
  return Math.round(exp + jitter)
}

function isRetryableStatus(status) {
  return status === 429 || status === 502 || status === 503 || status === 504
}

function isRetryableError(err) {
  const msg = String(err?.message || "").toLowerCase()
  return (
    err?.name === "AbortError" === false && // don't retry explicit aborts
    (msg.includes("econnreset") ||
      msg.includes("econnrefused") ||
      msg.includes("etimedout") ||
      msg.includes("fetch failed") ||
      msg.includes("network") ||
      msg.includes("socket hang up"))
  )
}

// ─── Core resilientFetch ──────────────────────────────────────────────────────

const DEFAULT_OPTIONS = {
  timeoutMs: 20_000,
  maxRetries: 3,
  retryDelay: 500,
  maxRetryDelay: 15_000,
  failureThreshold: 5,
  recoveryTimeMs: 30_000,
  // By default only retry idempotent methods
  retryMethods: ["GET", "HEAD", "OPTIONS"],
}

/**
 * @param {string} url
 * @param {RequestInit & {
 *   timeoutMs?: number,
 *   maxRetries?: number,
 *   retryDelay?: number,
 *   maxRetryDelay?: number,
 *   failureThreshold?: number,
 *   recoveryTimeMs?: number,
 *   retryMethods?: string[],
 *   forceRetry?: boolean,
 * }} options
 */
export async function resilientFetch(url, options = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options }
  const method = (options?.method || "GET").toUpperCase()
  const canRetry = config.forceRetry || config.retryMethods.includes(method)

  let hostname
  try {
    hostname = new URL(url).hostname
  } catch {
    hostname = "unknown"
  }

  // Block immediately if circuit is open
  if (isCircuitOpen(hostname, config)) {
    const err = new Error(`[CIRCUIT OPEN] ${hostname} — requests blocked during recovery window`)
    err.circuitOpen = true
    err.hostname = hostname
    throw err
  }

  let lastError
  const maxAttempts = canRetry ? config.maxRetries + 1 : 1

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = computeBackoff(attempt - 1, config.retryDelay, config.maxRetryDelay)
      console.log(`[RESILIENCE] ${method} ${url} — retry ${attempt}/${config.maxRetries} in ${delay}ms`)
      await sleep(delay)
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), config.timeoutMs)

    try {
      const fetchOptions = {
        ...options,
        signal: controller.signal,
        // Never pass our custom keys to native fetch
        timeoutMs: undefined,
        maxRetries: undefined,
        retryDelay: undefined,
        maxRetryDelay: undefined,
        failureThreshold: undefined,
        recoveryTimeMs: undefined,
        retryMethods: undefined,
        forceRetry: undefined,
      }

      const response = await fetch(url, fetchOptions)
      clearTimeout(timer)

      if (isRetryableStatus(response.status) && canRetry && attempt < maxAttempts - 1) {
        const retryAfter = response.headers.get("retry-after")
        if (retryAfter) {
          const waitMs = Number(retryAfter) * 1000
          if (Number.isFinite(waitMs) && waitMs > 0) {
            await sleep(Math.min(waitMs, 60_000))
          }
        }
        recordFailure(hostname, config)
        lastError = new Error(`HTTP ${response.status}`)
        continue
      }

      recordSuccess(hostname)
      return response
    } catch (err) {
      clearTimeout(timer)

      if (err?.name === "AbortError") {
        lastError = new Error(`Request timeout after ${config.timeoutMs}ms: ${url}`)
        lastError.isTimeout = true
      } else {
        lastError = err
      }

      recordFailure(hostname, config)

      if (!canRetry || !isRetryableError(err)) {
        break
      }
    }
  }

  throw lastError
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

export async function resilientGet(url, options = {}) {
  return resilientFetch(url, { ...options, method: "GET" })
}

export async function resilientPost(url, body, options = {}) {
  return resilientFetch(url, {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    body: JSON.stringify(body),
    forceRetry: false, // POST not retried by default — callers opt-in
  })
}
