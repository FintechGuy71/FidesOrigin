const {
  withMiddleware,
  sendError,
  rulesStore,
  initDefaultRules,
} = require('../../../lib/utils');

// GET    /v1/rules/:id
// PUT    /v1/rules/:id → updateRule (SDK uses PATCH, but we accept both)
// PATCH  /v1/rules/:id → updateRule
// DELETE /v1/rules/:id → deleteRule
async function handler(req, res) {
  initDefaultRules();

  const { id } = req.query || {};
  if (!id) {
    return sendError(res, 400, 'BAD_REQUEST', 'Missing rule id path parameter');
  }

  const ruleIndex = rulesStore.rules.findIndex((r) => r.id === id);
  if (ruleIndex === -1) {
    return sendError(res, 404, 'NOT_FOUND', `Rule not found: ${id}`);
  }

  if (req.method === 'GET') {
    return res.status(200).json(rulesStore.rules[ruleIndex]);
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    return handleUpdate(req, res, ruleIndex);
  }

  if (req.method === 'DELETE') {
    rulesStore.rules.splice(ruleIndex, 1);
    return res.status(204).end();
  }

  return sendError(res, 405, 'BAD_REQUEST', 'Method not allowed');
}

function handleUpdate(req, res, index) {
  const body = req.body || {};
  const { name, description, status, conditions, actions, priority } = body;
  const rule = rulesStore.rules[index];

  if (name !== undefined) {
    if (typeof name !== 'string' || name.length === 0) {
      return sendError(res, 400, 'BAD_REQUEST', 'Invalid field: name');
    }
    rule.name = name;
  }
  if (description !== undefined) {
    rule.description = description;
  }
  if (status !== undefined) {
    const validStatuses = ['active', 'inactive', 'draft'];
    if (!validStatuses.includes(status)) {
      return sendError(res, 400, 'BAD_REQUEST', 'Invalid field: status (must be active, inactive, or draft)');
    }
    rule.status = status;
  }
  if (conditions !== undefined) {
    if (!Array.isArray(conditions) || conditions.length === 0) {
      return sendError(res, 400, 'BAD_REQUEST', 'Invalid field: conditions (must be a non-empty array)');
    }
    rule.conditions = conditions;
  }
  if (actions !== undefined) {
    if (!Array.isArray(actions) || actions.length === 0) {
      return sendError(res, 400, 'BAD_REQUEST', 'Invalid field: actions (must be a non-empty array)');
    }
    rule.actions = actions;
  }
  if (priority !== undefined) {
    if (typeof priority !== 'number') {
      return sendError(res, 400, 'BAD_REQUEST', 'Invalid field: priority (must be a number)');
    }
    rule.priority = priority;
  }

  rule.updatedAt = new Date().toISOString();
  return res.status(200).json(rule);
}

module.exports = withMiddleware(handler);
