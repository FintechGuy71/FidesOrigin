# FidesOrigin v3.2.0 — Runtime Verification & Resilient Scheduling

**发布日期**：2026-11-08  
**版本类型**：功能与稳定性版本，无合约 ABI 或数据库 schema 破坏性变更  
**主要 PR**：#132  
**目标环境**：Sepolia 与本机 Windows 开发/测试运行环境

## 1. 发布目标

本版本把数据管道从“进程存在、交易已确认”提升为“业务结果可验证、失败可恢复、调度可追溯”。重点解决以下实际问题：

- 交易 `status=1`，但合约事件显示全部地址被跳过，旧日志却写成“6 written”。
- 机器休眠后每日任务延迟补跑，进程重启时缺少可靠的执行记录和防重入。
- Redis 中途退出导致发布器监控关闭但进程半存活。
- 大型官方名单下载超过固定超时，缺少断点续传、哈希校验和新鲜原始缓存。
- 后端数据库未配置时，官方制裁查询无法利用链上事实源。

## 2. 同步结果与写后验收

`data-sync/src/chainProfileSync.js` 现在解析 `BatchUpdateSkipped` 和 `BatchUpdateCompleted`，分别记录：

- `candidateCount`：写前差异候选地址数。
- `actualUpdated`：合约完成事件确认的实际更新数。
- `contractSkipped`：合约跳过数，以及地址和原因。
- `postWriteDiffCount`：全部批次完成后重新读链得到的剩余差异。
- `postWriteReadErrors`：写后回读失败数。
- `failedBatches`：重试后仍失败的交易批次数。

成功语义：

- 交易回执失败或批次重试耗尽，任务失败。
- 写后仍有差异或读错误，任务失败。
- 合约全部跳过但写后目标已一致，可以成功，但 `actualUpdated` 仍明确为 0。
- dry-run 只计算候选，不伪造实际更新数。

`daily-sync.js` 的 JSON 和控制台摘要同步采用新口径，避免再把候选数写成实际写入数。

## 3. 调度、补跑与写链协调

### 3.1 版本化每日调度器

新增 `data-sync/scripts/daily-sync-scheduler.js` 和 `src/dailySchedule.js`：

- 在状态文件中持久化 `scheduledFor`、`startedAt`、`finishedAt`、`exitCode`、`signal`、`nextRun`。
- 进程启动时检查最近一次 03:37 是否已经尝试；错过则补跑一次。
- 同一执行日期不在 30 秒循环里热重试，避免故障时反复写链。
- 单实例锁文件防止多个调度器同时运行；陈旧锁可自动回收。
- 默认 30 分钟执行超时，超时终止并告警。
- 记录超过 25 小时未成功和当次失败告警。
- 兼容旧状态，以 `finishedAt` 判断当天是否已补跑。

### 3.2 统一写链所有权

新增 `data-sync/src/services/chainWriteLock.js`，与发布器共同使用：

`fides:lock:chain:write`

锁采用 Redis `SET NX PX` 所有权令牌、看门狗续期和 Lua 安全释放。档案、Merkle 根和下架操作在同一临界区执行。设置 `CHAIN_WRITE_LOCK_REQUIRED=true` 后，未配置 Redis 会明确失败，不会无锁写链。

发布器可通过以下变量关闭重复的定时采集，仅保留队列驱动发布：

- `PUBLISHER_SCHEDULER_ENABLED=false`
- `BATCH_SYNC_ENABLED=false`
- `FATF_ENABLED=false`

## 4. 发布器稳定性

- `.env` 加载同时兼容 ts-node 的 `src` 和编译后的 `dist/src`，不再依赖启动时预加载 workaround。
- `uncaughtException` 和 `unhandledRejection` 会执行清理并以非零码退出，不再留下关闭健康接口但继续 cron 的半存活进程。
- Redis 消息队列与锁客户端均注册错误监听器。
- `/health` 和 `/ready` 除 RPC、角色和锁连接外，还检查消息队列订阅是否连接。
- 发布器关闭时释放消息队列、锁和监控后台定时器。
- `RPC_URLS` 支持逗号分隔的备用节点；单节点继续使用 `RPC_URL`。

## 5. 大文件与数据源容错

新增 `data-sync/src/services/resilientDownload.js`：

- `.part` 文件断点续传，支持 HTTP Range。
- 连接/读取不活动超时和总时长超时分开。
- 最多 5 次重定向，限制重试次数，避免无限重试。
- 从 HEAD 或 GET 的 `Digest` 读取 SHA-256，下载完成后重新计算文件哈希。
- 只有校验成功才原子替换正式缓存，并写入 `.meta.json` 元数据。
- OFAC 下载失败时仅允许 24 小时内原始 XML 缓存恢复健康位；无新鲜缓存时继续使用下架保护。

OFAC、UKSL 和 OpenSanctions 均已接入。测试覆盖断点续传和哈希不匹配拒绝替换。

## 6. 后端公开查询一致性

新增 `backend/app/services/chain_registry_service.py`：

- 数据库未命中或读取异常时，通过 `isSanctioned(address)` 回读 Sepolia RiskRegistry。
- 支持 `SEPOLIA_RPC_URLS` 备用 RPC 和 60 秒短缓存。
- 所有 RPC 失败时显式报错，不把查询失败伪装成“未知地址”。
- 社区风险情报与官方制裁仍保持来源隔离；链上回读只用于官方制裁事实，不伪造 Scam Sniffer 数据。

配置项：

- `CHAIN_READ_FALLBACK_ENABLED`
- `RISK_REGISTRY_ADDRESS`
- `SEPOLIA_RPC_URL`
- `SEPOLIA_RPC_URLS`
- `CHAIN_READ_TIMEOUT`

## 7. 验证证据

### 自动化与远端检查

- `data-sync`：90/90 测试通过。
- `data-publisher`：48/48 测试通过。
- 后端链上回读：3/3 测试通过。
- `data-sync` 生产依赖审计：0 漏洞。
- PR #132：13/13 项远端检查通过，包括后端 pytest、合约、发布器、Subgraph、安全扫描、前端和构建。

### 真实 dry-run

- OFAC：127 个地址；官方 SHA-256 为 `60698e6e3edd49ac9398576aae7e98e06f2c0bf44cc41e485bca4732ac56805f`。
- UKSL：58,836 条记录，5 个有效去重 EVM 地址。
- OpenSanctions：132 个地址。
- Scam Sniffer：2,530 个地址。
- 合并后 132 个唯一制裁地址。
- 链上 132/132 与目标一致，0 个候选、0 个读错误。
- Merkle 根与链上完全一致。
- 无下架地址，退出码 0。
- 另一次公网超时后使用 6 分钟前的新鲜官方缓存完成同样验收，证明缓存回退路径有效。

### 真实 Sepolia 与故障恢复

- 后端回读已知制裁地址返回 `true`，零地址返回 `false`。
- 强制终止 Redis 子进程后，监督器自动创建新进程。
- 发布器 `/health` 与 `/ready` 自动恢复 HTTP 200。
- 恢复后队列探针完成 ACK：`pending=0`、`lag=0`、`DLQ=0`。
- 版本化调度器继承当天成功记录，没有重复执行写链。

## 8. 升级步骤

1. 拉取 `main` 或 `v3.2.0`，在 `data-sync` 执行 `npm ci`。
2. 配置 `REDIS_URL`；需要强制写锁时设置 `CHAIN_WRITE_LOCK_REQUIRED=true`。
3. 可选配置 `RPC_URLS`、后端 `SEPOLIA_RPC_URLS` 和告警渠道。
4. 用版本化调度器替代旧的内存调度脚本，并设置 `DAILY_SYNC_STATE_FILE`、日志文件路径。
5. 先运行 `npm test`、`npm audit --omit=dev` 和 `node scripts/daily-sync.js --dry-run`。
6. 检查候选、实际更新、写后差异、数据源健康和 DB 状态，再恢复正式调度。
7. 后端部署后，用已知制裁地址验证公开查询命中链上回读。

无需重新部署合约或执行数据库迁移。

## 9. 运维经验与剩余边界

- 交易回执成功只代表交易执行完成，必须结合合约事件和写后状态判断业务成功。
- 机器休眠会延迟定时器；持久化执行日期比单纯保存 `nextRun` 更重要。
- 进程自动重启与健康恢复是两层能力：Redis 恢复后，发布器也必须重新通过业务健康检查。
- 外部数据源不可用时，新鲜缓存可以保住筛查覆盖，但陈旧快照不能成为永久健康来源。
- 本机数据库连接串仍未配置，因此后端数据库批量同步仍显示 skipped；本次新增的是官方制裁的链上回读能力，不等于所有数据库表或社区风险情报已经同步。
- Windows 当前用户自启和监督器适合 Sepolia 开发/测试，不等同于 Linux 系统服务、KMS、托管数据库或跨机器高可用。主网仍需独立生产评审。

## 10. 回滚

回滚到 `v3.1.1` 前，保留调度状态文件、最新原始缓存和同步日志。若新版本写后验收失败，不应关闭验收逻辑来制造成功；应先恢复数据源、RPC 或 Redis，再评估是否回滚代码。合约无需回滚。
