// GET /v1/public/risk-check — 公开只读地址风险查询
//
// 面向 fidesorigin.com 前端（address-check 页）的免 key 公开端点。
// 防护组合：CORS 白名单（withMiddleware）+ 全局 60/min/IP 限流（withMiddleware）
//           + 本端点 20/min/IP 更严限流（共享 middleware/rateLimit.js ——
//             Redis 后端跨实例一致，IP 提取走 TRUST_PROXY 语义）
//           + 强制 GET-only + 参数严格校验。
// 只读代理到后端 /api/v1/address/{address}/risk，不接受任何写操作。
const { proxyToBackend } = require('../../_lib/proxy');
const { checkRateLimit } = require('../../_middleware/rateLimit');
const {
  withMiddleware,
  isValidEthereumAddress,
  isValidChainId,
  sendError,
  SCOPE,
} = require('../../_lib/utils');

// 端点级配额：20 req/min/IP（与全局限流不同的独立计数桶）
const PUBLIC_LIMIT = { max: 20, window: 60, prefix: 'ratelimit:public' };

async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'BAD_REQUEST', 'Method not allowed');
  }

  // 端点级更严限流（Redis 后端；跨 serverless 实例一致）
  if (!(await checkRateLimit(req, res, PUBLIC_LIMIT))) return;

  const { address, chainId } = req.query || {};

  if (!address) {
    return sendError(res, 400, 'BAD_REQUEST', 'Missing required query parameter: address');
  }
  if (!isValidEthereumAddress(address)) {
    return sendError(res, 400, 'INVALID_ADDRESS', 'Invalid Ethereum address format');
  }

  // chainId 可选，默认 Sepolia（11155111）
  const effectiveChainId = chainId === undefined || chainId === '' ? '11155111' : chainId;
  if (!isValidChainId(effectiveChainId)) {
    return sendError(res, 400, 'INVALID_CHAIN', 'Invalid chainId');
  }

  try {
    const response = await proxyToBackend(
      `/api/v1/address/${address}/risk?chainId=${encodeURIComponent(effectiveChainId)}`
    );
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[public/risk-check] Proxy error:', error.message);
    return sendError(res, 502, 'PROXY_ERROR', 'Backend unavailable');
  }
}

module.exports = withMiddleware(handler, SCOPE.PUBLIC);
