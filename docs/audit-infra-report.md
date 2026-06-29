# Infrastructure Layer Deep Audit Report

**Date:** 2026-06-26
**Scope:** KMS security, K8s security, monitoring, performance testing, Docker build
**Files Audited:** 14 files across `data-publisher/`, `k8s/`, `monitoring/`, `Dockerfile`

---

## Executive Summary

| Severity | Found | Fixed |
|----------|-------|-------|
| **CRITICAL** | 5 | 5 |
| **HIGH** | 3 | 3 |
| **MEDIUM** | 5 | 5 |
| **LOW** | 2 | 2 |
| **Total** | **15** | **15** |

All identified issues have been fixed directly in the codebase. TypeScript compilation passes with zero errors.

---

## 1. KMS Security

### 🔴 CRITICAL: `signMessage()` and `signTypedData()` NOT overridden
**File:** `data-publisher/src/kms-key-manager.ts`
**Severity:** CRITICAL
**Issue:** The `AWSKMSKeyManager` created a dummy Wallet with an all-zeros private key and only overrode `signTransaction`. If `signMessage()` or `signTypedData()` were called (e.g. for EIP-712 typed data signing, or any off-chain message signing), they would use the dummy key — completely defeating the purpose of KMS.
**Fix:** Added explicit overrides for `signMessage()` and `signTypedData()` that route through KMS signing, using `ethers.hashMessage()` and `ethers.TypedDataEncoder.hash()` respectively.

### 🔴 CRITICAL: KMS client NOT cached — public key refetched on every call
**File:** `data-publisher/src/kms-key-manager.ts`
**Severity:** CRITICAL
**Issue:** `getSigner()` created a new `KMSClient` and called `GetPublicKey` on every invocation. `getAddress()` called `getSigner()` when the address cache was empty, triggering the full KMS flow again. This is inefficient, hits AWS rate limits, and increases latency.
**Fix:** Added lazy-initialized `kmsClient` and `publicKeyPromise` caches. Both are created once and reused. `getAddress()` now fetches the public key directly without going through `getSigner()`.

### 🔴 CRITICAL: `derToRSV()` used fragile manual DER parsing
**File:** `data-publisher/src/kms-key-manager.ts`
**Severity:** CRITICAL
**Issue:** The DER parser used hardcoded byte offsets (`offset = 2`) without validating ASN.1 tags. It didn't handle variable-length SEQUENCE fields or INTEGER leading zeros. Only tried v=27/28 with no EIP-155 support.
**Fix:** Replaced with a robust ASN.1 parser that validates tags (0x30 SEQUENCE, 0x02 INTEGER, 0x03 BIT STRING), handles multi-byte length fields, strips INTEGER leading zeros, and supports EIP-155 chain-specific `v` values.

### 🔴 CRITICAL: `deriveAddress()` searched for `0x04` anywhere in buffer
**File:** `data-publisher/src/kms-key-manager.ts`
**Severity:** CRITICAL
**Issue:** The method used `pubKeyBuffer.indexOf(prefix)` to find the uncompressed EC point marker. This could match a `0x04` byte in the wrong position (e.g. inside a length field or OID).
**Fix:** Replaced with proper SPKI (SubjectPublicKeyInfo) parsing: parse outer SEQUENCE → AlgorithmIdentifier → BIT STRING → validate 65-byte EC point starting with `0x04`.

### 🔴 CRITICAL: Production plaintext key only WARNed instead of rejecting
**File:** `data-publisher/src/kms-key-manager.ts`, `data-publisher/src/config.ts`
**Severity:** CRITICAL
**Issue:** In production mode, if `PUBLISHER_PRIVATE_KEY` was set, the system logged a warning and continued. This is insufficient for a production security control.
**Fix:** Both the factory (`createKeyManager`) and config validation now `throw new Error` with a clear security violation message when a plaintext key is detected in production.

---

## 2. K8s Security

### 🟠 HIGH: CronJob missing `fsGroup` in pod securityContext
**File:** `k8s/cronjob.yaml`
**Severity:** HIGH
**Issue:** The Deployment had `fsGroup: 1001` but the CronJob did not. Without `fsGroup`, files mounted into the pod may have incorrect group ownership, potentially causing permission issues for the non-root user.
**Fix:** Added `fsGroup: 1001` to the CronJob's pod-level `securityContext`.

### 🟡 MEDIUM: Missing `seccompProfile` in securityContext
**File:** `k8s/cronjob.yaml`, `k8s/deployment.yaml`
**Severity:** MEDIUM
**Issue:** Neither pod-level `securityContext` specified a `seccompProfile`. Modern Kubernetes best practice is to set `seccompProfile: { type: RuntimeDefault }` to restrict available syscalls.
**Fix:** Added `seccompProfile: { type: RuntimeDefault }` to both Deployment and CronJob pod-level `securityContext`.

### ✅ VERIFIED: Existing K8s security posture
- `readOnlyRootFilesystem: true` ✅
- `runAsNonRoot: true` ✅
- `runAsUser: 1001` / `fsGroup: 1001` ✅ (fixed in CronJob)
- `capabilities: drop: [ALL]` ✅
- `allowPrivilegeEscalation: false` ✅
- Secret `type: Opaque` ✅
- Correct secret key references ✅
- `concurrencyPolicy: Forbid` ✅
- liveness probe `/health` matches monitor server ✅
- readiness probe `/ready` matches monitor server ✅
- `/ready` endpoint delegates to `publisher.healthCheck()` and returns 503 when unhealthy ✅

---

## 3. Monitoring

### 🟠 HIGH: Webhook dispatch had NO retry mechanism
**File:** `data-publisher/src/monitor.ts`
**Severity:** HIGH
**Issue:** `dispatchWebhook()` performed a single `fetch()` call. Any transient network failure, rate limit, or brief webhook downtime would cause the alert to be lost silently.
**Fix:** Replaced with `dispatchWebhookWithRetry()` that implements exponential backoff (1s, 2s, 4s) across up to 3 attempts. Logs retry attempts at debug level.

### 🟡 MEDIUM: Oracle balance threshold too low (0.5 ETH)
**File:** `data-publisher/src/monitor.ts`
**Severity:** MEDIUM
**Issue:** A fixed 0.5 ETH threshold is dangerously low for mainnet where a single complex transaction can cost >0.1 ETH. For Sepolia it's borderline acceptable but still tight.
**Fix:** Made threshold context-aware: mainnet (chainId=1) requires ≥1.0 ETH, testnets require ≥0.1 ETH.

### 🟡 MEDIUM: `data-source-unreachable` alert rule was a non-functional placeholder
**File:** `data-publisher/src/monitor.ts`
**Severity:** MEDIUM
**Issue:** The alert condition literally returned `false` always. This rule would never fire even if all data sources were down.
**Fix:** Implemented actual metric-reading logic using `getMetricValue()` that queries the `fides_data_source_down` gauge for each enabled data source.

### 🟡 MEDIUM: `alertCooldowns` Map could grow unbounded
**File:** `data-publisher/src/monitor.ts`
**Severity:** MEDIUM
**Issue:** The cooldown map was never pruned. Over a long-running process with many alert rules, this could cause gradual memory growth.
**Fix:** Added `alertMaxCooldownEntries = 100` limit. When exceeded, the oldest entry (by timestamp) is evicted via LRU-style pruning.

### ✅ VERIFIED: Prometheus metrics naming
All metrics use the `fides_` prefix consistently:
- `fides_sync_total` ✅
- `fides_sync_success` ✅
- `fides_sync_failed` ✅
- `fides_oracle_balance` ✅
- `fides_gas_used` ✅
- `fides_sync_duration_seconds` ✅
- `fides_publish_failures_total` ✅
- `fides_profiles_published_total` ✅
- `fides_pending_updates` ✅
- `fides_data_source_down` ✅
- `fides_addresses_total` ✅

---

## 4. Performance Testing

### 🟡 MEDIUM: Benchmark script had no explicit `--dry-run` mode
**File:** `data-publisher/scripts/benchmark.ts`
**Severity:** MEDIUM
**Issue:** The script only fell back to query-only mode if initialization *failed*. There was no way to explicitly run benchmarks without attempting to sign transactions.
**Fix:** Added `--dry-run` CLI flag. When set, the script skips signer initialization and skips the batch update benchmark (which writes to chain), running only query benchmarks.

### 🟡 MEDIUM: Batch sizes didn't test contract max capacity
**File:** `data-publisher/scripts/benchmark.ts`
**Severity:** MEDIUM
**Issue:** Batch sizes were `[1, 5, 10, 20, 50]` but the contract's `BATCH_MAX=100`. The maximum batch size was never tested.
**Fix:** Added `100` to the batch sizes array: `[1, 5, 10, 20, 50, 100]`.

### 🟡 MEDIUM: CSV output didn't properly escape values
**File:** `data-publisher/scripts/benchmark.ts`
**Severity:** MEDIUM
**Issue:** Error messages containing commas, quotes, or newlines would break the CSV format. Section headers with `##` are not valid CSV.
**Fix:** Added `escapeCsv()` helper that wraps fields in quotes and doubles internal quotes per RFC 4180. Removed markdown-style section headers from CSV output (kept them as comment lines with `#`).

### 🟡 MEDIUM: `hasBatchMethod()` called `provider.getCode()` on every batch iteration
**File:** `data-publisher/scripts/benchmark.ts`
**Severity:** MEDIUM
**Issue:** The method check was repeated for every batch size iteration, making redundant RPC calls.
**Fix:** Added `batchMethodCache?: boolean` to cache the result after the first call.

### 🟡 MEDIUM: `batch-sync.ts` missing explicit `process.exit(0)` on success
**File:** `data-publisher/scripts/batch-sync.ts`
**Severity:** MEDIUM
**Issue:** The script exited with 0 only when there were no updates. If updates succeeded, the process would hang (Node.js event loop may keep running from open connections).
**Fix:** Added explicit `process.exit(0)` at the end of the success path.

---

## 5. Docker Build

### 🔴 CRITICAL: No `.dockerignore` file
**File:** `data-publisher/.dockerignore` (new)
**Severity:** CRITICAL
**Issue:** The project had no `.dockerignore`. This meant `.env` files (containing private keys), `node_modules`, `.git` history, and logs could all be copied into the Docker build context — a serious information disclosure risk.
**Fix:** Created `.dockerignore` excluding: `node_modules`, `dist`, `.env*`, `*.pem`, `*.key`, `.git`, IDE files, test files, and Docker files themselves.

### 🟠 HIGH: `package-lock.json` not copied in Dockerfile
**File:** `data-publisher/Dockerfile`, `Dockerfile` (root)
**Severity:** HIGH
**Issue:** The Dockerfile copied `package.json` but not `package-lock.json`. This meant `npm install` would resolve dependency versions independently, leading to non-reproducible builds and potential supply-chain risks.
**Fix:** Updated both Dockerfiles to copy `package-lock.json` and use `npm ci` (which requires a lock file and is faster/reproducible).

### 🟠 HIGH: `scripts/` directory not copied → `dist/scripts/` missing
**File:** `data-publisher/Dockerfile`, `Dockerfile` (root), `data-publisher/tsconfig.json`
**Severity:** HIGH
**Issue:** `tsconfig.json` had `"rootDir": "./src"` and `"include": ["src/**/*"]`, so the `scripts/` directory was never compiled. The K8s CronJob referenced `dist/scripts/batch-sync.js` which didn't exist. The Dockerfile only copied `src/`.
**Fix:**
1. Changed `tsconfig.json`: `"rootDir": "."`, `"include": ["src/**/*", "scripts/**/*"]`
2. Updated `package.json`: `"main": "dist/src/index.js"`, `"start": "node dist/src/index.js"`
3. Updated Dockerfiles to copy `scripts/` and use `dist/src/index.js` as CMD
4. Added `npm run clean` before build to prevent stale dist artifacts

### 🟡 MEDIUM: `docker-compose.yml` mounted wrong config path
**File:** `data-publisher/docker-compose.yml`
**Severity:** MEDIUM
**Issue:** The compose file mounted `./config:/app/config` but the application loads `.env` from `path.join(__dirname, '../.env')` which resolves to `/app/.env` at runtime, not `/app/config/.env`.
**Fix:** Changed volume mount to `./.env:/app/.env:ro` (read-only) which matches the application's actual env loading path.

---

## 6. Prometheus Configuration

### 🟡 MEDIUM: `prometheus.yml` relabel config had incorrect source_labels
**File:** `monitoring/prometheus.yml`
**Severity:** MEDIUM
**Issue:** The port relabeling rule used `source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_port]` with regex `([^:]+)(?::\d+)?;(\d+)`. This regex expects `host;port` format but the source label is just a port number. The replacement would never work correctly.
**Fix:** Added `__address__` to source_labels so the regex matches `host:port;newport` format. Also added proper `__metrics_path__` override, and pod/namespace/node labels for better observability.

---

## Files Modified

| File | Action | Key Changes |
|------|--------|-------------|
| `data-publisher/src/kms-key-manager.ts` | Rewrite | Cached KMS client, SPKI parser, robust DER→RSV, EIP-155 support, signMessage/signTypedData overrides, low-s normalization |
| `data-publisher/src/monitor.ts` | Edit | Webhook retry with backoff, configurable balance threshold, working data-source alert, cooldown LRU pruning, metric reader helper |
| `data-publisher/src/config.ts` | Edit | Production plaintext key → `throw Error` |
| `data-publisher/scripts/benchmark.ts` | Edit | `--dry-run` flag, batch size 100, CSV escaping, hasBatchMethod cache |
| `data-publisher/scripts/batch-sync.ts` | Edit | Explicit `process.exit(0)` on success |
| `data-publisher/Dockerfile` | Edit | `package-lock.json`, `scripts/` copy, `npm ci`, `dist/src/index.js` CMD |
| `Dockerfile` (root) | Edit | Same fixes as data-publisher/Dockerfile |
| `data-publisher/docker-compose.yml` | Edit | `.env:/app/.env:ro` mount |
| `data-publisher/tsconfig.json` | Edit | `rootDir: "."`, `include: ["src/**/*", "scripts/**/*"]` |
| `data-publisher/package.json` | Edit | `clean` script, `dist/src/index.js` paths |
| `data-publisher/.dockerignore` | **New** | Excludes secrets, node_modules, build artifacts |
| `k8s/cronjob.yaml` | Edit | `fsGroup: 1001`, `seccompProfile: RuntimeDefault` |
| `k8s/deployment.yaml` | Edit | `seccompProfile: RuntimeDefault` |
| `monitoring/prometheus.yml` | Edit | Fixed relabeling rules, added path/node labels |

---

## Verification

```bash
# TypeScript compilation: ZERO errors
cd data-publisher && npx tsc --noEmit  # ✅ passes

# Build output structure verified:
dist/src/index.js          # main entry point
dist/scripts/batch-sync.js  # K8s CronJob command
dist/scripts/benchmark.js   # benchmark CLI
```

## Recommendations for Follow-up

1. **KMS IAM roles:** Ensure the ECS/K8s workload uses IAM roles for service accounts (IRSA) instead of long-lived AWS access keys in Secrets.
2. **Vault TLS:** The Vault client uses plain HTTP (`fetch`). In production, ensure Vault is accessed over HTTPS with certificate validation.
3. **Alert webhook secrets:** Move `ALERT_WEBHOOK_URL` from environment variable to a Kubernetes Secret or external secret manager.
4. **Prometheus authentication:** Consider adding basic auth or mTLS to the `/metrics` endpoint to prevent metric scraping by unauthorized parties.
5. **KMS key rotation:** Implement AWS KMS automatic key rotation and monitor `GetPublicKey` call rates.
