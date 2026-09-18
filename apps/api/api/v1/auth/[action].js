const { withMiddleware, SCOPE, sendError } = require('../../_lib/utils');
const { proxyToBackend } = require('../../_lib/proxy');
const { checkRateLimit } = require('../../_middleware/rateLimit');
const {
  setAuthCookies,
  clearAuthCookies,
  readAccessCookie,
  readRefreshCookie,
} = require('../../_lib/cookies');

/* [Auth Fix] POST/GET /v1/auth/[action] —— admin 后台认证（httpOnly cookie 会话）。
   合并多个动作到一个函数（Vercel Hobby 单部署最多 12 个 serverless 函数，
   api/ 下每个 .js 计一个；[action] 动态段复用同一函数名额）。

   动作：
   - action=login   (POST) → 后端 /api/v1/auth/login 换 JWT，设为 httpOnly cookie
   - action=refresh (POST) → 读 refresh cookie → 后端 /api/v1/auth/refresh，重设 cookie
   - action=me      (GET)  → 读 access cookie → 后端 /api/v1/auth/me，返回当前用户
   - action=logout  (POST) → 清空两个 cookie（无需打后端）

   [D1 Fix] 会话存储从 sessionStorage 迁到 httpOnly cookie（JS 不可读，根治 XSS
   窃取 token）。响应体不再回传 token——只回用户信息与过期秒数。
   login/refresh 是公开端点（免 API key，后端已列入签名豁免）；me/logout 同样是
   公开通道，me 的鉴权由 cookie 内 JWT 在后端权威校验完成。限流防凭证爆破。 */

const LOGIN_MAX_AGE_FALLBACK = 1800; // 后端 30min，仅用于响应体 expires_in 兜底

async function handler(req, res) {
  const action = req.query && req.query.action;

  if (!['login', 'refresh', 'me', 'logout'].includes(action)) {
    return sendError(res, 404, 'NOT_FOUND', 'Unknown auth action');
  }

  // me 用 GET，其余用 POST
  const expectedMethod = action === 'me' ? 'GET' : 'POST';
  if (req.method !== expectedMethod) {
    return sendError(res, 405, 'BAD_REQUEST', 'Method not allowed');
  }

  // 端点级限流：login/refresh 防凭证爆破；me/logout 轻量
  const strict = action === 'login' || action === 'refresh';
  const allowed = await checkRateLimit(req, res, {
    max: strict ? 5 : 30,
    window: 60,
    prefix: `ratelimit:auth-${action}`,
  });
  if (!allowed) return;

  // ── logout：纯网关侧清 cookie，无需打后端 ────────────────────────────────
  if (action === 'logout') {
    clearAuthCookies(res);
    return res.status(200).json({ success: true });
  }

  // ── me：读 access cookie → 后端 /me 权威校验 → 返回用户信息 ────────────────
  if (action === 'me') {
    const accessToken = readAccessCookie(req);
    if (!accessToken) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Not authenticated');
    }
    try {
      const response = await proxyToBackend('/api/v1/auth/me', {
        method: 'GET',
        forwardAuth: true,
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json().catch(() => null);
      return res.status(response.status).json(data);
    } catch (error) {
      console.error('[auth/me] proxy error:', error.message);
      return sendError(res, 502, 'PROXY_ERROR', 'Backend unavailable');
    }
  }

  // ── login / refresh：向后端换 token，设为 httpOnly cookie ─────────────────
  const body = req.body || {};
  let backendPath;
  let payload;
  if (action === 'login') {
    // [AUDIT FIX 2026-09-18 R3] 原仅验真值：对象/数组 payload 会无意义打到后端
    if (typeof body.username !== 'string' || typeof body.password !== 'string'
        || !body.username || !body.password
        || body.username.length > 200 || body.password.length > 200) {
      return sendError(res, 400, 'BAD_REQUEST', 'username and password are required (string, max 200 chars)');
    }
    backendPath = '/api/v1/auth/login';
    payload = { username: body.username, password: body.password };
  } else {
    // refresh：优先读 httpOnly refresh cookie；兼容旧前端 body.refresh_token（过渡期）
    const refreshToken = readRefreshCookie(req) || body.refresh_token;
    if (!refreshToken) {
      return sendError(res, 400, 'BAD_REQUEST', 'refresh_token is required');
    }
    backendPath = '/api/v1/auth/refresh';
    payload = { refresh_token: refreshToken };
  }

  try {
    const response = await proxyToBackend(backendPath, {
      method: 'POST',
      body: JSON.stringify(payload),
      // 不代签：后端已将 login/refresh 列入公开端点签名豁免（security.py）。
    });
    const data = await response.json().catch(() => null);

    // 登录/刷新成功：把 token 落到 httpOnly cookie，响应体剔除 token 字段
    if (response.ok && data && data.access_token) {
      setAuthCookies(res, data.access_token, data.refresh_token || '');
      const { access_token, refresh_token, ...safe } = data;
      return res.status(response.status).json({
        ...safe,
        expires_in: safe.expires_in || LOGIN_MAX_AGE_FALLBACK,
      });
    }
    // 失败（401/423/...）原样透传后端响应
    return res.status(response.status).json(data);
  } catch (error) {
    console.error(`[auth/${action}] proxy error:`, error.message);
    return sendError(res, 502, 'PROXY_ERROR', 'Backend unavailable');
  }
}

module.exports = withMiddleware(handler, SCOPE.PUBLIC);
