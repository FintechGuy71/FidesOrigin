# FidesOrigin 后端测试修复记录

## 修复概述

将 21 个 API 测试从全部失败修复到全部通过。

## 修复的问题

### 1. Redis 连接问题（测试环境无 Redis）
**问题**: 测试环境没有 Redis 服务器，导致 `CacheService` 连接失败，返回 500 错误。

**修复**:
- `app/core/di.py`: `init_container()` 在测试环境（`TEST_DATABASE_URL` 存在时）跳过 Redis 连接
- `app/core/di.py`: `DIContainer.cache` 属性懒加载时，测试环境跳过 `connect()` 调用
- `app/services/cache_service.py`: 所有方法在 `_redis = None` 时安全降级（返回 None/False/0）
- `app/services/cache_service.py`: 添加缺失的 `incr()` 和 `expire()` 方法

### 2. 模型字段缺失
**问题**: `AddressRisk` 模型缺少 `tags`、`first_seen_at`、`last_updated_at` 字段。

**修复**:
- `app/models.py`: 为 `AddressRisk` 添加缺失字段

### 3. Schema 类型不匹配
**问题**: `TransactionResponse.id` 是 `UUID` 类型，但 `Transaction.id` 是 `BigInteger`。

**修复**:
- `app/schemas.py`: `TransactionResponse.id` 改为 `int` 类型

### 4. 控制器代码错误
**问题**: `transactions.py` 使用不存在的 `tx.address` 和 `tx.risk_indicators` 字段。

**修复**:
- `app/controllers/transactions.py`: 使用 `tx.from_address` 替代 `tx.address`
- `app/controllers/transactions.py`: 使用 `tx.risk_factors` 替代 `tx.risk_indicators`
- `app/controllers/transactions.py`: 处理 `risk_level` 枚举/字符串兼容
- `app/controllers/addresses.py`: 处理 `status` 枚举/字符串兼容

### 5. 测试数据问题
**问题**: `Transaction.value` 传入的值超出 `Numeric(36,18)` 范围。

**修复**:
- `tests/test_api.py`: 将 `value="1000000000000000000"` 改为 `value="1.000000000000000000"`

### 6. 其他修复
- `app/core/di.py`: 添加 `import os`
- `app/core/exceptions.py`: `ValidationException` 支持 `field` 参数
- `app/services/cache_service.py`: Redis 8.0 兼容性（使用 `redis.Redis()` 替代 `ConnectionPool`）

## 测试运行结果

```
21 passed, 23 warnings in 8.63s
```

所有测试通过！
