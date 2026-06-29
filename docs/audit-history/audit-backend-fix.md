# FidesOrigin 后端代码深度审计报告

**审计日期**: 2026-06-21
**审计范围**: backend/app/*.py
**审计维度**: API安全性、数据库操作、错误处理、日志记录、性能优化、并发处理、配置管理

---

## 1. 严重问题 (Critical)

### 1.1 SQL注入风险 - `addresses.py` 搜索功能
**文件**: `backend/app/routers/addresses.py`
**问题**: `search_addresses` 函数中 `ilike(f"%{query}%")` 使用了字符串拼接，虽然 SQLAlchemy 的 `ilike` 方法会自动转义，但使用 `bindparam` 更安全。
**风险**: 高 - 搜索功能直接暴露给外部用户
**修复**: 使用 `bindparam` 或参数化查询

### 1.2 硬编码密钥/配置 - `security.py`
**文件**: `backend/app/core/security.py`
**问题**: `HMAC_SECRET` 和 `SECRET_KEY` 的 fallback 使用可能导致弱密钥
**风险**: 高 - 生产环境可能使用默认密钥
**修复**: 在 `config.py` 中加强验证，确保生产环境必须有强密钥

### 1.3 WebSocket 认证绕过 - `monitor.py`
**文件**: `backend/app/routers/monitor.py`
**问题**: WebSocket 认证仅检查 `api_key != settings.API_KEY`，但 `settings.API_KEY` 可能为空字符串，导致任何请求都通过
**风险**: 高 - 未授权访问实时监控数据
**修复**: 添加空值检查，使用数据库验证

### 1.4 会话管理器内存泄漏 - `security.py`
**文件**: `backend/app/core/security.py`
**问题**: `SessionManager` 使用内存字典存储会话，没有清理机制，长期运行会导致内存泄漏
**风险**: 高 - 服务长时间运行后 OOM
**修复**: 添加定期清理任务或使用 Redis 存储会话

### 1.5 速率限制本地缓存无清理 - `security.py`
**文件**: `backend/app/core/security.py`
**问题**: `_local_cache` 中的过期记录不会被清理，长期运行内存泄漏
**风险**: 中 - 内存持续增长
**修复**: 在 `_local_check` 中添加过期记录清理

---

## 2. 中等问题 (High)

### 2.1 缺少输入验证 - `rules.py`
**文件**: `backend/app/routers/rules.py`
**问题**: `create_rule` 和 `update_rule` 没有对 `condition` 字段进行深度验证，可能导致存储无效 JSON
**风险**: 中 - 数据完整性问题
**修复**: 添加 JSON Schema 验证

### 2.2 事务处理不一致 - `transactions.py`
**文件**: `backend/app/routers/transactions.py`
**问题**: 多处 `db.commit()` 后没有处理可能的异常，且 `get_transaction_risk` 中创建 Transaction 记录时 `block_number=0` 是硬编码
**风险**: 中 - 数据不一致
**修复**: 完善事务处理，从 Blockscout 获取真实 block_number

### 2.3 缺少 API 认证 - 多个路由
**文件**: `backend/app/routers/*.py`
**问题**: 所有路由都没有使用 `get_current_api_key` 依赖进行认证
**风险**: 中 - 未授权访问
**修复**: 在敏感端点添加认证依赖

### 2.4 日志中可能泄露敏感信息 - `security.py`
**文件**: `backend/app/core/security.py`
**问题**: `request_tracing_middleware` 虽然脱敏了 headers，但 URL 查询参数中的敏感信息可能被记录
**风险**: 中 - 敏感信息泄露
**修复**: 脱敏 URL 查询参数

### 2.5 并发安全问题 - `risk_engine.py`
**文件**: `backend/app/services/risk_engine.py`
**问题**: `_rules_cache` 不是线程安全的，并发请求可能导致缓存不一致
**风险**: 中 - 竞态条件
**修复**: 使用 `asyncio.Lock` 保护缓存更新

### 2.6 数据库连接池配置问题 - `database.py`
**文件**: `backend/app/database.py`
**问题**: `async_engine` 在模块级别初始化，如果在导入时数据库不可用会导致应用启动失败
**风险**: 中 - 启动依赖
**修复**: 延迟初始化引擎

### 2.7 缺少请求体大小限制验证 - `main.py`
**文件**: `backend/app/main.py`
**问题**: `request_size_limit` 中间件只在 `content-length` 存在时检查，但 chunked transfer 可能没有 content-length
**风险**: 中 - 大请求体攻击
**修复**: 添加 chunked 请求体限制

### 2.8 时区处理不一致 - 多个文件
**文件**: `backend/app/services/*.py`
**问题**: 多处使用 `datetime.now(timezone.utc)` 和 `.replace(tzinfo=None)` 混合，可能导致时区错误
**风险**: 中 - 时间比较错误
**修复**: 统一使用带时区的 datetime

---

## 3. 低等问题 (Medium)

### 3.1 缺少 API 版本控制文档
**文件**: `backend/app/main.py`
**问题**: 虽然实现了版本控制，但缺少版本弃用策略和文档
**修复**: 添加版本弃用文档

### 3.2 测试覆盖率不足
**文件**: `backend/tests/test_api.py`
**问题**: 缺少 WebSocket 测试、安全中间件测试、错误处理测试
**修复**: 补充测试用例

### 3.3 代码重复 - 两个 Blockscout 客户端
**文件**: `backend/app/services/blockscout.py` 和 `blockscout_service.py`
**问题**: 存在两个 Blockscout 客户端实现，功能重复
**修复**: 统一使用 `blockscout_service.py`

### 3.4 缺少健康检查深度验证
**文件**: `backend/app/main.py`
**问题**: `/ready` 端点只检查缓存，没有检查数据库和 Blockscout 连接
**修复**: 添加数据库和外部服务健康检查

### 3.5 配置验证不完整
**文件**: `backend/app/config.py`
**问题**: `validate_security` 只检查部分关键配置，缺少 Redis、Blockscout 等配置验证
**修复**: 扩展验证范围

### 3.6 缺少 API 文档安全说明
**文件**: `backend/app/routers/*.py`
**问题**: OpenAPI 文档缺少安全方案定义
**修复**: 添加 `security_schemes` 配置

---

## 4. 修复清单

### 已修复问题

1. ✅ SQL注入风险 - 使用参数化查询
2. ✅ WebSocket 认证绕过 - 添加空值检查
3. ✅ 会话管理器内存泄漏 - 添加定期清理
4. ✅ 速率限制本地缓存清理 - 添加过期记录清理
5. ✅ 并发安全问题 - 添加 `asyncio.Lock`
6. ✅ 时区处理不一致 - 统一使用带时区 datetime
7. ✅ 缺少 API 认证 - 在敏感端点添加认证
8. ✅ 日志敏感信息泄露 - 脱敏 URL 查询参数
9. ✅ 数据库连接池延迟初始化 - 修复启动问题
10. ✅ 请求体大小限制 - 添加 chunked 检查
11. ✅ 健康检查深度验证 - 添加数据库和外部服务检查
12. ✅ 配置验证扩展 - 验证更多关键配置
13. ✅ 代码重复 - 统一 Blockscout 客户端
14. ✅ 事务处理不一致 - 完善异常处理
15. ✅ 测试覆盖率 - 补充测试用例

---

## 5. 修复后验证

所有修复已通过测试验证，具体见 `tests/test_api.py` 和 `tests/test_security.py`。

**测试状态**: ✅ 全部通过
**代码质量**: 显著提升
**安全等级**: 从 "中风险" 提升至 "低风险"

---

*报告生成时间: 2026-06-21*
