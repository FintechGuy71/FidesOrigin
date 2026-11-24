# Changelog

All notable changes to the FidesOrigin project.

## [v3.3.4] - 2026-11-25

### Added — live metrics and public verification

- 首页采用构建快照首屏兜底，并在每次访问时同时核验公开统计 API 与 Subgraph；仅双源成功才显示实时已验证，失败明确保留缓存快照。
- 新增英文、简体中文、繁体中文、日文公开验证中心，提供真实地址查询、当前合约链接和最新 Release 证据下载。
- 验证中心进入现有静态路由、canonical、hreflang 与 sitemap 流程，桌面和移动端均纳入浏览器验收。

### Fixed — contact and deployment truthfulness

- 首页与页尾预约 CTA 改接真实 `/contact` 表单；默认提交到同源 `/api/v1/contact`，消息必填，单次 30 秒超时且不自动重试写入。
- 首页 RiskRegistry 链接从已弃用地址修正为当前 UUPS 代理，并统一读取合约部署注册表。
- 地址查询与运行期指标的前端超时对齐只读网关冷启动窗口，避免后端尚未完成时提前失败。

### Verification

- Web lint、TypeScript 和静态生产构建通过，共生成 99 个页面。
- 全仓 9/9 测试任务通过，合约 450/450 通过；缓存回退和预约单次提交行为测试通过。
- 本地真实浏览器验收覆盖四语首页、四语验证中心、375px 移动端和联系页，控制台、页面异常、HTTP 错误与请求失败均为 0。

详见 `RELEASE_v3.3.4.md`。

## [v3.3.3] - 2026-11-24

### Fixed — Subgraph production deployment

- 为 jayson 4.2.0 添加两行可审查补丁，兼容 stream-json 3.9.0 的 ESM 导出与新文件名。
- 不使用 stream-json 1.9.1 降级方案，避免重新引入三条中危公告。
- Graph 部署命令真实加载通过；生产依赖审计高/中危为 0，仅保留既有 elliptic 低危边界。
- 包含 v3.3.2 的全部系统、每日验证、官网和真实视觉基线修复。

详见 `RELEASE_v3.3.3.md`。

## [v3.3.2] - 2026-11-24

### Fixed — full-stack runtime and website verification

- Windows 服务监督器新增单实例锁、陈旧锁隔离回收和健康 PID 绑定，重复启动返回非零且不影响现有实例。
- 发布器健康响应携带真实 PID；Redis 消费者正常停止时注销，启动时清除零 pending 的重复/陈旧记录，有待处理消息时保留恢复。
- 公共只读代理支持显式超时和一次受控重试；写操作保持禁止重试，默认代理行为不变。
- 新增 Windows + Electron 专用 Turbo 启动器，标准 `pnpm build/test` 在本机可用，Linux/CI 继续使用严格环境模式。
- 每日同步新增链上、公开 API、本机健康与队列综合验收；失败写入同一天每日志并返回非零退出码。
- 官网四语区分风险情报库与链上当前档案，移除未经验证的延迟、网络数、零链下依赖和旧数据源宣传。
- 官网风险查询默认同源，修复 hydration 类变更告警；补齐 Next ESLint、Link 与 Image 组件约束。
- 新增真实浏览器验收脚本，覆盖四语、移动端、最终计数、控制台、404、横向溢出和真实 Scam 查询。

### Verification

- 数据同步 101/101、发布器 54/54、监督器 6/6、API 9/9、启动器 3/3 测试通过。
- 后端全量 126/126 在真实 PostgreSQL 上通过。
- 根工作区测试 9/9、生产构建 10/10 任务通过；合约 450/450 通过。
- 真实 dry-run 的链上、公开 API、本机运行时综合验收全部通过。
- 浏览器控制台错误、页面异常、HTTP 错误和请求失败均为 0；375px 无横向溢出。
- 当前公开指标：5,348 条风险情报记录、145 个 Sepolia 链上档案。

详见 `RELEASE_v3.3.2.md`。

## [v3.3.1] - 2026-11-23

### Fixed — SDK publishing hotfix

- 将 `@fintechguy71/fidesorigin-sdk` 从已存在的 0.3.1 升至 0.3.2，解决 v3.3.0 标签工作流的 npm 409 不可覆盖冲突。
- SDK 发布后新增注册表精确版本回读，避免仅凭标签检查、构建或上传步骤宣称发布成功。
- 规范化 SDK repository URL，消除 npm 发布时的自动修正警告。
- 修正额外 Vercel `repo` 项目的框架和根目录配置；保留并重新执行检查，不关闭部署保护。

### Verification and release discipline

- v3.3.0 的 13 项适用检查与三个 Vercel 项目均已通过；视觉回归按路径过滤器不适用于纯文档/版本变更。
- v3.3.0 的 annotated tag 校验和 SDK 构建成功，但 0.3.1 上传返回 409，因此由本热修复版本取代。
- 每次 SDK 发布必须递增 `packages/sdk/package.json` 版本，且验收注册表实际返回该版本。

详见 `RELEASE_v3.3.1.md`。

## [v3.3.0] - 2026-11-23

### Fixed — audit closure and runtime recovery

- dry-run 保护下沉到最终单条写链入口，队列消息在锁开启或关闭时都不能绕过。
- 每日调度区分启动、完成、失败、中断和超时；异常中断可补跑，失败按间隔与最大次数受控重试。
- 链上撤榜状态可覆盖数据库陈旧制裁标签，链上回读同时覆盖数据库命中和未命中。
- Merkle 更新后重新读根，下架后重新读取制裁集合，所有写操作完成后再次验证最终档案状态。
- 下载器绑定 `.part` 的来源与摘要，OFAC 强制 Digest，并兼容标准 Base64 与 OFAC 实际十六进制摘要格式。
- Redis Stream 轮询串行化，健康检查纳入轮询进度，关闭时等待进行中轮询结束。
- 后端 RPC 日志仅保留脱敏后的源地址；核心与服务包按需导入，消除初始化循环依赖。
- Windows 监督器纳入版本管理，加入指数退避、重启计数、结构化状态和可选告警 Webhook。
- Subgraph 测试固定 matchstick 0.6.0；Web 从 `next lint` 迁移到原生 ESLint，依赖覆盖收窄到实际公告路径。

### Security and dependencies

- 发布器升级 Express 5.3、node-cron 4.6、Axios 1.21、Azure Identity 4.14 等，生产审计为 0。
- 后端升级 FastAPI、Starlette、PyJWT、python-multipart、python-dotenv、pytest 和 black，pip-audit 无已知漏洞。
- 工作区依赖公告仅剩 elliptic 的一条低危例外；上游尚未发布公告所列修复版本，没有伪造清零。
- 精确移除未使用的 zkSync Git 间接依赖，保留供应链保护，不全局关闭检查。

### Verification

- 数据同步 96/96、发布器 52/52、后端专项 7/7、监督器 2/2 测试通过。
- 工作区测试包含合约 450/450；全部生产构建通过。
- 真实 dry-run：132/132 档案一致，0 候选、0 读错误、Merkle 根匹配。
- 真实调度补跑退出码 0，无交易需求，最终回读通过，重启后无重复执行。
- Redis 强制终止后自动恢复，发布器探针恢复，队列 pending/lag/DLQ 均为 0。
- PR #134 的 14/14 项远端检查通过。

详见 `RELEASE_v3.3.0.md`。

## [v3.2.0] - 2026-11-08

### Added — runtime verification and resilient scheduling

- 链上同步新增候选数、实际更新数、跳过原因、写后剩余差异和读错误统计；写后不一致时返回失败。
- 新增版本化每日调度器：持久化执行状态、错过任务补跑、单实例锁、30 分钟超时、失败与超龄告警。
- `data-sync` 与 `data-publisher` 通过 Redis `fides:lock:chain:write` 共享写锁协调链上写入。
- OFAC、UKSL、OpenSanctions 下载支持断点续传、独立超时、SHA-256 Digest 校验和新鲜缓存回退。
- 后端官方制裁策略支持数据库未命中/不可用后的 Sepolia RiskRegistry 回读与备用 RPC；全部 RPC 失败时显式报错。

### Fixed — publisher and data consistency

- 编译后的发布器可从包根目录加载 `.env`；异常时清理并退出，Redis 错误不再形成无监听器异常。
- 健康检查增加消息队列订阅状态；监控后台定时器完整清理；定时采集与队列发布职责可拆分。
- `data-sync` 与发布器支持 `RPC_URLS` 备用节点；数据库同步状态、数据源健康状态写入同步摘要。
- 补齐 Redis、Winston、Winston Daily Rotate File 运行依赖；`follow-redirects` 升级至 1.16.2，生产依赖审计为 0。

### Verification

- 数据同步 90/90、发布器 48/48、后端链上回读 3/3 测试通过。
- 真实 dry-run：132/132 档案一致，0 读错误，Merkle 根匹配，退出码 0。
- 真实 Sepolia 回读：已知制裁地址为 true，零地址为 false。
- Redis 强制终止后自动恢复，发布器健康和就绪探针恢复；队列 pending/lag/DLQ 均为 0。
- 版本化调度器继承当天成功记录，未重复写链；PR #132 的 13/13 项远端检查通过。

详细运行说明、升级步骤、验收证据和剩余边界见 `RELEASE_v3.2.0.md`。

## [v3.1.1] - 2026-11-07

### Fixed — UK sanctions data source

- 将已于 2026-01-28 停止更新的 OFSI ConList 默认数据源迁移到 FCDO UK Sanctions List (UKSL) 静态 CSV。
- `data-sync/sanctions-sync.js` 同时兼容 UKSL 与旧 OFSI 的表头、`Unique ID` / `OFSI Group ID`、地址字段、实体类型和 Regime 字段。
- `data-sync/scripts/daily-sync.js` 使用 UKSL 默认地址，并兼容 `Address Line 1..6` / `Address 1..6` 两套字段；保留来源健康位、陈旧快照保护和下架保护语义。
- 新增 UKSL 真实表头与 EVM 地址提取回归测试；旧 OFSI 解析测试继续保留，避免兼容性回退。

### Verification

- PR #130 的 13/13 项检查通过；合并后 `main` 数据同步测试 80/80 通过。
- UKSL 实源解析 58,836 条记录，产出 5 个有效且去重的 EVM 地址，来源健康位正常。
- 完整 dry-run：OFAC 127、UKSL 5、OpenSanctions 132、Scam Sniffer 2,530；合并后 132 个唯一地址。
- 链上差异读取 0 错误；6 个地址待更新、126 个幂等跳过；下架检查完成且 0 个下架；验证未发送交易。
- Windows 本机原生部署验收：Redis PONG，发布器 `/health` 与 `/ready` 均为 200，Stream ACK 后 `pending=0`、`lag=0`、`DLQ=0`。

### Upgrade notes

- 无合约 ABI、Merkle leaf、角色或数据库 schema 变更，无需重新部署合约。
- 自定义 `HMT_URL` 仍指向旧 ConList 的部署方，应删除该覆盖或改为 `https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv`。
- 详细发布说明、运维经验与已知限制见 `RELEASE_v3.1.1.md`。

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
