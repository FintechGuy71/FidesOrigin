# FidesOrigin Backend Security Audit Report

> **Auditor:** Senior Backend Architect (Subagent)
> **Scope:** `/root/.openclaw/workspace/fidesorigin-demo/backend/` — All `.py` files
> **Date:** 2026-07-27
> **Focus Areas:** API Security, JWT, Database, Error Handling, Logging, Async Operations

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 4 |
| 🟠 HIGH | 9 |
| 🟡 MEDIUM | 12 |
| 🟢 LOW | 8 |

**Overall Assessment:** The codebase shows mature security awareness with well-implemented refresh token rotation, CSRF protection, rate limiting, and structured logging. However, there are **4 CRITICAL bugs** that would cause runtime failures or security bypasses in production, plus several HIGH-severity issues around JWT type verification, test isolation, and WebSocket origin validation.

---

## 1. API Security — Authentication, Rate Limiting, Input Validation

### 🔴 CRITICAL

#### C-1: `CacheService.get()` crashes on Redis hit due to double `.decode()`
- **File:** `app/services/cache_service.py`
- **Line:** 79-82
- **Issue:** Redis client is initialized with `decode_responses=True` (line 57), so `redis.get()` already returns `str`. The code then calls `value.decode()` on a string, causing `AttributeError`. This means **all cache reads from Redis crash** — the entire caching layer is broken in production.
- **Fix:** Remove `.decode()` call when `decode_responses=True`.

```python
# BROKEN (current):
value = await self._redis.get(key)
if value:
    result = value.decode()  # AttributeError: 'str' object has no attribute 'decode'

# FIXED:
value = await self._redis.get(key)
if value is not None:
    result = value  # Already str
```

#### C-2: `decode_access_token` does NOT verify `type == "access"`
- **File:** `app/core/security.py`
- **Line:** 189-200
- **Issue:** A refresh token (which also has `sub` and `exp`) could be used as an access token at any API endpoint. The `type` claim is set but never checked during validation.
- **Fix:** Add `if payload.get("type") != "access": raise AuthenticationException(...)`.

#### C-3: `rotate_refresh_token` does NOT verify `type == "refresh"`
- **File:** `app/core/security.py`
- **Line:** 147-160
- **Issue:** An access token passed to the refresh endpoint would be accepted, rotated, and returned as a new refresh token. This breaks the token type boundary entirely.
- **Fix:** Add `if payload.get("type") != "refresh": raise AuthenticationException(...)`.

### 🟠 HIGH

#### H-1: WebSocket origin whitelist includes `localhost` in production
- **File:** `app/controllers/monitor.py`
- **Line:** 31
- **Issue:** `_ALLOWED_WS_ORIGINS` is built as `set(settings.CORS_ORIGINS) | {"http://localhost:3000", "http://localhost:5173"}`. The localhost origins are unconditionally added even in production, allowing cross-origin WebSocket connections from any localhost app.
- **Fix:** Only add localhost origins when `settings.APP_ENV != "production"`.

#### H-2: `request_signature_middleware` skips GET/HEAD read operations on sensitive paths
- **File:** `app/core/security.py`
- **Line:** 393-413
- **Issue:** The condition `if (is_api_write or is_sensitive_path) and request.method in ("POST", "PUT", "PATCH", "DELETE")` means GET requests to `/api/v1/address/report` or `/api/v1/rules` skip signature verification. A replayed GET to a sensitive endpoint is unprotected.
- **Fix:** Remove the method check for `is_sensitive_path`, or add GET to the protected methods for sensitive paths.

#### H-3: `AddressRepository.search()` silently ignores invalid `risk_level`
- **File:** `app/repositories/address_repository.py`
- **Line:** 144-149
- **Issue:** If an invalid `risk_level` is passed, the `ValueError` from `RiskLevel(risk_level.lower())` is caught and silently ignored. The query returns unfiltered results instead of empty or error.
- **Fix:** Re-raise `ValidationException` on invalid enum value.

#### H-4: `test_blockscout_service_rejects_bad_base_url` mutates global settings without cleanup
- **File:** `tests/test_p2p3_fixes.py`
- **Line:** 113-122
- **Issue:** Modifies `bss_module.settings.BLOCKSCOUT_BASE_URL` directly. Since `get_settings()` is `@lru_cache()`, this change **persists across tests**, polluting global state for all subsequent test runs.
- **Fix:** Use `monkeypatch` or call `reset_settings()` after the test.

#### H-5: `risk_engine.py` (legacy) has an `async @property` — runtime crash
- **File:** `app/services/risk_engine.py`
- **Line:** 108-112
- **Issue:** `@property async def blockscout(self):` is invalid Python. Awaiting a property (`await self.blockscout`) raises `TypeError: 'property' object is not awaitable`. This file appears to be legacy but is still imported in tests.
- **Fix:** Either delete the legacy file or change to an async method.

#### H-6: `ContentSizeLimitMiddleware` sets `request._receive` but Starlette may not use it
- **File:** `app/main.py`
- **Line:** 192-210
- **Issue:** `request._receive = _sized_receive` monkey-patches a private attribute. In newer Starlette/FastAPI versions, the `receive` channel is accessed differently and this patch may be bypassed, making the size limit ineffective.
- **Fix:** Use a proper ASGI middleware that intercepts the `receive` callable in the ASGI scope.

#### H-7: `database.py` lazy initialization is bypassed at module import
- **File:** `app/database.py`
- **Line:** 43
- **Issue:** `AsyncSessionLocal = get_async_session_maker()` is executed at import time, which immediately calls `get_async_engine()` and creates the engine. The `_async_engine = None` lazy init is useless.
- **Fix:** Remove the module-level `AsyncSessionLocal = ...` assignment or make it a property/function.

#### H-8: `get_current_user` tries JWT first and raises immediately on invalid token
- **File:** `app/core/security.py`
- **Line:** 175-186
- **Issue:** If a request sends both a malformed Bearer token AND a valid X-API-Key, the function raises on the JWT before trying the API key. This breaks dual-auth fallback for clients that accidentally send both.
- **Fix:** Catch `AuthenticationException` from JWT and fall through to API key check before raising.

### 🟡 MEDIUM

#### M-1: `mask_sensitive_data` and `_is_sensitive_key` use substring matching
- **File:** `app/core/security.py` (line 460), `app/core/logging.py` (line 57)
- **Issue:** `any(s in key_lower for s in _SENSITIVE_FIELDS)` causes false positives. E.g., key `"tokenized_api"` matches `"token"` and gets masked.
- **Fix:** Use exact key matching or underscore-separated token matching consistently.

#### M-2: `SUPPORTED_CHAINS` is defined twice
- **File:** `app/validators.py`
- **Line:** 12, 16
- **Issue:** The second definition silently overwrites the first. Currently identical, but a future edit to one would be silently ignored.
- **Fix:** Remove the duplicate.

#### M-3: `LoginRequest.password` max_length=128 but bcrypt truncates at 72 bytes
- **File:** `app/controllers/auth.py`
- **Line:** 155
- **Issue:** The Pydantic model allows passwords up to 128 chars, but bcrypt silently truncates at 72 bytes. The prehash workaround exists (`_prehash_password_for_bcrypt`) but the model validation doesn't communicate this to users.
- **Fix:** Add a validator note or reduce max_length with documentation.

#### M-4: `_login_attempts_fallback` dict grows unbounded in memory
- **File:** `app/controllers/auth.py`
- **Line:** 43
- **Issue:** When Redis is unavailable, failed login attempts for unique usernames accumulate in memory forever. No TTL or cleanup.
- **Fix:** Add timestamp-based eviction on access.

#### M-5: `AddressRiskReportRequest.validate_address` does not validate checksum
- **File:** `app/schemas.py`
- **Line:** 63-69
- **Issue:** Only checks prefix (`0x`) and length (42). Invalid Ethereum checksums (EIP-55) pass validation.
- **Fix:** Add `eth_utils.is_checksum_address()` or similar validation.

#### M-6: `batch_get_transactions` silently swallows exceptions
- **File:** `app/services/blockscout_service.py`
- **Line:** 347-359
- **Issue:** `asyncio.gather(..., return_exceptions=True)` followed by `isinstance(r, dict)` silently drops exceptions. Failed batch items are lost without individual logging.
- **Fix:** Log exceptions individually before filtering.

#### M-7: `csrf_protection_middleware` CSRF cookie `secure=True` always
- **File:** `app/core/security.py`
- **Line:** 252-258
- **Issue:** The cookie is always `secure=True`, even in local development without HTTPS. Browsers will reject the cookie on `http://localhost`, breaking local dev CSRF flows.
- **Fix:** `secure=not settings.DEBUG` or similar.

#### M-8: `lock_manager.py` `_generate_token` uses non-cryptographic random
- **File:** `app/core/lock_manager.py`
- **Line:** 67-68
- **Issue:** `random.randint(100000, 999999)` is not cryptographically secure. Lock tokens should use `secrets.token_urlsafe()`.
- **Fix:** Replace with `secrets.token_urlsafe(16)`.

#### M-9: `message_queue.py` retry_count is never incremented on Redis auto-redelivery
- **File:** `app/core/message_queue.py`
- **Line:** 370-390
- **Issue:** When a message handler fails, the message is NOT acknowledged. Redis Streams will redeliver it, but `envelope.retry_count` is never incremented. A poison pill message will be retried indefinitely until it expires from the stream.
- **Fix:** Increment `retry_count` in the envelope (persisted to stream or tracked separately) before deciding on DLQ.

#### M-10: `cache_service.py` `clear_pattern` can exceed Redis argument limits
- **File:** `app/services/cache_service.py`
- **Line:** 232-237
- **Issue:** `scan_iter` + `delete(*keys)` with a large keyset can exceed Redis's maximum argument count or block the server.
- **Fix:** Use pipeline with batched deletes (e.g., 500 keys at a time).

#### M-11: `api_version` and `/` endpoints use ternary `Depends(get_current_user)` in parameter default
- **File:** `app/main.py`
- **Line:** 248-257, 282-290
- **Issue:** `Depends(get_current_user) if settings.is_production else None` is evaluated at function definition time, not call time. If `settings.is_production` changes (e.g., via monkeypatch in tests), the dependency is already baked in.
- **Fix:** Use a wrapper dependency that checks settings at runtime.

#### M-12: `alembic/env.py` uses async DATABASE_URL for offline migrations
- **File:** `alembic/env.py`
- **Line:** 25-28
- **Issue:** `run_migrations_offline()` returns `settings.DATABASE_URL` which is `postgresql+asyncpg://...`. Alembic offline mode expects a sync dialect. `DATABASE_URL_SYNC` exists but is not used.
- **Fix:** Use `settings.DATABASE_URL_SYNC` in offline mode.

### 🟢 LOW

#### L-1: `AlertService._should_alert` is not thread-safe / async-safe
- **File:** `app/services/alert_service.py`
- **Line:** 42-52
- **Issue:** `_last_alert_time` and `_alert_counts` are plain dicts. Concurrent coroutines could race on update. Low impact due to 5-min cooldown.
- **Fix:** Use `asyncio.Lock` if strict correctness is needed.

#### L-2: `risk_engine.py` (legacy) calls `self.db.commit()` directly
- **File:** `app/services/risk_engine.py`
- **Line:** ~multiple
- **Issue:** The legacy engine commits directly, bypassing the request-level transaction managed by `get_db()`. Can cause partial commits on error.
- **Fix:** Delete the legacy file or use `flush()` only.

#### L-3: `test_engine` created unconditionally at import time
- **File:** `app/database.py`
- **Line:** 49-52
- **Issue:** `test_engine = create_async_engine(...)` runs on every import, even in production. Minor overhead.
- **Fix:** Move to test-only module or lazy creation.

#### L-4: `BlockscoutService._request` re-creates semaphore on fallback path
- **File:** `app/services/blockscout_service.py`
- **Line:** 159-162
- **Issue:** `_get_semaphore()` creates a new Semaphore if `self._semaphore is None`. Under race conditions, multiple semaphores could be created.
- **Fix:** Use `asyncio.Lock` around semaphore creation.

#### L-5: `monitor.py` auth cleanup with `del` does not actually clear memory
- **File:** `app/controllers/monitor.py`
- **Line:** 139-145
- **Issue:** `del auth_msg, auth_data, api_key` only removes local variable references. CPython's string interning and garbage collection mean the API key string may remain in memory.
- **Fix:** This is a best-effort defense; for true security, use `bytearray` and zero-fill, or accept the limitation.

#### L-6: `monitor.py` `_pending_auth_count` decremented only in `finally`
- **File:** `app/controllers/monitor.py`
- **Line:** 200-203
- **Issue:** If the client disconnects before `finally`, the counter is decremented. But if the server crashes between `accept()` and `finally`, the counter leaks. Very low probability.
- **Fix:** Add periodic reconciliation or use a Redis-backed counter.

#### L-7: `config.py` `DATABASE_URL_SYNC` doesn't use `os.environ` fallback for password
- **File:** `app/config.py`
- **Line:** 50-54
- **Issue:** `DATABASE_URL` uses `os.environ.get("DB_PASSWORD", "")` as fallback, but `DATABASE_URL_SYNC` uses `self.DB_PASSWORD` directly. If DB_PASSWORD is empty string, sync URL has `user:@host` which may fail.
- **Fix:** Apply same fallback logic to sync URL.

#### L-8: `validators.py` `validate_email` is extremely permissive
- **File:** `app/validators.py`
- **Line:** 118-129
- **Issue:** `"a@b.c"` passes. No real email validation.
- **Fix:** Use `email-validator` library or a proper regex.

---

## 2. JWT Implementation — Short Expiry, Refresh Rotation

### ✅ What's Done Well
- **Access token expiry:** 30 minutes (`JWT_EXPIRE_MINUTES = 30`) — good, industry standard.
- **Refresh token rotation:** Implemented with JTI white-listing in Redis, family tracking, and reuse detection.
- **JTI hashing:** Uses HMAC-SHA256 to store hashed JTIs in Redis instead of plaintext.
- **No fallback secret:** Removed hardcoded secrets; raises on missing `SECRET_KEY`.
- **Token type claim:** Both access and refresh tokens include `type` claim.

### 🟠 HIGH

#### H-JWT-1: Access token decoder does not verify `type == "access"`
- **File:** `app/core/security.py`
- **Line:** 189-200
- **Issue:** Refresh tokens can be used as access tokens. See C-2 above.
- **Severity:** HIGH

#### H-JWT-2: Refresh token rotator does not verify `type == "refresh"`
- **File:** `app/core/security.py`
- **Line:** 147-160
- **Issue:** Access tokens can be rotated into refresh tokens. See C-3 above.
- **Severity:** HIGH

#### H-JWT-3: Refresh token TTL is 7 days
- **File:** `app/core/security.py`
- **Line:** 44
- **Issue:** `JWT_REFRESH_EXPIRE_MINUTES = 10080` (7 days) is on the longer side. NIST SP 800-63B recommends refresh tokens "should have a maximum lifetime" but doesn't specify. OWASP recommends "as short as possible" — typically 1-7 days is acceptable with rotation. With proper rotation implemented, 7 days is borderline but acceptable.
- **Recommendation:** Consider reducing to 1-3 days for higher-security deployments.

### 🟡 MEDIUM

#### M-JWT-1: Redis fallback disables rotation detection silently
- **File:** `app/core/security.py`
- **Line:** 107-111
- **Issue:** If Redis is unavailable, refresh tokens are still issued and accepted, but rotation/replay detection is disabled. An attacker could replay a stolen refresh token indefinitely.
- **Fix:** Consider requiring Redis for refresh token operations, or implement an in-memory fallback that at least tracks per-process token usage.

---

## 3. Database — SQL Injection Prevention, Proper Indexing

### ✅ What's Done Well
- **SQL injection prevention:** All queries use SQLAlchemy ORM/Expression Language with parameterized queries. No raw SQL string concatenation in repositories.
- **Proper indexing:** Models define indexes on frequently queried columns (`address`, `chain`, `tx_hash`, `risk_score`, `block_timestamp`, etc.).
- **GIN index on tags:** `Index("ix_addresses_tags", "tags", postgresql_using="gin")` enables efficient array queries.
- **Connection pooling:** Configured with `pool_pre_ping=True`, `pool_recycle`, `pool_size`, `max_overflow`.
- **Alembic migrations:** Versioned migrations exist for schema management.

### 🟡 MEDIUM

#### M-DB-1: `AddressRepository.search()` manual LIKE escaping
- **File:** `app/repositories/address_repository.py`
- **Line:** 130-134
- **Issue:** Manual escaping `query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")` is error-prone. SQLAlchemy's `like()` with escape is used correctly, but future changes could break this.
- **Fix:** Use SQLAlchemy's `literal_column` or a dedicated sanitization utility.

#### M-DB-2: `TransactionRepository.list()` has no repository-level page_size limit
- **File:** `app/repositories/transaction_repository.py`
- **Line:** 97-118
- **Issue:** The API layer validates `page_size <= 100`, but a direct repository call could pass `page_size=1000000`. Defense in depth missing.
- **Fix:** Add `page_size = min(page_size, 100)` in the repository.

#### M-DB-3: `Address` model `default=dict` for JSON columns
- **File:** `app/models.py`
- **Line:** 88, 115
- **Issue:** `meta_info = Column(JSON, default=dict)` — SQLAlchemy handles callable defaults correctly, but this pattern is sometimes confused with mutable default arguments. Verified safe in current code.
- **Note:** No action needed, but worth monitoring.

#### M-DB-4: Migration `001_initial.py` uses `server_default=sa.text('now()')` for timestamps
- **File:** `alembic/versions/001_initial.py`
- **Line:** Multiple
- **Issue:** `now()` is evaluated at row insertion time on the server. This is fine for `created_at` but for `updated_at`, it requires `onupdate` which is missing in the migration. The model has `onupdate=func.now()` but the migration doesn't.
- **Fix:** Add `server_onupdate=sa.text('now()')` or a trigger for `updated_at` columns in the migration.

### 🟢 LOW

#### L-DB-1: `alembic/env.py` offline mode uses async URL
- **File:** `alembic/env.py`
- **Line:** 25
- **Issue:** See M-12 above. `DATABASE_URL_SYNC` should be used for offline migrations.

---

## 4. Error Handling — Generic Messages to Client, Detailed Server-Side

### ✅ What's Done Well
- **Production error masking:** `general_exception_handler` returns `"An internal error occurred"` in production, with full traceback logged server-side.
- **FidesException structured responses:** Consistent `{"error": {"code": ..., "message": ..., "trace_id": ...}}` format.
- **Trace ID propagation:** `request.state.trace_id` flows through the request lifecycle and into logs.

### 🟠 HIGH

#### H-EH-1: Controller endpoints catch generic `Exception` and raise `HTTPException`
- **File:** `app/controllers/addresses.py`, `transactions.py`, `rules.py`, `monitor.py` (HTTP endpoints)
- **Issue:** All controllers wrap service calls in `try/except Exception: raise HTTPException(...)`. This bypasses the `FidesException` handler in `main.py`, producing inconsistent error response formats. FastAPI's native HTTPException format (`{"detail": ...}`) is different from the Fides JSON format.
- **Fix:** Remove the generic `except Exception` blocks in controllers and let exceptions propagate to the global handlers. Only catch `FidesException` to re-raise it.

#### H-EH-2: `auth.py` uses raw `HTTPException` instead of `FidesException`
- **File:** `app/controllers/auth.py`
- **Line:** 134, 178, 206, 228
- **Issue:** Login failures raise `HTTPException` directly. These produce FastAPI's default error format instead of the structured Fides format.
- **Fix:** Use `AuthenticationException` (or a new `LoginException`) subclass of `FidesException`.

### 🟡 MEDIUM

#### M-EH-1: `verify_api_key` catches all exceptions and returns `False`
- **File:** `app/core/security.py`
- **Line:** 473-476
- **Issue:** Database connectivity issues, Redis failures, or unexpected errors cause all API key requests to fail with a generic "Invalid API key" response. This makes debugging difficult.
- **Fix:** Distinguish between "invalid key" (return False) and "system error" (re-raise or log at ERROR level).

#### M-EH-2: `BlockscoutService._request` doesn't distinguish error types for clients
- **File:** `app/services/blockscout_service.py`
- **Line:** 251-273
- **Issue:** All errors are wrapped in `BlockscoutAPIException` with a string message. Callers can't easily distinguish between 404, 429, 5xx, or network errors.
- **Fix:** Include the original status code in the exception and/or create subclasses.

---

## 5. Logging — Structured JSON, Request ID Propagation, No Secrets in Logs

### ✅ What's Done Well
- **Structured JSON logging:** Uses `structlog` with `JSONRenderer`.
- **Request ID propagation:** Module-level `ContextVar` `_request_id_var` correctly propagates across async contexts.
- **Sensitive data masking:** `mask_sensitive_data()`, `sanitize_log_message()`, and `sanitize_event_dict()` implement multi-layer defense.
- **No secrets in client responses:** Production errors hide details.
- **Safe header logging:** `request_tracing_middleware` scrubs Authorization, X-API-Key, Cookie before logging.

### 🟡 MEDIUM

#### M-LOG-1: Substring matching in sensitive key detection causes over-masking
- **File:** `app/core/security.py` (line ~460), `app/core/logging.py` (line ~57)
- **Issue:** `"tokenized_field"` matches `"token"` and gets masked. `"my_api_keychain"` matches `"api_key"`.
- **Fix:** Use exact token matching: `key_lower.split("_")` intersection with `_SENSITIVE_FIELDS`.

#### M-LOG-2: `AlertService.send_alert` logs payload details at CRITICAL level
- **File:** `app/services/alert_service.py`
- **Line:** 70-78
- **Issue:** `logger.critical("risk_engine_alert", ...)` includes `details=payload["details"]`. If the alert payload ever contains sensitive data (e.g., address, tx_hash), it goes to logs unconditionally. While address/tx_hash are not highly sensitive, in some contexts they could be.
- **Fix:** Apply `mask_sensitive_data()` to the alert payload before logging.

#### M-LOG-3: `request_tracing_middleware` logs query params but doesn't mask all sensitive patterns
- **File:** `app/core/security.py`
- **Line:** 490-500
- **Issue:** The query param masking only checks for `api_key`, `token`, `secret`, `password`, `key`. It misses patterns like `jwt`, `session_id`, `bearer`.
- **Fix:** Expand the sensitive param list or use the same `_SENSITIVE_FIELDS` frozenset.

---

## 6. Async Operations — Error Handling, Retry Logic, Idempotency

### ✅ What's Done Well
- **Retry with backoff:** `tenacity` provides `stop_after_attempt(3)` + `wait_exponential` on Blockscout API calls.
- **Circuit breaker:** Implemented with Redis persistence for multi-instance state sharing.
- **SSRF protection:** URL whitelist on Blockscout endpoints.
- **Semaphore-based concurrency:** `asyncio.Semaphore` limits concurrent Blockscout requests.
- **Graceful Redis degradation:** Rate limiter, cache, and refresh token rotation all have local memory fallbacks.
- **Idempotent cache operations:** `CacheService.get_or_set()` uses distributed locks to prevent cache stampede.

### 🟠 HIGH

#### H-ASYNC-1: `database.py` engine created at import time despite "lazy init" claim
- **File:** `app/database.py`
- **Line:** 43
- **Issue:** See H-7 above. The engine is created at import, defeating the lazy initialization and making testing harder.
- **Fix:** Remove `AsyncSessionLocal = get_async_session_maker()` at module level.

### 🟡 MEDIUM

#### M-ASYNC-1: `lock_manager.py` `acquire_lock` lacks exponential backoff
- **File:** `app/core/lock_manager.py`
- **Line:** 88-111
- **Issue:** Fixed `RETRY_INTERVAL = 0.5` seconds in a while-true loop creates a thundering herd under high contention.
- **Fix:** Use exponential backoff (capped at e.g., 5 seconds).

#### M-ASYNC-2: `message_queue.py` poison pill messages retry indefinitely
- **File:** `app/core/message_queue.py`
- **Line:** 370-395
- **Issue:** See M-9 above. Failed messages are redelivered by Redis Streams without `retry_count` increment. A permanently failing message will be retried until the stream TTL expires.
- **Fix:** Track retry count via Redis Streams' `XPENDING` and consumer idle time, or store retry state in Redis.

#### M-ASYNC-3: `risk_engine_service.py` `analyze_transaction` warns on DB failure but returns success
- **File:** `app/services/risk_engine_service.py`
- **Line:** 323-325
- **Issue:** If `transaction_repo.create()` fails, the analysis result is still returned and cached. The DB and cache become inconsistent.
- **Fix:** Either raise the exception (fail the request) or implement a background retry queue for DB writes.

#### M-ASYNC-4: `blockscout_service.py` `_check_circuit` is not async but called from async context
- **File:** `app/services/blockscout_service.py`
- **Line:** 165-167
- **Issue:** `_check_circuit()` is a sync method that checks `self._circuit_open`. While this is a simple attribute read, the pattern is inconsistent. The `_record_success` and `_record_failure` methods were fixed to be async (P0 fix verified), but `_check_circuit` remains sync.
- **Fix:** For consistency, make it async (low priority since it's just an attribute read).

### 🟢 LOW

#### L-ASYNC-1: `alert_service.py` creates a new `httpx.AsyncClient` per alert
- **File:** `app/services/alert_service.py`
- **Line:** 83-84
- **Issue:** `async with httpx.AsyncClient(timeout=10.0) as client:` creates and destroys a connection pool for every alert. In an alert storm, this is expensive.
- **Fix:** Use a shared client instance or connection pool.

#### L-ASYNC-2: `monitor.py` WebSocket cleanup task in `lifespan` is not monitored for liveness
- **File:** `app/main.py`
- **Line:** 55-71
- **Issue:** The `_websocket_cleanup_loop` task runs in the background. If it crashes permanently (not just one exception), stale connections will never be cleaned up.
- **Fix:** Add a supervisor loop that restarts the cleanup task if it dies.

---

## Appendix: File-by-File Quick Reference

| File | Issues Found | Max Severity |
|------|-------------|--------------|
| `app/main.py` | H-EH-1, H-6, M-11 | HIGH |
| `app/config.py` | L-7 | LOW |
| `app/core/security.py` | C-2, C-3, H-1, H-2, H-8, M-1, M-3, M-7, M-LOG-3 | CRITICAL |
| `app/core/middleware.py` | — | — |
| `app/core/logging.py` | M-1 | MEDIUM |
| `app/core/exceptions.py` | — | — |
| `app/core/di.py` | — | — |
| `app/core/lock_manager.py` | M-8, M-ASYNC-1 | MEDIUM |
| `app/core/message_queue.py` | M-9, M-ASYNC-2 | MEDIUM |
| `app/database.py` | H-7, L-3 | HIGH |
| `app/models.py` | M-DB-3 | MEDIUM |
| `app/validators.py` | M-2, M-5, L-8 | MEDIUM |
| `app/schemas.py` | M-5 | MEDIUM |
| `app/cache.py` | — | — |
| `app/controllers/auth.py` | H-EH-2, M-3, M-4 | HIGH |
| `app/controllers/addresses.py` | H-EH-1, M-DB-1 | HIGH |
| `app/controllers/transactions.py` | H-EH-1 | HIGH |
| `app/controllers/rules.py` | H-EH-1 | HIGH |
| `app/controllers/monitor.py` | H-1, M-ASYNC-2, L-5, L-6 | HIGH |
| `app/services/risk_engine_service.py` | M-ASYNC-3 | MEDIUM |
| `app/services/risk_engine.py` | H-5, L-2 | HIGH |
| `app/services/blockscout_service.py` | M-6, M-ASYNC-4, L-4 | MEDIUM |
| `app/services/cache_service.py` | C-1, M-10 | CRITICAL |
| `app/services/alert_service.py` | M-LOG-2, L-ASYNC-1 | MEDIUM |
| `app/services/risk_sync_service.py` | — | — |
| `app/services/websocket_manager.py` | — | — |
| `app/repositories/address_repository.py` | H-3, M-DB-1 | HIGH |
| `app/repositories/transaction_repository.py` | M-DB-2 | MEDIUM |
| `app/repositories/rule_repository.py` | — | — |
| `alembic/env.py` | M-12, L-DB-1 | MEDIUM |
| `alembic/versions/001_initial.py` | M-DB-4 | MEDIUM |
| `tests/conftest.py` | — | — |
| `tests/test_api.py` | — | — |
| `tests/test_cache.py` | — | — |
| `tests/test_p2p3_fixes.py` | H-4 | HIGH |
| `tests/test_lock_and_queue.py` | — | — |
| `tests/test_risk_engine.py` | — | — |
| `tests/test_migrations.py` | — | — |
| `tests/test_api_pending.py` | — | — |

---

## Recommended Priority Order for Fixes

1. **CRITICAL:** Fix C-1 (`CacheService.get()` double decode) — breaks production cache
2. **CRITICAL:** Fix C-2 and C-3 (JWT type verification) — token type bypass
3. **HIGH:** Fix H-1 (WebSocket localhost in production) — CORS bypass
4. **HIGH:** Fix H-7 (database.py lazy init bypass) — import-time side effects
5. **HIGH:** Fix H-EH-1 (controller exception handling inconsistency) — API contract breakage
6. **HIGH:** Fix H-2 (request signature on GET sensitive paths) — replay attack vector
7. **MEDIUM:** Fix M-1 (substring matching in log masking) — potential over-masking/under-masking
8. **MEDIUM:** Fix M-9 (message queue poison pill) — infinite retry loop
9. **MEDIUM:** Fix M-ASYNC-3 (analyze_transaction DB inconsistency) — data integrity
