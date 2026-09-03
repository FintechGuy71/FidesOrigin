// ─────────────────────────────────────────────────────────────────────────────
// [Auth Fix] HS256 JWT 验签工具（Node 内置 crypto，无 npm 依赖，serverless 友好）
//
// 用途：dashboard 等管理端点在网关层先行校验客户端 Bearer JWT，
// 避免无效请求打到后端；密钥仅存在于服务端环境变量，绝不外泄。
//
// 安全要点：
//   1. 仅接受 alg=HS256，防止 alg=none / 算法混淆攻击
//   2. 签名比较使用 crypto.timingSafeEqual（常数时间，防时序侧信道）
//   3. 任何校验失败一律返回 null，不向调用方泄露失败细节
//   4. 校验 exp 过期与 role=admin（管理端点语义在验签层强制）
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET_KEY || process.env.SECRET_KEY || '';

if (!JWT_SECRET) {
  console.warn('[JWT] JWT_SECRET_KEY/SECRET_KEY not set — 网关本地验签不可用，将转发给后端权威校验。');
}

/** 是否配置了本地验签密钥。未配置时应转发给后端做权威校验，而不是一律拒绝。 */
function isJwtVerifyConfigured() {
  return Boolean(JWT_SECRET);
}

/**
 * base64url → Buffer
 * 正确处理 -/_ 替换与 padding 补齐
 */
function _b64urlDecode(str) {
  const b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  const padded = pad ? b64 + '='.repeat(4 - pad) : b64;
  return Buffer.from(padded, 'base64');
}

function _timingSafeEqualStr(a, b) {
  const hashA = crypto.createHash('sha256').update(String(a), 'utf8').digest();
  const hashB = crypto.createHash('sha256').update(String(b), 'utf8').digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * 校验 HS256 JWT 并要求 payload.role === 'admin'
 * @param {string} token - 客户端 Bearer token
 * @returns {object|null} 验签通过返回 payload，否则 null（不区分失败原因）
 */
function verifyAdminToken(token) {
  try {
    if (!JWT_SECRET || typeof token !== 'string' || !token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signature] = parts;

    // 1. header：必须 alg=HS256
    const header = JSON.parse(_b64urlDecode(headerB64).toString('utf8'));
    if (!header || header.alg !== 'HS256') return null;

    // 2. 签名：HMAC-SHA256(secret, "header.payload")，常数时间比较
    const expected = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');
    if (!_timingSafeEqualStr(expected, signature)) return null;

    // 3. payload：exp 未过期
    const payload = JSON.parse(_b64urlDecode(payloadB64).toString('utf8'));
    if (!payload || typeof payload.exp !== 'number') return null;
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp <= nowSec) return null;

    // 4. 角色：管理端点要求 role=admin
    if (payload.role !== 'admin') return null;

    return payload;
  } catch {
    // 解码/解析任何异常一律视为验签失败，不泄露细节
    return null;
  }
}

module.exports = { verifyAdminToken, isJwtVerifyConfigured };
