# FidesOrigin 后端代码第2轮验证审计报告

**审计日期**: 2026-06-17
**审计范围**: `backend/app/` 全量代码（含重构版 controllers/、services/、repositories/ 及旧版 routers/）
**验证维度**: SQL注入防护、认证授权、输入验证、异常处理、资源泄漏、敏感信息、CORS配置、速率限制

---

## 1. SQL注入防护（参数化查询）

### 1.1 评估结果: ✅ 通过

**核心发现**:
- 所有数据库查询均使用 **SQLAlchemy ORM** 的声明式查询 API（`select()`、`where()`），天然防注入
- 无任何字符串拼接 SQL 的情况
- Repository 层完全封装了查询逻辑，Controller/Router 层不直接操作 SQL

**关键证据**:
```python
# repositories/address_repository.py
result = await self.db.execute(
    select(AddressRisk).where(
        AddressRisk.address == address,   # 参数化绑定
        AddressRisk.chain == chain
    )
)

# repositories/rule_repository.py
query = select(RiskRule)
if active_only:
    query = query.where(RiskRule.is_active == True)  # 布尔参数化
if category:
    query = query.where(RiskRule.category == category)
```

**注意点**:
- `AddressRepository.search()` 中使用 `AddressRisk.address.ilike(f"%{query}%")`，`query` 来自用户输入。虽然 SQLAlchemy 的 `ilike()` 会对参数进行绑定，但建议增加一层输入清理（如 `sanitize_string()`）以防御逻辑层面的模糊搜索滥用。

---

## 2. 认证授权（@require_auth 装饰器）

### 2.1 评估结果: ⚠️ 部分通过（存在架构不一致和遗留代码风险）

**核心发现**:

#### A. 新版 Controller 层（重构版）—— 认证正确 ✅
- 所有 Controller 端点均使用 `api_key: str = Depends(get_current_api_key)` 注入认证
- WebSocket 端点使用 `verify_api_key()` + 随机延迟防时序攻击

```python
# controllers/addresses.py
@router.get("/{address}/risk", ...)
async def get_address_risk(
    ...,
    api_key: str = Depends(get_current_api_key)   # ✅ 强制认证
):

# controllers/monitor.py
if not await verify_api_key(api_key, db):
    await asyncio.sleep(secrets.randbelow(100) / 1000)  # ✅ 防时序攻击
    await websocket.close(code=4001, reason="Invalid API key")
```

#### B. 旧版 Router 层 —— 完全无认证 ❌
- `routers/addresses.py`、`routers/transactions.py`、`routers/rules.py`、`routers/monitor.py` **没有任何认证依赖**
- 这些旧路由文件仍然存在于代码库中，如果 `main.py` 同时注册了旧路由和新路由，会导致认证绕过

```python
# routers/rules.py —— 完全无认证
@router.post("/")
async def create_rule(
    rule: RiskRuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: str = "admin"  # ❌ 硬编码，无实际认证
):
```

#### C. `main.py` 路由注册 —— 仅注册新版 ✅
```python
# main.py
from app.controllers import addresses, monitor, rules, transactions
app.include_router(addresses.router)
app.include_router(transactions.router)
app.include_router(rules.router)
app.include_router(monitor.router)
```
当前 `main.py` 仅注册 `controllers/` 下的路由，旧版 `routers/` 未被引用。但如果旧文件未被清理，存在误注册风险。

**🚨 高风险建议**:
1. **立即删除** `backend/app/routers/` 目录下的所有旧文件，或重命名为 `.bak`
2. 在 CI/CD 中增加检查，确保旧路由不会被意外导入

---

## 3. 输入验证（Pydantic 模型）

### 3.1 评估结果: ✅ 通过

**核心发现**:

#### A. Pydantic Schema 验证 ✅
- 所有请求体均使用 Pydantic 模型定义（`RiskRuleCreate`、`RiskRuleUpdate`、`AddressRiskReportRequest` 等）
- 查询参数使用 FastAPI 的 `Query(..., ge=0, le=100)` 进行范围约束

```python
# schemas.py 中的定义
class RiskRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    risk_weight: float = Field(..., ge=0, le=10)
    risk_score_impact: float = Field(..., ge=-100, le=100)
    priority: int = Field(..., ge=1, le=1000)
```

#### B. 自定义验证器 ✅
- `app/validators.py` 提供了独立的验证函数，与 Pydantic 形成双层防护

```python
def validate_address(address: str) -> str:
    if not ETH_ADDRESS_RE.match(address):
        raise ValidationException(...)
    return address.lower()

def validate_tx_hash(tx_hash: str) -> str:
    if not TX_HASH_RE.match(tx_hash):
        raise ValidationException(...)
    return tx_hash.lower()

def validate_chain(chain: str) -> str:
    if chain not in SUPPORTED_CHAINS:
        raise ValidationException(...)
    return chain
```

#### C. 字符串清理 ✅
- `sanitize_string()` 去除控制字符、限制长度，防止日志注入和存储层异常

**注意点**:
- `routers/addresses.py` 中的 `validate_address()` 使用 `HTTPException` 直接抛出，而新版 `controllers/` 和 `validators.py` 使用自定义 `ValidationException`。两者行为一致，但建议统一使用 `ValidationException` 以利用全局异常处理器的结构化响应。

---

## 4. 异常处理（try-catch 完整性）

### 4.1 评估结果: ⚠️ 部分通过（存在异常吞没和重复回滚风险）

**核心发现**:

#### A. 全局异常处理 ✅
- `main.py` 注册了 `FidesException` 和通用 `Exception` 两个全局处理器
- 生产环境隐藏内部错误详情，防止信息泄露

```python
@app.exception_handler(FidesException)
async def fides_exception_handler(request, exc: FidesException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.error_code, "message": exc.message, ...}}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc: Exception):
    if settings.is_production:
        message = "Internal server error"   # ✅ 生产环境隐藏详情
    else:
        message = str(exc) if settings.DEBUG else "Internal server error"
```

#### B. 数据库会话异常处理 ✅
- `get_db()` 和 `get_db()` (DI) 均实现了 `try/except/finally` 模式，确保回滚和关闭

```python
async def get_db():
    session = get_async_session_maker()()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()   # ✅ 确保关闭
```

#### C. 异常吞没风险 ⚠️
- `risk_engine_service.py` 中部分 `except Exception` 仅记录日志，未重新抛出，可能导致调用方误以为操作成功

```python
# risk_engine_service.py
except Exception as e:
    await self.alert.send_alert(...)   # 发送告警
    logger.error(...)
    raise RiskCalculationException(...) from e   # ✅ 正确：重新抛出
```

但以下位置存在吞没:
```python
# risk_engine_service.py — analyze_transaction()
try:
    await self.transaction_repo.create(...)
except Exception as e:
    logger.warning("transaction_cache_failed", ...)   # ⚠️ 仅警告，不抛出
```
虽然这里是缓存写入失败，不影响主流程，但建议明确注释说明此为"非关键路径失败可接受"。

#### D. 重复回滚风险 ⚠️
- `get_db()` 在异常时已经执行 `session.rollback()`
- 但 `routers/` 中的部分端点（如 `report_address`）在 `except Exception` 块中再次调用 `await db.rollback()`，可能导致二次回滚报错（某些数据库驱动下）

```python
# routers/addresses.py
except Exception as e:
    await db.rollback()   # ⚠️ 如果异常来自 get_db() 的 yield 后，此处可能重复回滚
```

---

## 5. 资源泄漏（数据库连接关闭）

### 5.1 评估结果: ✅ 通过

**核心发现**:

#### A. 数据库会话管理 ✅
- `get_db()` 使用 `asynccontextmanager` 模式（通过 `yield` + `finally`），确保会话关闭
- `database.py` 中引擎和会话工厂均为延迟初始化，避免启动时即创建连接

```python
# database.py
async def get_db():
    session = get_async_session_maker()()
    try:
        yield session
        ...
    finally:
        await session.close()   # ✅ 确保关闭
```

#### B. Redis 连接管理 ✅
- `CacheService` 提供 `connect()` 和 `close()` 方法
- `DIContainer.shutdown()` 中调用 `cache.close()`，应用关闭时释放连接

```python
# core/di.py
async def shutdown(self):
    if self._cache:
        await self._cache.close()
        self._cache = None
```

#### C. HTTP 客户端管理 ✅
- `BlockscoutService` 实现了 `__aenter__` / `__aexit__` 和 `close()` 方法
- 使用 `httpx.AsyncClient` 并确保在异常时关闭

#### D. WebSocket 连接管理 ✅
- `WebSocketManager` 在 `disconnect()` 中清理连接和订阅索引
- `monitor.py` 的 `finally` 块确保调用 `manager.disconnect(client_id)`

---

## 6. 敏感信息（无密码密钥泄露）

### 6.1 评估结果: ⚠️ 部分通过（存在配置默认值风险）

**核心发现**:

#### A. 配置管理 ✅
- `config.py` 使用 Pydantic Settings 集中管理，支持 `.env` 文件
- 生产环境启动时调用 `validate_security()` 检查关键配置

```python
def validate_security(self):
    if self.APP_ENV == "production":
        missing = []
        if not self.SECRET_KEY or len(self.SECRET_KEY) < 32:
            missing.append("SECRET_KEY")
        if not self.DB_PASSWORD or self.DB_PASSWORD == "default_password":
            missing.append("DB_PASSWORD")
        if not self.API_KEY or self.API_KEY == "dev-api-key-change-in-production":
            missing.append("API_KEY")
```

#### B. 日志脱敏 ✅
- `request_tracing_middleware` 明确不记录敏感信息
- API Key 在日志中仅记录前 8 位前缀

```python
logger.warning("api_key_invalid", api_key_prefix=api_key[:8] if len(api_key) > 8 else "")
```

#### C. 默认值风险 ⚠️
- `SECRET_KEY`、`API_KEY`、`HMAC_SECRET` 默认值为空字符串，开发环境可能无意中使用弱密钥
- `DB_PASSWORD` 默认值为空字符串，如果未配置可能导致无密码连接（取决于数据库配置）

```python
# config.py
SECRET_KEY: str = Field(default="", description="应用密钥")
API_KEY: str = Field(default="", description="API 密钥")
DB_PASSWORD: str = Field(default="", description="数据库密码")
```

**建议**:
- 开发环境也强制要求设置 `SECRET_KEY` 和 `API_KEY`，可通过 `docker-compose.yml` 或启动脚本自动生成随机值
- 在 `validate_security()` 中增加开发环境警告（非阻断）

#### D. WebSocket 认证 ⚠️
- `monitor.py` 中 `api_key` 从 query params 获取，可能出现在 access log 中
- 建议改为从 WebSocket subprotocol 或首次消息中传递，避免 URL 泄露

---

## 7. CORS 配置合理性

### 7.1 评估结果: ✅ 通过

**核心发现**:

```python
# config.py
CORS_ORIGINS: List[str] = Field(
    default_factory=lambda: [
        "https://fidesorigin.com",
        "https://www.fidesorigin.com",
        "https://fidesorigin-demo.vercel.app",
        "http://localhost:3000",
        "http://localhost:5173",
    ]
)
CORS_ALLOW_CREDENTIALS: bool = Field(default=True)
CORS_ALLOW_METHODS: List[str] = Field(default_factory=lambda: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
CORS_ALLOW_HEADERS: List[str] = Field(default_factory=lambda: ["*"])
```

#### A. 生产环境限制 ✅
- `validate_security()` 禁止生产环境使用 `CORS_ORIGINS == ["*"]`
- 默认配置仅包含已知域名和本地开发端口

#### B. 凭证允许 ✅
- `allow_credentials=True` 配合具体的 origin 列表是安全的
- 不会与 `*` origin 同时使用（已被 `validate_security()` 拦截）

#### C. 头部允许 ⚠️
- `CORS_ALLOW_HEADERS: ["*"]` 在生产环境中可能过于宽松
- 建议限制为实际需要的最小头部集合：`["Authorization", "Content-Type", "X-API-Key", "X-Request-ID"]`

---

## 8. 速率限制

### 8.1 评估结果: ✅ 通过

**核心发现**:

#### A. 中间件实现 ✅
- `rate_limit_middleware` 基于 Redis 实现滑动窗口计数器
- 支持降级到本地内存（Redis 不可用时）
- 健康检查端点（`/health`、`/ready`、`/`）被跳过

```python
async def rate_limit_middleware(request, call_next):
    if request.url.path in ("/health", "/ready", "/"):
        return await call_next(request)   # ✅ 跳过健康检查

    # 优先使用真实 IP（考虑反向代理）
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "unknown"
```

#### B. 限流键设计 ✅
- 认证用户使用 `api:{api_key[:16]}`
- 匿名用户使用 `ip:{client_ip}`
- 对匿名用户更严格（虽然当前所有端点都要求认证）

#### C. 响应头 ✅
- 返回 `X-RateLimit-Limit` 和 `X-RateLimit-Remaining` 头部，便于客户端处理

#### D. 配置化 ✅
- `RATE_LIMIT_REQUESTS_PER_MINUTE` 可配置，默认 60/min
- `RATE_LIMIT_ENABLED` 可开关

#### E. WebSocket 限流 ⚠️
- 当前 WebSocket 连接没有独立的速率限制
- `WebSocketManager` 有 `MONITOR_MAX_CONNECTIONS`（默认 100）限制，但这是连接数限制而非消息速率限制
- 建议对 WebSocket 消息处理增加每秒消息数限制，防止消息洪泛

---

## 9. 其他安全观察

### 9.1 HMAC 签名验证 ✅
- `HMACValidator` 使用 `secrets.compare_digest()` 防止时序攻击
- 但当前代码中 HMAC 验证未在任何路由中实际使用（仅定义了工具类）

### 9.2 安全响应头 ✅
- `security_headers_middleware` 添加了完整的 CSP、HSTS、X-Frame-Options 等头部

```python
response.headers["X-Content-Type-Options"] = "nosniff"
response.headers["X-Frame-Options"] = "DENY"
response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
response.headers["Content-Security-Policy"] = "default-src 'self'"
```

### 9.3 缓存穿透保护 ✅
- `CacheService.get_or_set()` 实现了分布式锁 + 空值缓存，防止缓存击穿和穿透

### 9.4 告警与监控 ✅
- `AlertService` 在风险计算失败时自动发送告警
- 告警冷却机制防止告警风暴

---

## 10. 综合评分

| 验证维度 | 评分 | 状态 |
|---------|------|------|
| SQL注入防护 | 9/10 | ✅ 通过 |
| 认证授权 | 6/10 | ⚠️ 需改进（清理旧路由） |
| 输入验证 | 9/10 | ✅ 通过 |
| 异常处理 | 7/10 | ⚠️ 需改进（异常吞没、重复回滚） |
| 资源泄漏 | 9/10 | ✅ 通过 |
| 敏感信息 | 7/10 | ⚠️ 需改进（默认值、WebSocket key） |
| CORS配置 | 8/10 | ✅ 通过（头部可收紧） |
| 速率限制 | 8/10 | ✅ 通过（WebSocket 待补充） |

**综合评分: 7.9/10**

---

## 11. 优先修复清单

### 🔴 P0 - 立即修复

1. **删除旧版路由文件** `backend/app/routers/*.py`，或确保它们不会被 `main.py` 导入
2. **统一异常处理**: 将 `routers/` 中的 `HTTPException` 替换为自定义 `FidesException` 子类，或删除旧文件

### 🟡 P1 - 本周修复

3. **增加 WebSocket API Key 传输安全**: 避免从 query params 传递，改用首次消息或 subprotocol
4. **收紧 CORS 头部**: 将 `CORS_ALLOW_HEADERS: ["*"]` 改为明确列表
5. **开发环境强制配置**: 启动时检查 `SECRET_KEY` 和 `API_KEY` 是否已设置（即使是开发环境也警告）

### 🟢 P2 - 后续优化

6. **WebSocket 消息速率限制**: 对单个连接增加每秒消息数限制
7. **异常吞没注释**: 在 `transaction_cache_failed` 等位置增加明确注释说明非关键路径
8. **删除重复回滚**: 清理 `routers/` 中 `except` 块内的 `db.rollback()`（`get_db()` 已处理）
9. **HMAC 验证落地**: 如果 Webhook 接收需要，在相关路由中实际接入 `HMACValidator`

---

*报告生成完毕。建议按 P0 → P1 → P2 顺序执行修复。*
