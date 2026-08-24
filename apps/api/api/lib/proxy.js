/**
 * Backend Proxy Utility
 *
 * Forwards requests from Vercel serverless functions to the Python backend.
 * All new endpoints should use this proxy pattern.
 */

const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8000';

/**
 * Proxy a request to the Python backend
 * @param {string} backendPath - path on backend (e.g. /api/v1/address/0x.../risk)
 * @param {object} options - fetch options
 */
async function proxyToBackend(backendPath, options = {}) {
  const url = `${BACKEND_API_URL}${backendPath}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
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
