/**
 * @param {{ crypto: typeof import("crypto") }} deps
 */
export function createRequireAdminMiddleware({ crypto }) {
  return function requireAdmin(req, res, next) {
    const adminKey = process.env.ADMIN_DASH_KEY
    const allowLocalDebug = process.env.NODE_ENV !== "production" &&
      process.env.ALLOW_LOCAL_ADMIN_DEBUG !== "false"

    if (allowLocalDebug) {
      const ip = String(req.ip || "")
      const host = String(req.hostname || "")
      const isLocalIp = ip === "::1" || ip === "127.0.0.1" || ip.endsWith("127.0.0.1")
      const isLocalHost = host === "localhost" || host === "127.0.0.1"
      if (isLocalIp || isLocalHost) return next()
    }

    if (!adminKey) return next()
    const provided = String(req.get("X-Admin-Key") || req.query.key || "")
    if (
      provided.length === adminKey.length &&
      crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(adminKey))
    ) return next()

    return res.status(401).json({ error: "Unauthorized", code: "ADMIN_REQUIRED" })
  }
}
