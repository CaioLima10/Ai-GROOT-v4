#!/usr/bin/env node

import fs from "fs/promises"
import path from "path"

const API_BASE = String(process.env.GIOM_API_URL || "http://127.0.0.1:3000").replace(/\/$/, "")
const REPORT_PATH = path.join(process.cwd(), "reports", "freemium-battery-report.json")

function nowIso() {
  return new Date().toISOString()
}

function tinyUploadPayload(name = "sample.txt") {
  const text = `freemium-battery ${Date.now()}`
  const data = Buffer.from(text, "utf8").toString("base64")
  return {
    name,
    type: "text/plain",
    data
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options)
  const payload = await response.json().catch(() => ({}))
  return { response, payload }
}

async function testHealth(results) {
  const started = Date.now()
  try {
    const { response, payload } = await requestJson(`${API_BASE}/health`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    results.push({
      id: "api-health",
      ok: true,
      durationMs: Date.now() - started,
      details: {
        service: payload?.service || "unknown"
      }
    })
    return true
  } catch (error) {
    results.push({
      id: "api-health",
      ok: false,
      durationMs: Date.now() - started,
      error: error.message
    })
    return false
  }
}

async function testUsageLimitsEndpoint(results, userId) {
  const started = Date.now()
  try {
    const { response, payload } = await requestJson(`${API_BASE}/usage/limits`, {
      headers: {
        "X-User-Id": userId,
        "X-User-Plan": "auth"
      }
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const upload = payload?.limits?.upload
    const image = payload?.limits?.image
    if (!upload || !image) throw new Error("missing upload/image limits")

    results.push({
      id: "usage-limits-endpoint",
      ok: true,
      durationMs: Date.now() - started,
      details: {
        uploadLimit: upload.limit,
        imageLimit: image.limit
      }
    })
  } catch (error) {
    results.push({
      id: "usage-limits-endpoint",
      ok: false,
      durationMs: Date.now() - started,
      error: error.message
    })
  }
}

async function testAuthUploadQuota(results, userId) {
  const started = Date.now()
  let blockedAt = null
  let lastQuota = null

  try {
    for (let i = 1; i <= 10; i += 1) {
      const { response, payload } = await requestJson(`${API_BASE}/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
          "X-User-Plan": "auth"
        },
        body: JSON.stringify(tinyUploadPayload(`auth-${i}.txt`))
      })

      if (response.status === 429) {
        blockedAt = i
        lastQuota = payload?.quota || null
        break
      }

      if (!response.ok) {
        throw new Error(`upload failed at ${i}: HTTP ${response.status}`)
      }

      lastQuota = payload?.quota || null
    }

    const passed = blockedAt === 10
    results.push({
      id: "auth-upload-quota-9-per-24h",
      ok: passed,
      durationMs: Date.now() - started,
      details: {
        blockedAt,
        expectedBlockedAt: 10,
        quota: lastQuota
      },
      error: passed ? undefined : `expected block at request 10, got ${blockedAt}`
    })
  } catch (error) {
    results.push({
      id: "auth-upload-quota-9-per-24h",
      ok: false,
      durationMs: Date.now() - started,
      error: error.message
    })
  }
}

async function testPaidUploadQuota(results, userId) {
  const started = Date.now()
  try {
    let okCount = 0
    for (let i = 1; i <= 12; i += 1) {
      const { response } = await requestJson(`${API_BASE}/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
          "X-User-Plan": "paid"
        },
        body: JSON.stringify(tinyUploadPayload(`paid-${i}.txt`))
      })

      if (response.ok) {
        okCount += 1
        continue
      }

      if (response.status === 429) {
        throw new Error(`paid quota blocked too early at ${i}`)
      }

      throw new Error(`paid upload failed at ${i} with HTTP ${response.status}`)
    }

    results.push({
      id: "paid-upload-not-blocked-early",
      ok: true,
      durationMs: Date.now() - started,
      details: { successCount: okCount }
    })
  } catch (error) {
    results.push({
      id: "paid-upload-not-blocked-early",
      ok: false,
      durationMs: Date.now() - started,
      error: error.message
    })
  }
}

async function testImageQuotaShape(results, userId) {
  const started = Date.now()
  try {
    const { response, payload } = await requestJson(`${API_BASE}/usage/limits`, {
      headers: {
        "X-User-Id": userId,
        "X-User-Plan": "auth"
      }
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const image = payload?.limits?.image
    if (!image) throw new Error("missing image limit")
    if (typeof image.limit !== "number") throw new Error("invalid image limit value")

    results.push({
      id: "image-quota-shape",
      ok: true,
      durationMs: Date.now() - started,
      details: { imageLimit: image.limit, tier: image.tier }
    })
  } catch (error) {
    results.push({
      id: "image-quota-shape",
      ok: false,
      durationMs: Date.now() - started,
      error: error.message
    })
  }
}

async function main() {
  const results = []
  const authUser = `battery-auth-${Date.now()}`
  const paidUser = `battery-paid-${Date.now()}`

  const healthOk = await testHealth(results)
  if (healthOk) {
    await testUsageLimitsEndpoint(results, authUser)
    await testAuthUploadQuota(results, authUser)
    await testPaidUploadQuota(results, paidUser)
    await testImageQuotaShape(results, authUser)
  }

  const total = results.length
  const passed = results.filter((r) => r.ok).length
  const failed = total - passed

  const report = {
    generatedAt: nowIso(),
    apiBase: API_BASE,
    summary: {
      total,
      passed,
      failed,
      successRate: total ? Number((passed / total).toFixed(4)) : 0
    },
    results
  }

  await fs.mkdir(path.join(process.cwd(), "reports"), { recursive: true })
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8")

  console.log(`FREEMIUM_BATTERY_REPORT ${REPORT_PATH}`)
  console.log(`TOTAL ${total}`)
  console.log(`PASSED ${passed}`)
  console.log(`FAILED ${failed}`)

  if (failed > 0) process.exit(1)
}

main().catch((error) => {
  console.error(`FREEMIUM_BATTERY_ERROR ${error.message}`)
  process.exit(1)
})
