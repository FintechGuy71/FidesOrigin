// GET /v1/public/stats — 公开只读聚合统计（官网首页指标带数据源）
//
// 面向 fidesorigin.com 构建期 fetch（scripts/fetch-metrics.mjs）与前端直读。
// 防护组合与 public/risk-check 一致：CORS 白名单（withMiddleware）
//   + 全局 60/min/IP 限流 + 本端点 20/min/IP 更严限流 + 强制 GET-only。
// 只读代理到后端 /api/v1/public/stats（聚合计数，无任何地址级明细）。
const { proxyToBackend } = require('../../_lib/proxy');
const { checkRateLimit } = require('../../_middleware/rateLimit');
const { withMiddleware, sendError, SCOPE } = require('../../_lib/utils');

// 端点级配额：20 req/min/IP（独立计数桶）
const PUBLIC_LIMIT = { max: 20, window: 60, prefix: 'ratelimit:public-stats' };

async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'BAD_REQUEST', 'Method not allowed');
  }

  if (!(await checkRateLimit(req, res, PUBLIC_LIMIT))) return;

  try {
    const response = await proxyToBackend('/api/v1/public/stats');
    const data = await response.json();
    // 聚合指标允许短暂 CDN 缓存（60s），降低源站压力
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[public/stats] Proxy error:', error.message);
    return sendError(res, 502, 'PROXY_ERROR', 'Backend unavailable');
  }
}

module.exports = withMiddleware(handler, SCOPE.PUBLIC);
