const {
  withAdminAuth,
  sendError,
} = require('../../_lib/utils');
const { proxyToBackend } = require('../../_lib/proxy');

// [Auth Fix] GET /v1/dashboard/events
// 与 stats.js 同一套 withAdminAuth 鉴权（JWT role=admin）+
// Bearer 透传后端二次校验。GET 为读操作，无需 HMAC 签名。
async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'BAD_REQUEST', 'Method not allowed');
  }

  try {
    const response = await proxyToBackend('/api/v1/dashboard/events', {
      method: 'GET',
      forwardAuth: true,
      headers: { Authorization: req.headers.authorization },
    });
    const data = await response.json().catch(() => null);
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[dashboard/events] proxy error:', error.message);
    return sendError(res, 502, 'PROXY_ERROR', 'Backend unavailable');
  }
}

module.exports = withAdminAuth(handler);
