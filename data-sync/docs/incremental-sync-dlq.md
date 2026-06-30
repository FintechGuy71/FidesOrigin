# 增量同步 + 死信队列 (DLQ) — 数据流图

> 生成于 2026-06-30  
> 涵盖文件: `data-sync/prisma/schema.prisma`, `data-sync/src/services/scheduler.js`, `data-sync/src/services/dlq.js`, `data-sync/sanctions-sync.js`, `data-sync/src/scheduler.js`

---

## 一、整体数据流

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FidesOrigin 数据同步管道                            │
└─────────────────────────────────────────────────────────────────────────────┘

                              Cron 触发 / 手动触发
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  src/scheduler.js (主调度器)                                                  │
│  ──────────────────────────                                                   │
│  1. runSyncCycle() 启动                                                      │
│     ├─► dlq.processRetries()  ──► 处理历史失败记录重试                        │
│     ├─► collectFromAllSources() ──► 抓取各数据源                             │
│     ├─► cleanAndDeduplicate()   ──► 数据清洗去重                             │
│     ├─► syncToDatabase()        ──► 批量 upsert (失败记录→DLQ)               │
│     ├─► buildMerkleTree()       ──► 构建 Merkle Root                         │
│     ├─► syncMerkleRootToChain() ──► 链上同步                                 │
│     └─► dlq.alertPermanentFailures() ──► 永久失败告警                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
┌────────────────────┐    ┌────────────────────┐    ┌────────────────────┐
│  OFAC 数据源        │    │  UN/EU/HMT 数据源   │    │  DLQ 死信队列       │
│  ─────────────     │    │  ─────────────────  │    │  ────────────────  │
│  sanctions-sync.js │    │  sanctions-sync.js │    │  src/services/     │
│                    │    │                    │    │  dlq.js            │
│  fetchIncremental()│    │  fetch() [全量]     │    │                    │
│  ├─ If-Modified-   │    │                    │    │  recordFailure()   │
│  │   Since header  │    │                    │    │  processRetries()  │
│  ├─ 304 → skip     │    │                    │    │  reprocessFailures │
│  └─ 200 → parse    │    │                    │    │  alertPermanent..  │
└────────────────────┘    └────────────────────┘    └────────────────────┘
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Prisma ORM (SQLite / PostgreSQL)                                            │
│  ─────────────────────────────────                                           │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ RiskAddress │  │SyncHistory  │  │DataSourceConfig│  │ SyncFailure │        │
│  │ (风险地址)   │  │ (同步日志)   │  │ (数据源配置)    │  │ (死信队列)   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                              │
│  DataSourceConfig 新增字段:                                                  │
│    • lastSyncCursor  (String?)  ── 增量同步游标                              │
│    • lastSyncMode    (String)   ── incremental | full                        │
│                                                                              │
│  SyncFailure 新增模型:                                                       │
│    • source, recordId, error, retryCount, status                             │
│    • status: pending | retrying | permanent_failure | resolved               │
│    • nextRetryAt: 指数退避调度                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、增量同步流程

```
                    SYNC_MODE 环境变量
                    ┌─────────┬─────────┬─────────┐
                    │ "full"  │"incremental"│ "auto"  │
                    └────┬────┴────┬────┴────┬────┘
                         │         │         │
    ┌────────────────────┘         │         └────────────────────┐
    │                              │                              │
    ▼                              ▼                              ▼
┌──────────┐              ┌──────────────┐              ┌─────────────────┐
│ 强制全量  │              │ 强制增量      │              │ 智能判断         │
│ 同步     │              │ 同步         │              │                 │
└──────────┘              └──────────────┘              │ • 无游标→full   │
                                                        │ • 数据量>5000   │
                                                        │   → full        │
                                                        │ • 否则→incremental│
                                                        └─────────────────┘


增量同步执行流程 (以 OFAC 为例):
═══════════════════════════════════════════════════════════════════════════════

    ┌─────────────────┐
    │ 读取 lastSyncCursor│◄────── DataSourceConfig.lastSyncCursor
    │  (ISO 8601 时间戳) │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ 构造 HTTP Header │
    │ If-Modified-Since│
    │ (转为 UTC 格式)  │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │   GET sdn.csv   │
    └────────┬────────┘
             │
    ┌────────┴────────┐
    ▼                 ▼
┌────────┐      ┌────────┐
│ 304    │      │ 200    │
│Not     │      │OK      │
│Modified│      │        │
└───┬────┘      └───┬────┘
    │               │
    ▼               ▼
┌────────┐      ┌────────┐
│ 跳过   │      │ 解析CSV │
│ 处理   │      │ 提取记录│
│        │      │        │
│ cursor │      │ 计算新  │
│ 不变   │      │ cursor  │
│        │      │ (Last-  │
│        │      │ Modified│
│        │      │ 或 now) │
└────────┘      └────┬───┘
                     │
                     ▼
              ┌────────────┐
              │ 逐条处理    │
              │ 记录       │
              │ (失败→DLQ) │
              └─────┬──────┘
                    │
                    ▼
              ┌────────────┐
              │ 更新游标   │
              │ DataSource │
              │ Config     │
              └────────────┘
```

---

## 三、死信队列 (DLQ) 状态机

```
                         ┌──────────────────────────────────────────┐
                         │           SyncFailure 状态流转            │
                         └──────────────────────────────────────────┘

    recordFailure()
         │
         ▼
    ┌─────────┐     processRetries()      ┌──────────┐
    │ pending │ ────────────────────────► │ retrying │
    │ (默认)  │      (标记为处理中)        │          │
    └────┬────┘                           └────┬─────┘
         │                                     │
         │  retryHandler 返回 true             │ retryHandler 返回 false
         │                                     │
         ▼                                     ▼
    ┌─────────┐                          ┌─────────┐
    │resolved │                          │ pending │
    │ (成功)  │                          │ (重试+1)│
    └─────────┘                          └────┬────┘
                                              │
                                              │ retryCount >= 3
                                              │ (MAX_RETRIES)
                                              ▼
                                         ┌──────────────┐
                                         │permanent_    │◄──── reprocessFailures()
                                         │  failure     │      (手动重试入口)
                                         │  (需告警)     │
                                         └──────────────┘
                                              │
                                              │ alertPermanentFailures()
                                              ▼
                                         ┌──────────────┐
                                         │  sendAlert() │
                                         │  通知运维    │
                                         └──────────────┘


指数退避重试间隔:
═════════════════
  retry 0 → nextRetryAt = now + 1 min
  retry 1 → nextRetryAt = now + 5 min
  retry 2 → nextRetryAt = now + 15 min
  retry 3 → permanent_failure (不再自动重试)
```

---

## 四、文件变更清单

### 新建文件

| 文件 | 说明 | 行数 |
|------|------|------|
| `src/services/dlq.js` | 死信队列服务: 失败记录、指数退避重试、永久失败告警、手动重试接口 | ~340 |
| `src/services/scheduler.js` | 增量同步调度器: 游标管理、SYNC_MODE 策略、自动 fallback、DLQ 集成 | ~310 |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `prisma/schema.prisma` | ① `DataSourceConfig` 新增 `lastSyncCursor` (String?)、`lastSyncMode` (String) 字段 ② 新增 `SyncFailure` 模型 |
| `sanctions-sync.js` | ① `httpGet()` 返回 `lastModified` header、支持 304 响应 ② `OFACAdapter` 新增 `fetchIncremental(cursor)` 方法，支持 `If-Modified-Since` ③ 修复 EUAdapter `for (block of...)` 隐式全局变量 bug |
| `src/scheduler.js` | ① 导入 `DLQService` ② `runSyncCycle()` 开始调用 `dlq.processRetries()` ③ `runSyncCycle()` 结束调用 `dlq.alertPermanentFailures()` ④ `syncToDatabase()` 单条 upsert 失败 → `dlq.recordFailure()` |
| `package.json` | 添加 `@prisma/client` 依赖、`prisma` devDependency、db:migrate/db:generate scripts |

---

## 五、环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `SYNC_MODE` | `auto` | 同步模式: `incremental` / `full` / `auto` |
| `DATABASE_URL` | - | Prisma 数据库连接字符串 |

---

## 六、Prisma Migration 命令

```bash
# 1. 安装依赖
cd data-sync && npm install

# 2. 生成 Prisma Client
npm run db:generate

# 3. 创建并应用 migration (开发环境)
npm run db:migrate

# 4. 生产环境部署 migration
npm run db:migrate:prod
```

---

## 七、关键设计决策

1. **分层架构**: `src/scheduler.js` (Cron 调度 + 整体流程) ↔ `src/services/scheduler.js` (增量同步逻辑) ↔ `src/services/dlq.js` (失败处理)
2. **游标设计**: 使用 HTTP `Last-Modified` 时间戳作为游标，兼容 OFAC 等数据源的 304 机制
3. **自动 fallback**: `auto` 模式下，增量数据量 > 5000 时自动降级为全量同步，避免增量接口异常导致数据缺失
4. **DLQ 幂等性**: `recordFailure()` 使用 `source + recordId` 去重，同一记录多次失败不会创建重复条目
5. **错误隔离**: 单条记录处理失败不影响整体同步流程，失败记录进入 DLQ 等待重试
