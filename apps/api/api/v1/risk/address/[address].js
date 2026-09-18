const {
  withMiddleware,
  isValidEthereumAddress,
  sendError,
  getRiskData,
  buildAddressRisk,
} = require('../../../_lib/utils');

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

  // [AUDIT FIX 2026-09-18 R3] 默认链与 /v1/risk/check、/v1/public/risk-check
  // 对齐为 Sepolia(11155111)——v3.1.0 仅部署测试网，默认主网造成跨端点口径分裂
  const chainId = 11155111;
  const riskData = await getRiskData();
  const result = buildAddressRisk(address, chainId, riskData);

  return res.status(200).json(result);
}

module.exports = withMiddleware(handler);
