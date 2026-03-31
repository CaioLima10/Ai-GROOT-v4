import test from "node:test"
import assert from "node:assert/strict"

import {
  consumeImageQuota,
  consumeUploadQuota,
  getImageQuotaStatus,
  getTierLimit,
  getUploadQuotaStatus,
  resolveImageQuotaContext,
  resolveUploadQuotaContext
} from "../apps/api/src/enterpriseUploadQuotaRuntime.js"

function makeReq(headers = {}, ip = "127.0.0.1") {
  const map = new Map(Object.entries(headers))
  return {
    ip,
    get(name) {
      return map.get(name) || map.get(name.toLowerCase()) || ""
    }
  }
}

test("resolveUploadQuotaContext detects anonymous and auth tiers", () => {
  const anon = resolveUploadQuotaContext(makeReq({}, "10.0.0.1"))
  assert.equal(anon.tier, "anonymous")

  const auth = resolveUploadQuotaContext(makeReq({ "X-User-Id": "user-123" }, "10.0.0.1"))
  assert.equal(auth.tier, "auth")
  assert.ok(auth.key.includes("auth:user-123"))
})

test("tier limits are coherent for upload and image features", () => {
  const uploadAnon = getTierLimit("anonymous", "upload")
  const uploadAuth = getTierLimit("auth", "upload")
  const imageAnon = getTierLimit("anonymous", "image")
  const imageAuth = getTierLimit("auth", "image")

  assert.ok(uploadAuth >= uploadAnon)
  assert.ok(imageAuth >= imageAnon)
})

test("upload quota consumption decreases remaining within same window", () => {
  const req = makeReq({ "X-User-Id": `u-${Date.now()}-${Math.random()}` }, "10.0.0.2")
  const ctx = resolveUploadQuotaContext(req)

  const before = getUploadQuotaStatus(ctx)
  const after1 = consumeUploadQuota(ctx)
  const after2 = consumeUploadQuota(ctx)

  assert.equal(after1.used, before.used + 1)
  assert.equal(after2.used, before.used + 2)
  assert.equal(after2.remaining, Math.max(0, before.limit - after2.used))
})

test("image quota context uses separate key namespace", () => {
  const req = makeReq({ "X-User-Id": "shared-user" }, "10.0.0.3")
  const uploadCtx = resolveUploadQuotaContext(req)
  const imageCtx = resolveImageQuotaContext(req)

  assert.notEqual(uploadCtx.key, imageCtx.key)
  assert.ok(imageCtx.key.startsWith("image:"))
})

test("upload and image quota counters are independent", () => {
  const req = makeReq({ "X-User-Id": `combo-${Date.now()}-${Math.random()}` }, "10.0.0.4")
  const uploadCtx = resolveUploadQuotaContext(req)
  const imageCtx = resolveImageQuotaContext(req)

  const up0 = getUploadQuotaStatus(uploadCtx)
  const im0 = getImageQuotaStatus(imageCtx)

  const up1 = consumeUploadQuota(uploadCtx)
  const im1 = consumeImageQuota(imageCtx)

  assert.equal(up1.used, up0.used + 1)
  assert.equal(im1.used, im0.used + 1)

  const up2 = getUploadQuotaStatus(uploadCtx)
  const im2 = getImageQuotaStatus(imageCtx)
  assert.equal(up2.used, up1.used)
  assert.equal(im2.used, im1.used)
})
