const {
  withMiddleware,
  sendError,
  checkApiKey,
  SCOPE,
  getRules,
  updateRule,
  deleteRule,
  initDefaultRules,
} = require('../../lib/utils');

// [H-4/H-5 FIX R2-FULL] 见 rules.js 重构说明：写操作强制 RULES_ADMIN_API_KEY，
// 规则存储接入 Vercel KV（实例内存仅作降级快照）。

// GET    /v1/rules/:id
// PUT    /v1/rules/:id → updateRule (SDK uses PATCH, but we accept both)
// PATCH  /v1/rules/:id → updateRule
// DELETE /v1/rules/:id → deleteRule
async function handler(req, res) {
  // [H-4 FIX] 变更操作强制 WRITE 作用域
  if (['PUT', 'PATCH', 'DELETE'].includes(req.method) && !checkApiKey(req, res, SCOPE.WRITE)) {
    return;
  }

  await initDefaultRules();

  const { id } = req.query || {};
  if (!id) {
    return sendError(res, 400, 'BAD_REQUEST', 'Missing rule id path parameter');
  }

  if (req.method === 'GET') {
    const rules = await getRules();
    const rule = rules.find((r) => r.id === id);
    if (!rule) {
      return sendError(res, 404, 'NOT_FOUND', `Rule not found: ${id}`);
    }
    return res.status(200).json(rule);
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    return handleUpdate(req, res, id);
  }

  if (req.method === 'DELETE') {
    const removed = await deleteRule(id);
    if (!removed) {
      return sendError(res, 404, 'NOT_FOUND', `Rule not found: ${id}`);
    }
    return res.status(204).end();
  }

  return sendError(res, 405, 'BAD_REQUEST', 'Method not allowed');
}

async function handleUpdate(req, res, id) {
  const body = req.body || {};
  const { name, description, status, conditions, actions, priority } = body;

  const updated = await updateRule(id, (rule) => {
    if (name !== undefined) {
      if (typeof name !== 'string' || name.length === 0) {
        throw new ValidationError('Invalid field: name');
      }
      rule.name = name;
    }
    if (description !== undefined) {
      rule.description = description;
    }
    if (status !== undefined) {
      const validStatuses = ['active', 'inactive', 'draft'];
      if (!validStatuses.includes(status)) {
        throw new ValidationError('Invalid field: status (must be active, inactive, or draft)');
      }
      rule.status = status;
    }
    if (conditions !== undefined) {
      if (!Array.isArray(conditions) || conditions.length === 0) {
        throw new ValidationError('Invalid field: conditions (must be a non-empty array)');
      }
      rule.conditions = conditions;
    }
    if (actions !== undefined) {
      if (!Array.isArray(actions) || actions.length === 0) {
        throw new ValidationError('Invalid field: actions (must be a non-empty array)');
      }
      rule.actions = actions;
    }
    if (priority !== undefined) {
      if (typeof priority !== 'number') {
        throw new ValidationError('Invalid field: priority (must be a number)');
      }
      rule.priority = priority;
    }
    rule.updatedAt = new Date().toISOString();
    return rule;
  });

  if (!updated) {
    return sendError(res, 404, 'NOT_FOUND', `Rule not found: ${id}`);
  }
  return res.status(200).json(updated);
}

// 轻量校验错误：区分 400 与 404（原实现 mutator 抛错会被 withMiddleware 吞成 500）
class ValidationError extends Error {}
ValidationError.prototype.name = 'ValidationError';

module.exports = withMiddleware(handler, SCOPE.READ); // 写方法在 handler 内校验 WRITE
