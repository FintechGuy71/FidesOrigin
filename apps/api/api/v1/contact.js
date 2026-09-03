// ⚠ 路径深度注意：本文件在 api/v1/ 下（比 api/v1/auth/ 浅一层），
//    相对 lib/middleware 只需上跳一层（../），误写成 ../../ 会在 Vercel 打包时
//    解析到不存在的 apps/api/lib → 部署失败。
const { withMiddleware, SCOPE, sendError } = require('../_lib/utils');
const { proxyToBackend } = require('../_lib/proxy');
const { checkRateLimit } = require('../_middleware/rateLimit');

// [Contact Fix] 宽松的邮箱形态校验（服务端第一道防线，后端仍会再校验）
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// [Contact Fix] POST /v1/contact
// 公开端点（免 API key），官网联系表单入口。
// 写操作由网关代签 HMAC；端点级限流 5 次/小时防垃圾提交。
async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'BAD_REQUEST', 'Method not allowed');
  }

  // [Contact Fix] 端点级限流：5 次/小时/IP
  const allowed = await checkRateLimit(req, res, { max: 5, window: 3600, prefix: 'ratelimit:contact' });
  if (!allowed) return;

  const body = req.body || {};
  if (!body.name || !body.email || !body.message) {
    return sendError(res, 400, 'BAD_REQUEST', 'name, email and message are required');
  }
  if (typeof body.email !== 'string' || !EMAIL_RE.test(body.email)) {
    return sendError(res, 400, 'BAD_REQUEST', 'invalid email address');
  }

  try {
    // [Contact Fix] website 为蜜罐字段：原样透传，由后端识别并丢弃机器人提交
    const response = await proxyToBackend('/api/v1/contact', {
      method: 'POST',
      body: JSON.stringify({
        name: body.name,
        email: body.email,
        company: body.company,
        use_case: body.use_case,
        message: body.message,
        website: body.website,
      }),
      sign: true, // [HMAC Sign Fix] 网关代签
    });
    const data = await response.json().catch(() => null);
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[contact] proxy error:', error.message);
    return sendError(res, 502, 'PROXY_ERROR', 'Backend unavailable');
  }
}

module.exports = withMiddleware(handler, SCOPE.PUBLIC);
