// FidesOrigin Security Headers Worker + Static Assets
// 直接从 Cloudflare 静态资源提供网站内容，并注入完整安全头。
// 不再依赖 Vercel origin（Vercel 部署队列故障时的免疫方案）。

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://plausible.io https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.studio.thegraph.com https://rpc.sepolia.org https://rpc.ankr.com https://ethereum-sepolia-rpc.publicnode.com https://mainnet.base.org https://ethereum-rpc.publicnode.com https://plausible.io; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export default {
  async fetch(request, env, ctx) {
    // 从 Workers 静态资源获取响应（自动处理 SPA 回退、_headers 等）
    const response = await env.ASSETS.fetch(request);

    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      newHeaders.set(key, value);
    }
    if (!newHeaders.has('strict-transport-security')) {
      newHeaders.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }
    // [PERF-FIX] 静态资源长期缓存，减少回源请求
    // [L-25 FIX] .json 不再套用一年 immutable 缓存：public/ 下的数据类 JSON
    // （风险数据快照等）更新会被边缘缓存屏蔽一年。版本化资源（带内容哈希的
    // 文件名）才适合 immutable；JSON 改为短缓存。
    if (!newHeaders.has('cache-control') && request.method === 'GET') {
      const url = new URL(request.url);
      const isAsset = /\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico)$/.test(url.pathname);
      const isJson = /\.json$/.test(url.pathname);
      if (isAsset) {
        newHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (isJson) {
        newHeaders.set('Cache-Control', 'public, max-age=300');
      } else if (url.pathname.endsWith('.html') || url.pathname === '/') {
        newHeaders.set('Cache-Control', 'public, max-age=3600');
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};
// Deploy trigger: 2026-08-07-01:35
// Redeploy trigger: Fri Aug  7 09:51:08 PM CST 2026
// Trigger deploy for sitemap update: Sat Aug  8 12:11:30 AM CST 2026
// Trigger deploy for nav redesign: Mon Aug 10 15:57:00 CST 2026
