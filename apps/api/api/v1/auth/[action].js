const { withMiddleware, SCOPE, sendError } = require('../../_lib/utils');
const { proxyToBackend } = require('../../_lib/proxy');
const { checkRateLimit } = require('../../_middleware/rateLimit');

/* [Auth Fix] POST /v1/auth/[action] —— 合并 login 与 refresh 两个端点为一个函数。
   原因：Vercel Hobby 计划单部署最多 12 个 serverless 函数，且 api/ 下每个 .js
   都计为一个。合并动态路由段 [action] 可省一个函数名额，为后续端点留余量。

   - action=login   → 后端 POST /api/v1/auth/login（username/password 换 JWT）
   - action=refresh → 后端 POST /api/v1/auth/refresh（refresh_token 换新 Token）
   两个都是公开端点（免 API key），写操作由网关代签 HMAC。端点级限流 5 次/分钟防爆破，
   按 action 独立计数桶。 */
async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'BAD_REQUEST', 'Method not allowed');
  }

  const action = req.query && req.query.action;
  if (action !== 'login' && action !== 'refresh') {
    return sendError(res, 404, 'NOT_FOUND', 'Unknown auth action');
  }

  // 端点级限流：比全局更严，防凭证爆破；login/refresh 独立计数桶
  const allowed = await checkRateLimit(req, res, {
    max: 5,
    window: 60,
    prefix: `ratelimit:auth-${action}`,
  });
  if (!allowed) return;

  const body = req.body || {};
  let backendPath;
  let payload;
  if (action === 'login') {
    if (!body.username || !body.password) {
      return sendError(res, 400, 'BAD_REQUEST', 'username and password are required');
    }
    backendPath = '/api/v1/auth/login';
    payload = { username: body.username, password: body.password };
  } else {
    if (!body.refresh_token) {
      return sendError(res, 400, 'BAD_REQUEST', 'refresh_token is required');
    }
    backendPath = '/api/v1/auth/refresh';
    payload = { refresh_token: body.refresh_token };
  }

  try {
    const response = await proxyToBackend(backendPath, {
      method: 'POST',
      body: JSON.stringify(payload),
      // 不代签：后端已将 /api/v1/auth/login 与 /refresh 列入公开端点签名豁免
      //（security.py request_signature_middleware 的 public_write_paths）。
    });
    const data = await response.json().catch(() => null);
    return res.status(response.status).json(data);
  } catch (error) {
    console.error(`[auth/${action}] proxy error:`, error.message);
    return sendError(res, 502, 'PROXY_ERROR', 'Backend unavailable');
  }
}

module.exports = withMiddleware(handler, SCOPE.PUBLIC);
