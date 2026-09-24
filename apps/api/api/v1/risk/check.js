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
    /* [AUDIT FIX 2026-09-24 F1] 后端 /api/v1/address/{address}/risk 读取的查询
       参数名是 `chain`（链名），不是 `chainId`（数字）——原 ?chainId= 被后端
       静默忽略，链过滤永远落在后端默认值上。v3.1.0 数据阶段后端全部
       AddressRisk 记录统一以 chain="ethereum" 为键（publisher 消息载荷不含
       chain、backend risk_sync 固定写 "ethereum"），故显式传 chain=ethereum，
       与 /api/v1/address/batch-check 的修复口径一致。
       数据按链重键（per-chain keying）后，此处应改回语义映射。 */
    const response = await proxyToBackend(`/api/v1/address/${address}/risk?chain=ethereum`);
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[check] Proxy error:', error.message);
    return sendError(res, 502, 'PROXY_ERROR', 'Backend unavailable');
  }
}

module.exports = withMiddleware(handler);
