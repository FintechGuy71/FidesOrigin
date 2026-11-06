const { proxyToBackend } = require('../../../_lib/proxy');
const {
  withMiddleware,
  isValidEthereumAddress,
  isValidChainId,
  getChainName,
  sendError,
} = require('../../../_lib/utils');

// GET /v1/risk/address/:address
async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'BAD_REQUEST', 'Method not allowed');
  }

  const { address, chainId = '11155111' } = req.query || {};

  if (!address) {
    return sendError(res, 400, 'BAD_REQUEST', 'Missing address path parameter');
  }
  if (!isValidEthereumAddress(address)) {
    return sendError(res, 400, 'INVALID_ADDRESS', 'Invalid Ethereum address format');
  }
  if (!isValidChainId(chainId)) {
    return sendError(res, 400, 'INVALID_CHAIN_ID', 'Invalid chain ID');
  }
  const chain = getChainName(chainId);
  if (chain === 'unknown') {
    return sendError(res, 400, 'UNSUPPORTED_CHAIN', 'Unsupported chain ID');
  }

  try {
    const response = await proxyToBackend(`/api/v1/address/${address}/risk?chain=${chain}`);
    const data = await response.json().catch(() => null);
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[risk/address] Proxy error:', error.message);
    return sendError(res, 502, 'PROXY_ERROR', 'Backend unavailable');
  }
}

module.exports = withMiddleware(handler);
