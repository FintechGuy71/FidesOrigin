const {
  withMiddleware,
  isValidEthereumAddress,
  sendError,
  getRiskData,
  buildAddressRisk,
} = require('../../../../lib/utils');

// GET /v1/risk/address/:address
async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'BAD_REQUEST', 'Method not allowed');
  }

  const { address } = req.query || {};

  if (!address) {
    return sendError(res, 400, 'BAD_REQUEST', 'Missing address path parameter');
  }
  if (!isValidEthereumAddress(address)) {
    return sendError(res, 400, 'INVALID_ADDRESS', 'Invalid Ethereum address format');
  }

  // Default chainId for address lookup; SDK doesn't pass chainId for this endpoint
  const chainId = 1;
  const riskData = await getRiskData();
  const result = buildAddressRisk(address, chainId, riskData);

  return res.status(200).json(result);
}

module.exports = withMiddleware(handler);
