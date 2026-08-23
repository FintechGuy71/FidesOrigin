const {
  withMiddleware,
  sendError,
  checkApiKey,
  SCOPE,
  getRules,
  addRule,
  generateRuleId,
  initDefaultRules,
} = require('../../../lib/utils');

// [H-4/H-5 FIX R2-FULL] 重构说明：
//   1. 鉴权：写操作要求 RULES_ADMIN_API_KEY（作用域强制），读操作接受只读或管理 Key
//   2. 存储：规则接入 Vercel KV（内存降级）——原实现为实例内存，serverless 下
//      新建规则随机丢失、风控实例不可见
//   3. CSRF：Origin 头校验仅对浏览器跨站请求有意义（utils.checkOrigin 已修正：
//      无 Origin 的服务端客户端放行并交给 API Key 鉴权；伪造 Origin 头对
//      非浏览器客户端无防护意义，防线在作用域化 API Key）

// GET /v1/rules  → listRules（READ 作用域）
// POST /v1/rules → createRule（WRITE 作用域）
async function handler(req, res) {
  // [H-4 FIX] 写操作强制 WRITE 作用域（RULES_ADMIN_API_KEY）
  if (req.method === 'POST' && !checkApiKey(req, res, SCOPE.WRITE)) return;

  initDefaultRules();

  if (req.method === 'GET') {
    return handleList(req, res);
  }
  if (req.method === 'POST') {
    return handleCreate(req, res);
  }
  return sendError(res, 405, 'BAD_REQUEST', 'Method not allowed');
}

async function handleList(req, res) {
  const { status, limit = '50', offset = '0' } = req.query || {};
  let rules = [...(await getRules())];

  if (status) {
    rules = rules.filter((r) => r.status === status);
  }

  const total = rules.length;
  const start = Math.max(0, parseInt(offset, 10) || 0);
  const count = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const paginated = rules.slice(start, start + count);
  const page = Math.floor(start / count) + 1;

  return res.status(200).json({
    rules: paginated,
    total,
    page,
    limit: count,
  });
}

async function handleCreate(req, res) {
  const body = req.body || {};
  const { name, description, conditions, actions, priority } = body;

  if (!name || typeof name !== 'string') {
    return sendError(res, 400, 'BAD_REQUEST', 'Missing or invalid field: name');
  }
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return sendError(res, 400, 'BAD_REQUEST', 'Missing or invalid field: conditions (must be a non-empty array)');
  }
  if (!Array.isArray(actions) || actions.length === 0) {
    return sendError(res, 400, 'BAD_REQUEST', 'Missing or invalid field: actions (must be a non-empty array)');
  }

  const now = new Date().toISOString();
  const rule = {
    id: generateRuleId(),
    name,
    description: description || '',
    status: 'active',
    priority: typeof priority === 'number' ? priority : 0,
    conditions,
    actions,
    createdAt: now,
    updatedAt: now,
  };

  await addRule(rule);
  return res.status(201).json(rule);
}

module.exports = withMiddleware(handler, SCOPE.READ); // POST 在 handler 内再校验 WRITE
