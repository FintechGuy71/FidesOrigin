# Changelog

All notable changes to the FidesOrigin project.

## [v3.1.0] - 2026-08-23

**安全审计修复版本**：完整修复安全审计发现的全部 53 项问题（High 6 / Medium 15 / Low 26 / Info 6）。

> 注：仓库中已存在一个指向未合入 main 的孤立提交的 v3.0.0 标签（2026-07-01，已废弃的旧审计轮次）。本 v3.1.0 为 main 血统上的正式发布版本，语义上接管 v3.0.0 的定位。

### ⚠️ Breaking Changes（9 项，部署/集成方必须知晓）

- `FidesCompliance.initialize` 参数从 4 个改为 3 个（移除死引用 quarantineVault）
- Merkle leaf 统一为 `keccak256(abi.encode(addr, riskScore, uint8 tier))` 规范格式（原字符串 tier 不再兼容）
- `FidesOriginTimelock` 紧急调度改用独立的 `scheduleEmergency()` / `EMERGENCY_DELAY` 语义
- `ComplianceEngine.validateOperation` 不再经由外部 `validateTransfer` 鉴权路径
- `AdminFacet` 移除升级提案死代码系统（proposeUpgrade 等）与对应存储字段
- `FidesCompliance` 白名单改为两步时间锁（propose/execute）
- `AdminFacet.withdrawETH` 改为两步 48h 时间锁
- apps/api 规则存储迁移至 Vercel KV（需环境变量支持）
- data-sync Merkle 构建改为 OZ MerkleProof 兼容（排序对哈希 + 类型化双哈希 leaf）

### Fixed — 智能合约层（28 项）

- **H-1** `FidesOriginTimelock.scheduleEmergency` 绕过 OZ minDelay 检查，紧急调度真正可用
- **H-2** `CompliantStableCoin` mint/burn 改用双侧参数检查，合规开启时不再必然失败
- **H-3** `ComplianceEngine.validateOperation/validateBatch` 消除自调用鉴权陷阱
- **M-1~M-10** Merkle 格式统一、chainSyncer ABI 对齐、共识阈值自动提升、升级时间锁自举、白名单两步化、死引用/死代码移除、评估路径与预览一致性
- **L-1~L-15** 零地址校验、角色事件、冷却期语义、置信度参数化、预言机质押罚没、桥接 nonce 严格递增、Guard 失败语义可配置等

### Fixed — apps/api（9 项）

- **H-4** API Key 作用域分级（只读/管理），CSRF 语义修正
- **H-5** 显式 `AUTH_REQUIRED` 配置替代 NODE_ENV 嗅探，规则存储接入 Vercel KV
- **M-11~M-13** CORS 放行服务端 SDK、限流统一 Redis 实现、移除伪风险评分
- **L-16~L-19** 常数时间密钥比较、模块级副作用清理、代理响应头白名单等

### Fixed — 数据链路 / SDK / 前端 / 后端（15 项）

- data-sync `merkleBuilder` 重写（OZ 兼容 + 证明生成）；`chainSyncer` ABI 对齐真实合约
- guard-sdk 缓存键纳入发送方与金额；mempool-watcher 改用 LRU 淘汰
- 管理仪表盘移除假数据回退；CSP nonce 化；CF Worker JSON 短缓存
- backend `config.py` URL 安全构造；monitor.py 移除安慰剂内存清除

### Removed / Changed — 仓库卫生（6 项）

- ENVIRONMENT.md 移除测试私钥；运行时产物与 AI 开发痕迹清理（已加 .gitignore）
- CI actions 全部固定到 commit hash；白皮书指标话术修正
- 新增 `DEPLOYED.md` 声明权威合约集；旧版合约标记 DEPRECATED

### Verification

- 112 个合约编译通过；**hardhat test 449/449 全绿**（修复前 434/12，新增 15 项回归测试）
- merkleBuilder 端到端 OZ 语义验证通过；node --check / tsc / py_compile 全部通过
- 完整追溯矩阵见 `FidesOrigin_修复报告.md`（项目根目录交付件）

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
