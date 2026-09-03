const {
  withAdminAuth,
  sendError,
} = require('../../_lib/utils');
const { proxyToBackend } = require('../../_lib/proxy');

// [Auth Fix] GET /v1/dashboard/stats
// 鉴权改造：原 READ scope 静态 API Key → withAdminAuth（JWT role=admin）。
// 网关验签通过后把客户端 Bearer 透传给后端二次校验（forwardAuth）。
// 路径说明：网关对外暴露 /v1/dashboard/stats，
// 代理目标是后端真实存在的聚合端点 /api/v1/dashboard/summary。
// GET 为读操作，无需 HMAC 签名。
async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'BAD_REQUEST', 'Method not allowed');
  }

  try {
    const response = await proxyToBackend('/api/v1/dashboard/summary', {
      method: 'GET',
      forwardAuth: true,
      headers: { Authorization: req.headers.authorization },
    });
    const data = await response.json().catch(() => null);
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[dashboard/stats] proxy error:', error.message);
    return sendError(res, 502, 'PROXY_ERROR', 'Backend unavailable');
  }
}

module.exports = withAdminAuth(handler);
