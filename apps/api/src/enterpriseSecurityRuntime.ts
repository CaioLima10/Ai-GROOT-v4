import type { Express, Request, Response, NextFunction } from "express"

type ConfigureEnterpriseSecurityInput = {
  cors: (...args: any[]) => any
  hpp: (...args: any[]) => any
  compression: ((...args: any[]) => any) & { filter: (req: Request, res: Response) => boolean }
  helmet: (...args: any[]) => any
  rateLimit: (...args: any[]) => any
  slowDown: (...args: any[]) => any
  express: { json: (input: Record<string, unknown>) => any }
}

function isDevLoopbackOrigin(origin: string) {
  try {
    const parsed = new URL(origin)
    return ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)
  } catch {
    return false
  }
}

export function configureEnterpriseSecurity(app: Express, deps: ConfigureEnterpriseSecurityInput) {
  const { cors, hpp, compression, helmet, rateLimit, slowDown, express } = deps

  const configuredAllowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)

  const allowDevOrigins = process.env.NODE_ENV !== "production"
  const allowedOrigins = Array.from(new Set([
    ...configuredAllowedOrigins
  ]))

  const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true)
      if (allowDevOrigins && isDevLoopbackOrigin(origin)) {
        return callback(null, true)
      }
      if (allowedOrigins.length === 0) {
        if (process.env.NODE_ENV === "production") {
          console.warn("[CORS] ALLOWED_ORIGINS not configured — allowing all origins. Set ALLOWED_ORIGINS env var to restrict.")
        }
        return callback(null, true)
      }
      if (allowedOrigins.includes(origin)) return callback(null, true)
      return callback(new Error("Not allowed by CORS"))
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-User-Id", "X-Admin-Key"],
    optionsSuccessStatus: 204
  }

  app.use(cors(corsOptions))
  app.use(hpp())
  app.use(compression({
    filter: (req: Request, res: Response) => {
      if (req.path === "/ask/stream") return false
      return compression.filter(req, res)
    }
  }))

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", process.env.SUPABASE_URL || ""].filter(Boolean),
        frameAncestors: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false
  }))

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(self)")
    next()
  })

  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.RATE_LIMIT_GLOBAL || 600),
    standardHeaders: true,
    legacyHeaders: false
  })

  const askLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.RATE_LIMIT_ASK || 60),
    standardHeaders: true,
    legacyHeaders: false
  })

  const askSlowDown = slowDown({
    windowMs: 60 * 1000,
    delayAfter: Number(process.env.SLOWDOWN_AFTER || 30),
    delayMs: () => Number(process.env.SLOWDOWN_DELAY_MS || 350)
  })

  app.use(globalLimiter)
  app.use(express.json({ limit: process.env.REQUEST_LIMIT || "4mb", strict: true }))

  return {
    askLimiter,
    askSlowDown
  }
}
