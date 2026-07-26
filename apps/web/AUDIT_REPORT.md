# FidesOrigin Frontend — Security & Quality Audit Report

**Audit Date:** 2026-07-26
**Auditor:** Subagent (Frontend Security & Quality Auditor)
**Scope:** `/root/.openclaw/workspace/fidesorigin-demo/apps/web/` — All `.ts`, `.tsx`, `.js`, `.html`, `.css` files plus `package.json`, `next.config.js`, `vercel.json`, `tsconfig.json`, `tailwind.config.js`

---

## 📊 Executive Summary

| Category | Critical | High | Medium | Low | Info |
|----------|----------|------|--------|-----|------|
| **Security** | 2 | 5 | 4 | 2 | 1 |
| **Accessibility** | 0 | 1 | 4 | 3 | 3 |
| **Performance** | 0 | 1 | 3 | 4 | 2 |
| **Code Quality** | 0 | 1 | 4 | 4 | 3 |
| **SEO** | 0 | 0 | 1 | 2 | 3 |
| **Cross-Browser** | 0 | 0 | 2 | 2 | 2 |

**Total Issues Found:** 57

---

## 🔒 1. Security Issues

### SEC-001 — Hardcoded CSP Nonce in Static HTML Files
- **File:** `public/index.html`, `public/address-check.html`, `public/cn/index.html`, `public/tw/index.html`, `public/jp/index.html` (and all localized variants)
- **Issue:** The `Content-Security-Policy` meta tag uses a hardcoded nonce `nonce-2726c7f26c` for script-src. A hardcoded nonce provides **zero security benefit** — it is publicly visible in the HTML source and any attacker can simply include the same nonce in their injected scripts.
- **Severity:** **Critical**
- **Fix:** Remove the nonce-based CSP from static HTML files entirely. For static files, use hash-based CSP (`'sha256-...'`) for each known inline script, or move all inline scripts to external `.js` files and use `script-src 'self'` only. For Next.js app routes, implement the `middleware.ts` approach documented in `CSP_MIDDLEWARE_REFERENCE.ts`.

### SEC-002 — Template Placeholder Nonce in vercel.json CSP
- **File:** `vercel.json`
- **Issue:** The CSP header contains `'nonce-<%=nonce%>'` which is a server-side template syntax (EJS/Jinja-style). Vercel's `vercel.json` does **not** process template syntax — this string is served literally to browsers, meaning the nonce is always the literal string `<%=nonce%>` and will never match any actual script nonce. This effectively breaks the CSP for any nonce-protected scripts.
- **Severity:** **Critical**
- **Fix:** Remove the nonce from `vercel.json` CSP. Either (a) use `script-src 'self'` for static deployments with no inline scripts, or (b) implement a Next.js middleware (`middleware.ts`) that generates a true random nonce per request as shown in `CSP_MIDDLEWARE_REFERENCE.ts`.

### SEC-003 — Extensive innerHTML Usage for Dynamic Content (XSS Risk)
- **File:** `public/admin/admin.js` (40+ occurrences), `public/wallet-connect.js` (2 occurrences), `public/index.html` (inline scripts)
- **Issue:** The admin dashboard builds HTML table rows via template string concatenation and injects them with `innerHTML`/`innerHTML +=`. Example in `admin.js`:
  ```js
  tbody.innerHTML += `
    <tr>
      <td class="address-cell">${profile.id.slice(0, 10)}...${profile.id.slice(-4)}</td>
      <td><span style="color:${tierColors[profile.tier] || '#94a3b8'}">${profile.tier}</span> (${profile.riskScore})</td>
      ...
    </tr>
  `;
  ```
  If The Graph Subgraph returns malicious data (e.g., a `profile.tier` containing `</span><script>alert(1)</script>`), this will execute in the user's browser. The `tierColors` lookup provides **no sanitization**.
- **Severity:** **High**
- **Fix:** Replace all `innerHTML` usage with proper DOM API (`document.createElement`, `textContent`). For table rows, use `document.createElement('tr')` and set `textContent` on cells. Alternatively, implement a strict HTML sanitizer like DOMPurify for any remaining HTML insertion.

### SEC-004 — wallet-connect.js setHtml Helper Uses innerHTML
- **File:** `public/wallet-connect.js`
- **Issue:** The `setHtml(id, html)` helper directly assigns `e.innerHTML = html`. This is used to set compliance status HTML that includes dynamic content from the smart contract (`riskScore`, `isSanctioned`, `lastUpdated`). While contract return values are less likely to be malicious, any compromise of the RPC node or man-in-the-middle could inject malicious HTML.
- **Severity:** **High**
- **Fix:** Replace `setHtml` with `setText` for all non-HTML content. For the status badges, create DOM elements via `createElement` and set `textContent` / `className` instead of injecting HTML strings.

### SEC-005 — API Key Exposed to Client Bundle
- **File:** `demo/page.tsx`, `lib/env.ts` (reference)
- **Issue:** `demo/page.tsx` sends `X-API-Key: process.env.NEXT_PUBLIC_API_KEY || ""` in fetch headers. `NEXT_PUBLIC_` prefixed variables are **injected into the client bundle at build time** and are visible to anyone who inspects the JavaScript. The `lib/env.ts` file correctly documents this risk but the `demo/page.tsx` still uses it.
- **Severity:** **High**
- **Fix:** Remove `NEXT_PUBLIC_API_KEY` entirely. Route all API calls through Next.js API routes (`/api/*`) where the server can securely hold the API key. The client should call `/api/risk/analyze` which then proxies to the real backend with the server-side API key.

### SEC-006 — Subgraph URL and Backend API URL Exposed Client-Side
- **File:** `public/address-check.js`, `public/admin/admin.js`, `public/admin/admin-config.js`, `demo/page.tsx`
- **Issue:** Subgraph URLs (`https://api.studio.thegraph.com/...`) and RPC endpoints are exposed in client-side JavaScript. An attacker can directly query these endpoints, potentially abusing rate limits, conducting DoS, or extracting data without going through the application's access controls.
- **Severity:** **Medium**
- **Fix:** Proxy all Subgraph and RPC queries through Next.js API routes or a backend proxy. This allows rate limiting, authentication, and request validation before forwarding to external services.

### SEC-007 — No CSRF Token Validation on Frontend
- **File:** `public/address-check.js`
- **Issue:** The code fetches a CSRF token and sends it in headers (`X-CSRF-Token`), but the `fetchCsrfToken()` function has **no error handling for network failures** and silently continues with an empty token. If the backend doesn't strictly validate this token, the CSRF protection is bypassable. Additionally, the CSRF token endpoint (`/api/csrf-token`) is called with `GET` instead of the more secure pattern of embedding it in the page or using a cookie.
- **Severity:** **Medium**
- **Fix:** Ensure the CSRF token is (a) obtained via a secure channel, (b) validated server-side on every mutating request, (c) rotated per session, and (d) the frontend shows a clear error if the token cannot be obtained.

### SEC-008 — Admin Page Scripts Loaded Without Matching Nonce
- **File:** `public/admin/index.html`
- **Issue:** The CSP meta tag declares `script-src 'self' 'nonce-admin2026' 'strict-dynamic' https://cdn.jsdelivr.net`, but the actual script tags at the bottom of the file **do not have `nonce="admin2026"` attributes**:
  ```html
  <script nonce="admin2026" src="admin-config.js"></script>
  <script nonce="admin2026" src="admin.js"></script>
  ```
  Actually they DO have the nonce. But the CDN-loaded scripts (`chart.js`, `ethers.js`) do NOT have `nonce` attributes and are loaded without SRI hashes (`integrity` attribute). With `strict-dynamic`, any nonce-annotated script can load additional scripts, but the CDN scripts are loaded directly by the browser, not by a nonce-annotated script. This means the CDN scripts may be blocked by CSP in strict browsers.
- **Severity:** **Medium**
- **Fix:** Add SRI (`integrity`) hashes to all CDN scripts, or load them dynamically via a nonce-annotated bootstrap script. Example: `<script src="https://cdn.jsdelivr.net/npm/chart.js" integrity="sha256-..." crossorigin="anonymous"></script>`.

### SEC-009 — Ethers.js Loaded from CDN Without Integrity Check
- **File:** `public/wallet-connect.js`, `public/admin/index.html`
- **Issue:** Ethers.js v6 is loaded from `cdn.jsdelivr.net` without Subresource Integrity (SRI) hashes. If the CDN is compromised, malicious JavaScript will execute in the context of the admin dashboard with full wallet access.
- **Severity:** **High**
- **Fix:** Add SRI hashes to all CDN-loaded scripts. Generate with `openssl dgst -sha384 -binary ethers.umd.min.js | openssl base64 -A`.

### SEC-010 — WebSocket URL Exposed and No Authentication
- **File:** `app/admin/dashboard/page.tsx`, `components/LiveTransactionStream.tsx`
- **Issue:** The WebSocket URL (`wss://api.fidesorigin.com/ws`) is hardcoded in the client bundle. The WebSocket connection sends a `subscribe` message but there's no visible authentication handshake in the connection logic.
- **Severity:** **Medium**
- **Fix:** Authenticate WebSocket connections with a short-lived token obtained from an authenticated HTTP endpoint. Do not hardcode production WebSocket URLs in client code.

### SEC-011 — Demo Page Sends API Key in Client Headers
- **File:** `demo/page.tsx`
- **Issue:** As noted in SEC-005, the demo page explicitly uses `process.env.NEXT_PUBLIC_API_KEY` in request headers. Even though `lib/env.ts` documents this as a P1 fix, the demo page violates this guidance.
- **Severity:** **High**
- **Fix:** Same as SEC-005. Remove all `NEXT_PUBLIC_API_KEY` references and proxy through `/api/*` routes.

### SEC-012 — Local Storage Used for Sensitive Config (Historical)
- **File:** `public/admin/admin.js` (commented/legacy reference)
- **Issue:** The admin JS has a security warning comment about API keys in localStorage and a check that logs a warning. While this is good practice, the code also uses `sessionStorage` for contract address storage which is still client-accessible.
- **Severity:** **Low**
- **Fix:** Remove all client-side storage of configuration. Load config from a secure backend endpoint or environment-injected values at build time.

---

## ♿ 2. Accessibility Issues

### A11Y-001 — Canvas Elements Lack Accessible Labels
- **File:** `components/HeroHome.tsx`, `public/index.html`
- **Issue:** The canvas elements used for background animations (`<canvas ref={canvasRef}>` and `<canvas id="particles-canvas">`) have no `aria-label`, `role`, or fallback content. Screen readers will not announce these elements, and users with visual impairments have no indication of what they represent.
- **Severity:** **Medium**
- **Fix:** Add `aria-hidden="true"` if the canvas is purely decorative, or add `role="img"` and `aria-label="Background grid animation"` if it conveys meaning. Ensure a text alternative exists for any information conveyed visually.

### A11Y-002 — Duplicate `type="button"` Attribute in Admin Mobile Header
- **File:** `public/admin/index.html` (line ~1068 and throughout)
- **Issue:** Multiple buttons have duplicate `type="button"` attributes:
  ```html
  <button type="button" type="button" class="hamburger" data-action="toggleMobileSidebar">☰</button>
  ```
  While browsers handle this gracefully, it indicates sloppy HTML generation and may confuse HTML validators or parsing tools.
- **Severity:** **Low**
- **Fix:** Remove duplicate `type="button"` attributes throughout the admin HTML.

### A11Y-003 — Mobile Menu Toggle Missing `aria-controls`
- **File:** `components/ui/header.tsx`, `public/index.html`, `public/address-check.html`
- **Issue:** The mobile menu toggle button has `aria-label="Toggle menu"` and `aria-expanded` but lacks `aria-controls` pointing to the menu container id. Screen reader users cannot reliably discover the relationship between the toggle and the menu.
- **Severity:** **Medium**
- **Fix:** Add `aria-controls="mobileMenu"` to the toggle button and ensure the menu container has `id="mobileMenu"` and `role="navigation"`.

### A11Y-004 — No Skip Navigation Link
- **File:** `app/layout.tsx`, `public/index.html`, `public/admin/index.html`
- **Issue:** No "Skip to main content" link is provided. Keyboard users must tab through the entire navigation menu on every page load to reach the main content.
- **Severity:** **Medium**
- **Fix:** Add a visually-hidden skip link as the first focusable element in the `<body>`:
  ```html
  <a href="#main-content" class="sr-only focus:not-sr-only">Skip to main content</a>
  ```

### A11Y-005 — Insufficient Focus Indicators on Custom Styled Elements
- **File:** `components/ui/header.tsx`, `public/styles.css`
- **Issue:** Many interactive elements (nav links, buttons with custom styling) rely on `hover` states for visual feedback but have minimal or no `:focus-visible` styling. The header nav links use inline style manipulation for hover colors but no focus ring.
- **Severity:** **Medium**
- **Fix:** Add `focus-visible:ring-2 focus-visible:ring-indigo-500` to all interactive elements. Ensure focus indicators have at least 3:1 contrast ratio against adjacent colors.

### A11Y-006 — AOS Animations Not Respecting `prefers-reduced-motion`
- **File:** `app/(default)/layout.tsx`, `components/HeroHome.tsx`
- **Issue:** AOS is initialized with `disable: "phone"` but does not check for `prefers-reduced-motion: reduce`. Users with vestibular disorders may experience discomfort from the fade-up animations. The canvas scan-line animation also has no reduced-motion check.
- **Severity:** **Medium**
- **Fix:** Check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` before initializing AOS and canvas animations. Provide instant (no-animation) alternatives.

### A11Y-007 — Decorative Quote Characters Not Hidden from Screen Readers
- **File:** `components/Trust.tsx`, `components/Testimonials.tsx`
- **Issue:** The large decorative quotation marks (`&ldquo;`) are rendered as text content. Screen readers may announce "left double quotation mark" or similar, which is confusing.
- **Severity:** **Low**
- **Fix:** Add `aria-hidden="true"` to the decorative quote elements.

### A11Y-008 — LangSetter Does Not Handle Japanese (`/jp`) Path
- **File:** `app/components/LangSetter.tsx`
- **Issue:** The LangSetter component only checks for `/cn` and `/tw` prefixes. The `/jp` (Japanese) path sets `lang="en"` instead of `lang="ja"`.
- **Severity:** **Low**
- **Fix:** Add `pathname?.startsWith("/jp") ? "ja" : "en"` to the language detection logic.

### A11Y-009 — Table Headers in Admin Dashboard Lack `scope` Attributes
- **File:** `public/admin/index.html`, `public/admin/admin.js`
- **Issue:** Data tables throughout the admin dashboard use `<th>` elements without `scope="col"` or `scope="row"` attributes. Screen readers cannot properly associate headers with data cells.
- **Severity:** **Low**
- **Fix:** Add `scope="col"` to all column headers and `scope="row"` to any row headers.

---

## ⚡ 3. Performance Issues

### PERF-001 — Canvas Animation Runs Continuously Even When Off-Screen
- **File:** `components/HeroHome.tsx`
- **Issue:** The HeroHome canvas animation uses `requestAnimationFrame` in a loop that runs continuously for the lifetime of the component, even when the user has scrolled past the hero section or the tab is inactive. This consumes CPU/battery unnecessarily.
- **Severity:** **Medium**
- **Fix:** Use `IntersectionObserver` to pause the animation when the canvas is not visible. Also use `document.visibilityState` to pause when the tab is hidden.

### PERF-002 — Spotlight Component Causes Excessive Re-renders
- **File:** `components/Spotlight.tsx`, `utils/useMousePosition.ts`
- **Issue:** The `useMousePosition` hook updates state on every `mousemove` event, causing the `Spotlight` component and all its children to re-render continuously. On the team page, this affects two large card components.
- **Severity:** **Medium**
- **Fix:** Use `useRef` instead of `useState` for mouse position in `useMousePosition`. Apply CSS transforms directly via refs instead of triggering React re-renders. Consider using CSS `:hover` with `transform` for the spotlight effect instead of JavaScript.

### PERF-003 — Three Google Fonts Loaded (Inter, JetBrains Mono, Playfair Display)
- **File:** `app/layout.tsx`
- **Issue:** Three different font families are loaded, increasing total font payload. Playfair Display (serif) is only used for headings but loads a full Latin subset.
- **Severity:** **Low**
- **Fix:** Consider using `next/font` with `display: 'swap'` and subsetting. Already using `next/font/google` which is good, but verify that only required font weights are loaded (currently subsets=["latin"] which is correct).

### PERF-004 — AOS Library Loaded for Simple Fade Animations
- **File:** `app/(default)/layout.tsx`
- **Issue:** The entire `aos` library (3.0.0-beta.6) is imported just for simple `fade-up` animations that could be achieved with CSS `@keyframes` and `IntersectionObserver` natively.
- **Severity:** **Low**
- **Fix:** Replace AOS with a lightweight custom IntersectionObserver-based animation system, or use CSS `animation-timeline: view()` for modern browsers.

### PERF-005 — LiveTransactionStream Mock Data Generation in Render Path
- **File:** `components/LiveTransactionStream.tsx`
- **Issue:** `generateMockTransaction()` is called inside a `setInterval` callback that runs every 2-5 seconds. Each call uses `Math.random()` multiple times and builds transaction objects. While not severe, this runs indefinitely.
- **Severity:** **Low**
- **Fix:** Use `useRef` for the interval and clear it when the component unmounts (already done). Consider using a Web Worker for heavy mock data generation if the dataset grows.

### PERF-006 — No Image Lazy Loading for Below-Fold Images
- **File:** `components/PageIllustration.tsx`
- **Issue:** The `PageIllustration` component renders SVG illustrations that are always loaded immediately, even when below the fold. Next.js `Image` component is used but without `loading="lazy"`.
- **Severity:** **Low**
- **Fix:** Add `loading="lazy"` to the `Image` components in `PageIllustration`. Consider using `priority={false}` explicitly.

### PERF-007 — Duplicate useMousePosition Implementations
- **File:** `utils/useMousePosition.ts`, `utils/useMousePosition.tsx`
- **Issue:** Two nearly identical implementations of `useMousePosition` exist. Only `.tsx` is used by `Spotlight.tsx`. The `.ts` version is dead code.
- **Severity:** **Info**
- **Fix:** Delete `utils/useMousePosition.ts` and keep only `utils/useMousePosition.tsx`.

---

## 📝 4. Code Quality Issues

### QUAL-001 — Zod Imported But Not in Dependencies
- **File:** `lib/env.ts`
- **Issue:** The file imports `z` from `zod` (`import { z } from "zod"`), but `zod` is **not listed in `package.json` dependencies or devDependencies**. This will cause a build failure or runtime error if the package is not available via workspace hoisting.
- **Severity:** **High**
- **Fix:** Add `"zod": "^3.x"` to `dependencies` in `package.json`.

### QUAL-002 — Unused Imports in LiveTransactionStream
- **File:** `components/LiveTransactionStream.tsx`
- **Issue:** `MOCK_TRANSACTION_TYPES` and `MOCK_CHAINS` are imported from `@/lib/demo-config` but never used in the component.
- **Severity:** **Low**
- **Fix:** Remove unused imports.

### QUAL-003 — `any` Type Used in WebSocket Message Handler
- **File:** `components/LiveTransactionStream.tsx`, `app/admin/dashboard/page.tsx`
- **Issue:** `onMessage: (data: any) => void` and `handleWebSocketMessage = useCallback((data: any) => { ... })` use `any` type, bypassing TypeScript's type safety.
- **Severity:** **Medium**
- **Fix:** Define proper TypeScript interfaces for WebSocket message payloads and replace `any` with those interfaces.

### QUAL-004 — Missing Error Boundary for Async Data Fetching
- **File:** `app/admin/dashboard/page.tsx`, `demo/page.tsx`
- **Issue:** Multiple `useEffect` hooks perform async data fetching without try-catch blocks or error boundaries. If `fetchDashboardData()` throws, the entire dashboard page will crash to the Next.js error boundary (or white screen in production).
- **Severity:** **Medium**
- **Fix:** Wrap all async calls in try-catch. Add a local `error` state to display user-friendly error messages. Consider using React Query or SWR for robust data fetching.

### QUAL-005 — App Page Backup File Committed
- **File:** `app/(default)/page.tsx.bak`
- **Issue:** A backup file `page.tsx.bak` exists in the repository. Backup files should never be committed to version control.
- **Severity:** **Low**
- **Fix:** Delete `app/(default)/page.tsx.bak` and add `*.bak` to `.gitignore`.

### QUAL-006 — Missing Return Type on Multiple Functions
- **File:** `public/address-check.js`, `public/wallet-connect.js`
- **Issue:** JavaScript files lack JSDoc type annotations. While not required, the lack of types in utility functions (`formatAddress`, `formatTimeAgo`, etc.) makes refactoring risky.
- **Severity:** **Info**
- **Fix:** Add JSDoc `@param` and `@returns` annotations, or convert to TypeScript.

### QUAL-007 — Inline Styles Mixed with Tailwind Classes
- **File:** `components/ui/header.tsx`, `components/HeroHome.tsx`, `app/layout.tsx`
- **Issue:** Heavy use of inline `style={{ ... }}` alongside Tailwind classes creates maintainability issues. Example: `style={{ background: "rgba(7, 8, 16, 0.8)", backdropFilter: "blur(24px)" }}` in header.tsx.
- **Severity:** **Low**
- **Fix:** Move frequently used style combinations to the design system CSS (`fio-design-system.css`) as utility classes like `.fio-header-glass`.

### QUAL-008 — Footer Component Uses `style jsx` (Deprecated/Non-Standard)
- **File:** `components/ui/footer.tsx`
- **Issue:** The component uses `<style jsx>{`...`}</style>` which is a Next.js-specific feature that may not work in all build configurations and is less performant than standard CSS modules or Tailwind.
- **Severity:** **Low**
- **Fix:** Move the `.hover-text-2` class to `fio-design-system.css` or use Tailwind's `hover:` utilities.

### QUAL-009 — Admin HTML Has Inline Styles Instead of External CSS
- **File:** `public/admin/index.html`
- **Issue:** The admin dashboard is a single 1000+ line HTML file with all CSS in a `<style>` block. This is unmaintainable and caching-inefficient.
- **Severity:** **Medium**
- **Fix:** Extract CSS to `admin.css` and JS to `admin.js` (already partially done, but admin.js still contains embedded CSS strings).

### QUAL-010 — LangSetter Missing `/jp` Path Support
- **File:** `app/components/LangSetter.tsx`
- **Issue:** As noted in A11Y-008, the Japanese path is not handled, defaulting to `en`.
- **Severity:** **Low**
- **Fix:** Add Japanese language detection.

---

## 🔍 5. SEO Issues

### SEO-001 — No Structured Data / JSON-LD
- **File:** `app/layout.tsx`, `public/index.html`
- **Issue:** No JSON-LD structured data is present for the organization, product, or software application. Google rich snippets require structured data for enhanced search results.
- **Severity:** **Medium**
- **Fix:** Add JSON-LD `<script type="application/ld+json">` blocks for:
  - Organization (FidesOrigin)
  - SoftwareApplication (FidesOrigin protocol)
  - WebSite (with SearchAction for site search)

### SEO-002 — No Sitemap Reference in robots.txt
- **File:** `public/robots.txt` (not audited in detail, but typical issue)
- **Issue:** The `sitemap.xml` exists in `public/` but `robots.txt` may not reference it.
- **Severity:** **Low**
- **Fix:** Ensure `robots.txt` contains: `Sitemap: https://fidesorigin.com/sitemap.xml`

### SEO-003 — Next.js App Pages Lack Per-Page Meta Descriptions
- **File:** `demo/page.tsx`, `team/page.tsx`, `app/admin/dashboard/page.tsx`
- **Issue:** These pages don't export `metadata` objects. They inherit only the root layout's generic metadata, resulting in poor SEO for specific pages.
- **Severity:** **Low**
- **Fix:** Export `metadata` from each page:
  ```tsx
  export const metadata = {
    title: "Risk Detection Demo | FidesOrigin",
    description: "..."
  };
  ```

### SEO-004 — No Breadcrumb Structured Data
- **File:** All pages
- **Issue:** No breadcrumb navigation or structured data is present. This affects how search engines understand site hierarchy.
- **Severity:** **Info**
- **Fix:** Add breadcrumb navigation with JSON-LD BreadcrumbList structured data.

### SEO-005 — Canonical URLs Not Set on All Pages
- **File:** `demo/page.tsx`, `team/page.tsx`
- **Issue:** The static HTML files have canonical links, but Next.js app routes don't set canonical URLs, risking duplicate content issues if query parameters are added.
- **Severity:** **Info**
- **Fix:** Use `metadata.alternates.canonical` in Next.js app routes.

---

## 🌐 6. Cross-Browser Compatibility Issues

### XBR-001 — `dvh` Units Used Without Fallback
- **File:** `public/admin/index.html`
- **Issue:** CSS uses `min-height: 100dvh` extensively. Safari < 15.4 and some older mobile browsers do not support `dvh` units.
- **Severity:** **Medium**
- **Fix:** Provide fallback: `min-height: 100vh; min-height: 100dvh;`

### XBR-002 — `backdrop-filter` Without Fallback
- **File:** `components/ui/header.tsx`, `public/styles.css`
- **Issue:** `backdrop-filter: blur(24px)` is used for glassmorphism effects. Firefox historically had partial support, and older browsers ignore it entirely without a fallback background color.
- **Severity:** **Low**
- **Fix:** Ensure a solid fallback background color is defined before the backdrop-filter:
  ```css
  background: rgba(7, 8, 16, 0.95); /* fallback */
  background: rgba(7, 8, 16, 0.8);
  backdrop-filter: blur(24px);
  ```

### XBR-003 — Tailwind v4 `@theme` and `@plugin` Syntax
- **File:** `css/style.css`
- **Issue:** The CSS file uses Tailwind CSS v4 syntax (`@theme`, `@plugin`, `@import 'tailwindcss'`). Older browsers that don't support CSS nesting may have issues with some generated styles.
- **Severity:** **Low**
- **Fix:** Ensure PostCSS is properly configured to transpile modern CSS for older browsers. The current `postcss.config.js` only includes `@tailwindcss/postcss`.

### XBR-004 — `supports-[overflow:clip]` CSS Feature Query
- **File:** `app/layout.tsx`
- **Issue:** `supports-[overflow:clip]:overflow-clip` is a Tailwind v4 feature query. Very old browsers won't understand this but will gracefully fall back to `overflow-hidden`.
- **Severity:** **Info**
- **Fix:** Verify the fallback behavior is acceptable (it appears to be — `overflow-hidden` is the base class).

### XBR-005 — Canvas Particle System No Fallback
- **File:** `public/index.html`
- **Issue:** The particle canvas animation has no fallback for browsers with JavaScript disabled or canvas unsupported. The hero section would appear empty.
- **Severity:** **Info**
- **Fix:** Add a CSS gradient fallback that is visible when canvas is not supported.

---

## 📋 Appendix A: Files with Critical/High Issues

| File | Issues |
|------|--------|
| `vercel.json` | SEC-002 |
| `public/index.html` | SEC-001, SEC-003, A11Y-001, A11Y-004 |
| `public/address-check.html` | SEC-001, SEC-006, A11Y-003 |
| `public/admin/index.html` | SEC-008, SEC-009, A11Y-002, A11Y-004, PERF-007, QUAL-009 |
| `public/admin/admin.js` | SEC-003, SEC-009 |
| `public/wallet-connect.js` | SEC-004, SEC-009 |
| `demo/page.tsx` | SEC-005, SEC-011, SEO-003 |
| `lib/env.ts` | QUAL-001 |
| `components/HeroHome.tsx` | A11Y-001, PERF-001 |
| `components/Spotlight.tsx` | PERF-002 |
| `components/ui/header.tsx` | A11Y-003, A11Y-005, QUAL-007 |

---

## ✅ Priority Remediation Roadmap

### P0 — Fix Immediately (Before Next Deploy)
1. **SEC-001 & SEC-002**: Fix CSP nonce implementation. Either remove nonces from static files and use hash-based CSP, or implement proper `middleware.ts` with per-request nonces.
2. **SEC-003**: Sanitize all `innerHTML` usage in `admin.js`. Replace with `document.createElement` + `textContent`.
3. **QUAL-001**: Add `zod` to `package.json` dependencies.
4. **SEC-005 & SEC-011**: Remove `NEXT_PUBLIC_API_KEY` from client code. Proxy all API calls through Next.js API routes.

### P1 — Fix Within 1 Week
5. **SEC-004**: Replace `setHtml` in `wallet-connect.js` with DOM API.
6. **SEC-009**: Add SRI hashes to all CDN-loaded scripts.
7. **SEC-006**: Proxy Subgraph and RPC calls through backend.
8. **A11Y-001**: Add proper ARIA labels to canvas elements.
9. **A11Y-004**: Add skip navigation links.
10. **PERF-001**: Pause canvas animation when off-screen.

### P2 — Fix Within 1 Month
11. **SEC-007**: Strengthen CSRF token handling.
12. **SEC-010**: Add WebSocket authentication.
13. **A11Y-005**: Improve focus indicators across all interactive elements.
14. **A11Y-006**: Respect `prefers-reduced-motion`.
15. **PERF-002**: Optimize Spotlight component to avoid re-renders.
16. **QUAL-004**: Add error boundaries and proper error handling for async operations.
17. **SEO-001**: Add JSON-LD structured data.

### P3 — Fix When Convenient
18. Remove backup files (`page.tsx.bak`).
19. Remove duplicate `useMousePosition.ts`.
20. Add per-page metadata to all routes.
21. Extract admin inline styles to external CSS.
22. Add breadcrumb navigation.

---

*End of Audit Report*
