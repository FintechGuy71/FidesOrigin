import { NextRequest, NextResponse } from "next/server";

/**
 * Generate a cryptographically secure nonce (128-bit, base64)
 */
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString("base64");
}

/**
 * Build a strict CSP header with nonce-based script-src.
 * For static files (non-HTML assets), we use a simpler CSP without nonce.
 */
function buildCspHeader(nonce: string): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://ipapi.co",
    "font-src 'self' https://fonts.gstatic.com",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  return directives.join("; ");
}

export function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const csp = buildCspHeader(nonce);

  const response = NextResponse.next();

  // Set security headers
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  response.headers.set("X-Nonce", nonce);

  return response;
}

/**
 * Match all routes except static assets, API routes, and internal paths
 */
export const config = {
  matcher: [
    "/((?!_next/|api/|static/|favicon\\.ico|.*\\.(?:js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico|json|xml|txt|map)$).*)",
  ],
};
