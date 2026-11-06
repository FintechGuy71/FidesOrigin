const { proxyToBackend } = require('../../_lib/proxy');
const {
  withMiddleware,
  isValidEthereumAddress,
  isValidChainId,
  sendError,
} = require('../../_lib/utils');

// POST /v1/risk/batch-check
// Body: { addresses: string[], chainId?: number | string, amount?: string }
/* [AUDIT FIX 2026-09-17 B2-015] amount 当前不参与评估（保留字段，向后兼容），
   文档四语言已同步标注"预留/暂未使用"，不再声称其用于上下文感知评估。 */
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

  const resolvedChainId = chainId === undefined ? 11155111 : chainId;
  if (!isValidChainId(resolvedChainId)) {
    return sendError(res, 400, 'INVALID_CHAIN_ID', 'Invalid chain ID');
  }

  const errors = [];
  const failed = [];
  const validAddresses = [];
  for (const rawAddr of addresses) {
    if (!isValidEthereumAddress(rawAddr)) {
      errors.push({ address: rawAddr, error: 'Invalid Ethereum address format' });
      failed.push(rawAddr);
    } else {
      validAddresses.push(rawAddr);
    }
  }
  if (validAddresses.length === 0) {
    return res.status(200).json({ results: [], errors, failed });
  }

  try {
    const response = await proxyToBackend('/api/v1/address/batch-check', {
      method: 'POST',
      body: JSON.stringify({
        addresses: validAddresses,
        chainId: Number(resolvedChainId),
        ...(amount !== undefined ? { amount } : {}),
      }),
      sign: true,
    });
    const data = await response.json().catch(() => null);
    return res.status(response.status).json({
      ...(data || { results: [] }),
      ...(errors.length ? { errors } : {}),
      ...(failed.length ? { failed } : {}),
    });
  } catch (error) {
    console.error('[batch-check] Proxy error:', error.message);
    return sendError(res, 502, 'PROXY_ERROR', 'Backend unavailable');
  }
}

module.exports = withMiddleware(handler);
