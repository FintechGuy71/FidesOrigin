FROM node:20-alpine AS builder

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
FROM node:20-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S publisher && \
    adduser -S publisher -u 1001

# Copy built files and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

# Create logs directory
RUN mkdir -p /app/logs && chown -R publisher:publisher /app

USER publisher

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:9090/health || exit 1

EXPOSE 9090

CMD ["node", "dist/src/index.js"]
