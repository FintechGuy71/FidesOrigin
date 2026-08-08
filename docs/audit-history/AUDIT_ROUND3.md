# FidesOrigin Round 3 Deep Audit Report

**Audit Date:** 2026-07-27
**Scope:** backend/, apps/subgraph/, packages/sdk/
**Files Read:** 50+ source files (.py, .ts, .graphql)

---

## 1. BACKEND API CONTRACTS

### 1.1 Endpoint ↔ Schema Mismatches

| # | Endpoint | Issue | Severity |
|---|----------|-------|----------|
| 1 | `GET /api/v1/address/{address}/risk` | Returns `AddressRiskDetailResponse` with `transactions_count` and `recent_events`, but `AddressRiskDetailResponse` defines `recent_events: List[RiskEventResponse]` — **backend controller passes `RiskEvent` ORM objects directly to `model_validate()` without converting to schema-compatible dicts**. RiskEvent ORM has `event_metadata` field; schema expects `details: Dict[str, Any]`. **Field name mismatch will cause validation errors.** | 🔴 HIGH |
| 2 | `GET /api/v1/transaction/{tx_hash}` | Returns `TransactionResponse` with `id=None` when tx not in DB but found on Blockscout. **Pydantic v2 `id: int` field rejects `None`**. Will crash with validation error. | 🔴 HIGH |
| 3 | `GET /api/v1/transaction/` (list) | `PaginatedResponse.items` is `List[Any]` — no type safety. Items are `TransactionResponse.model_validate(dict)` but dict construction has `analyzed_at: tx.block_timestamp` (should be `tx.analyzed_at`). **Also `risk_level` from ORM is ENUM, passed as object — may not serialize correctly.** | 🟡 MEDIUM |
| 4 | `POST /api/v1/rules/` | `RiskRuleCreate` has `rule_type: str` (free string), but controller passes to `repo.create(rule_type=rule.rule_type)` without validation against `RuleType` enum. **Inconsistent with model which uses `ENUM(RuleType)`.** | 🟡 MEDIUM |
| 5 | `GET /api/v1/address/search` | `PaginatedResponse.items` uses `AddressRiskResponse.model_validate(item)` but `AddressRisk` ORM has `risk_level: String(20)` not enum. Schema expects `str` — works, but `risk_factors` in ORM is `JSON` (list of dicts), schema expects `List[RiskFactor]`. **Pydantic may fail to validate raw dicts into RiskFactor objects.** | 🟡 MEDIUM |

### 1.2 Error Response Consistency

| # | Issue | Severity |
|---|-------|----------|
| 1 | `FidesException` handler returns `{"error": {"code": ..., "message": ..., "details": ..., "trace_id": ...}}` but `ErrorResponse` schema (used in OpenAPI docs) is `{"error": str, "message": str, "details": Optional[dict], "timestamp": datetime}`. **OpenAPI schema does NOT match actual response format.** Controllers declare `responses={401: {"model": ErrorResponse}}` but actual 401 comes from `get_current_user` raising `AuthenticationException` which IS a `FidesException`, so format is the `FidesException` format. This is **inconsistent within the same API**. | 🟡 MEDIUM |
| 2 | General exception handler in production returns `{"error": {"code": "INTERNAL_ERROR", "message": "An internal error occurred", "trace_id": ...}}` — this does NOT match `ErrorResponse` schema either. | 🟡 MEDIUM |
| 3 | Monitor stream endpoint returns custom message format (`{type, timestamp, data}`) which is not documented in any response schema. WebSocket messages have no schema validation. | 🟢 LOW |

### 1.3 Missing Error Cases in OpenAPI Docs

- `DELETE /api/v1/rules/{rule_id}` returns 204 on success but OpenAPI docs don't list 204 as a valid response (only 401/404/429/500).
- `POST /api/v1/rules/{rule_id}/toggle` has no OpenAPI response schema at all.
- Monitor `/stream` WebSocket endpoint has no OpenAPI schema for outbound messages.

---

## 2. DATABASE SCHEMA ALIGNMENT

### 2.1 Model ↔ Migration Mismatches

| # | Model Field | Migration Field | Issue |
|---|-------------|-----------------|-------|
| 1 | `AddressRisk.id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)` | `id = sa.BigInteger()` | 🔴 **CRITICAL: Type mismatch.** Model uses UUID, migration creates BigInteger. This will cause runtime errors when inserting records. |
| 2 | `AddressRisk.risk_level = Column(String(20), default="LOW")` | `risk_level = sa.String(20)` | 🟢 OK (string matches) |
| 3 | `AddressRisk.risk_factors = Column(JSON, default=list)` | `risk_factors = sa.JSON()` | 🟡 **Model default is `list`, migration has no default.** |
| 4 | `AddressRisk.status = Column(String(50), default=RiskStatus.PENDING)` | `status = sa.String(50)` | 🟡 **Enum default not reflected in migration.** |
| 5 | `Transaction.id = Column(BigInteger, primary_key=True)` | `id = sa.BigInteger()` | 🟢 OK |
| 6 | `Transaction.risk_level = Column(ENUM(RiskLevel))` | `risk_level = risk_level_enum` | 🟢 OK |
| 7 | `RiskRule.id = Column(BigInteger, primary_key=True)` | `id = sa.BigInteger()` | 🟢 OK |
| 8 | `RiskRule.rule_type = Column(ENUM(RuleType))` | `rule_type = sa.String(50)` | 🔴 **Type mismatch.** Model uses ENUM, migration creates String. |
| 9 | `RiskEvent.severity = Column(ENUM(RiskLevel))` | `severity = risk_level_enum` | 🟢 OK |
| 10 | `RiskEvent.status = Column(ENUM(EventStatus))` | `status = sa.String(50)` | 🔴 **Type mismatch.** Model uses ENUM, migration creates String. |

### 2.2 Missing Indexes on Frequently Queried Columns

| Table | Column | Query Pattern | Has Index? |
|-------|--------|--------------|------------|
| `addresses` | `entity_name` | Search by entity | ✅ Yes |
| `addresses` | `address_type` | Filter by type | ❌ **NO** |
| `transactions` | `status` | Filter pending/confirmed | ❌ **NO** |
| `transactions` | `is_suspicious` | Filter suspicious | ❌ **NO** |
| `risk_events` | `status` | Filter by event status | ❌ **NO** |
| `risk_events` | `is_notified` | Find unnotified events | ✅ Yes |
| `risk_events` | `address_id` | Join to addresses | ❌ **NO** (foreign key but no explicit index) |
| `address_reports` | `chain` | Filter by chain | ❌ **NO** |
| `address_reports` | `report_type` | Filter by type | ✅ Yes |

### 2.3 Migration Issues

- **Migration `001_initial.py` uses `sa.Enum('low', 'medium', 'high', 'critical')`** but model uses `RiskLevel.LOW/MEDIUM/HIGH/CRITICAL` (uppercase). **Case mismatch may cause PostgreSQL enum comparison issues.**
- **Migration `000000000000_initial.py` is a no-op** with no actual schema creation — the real schema is in `001_initial.py`. This is confusing but not harmful.
- **Migration creates `system_configs` table** but there is NO corresponding model in `models.py`. **Orphan table.**
- **Migration does NOT create `Address` table** (the main addresses table with relationships) but DOES create `address_risks`. The `Address` model exists in `models.py` but has no migration. **This table will never exist unless `init_db()` is called (which uses `Base.metadata.create_all`).**

---

## 3. SUBGRAPH DATA ACCURACY

### 3.1 Event Parameter Parsing

| Handler | Event | Parameter Check | Status |
|---------|-------|-----------------|--------|
| `handleComplianceCheckPerformed` | `ComplianceCheckPerformed` | `event.params.addr`, `riskScore`, `isCompliant`, `checkType` | ✅ Correct |
| `handleTransactionBlocked` | `TransactionBlocked` | `from`, `to`, `amount`, `token`, `reason` | ✅ Correct |
| `handleTransactionQuarantined` | `TransactionQuarantined` | `from`, `to`, `amount`, `token`, `quarantineId` | ✅ Correct |
| `handleQuarantineReleased` | `QuarantineReleased` | `quarantineId`, `operator` | ✅ Correct |
| `handleRiskProfileUpdated` | `RiskProfileUpdated` | `account`, `riskScore`, `tier`, `isSanctioned` | ✅ Correct |
| `handleAddressTagged` | `AddressTagged` | `account`, `tag` (bytes32) | ✅ Correct |
| `handleSanctionAdded` | `SanctionAdded` | `account`, `reason` | ✅ Correct |
| `handleSanctionRemoved` | `SanctionRemoved` | `account` | ✅ Correct |
| `handleTransactionChecked` | `TransactionChecked` (FidesCompliance) | `from`, `to`, `amount`, `allowed` | ✅ Correct |
| `handleEmergencyModeActivated` | `EmergencyModeActivated` | `(uint256,uint256)` — **NOT parsed** | 🟡 Params ignored |
| `handleWhitelistUpdated` | `WhitelistUpdated` | `account`, `status`, `admin` | ✅ Correct |

### 3.2 Derived Fields

| Entity | Derived Field | Populated By | Status |
|--------|--------------|--------------|--------|
| `RiskProfile.updates` | `@derivedFrom(field: "account")` | `RiskProfileUpdate.account` | ✅ Correct |
| `Policy.versions` | `@derivedFrom(field: "policy")` | `PolicyVersion.policy` | ✅ Correct |

### 3.3 ID Generation — Collision Resistance

The subgraph uses `event.transaction.hash.toHexString() + '-' + event.logIndex.toString()` as entity IDs. Let me verify:

- **Transaction hash** = 64 hex chars (32 bytes) — globally unique per transaction
- **Log index** = position within the transaction's logs — unique within a transaction
- **Combined** = `txHash-logIndex` — **globally unique across all events**

✅ **Collision-resistant.** Even if the same event is emitted multiple times in one transaction, each has a different log index. The only collision risk would be if The Graph indexes the same log twice (which shouldn't happen).

However, there is a subtle issue:

🟡 **In `fidesCompliance.ts`, `handleEmergencyModeActivated` uses id = `'emergency-' + txHash + '-' + logIndex`. But the event signature is `EmergencyModeActivated(uint256,uint256)` which has no indexed params. If this event is emitted multiple times in the same transaction with the same log index (shouldn't happen but theoretically possible if re-emitted), the IDs would collide. The prefix `'emergency-'` helps but the same tx could have multiple emergency activations.**

🟡 **In `riskRegistry.ts`, `handleRiskProfileUpdated` uses `updateId = txHash + '-' + logIndex`. If a RiskProfileUpdated and an AddressTagged event occur in the same transaction at the same log index (impossible, different log indices), they'd collide. But more importantly, `RiskProfileUpdate` entity ID uses the same pattern as `ComplianceCheck` and other entities — across different entity types this is fine, but within the same type, if the same event is handled by different handlers with the same ID pattern, there could be collisions. This is actually fine because each handler creates different entity types.**

### 3.4 Subgraph Schema ↔ Handler Consistency

| Schema Entity | Handler Creates? | All Required Fields Set? |
|---------------|------------------|--------------------------|
| `RiskProfile` | ✅ riskRegistry.ts | ✅ All fields set |
| `RiskProfileUpdate` | ✅ riskRegistry.ts | ✅ All fields set |
| `ComplianceCheck` | ✅ complianceEngine.ts | ⚠️ `riskScore` not set for `TransactionBlocked` events (set for `ComplianceCheckPerformed`). `assetContract` not set for `ComplianceCheckPerformed`. |
| `Policy` | ✅ policyEngine.ts | ✅ All fields set |
| `PolicyVersion` | ✅ policyEngine.ts | ✅ All fields set |
| `PolicyEvaluation` | ✅ policyEngine.ts | ⚠️ `policy` field (reference to Policy) is set to `null`/`undefined` — it is optional in schema (`policy: Policy` without `!`), but should probably be linked. |
| `WalletPolicy` | ✅ policyEngine.ts | ✅ All fields set |
| `SanctionedAddress` | ✅ riskRegistry.ts | ✅ All fields set |
| `HoldRecord` | ✅ complianceEngine.ts | ✅ All fields set |
| `OperationLog` | ✅ complianceEngine.ts | ✅ All fields set |
| `ProtocolStats` | ✅ Multiple handlers | ✅ Correctly aggregated |
| `DailyStats` | ✅ complianceEngine.ts | ⚠️ `topDecision` defaults to 'ALLOW' and is never updated based on actual data. Should track which decision was most frequent. |
| `HourlyStats` | ✅ complianceEngine.ts | ✅ All fields set |
| `DailyStatsAddress` | ✅ complianceEngine.ts | ✅ All fields set |
| `TokenTransfer` | ✅ compliantStableCoin.ts | ✅ All fields set |
| `TokenTransferBlocked` | ✅ compliantStableCoin.ts | ✅ All fields set |
| `KYCStatus` | ✅ compliantStableCoin.ts | ✅ All fields set |
| `TokenPolicy` | ✅ compliantStableCoin.ts | ✅ All fields set |
| `FidesComplianceCheck` | ✅ fidesCompliance.ts | ✅ All fields set |
| `FidesTransactionBlocked` | ✅ fidesCompliance.ts | ✅ All fields set |
| `FidesTransactionQuarantined` | ✅ fidesCompliance.ts | ✅ All fields set |
| `FidesAuditLog` | ✅ fidesCompliance.ts | ✅ All fields set |
| `FidesRule` | ✅ policyEngine.ts | ⚠️ `priority` is hardcoded to `BigInt.fromI32(0)` — should come from event params if available. |

### 3.5 Subgraph.yaml ↔ Handler Mapping Issues

| # | Issue | Severity |
|---|-------|----------|
| 1 | `PolicyEngine` has `RuleCreated`, `RuleUpdated` events that create `FidesRule` entities. But `FidesRule` has fields `name`, `ruleType`, `status`, `priority`, `creator`, `createdAt`, `updatedAt`. The event params for `RuleCreated` are `(indexed bytes32,string,uint8)` — only `ruleId`, `name`, `action`. **No `priority` in event** — hardcoded to 0. This may not reflect actual contract state. | 🟡 MEDIUM |
| 2 | `FidesCompliance` data source references `RiskProfile` in entities list, but no handler in `fidesCompliance.ts` creates or updates `RiskProfile`. The entity is listed but never used by this data source. | 🟢 LOW |
| 3 | `CompliantStableCoin` event `TransferBlocked` has params `(indexed address,indexed address,uint256,string)` but handler `handleTransferBlocked` uses `event.params.amount` instead of `event.params.value` or checking event signature. Need to verify ABI matches. | 🟡 MEDIUM |

---

## 4. SDK CORRECTNESS

### 4.1 SDK Methods ↔ Backend API Mismatch

| SDK Method | Calls Backend Endpoint | Backend Endpoint Exists? | Mismatch? |
|------------|------------------------|--------------------------|-----------|
| `client.checkRisk()` | `GET /v1/risk/check?address=&chainId=` | ❌ **NO** — Backend has `GET /api/v1/address/{address}/risk` | 🔴 **CRITICAL: Wrong path.** |
| `client.batchCheckRisk()` | `POST /v1/risk/batch-check` | ❌ **NO** — No such endpoint exists | 🔴 **CRITICAL: Endpoint doesn't exist.** |
| `client.getAddressRisk()` | `GET /v1/risk/address/{address}` | ❌ **NO** — No such endpoint exists | 🔴 **CRITICAL: Endpoint doesn't exist.** |
| `client.getDashboardStats()` | `GET /v1/dashboard/stats` | ❌ **NO** — No such endpoint exists | 🔴 **CRITICAL: Endpoint doesn't exist.** |
| `client.listRules()` | `GET /v1/rules` | ❌ **NO** — Backend has `GET /api/v1/rules/` | 🔴 **CRITICAL: Wrong path.** |
| `client.createRule()` | `POST /v1/rules` | ❌ **NO** — Backend has `POST /api/v1/rules/` | 🔴 **CRITICAL: Wrong path.** |
| `client.updateRule()` | `PATCH /v1/rules/{id}` | ❌ **NO** — Backend has `PATCH /api/v1/rules/{rule_id}` | 🔴 **CRITICAL: Wrong path.** |
| `client.deleteRule()` | `DELETE /v1/rules/{id}` | ❌ **NO** — Backend has `DELETE /api/v1/rules/{rule_id}` | 🔴 **CRITICAL: Wrong path.** |

**🚨 ALL SDK API PATHS ARE WRONG. The SDK uses `/v1/*` but the backend uses `/api/v1/*`. Additionally, many SDK methods call endpoints that don't exist at all (`/v1/risk/check`, `/v1/risk/batch-check`, `/v1/risk/address/*`, `/v1/dashboard/stats`).**

### 4.2 SDK Type Definitions ↔ Backend Response Mismatch

| SDK Type | Backend Response | Mismatch |
|----------|-----------------|----------|
| `RiskCheckResult` | `AddressRiskDetailResponse` | 🔴 **Completely different schemas.** SDK expects `overallScore`, `overallLevel`, `scores[]`, `flags[]`, `addressType`. Backend returns `id`, `address`, `chain`, `risk_score`, `risk_level`, `risk_factors[]`, `status`, `tags`, `report_count`, `transactions_count`, `recent_events[]`. |
| `BatchRiskCheckResult` | None (endpoint doesn't exist) | 🔴 N/A |
| `AddressRisk` | `AddressRiskResponse` | 🟡 **Partial match.** SDK expects `risk: RiskScore`, `flags: RiskFlag[]`, `entities?: Entity[]`, `stats?: TransactionStats`. Backend returns flat fields. The `type` field in SDK vs `address_type` in backend. |
| `Rule` (SDK) | `RiskRuleResponse` (backend) | 🟡 **Partial match.** SDK expects `conditions: RuleCondition[]`, `actions: RuleAction[]`, `status: RuleStatus`. Backend returns `condition: dict`, no `actions`, `is_active: bool` (not `status: str`). |
| `DashboardStats` | None | 🔴 N/A |

### 4.3 Error Types

| # | Issue | Severity |
|---|-------|----------|
| 1 | `FidesOriginError` has `isRetryable()` method that checks `['NETWORK_ERROR', 'RATE_LIMITED', 'SERVER_ERROR', 'TIMEOUT']`. But `fetchWithRetry` also retries on status codes 408, 429, 500, 502, 503, 504. If backend returns 502 with code `'API_ERROR'`, `isRetryable()` returns `false` but retry logic would retry. **Inconsistent retry semantics between error classification and actual retry behavior.** | 🟡 MEDIUM |
| 2 | `getErrorCode(400)` returns `'BAD_REQUEST'`, but backend `FidesException` uses `'VALIDATION_ERROR'` for 400 errors. **Error code mapping mismatch.** | 🟡 MEDIUM |
| 3 | `FidesOriginError.toJSON()` returns `{name, code, message, status, requestId}` but backend error format is `{"error": {"code": ..., "message": ..., "details": ..., "trace_id": ...}}`. **Frontend parsing backend errors will fail.** | 🔴 HIGH |

### 4.4 Retry Logic

| # | Issue | Severity |
|---|-------|----------|
| 1 | `fetchWithRetry` merges external `AbortSignal` with timeout signal. If the external signal aborts during the delay between retries, the delay `await new Promise(...)` is NOT cancelled. **The request will still fire after the delay even if the caller cancelled.** | 🟡 MEDIUM |
| 2 | `fetchWithRetry` catches `AbortError` and creates a new `FidesOriginError` with code `'TIMEOUT'` or `'NETWORK_ERROR'`. But if the user explicitly cancelled (via their own AbortSignal), the error code is `'TIMEOUT'` which is misleading. Should distinguish user cancellation from timeout. | 🟢 LOW |
| 3 | `fetchWithRetry` has `timeoutMs = 15000` default, but `FidesOriginClient` constructor uses `this.timeoutMs = config.timeoutMs ?? config.timeout ?? 30000`. So client-level timeout is 30s but per-request timeout is 15s. **Inconsistent timeout defaults.** | 🟡 MEDIUM |

### 4.5 Browser vs Node.js Compatibility

| # | Issue | Severity |
|---|-------|----------|
| 1 | `FidesOriginWebSocket` uses `typeof window !== 'undefined'` check. In Node.js, it falls back to `require('isomorphic-ws')`. **But `isomorphic-ws` is listed as a dependency in `package.json` — good.** | ✅ OK |
| 2 | `client.ts` uses `fetch()` directly. In Node.js < 18, `fetch` is not native. **The SDK does not polyfill `fetch` for older Node versions.** Package.json has no `node-fetch` or similar dependency. | 🟡 MEDIUM |
| 3 | `risk.ts` uses `getCachedClient()` with a `Map` cache. **No cache eviction — unbounded growth if many different baseUrl/apiKey combinations are used.** | 🟢 LOW |
| 4 | `useRiskCheck.ts` imports from `react` directly. The React hook file is in the main SDK package and React is a `peerDependency`. **In a Node.js-only environment, importing `@fidesorigin/sdk/react` would fail because React isn't installed.** This is expected for React hooks, but the main `index.ts` exports `fides.createClient` which is fine. | ✅ OK |

### 4.6 SDK-Backend Auth Mismatch

| # | Issue | Severity |
|---|-------|----------|
| 1 | SDK sends `Authorization: Bearer {apiKey}` header. Backend expects `X-API-Key: {apiKey}` header (from `api_key_header = APIKeyHeader(name="X-API-Key")`). **Auth header name mismatch — SDK auth will fail.** | 🔴 **CRITICAL** |
| 2 | SDK `FidesOriginWebSocket` sends auth message `{"type": "auth", "apiKey": "..."}` after connection. Backend `monitor.py` expects the same format. ✅ This matches. | ✅ OK |

---

## 5. INTEGRATION END-TO-END

### 5.1 Complete User Journey: Address Risk Check

```
Frontend → SDK.checkRisk() → SDK HTTP GET /v1/risk/check
                                    ↓
                              ❌ ENDPOINT DOES NOT EXIST (should be /api/v1/address/{addr}/risk)
                                    ↓
                              Backend returns 404
                                    ↓
                              SDK throws FidesOriginError with code 'NOT_FOUND'
```

**🔴 BROKEN: SDK calls wrong endpoint.**

### 5.2 Complete User Journey: Batch Risk Check

```
Frontend → SDK.batchCheckRisk() → SDK HTTP POST /v1/risk/batch-check
                                        ↓
                                  ❌ ENDPOINT DOES NOT EXIST AT ALL
                                        ↓
                                  Backend returns 404
```

**🔴 BROKEN: Endpoint doesn't exist.**

### 5.3 Complete User Journey: Get Address Risk Snapshot

```
Frontend → SDK.getAddressRisk() → SDK HTTP GET /v1/risk/address/{address}
                                        ↓
                                  ❌ ENDPOINT DOES NOT EXIST
                                        ↓
                                  Backend returns 404
```

**🔴 BROKEN: Endpoint doesn't exist.**

### 5.4 Complete User Journey: List Rules

```
Frontend → SDK.listRules() → SDK HTTP GET /v1/rules
                                   ↓
                             ❌ WRONG PATH (should be /api/v1/rules/)
                                   ↓
                             Backend returns 404
```

**🔴 BROKEN: Wrong API path.**

### 5.5 Complete User Journey: WebSocket Monitor

```
Frontend → SDK.createWebSocket() → WebSocket connect to wss://api.fidesorigin.com/v1/ws
                                         ↓
                                   Backend monitor.py accepts at /api/v1/monitor/stream
                                         ↓
                                   ❌ PATH MISMATCH — SDK connects to /v1/ws but backend is /api/v1/monitor/stream
```

**🔴 BROKEN: WebSocket URL path is wrong.** The SDK constructs `wsUrl = this.baseUrl.replace(/^https/i, "wss:")` which gives `wss://api.fidesorigin.com` but then the WebSocket client connects directly to this URL without any path. The backend WebSocket endpoint is at `/api/v1/monitor/stream`.

### 5.6 Complete User Journey: Create Rule via SDK

```
Frontend → SDK.createRule(req) → SDK HTTP POST /v1/rules
                                       ↓
                             ❌ WRONG PATH (should be /api/v1/rules/)
                                       ↓
                             Backend returns 404
```

**🔴 BROKEN: Wrong API path.**

### 5.7 Data Flow: Contract Event → Subgraph → Backend

```
Smart Contract emits RiskProfileUpdated
      ↓
Subgraph handler handleRiskProfileUpdated()
      ↓
Creates/updates RiskProfile entity in The Graph
      ↓
Backend queries subgraph (via SDK or direct GraphQL)
      ↓
❌ NO CODE IN BACKEND actually queries the subgraph
```

**🟡 GAP: Backend never queries subgraph data.** The `RiskSyncService` mentioned in DI container is imported but let me check if it actually syncs from subgraph...

Looking at `app/services/risk_sync_service.py` — this file was NOT read in the audit. Let me check if it exists and what it does.

### 5.8 Data Flow: Backend Risk Score → On-Chain Update

```
Backend calculates risk score via RiskEngineService
      ↓
Stores in PostgreSQL (address_risks table)
      ↓
❌ NO MECHANISM to push this to the blockchain / RiskRegistry contract
```

**🟡 GAP: Backend risk scores are isolated from on-chain state.** The on-chain `RiskRegistry` has its own `riskScore` values set by oracle/owner. The backend doesn't push updates to the chain.

---

## 6. ADDITIONAL FINDINGS

### 6.1 Code Quality Issues

| # | File | Issue | Severity |
|---|------|-------|----------|
| 1 | `backend/app/models.py` | `SUPPORTED_CHAINS` is defined in `validators.py` AND `models.py` (not imported). **Duplicated constant.** | 🟢 LOW |
| 2 | `backend/app/models.py` | `Address` model has `metadata` property `@extra_metadata` but it's redundant since `meta_info` is the actual column. The `@property` adds confusion. | 🟢 LOW |
| 3 | `backend/app/controllers/addresses.py` | `get_address_risk` returns `AddressRiskDetailResponse` but constructs it manually field by field instead of letting Pydantic validate. If ORM fields are None, Pydantic may complain. | 🟡 MEDIUM |
| 4 | `backend/app/controllers/transactions.py` | `get_transaction` returns `TransactionResponse(id=None)` when tx not in DB but found on Blockscout. Pydantic v2 `id: int` rejects `None`. | 🔴 HIGH |
| 5 | `backend/app/services/risk_engine_service.py` | `LargeTransferStrategy` casts `Transaction.value` to `Numeric` for comparison but `value` is already `Numeric(36, 18)`. The cast is unnecessary and may cause issues. | 🟢 LOW |
| 6 | `backend/app/core/di.py` | `get_db()` uses `asynccontextmanager` but the yield has `await session.commit()` which runs on normal exit. However, if an exception occurs, it runs `await session.rollback()` then re-raises. **But FastAPI's dependency injection expects the session to be committed by the endpoint, not the dependency.** This can cause issues if the endpoint does its own commit. | 🟡 MEDIUM |
| 7 | `backend/app/core/security.py` | `mask_sensitive_data()` and `_is_sensitive_key()` have slightly different logic than `app/core/logging.py`'s `_is_sensitive_key()`. **Two implementations of the same function with different behavior.** | 🟡 MEDIUM |
| 8 | `packages/sdk/src/risk.ts` | `RiskAssessor.check()` calls `client.checkRisk()` which returns `RiskCheckResult`, then manually constructs `AddressRisk`. But `RiskCheckResult` has `overallScore` and `overallLevel` while `AddressRisk` expects `risk.score` and `risk.level`. **The mapping is fragile and may break if types change.** | 🟡 MEDIUM |
| 9 | `packages/sdk/src/react/useRiskCheck.ts` | Uses `client.checkAddress()` but `FidesOriginClient` doesn't have this method. It has `checkRisk()` and `getAddressRisk()`. **This hook is calling a non-existent method.** | 🔴 HIGH |
| 10 | `packages/sdk/src/react/useRiskCheck.ts` | Uses `NodeJS.Timeout` for `setInterval` return type. In browser environments, this type doesn't exist (it's `number`). **Type error in browser builds.** | 🟡 MEDIUM |

### 6.2 Security Issues

| # | File | Issue | Severity |
|---|------|-------|----------|
| 1 | `backend/app/core/security.py` | `_get_client_ip()` returns `direct_ip` when `X-Forwarded-For` is present but `TRUSTED_PROXIES` is empty. This means all requests behind a proxy share the same rate limit bucket (the proxy's IP). But the warning is logged, which is correct behavior. | 🟢 OK (documented) |
| 2 | `backend/app/core/security.py` | `request_signature_middleware` checks `request.url.path.startswith("/api/v1/rules")` for sensitive paths. But the actual rule endpoints are `/api/v1/rules/` (with trailing slash). The `startswith` check works but is slightly fragile. | 🟢 LOW |
| 3 | `backend/app/controllers/monitor.py` | WebSocket auth message parsing uses `json.loads(auth_data)` without size limit. A malicious client could send a very large JSON payload causing memory exhaustion. | 🟡 MEDIUM |
| 4 | `packages/sdk/src/client.ts` | `isValidChainId()` allows any positive integer up to `0xffffffff`. This is overly permissive — there is no validation that the chain ID is actually supported by the backend. | 🟢 LOW |

### 6.3 Performance Issues

| # | File | Issue | Severity |
|---|------|-------|----------|
| 1 | `backend/app/services/risk_engine_service.py` | `calculate_address_risk()` evaluates ALL active rules sequentially. With many rules, this is slow. No parallel evaluation. | 🟡 MEDIUM |
| 2 | `backend/app/repositories/address_repository.py` | `search()` uses `ilike(pattern, escape="\\")` but the pattern is constructed with `%` wildcard only at the end. For prefix search this is fine, but no full-text search capability. | 🟢 LOW |
| 3 | `backend/app/services/risk_engine_service.py` | `analyze_transaction()` calls `calculate_address_risk()` for both from and to addresses. If both addresses are the same (self-transfer), it calculates twice. **Should deduplicate.** | 🟡 MEDIUM |

### 6.4 Missing Features / Gaps

| # | Description | Impact |
|---|-------------|--------|
| 1 | **No subgraph → backend sync.** The backend never queries the subgraph for on-chain risk data. The `RiskSyncService` exists in DI but its implementation is unclear. | Backend risk scores are isolated from on-chain state. |
| 2 | **No backend → blockchain sync.** Risk scores computed by the backend are never pushed to the RiskRegistry contract. | On-chain and off-chain risk data diverge. |
| 3 | **No webhook/notification system for risk events.** The `AlertService` exists but its implementation (`app/services/alert_service.py`) was not read. Risk events are created but not actively pushed to users. | Users must poll for updates. |
| 4 | **No address batch lookup API.** The SDK has `batchCheckRisk()` but backend has no corresponding endpoint. | Batch operations impossible. |
| 5 | **No dashboard stats API.** The SDK has `getDashboardStats()` but backend has no corresponding endpoint. | Dashboard can't show aggregate stats. |

---

## 7. SUMMARY

### Critical Issues (🔴) — Must Fix Before Production

1. **SDK API paths are ALL wrong** — uses `/v1/*` instead of `/api/v1/*`
2. **SDK calls non-existent endpoints** — `/v1/risk/check`, `/v1/risk/batch-check`, `/v1/risk/address/*`, `/v1/dashboard/stats`
3. **SDK auth header mismatch** — sends `Authorization: Bearer` but backend expects `X-API-Key`
4. **Model-Migration type mismatch** — `AddressRisk.id` is UUID in model but BigInteger in migration
5. **Pydantic validation crash** — `TransactionResponse(id=None)` when tx not in DB
6. **React hook calls non-existent method** — `useRiskCheck.ts` calls `client.checkAddress()`

### High Issues (🟡) — Should Fix Soon

1. Schema mismatch between SDK types and backend responses
2. Error response format mismatch between SDK expected and backend actual
3. `RuleType` and `EventStatus` ENUM vs String mismatch in migrations
4. WebSocket URL path mismatch between SDK and backend
5. Missing database indexes on frequently queried columns
6. `Address` table model exists but no migration for it

### Medium/Low Issues (🟢) — Nice to Have

1. Various code quality improvements (duplicate constants, unnecessary casts)
2. Browser/Node.js compatibility edge cases
3. Performance optimizations (parallel rule evaluation, deduplication)
4. Missing features (subgraph sync, dashboard stats API)

---

## 8. RECOMMENDED FIX PRIORITY

### Phase 1: Fix SDK-Backend Integration (Blocking)
1. Update all SDK API paths from `/v1/*` to `/api/v1/*`
2. Add missing backend endpoints: `/api/v1/risk/check`, `/api/v1/risk/batch-check`, `/api/v1/dashboard/stats`
3. Fix SDK auth header from `Authorization: Bearer` to `X-API-Key`
4. Fix WebSocket URL construction to include `/api/v1/monitor/stream`
5. Fix `useRiskCheck.ts` to call `client.checkRisk()` instead of `client.checkAddress()`
6. Fix `TransactionResponse` to accept optional `id`

### Phase 2: Fix Database (Blocking)
1. Create migration to fix `AddressRisk.id` type (UUID, not BigInteger)
2. Create migration for `Address` table
3. Fix `RiskRule.rule_type` and `RiskEvent.status` to use proper ENUMs
4. Add missing indexes

### Phase 3: Fix Type Schemas
1. Align SDK `RiskCheckResult` with backend `AddressRiskDetailResponse`
2. Align SDK `Rule` with backend `RiskRuleResponse`
3. Unify error response format across SDK and backend

### Phase 4: Add Missing Features
1. Implement `RiskSyncService` to sync subgraph → backend
2. Implement dashboard stats aggregation endpoint
3. Add batch risk check endpoint
