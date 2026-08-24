const {
  withMiddleware,
  sendError,
} = require('../../lib/utils');
const { proxyToBackend } = require('../../lib/proxy');

// GET /v1/dashboard/stats
// Proxies to Python backend: /api/v1/dashboard/summary
async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'BAD_REQUEST', 'Method not allowed');
  }

  try {
    const response = await proxyToBackend('/api/v1/dashboard/summary');
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return sendError(res, 502, 'PROXY_ERROR', 'Backend unavailable');
  }
}

module.exports = withMiddleware(handler);
