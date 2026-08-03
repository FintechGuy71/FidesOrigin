/**
 * CSP Middleware — Nonce-based Content Security Policy
 *
 * P0-2 Fix Reference Implementation:
 * This file demonstrates how to replace 'unsafe-inline' in script-src with
 * a nonce-based approach, eliminating inline script injection risks.
 *
 * To activate:
 * 1. Copy this file to apps/web/middleware.ts (or middleware.js)
 * 2. Install the nonce in your root layout.tsx / _document.tsx
 * 3. Remove 'unsafe-inline' from apps/web/vercel.json CSP header
 * 4. Deploy and verify no CSP violations in browser console
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Generate a cryptographically secure nonce (128-bit, base64)
 */
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString('base64');
}

/**
 * Build a strict CSP header with nonce-based script-src
 */
function buildCspHeader(nonce: string): string {
  const directives = [
    "default-src 'self'",
    // nonce-based script-src replaces 'unsafe-inline'
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://ipapi.co",
    "font-src 'self' https://fonts.gstatic.com",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  return directives.join('; ');
}

export function middleware(_request: NextRequest) {
  const nonce = generateNonce();
  const csp = buildCspHeader(nonce);

  const response = NextResponse.next();

  // Set CSP header
  response.headers.set('Content-Security-Policy', csp);

  // Expose nonce to Next.js so it can inject it into <Script> tags
  // In layout.tsx: const nonce = headers().get('x-nonce');
  response.headers.set('x-nonce', nonce);

  return response;
}

/**
 * Match all routes except static assets and API routes
 */
export const config = {
  matcher: [
    // Skip all internal paths (_next, api, static files)
    '/((?!_next/|api/|static/|favicon.ico|.*\\.).*)',
  ],
};

/**
 * Root Layout Integration (layout.tsx):
 *
 * import { headers } from 'next/headers';
 *
 * export default function RootLayout({ children }: { children: React.ReactNode }) {
 *   const nonce = headers().get('x-nonce') ?? '';
 *   return (
 *     <html>
 *       <head>
 *         {/ * Any inline scripts MUST use nonce * /}
 *         <script nonce={nonce} dangerouslySetInnerHTML={{ __html: 'console.log("ok")' }} />
 *       </head>
 *       <body>{children}</body>
 *     </html>
 *   );
 * }
 */
