import assert from "node:assert/strict"
import { test } from "node:test"

import { createSportsDbFetch } from "../apps/api/src/sportsDbClient.js"

test("createSportsDbFetch builds correct URL from env config", async () => {
  const calls = []
  const fetchSportsDbJson = createSportsDbFetch(
    {
      THESPORTSDB_API_KEY: "test-key",
      THESPORTSDB_API_BASE_URL: "https://sportsdb.example.com/api/v1/json/test-key"
    },
    async (input, _init) => {
      calls.push(String(input))
      return {
        ok: true,
        async json() { return { teams: [{ idTeam: "1", strTeam: "Flamengo" }] } },
        async text() { return "" }
      }
    }
  )

  const result = await fetchSportsDbJson("searchteams.php", { t: "Flamengo" })
  assert.equal(calls.length, 1)
  assert.ok(calls[0].includes("searchteams.php"), "deve incluir o pathname")
  assert.ok(calls[0].includes("t=Flamengo"), "deve incluir o searchParam")
  assert.ok(calls[0].startsWith("https://sportsdb.example.com"), "deve usar a baseUrl do env")
  assert.deepEqual(result.teams, [{ idTeam: "1", strTeam: "Flamengo" }])
})

test("createSportsDbFetch strips trailing slash from base URL", async () => {
  const calls = []
  const fetchSportsDbJson = createSportsDbFetch(
    { THESPORTSDB_API_BASE_URL: "https://sportsdb.example.com/api/" },
    async (input) => {
      calls.push(String(input))
      return { ok: true, async json() { return {} }, async text() { return "" } }
    }
  )

  await fetchSportsDbJson("eventsseason.php", { id: "4328", s: "2025" })
  assert.ok(!calls[0].includes("//eventsseason"), "nao deve ter barra dupla no path")
})

test("createSportsDbFetch uses fallback key '123' when no env provided", async () => {
  const calls = []
  const fetchSportsDbJson = createSportsDbFetch(
    {},
    async (input) => {
      calls.push(String(input))
      return { ok: true, async json() { return {} }, async text() { return "" } }
    }
  )

  await fetchSportsDbJson("searchteams.php", { t: "Santos" })
  assert.ok(calls[0].includes("/123/"), "deve usar a chave fallback '123' na URL")
})

test("createSportsDbFetch skips null/empty searchParams entries", async () => {
  const calls = []
  const fetchSportsDbJson = createSportsDbFetch(
    { THESPORTSDB_API_BASE_URL: "https://sportsdb.example.com/api/v1/json/key" },
    async (input) => {
      calls.push(String(input))
      return { ok: true, async json() { return {} }, async text() { return "" } }
    }
  )

  await fetchSportsDbJson("eventsseason.php", { id: "4328", s: "", extra: null })
  const url = new URL(calls[0])
  assert.ok(url.searchParams.has("id"), "deve incluir param com valor")
  assert.ok(!url.searchParams.has("s"), "deve ignorar param vazio")
  assert.ok(!url.searchParams.has("extra"), "deve ignorar param null")
})

test("createSportsDbFetch throws SPORTS_SCHEDULE_FAILED on non-ok response", async () => {
  const fetchSportsDbJson = createSportsDbFetch(
    { THESPORTSDB_API_BASE_URL: "https://sportsdb.example.com/api/v1/json/key" },
    async () => ({
      ok: false,
      status: 503,
      async text() { return "Service Unavailable" },
      async json() { return {} }
    })
  )

  await assert.rejects(
    fetchSportsDbJson("searchteams.php", { t: "Botafogo" }),
    (error) => error?.code === "SPORTS_SCHEDULE_FAILED"
  )
})
