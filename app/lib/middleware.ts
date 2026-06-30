import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─── Security Headers Configuration ──────────────────────────────────────────

/**
 * Content Security Policy (CSP) directives.
 *
 * [HIGH Fix #3] Removed 'unsafe-eval' and 'unsafe-inline' from script-src.
 * TODO: Generate a per-request nonce and add 'nonce-<value>' to script-src.
 *   In Next.js, use the `headers()` API to generate nonces:
 *   ```
 *   import { headers } from 'next/headers';
 *   const nonce = (await headers()).get('x-nonce') ?? '';
 *   ```
 * Until nonce-based CSP is fully implemented, 'strict-dynamic' is used to
 * allow scripts loaded by already-trusted scripts.
 * See: https://www.w3.org/TR/CSP3/#strict-dynamic-usage
 *
 * Allows:
 * - Self-origin scripts, styles, and connections
 * - WebSocket connections (wss: and ws:)
 * - Images from self, data URIs, https, and blob
 * - Fonts from self and data URIs
 * - Inline styles (required by Tailwind / styled-components patterns)
 */
const CSP_DIRECTIVES: Record<string, string[]> = {
  "default-src": ["'self'"],
  // [HIGH Fix #3] Removed 'unsafe-eval' and 'unsafe-inline'.
  // TODO: Replace with nonce-based CSP: `'nonce-${nonce}' 'strict-dynamic'`
  "script-src": ["'self'", "'strict-dynamic'"],
  "style-src": ["'self'", "'unsafe-inline'"], // Tailwind requires inline styles
  "img-src": ["'self'", "data:", "https:", "blob:"],
  "font-src": ["'self'", "data:"],
  "connect-src": [
    "'self'",
    "https:",
    "wss:",
    "ws:",
  ],
  "media-src": ["'self'"],
  "object-src": ["'none'"],
  "frame-ancestors": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "upgrade-insecure-requests": [],
};

function buildCSP(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([key, values]) => {
      if (values.length === 0) return key;
      return `${key} ${values.join(" ")}`;
    })
    .join("; ");
}

const CSP_STRING = buildCSP(CSP_DIRECTIVES);

// ─── CORS Configuration ──────────────────────────────────────────────────────

interface CORSConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  maxAge: number;
  allowCredentials: boolean;
}

// [Medium Fix #8] Replaced wildcard "*" with explicit production origins.
// Set CORS_ALLOWED_ORIGINS env var to override (comma-separated).
const DEFAULT_CORS_CONFIG: CORSConfig = {
  allowedOrigins: [
    "https://fidesorigin.com",
    "https://www.fidesorigin.com",
    "https://admin.fidesorigin.com",
    "http://localhost:3000",
    "http://localhost:5173",
  ],
  allowedMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Request-ID"],
  maxAge: 86400,
  allowCredentials: false,
};

function getCorsConfig(): CORSConfig {
  const origins = process.env.CORS_ALLOWED_ORIGINS;
  return {
    ...DEFAULT_CORS_CONFIG,
    allowedOrigins: origins ? origins.split(",").map((o) => o.trim()) : DEFAULT_CORS_CONFIG.allowedOrigins,
  };
}

// ─── Security Headers Builder ────────────────────────────────────────────────

export interface SecurityHeaders {
  "Content-Security-Policy": string;
  "X-Frame-Options": string;
  "X-Content-Type-Options": string;
  "Referrer-Policy": string;
  "Permissions-Policy": string;
  "Strict-Transport-Security": string;
  "X-DNS-Prefetch-Control": string;
  "Cross-Origin-Opener-Policy": string;
  "Cross-Origin-Resource-Policy": string;
}

export function buildSecurityHeaders(): SecurityHeaders {
  return {
    "Content-Security-Policy": CSP_STRING,
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-DNS-Prefetch-Control": "on",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
}

// ─── Next.js Middleware ──────────────────────────────────────────────────────

/**
 * Next.js middleware that adds security headers to all responses.
 *
 * Usage: export this function from `middleware.ts` at the project root.
 */
export function securityMiddleware(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  const headers = buildSecurityHeaders();

  // Apply security headers
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // [High Fix] Apply CORS headers for API routes — strict origin validation, no reflection
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const cors = getCorsConfig();
    const origin = request.headers.get("origin");

    if (origin && cors.allowedOrigins.includes(origin)) {
      // Origin is explicitly allowed — reflect it back with Vary header
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Vary", "Origin");
      if (cors.allowCredentials) {
        response.headers.set("Access-Control-Allow-Credentials", "true");
      }
    } else if (!cors.allowCredentials && cors.allowedOrigins.includes("*")) {
      // Only allow wildcard when credentials are NOT used
      response.headers.set("Access-Control-Allow-Origin", "*");
    }
    // else: origin not allowed — don't set ACAO header, browser will block

    response.headers.set("Access-Control-Allow-Methods", cors.allowedMethods.join(", "));
    response.headers.set("Access-Control-Allow-Headers", cors.allowedHeaders.join(", "));
    response.headers.set("Access-Control-Max-Age", cors.maxAge.toString());
  }

  // Handle preflight requests
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: response.headers,
    });
  }

  return response;
}

// ─── Express-style Middleware (for non-Next.js usage) ──────────────────────

export interface ExpressStyleResponse {
  setHeader(key: string, value: string): void;
}

export function applySecurityHeaders(res: ExpressStyleResponse): void {
  const headers = buildSecurityHeaders();
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

// ─── Default export for Next.js ──────────────────────────────────────────────

export default securityMiddleware;
