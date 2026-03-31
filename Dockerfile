# ── Stage 1: dependency install ──────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Install only production deps in a clean layer
COPY package*.json ./
COPY pnpm-workspace.yaml* ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ── Stage 2: production image ─────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Security: don't run as root
RUN addgroup -S giom && adduser -S giom -G giom

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source (exclude dev files via .dockerignore)
COPY apps/ ./apps/
COPY core/ ./core/
COPY agents/ ./agents/
COPY config/ ./config/
COPY coreIdentity/ ./coreIdentity/
COPY coreMind/ ./coreMind/
COPY scripts/ ./scripts/
COPY package.json ./
COPY grootCore.js groot-quantum.js ./

# Create required runtime directories and assign ownership
RUN mkdir -p logs reports backups/memory .groot-memory \
  && chown -R giom:giom /app

USER giom

# Expose port
EXPOSE 3000

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV GROOT_MODE=quantum
ENV GROOT_AI_PROVIDER=auto

# Health check — lightweight TCP probe via Node built-in http
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 \
  CMD node -e "require('http').get({hostname:'localhost',port:3000,path:'/health',timeout:8000},(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Start
CMD ["node", "apps/api/src/server.js"]
