const { proxyToBackend } = require('../../_lib/proxy');
const {
  withMiddleware,
  sendError,
  checkApiKey,
  SCOPE,
} = require('../../_lib/utils');

// [H-4/H-5 FIX R2-FULL] 见 rules.js 重构说明：写操作强制 RULES_ADMIN_API_KEY，
// 规则存储接入 Vercel KV（实例内存仅作降级快照）。

// GET    /v1/rules/:id
// PUT    /v1/rules/:id → updateRule (SDK uses PATCH, but we accept both)
// PATCH  /v1/rules/:id → updateRule
// DELETE /v1/rules/:id → deleteRule
const EXECUTABLE_STRATEGIES = new Set([
  'reported_address', 'high_frequency_transactions', 'new_address',
  'large_amount_transfer', 'sanctioned_list', 'scam_list',
]);

async function handler(req, res) {
  if (['PUT', 'PATCH', 'DELETE'].includes(req.method) && !checkApiKey(req, res, SCOPE.WRITE)) {
    return;
  }

  const { id } = req.query || {};
  if (!/^\d+$/.test(String(id)) || Number(id) <= 0) {
    return sendError(res, 400, 'BAD_REQUEST', 'Rule id must be a positive integer');
  }
  const path = `/api/v1/rules/${id}`;

  if (req.method === 'GET') {
    const response = await proxyToBackend(path, { sign: true });
    const data = await response.json().catch(() => null);
    return res.status(response.status).json(data);
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const body = { ...(req.body || {}) };
    if (body.conditions !== undefined || body.actions !== undefined) {
      return sendError(res, 400, 'NON_EXECUTABLE_RULE', 'Legacy conditions/actions are not executable');
    }
    const alwaysApply = body.condition && body.condition.always_apply === true;
    if (body.name && !EXECUTABLE_STRATEGIES.has(body.name) && !alwaysApply) {
      return sendError(res, 400, 'NON_EXECUTABLE_RULE', 'Rule is not executable by the backend risk engine');
    }
    if (body.status !== undefined) {
      if (!['active', 'inactive'].includes(body.status)) {
        return sendError(res, 400, 'BAD_REQUEST', 'status must be active or inactive');
      }
      body.is_active = body.status === 'active';
      delete body.status;
    }
    const response = await proxyToBackend(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
      sign: true,
    });
    const data = await response.json().catch(() => null);
    return res.status(response.status).json(data);
  }

  if (req.method === 'DELETE') {
    const response = await proxyToBackend(path, { method: 'DELETE', sign: true });
    if (response.status === 204) return res.status(204).end();
    const data = await response.json().catch(() => null);
    return res.status(response.status).json(data);
  }

  return sendError(res, 405, 'BAD_REQUEST', 'Method not allowed');
}

module.exports = withMiddleware(handler, SCOPE.READ); // 写方法在 handler 内校验 WRITE
