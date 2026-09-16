const { proxyToBackend } = require('../../_lib/proxy');
const {
  withMiddleware,
  isValidEthereumAddress,
  isValidChainId,
  sendError,
} = require('../../_lib/utils');

// GET /v1/risk/check
// Proxies to Python backend: /api/v1/address/{address}/risk
async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'BAD_REQUEST', 'Method not allowed');
  }

  const { address, chainId } = req.query || {};

  if (!address) {
    return sendError(res, 400, 'BAD_REQUEST', 'Missing required query parameter: address');
  }
  if (!isValidEthereumAddress(address)) {
    return sendError(res, 400, 'INVALID_ADDRESS', 'Invalid Ethereum address format');
  }

  /* [AUDIT FIX 2026-09-17 R1-024] ① 补 chainId 校验（isValidChainId 此前
     已导入未使用，非法 chainId 直接转发后端）；② 默认链与
     public/risk-check 对齐为 Sepolia(11155111)——v3.1.0 仅部署测试网，
     原默认 1（主网）转发给只有 Sepolia 数据的后端无意义。 */
  if (chainId !== undefined && !isValidChainId(chainId)) {
    return sendError(res, 400, 'INVALID_CHAIN_ID', 'Invalid chain ID');
  }

  // Proxy to backend
  try {
    const response = await proxyToBackend(`/api/v1/address/${address}/risk?chainId=${encodeURIComponent(chainId || 11155111)}`);
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[check] Proxy error:', error.message);
    return sendError(res, 502, 'PROXY_ERROR', 'Backend unavailable');
  }
}

module.exports = withMiddleware(handler);
