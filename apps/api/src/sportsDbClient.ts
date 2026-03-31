import { buildRequestHeaders } from "./liveWebRuntime.js"

interface SportsDbError extends Error {
  code?: string
  details?: string
}

export type SportsDbFetch = (pathname: string, searchParams?: Record<string, string | null | undefined>) => Promise<Record<string, unknown>>

export function createSportsDbFetch(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch
): SportsDbFetch {
  const apiKey = String(env.THESPORTSDB_API_KEY || "123")
  const baseUrl = String(
    env.THESPORTSDB_API_BASE_URL || `https://www.thesportsdb.com/api/v1/json/${apiKey}`
  ).replace(/\/$/, "")

  return async function fetchSportsDbJson(pathname = "", searchParams = {}) {
    const url = new URL(`${baseUrl}/${pathname.replace(/^\//, "")}`)
    for (const [key, value] of Object.entries(searchParams)) {
      if (value == null || value === "") continue
      url.searchParams.set(key, String(value))
    }

    const response = await fetchImpl(url, {
      headers: buildRequestHeaders()
    })

    if (!response.ok) {
      const details = await response.text().catch(() => "")
      const error: SportsDbError = new Error("Falha ao consultar agenda esportiva.")
      error.code = "SPORTS_SCHEDULE_FAILED"
      error.details = details.slice(0, 400)
      throw error
    }

    return response.json() as Promise<Record<string, unknown>>
  }
}
