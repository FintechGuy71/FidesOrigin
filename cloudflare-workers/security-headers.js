// FidesOrigin Security Headers Worker + Static Assets
// 直接从 Cloudflare 静态资源提供网站内容，并注入完整安全头。
// 不再依赖 Vercel origin（Vercel 部署队列故障时的免疫方案）。

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.studio.thegraph.com https://rpc.sepolia.org https://rpc.ankr.com https://ethereum-sepolia-rpc.publicnode.com https://mainnet.base.org https://ethereum-rpc.publicnode.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
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

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};
