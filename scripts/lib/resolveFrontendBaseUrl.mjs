const DEFAULT_FRONTEND_URLS = [
  "http://127.0.0.1:3004",
  "http://127.0.0.1:3003",
  "http://localhost:3004",
  "http://localhost:3003"
]

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim()
  if (!trimmed) return ""

  try {
    const normalized = new URL(trimmed)
    normalized.pathname = normalized.pathname.replace(/\/+$/, "") || "/"
    normalized.search = ""
    normalized.hash = ""
    return normalized.toString().replace(/\/$/, "")
  } catch {
    return trimmed.replace(/\/+$/, "")
  }
}

function uniqueUrls(values = []) {
  return [...new Set(values.map(normalizeBaseUrl).filter(Boolean))]
}

async function canReachUrl(url, timeoutMs) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/json;q=0.9,*/*;q=0.8"
      }
    })

    return response.ok || response.status < 500
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

export async function resolveFrontendBaseUrl(options = {}) {
  const preferredUrl = options.preferredUrl ?? process.env.FRONTEND_URL ?? ""
  const strict = String(options.strict ?? process.env.FRONTEND_URL_STRICT ?? "").trim() === "1"
  const timeoutMs = Math.max(250, Number(options.timeoutMs || process.env.FRONTEND_URL_TIMEOUT_MS || 4_000) || 4_000)
  const fallbackUrls = Array.isArray(options.fallbackUrls) && options.fallbackUrls.length > 0
    ? options.fallbackUrls
    : DEFAULT_FRONTEND_URLS

  const candidates = strict && String(preferredUrl).trim()
    ? uniqueUrls([preferredUrl])
    : uniqueUrls([preferredUrl, ...fallbackUrls])

  const normalizedPreferredUrl = normalizeBaseUrl(preferredUrl)
  const attempts = []

  for (const candidate of candidates) {
    const startedAt = Date.now()
    const reachable = await canReachUrl(candidate, timeoutMs)

    attempts.push({
      url: candidate,
      reachable,
      elapsedMs: Date.now() - startedAt
    })

    if (reachable) {
      return {
        baseUrl: candidate,
        attempts,
        usedFallback: Boolean(normalizedPreferredUrl && candidate !== normalizedPreferredUrl)
      }
    }
  }

  const attemptSummary = attempts.length > 0
    ? attempts.map((attempt) => `${attempt.url} (${attempt.reachable ? "ok" : `falhou em ${attempt.elapsedMs}ms`})`).join(", ")
    : "nenhuma url candidata"

  throw new Error(`Frontend indisponivel. Tentativas: ${attemptSummary}`)
}