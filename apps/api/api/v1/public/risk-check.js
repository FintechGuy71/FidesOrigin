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
    /* [AUDIT FIX 2026-09-24 F1] 后端 /api/v1/address/{address}/risk 读取的查询
       参数名是 `chain`（链名），不是 `chainId`（数字）——原 ?chainId= 被后端
       静默忽略。本端点的 chainId 入参保留（公开 API 契约），但转发时显式
       传后端真正识别的 chain=ethereum（v3.1.0 数据阶段后端所有 AddressRisk
       记录统一以 "ethereum" 为键，见 backend risk_sync_service 与
       addresses.py batch-check 的注释）。数据按链重键后应改回语义映射。 */
    const response = await proxyToBackend(
      `/api/v1/address/${address}/risk?chain=ethereum`
    );
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[public/risk-check] Proxy error:', error.message);
    return sendError(res, 502, 'PROXY_ERROR', 'Backend unavailable');
  }
}

module.exports = withMiddleware(handler, SCOPE.PUBLIC);
