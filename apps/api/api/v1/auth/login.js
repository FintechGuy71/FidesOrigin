const { withMiddleware, SCOPE, sendError } = require('../../lib/utils');
const { proxyToBackend } = require('../../lib/proxy');
const { checkRateLimit } = require('../../middleware/rateLimit');

// [Auth Fix] POST /v1/auth/login
// 公开端点（免 API key），凭 username/password 向后端换取 JWT。
// 写操作由网关代签 HMAC；端点级限流 5 次/分钟防爆破。
async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'BAD_REQUEST', 'Method not allowed');
  }

  // [Auth Fix] 端点级限流：比全局更严，防凭证爆破
  const allowed = await checkRateLimit(req, res, { max: 5, window: 60, prefix: 'ratelimit:auth-login' });
  if (!allowed) return;

  const body = req.body || {};
  if (!body.username || !body.password) {
    return sendError(res, 400, 'BAD_REQUEST', 'username and password are required');
  }

  try {
    const response = await proxyToBackend('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: body.username, password: body.password }),
      sign: true, // [HMAC Sign Fix] 网关代签
    });
    const data = await response.json().catch(() => null);
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[auth/login] proxy error:', error.message);
    return sendError(res, 502, 'PROXY_ERROR', 'Backend unavailable');
  }
}

module.exports = withMiddleware(handler, SCOPE.PUBLIC);
