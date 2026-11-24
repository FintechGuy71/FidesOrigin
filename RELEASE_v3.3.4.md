# FidesOrigin v3.3.4 — Live Metrics, Public Verification & Contact Closure

**发布日期**：2026-11-25

**版本类型**：官网真实数据与公开验收能力增强

**包含基础**：v3.3.3 的全部代码、系统、Subgraph 部署与生产验证修复

## 1. 运行期指标，而非每日重建官网

首页继续使用构建期完整快照保证首屏和离线可读性，同时在每次访问时请求：

- 同源 `/api/v1/public/stats`：数据库风险情报聚合。
- Sepolia Subgraph：以 keyset 分页统计当前链上档案，安全上限 100,000。

只有两个来源都成功且数值合法，页面才显示“实时已验证”。任一失败、超时或数据异常都会保留最后完整快照并显示“缓存快照”，不会把旧数据伪装成实时数据。运行期时间戳也会校验格式。

该方案不为单纯数字变化制造每日空提交或无意义部署。

## 2. 四语公开验证中心

新增：

- `/verification`
- `/cn/verification`
- `/tw/verification`
- `/jp/verification`

页面复用现有 LegacyShell、设计系统与真实 HeroScreen 查询，提供：

- 数据库风险情报与链上当前档案的分口径展示。
- 无需钱包的真实 Sepolia 地址风险查询。
- RiskRegistry、MerkleRiskRegistry、PolicyEngine、ComplianceEngine 的当前 Etherscan 链接。
- 最新 Release 说明与验证证据包下载。

四个路由统一进入现有静态参数、canonical、hreflang、OG 与 sitemap 生成流程。合约地址从 `packages/config/deployments.json` 读取，不再维护另一份前端地址常量。

## 3. 真实预约闭环

- 首页首屏和底部预约 CTA 均进入现有 `/contact`。
- 表单默认使用同源 `/api/v1/contact`，不再指向旧 Vercel API 域名。
- `name`、`email`、`message` 均由浏览器原生 required 校验，网关与后端仍保留服务端校验。
- 提交期间防止按钮和 Enter 重入；单次请求最长 30 秒。
- 不对 POST 自动重试，避免网络结果未知时重复写入 `contact_inquiries`。
- 本地代理只有显式开启时才转发精确的 `/api/v1/contact` POST，且限制 16 KiB；不开放其他写操作。

最终生产验收会提交一条明确标记为自动验收的联系记录，并核对 HTTP 200、`success=true`、页面成功状态和单次 POST。

## 4. 其他修复

- 首页 RiskRegistry 旧地址 `0xdA4D…D3b3` 已替换为当前代理 `0x953f…cE896`。
- 只读地址查询前端超时由 12 秒调整为 60 秒，与网关最多两次 25 秒冷启动尝试的实际预算一致。
- 指标请求同样保留 60 秒总窗口；失败仍诚实回退快照。
- 视觉测试使用固定随机种子、reduced-motion 和确定的公开指标响应；生产验收仍访问真实接口，不用 mock 代替上线验证。
- 全页截图前真实滚动触发 LegacyFx，避免把尚未进入视口的 reveal 区块误判为空白。

## 5. 发布前验证记录

- Web ESLint、TypeScript 与生产构建通过；静态导出 99 个页面。
- 根工作区测试 9/9 任务通过；合约 450/450 通过；SDK 7/7 通过。
- 缓存回退与预约单次提交行为测试 2/2 通过。
- 真实浏览器覆盖四语首页、四语验证中心、375px 中文验证中心和联系页；无横向溢出。
- 上述通过的浏览器运行中，控制台错误、页面异常、HTTP 错误、请求失败均为 0。
- 实时公开指标在通过运行中为 5,348 条风险情报记录、145 个当前链上档案，两种口径未混写。
- 生产网关、真实预约、四语生产页面、Linux 视觉基线、SDK 注册表与证据下载必须在合并部署后再验收；最终结果以 GitHub Release 回写为准。

## 6. 版本与证据

- 主仓与 Web：3.3.4。
- SDK：0.3.5；API 无变化，递增用于遵守 GitHub Packages 不可变版本约束。
- 合约 ABI、地址、Merkle leaf、数据库 schema 均无变化，不需要合约升级或迁移。
- 最新证据下载使用稳定路径 `releases/latest/download/fidesorigin-verification-evidence.zip`；具体版本的 Release 说明同时公布 SHA-256 与文件清单。

## 7. 经验与边界

- 构建成功不等于实时数据可信，必须区分快照、核验中、实时和缓存状态。
- 前端超时要与服务器实际重试预算对齐；写操作则不能照搬只读重试策略。
- 本地静态代理不能绕过网关鉴权直连受保护地址详情；生产网关必须独立验收。
- 视觉基线由 Linux 工作流生成，不能用 Windows 截图冒充 CI 基线。
- 当前仍是 Sepolia 开发/测试部署，不代表主网上线、跨机器高可用或生产 SLA。
