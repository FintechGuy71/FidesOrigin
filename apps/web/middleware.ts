import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// [L-21 FIX] CSP nonce 方案（Next.js 官方模式）：
// 原实现 script-src 'unsafe-inline' 显著削弱 XSS 防线。改为每请求生成 nonce，
// Next.js 会自动将 nonce 应用到其渲染的脚本标签（通过 x-nonce 请求头传递）。
// style-src 保留 'unsafe-inline'（Tailwind/内联样式广泛使用，风险远低于脚本）。
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const cspHeader = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://cdn.jsdelivr.net`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.studio.thegraph.com https://rpc.sepolia.org https://rpc.ankr.com https://ethereum-sepolia-rpc.publicnode.com https://mainnet.base.org https://ethereum-rpc.publicnode.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // 供页面/组件读取（Next 自动为自身脚本注入 nonce）
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

  return response;
}

export const config = {
  matcher: "/:path*",
};
