# Changelog

All notable changes to the FidesOrigin project.

## [v2.8.0] - 2026-08-08

### Added

- **Real-time Demo Page**: Full Sepolia testnet integration with MetaMask support
  - Live contract interaction (FidesCompliance V2.1)
  - Multi-RPC fallback (Sepolia, Ankr, PublicNode)
  - ethers.js v6 integration
- **Address Check V2.1**: Complete rewrite with Guard integration
  - Real-time Sepolia contract queries
  - RiskRegistry profile lookup
  - Guard status monitoring (active/inactive/offline)
  - Multi-method fallback for contract calls
- **Multilingual Expansion**: 15 new translated pages
  - CN: pricing, case-studies, demo, docs/contracts
  - TW: pricing, case-studies, demo, docs/contracts
  - JP: pricing, case-studies, demo, docs/contracts
  - Professional terminology per locale (风控守卫/風控守衛/ガード)
- **Brand 404 Page**: Lightweight, brand-consistent error page
  - Guard status badge ("Guard Status: CLEAR")
  - Navigation + language switcher
  - noindex, nofollow for SEO
- **Complete Sitemap**: Auto-generated 121-URL sitemap.xml
  - Covers all 128 HTML files
  - Proper priorities and changefreqs
  - Hreflang alternates for all locales

### Changed

- **Documentation V2.1**: Updated all docs to reflect Guard architecture
  - docs/index.html: V2.1 badge, Sepolia addresses, Guard concepts
  - docs/api.html: Guard API endpoints, pre-transaction validation
  - docs/sdk.html: SDK v0.2.1, on-chain SDK, React hooks
- **Blog Uniformity**: 7 legacy articles updated with current nav/footer
  - Consistent language switchers
  - Updated navigation links (Architecture, Demo, GitHub)
- **SEO Meta Tags**: Fixed 8 pages with proper Open Graph, Twitter Cards
  - Absolute URLs for og:image
  - Canonical links
  - Hreflang tags

### Fixed

- **Contract Tests**: 3 failing tests in Guard/PreTransactionGuard
  - Fixed method name mismatches (getGuardStats vs getStats)
  - Fixed event argument assertions
  - All 11 tests now passing (2s)
- **Sitemap Completeness**: Fixed missing 71 URLs (50 → 121)
  - Added architecture, vs-chainalysis, new blogs, i18n docs
- **Orphaned Files**: Removed index.html.bak
- **Backup Cleanup**: Deleted cn.bak/ and tw.bak/ (36 files)

### Security

- CSP headers via Cloudflare Worker (confirmed in HTTP response)
- X-Frame-Options: DENY
- Strict-Transport-Security: max-age=63072000

### Deployment

- **Cloudflare Workers**: Production traffic routed through Workers
  - Security header injection at edge
  - ~30s global CDN propagation
- **GitHub Actions**: Auto-deploy on push to main
  - 7 workflows: ci, deploy, deploy-cloudflare, deploy-contracts, deploy-subgraph, deploy-web, publish-sdk

## [v2.7.0-A+] - 2026-08-01

### Added

- A+ security audit report
- Cloudflare Workers proxy for security headers
- 391 passing contract tests
- Subgraph v0.0.4 with Guard entities

### Changed

- Website v2.1 full rebuild
- Multilingual support (EN/CN/TW/JP)
- IP auto-detection for language routing

## [v2.1.0] - 2026-07-23

### Added

- FidesCompliance V2.1 with Guard integration
- PreTransactionGuard for pre-flight checks
- GNN-powered address profiling
- Pluggable compliance modules (UUPS proxy)

## [v2.0.0] - 2026-07-19

### Added

- RiskRegistry V2 with CDD labels
- PolicyEngine with per-wallet rules
- QuarantineVault for blocked funds
- CompliantStableCoin (fUSD)

## [v1.0.0] - 2026-07-12

### Added

- Initial protocol launch
- Basic KYC/AML screening
- OFAC blacklist checks
- Programmable policy rules
