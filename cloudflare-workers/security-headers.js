// FidesOrigin Security Headers Worker
// 拦截所有请求，添加完整的安全头，然后透传至 Vercel Origin

const VERCEL_ORIGIN = 'https://fidesorigin-demo.vercel.app';

// 完整的安全头配置
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.studio.thegraph.com https://rpc.sepolia.org https://rpc.ankr.com https://ethereum-sepolia-rpc.publicnode.com https://mainnet.base.org https://ethereum-rpc.publicnode.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // HSTS 由 Cloudflare 自动添加或保留 Vercel 的
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // URL 重写：静态路由补全 .html（Next.js 静态导出兼容）
    let pathname = url.pathname;
    if (!pathname.endsWith('.html') && !pathname.endsWith('/') && pathname !== '') {
      // 检查是否是已知的 HTML 路由（避免重写静态资源）
      const htmlRoutes = ['/admin/dashboard'];
      if (htmlRoutes.includes(pathname)) {
        pathname = pathname + '.html';
      }
    }
    // 构建到 Vercel origin 的请求
    const originUrl = new URL(pathname + url.search, VERCEL_ORIGIN);
    const originRequest = new Request(originUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    // 获取 Vercel 的响应
    const response = await fetch(originRequest);
    
    // 克隆响应并添加安全头
    const newHeaders = new Headers(response.headers);
    
    // 添加所有安全头（如果响应中已存在则覆盖）
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      newHeaders.set(key, value);
    }
    
    // 确保 HSTS（如果 Cloudflare 未自动添加）
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
