function normalizeUrl(value = "") {
  const trimmed = String(value || "").trim()
  if (!trimmed) return ""

  try {
    return new URL(trimmed).toString().replace(/\/$/, "")
  } catch {
    return trimmed.replace(/\/+$/, "")
  }
}

function toPositiveInteger(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

export const DEFAULT_GIOM_API_PORT = 3001
export const DEFAULT_GIOM_WEB_PORT = 3003
export const DEFAULT_GIOM_WEB_PREVIEW_PORT = 3004

export function resolveGiomApiPort(env = process.env) {
  return toPositiveInteger(env.API_PORT || env.PORT, DEFAULT_GIOM_API_PORT)
}

export function resolveGiomWebPort(env = process.env) {
  return toPositiveInteger(env.WEB_PORT, DEFAULT_GIOM_WEB_PORT)
}

export function resolveGiomWebPreviewPort(env = process.env) {
  return toPositiveInteger(env.WEB_PREVIEW_PORT, DEFAULT_GIOM_WEB_PREVIEW_PORT)
}

export function resolveGiomApiBaseUrl(env = process.env) {
  const explicit = normalizeUrl(
    env.GIOM_API_BASE_URL ||
    env.OPS_BACKEND_URL ||
    env.NEXT_PUBLIC_BACKEND_PROXY_TARGET ||
    ""
  )

  if (explicit) {
    return explicit
  }

  return `http://127.0.0.1:${resolveGiomApiPort(env)}`
}

export function resolveGiomBackendProxyTarget(env = process.env) {
  return resolveGiomApiBaseUrl(env)
}

export function listGiomFrontendBaseUrls(env = process.env) {
  const previewPort = resolveGiomWebPreviewPort(env)
  const webPort = resolveGiomWebPort(env)

  return [
    `http://localhost:${previewPort}`,
    `http://localhost:${webPort}`,
    `http://127.0.0.1:${previewPort}`,
    `http://127.0.0.1:${webPort}`
  ].map(normalizeUrl)
}
