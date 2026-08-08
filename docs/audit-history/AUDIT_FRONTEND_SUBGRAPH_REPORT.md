# FidesOrigin Frontend & Subgraph Audit Report

**Audit Date:** 2026-07-23  
**Auditor:** AI Subagent (audit-frontend-subgraph)  
**Scope:** Frontend (apps/web/), Subgraph (apps/subgraph/), Deployment Config

---

## 🚨 P0 — Critical Issues Found & Fixed

### 1. Four-Language HTML Structure Completely Inconsistent
**Impact:** TW and JP versions used entirely different CSS classes and HTML structures, rendering them broken or visually inconsistent with EN/CN.

**Details:**
- **EN version** (baseline): Standard structure with `.hero`, `.features-grid`, `.steps`, `.compliance-grid`, `.dev-grid`
- **CN version**: Mostly aligned with EN but had unique sections (One-liner, Use Cases) not in EN
- **TW version**: Used completely different classes (`.brand-hero`, `.diff-grid`, `.diff-item`, `.steps-grid`, `.fade-in`) **not defined in styles.css** → page rendering severely broken
- **JP version**: Most comprehensive content but used unique classes (`.arch-layer`, `.status-dot`, `.doc-card`, `.uc-row`) also missing from styles.css

**Fix Applied:**
- Unified all 4 languages to identical HTML structure using a Python template generator
- All versions now share: Nav → Hero → Wallet Compliance → Trust Bar → Features → How It Works → Use Cases → Security → Developer Experience → CTA → Footer
- Preserved language-specific content while ensuring identical DOM structure

**Files Modified:**
- `apps/web/public/index.html`
- `apps/web/public/cn/index.html`
- `apps/web/public/tw/index.html`
- `apps/web/public/jp/index.html`
- `apps/web/cn/index.html` (synced)
- `apps/web/tw/index.html` (synced)
- `apps/web/jp/index.html` (synced)

### 2. Root vercel.json CSP Misconfigured
**Impact:** Vercel-level CSP header was stricter than HTML meta CSP, potentially blocking Google Fonts, external RPCs, and The Graph API.

**Details:**
- Root `vercel.json` CSP: `connect-src 'self'` only
- HTML meta CSP: `connect-src 'self' https://api.studio.thegraph.com https://rpc.sepolia.org ...`
- Root CSP also missing `https://fonts.googleapis.com` in `style-src` and `https://fonts.gstatic.com` in `font-src`

**Fix Applied:**
- Updated root `vercel.json` CSP to match HTML meta CSP exactly
- Added `script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net`
- Added `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
- Added `font-src 'self' https://fonts.gstatic.com`
- Added `img-src 'self' data: https:`
- Added full `connect-src` allowlist

### 3. Missing Multi-Language 404 Pages
**Impact:** Users accessing `/cn/nonexistent` or `/tw/nonexistent` would see English 404 page.

**Fix Applied:**
- Created localized 404 pages for CN, TW, JP
- Each preserves the base 404 styling with translated title, description, and CTA button

**Files Created:**
- `apps/web/public/cn/404.html`
- `apps/web/public/tw/404.html`
- `apps/web/public/jp/404.html`

---

## 🔶 P1 — High-Priority Issues Found & Fixed

### 4. Subgraph Schema Dead Code
**Impact:** Unused entities bloat schema and may confuse developers.

**Fix Applied:**
- Removed `TopRiskAddress` entity (defined in schema but never created by any mapping)
- Removed `FidesRiskProfile` entity (defined in schema but never referenced in any mapping code)

**File Modified:** `apps/subgraph/schema.graphql`

### 5. Subgraph RiskTier Mapping Incomplete
**Impact:** Risk tier value `4` (CRITICAL) would be logged as UNKNOWN, causing data quality issues.

**Fix Applied:**
- Added `if (tierValue === 4) return 'CRITICAL';` to `getRiskTier()` in `src/mappings/shared/riskTier.ts`

**File Modified:** `apps/subgraph/src/mappings/shared/riskTier.ts`

### 6. Missing Address-Check Page for JP
**Impact:** `/jp/address-check.html` returned 404.

**Fix Applied:**
- Copied EN address-check.html to `apps/web/public/jp/address-check.html`
- Added `/jp/address-check` route to root `vercel.json`
- Note: Full JP localization of address-check.html recommended as follow-up

---

## 🔷 P2 — Medium-Priority Issues Found & Fixed

### 7. CSS Missing Code Syntax Highlighting Classes
**Impact:** Code blocks in CN/TW/JP versions lacked string and number color highlighting.

**Fix Applied:**
- Added `.str { color: #98c379; }` for string literals
- Added `.num { color: #d19a66; }` for numeric literals
- Added `#use-cases .features-grid` responsive grid rules

**File Modified:** `apps/web/public/styles.css`

### 8. Wallet-Connect.js Integrity Verified
**Status:** No issues found. Contract address `0x1176db6ECa38AA9C4d153Ae4d21C3972c6335707` present, auto-connect logic (`eth_accounts`) intact, proper event listener cleanup.

---

## ⚠️ Remaining Issues (Recommended for Follow-Up)

### R1. Address-Check Page Localization
**Priority:** Medium  
The JP `address-check.html` is a copy of the EN version. CN and TW versions have their own localized versions. Consider creating a fully localized JP version.

### R2. Dead Links in Footer
**Priority:** Low  
Multiple footer links across all 4 languages point to `#` (placeholder):
- Documentation → `#`
- API Reference → `#`
- SDK → `#`
- Blog → `#`
- Privacy Policy → `#`
- Terms of Service → `#`

### R3. CSP Nonce Static
**Priority:** Low  
All 4 HTML versions use hardcoded nonce `2726c7f26c`. For a static site this is acceptable, but consider nonce rotation if moving to SSR.

### R4. sitemap.xml Missing address-check Pages
**Priority:** Low  
`sitemap.xml` does not include `/address-check.html` or its localized variants.

---

## ✅ Final Verification Results

| Check | Status |
|-------|--------|
| 4-language HTML structure consistency (9 sections each) | ✅ PASS |
| All 4 index.html use identical CSS class names | ✅ PASS |
| Multi-language 404 pages exist (EN/CN/TW/JP) | ✅ PASS |
| Address-check pages exist for all 4 languages | ✅ PASS |
| styles.css supports all required classes | ✅ PASS |
| wallet-connect.js contract address valid | ✅ PASS |
| Subgraph handler names match YAML declarations | ✅ PASS (0 mismatches) |
| Subgraph dead entities removed | ✅ PASS |
| Subgraph CRITICAL tier (4) supported | ✅ PASS |
| Root vercel.json valid JSON | ✅ PASS |
| Root vercel.json CSP aligned with HTML | ✅ PASS |

---

## 📁 Files Changed Summary

### Frontend
- `vercel.json` — CSP & route fixes
- `apps/web/public/index.html` — Structure unified
- `apps/web/public/cn/index.html` — Structure unified
- `apps/web/public/tw/index.html` — Structure unified (was broken)
- `apps/web/public/jp/index.html` — Structure unified
- `apps/web/public/cn/404.html` — Created
- `apps/web/public/tw/404.html` — Created
- `apps/web/public/jp/404.html` — Created
- `apps/web/public/jp/address-check.html` — Created
- `apps/web/public/styles.css` — Added code color classes
- `apps/web/cn/index.html` — Synced from public/
- `apps/web/tw/index.html` — Synced from public/
- `apps/web/jp/index.html` — Synced from public/

### Subgraph
- `apps/subgraph/schema.graphql` — Removed TopRiskAddress, FidesRiskProfile
- `apps/subgraph/src/mappings/shared/riskTier.ts` — Added CRITICAL tier support

---

## 🛠 Tools Used

- Python 3 template generator for HTML unification
- `grep`, `diff`, `comm` for structural validation
- `python3 -m json.tool` for config validation
- `git diff` for change tracking

---

*Report generated by audit-frontend-subgraph subagent.*
