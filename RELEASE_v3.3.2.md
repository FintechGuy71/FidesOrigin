# FidesOrigin v3.3.2 — Full-Stack Verification & Website Truthfulness

**发布日期**：2026-11-24  
**版本类型**：系统可靠性、每日综合验收、官网事实口径与构建修复  
**目标环境**：Sepolia、本机 Windows、Render、Vercel、GitHub Actions

## 1. 发布摘要

本版本处理 v3.3.1 链上归档和真实浏览器验收继续暴露的代码、系统及官网问题。重点是让运行状态可验证、每日验收可失败、官网数字与真实数据源一致，而不是增加未经验证的功能或宣传。

本轮没有修改合约 ABI、Merkle leaf、角色或数据库 schema，无需重新部署合约或执行数据库迁移。

## 2. 系统与服务可靠性

### 2.1 监督器单实例

`deployment/windows/service-supervisor.cjs` 新增：

- 基于独占文件创建的 `service-state.json.lock` 单实例锁。
- 活跃 PID 重复启动拒绝，退出码非零，不覆盖现有实例状态。
- 进程退出时只删除属于当前 PID 的锁，避免误删继任者。
- 陈旧 PID 锁自动回收；损坏锁文件先隔离备份再恢复。
- 可配置 `SERVICE_HEALTH_PID_FIELD=pid`，健康响应 PID 必须等于当前监督子进程。

发布器 `/health` 同时返回真实 `pid`，防止旧孤儿进程占用端口后让新监督器误读健康。

### 2.2 Redis 消费者生命周期

- 正常停止且当前消费者无 pending 时，使用 `XGROUP DELCONSUMER` 注销元数据。
- 有 pending 时保留消费者，由下一实例通过 `XAUTOCLAIM` 接管。
- 启动时删除其他零 pending 的重复/陈旧消费者；活跃消费者即使被删除，也会在下一次轮询自动重建，不涉及消息丢失。
- 保持轮询串行化、健康进度检查及停止时等待进行中轮询。

## 3. 公共 API 与构建

### 3.1 冷启动恢复

`proxyToBackend` 新增显式 `timeoutMs`、`retries`、`retryDelayMs`：

- 仅 GET/HEAD 且调用方显式配置时才允许重试。
- 写操作即使配置 retries 也绝不重试。
- 默认不开启重试，不影响其他代理调用。
- 公共统计和风险查询使用 25 秒超时 + 一次重试，总等待约 51 秒，覆盖 Render 免费实例常见冷启动。

### 3.2 Windows 标准构建

新增 `scripts/turbo-run.cjs`：

- Windows + Electron 本机运行时使用 Turbo 支持的宽松环境兼容模式。
- Linux 和 CI 保持严格环境模式。
- 根 `build/dev/lint/test/typecheck/clean` 与 postinstall 统一走该启动器。
- API、guard-sdk、mempool-watcher 的 `noEmit` 构建显式声明空产物，不再产生误导性输出警告。

## 4. 每日综合验证

新增 `data-sync/scripts/verify-daily-runtime.js`：

- **链上**：对全部目标档案重新 diff，核对 Merkle 根、当前档案数和制裁集合。
- **公开 API**：验证制裁 100 分、Scam 75 分、零地址 0 分及真实聚合统计。
- **本机**：健康/就绪、健康 PID 与状态文件一致，Redis pending/lag/DLQ 为 0。
- GitHub runner 不伪造本机服务；仅明确记录 local skipped，链上和公开检查仍必须执行。
- 验证报告写入同一个每日同步 JSON；失败触发告警并使主任务非零退出。

## 5. 官网事实口径与质量

### 5.1 数据口径

- `5,348` 明确标记为风险情报数据库记录，不再称为链上地址总数。
- `145` 明确标记为 Sepolia 当前链上档案，由 Subgraph 全集分页取得。
- 四语同步移除未经验证的 `<50ms`、6 网络、零链下依赖、旧 RiskRegistryV2 和未启用 Chainalysis 数据源表述。
- 客户式延迟宣传改为可复现的工程验证说明；监管文案改为技术对齐，不暗示认证。
- 构建指标优先使用自定义域名，失败后直连同一 Render 后端；首次无数据时显示未知值，不再写入伪造的 20,000+。

### 5.2 浏览器与代码质量

- 风险查询默认使用同源 `/api/v1/public/risk-check`，环境变量仍可覆盖。
- 对脚本预期修改的 `<html>` 类使用明确的 `suppressHydrationWarning`，保留无 JavaScript 时的内容可见性。
- 补齐 Next 官方 ESLint 插件和 core-web-vitals 规则；内部导航改用 Link，本地图片使用 Image。
- 生成的静态博客卡片保留限定范围内的原生 SVG 图片例外，不影响全局规则。
- 新增 `scripts/verify-release-ui.mjs`，保存四语、移动端、性能、控制台和真实查询证据。

## 6. 验证证据

### 自动化与真实运行

- 数据同步：101/101。
- 发布器：54/54。
- Windows 监督器：6/6，另完成真实重复启动拒绝、陈旧锁恢复和 PID 一致性故障注入。
- API：9/9。
- Turbo 启动器：3/3。
- 根工作区测试：9/9 任务通过，合约 450/450。
- 生产构建：10/10 任务通过，无产物警告。
- 后端专项：8/8 在真实 PostgreSQL 上通过。
- 全后端：126/126 在真实 PostgreSQL 上通过；pytest 固件与测试的事件循环作用域已明确隔离。

### 真实每日 dry-run

- OFAC 127、UKSL 5、OpenSanctions 132、Scam Sniffer 2,530。
- 合并制裁地址 132；链上差异 0、读错误 0。
- Merkle 根 `0x8cf59a3dfda91bae01744fde498534538c107acdea7640b118f2991c77308986` 匹配。
- 综合验证 chain/public/local 全部通过，未发送交易。

### 真实浏览器

- 英文、中文、繁中、日文最终显示 5,348 / 145。
- 375px 移动端无横向溢出。
- 控制台错误、页面异常、HTTP 错误、请求失败均为 0。
- 同源 Scam 查询返回 HTTP 200、75 分、`SCAM_SNIFFER/scam` 标签。

## 7. 升级与发布

1. 使用 `pnpm install --ignore-scripts`，随后直接运行标准 `pnpm test` 和 `pnpm build`。
2. 本机启动脚本保持 `SERVICE_HEALTH_PID_FIELD=pid` 与 `VERIFY_LOCAL_RUNTIME=true`。
3. 不需要生产数据库凭据落到本机；公开 API 验证与 GitHub Actions 受控同步共同覆盖数据库链路。
4. 合约无需升级或迁移。
5. 本发布对应 SDK 0.3.3；SDK API 未变，包版本递增用于避免 GitHub Packages 不可变版本冲突。
6. 创建 v3.3.2 annotated tag 后，必须确认 SDK 上传和注册表精确版本回读都成功。

## 8. 剩余边界

- `elliptic` 仍有一条低危公告；npm 最新版本为 6.6.1，公告要求的 6.6.2 尚未发布，不伪造清零。
- 本机 Windows 部署仍属于 Sepolia 开发/测试环境，不代表主网 KMS、跨机器高可用或生产 SLA。
- 便携 PostgreSQL 仅用于本机真实测试，不提交二进制，不替代生产 Neon/PostgreSQL。
- 外部数据源、RPC、Render 冷启动和公共节点限流会变化；必须保留重试、回读、告警与每日验收。

## 9. 回滚

回滚到 v3.3.1 前保留每日同步、综合验证和浏览器验收证据。不要通过关闭单实例锁、最终回读、官网检查或包版本验证制造成功。合约无需回滚。
