/**
 * Backend Proxy Utility
 *
 * Forwards requests from Vercel serverless functions to the Python backend.
 * All new endpoints should use this proxy pattern.
 */

const crypto = require('crypto');

const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8000';
// [B-C 合龙] 后端要求 X-API-Key 鉴权（DB 校验），由服务端注入，不透传客户端凭证
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || '';
// [HMAC Sign Fix] 写操作代签密钥：仅在服务端持有，绝不出现在任何响应中
const HMAC_SECRET = process.env.HMAC_SECRET || process.env.SECRET_KEY || '';

// 写操作方法集合：后端对 /api/v1/* 的这些方法强制 HMAC 签名
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * [HMAC Sign Fix] 生成后端要求的请求签名：
 *   signature = HMAC-SHA256(secret, "{method}\n{path}\n{timestamp}\n{body}")，hex 输出
 * 网关在代理写操作时代签——密钥只在服务端，前端无需也无从获取。
 */
function _signRequest(method, backendPath, timestamp, body) {
  const bodyStr = typeof body === 'string' ? body : body ? JSON.stringify(body) : '';
  const payload = `${method}\n${backendPath}\n${timestamp}\n${bodyStr}`;
  return crypto.createHmac('sha256', HMAC_SECRET).update(payload, 'utf8').digest('hex');
}

/**
 * Proxy a request to the Python backend
 * @param {string} backendPath - path on backend (e.g. /api/v1/address/0x.../risk)
 * @param {object} options - fetch options
 *   options.sign        - true 且 method 为写操作时，自动注入
 *                         X-Request-Timestamp / X-Request-Signature 代签头
 *   options.forwardAuth - true 时透传 options.headers.Authorization 给后端
 *                         （用于 dashboard：网关验签后由后端二次校验）
 */
async function proxyToBackend(backendPath, options = {}) {
  const url = `${BACKEND_API_URL}${backendPath}`;
  const method = (options.method || 'GET').toUpperCase();
  try {
    // [HMAC Sign Fix] 写操作代签：签名串中的 body 必须与实际发送的字节一致
    const bodyStr = typeof options.body === 'string'
      ? options.body
      : options.body ? JSON.stringify(options.body) : '';

    const callerHeaders = { ...(options.headers || {}) };
    // [F-7 FIX] 调用方不得覆盖服务端凭证与签名头
    delete callerHeaders['X-API-Key'];
    delete callerHeaders['x-api-key'];
    if (!options.forwardAuth) {
      // 未显式要求透传时，剥离客户端 Authorization，防止凭证被意外转发
      delete callerHeaders['Authorization'];
      delete callerHeaders['authorization'];
    }

    const headers = {
      'Content-Type': 'application/json',
      ...callerHeaders,
      ...(BACKEND_API_KEY ? { 'X-API-Key': BACKEND_API_KEY } : {}),
    };

    if (options.sign && WRITE_METHODS.has(method)) {
      if (!HMAC_SECRET) {
        // fail-closed：未配置密钥时不发送未签名写请求
        console.error('[proxyToBackend] HMAC_SECRET/SECRET_KEY not set — refusing to send unsigned write request.');
        return new Response(JSON.stringify({ error: 'Gateway signing misconfigured' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const timestamp = Math.floor(Date.now() / 1000).toString();
      headers['X-Request-Timestamp'] = timestamp;
      headers['X-Request-Signature'] = _signRequest(method, backendPath, timestamp, bodyStr);
    }

    const { sign, forwardAuth, ...fetchOptions } = options;
    const response = await fetch(url, {
      ...fetchOptions,
      method,
      body: WRITE_METHODS.has(method) ? bodyStr : undefined,
      headers,
    });
    return response;
  } catch (err) {
    // [ERR-FIX] Wrap network errors so callers get a predictable response shape.
    console.error('[proxyToBackend] Network error:', err.message);
    return new Response(JSON.stringify({ error: 'Backend unavailable', detail: err.message }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Create a handler that proxies all methods to a backend path
 * @param {string} backendPath - backend path template (use :param syntax)
 */
function createProxyHandler(backendPathTemplate) {
  return async function handler(req, res) {
    try {
      let backendPath = backendPathTemplate;
      // Replace path params
      const params = req.query || {};
      for (const [key, value] of Object.entries(params)) {
        backendPath = backendPath.replace(`:${key}`, encodeURIComponent(value));
      }

      const response = await proxyToBackend(backendPath, {
        method: req.method,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
      });

      const data = await response.json().catch(() => null);
      res.status(response.status);
      // [L-18 FIX] 响应头白名单：原实现把后端全部响应头无差别复制给客户端
      // （含 Set-Cookie / 内部服务标识等），存在内部信息泄露面。
      const ALLOWED_RESPONSE_HEADERS = new Set([
        'content-type',
        'x-request-id',
        'retry-after',
        'cache-control',
      ]);
      for (const [key, value] of response.headers.entries()) {
        if (ALLOWED_RESPONSE_HEADERS.has(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      }
      res.json(data);
    } catch (err) {
      // [ERR-FIX] Catch unexpected errors in proxy handler
      console.error('[createProxyHandler] Unexpected error:', err.message);
      res.status(500).json({ error: 'Internal proxy error' });
    }
  };
}

module.exports = {
  BACKEND_API_URL,
  proxyToBackend,
  createProxyHandler,
};
