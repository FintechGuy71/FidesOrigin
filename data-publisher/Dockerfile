FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files (including lock file for reproducible builds)
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY scripts/ ./scripts/

# Build TypeScript
RUN npm run build

# Production image
FROM node:22-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S publisher && \
    adduser -S publisher -u 1001

# Copy built files
COPY --from=builder /app/dist ./dist
COPY package.json package-lock.json ./

# [P2-Fix] Install only production dependencies to reduce image size
RUN npm ci --omit=dev && npm cache clean --force

# Create logs directory
RUN mkdir -p /app/logs && chown -R publisher:publisher /app

USER publisher

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:9090/health || exit 1

EXPOSE 9090

CMD ["node", "dist/src/index.js"]
