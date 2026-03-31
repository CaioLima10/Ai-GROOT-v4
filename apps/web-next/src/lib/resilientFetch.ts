/**
 * GIOM Frontend — Connection Resilience
 * ─────────────────────────────────────────────────────────────────
 * Drop-in fetch wrapper with:
 *   - Automatic retry with exponential backoff + jitter
 *   - Request timeout guard
 *   - Per-host circuit breaker (prevents hammering a dead backend)
 *   - SSE-safe (streaming requests are never retried mid-stream)
 *
 * Usage:
 *   import { resilientFetch, resilientPost } from "@/lib/resilientFetch"
 *
 *   // GET with retry
 *   const res = await resilientFetch("/backend/config")
 *
 *   // POST (no automatic retry — callers opt-in via forceRetry)
 *   const res = await resilientPost("/backend/ask", { message })
 *   const res = await resilientPost("/backend/ask", { message }, { forceRetry: true })
 */

// ─── Circuit Breaker ──────────────────────────────────────────────────────────

type CircuitState = "closed" | "open" | "half_open"

interface CircuitEntry {
  state: CircuitState
  failures: number
  openedAt: number
}

const circuits = new Map<string, CircuitEntry>()

function getCircuit(hostname: string): CircuitEntry {
  if (!circuits.has(hostname)) {
    circuits.set(hostname, { state: "closed", failures: 0, openedAt: 0 })
  }
  return circuits.get(hostname)!
}

function recordCircuitSuccess(hostname: string) {
  const c = getCircuit(hostname)
  c.state = "closed"
  c.failures = 0
}

function recordCircuitFailure(hostname: string, threshold: number) {
  const c = getCircuit(hostname)
  c.failures += 1

  if (c.failures >= threshold && c.state === "closed") {
    c.state = "open"
    c.openedAt = Date.now()
  } else if (c.state === "half_open") {
    c.state = "open"
    c.openedAt = Date.now()
  }
}

function isCircuitBlocked(hostname: string, recoveryMs: number): boolean {
  const c = getCircuit(hostname)
  if (c.state === "closed") return false

  if (c.state === "open" && Date.now() - c.openedAt >= recoveryMs) {
    c.state = "half_open"
    return false // allow probe
  }

  return c.state === "open"
}

// ─── Backoff ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function backoffMs(attempt: number, base = 500, max = 12_000): number {
  const exp = Math.min(base * Math.pow(2, attempt), max)
  const jitter = exp * 0.2 * (Math.random() * 2 - 1)
  return Math.round(exp + jitter)
}

function isRetryableStatus(status: number): boolean {
  // 500 do proxy indica falha de conectividade com o backend (não erro da IA),
  // por isso é seguro fazer retry nesses casos.
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504
}

function isRetryableNetworkError(err: unknown): boolean {
  const msg = String((err as Error)?.message || "").toLowerCase()
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("load failed") ||
    msg.includes("fetch") ||
    msg.includes("econnreset") ||
    msg.includes("connection reset") ||
    msg.includes("err_network") ||
    msg.includes("socket hang up")
  )
}

// ─── Options ──────────────────────────────────────────────────────────────────

export interface ResilientFetchOptions extends RequestInit {
  /** Request timeout in ms. Default: 20_000 */
  timeoutMs?: number
  /** Max number of retries. Default: 2 */
  maxRetries?: number
  /** Base backoff delay in ms. Default: 500 */
  retryDelay?: number
  /** Circuit breaker: failures before opening. Default: 4 */
  failureThreshold?: number
  /** Circuit breaker: recovery window in ms. Default: 30_000 */
  recoveryTimeMs?: number
  /** Force retry even on POST/PUT/PATCH. Default: false */
  forceRetry?: boolean
}

const DEFAULTS: Required<
  Pick<ResilientFetchOptions, "timeoutMs" | "maxRetries" | "retryDelay" | "failureThreshold" | "recoveryTimeMs">
> = {
  timeoutMs: 20_000,
  maxRetries: 2,
  retryDelay: 500,
  failureThreshold: 4,
  recoveryTimeMs: 30_000,
}

// ─── Core ─────────────────────────────────────────────────────────────────────

export async function resilientFetch(url: string, options: ResilientFetchOptions = {}): Promise<Response> {
  const cfg = { ...DEFAULTS, ...options }
  const method = (options.method || "GET").toUpperCase()
  const canRetry = cfg.forceRetry || method === "GET" || method === "HEAD"

  let hostname = "localhost"
  try {
    hostname = new URL(url, typeof window !== "undefined" ? window.location.href : "http://localhost").hostname
  } catch {
    /* noop */
  }

  if (isCircuitBlocked(hostname, cfg.recoveryTimeMs)) {
    const err = new Error(`GIOM: backend temporarily unavailable — retrying shortly`)
      ; (err as unknown as Record<string, unknown>).circuitOpen = true
    throw err
  }

  const maxAttempts = canRetry ? cfg.maxRetries + 1 : 1
  // maxAttempts para erros de rede puros (ECONNRESET, socket hang up) — aplica mesmo em POST,
  // porque esses erros indicam que o request NUNCA chegou ao servidor.
  const networkRetryAttempts = cfg.maxRetries + 1
  let lastError: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await sleep(backoffMs(attempt - 1, cfg.retryDelay))
    }

    const controller = new AbortController()

    // Merge with caller's signal if provided
    const callerSignal = options.signal as AbortSignal | null | undefined
    if (callerSignal?.aborted) {
      throw new DOMException("Aborted", "AbortError")
    }
    callerSignal?.addEventListener("abort", () => controller.abort(), { once: true })

    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs)

    // Clean options before passing to native fetch
    const {
      timeoutMs: _t,
      maxRetries: _mr,
      retryDelay: _rd,
      failureThreshold: _ft,
      recoveryTimeMs: _rt,
      forceRetry: _fr,
      signal: _s,
      ...nativeOptions
    } = cfg

    try {
      const response = await fetch(url, { ...nativeOptions, signal: controller.signal })
      clearTimeout(timer)

      if (isRetryableStatus(response.status) && canRetry && attempt < maxAttempts - 1) {
        recordCircuitFailure(hostname, cfg.failureThreshold)
        lastError = new Error(`HTTP ${response.status}`)
        continue
      }

      recordCircuitSuccess(hostname)
      return response
    } catch (err) {
      clearTimeout(timer)

      const isAbort = (err as Error)?.name === "AbortError"
      lastError = isAbort ? new Error(`Request timed out after ${cfg.timeoutMs}ms`) : err

      if (!isAbort || !(options.signal as AbortSignal | null | undefined)?.aborted) {
        recordCircuitFailure(hostname, cfg.failureThreshold)
      }

      // Timeout (isAbort): para imediatamente — o backend pode estar processando.
      // Erro de rede puro (ECONNRESET, socket hang up): retry seguro mesmo em POST,
      // pois o request nunca chegou ao servidor.
      const isNetworkErr = !isAbort && isRetryableNetworkError(err)
      if (isAbort || (!canRetry && !isNetworkErr) || (!isNetworkErr && attempt >= networkRetryAttempts - 1)) break
    }
  }

  throw lastError
}

// ─── Convenience ─────────────────────────────────────────────────────────────

export async function resilientGet(url: string, options: ResilientFetchOptions = {}): Promise<Response> {
  return resilientFetch(url, { ...options, method: "GET" })
}

export async function resilientPost(
  url: string,
  body: unknown,
  options: ResilientFetchOptions = {}
): Promise<Response> {
  return resilientFetch(url, {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...(options.headers as Record<string, string> | undefined) },
    body: JSON.stringify(body),
  })
}

/** Returns current circuit state for all known hosts — useful for debug panels */
export function getCircuitStatus(): Record<string, CircuitEntry> {
  const result: Record<string, CircuitEntry> = {}
  for (const [host, entry] of circuits) {
    result[host] = { ...entry }
  }
  return result
}
