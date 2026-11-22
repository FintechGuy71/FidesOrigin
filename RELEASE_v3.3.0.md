# FidesOrigin v3.3.0 — Audit Closure & Runtime Recovery

**发布日期**：2026-11-23  
**版本类型**：安全性、运行可靠性与一致性修复  
**关联 PR**：#134  
**目标环境**：Sepolia、本机 Windows 开发/测试环境

## 1. 发布摘要

本版本关闭了新一轮审计发现的高风险和中途暴露问题。目标不是增加功能，而是确保：dry-run 不会误写链、异常中断能够恢复、链上撤榜不会被旧数据库覆盖、每次同步都能证明最终状态正确。

本轮没有修改合约 ABI、Merkle leaf、风险阈值或数据库 schema，无需重新部署合约或执行数据库迁移。

## 2. 关键修复

### 2.1 dry-run 最终写链保护

`data-publisher/src/publisher.ts` 在最终单条写链入口检查 dry-run。队列消息无论锁开启或关闭，都返回 `dryrun-...` 结果，不进入真实交易调用。新增两种锁状态的回归测试，修复了此前只在批量入口检查导致的绕过。

### 2.2 调度恢复与受控重试

每日调度器现在：

- 区分已启动但未完成和已有 `finishedAt` 的任务。
- 异常中断后允许补跑，不把“曾经启动”误判为“已经成功”。
- 默认失败 15 分钟后重试，最多 3 次，不在 30 秒循环中热重试。
- 持久化 `attempt`、十进制和十六进制退出码、信号、超时与错误说明。
- 状态文件损坏时隔离备份，不静默覆盖。
- 子进程启动后再次保存真实 `syncPid`。
- 告警始终写入本地日志；配置 Slack、PagerDuty 或监督器 Webhook 时可外部发送。

### 2.3 撤榜与数据库一致性

后端官方制裁策略在链上回读启用时，同时处理数据库命中和未命中：

- 链上 `true`：返回制裁命中。
- 链上 `false`：覆盖旧数据库标签，返回 0。
- 回读未启用或不支持该链：保留数据库兼容路径。
- 所有 RPC 失败：显式报错，不伪装成未知地址。

### 2.4 最终链上验收

- Merkle 交易成功后重新读取根，不一致则任务失败。
- 下架交易检查回执状态，并重新读取 `getSanctionedAddresses()`。
- 所有档案、Merkle 和下架操作结束后，再对全部目标档案执行最终差异读取。
- `finalStateDiffCount`、`finalStateReadErrors`、下架剩余数量和验证错误均进入摘要与失败判定。

## 3. 数据源与队列加固

### 下载器

- `.part` 文件必须绑定源 URL 和预期摘要；未知或不同来源的残片直接丢弃。
- OFAC 必须取得并验证 SHA-256 Digest，不再把“计算过哈希”误写成“已验证”。
- 同时支持标准 `sha-256=<base64>` 和 OFAC 实际使用的 `sha-256<hex>`。
- HEAD 与 GET 摘要冲突时拒绝写入。
- 保留断点续传、独立超时、原子替换和新鲜缓存回退。

### Redis Stream

- 同一时刻最多一个 `pollStream()`，慢轮询不会重叠。
- 健康检查纳入最近轮询进度与错误状态，不再只检查连接是否存在。
- 停止订阅时等待进行中轮询结束，避免关闭连接时仍在消费。

### 日志与导入

- RPC 日志只记录脱敏后的 scheme/host/port，不输出凭证、路径、查询串或完整异常 URL。
- 后端 `app.core` 和 `app.services` 使用按需导出，消除测试和运行时的初始化顺序依赖。

## 4. 依赖与供应链

### 发布器

升级 Express、Axios、Azure Identity、node-cron 及相关传递依赖。Express 5 和 node-cron 4 的类型与调度行为已适配，生产审计为 0。

### 后端

升级 FastAPI、Starlette、PyJWT、python-multipart、python-dotenv、pytest、black 及配套依赖。安装后专项测试通过，`pip-audit` 返回无已知漏洞。

### 工作区

- 修复 Next.js、postcss、glob、minimatch、stream-json、fast-uri 等公告。
- AJV 仅覆盖公告涉及的 Vercel 配置链，不再影响 ESLint。
- Web 从 `next lint` 迁移到原生 `eslint .`，只排除 `.next`、`out`、测试报告等生成产物。
- 精确移除未使用的 zkSync Git 间接依赖，不全局关闭 pnpm 供应链检查。
- `elliptic` 仍有一条低危公告，因为公告要求的修复版本尚未发布。保留上游版本并明确记录，未使用不存在的版本号伪造清零。

## 5. 验证证据

### 自动化与远端检查

- 数据同步：96/96 测试通过。
- 发布器：52/52 测试通过。
- 后端专项：7/7 测试通过。
- Windows 监督器：2/2 测试通过。
- 合约：450/450 测试通过。
- 工作区 API、SDK、共享包及其他子项目测试通过。
- 所有工作区生产构建成功。
- PR #134 的 14/14 项检查通过，包括安全扫描、密钥扫描、lint/typecheck、pytest、合约、发布器、Subgraph、视觉测试、总测试和构建。

### 真实 dry-run

- OFAC：127 个地址，下载后 SHA-256 为 `1a58dd210db4…`（完整值见缓存元数据）。
- UKSL：58,894 条记录，5 个有效去重 EVM 地址。
- OpenSanctions：132 个地址。
- Scam Sniffer：2,530 个地址。
- 合并后 132 个唯一制裁地址。
- 0 个候选、0 个读错误、Merkle 根匹配、无下架地址、退出码 0。
- dry-run 未发送交易。

### 真实调度与恢复

- 调度器对遗漏任务完成补跑，退出码 0，实际无需发送交易。
- 最终回读再次确认 132 个目标全部一致。
- 重启调度器后继承成功状态，没有重复补跑。
- 强制终止 Redis 子进程后，新版监督器创建新进程；发布器健康和就绪探针自动恢复。
- 恢复后队列探针完成 ACK：pending=0、lag=0、DLQ=0。
- 陈旧消费者记录已清理，仅保留当前有效消费者。

## 6. 升级与运维

1. 拉取 `main` 或 `v3.3.0`。
2. 工作区使用 `pnpm install --ignore-scripts`；独立 `data-sync` 和 `data-publisher` 使用 `npm ci`。
3. 后端使用 `pip install -r requirements.txt`。
4. 保持 `REDIS_URL` 和 `CHAIN_WRITE_LOCK_REQUIRED=true`，并按需配置备用 RPC 与告警渠道。
5. 使用版本化每日调度器和 `deployment/windows/service-supervisor.cjs`，不要恢复旧的固定 5 秒重启脚本。
6. 先运行测试和 dry-run，再恢复正式调度；检查实际更新、写后与最终差异、数据源健康和 DB 状态。
7. SDK 发布必须使用 annotated tag；GitHub Release 存在不能代替发布工作流成功。

## 7. 剩余边界

- 本机没有 `BACKEND_DATABASE_URL`，数据库批量同步仍明确记录为 skipped；官方制裁可使用链上权威回读，但社区风险情报的数据库同步仍需单独配置。
- Windows 本机部署仍属于 Sepolia 开发/测试，不等同于主网 KMS、Linux 系统服务或跨机器高可用。
- 外部数据源和 RPC 可用性会变化，必须保留新鲜度、最终回读和外部告警。
- 不能凭一次成功推断永久稳定；应继续观察后续每日任务和异常恢复记录。

## 8. 回滚

回滚到 v3.2.0 前保留调度状态、原始缓存和同步日志。不要通过关闭 dry-run 边界、最终回读或供应链检查来制造成功。合约无需回滚。
