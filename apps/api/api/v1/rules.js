const { proxyToBackend } = require('../_lib/proxy');
const {
  withMiddleware,
  sendError,
  checkApiKey,
  SCOPE,
} = require('../_lib/utils');

// [H-4/H-5 FIX R2-FULL] 重构说明：
//   1. 鉴权：写操作要求 RULES_ADMIN_API_KEY（作用域强制），读操作接受只读或管理 Key
//   2. 存储：规则接入 Vercel KV（内存降级）——原实现为实例内存，serverless 下
//      新建规则随机丢失、风控实例不可见
//   3. CSRF：Origin 头校验仅对浏览器跨站请求有意义（utils.checkOrigin 已修正：
//      无 Origin 的服务端客户端放行并交给 API Key 鉴权；伪造 Origin 头对
//      非浏览器客户端无防护意义，防线在作用域化 API Key）

// GET /v1/rules  → listRules（READ 作用域）
// POST /v1/rules → createRule（WRITE 作用域）
const EXECUTABLE_STRATEGIES = new Set([
  'reported_address',
  'high_frequency_transactions',
  'new_address',
  'large_amount_transfer',
  'sanctioned_list',
  'scam_list',
]);

function validateExecutableRule(body, requireName = true) {
  if (requireName && (typeof body.name !== 'string' || body.name.length < 3 || body.name.length > 100)) {
    return 'name must be a string between 3 and 100 characters';
  }
  if (body.conditions !== undefined || body.actions !== undefined) {
    return 'Legacy conditions/actions are not executable; use condition with a registered strategy';
  }
  if (body.condition !== undefined && (typeof body.condition !== 'object' || body.condition === null || Array.isArray(body.condition))) {
    return 'condition must be an object';
  }
  const name = body.name;
  const alwaysApply = body.condition && body.condition.always_apply === true;
  if (name && !EXECUTABLE_STRATEGIES.has(name) && !alwaysApply) {
    return `Rule is not executable; use a registered strategy (${[...EXECUTABLE_STRATEGIES].join(', ')}) or condition.always_apply=true`;
  }
  return null;
}

async function handler(req, res) {
  if (req.method === 'POST' && !checkApiKey(req, res, SCOPE.WRITE)) return;

  if (req.method === 'GET') {
    const { status, limit = '50', offset = '0', category, rule_type } = req.query || {};
    const count = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const start = Math.max(0, parseInt(offset, 10) || 0);
    const page = Math.floor(start / count) + 1;
    const params = new URLSearchParams({
      active_only: status === 'inactive' ? 'false' : 'true',
      page: String(page),
      page_size: String(count),
      ...(category ? { category } : {}),
      ...(rule_type ? { rule_type } : {}),
    });
    const path = `/api/v1/rules/?${params}`;
    const response = await proxyToBackend(path, { sign: true });
    const data = await response.json().catch(() => null);
    if (!response.ok) return res.status(response.status).json(data);
    return res.status(200).json({
      rules: data && Array.isArray(data.items) ? data.items : [],
      total: data ? data.total : 0,
      page: data ? data.page : page,
      limit: data ? data.page_size : count,
    });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const validationError = validateExecutableRule(body);
    if (validationError) return sendError(res, 400, 'NON_EXECUTABLE_RULE', validationError);
    const path = '/api/v1/rules/';
    const response = await proxyToBackend(path, {
      method: 'POST',
      body: JSON.stringify(body),
      sign: true,
    });
    const data = await response.json().catch(() => null);
    return res.status(response.status).json(data);
  }
  return sendError(res, 405, 'BAD_REQUEST', 'Method not allowed');
}

module.exports = withMiddleware(handler, SCOPE.READ); // POST 在 handler 内再校验 WRITE
