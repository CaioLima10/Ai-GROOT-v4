// @ts-check

import { buildRequestHeaders } from "./liveWebRuntime.js"

/** @typedef {Error & { code?: string, details?: string }} SportsDbError */

/**
 * Creates an environment-bound fetch function for the TheSportsDB API.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @param {typeof fetch} [fetchImpl]
 * @returns {(pathname: string, searchParams?: Record<string, string>) => Promise<Record<string, unknown>>}
 */
export function createSportsDbFetch(env = process.env, fetchImpl = fetch) {
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
      /** @type {SportsDbError} */
      const error = new Error("Falha ao consultar agenda esportiva.")
      error.code = "SPORTS_SCHEDULE_FAILED"
      error.details = details.slice(0, 400)
      throw error
    }

    return response.json()
  }
}
