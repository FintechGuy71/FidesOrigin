# ── Build Stage ───────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies (for native modules)
RUN apk add --no-cache python3 make g++

# Copy dependency manifests
COPY data-publisher/package*.json ./
COPY data-publisher/tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code (src + scripts)
COPY data-publisher/src ./src
COPY data-publisher/scripts ./scripts

# Build TypeScript
RUN npm run build

# ── Production Stage ──────────────────────────────────────────────────
FROM node:20-alpine AS production

# Security: run as non-root
RUN addgroup -g 1001 -S fides && \
    adduser -u 1001 -S fides -G fides

WORKDIR /app

# Install production dependencies only
COPY data-publisher/package*.json ./
# D1-AUDIT1-086 fix: use --omit=dev instead of deprecated --only=production
RUN npm ci --omit=dev && npm cache clean --force

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Create logs directory
RUN mkdir -p /app/logs && chown -R fides:fides /app

USER fides

EXPOSE 9090

# [Medium Fix #57] NODE_ENV=production is explicitly set for security.
# This disables development-only code paths that may skip authentication.
ENV NODE_ENV=production
ENV LOG_LEVEL=info

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:9090/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/src/index.js"]
