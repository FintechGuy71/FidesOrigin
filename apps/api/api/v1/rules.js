const {
  withMiddleware,
  sendError,
  rulesStore,
  generateRuleId,
  initDefaultRules,
} = require('../../../lib/utils');

// [HIGH Fix #7] CSRF protection: validate Origin/Referer header for state-changing requests (POST/PUT/PATCH/DELETE).
// This prevents cross-site form submissions from rogue domains.
const ALLOWED_CSRF_ORIGINS = [
  'https://fidesorigin.com',
  'https://www.fidesorigin.com',
  'https://admin.fidesorigin.com',
  'http://localhost:3000',
  'http://localhost:5173',
];

function checkCSRF(req) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return true;
  const origin = req.headers.origin || req.headers.referer || '';
  if (!origin) return false;
  return ALLOWED_CSRF_ORIGINS.some(allowed => origin === allowed || origin.startsWith(allowed + '/'));
}

// GET /v1/rules  → listRules
// POST /v1/rules → createRule
async function handler(req, res) {
  // [HIGH Fix #7] CSRF check for state-changing requests
  if (!checkCSRF(req)) {
    return sendError(res, 403, 'CSRF_FORBIDDEN', 'Origin not allowed for this request');
  }

  initDefaultRules();

  if (req.method === 'GET') {
    return handleList(req, res);
  }
  if (req.method === 'POST') {
    return handleCreate(req, res);
  }
  return sendError(res, 405, 'BAD_REQUEST', 'Method not allowed');
}

function handleList(req, res) {
  const { status, limit = '50', offset = '0' } = req.query || {};
  let rules = [...rulesStore.rules];

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

function handleCreate(req, res) {
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

  rulesStore.rules.push(rule);
  return res.status(201).json(rule);
}

module.exports = withMiddleware(handler);
