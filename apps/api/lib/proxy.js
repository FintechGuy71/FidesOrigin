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
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  return response;
}

/**
 * Create a handler that proxies all methods to a backend path
 * @param {string} backendPath - backend path template (use :param syntax)
 */
function createProxyHandler(backendPathTemplate) {
  return async function handler(req, res) {
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
    for (const [key, value] of response.headers.entries()) {
      if (key.toLowerCase() !== 'content-encoding') {
        res.setHeader(key, value);
      }
    }
    res.json(data);
  };
}

module.exports = {
  BACKEND_API_URL,
  proxyToBackend,
  createProxyHandler,
};
