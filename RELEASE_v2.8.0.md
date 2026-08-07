# FidesOrigin Release v2.8.0

**Release Date**: 2026-08-08  
**Commit**: `b22708df`  
**Deploy**: Cloudflare Workers (production)

---

## 🎯 Release Summary

Complete website optimization week — 9 parallel Agents, 49 commits, 128 HTML files, 121 URLs in sitemap.

## 📦 What's New

### 🚀 Real-Time Demo (`/demo.html`)

- **Sepolia Testnet Integration**: Live contract interaction
- **MetaMask Support**: Full wallet connection flow
- **Multi-RPC Fallback**: Sepolia + Ankr + PublicNode
- **ethers.js v6**: Modern Ethereum library

### 🔍 Address Check V2.1 (`/address-check.html`)

- **Guard Integration**: Real-time contract queries
- **RiskRegistry Lookup**: 20,000+ address profiles
- **Status Monitoring**: Active/Inactive/Offline indicators
- **Multi-Method Fallback**: Resilient contract calls

### 🌏 Multilingual Expansion (15 New Pages)

| Language      | Pages Added                                 |
| ------------- | ------------------------------------------- |
| CN (简体中文) | pricing, case-studies, demo, docs/contracts |
| TW (繁體中文) | pricing, case-studies, demo, docs/contracts |
| JP (日本語)   | pricing, case-studies, demo, docs/contracts |

**Terminology**: 风控守卫 / 風控守衛 / ガード

### 📄 Complete Sitemap

- **121 URLs**: Auto-generated from all HTML files
- **Hreflang**: Full alternate language support
- **Priorities**: Proper SEO weighting per page type

### 🎨 Brand 404 Page

- **Guard Status Badge**: "Guard Status: CLEAR"
- **Navigation**: Full nav + language switcher
- **SEO**: noindex, nofollow

### 📚 Documentation V2.1

- **API Docs**: Guard endpoints, pre-transaction validation
- **SDK Docs**: v0.2.1, on-chain SDK, React hooks
- **Contract Docs**: All Sepolia addresses verified

## 🔧 Fixes

| Issue                     | Fix                                 |
| ------------------------- | ----------------------------------- |
| 3 contract tests failing  | Method name fixes, 11/11 passing    |
| 71 missing sitemap URLs   | Auto-generation script, 50→121      |
| Legacy blog inconsistency | 7 articles updated with current nav |
| Orphaned backup files     | cn.bak/ tw.bak/ deleted (36 files)  |

## 🛡️ Security

- **CSP**: Injected via Cloudflare Worker
- **HSTS**: max-age=63072000
- **X-Frame-Options**: DENY
- **Referrer-Policy**: strict-origin-when-cross-origin

## 📊 Stats

| Metric                | Value           |
| --------------------- | --------------- |
| Total HTML Files      | 128             |
| Sitemap URLs          | 121             |
| Languages             | 4 (EN/CN/TW/JP) |
| Contract Tests        | 11/11 passing   |
| Git Commits This Week | 49              |
| Parallel Agents       | 9               |

## 🔗 Resources

- **Website**: https://fidesorigin.com
- **GitHub**: https://github.com/FintechGuy71/FidesOrigin
- **Docs**: https://fidesorigin.com/docs/
- **Demo**: https://fidesorigin.com/demo.html

## 🏷️ Previous Releases

- `v2.7.0-A+` (2026-08-01) — A+ security audit, Cloudflare Workers
- `v2.1.0` (2026-07-23) — Guard integration, GNN profiling
- `v2.0.0` (2026-07-19) — RiskRegistry V2, PolicyEngine, QuarantineVault
- `v1.0.0` (2026-07-12) — Initial protocol launch
