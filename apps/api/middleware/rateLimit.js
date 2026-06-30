// [Perf-Fix] Redis-backed sliding window rate limiter with in-memory fallback
// ============================================================================
// This module provides a rate-limiting middleware that can be plugged into
// any Express / Vercel / Node.js HTTP handler.
//
// Algorithm: Sliding Window
//   - Each IP has a counter bucket keyed by the current minute (or custom window).
//   - Requests are counted per window; if the count exceeds the limit, the request
//     is rejected with 429 Too Many Requests.
//
// Environment variables:
//   REDIS_URL            - Redis connection URL (default: redis://localhost:6379)
//   RATE_LIMIT_WINDOW    - Window size in seconds (default: 60)
//   RATE_LIMIT_MAX       - Max requests per window per IP (default: 60)
//
// Usage (Express-style):
//   const { rateLimit } = require('./middleware/rateLimit');
//   app.use(rateLimit);
//
// Usage (Vercel serverless / raw handler):
//   const { checkRateLimit } = require('./middleware/rateLimit');
//   if (!await checkRateLimit(req, res)) return;
// ============================================================================

// Lazy-require ioredis so the module loads gracefully even if ioredis is not installed.
// The module will automatically fall back to the in-memory store if Redis is unavailable.
let Redis;
try {
  Redis = require('ioredis');
} catch (err) {
  console.warn('[RateLimit] ioredis not found, will use in-memory fallback:', err.message);
}

// ── Configuration ───────────────────────────────────────────────────────
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 60; // seconds
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX, 10) || 60; // requests per window

// ── Redis client (lazy init) ──────────────────────────────────────────────
let redisClient = null;
let redisAvailable = false;

function getRedisClient() {
  if (redisClient) return redisClient;
  try {
    redisClient = new Redis(REDIS_URL, {
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) return null; // stop retrying after 3 attempts
        return Math.min(times * 100, 2000);
      },
      maxRetriesPerRequest: 3,
    });
    redisClient.on('connect', () => {
      redisAvailable = true;
      console.log('[RateLimit] Redis connected.');
    });
    redisClient.on('error', (err) => {
      redisAvailable = false;
      // Silently degrade to in-memory; don't crash the server.
      console.warn('[RateLimit] Redis error, falling back to memory:', err.message);
    });
    // Trigger connection attempt
    redisClient.connect().catch(() => {
      redisAvailable = false;
    });
    return redisClient;
  } catch (err) {
    console.warn('[RateLimit] Redis init failed, using memory fallback:', err.message);
    redisAvailable = false;
    return null;
  }
}

// ── In-memory fallback ────────────────────────────────────────────────────
// Used when Redis is unavailable or for local dev. Memory leaks are mitigated
// by a periodic cleanup interval.
const memoryStore = new Map(); // ip -> { count, resetTime }

function cleanupMemoryStore() {
  const now = Date.now();
  for (const [ip, record] of memoryStore.entries()) {
    if (now > record.resetTime) {
      memoryStore.delete(ip);
    }
  }
}
// Clean every 5 minutes to prevent unbounded growth in long-running processes.
setInterval(cleanupMemoryStore, 5 * 60 * 1000);

// ── IP extraction ─────────────────────────────────────────────────────────
function getClientIp(req) {
  // [High Fix] Prefer Vercel's x-real-ip, then x-forwarded-for, then remoteAddress.
  const rawIp =
    req.headers?.['x-real-ip'] ||
    req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  // Strip IPv6 prefix from IPv4-mapped addresses (e.g., ::ffff:192.168.1.1)
  return rawIp.replace(/^::ffff:/, '');
}

// ── Sliding window logic (Redis) ─────────────────────────────────────────
async function checkRateLimitRedis(ip, now) {
  const client = getRedisClient();
  if (!client || !redisAvailable) return null; // let caller fall back

  const windowStart = Math.floor(now / 1000 / RATE_LIMIT_WINDOW) * RATE_LIMIT_WINDOW;
  const key = `ratelimit:${ip}:${windowStart}`;
  const pipeline = client.pipeline();
  pipeline.incr(key);
  pipeline.expire(key, RATE_LIMIT_WINDOW + 1); // +1s buffer for clock skew

  try {
    const results = await pipeline.exec();
    const count = results[0][1]; // result of incr
    if (count > RATE_LIMIT_MAX) {
      return { allowed: false, count };
    }
    return { allowed: true, count };
  } catch (err) {
    console.warn('[RateLimit] Redis pipeline failed:', err.message);
    return null; // fallback to memory
  }
}

// ── Sliding window logic (Memory) ──────────────────────────────────────────
function checkRateLimitMemory(ip, now) {
  const record = memoryStore.get(ip);
  if (!record || now > record.resetTime) {
    // First request in a new window
    memoryStore.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW * 1000,
    });
    return { allowed: true, count: 1 };
  }
  record.count++;
  if (record.count > RATE_LIMIT_MAX) {
    return { allowed: false, count: record.count };
  }
  return { allowed: true, count: record.count };
}

// ── Public API: checkRateLimit ────────────────────────────────────────────
async function checkRateLimit(req, res) {
  const ip = getClientIp(req);
  const now = Date.now();

  // Try Redis first
  let result = await checkRateLimitRedis(ip, now);
  if (result === null) {
    // Fallback to memory
    result = checkRateLimitMemory(ip, now);
  }

  if (!result.allowed) {
    const retryAfter = Math.ceil(RATE_LIMIT_WINDOW - ((now / 1000) % RATE_LIMIT_WINDOW));
    res.setHeader('Retry-After', retryAfter);
    res.status(429).json({
      error: 'Rate limit exceeded. Try again later.',
      retryAfter,
      limit: RATE_LIMIT_MAX,
      window: RATE_LIMIT_WINDOW,
    });
    return false;
  }

  // Optional: expose rate-limit headers for client awareness
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX - result.count));
  return true;
}

// ── Express-style middleware ──────────────────────────────────────────────
function rateLimit(req, res, next) {
  checkRateLimit(req, res).then((allowed) => {
    if (allowed) next();
  });
}

// ── Exports ───────────────────────────────────────────────────────────────
module.exports = {
  checkRateLimit,
  rateLimit,
  // Utilities for testing / introspection
  getRedisClient,
  getMemoryStore: () => memoryStore,
  getConfig: () => ({ REDIS_URL, RATE_LIMIT_WINDOW, RATE_LIMIT_MAX }),
};
