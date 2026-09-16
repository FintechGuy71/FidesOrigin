// ─────────────────────────────────────────────────────────────────────────────
// [D1 Fix] httpOnly Cookie 会话工具 —— admin 后台真鉴权
//
// 背景（前端深度审计遗留决策 D1=方案B）：
//   原实现把 admin JWT 存 sessionStorage，前端 JS 可读——任何 XSS 都可窃取 token。
//   本模块把 token 迁移到 httpOnly cookie（JS 完全不可读），根治窃取面。
//
// 跨域约束与解法：
//   前端 fidesorigin.com 与网关 fidesorigin-api.vercel.app 不同域。直接让网关
//   跨域 Set-Cookie 会被现代浏览器当作第三方 cookie 拦截（Safari 全拦、
//   Chrome 逐步淘汰）。因此官网 vercel.json 加了同源 rewrite：
//     fidesorigin.com/api/v1/:path*  →  https://fidesorigin-api.vercel.app/v1/:path*
//   （[AUDIT FIX 2026-09-17] 注释此前误写为 /v1/:path*，实际 rewrite 源路径带 /api 前缀）
//   浏览器地址栏始终是 fidesorigin.com，cookie 成为第一方 host-only cookie，
//   可靠投递，不受第三方 cookie 拦截影响。
//
// 安全属性：
//   · HttpOnly —— JS 不可读（本修复的核心目的）
//   · Secure   —— 仅 HTTPS
//   · SameSite=Lax —— 同源场景充足；Lax 兼容顶层导航，Strict 对登录后跳转不友好
//   · 不设 Domain —— host-only cookie（仅 fidesorigin.com，比显式 Domain 更严）
//   · Path 收窄 —— access 只在 /v1、refresh 只在 /v1/auth 暴露（最小暴露面）
//
// 后端零改动：网关在 withAdminAuth 里把 cookie 还原成 Authorization: Bearer，
// 经 proxy.js 的 forwardAuth 透传给 Render 后端权威验签（JWT 语义不变）。
// ─────────────────────────────────────────────────────────────────────────────

const ACCESS_COOKIE = 'fio_admin_access';
const REFRESH_COOKIE = 'fio_admin_refresh';

// 与后端 backend/app/core/security.py 保持一致：
//   JWT_EXPIRE_MINUTES = 30  → 1800s；JWT_REFRESH_EXPIRE_MINUTES = 10080 → 604800s
const ACCESS_MAX_AGE = 1800;
const REFRESH_MAX_AGE = 604800;

/** 序列化单个 Set-Cookie 头
 *  ⚠ Path 必须匹配【浏览器地址栏路径】：同源 rewrite 后浏览器请求的是
 *    fidesorigin.com/api/v1/*（不是网关内部的 /v1/*），cookie Path 写错会导致
 *    浏览器不回传 cookie。access 收窄到 /api/v1，refresh 进一步收窄到
 *    /api/v1/auth（只在认证端点暴露 refresh token，最小暴露面）。 */
function _serialize(name, value, { path, maxAge }) {
  const parts = [
    `${name}=${value}`,
    `Path=${path}`,
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ];
  return parts.join('; ');
}

/** 登录/刷新成功后设置两个 httpOnly cookie（token 不进响应体） */
function setAuthCookies(res, accessToken, refreshToken) {
  const cookies = [
    _serialize(ACCESS_COOKIE, accessToken, { path: '/api/v1', maxAge: ACCESS_MAX_AGE }),
    _serialize(REFRESH_COOKIE, refreshToken, { path: '/api/v1/auth', maxAge: REFRESH_MAX_AGE }),
  ];
  res.setHeader('Set-Cookie', cookies);
}

/** 登出：清空两个 cookie（Max-Age=0 即删） */
function clearAuthCookies(res) {
  res.setHeader('Set-Cookie', [
    _serialize(ACCESS_COOKIE, '', { path: '/api/v1', maxAge: 0 }),
    _serialize(REFRESH_COOKIE, '', { path: '/api/v1/auth', maxAge: 0 }),
  ]);
}

/** 从请求 Cookie 头解析出指定 cookie 值（无第三方库，键值切分） */
function readCookie(req, name) {
  const header = req.headers && req.headers.cookie;
  if (!header) return null;
  const parts = header.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) return part.slice(idx + 1).trim();
  }
  return null;
}

function readAccessCookie(req) {
  return readCookie(req, ACCESS_COOKIE);
}
function readRefreshCookie(req) {
  return readCookie(req, REFRESH_COOKIE);
}

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_MAX_AGE,
  REFRESH_MAX_AGE,
  setAuthCookies,
  clearAuthCookies,
  readCookie,
  readAccessCookie,
  readRefreshCookie,
};
