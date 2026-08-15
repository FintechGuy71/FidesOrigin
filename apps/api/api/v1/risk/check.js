const { proxyToBackend } = require('../../../lib/proxy');
const {
  withMiddleware,
  isValidEthereumAddress,
  isValidChainId,
  sendError,
} = require('../../../lib/utils');

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

  // Proxy to backend
  try {
    const response = await proxyToBackend(`/api/v1/address/${address}/risk?chainId=${encodeURIComponent(chainId || 1)}`);
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[check] Proxy error:', error.message);
    return sendError(res, 502, 'PROXY_ERROR', 'Backend unavailable');
  }
}

module.exports = withMiddleware(handler);
