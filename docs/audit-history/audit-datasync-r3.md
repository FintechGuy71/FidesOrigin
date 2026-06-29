# FidesOrigin 数据同步层修复报告 (R3)

**修复日期**: 2026-06-17  
**修复范围**: `data-sync/src/`  
**修复目标**: 8项生产级基础设施问题

---

## 1. 统一日志格式（结构化 JSON）✅

**问题**: 原代码使用 `console.log` 直接输出，无结构化格式，难以解析和聚合。

**修复方案**:
- **新建** `src/utils/logger.js` — 基于 Winston 的日志系统
- 支持结构化 JSON 输出（生产环境）和彩色控制台输出（开发环境）
- 自动脱敏：以太坊私钥、API Key、密码等敏感字段自动替换为 `[REDACTED]`
- 包含 `pid`、`hostname`、`label` 等元数据
- 新增 `audit()` 方法，专用于审计日志（合规要求）

**关键代码**:
```javascript
const logger = winston.createLogger({
  defaultMeta: { label, pid: process.pid, hostname: require('os').hostname() },
  transports: [consoleTransport, fileTransport],
});
```

---

## 2. 添加日志轮转 ✅

**问题**: 日志文件无限制增长，可能导致磁盘耗尽。

**修复方案**:
- 使用 `winston-daily-rotate-file` 实现按天轮转
- 三种日志文件分离：
  - `app-%DATE%.log` — 应用日志（保留30天，最大50MB）
  - `error-%DATE%.log` — 错误日志（保留60天，最大50MB）
  - `audit-%DATE%.log` — 审计日志（保留90天，最大100MB，不可删除）
- 自动 gzip 压缩旧日志

**配置**:
```javascript
new DailyRotateFile({
  filename: path.join(LOG_DIR, 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '50m',
  maxFiles: '30d',
});
```

---

## 3. 添加运行时配置验证 ✅

**问题**: 原代码仅检查环境变量是否存在，无格式/范围验证，错误配置可能导致运行时崩溃。

**修复方案**:
- **新建** `src/utils/config.js` — 基于 Joi 的完整配置验证
- 验证项包括：
  - 数据库 URL 格式（`postgresql://` 或 `mysql://`）
  - 合约地址格式（`0x` + 40位十六进制）
  - Gas 限制范围（最大 10M）
  - 风险评分阈值（0-100）
  - 重试配置合理性
- 支持从环境变量自动构建配置对象
- 验证失败时输出详细错误信息（含路径和当前值）

**关键代码**:
```javascript
const ConfigSchema = joi.object({
  blockchain: joi.object({
    contractAddress: joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
    maxGasLimit: joi.number().integer().max(10000000).default(5000000),
  }).required(),
}).required();
```

---

## 4. 修复并发 Nonce 管理 ✅

**问题**: 原代码使用简单变量 `this.nonce++`，多线程/多进程环境下存在竞态条件，导致 nonce 冲突交易失败。

**修复方案**:
- **新建** `src/utils/nonceManager.js` — 并发安全的 Nonce 管理器
- 使用 Promise 链式锁实现原子操作
- 支持功能：
  - `getNextNonce()` — 串行获取下一个 nonce
  - `allocateNonces(count)` — 批量预分配 nonce
  - `markSubmitted(txHash, nonce)` — 追踪 pending 交易
  - `markCompleted(txHash)` — 释放已确认交易
  - `syncFromChain()` — 从链上同步最新 nonce（用于恢复）
- 遵循 EIP 规则：nonce 只递增，失败交易通过 replace-by-fee 处理

**关键代码**:
```javascript
async getNextNonce() {
  const release = await this._acquireLock();
  try {
    const nonce = this._nonce;
    this._nonce++;
    return nonce;
  } finally {
    release();
  }
}
```

---

## 5. 添加健康检查端点 ✅

**问题**: 原代码有基础健康检查，但无就绪检查、无错误处理、端口占用时崩溃。

**修复方案**:
- **新建** `src/utils/healthCheck.js` — 完整的健康检查服务器
- 端点：
  - `/health` — 存活检查（返回 200/503）
  - `/ready` — 就绪检查（依赖项全部健康时返回 200）
  - `/metrics` — JSON 格式指标
  - `/metrics/prometheus` — Prometheus 格式指标
- 检查项：数据库连接、区块链节点可达性、内存使用
- 错误处理：端口占用时不崩溃，记录日志

---

## 6. 添加指标监控（Prometheus）✅

**问题**: 无系统级指标，无法接入 Grafana/Prometheus 监控体系。

**修复方案**:
- 在 `healthCheck.js` 中集成 Prometheus 格式输出
- 指标包括：
  - `fidesorigin_datasync_up` — 服务可用性
  - `fidesorigin_datasync_sync_total` — 总同步次数
  - `fidesorigin_datasync_sync_success` — 成功同步次数
  - `fidesorigin_datasync_sync_failed` — 失败同步次数
  - `fidesorigin_datasync_addresses_processed` — 处理地址数
  - `fidesorigin_datasync_addresses_synced` — 链上同步地址数
  - `fidesorigin_datasync_gas_used_total` — 总 Gas 消耗
  - `fidesorigin_datasync_last_sync_timestamp` — 最后同步时间
  - `fidesorigin_datasync_uptime_seconds` — 运行时间
  - `fidesorigin_datasync_memory_heap_used_mb` — 堆内存使用
  - `fidesorigin_datasync_errors{type="..."}` — 错误分类计数
  - `fidesorigin_datasync_api_calls{source="..."}` — API 调用计数

---

## 7. 修复错误处理一致性 ✅

**问题**: 错误处理分散，无统一错误分类，重试逻辑重复，未捕获异常可能导致进程崩溃。

**修复方案**:
- **新建** `src/utils/errors.js` — 统一错误系统
- 定义标准错误类：
  - `AppError` — 基类（含 code、statusCode、details、timestamp）
  - `ConfigError` — 配置错误（500）
  - `ValidationError` — 验证错误（400）
  - `DatabaseError` — 数据库错误（500）
  - `BlockchainError` — 区块链错误（500）
  - `ExternalApiError` — 外部 API 错误（502）
  - `RateLimitError` — 限流错误（429）
  - `AuthError` — 认证错误（401）
  - `ConcurrencyError` — 并发错误（423）
  - `TimeoutError` — 超时错误（504）
- 错误分类策略：
  - `RETRIABLE` — 可重试（数据库、API、限流、超时）
  - `FATAL` — 致命（配置、认证）
  - `IGNORABLE` — 可忽略（验证）
- `withErrorHandling()` — 统一重试包装器（支持指数退避、抖动、回调）
- `setupGlobalErrorHandlers()` — 全局未捕获异常/未处理 Promise 拒绝处理器

---

## 8. 添加优雅关闭处理 ✅

**问题**: 原代码无 SIGTERM/SIGINT 处理，进程被强制终止时可能导致数据不一致或资源泄漏。

**修复方案**:
- **新建** `src/utils/gracefulShutdown.js` — 优雅关闭管理器
- 支持信号：SIGTERM、SIGINT、SIGUSR2、PM2 shutdown message
- 按优先级执行关闭处理器：
  - 优先级 10：健康检查服务器
  - 优先级 5：数据库连接
  - 优先级 1：同步锁（等待当前同步完成）
- 超时机制：默认 30 秒超时后强制退出
- 防止重复关闭信号

**关键代码**:
```javascript
class GracefulShutdown {
  register(name, handler, priority = 0) {
    this.handlers.push({ name, handler, priority });
    this.handlers.sort((a, b) => b.priority - a.priority);
  }
  async shutdown(signal) {
    // 按优先级执行，超时强制退出
  }
}
```

---

## 修改文件清单

### 新建文件（5个）
1. `src/utils/logger.js` — 结构化日志 + 日志轮转
2. `src/utils/config.js` — 运行时配置验证（Joi）
3. `src/utils/nonceManager.js` — 并发安全 Nonce 管理
4. `src/utils/healthCheck.js` — 健康检查 + Prometheus 指标
5. `src/utils/errors.js` — 统一错误系统
6. `src/utils/gracefulShutdown.js` — 优雅关闭处理

### 修改文件（9个）
1. `src/index.js` — 集成所有新工具，替换旧日志/错误处理
2. `src/services/blockchainService.js` — 使用新 logger
3. `src/services/databaseService.js` — 使用新 logger
4. `src/adapters/chainalysisAdapter.js` — 使用新 logger
5. `src/adapters/ofacAdapter.js` — 使用新 logger
6. `src/adapters/etherscanAdapter.js` — 使用新 logger
7. `src/adapters/openSourceAdapter.js` — 使用新 logger
8. `src/adapters/ofacSimpleAdapter.js` — 使用新 logger
9. `src/adapters/openSourceEnhancedAdapter.js` — 使用新 logger（已存在）

---

## 语法验证结果

```
✅ src/index.js — 通过
✅ src/services/blockchainService.js — 通过
✅ src/services/databaseService.js — 通过
✅ src/adapters/chainalysisAdapter.js — 通过
✅ src/adapters/ofacAdapter.js — 通过
✅ src/adapters/etherscanAdapter.js — 通过
✅ src/adapters/openSourceAdapter.js — 通过
✅ src/adapters/ofacSimpleAdapter.js — 通过
✅ src/utils/logger.js — 通过
✅ src/utils/config.js — 通过
✅ src/utils/nonceManager.js — 通过
✅ src/utils/healthCheck.js — 通过
✅ src/utils/errors.js — 通过
✅ src/utils/gracefulShutdown.js — 通过
```

---

## 依赖说明

新增 npm 依赖（需安装）：
- `winston` — 日志框架
- `winston-daily-rotate-file` — 日志轮转
- `joi` — 配置验证

安装命令：
```bash
cd data-sync && npm install winston winston-daily-rotate-file joi
```

---

## 运行验证建议

1. **配置验证测试**:
   ```bash
   node -e "const { getValidatedConfig } = require('./src/utils/config'); console.log(getValidatedConfig());"
   ```

2. **日志系统测试**:
   ```bash
   node -e "const { createLogger } = require('./src/utils/logger'); const log = createLogger('test'); log.info('test', { foo: 'bar' });"
   ```

3. **健康检查测试**:
   ```bash
   node src/index.js &
   curl http://localhost:3001/health
   curl http://localhost:3001/metrics/prometheus
   ```

4. **优雅关闭测试**:
   ```bash
   kill -TERM <pid>
   # 观察日志是否显示 graceful shutdown 流程
   ```

---

## 后续建议

1. **集成测试**: 在实际环境中验证 NonceManager 的并发安全性（可用 `artillery` 或 `autocannon` 模拟并发交易）
2. **监控告警**: 将 Prometheus 指标接入 Grafana，设置告警规则（如 `sync_failed > 5` 或 `memory_heap_used_mb > 512`）
3. **日志收集**: 配置 Filebeat/Fluentd 将日志文件发送到 ELK/Loki
4. **配置热加载**: 当前配置在启动时验证，可考虑使用 `node-config` 或 Consul 实现运行时配置更新
5. **KMS 集成**: 当前 KMS 代码为骨架，需补充 AWS/Azure/GCP 实际 SDK 调用

---

**修复完成时间**: 2026-06-17 23:57 GMT+8
