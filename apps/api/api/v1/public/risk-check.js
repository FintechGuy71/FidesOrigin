// GET /v1/public/risk-check — 公开只读地址风险查询
//
// 面向 fidesorigin.com 前端（address-check 页）的免 key 公开端点。
// 防护组合：CORS 白名单（withMiddleware）+ 全局 60/min/IP 限流（withMiddleware）
//           + 本端点自带 20/min/IP 更严限流 + 强制 GET-only + 参数严格校验。
// 只读代理到后端 /api/v1/address/{address}/risk，不接受任何写操作。
const { proxyToBackend } = require('../../lib/proxy');
const {
  withMiddleware,
  isValidEthereumAddress,
  isValidChainId,
  sendError,
  SCOPE,
} = require('../../lib/utils');

// ── 端点级限流（内存滑窗，20 req/min/IP）────────────────────────────
const PUBLIC_RATE_MAX = 20;
const PUBLIC_RATE_WINDOW_MS = 60 * 1000;
const buckets = new Map(); // ip -> { windowStart, count }

function publicRateLimitOk(req) {
  const ip =
    req.headers?.['x-real-ip'] ||
    req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  const now = Date.now();
  const windowStart = Math.floor(now / PUBLIC_RATE_WINDOW_MS) * PUBLIC_RATE_WINDOW_MS;
  let bucket = buckets.get(ip);
  if (!bucket || bucket.windowStart !== windowStart) {
    bucket = { windowStart, count: 0 };
    buckets.set(ip, bucket);
  }
  bucket.count += 1;
  // 防止 Map 无界增长：周期性清理过期窗口
  if (buckets.size > 10000) {
    for (const [k, v] of buckets) {
      if (v.windowStart !== windowStart) buckets.delete(k);
    }
  }
  return bucket.count <= PUBLIC_RATE_MAX;
}

async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'BAD_REQUEST', 'Method not allowed');
  }

  if (!publicRateLimitOk(req)) {
    res.setHeader('Retry-After', 60);
    return sendError(res, 429, 'RATE_LIMITED', 'Too many requests, try again later.');
  }

  const { address, chainId } = req.query || {};

  if (!address) {
    return sendError(res, 400, 'BAD_REQUEST', 'Missing required query parameter: address');
  }
  if (!isValidEthereumAddress(address)) {
    return sendError(res, 400, 'INVALID_ADDRESS', 'Invalid Ethereum address format');
  }

  // chainId 可选，默认 Sepolia（11155111）
  const effectiveChainId = chainId === undefined || chainId === '' ? '11155111' : chainId;
  if (!isValidChainId(effectiveChainId)) {
    return sendError(res, 400, 'INVALID_CHAIN', 'Invalid chainId');
  }

  try {
    const response = await proxyToBackend(
      `/api/v1/address/${address}/risk?chainId=${encodeURIComponent(effectiveChainId)}`
    );
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[public/risk-check] Proxy error:', error.message);
    return sendError(res, 502, 'PROXY_ERROR', 'Backend unavailable');
  }
}

module.exports = withMiddleware(handler, SCOPE.PUBLIC);
