// [Perf-Fix] Redis-backed fixed-window rate limiter with in-memory fallback
// ============================================================================
// This module provides a rate-limiting middleware that can be plugged into
// any Express / Vercel / Node.js HTTP handler.
//
// Algorithm: Fixed Window (tumbling)
//   [AUDIT-FIX] 修正注释：实现按 Math.floor(now/window)*window 取整到固定窗口
//   计数，并非滑动窗口。窗口交界处存在 2x 突发的理论边界（固定窗口固有特性），
//   如需精确滑动窗口应改用 ZSET + ZREMRANGEBYSCORE 方案。
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
// [M-12 FIX] 代理头默认不受信任：客户端可伪造 x-real-ip / x-forwarded-for
// 无限轮换绕过限流。默认仅取 TCP 对端地址；仅在 TRUST_PROXY=true（部署于
// 会剥离/覆写这些头的可信反向代理之后）时才信任代理头。
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';

function getClientIp(req) {
  if (TRUST_PROXY) {
    const rawIp =
      req.headers?.['x-real-ip'] ||
      req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown';
    // Strip IPv6 prefix from IPv4-mapped addresses (e.g., ::ffff:192.168.1.1)
    return rawIp.replace(/^::ffff:/, '');
  }
  const remote = req.socket?.remoteAddress || 'unknown';
  return remote.replace(/^::ffff:/, '');
}

// ── Fixed-window counter logic (Redis) ────────────────────────────────────
async function checkRateLimitRedis(ip, now, opts) {
  const client = getRedisClient();
  if (!client || !redisAvailable) return null; // let caller fall back

  const { max, window, prefix } = opts;
  const windowStart = Math.floor(now / 1000 / window) * window;
  const key = `${prefix}:${ip}:${windowStart}`;
  const pipeline = client.pipeline();
  pipeline.incr(key);
  pipeline.expire(key, window + 1); // +1s buffer for clock skew

  try {
    const results = await pipeline.exec();
    const count = results[0][1]; // result of incr
    if (count > max) {
      return { allowed: false, count };
    }
    return { allowed: true, count };
  } catch (err) {
    console.warn('[RateLimit] Redis pipeline failed:', err.message);
    return null; // fallback to memory
  }
}

// ── Fixed-window counter logic (Memory) ─────────────────────────────────────
function checkRateLimitMemory(ip, now, opts) {
  const { max, window, prefix } = opts;
  const key = `${prefix}:${ip}`;
  const record = memoryStore.get(key);
  if (!record || now > record.resetTime) {
    // First request in a new window
    memoryStore.set(key, {
      count: 1,
      resetTime: now + window * 1000,
    });
    return { allowed: true, count: 1 };
  }
  record.count++;
  if (record.count > max) {
    return { allowed: false, count: record.count };
  }
  return { allowed: true, count: record.count };
}

// ── Public API: checkRateLimit ────────────────────────────────────────────
// opts: { max, window(秒), prefix } — 端点可施加比全局更严的独立配额
// （独立 prefix = 独立计数桶；Redis 后端跨实例一致，内存降级仅单实例）
async function checkRateLimit(req, res, opts = {}) {
  const { max = RATE_LIMIT_MAX, window = RATE_LIMIT_WINDOW, prefix = 'ratelimit' } = opts;
  const ip = getClientIp(req);
  const now = Date.now();
  const o = { max, window, prefix };

  // Try Redis first
  let result = await checkRateLimitRedis(ip, now, o);
  if (result === null) {
    // Fallback to memory
    result = checkRateLimitMemory(ip, now, o);
  }

  if (!result.allowed) {
    const retryAfter = Math.ceil(window - ((now / 1000) % window));
    res.setHeader('Retry-After', retryAfter);
    res.status(429).json({
      error: 'Rate limit exceeded. Try again later.',
      retryAfter,
      limit: max,
      window,
    });
    return false;
  }

  // Optional: expose rate-limit headers for client awareness
  res.setHeader('X-RateLimit-Limit', max);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, max - result.count));
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
