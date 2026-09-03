const { withMiddleware, SCOPE, sendError } = require('../../lib/utils');
const { proxyToBackend } = require('../../lib/proxy');
const { checkRateLimit } = require('../../middleware/rateLimit');

// [Auth Fix] POST /v1/auth/refresh
// 公开端点（免 API key），凭 refresh_token 换取新 Token。
// 写操作由网关代签 HMAC；端点级限流 5 次/分钟。
async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'BAD_REQUEST', 'Method not allowed');
  }

  // [Auth Fix] 端点级限流：与 login 同配额、独立计数桶
  const allowed = await checkRateLimit(req, res, { max: 5, window: 60, prefix: 'ratelimit:auth-refresh' });
  if (!allowed) return;

  const body = req.body || {};
  if (!body.refresh_token) {
    return sendError(res, 400, 'BAD_REQUEST', 'refresh_token is required');
  }

  try {
    const response = await proxyToBackend('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: body.refresh_token }),
      sign: true, // [HMAC Sign Fix] 网关代签
    });
    const data = await response.json().catch(() => null);
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[auth/refresh] proxy error:', error.message);
    return sendError(res, 502, 'PROXY_ERROR', 'Backend unavailable');
  }
}

module.exports = withMiddleware(handler, SCOPE.PUBLIC);
