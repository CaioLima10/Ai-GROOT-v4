import {
  imageQuotaAnonPerWindow,
  imageQuotaAuthPerWindow,
  imageQuotaPaidPerWindow,
  imageQuotaWindowHours,
  uploadQuotaAnonPerWindow,
  uploadQuotaAuthPerWindow,
  uploadQuotaPaidPerWindow,
  uploadQuotaWindowHours
} from "./enterpriseAssetsRuntime.js"

const uploadQuotaState = new Map()

function normalizePlan(raw = "") {
  const value = String(raw || "").trim().toLowerCase()
  if (["paid", "pro", "premium", "enterprise", "business"].includes(value)) return "paid"
  if (["login", "logged", "auth", "authenticated", "free_user"].includes(value)) return "auth"
  return "anonymous"
}

export function resolveUploadQuotaContext(req) {
  const userId = String(req.get("X-User-Id") || "").trim()
  const plan = normalizePlan(
    req.get("X-User-Plan") ||
    req.get("X-User-Tier") ||
    req.get("X-Plan") ||
    ""
  )

  const isAdminBypass = Boolean(process.env.ADMIN_DASH_KEY) && req.get("X-Admin-Key") === process.env.ADMIN_DASH_KEY

  const tier = isAdminBypass
    ? "owner"
    : (plan === "paid" ? "paid" : (userId ? "auth" : "anonymous"))

  const identity = userId || String(req.ip || "anonymous")
  const key = `${tier}:${identity}`

  return {
    key,
    tier,
    identity,
    isAdminBypass,
    windowMs: uploadQuotaWindowHours * 60 * 60 * 1000
  }
}

function getFeatureConfig(feature = "upload") {
  if (feature === "image") {
    return {
      feature,
      windowHours: imageQuotaWindowHours,
      limitAnon: imageQuotaAnonPerWindow,
      limitAuth: imageQuotaAuthPerWindow,
      limitPaid: imageQuotaPaidPerWindow
    }
  }

  return {
    feature: "upload",
    windowHours: uploadQuotaWindowHours,
    limitAnon: uploadQuotaAnonPerWindow,
    limitAuth: uploadQuotaAuthPerWindow,
    limitPaid: uploadQuotaPaidPerWindow
  }
}

export function resolveImageQuotaContext(req) {
  const base = resolveUploadQuotaContext(req)
  return {
    ...base,
    key: `image:${base.key}`,
    windowMs: imageQuotaWindowHours * 60 * 60 * 1000
  }
}

export function getTierLimit(tier = "anonymous", feature = "upload") {
  const config = getFeatureConfig(feature)
  if (tier === "owner") return Number.POSITIVE_INFINITY
  if (tier === "paid") return config.limitPaid
  if (tier === "auth") return config.limitAuth
  return config.limitAnon
}

function getQuotaStatus(ctx, feature = "upload") {
  const config = getFeatureConfig(feature)
  const now = Date.now()
  const limit = getTierLimit(ctx.tier, feature)

  if (!Number.isFinite(limit)) {
    return {
      feature: config.feature,
      tier: ctx.tier,
      limit,
      used: 0,
      remaining: Number.POSITIVE_INFINITY,
      resetAt: null,
      windowHours: config.windowHours,
      blocked: false,
      retryAfterSeconds: 0
    }
  }

  const current = uploadQuotaState.get(ctx.key) || { windowStart: now, used: 0 }
  if (now - current.windowStart >= ctx.windowMs) {
    current.windowStart = now
    current.used = 0
  }

  const remaining = Math.max(0, limit - current.used)
  const resetAt = new Date(current.windowStart + ctx.windowMs).toISOString()
  const retryAfterSeconds = remaining > 0
    ? 0
    : Math.max(1, Math.ceil(((current.windowStart + ctx.windowMs) - now) / 1000))

  return {
    feature: config.feature,
    tier: ctx.tier,
    limit,
    used: current.used,
    remaining,
    resetAt,
    windowHours: config.windowHours,
    blocked: remaining <= 0,
    retryAfterSeconds
  }
}

function consumeQuota(ctx, feature = "upload") {
  const config = getFeatureConfig(feature)
  const limit = getTierLimit(ctx.tier, feature)
  if (!Number.isFinite(limit)) {
    return getQuotaStatus(ctx, feature)
  }

  const now = Date.now()
  const current = uploadQuotaState.get(ctx.key) || { windowStart: now, used: 0 }
  if (now - current.windowStart >= ctx.windowMs) {
    current.windowStart = now
    current.used = 0
  }

  current.used += 1
  uploadQuotaState.set(ctx.key, current)

  const remaining = Math.max(0, limit - current.used)
  return {
    feature: config.feature,
    tier: ctx.tier,
    limit,
    used: current.used,
    remaining,
    resetAt: new Date(current.windowStart + ctx.windowMs).toISOString(),
    windowHours: config.windowHours,
    blocked: remaining <= 0,
    retryAfterSeconds: 0
  }
}

export function getUploadQuotaStatus(ctx) {
  return getQuotaStatus(ctx, "upload")
}

export function consumeUploadQuota(ctx) {
  return consumeQuota(ctx, "upload")
}

export function getImageQuotaStatus(ctx) {
  return getQuotaStatus(ctx, "image")
}

export function consumeImageQuota(ctx) {
  return consumeQuota(ctx, "image")
}
