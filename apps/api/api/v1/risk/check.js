const {
  withMiddleware,
  isValidEthereumAddress,
  isValidChainId,
  sendError,
  getRiskData,
  buildRiskCheckResult,
} = require('../../../lib/utils');

// GET /v1/risk/check
// Query params: address (required), chainId (required), amount (optional)
async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'BAD_REQUEST', 'Method not allowed');
  }

  const { address, chainId, amount } = req.query || {};

  if (!address) {
    return sendError(res, 400, 'BAD_REQUEST', 'Missing required query parameter: address');
  }
  if (!isValidEthereumAddress(address)) {
    return sendError(res, 400, 'INVALID_ADDRESS', 'Invalid Ethereum address format');
  }
  if (!chainId) {
    return sendError(res, 400, 'BAD_REQUEST', 'Missing required query parameter: chainId');
  }
  if (!isValidChainId(chainId)) {
    return sendError(res, 400, 'INVALID_CHAIN_ID', 'Invalid chain ID');
  }

  const riskData = await getRiskData();
  const result = buildRiskCheckResult(address, chainId, riskData);

  return res.status(200).json(result);
}

module.exports = withMiddleware(handler);
