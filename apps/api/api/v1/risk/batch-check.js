const {
  withMiddleware,
  isValidEthereumAddress,
  isValidChainId,
  sendError,
  getRiskData,
  buildAddressRisk,
} = require('../../../../lib/utils');

// POST /v1/risk/batch-check
// Body: { addresses: string[], chainId?: number | string, amount?: string }
async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'BAD_REQUEST', 'Method not allowed');
  }

  const body = req.body || {};
  const { addresses, chainId, amount } = body;

  if (!Array.isArray(addresses) || addresses.length === 0) {
    return sendError(res, 400, 'BAD_REQUEST', 'Missing or invalid field: addresses (must be a non-empty array)');
  }
  if (addresses.length > 100) {
    return sendError(res, 400, 'BAD_REQUEST', 'Maximum 100 addresses allowed per batch request');
  }

  let resolvedChainId = chainId;
  if (resolvedChainId !== undefined && !isValidChainId(resolvedChainId)) {
    return sendError(res, 400, 'INVALID_CHAIN_ID', 'Invalid chain ID');
  }
  if (resolvedChainId === undefined) {
    resolvedChainId = 1; // default to ethereum
  }

  const riskData = await getRiskData();
  const results = [];
  const errors = [];
  const failed = [];

  for (const rawAddr of addresses) {
    if (!isValidEthereumAddress(rawAddr)) {
      errors.push({ address: rawAddr, error: 'Invalid Ethereum address format' });
      failed.push(rawAddr);
      continue;
    }
    try {
      const risk = buildAddressRisk(rawAddr, resolvedChainId, riskData);
      results.push(risk);
    } catch (err) {
      errors.push({ address: rawAddr, error: err.message || 'Assessment failed' });
      failed.push(rawAddr);
    }
  }

  return res.status(200).json({ results, errors: errors.length > 0 ? errors : undefined, failed: failed.length > 0 ? failed : undefined });
}

module.exports = withMiddleware(handler);
