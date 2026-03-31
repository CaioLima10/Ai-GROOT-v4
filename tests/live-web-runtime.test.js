import assert from "node:assert/strict"

import {
  buildRequestHeaders,
  getLiveWebRuntimeConfig,
  hasGoogleCustomSearchConfigured,
  performGoogleCustomSearch,
  resolveApproximateLocationByIp,
  safeUrlHostname,
  sanitizeGoogleSearchItems
} from "../apps/api/src/liveWebRuntime.js"

function testRuntimeConfigNormalization() {
  const config = getLiveWebRuntimeConfig({
    GOOGLE_SEARCH_API_KEY: " api-key ",
    GOOGLE_SEARCH_ENGINE_ID: " cx-id ",
    GOOGLE_CUSTOM_SEARCH_API_BASE_URL: "https://customsearch.example.com/",
    IP_GEOLOCATION_API_BASE_URL: "https://geo.example.com/",
    RESEARCH_BLOCKED_DOMAINS: "bad.com, foo.bar ",
    LIVE_RESEARCH_USER_AGENT: "GIOM-Test/2.0"
  })

  assert.equal(config.googleSearchApiKey, "api-key")
  assert.equal(config.googleSearchEngineId, "cx-id")
  assert.equal(config.googleCustomSearchApiBaseUrl, "https://customsearch.example.com")
  assert.equal(config.ipGeolocationApiBaseUrl, "https://geo.example.com")
  assert.deepEqual(config.blockedDomains, ["bad.com", "foo.bar"])
  assert.equal(buildRequestHeaders(config)["User-Agent"], "GIOM-Test/2.0")
  assert.equal(hasGoogleCustomSearchConfigured(config), true)
}

function testSafeUrlHostnameAndSanitizeItems() {
  const items = sanitizeGoogleSearchItems([
    {
      title: "Resultado valido",
      link: "https://example.com/path",
      displayLink: "example.com",
      snippet: "Resumo"
    },
    {
      title: "Bloqueado",
      link: "https://sub.bad.com/post",
      displayLink: "bad.com",
      snippet: "Nao deve passar"
    },
    {
      title: "",
      link: "https://example.com/sem-titulo"
    }
  ], {
    blockedDomains: ["bad.com"]
  })

  assert.equal(safeUrlHostname("https://Sub.Example.com/news"), "sub.example.com")
  assert.equal(safeUrlHostname("nao-e-url"), "")
  assert.equal(items.length, 1)
  assert.equal(items[0]?.title, "Resultado valido")
}

async function testPerformGoogleCustomSearchFiltersAllowedHosts() {
  const calls = []
  const payload = await performGoogleCustomSearch("Flamengo proximo jogo", {
    num: 6,
    hl: "pt-BR",
    gl: "br",
    allowedHosts: ["example.com", "news.com"]
  }, {
    config: {
      googleSearchApiKey: "key-1",
      googleSearchEngineId: "cx-1",
      googleCustomSearchApiBaseUrl: "https://customsearch.example.com/v1",
      ipGeolocationApiBaseUrl: "https://geo.example.com",
      blockedDomains: ["blocked.com"],
      userAgent: "GIOM-Test/2.0"
    },
    fetchImpl: async (input, init = {}) => {
      calls.push({
        url: String(input),
        headers: init.headers
      })

      return {
        ok: true,
        async json() {
          return {
            items: [
              {
                title: "GE Flamengo",
                link: "https://example.com/flamengo",
                displayLink: "example.com",
                snippet: "Agenda confirmada"
              },
              {
                title: "Host bloqueado",
                link: "https://sub.blocked.com/flamengo",
                displayLink: "blocked.com",
                snippet: "Nao deve aparecer"
              },
              {
                title: "Host fora da allowlist",
                link: "https://other.net/flamengo",
                displayLink: "other.net",
                snippet: "Nao deve aparecer"
              }
            ]
          }
        },
        async text() {
          return ""
        }
      }
    }
  })

  assert.equal(calls.length, 1)
  assert.ok(calls[0]?.url.includes("q=Flamengo+proximo+jogo"))
  assert.ok(calls[0]?.url.includes("cx=cx-1"))
  assert.equal(calls[0]?.headers?.["User-Agent"], "GIOM-Test/2.0")
  assert.equal(payload.provider, "google_custom_search")
  assert.equal(payload.items.length, 1)
  assert.equal(payload.items[0]?.displayLink, "example.com")
}

async function testPerformGoogleCustomSearchDisabled() {
  await assert.rejects(
    performGoogleCustomSearch("teste", {}, {
      config: {
        googleSearchApiKey: "",
        googleSearchEngineId: "",
        googleCustomSearchApiBaseUrl: "https://customsearch.example.com/v1",
        ipGeolocationApiBaseUrl: "https://geo.example.com",
        blockedDomains: [],
        userAgent: "GIOM-Test/2.0"
      },
      fetchImpl: async () => {
        throw new Error("nao deveria chamar fetch")
      }
    }),
    (error) => error?.code === "GOOGLE_CUSTOM_SEARCH_DISABLED"
  )
}

async function testResolveApproximateLocationByIp() {
  const calls = []
  const location = await resolveApproximateLocationByIp("::ffff:10.0.0.2", {
    config: {
      googleSearchApiKey: "key-1",
      googleSearchEngineId: "cx-1",
      googleCustomSearchApiBaseUrl: "https://customsearch.example.com/v1",
      ipGeolocationApiBaseUrl: "https://geo.example.com",
      blockedDomains: [],
      userAgent: "GIOM-Test/2.0"
    },
    fetchImpl: async (input, init = {}) => {
      calls.push({
        url: String(input),
        headers: init.headers
      })

      return {
        ok: true,
        async json() {
          return {
            success: true,
            city: "Campinas",
            region: "Sao Paulo",
            country: "Brazil",
            timezone: { id: "America/Sao_Paulo" },
            latitude: -22.9,
            longitude: -47.06
          }
        }
      }
    }
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.url, "https://geo.example.com/")
  assert.equal(calls[0]?.headers?.["User-Agent"], "GIOM-Test/2.0")
  assert.equal(location?.label, "Campinas - Sao Paulo")
  assert.equal(location?.timezone, "America/Sao_Paulo")
  assert.equal(location?.forecastDays, 3)
}

async function testResolveApproximateLocationByIpWithoutCoordinates() {
  const location = await resolveApproximateLocationByIp("8.8.8.8", {
    config: {
      googleSearchApiKey: "key-1",
      googleSearchEngineId: "cx-1",
      googleCustomSearchApiBaseUrl: "https://customsearch.example.com/v1",
      ipGeolocationApiBaseUrl: "https://geo.example.com",
      blockedDomains: [],
      userAgent: "GIOM-Test/2.0"
    },
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          success: true,
          country: "Brazil"
        }
      }
    })
  })

  assert.equal(location, null)
}

testRuntimeConfigNormalization()
testSafeUrlHostnameAndSanitizeItems()
await testPerformGoogleCustomSearchFiltersAllowedHosts()
await testPerformGoogleCustomSearchDisabled()
await testResolveApproximateLocationByIp()
await testResolveApproximateLocationByIpWithoutCoordinates()

console.log("live-web-runtime tests passed")
