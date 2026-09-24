# FidesOrigin 第五轮校验与深度审计报告（R4 校验 + R5 审计）

- **日期**：2026-09-24
- **执行**：GLM-5.3 全自主完成（校验 → 审计 → 修复 → 验证，无人工介入）
- **范围**：`FidesOrigin-fix/`（main 分支）。上一轮（R4，2026-09-22）9 处修复逐项校验 + 全新逐行深度审计：backend 37 个 Python 文件（10,628 行）全部精读、apps/api 全部 15 文件精读、apps/web 关键路径复核、Solidity 合约沿用 R1-R3 加固结论复核。
- **方法**：逐文件逐行人工精读 + 模式扫描 + **线上 Blockscout API 实测**（经代理验证真实响应 schema）+ 可重复运行时验证脚本。

---

## 一、上一轮 9 处修复校验结论

| # | 修复项 | 结论 | 说明 |
|---|--------|------|------|
| F1 | `verify_api_key` 补 `as e` 绑定（NameError 掩盖系统异常） | ✅ **通过** | git diff 确认实现；运行时注入 DB 异常，原 `RuntimeError` 真实重抛、无 NameError |
| F2 | `rotate_refresh_token` 静默 pass → error 日志 | ✅ **通过** | 静态确认日志事件存在；Redis 不可用场景降级不崩溃 |
| F3 | cache_service 移除 pickle（RCE） | ✅ **通过（含补强）** | pickle 无 import 无调用；JSON 往返正常；恶意 pickle 载荷返回 None 不执行。审计中追加两处补强：`set_object` 去掉 `default=str` 静默字符串化（与修复意图"不再静默降级"相悖）；`get_object` 的 `redis.get` 移入 try（遗留二进制数据在客户端解码层抛 UnicodeDecodeError 原会穿透） |
| F4 | `_check_address_age` 时区归一 | ✅ **通过（减法层面）** | aware/naive 两种输入均正确触发年龄评分。但本轮审计发现上游 Blockscout schema 漂移使 `first_transaction` 恒为 None（见二、B7）——即修复正确但输入源断了，B7 修复后规则才真正可达 |
| F5 | `analyze_transaction` `to:null` 防护 | ✅ **通过（发现同类漏修）** | to:null 不再抛 AttributeError；但审计发现 **`from`:null 与 `value`:null 同类问题在 3 处漏修**（risk_engine_service、transactions.py、legacy risk_engine.py），已补齐（见二、B9） |
| F6 | `handle_message_queue_update` 枚举+参数补齐 | ✅ **通过** | str/枚举两种输入均归一化，risk_factors 传参正确 |
| F7 | validators 重复定义删除 | ✅ **通过** | 全文件仅一处 `SUPPORTED_CHAINS` |
| F8 | auth 登录计数读取静默 pass → debug 日志 | ✅ **通过** | 日志事件存在，无裸 `except: pass` 残留 |
| F9 | 审计文档密钥脱敏 | ❌ **未达预期 → 已补齐** | 上轮仅脱敏 1 处。全仓残留扫描发现 **8 处泄露**：同一文档第 49 行表格还有第二处完整私钥；`fix-summary-v2.3.md` 第 212 行 bash 示例再次泄露同一私钥；`SECURITY_AUDIT.md`、`SECURITY_FIX_REPORT.md` 各泄露 Chainalysis+Etherscan 双键；`final-security-scan.md` 泄露新发现的 `PUBLISHER_PRIVATE_KEY` 与 Etherscan 键；`data-sync/scripts/debug/test_etherscan_detailed.js` 在**代码**中硬编码两把 Etherscan 键；`verify_etherscan_direct.py` / `verify_r3_etherscan.py` 把泄露键设为 env 默认值。以上全部修复，5 个密钥值全仓 grep 清零 |

**校验小计**：8 项完全达标，1 项（F9）未达预期——修复方向正确但覆盖严重不足；其暴露的 8 处残留已全部补齐并验证。

---

## 二、深度审计发现清单（21 项，全新发现）

### HIGH（3 项）

**B1｜RateLimiter 本地降级限流完全失效（死代码降级）**
- 文件：`backend/app/core/security.py` `_local_check`
- 问题：滑动窗口的"空键清理"分支（`del` + `return True`）放在时间戳 append 之前——首请求走到空列表分支即返回，**任何请求的时间戳都从未被记录**。Redis 故障降级到本地内存时限流形同虚设（无限放行），而代码注释（[S-8 Fix]）声称降级可用。
- 修复：调整为"清理过期 → 判额 → 记录 → 放行"的正确顺序；空键清理交给既有的周期性全局清理。

**B2｜CacheService 软默认值使限流/锁定在 Redis 启动期未连接时静默失效**
- 文件：`backend/app/core/security.py` `is_allowed` / `get_remaining`、`backend/app/controllers/auth.py` 四处
- 问题：`CacheService` 在 `_redis is None` 时对 `incr/get/set/delete` 返回软默认值（1/None/False/0）而非抛异常。RateLimiter 与登录锁定都按"**异常 → 本地降级**"设计——软默认值让异常永远不发生：`incr` 恒返回 1 → 限流恒放行；`get` 恒 None → 锁定恒"无记录"。Redis 在**启动期**就不可用时（connect 失败被 DI 捕获降级），所有安全控制静默失效，且降级路径成为死代码。
- 修复：CacheService 新增公开 `is_connected` 属性；`is_allowed`/`get_remaining` 未连接时显式抛 `ConnectionError` 走本地降级；auth 四处锁定路径 `redis and redis.is_connected` 判定。

**F1｜apps/api 代理端点 `chainId` 幽灵参数（链过滤静默失效）**
- 文件：`apps/api/api/v1/risk/check.js`、`apps/api/api/v1/public/risk-check.js`
- 问题：两处代理向 后端 `/api/v1/address/{address}/risk` 发送 `?chainId=<数字>`，而后端该路由读取的参数名是 `?chain=<链名>`——chainId 被后端静默忽略，链过滤永远落在后端默认值上。当前能工作纯属默认值("ethereum")恰好等于数据键的巧合，任何一方变化都会静默断裂。
- 修复：实测确认后端数据统一以 `chain="ethereum"` 为键后，改为显式 `?chain=ethereum` 并注明数据阶段口径；数据按链重键后恢复语义映射。

### MEDIUM（8 项）

**B3｜auth 登录锁定三助手 + 计数读取的软默认绕过**——同 B2 根因，`_check_account_lockout` / `_record_login_failure` / `_record_login_success` / login 计数读取共 4 处接入 `is_connected` 判定，未连接时走内存 fallback（原为静默失效）。

**B4｜限流 INCR/EXPIRE 两步非原子**——进程在两步间崩溃或 EXPIRE 失败 → 计数 key 永无 TTL → 该 IP/key 达到上限后被**永久**封锁。改用 Lua 脚本原子执行（fakeredis 实测 TTL 正确设置）。

**B5｜WebSocket pending-auth 计数器泄漏 + 配额语义错位**——(a) 认证等待期客户端断开（`WebSocketDisconnect`，用户关标签页的常见场景）不在任何 except 分支 → 计数器泄漏，100 次后端点假死（这正是 R3 修复声称堵住的洞，但漏了此早退路径）；(b) 认证成功后计数器直到**断开**才释放 → 100 个正常在线客户端即可占满全部 pending-auth 槽位，新连接再也建立不了。修复：补 `WebSocketDisconnect` 分支；认证成功立即释放；此后路径不再重复释放（防双重释放偷配额）。

**B6｜`update_subscription` 完全信任客户端消息**——订阅更新不校验地址格式、无数量上限（可一次推数万任意字符串进订阅索引），与初始连接路径的逐地址校验不一致。修复：对齐 `validate_address` 校验 + 100 条上限 + `min_risk_score` 数值范围校验。

**B7｜Blockscout v2 schema 全面漂移（实测确认）**——经线上实测（eth / eth-sepolia.blockscout.com）：地址响应已无 `balance`（→`coin_balance`）、无 `transaction_count`（→`/counters` 端点）、无 `first_transaction`/`last_transaction`（键已删除）、`creator_address`→`creator_address_hash`；`?limit=`/`?page=` 参数直接 **422 "Unexpected field"**。后果：`get_address_stats` 读到的全是默认值、附带的一次 `get_address_transactions(limit=1)` 恒 422 且被重试 3 次（结果还从未使用）→ "new_address" 年龄规则死路 + 每次评估白烧 3 次请求。修复：适配当前 schema（coin_balance + counters 端点）；`first_transaction` 用可靠启发式推导（仅当全部交易都在第一页时取页内最旧时间戳，否则诚实返回 None）；去掉死调用；`get_address_transactions` 等三个方法不再发送被拒参数。

**B8｜tenacity 对确定性 4xx 重试 3 次**——404/400/422 是确定性错误，原谓词对一切 `BlockscoutAPIException` 重试（+指数退避最坏 ~7s 纯浪费）。修复：共享谓词 `_should_retry_blockscout`，仅 5xx/429/无状态码（网络错误包装）重试。

**B9｜`from`:null / `value`:null 三处漏修**——`.get(key, default)` 只防**键缺失**不防**值为 null**。Blockscout 类外部 API 的 null 字段是系统性风险。上轮只修了 `to`，本轮补齐：`risk_engine_service.analyze_transaction`、`transactions.py get_transaction` 的 `from` + `value`，以及 legacy `risk_engine.py` 的 `value`（最后这处是验证脚本运行中当场抓到的）。

**F2｜batch-check 链键与数据不符 → 单查/批查自相矛盾**——后端批量端点把 chainId 11155111 映射为 `"sepolia"` 去查数据，但 sanctioned_list/scam_list 策略数据全部存在 `chain="ethereum"` 键下（publisher 消息载荷无 chain 字段、risk_sync 固定写 "ethereum"）→ 同一制裁地址**单查 100 分、批查 0 分**。修复：当前数据阶段统一解析为 `"ethereum"`（语义映射表保留，注明重键后恢复）。

### LOW（10 项）

| # | 位置 | 问题 → 修复 |
|---|------|-------------|
| B10 | blockscout_service.batch_get_transactions | `gather(return_exceptions)` 后 filter 丢异常且结果与输入不对齐 → 按输入顺序对齐返回（失败位 None）+ 意外异常记日志 |
| B11 | core/logging.py `_recurse_mask` | `pattern.match` 仅匹配串首 → 字符串中段嵌入的私钥/Bearer 逃过脱敏；改 `search` |
| B12 | core/security.py `sanitize_log_message` | 私钥正则 `(0x…{64})` 整体捕获后 `\1***` 替换 → **完整私钥原样保留**仅追加星号，脱敏无效；改为保留 4 位前缀掩蔽其余 |
| B13 | core/security.py request_tracing | `safe_headers` 全量拷贝+脱敏后从未使用（死代码）→ 删除 |
| B14 | database.py ensure_default_rules | docstring 声称 ON CONFLICT 实为 check-then-insert；`pg_insert` 导入未用（死导入）；多实例并发 seed 竞态会冒泡成误导性"seed 失败"日志 → 捕获 IntegrityError 按"已被并发实例 seed"幂等处理 + 移除死导入 |
| B15 | core/di.py shutdown | 懒创建的 lock_manager/message_queue 持有 Redis 连接但 shutdown 从不关闭 → 优雅停机泄漏；补 close |
| B16 | lock_manager / message_queue | `close()` 为 redis-py 弃用别名 → 归一 `aclose()`（与 cache_service 一致） |
| B17 | transaction_repository.create | `value`（str）直传 Numeric 列、`block_number` 可能 str → asyncpg 绑定错误被上游 try/except **静默吞掉**（交易记录从未入库却无 500）；写库边界显式 `Decimal(value)` / `int(block_number)` 矫正 |
| B19 | risk_engine_service | DB 持久化失败日志名 `transaction_cache_failed` 与缓存无关、误导排查 → 改 `transaction_persist_failed` |
| B20 | cache_service.get_object | `redis.get` 在 try 外 → 遗留二进制载荷在客户端解码层抛 UnicodeDecodeError 穿透；移入 try |

另记录（不修改）：`backend/app/cache.py` 为死模块（仅 DATABASE.md 文档引用）；`Transaction.to_address nullable=False` 与合约创建交易的 null to 语义存在模型层张力（当前代码以空串规避）。

---

## 三、修复验证结果（48/48 通过）

**验证工具**：`backend/_r5_verify.py`（可重复执行，无需 Postgres；Redis 相关经 fakeredis 验证）

- **R4 回归 21 项**：9 处上轮修复全部复验通过（含 F9 五个密钥值全仓 grep 清零）。
- **R5 新修复 27 项**，其中关键运行时验证：
  - `B1`：`requests_per_minute=3` 下本地降级第 1/2/3 次放行、第 4 次拒绝（原实现 4 次全放行）；
  - `B2`：未连接 CacheService 下 `is_allowed` 正确走本地降级并开始计数（原实现恒放行、计数恒空）；
  - `B4`：fakeredis 下 Lua 原子 INCR+EXPIRE 生效（第 3 次请求被拒、key TTL=60）；
  - `B8`：404→不重试、502/429→重试、断路器开路→不重试；
  - `B9`：`from:null`+`value:null`+`to:null` 的交易经三处代码路径均不崩溃；
  - **`B7` 线上集成验证**：`get_address_stats`（vitalik.eth 地址）现返回**真实数据**——balance=671,789,089,459… wei、transaction_count=78,357（修复前恒 "0"/0），first_transaction 对多交易地址诚实返回 None；
  - `F1/F2`：代理 URL 与批量端点链键的静态断言。
- **编译/语法**：backend 全部 37 个 `.py` `py_compile` 通过；3 个修改的 `.js` `node --check` 通过；2 个合约验证脚本 py_compile 通过。
- **验证过程的自捕获**：`_r5_verify` 首跑即抓到 legacy `risk_engine.py` 的 `value:null` 漏网实例（B9 第 3 处）——验证器本身即证明了其价值。

**变更规模**：27 个文件，+456 / −167 行（含 5 份文档脱敏、2 份脚本去密钥、1 个可重复验证脚本）。

---

## 四、遗留事项与建议（非缺陷，供决策）

1. **密钥轮换（P0）**：泄露过的 5 个密钥（Sepolia 部署私钥、PUBLISHER 私钥、Chainalysis/Etherscan×2 键）虽已在工作区脱敏，但**git 历史中仍然存在**。文档只脱敏不轮换=无效防护。建议：轮换全部相关密钥；评估 `git filter-repo` 清理历史（SECURITY_FIX_REPORT.md 已载有操作步骤）。
2. **数据按链重键**：当产品需要真正区分 Ethereum/Sepolia 数据时，需迁移 AddressRisk 键并为 apps/api 两个代理恢复 chainId→chain 语义映射（代码中已留有 `[AUDIT FIX 2026-09-24 F1/F2]` 标记锚点）。
3. **测试基建**：`tests/conftest.py` 在模块导入期创建 asyncpg 引擎且 session 级 fixture 连真库——本地无 Postgres 时 pytest 无法收集。建议改为惰性引擎 + docker-compose 起测试库。
4. **`app/cache.py` 死模块**：可择机删除（DATABASE.md 引用需同步更新）。
5. **Blockscout `first_transaction` 启发式**：对交易数 >50 的地址诚实返回"未知"（不猜测）；若产品需要任意地址的准确首笔时间，需引入专用索引（subgraph）而非分页翻查。

---

## 附：全部修复代码位置索引

| 修复 | 文件 |
|------|------|
| F9 补齐 | docs/audit-history/backend-infrastructure-audit.md、fix-summary-v2.3.md、SECURITY_AUDIT.md、SECURITY_FIX_REPORT.md、cross-check/final-security-scan.md、data-sync/scripts/debug/test_etherscan_detailed.js、apps/contracts/scripts/verify_etherscan_direct.py、verify_r3_etherscan.py |
| B1/B2/B4/B12/B13 | backend/app/core/security.py |
| B2/B20 | backend/app/services/cache_service.py |
| B3 | backend/app/controllers/auth.py |
| B5/B6 | backend/app/controllers/monitor.py |
| B7/B8/B10 | backend/app/services/blockscout_service.py |
| B9(1)/B17/B19 | backend/app/services/risk_engine_service.py |
| B9(2) | backend/app/controllers/transactions.py |
| B9(3) | backend/app/services/risk_engine.py |
| B11 | backend/app/core/logging.py |
| B14 | backend/app/database.py |
| B15 | backend/app/core/di.py |
| B16 | backend/app/core/lock_manager.py、message_queue.py |
| B17 | backend/app/repositories/transaction_repository.py |
| F2 | backend/app/controllers/addresses.py |
| F1 | apps/api/api/v1/risk/check.js、apps/api/api/v1/public/risk-check.js |
| 验证套件 | backend/_r5_verify.py（48 项断言，可重复运行） |
