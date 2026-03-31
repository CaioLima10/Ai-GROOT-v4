import assert from "node:assert/strict"

import { summarizeGoogleSearchResults, getLiveResearchRuntime } from "../apps/api/src/liveResearch.js"
import { buildClockVerificationMeta } from "../apps/api/src/runtimeClock.js"

function testLiveResearchRuntimeShape() {
  const runtime = getLiveResearchRuntime()

  assert.equal(typeof runtime.googleSearch, "boolean")
  assert.equal(typeof runtime.googleImageSearch, "boolean")
  assert.equal(typeof runtime.liveWeb, "boolean")
  assert.equal(typeof runtime.sportsSchedule, "boolean")
}

function testSearchSummaryShape() {
  const summary = summarizeGoogleSearchResults({
    provider: "google_custom_search",
    items: [
      {
        title: "Open-Meteo forecast",
        link: "https://example.com/weather",
        displayLink: "example.com",
        snippet: "Weather forecast summary"
      }
    ]
  })

  assert.ok(summary.includes("1. Open-Meteo forecast"))
  assert.ok(summary.includes("Fonte: example.com"))
}

function testClockVerificationMetaShape() {
  const meta = buildClockVerificationMeta({
    nowMs: 1_700_000_000_000,
    unixTime: 1_700_000_000,
    utcIso: "2023-11-14T22:13:20.000Z",
    localIso: "2023-11-14T22:13:20.000Z",
    timezone: "Etc/UTC",
    utcOffset: "+00:00",
    source: "system_clock",
    verified: false,
    fetchedAt: "2023-11-14T22:13:20.000Z"
  })

  assert.equal(meta?.source, "system_clock")
  assert.equal(meta?.verified, false)
  assert.equal(meta?.timezone, "Etc/UTC")
  assert.equal(meta?.nowUtc, "2023-11-14T22:13:20.000Z")
}

testLiveResearchRuntimeShape()
testSearchSummaryShape()
testClockVerificationMetaShape()

console.log("api-runtime-contracts tests passed")
