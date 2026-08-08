# FidesOrigin DevOps & Infrastructure Security Audit Report

**Audit Date:** 2026-07-26  
**Auditor:** Subagent (DevOps/Infrastructure Security)  
**Scope:** `/root/.openclaw/workspace/fidesorigin-demo/`  
**Areas Covered:** CI/CD, Docker, Kubernetes, Infrastructure as Code, Secrets Management, Deployment Pipeline Reliability

---

## Executive Summary

The FidesOrigin project has undergone significant security hardening, with many fixes already implemented (documented via inline comments like `[K3-Audit Fix]`, `[High Fix #54]`, etc.). However, **several Critical and High severity issues remain**, primarily around:

1. **Operational intelligence exposure** in tracked deployment artifacts
2. **Incomplete K8s secret management** (template/actual manifest mismatch)
3. **Overly permissive network egress** in fallback NetworkPolicy
4. **Weak defaults and placeholder configurations** that could lead to production misconfigurations
5. **CI/CD pipeline gaps** where security scans silently pass despite finding issues

---

## Critical Issues

### C1. Deployment Artifacts Expose Operational Intelligence (Tracked in Git)

- **File**: `apps/contracts/deployments/sepolia-latest.json`
- **Issue**: This file is **tracked in Git** and contains:
  - Actual deployer EOA address: `0x5F6Ae278e7a62E64F9F467a91B693f372b84a374`
  - Live contract addresses (FidesCompliance, QuarantineVault, CompliantStableCoin)
  - Full transaction hashes for deployments and upgrades
  - Failed upgrade attempts with detailed revert data
  - Role assignments (ORACLE_ROLE, OPERATOR_ROLE holder addresses)
  - Timelock bypass notes ("Upgrade blocked by Timelock")
- **Severity**: **Critical**
- **Fix**: 
  - Add `apps/contracts/deployments/*.json` to `.gitignore` (keep `.gitkeep` only)
  - Move deployment artifacts to a private registry or encrypted storage (e.g., AWS S3 with IAM, HashiCorp Vault KV)
  - For CI/CD, write deployment outputs to GitHub Artifacts with short retention (1-7 days) instead of committing to repo
  - Rotate any roles/keys associated with the exposed deployer address

### C2. OpenZeppelin Upgrade Manifest Exposes Full Storage Layout

- **File**: `apps/contracts/.openzeppelin/sepolia.json`
- **Issue**: Tracked in Git. Contains:
  - All proxy and implementation contract addresses
  - Complete storage layout (slot positions, variable names, types) for FidesCompliance, RiskRegistry, PolicyEngine, ComplianceEngine
  - Transaction hashes for every upgrade
  - Exact Solidity version and compiler settings
- **Severity**: **Critical**
- **Fix**: 
  - Add `apps/contracts/.openzeppelin/*.json` to `.gitignore`
  - Store upgrade manifests in a secure location accessible only to deployers
  - The storage layout is a goldmine for exploit development — it reveals exact memory layout for upgradeable contracts

### C3. Hardcoded Production Contract Address in Application Config

- **File**: `data-publisher/src/config.ts`
- **Issue**: Lines containing `getEnv('RISK_REGISTRY_ADDRESS', '0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc')` and `getEnv('FATF_RISK_REGISTRY_ADDRESS', '0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc')` use a **real Sepolia contract address as fallback**. If the environment variable is unset or misspelled, the application will silently connect to a production contract.
- **Severity**: **Critical**
- **Fix**: 
  - Remove all fallback values for contract addresses. Use `getEnv('RISK_REGISTRY_ADDRESS')` with no default — force the application to fail fast if the env var is missing.
  - For development, use a separate `config.dev.ts` or explicit `NODE_ENV=development` check with testnet-only addresses.

---

## High Issues

### H1. K8s Deployment References Non-Existent Secrets

- **File**: `k8s/deployment.yaml`
- **Issue**: The Deployment references three secrets:
  - `fidesorigin-publisher-keys` (for `PUBLISHER_PRIVATE_KEY`, `FATF_ORACLE_PRIVATE_KEY`)
  - `fidesorigin-cloud-keys` (for AWS credentials)
  - `fidesorigin-vault-keys` (for Vault token)
  
  However, `k8s/sealed-secret-template.yaml` only creates a single secret `fidesorigin-keys`. The split-secret architecture described in the Deployment manifest does not match the sealed secret template. If applied as-is, pods will fail to start with `CreateContainerConfigError`.
- **Severity**: **High**
- **Fix**: 
  - Update `sealed-secret-template.yaml` to create the three separate secrets matching `deployment.yaml` expectations
  - Or, consolidate `deployment.yaml` to use a single `fidesorigin-keys` secret (less preferred — increases blast radius)

### H2. CronJob Uses Placeholder Image Digest

- **File**: `k8s/cronjob.yaml`
- **Issue**: Line: `image: fidesorigin/data-publisher@sha256:PLACEHOLDER_DIGEST`. If this manifest is applied without CI/CD substitution, the pod will fail with `ImagePullBackOff` or potentially pull an unexpected image if the placeholder is somehow resolved.
- **Severity**: **High**
- **Fix**: 
  - Add a CI/CD gate that fails the pipeline if `PLACEHOLDER_DIGEST` is still present in the manifest at deploy time
  - Use a pre-commit hook or lint step to catch unsubstituted placeholders

### H3. NetworkPolicy Allows Egress to ANY on Port 443

- **File**: `k8s/networkpolicy.yaml`
- **Issue**: The standard Kubernetes NetworkPolicy fallback allows egress on TCP/443 to ANY destination (`to: []`). While documented as a fallback until Cilium/Calico is available, this is overly permissive for a compliance system that should restrict outbound to known APIs (OFAC, Chainalysis, OpenSanctions, etc.). A compromised pod can exfiltrate data to any HTTPS endpoint.
- **Severity**: **High**
- **Fix**: 
  - Prioritize deploying Cilium or Calico to enable FQDN-based egress filtering (see `networkpolicy-cilium.yaml`)
  - Until then, restrict egress to known CIDR blocks or use an egress proxy/gateway
  - Add a TODO with a deadline for Cilium deployment

### H4. CI/CD Security Scan Silently Ignores Failures

- **File**: `.github/workflows/ci.yml`
- **Issue**: 
  - `pnpm audit --audit-level moderate || true`
  - `pnpm audit --audit-level high || true`
  
  The `|| true` pattern means the security scan job **always passes**, even when vulnerabilities are found. This creates a false sense of security.
- **Severity**: **High**
- **Fix**: 
  - Remove `|| true` from audit commands
  - Set `continue-on-error: true` at the step level if you want the job to report findings without failing the entire pipeline
  - Better yet, use `actions/dependency-review-action` for PR-level dependency checks

### H5. Deploy-K8s Job Is Incomplete and Uses Mutable Tag

- **File**: `.github/workflows/deploy.yml`
- **Issue**: 
  1. The `deploy-k8s` job pulls `fidesorigin/data-publisher:latest` — a mutable tag subject to supply chain attacks
  2. The job only pins the digest and prints it; it does **NOT** actually deploy to Kubernetes (no `kubectl apply`, `helm upgrade`, or ArgoCD sync)
  3. The `sed` command modifies the local file but never commits or applies the change
- **Severity**: **High**
- **Fix**: 
  - Build and push image with a unique tag (e.g., `git-sha-${GITHUB_SHA}`), then use that exact tag or digest in the manifest
  - Complete the deploy step: `kubectl apply -f k8s/` or use Helm/ArgoCD
  - Consider using `ko` or `kaniko` for reproducible builds without Docker-in-Docker

### H6. data-sync Docker Compose Exposes PostgreSQL to All Interfaces

- **File**: `data-sync/docker-compose.yml`
- **Issue**: `ports: - "5432:5432"` binds PostgreSQL to all host interfaces, not just localhost (`127.0.0.1`). Combined with the weak default password `changeme` (see M1), this creates a significant attack surface.
- **Severity**: **High**
- **Fix**: 
  - Change to `ports: - "127.0.0.1:5432:5432"`
  - Remove the default password fallback entirely (see M1)

### H7. Vercel Web Config Has Dangerous CSP Fallback

- **File**: `apps/web/vercel.json`
- **Issue**: The CSP header includes `'unsafe-inline'` for style-src and a template placeholder `'nonce-<%=nonce%>'` for script-src. If the build process fails to substitute the nonce template, browsers may fallback to allowing all inline scripts (depending on how the template is rendered). The root `vercel.json` also uses `'unsafe-inline'` for script-src.
- **Severity**: **High**
- **Fix**: 
  - Verify the nonce substitution is working correctly at build time
  - Remove `'unsafe-inline'` from script-src entirely; use nonces or hashes
  - For style-src, move inline styles to CSS files or use `style-src-elem` with hashes

---

## Medium Issues

### M1. Weak Default Password in data-sync Compose

- **File**: `data-sync/docker-compose.yml`
- **Issue**: `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-changeme}` provides a trivial default password if the env var is unset.
- **Severity**: **Medium**
- **Fix**: 
  - Use `${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}` to force a failure if unset
  - Same pattern for all required secrets

### M2. Prometheus Scraping Has No Authentication

- **File**: `monitoring/prometheus.yml`
- **Issue**: The TODO comment acknowledges this, but no authentication is configured for Prometheus scraping endpoints. Anyone with network access to the metrics port can scrape metrics.
- **Severity**: **Medium**
- **Fix**: 
  - Implement bearer token or mTLS for Prometheus scraping as documented in the TODO
  - Add network policy to restrict metrics port (9090) to monitoring namespace only

### M3. Backup Hardhat Config File Tracked in Git

- **File**: `apps/contracts/hardhat.config.bak.js`
- **Issue**: This backup file contains the full Hardhat configuration including all network RPC URLs, account derivation logic, and Etherscan API key structure. Backup files (`.bak`) are not in `.gitignore`.
- **Severity**: **Medium**
- **Fix**: 
  - Add `*.bak` and `*.bak.js` to `.gitignore`
  - Delete this file from the repo: `git rm apps/contracts/hardhat.config.bak.js`

### M4. data-sync Dockerfile Uses Deprecated Flag and Weak Healthcheck

- **File**: `data-sync/Dockerfile`
- **Issue**: 
  1. `npm ci --only=production` is deprecated; should use `--omit=dev`
  2. `npm install -g prisma` installs a global tool without version pinning
  3. Healthcheck is trivial: `node -e "console.log('healthy')"` — it does not verify the actual service is responding
- **Severity**: **Medium**
- **Fix**: 
  - Use `npm ci --omit=dev`
  - Pin Prisma version: `npm install -g prisma@5.x.x`
  - Implement a real healthcheck that hits an HTTP endpoint or validates DB connectivity

### M5. data-publisher Compose Mounts Host Logs Directory

- **File**: `data-publisher/docker-compose.yml`
- **Issue**: `volumes: - ./logs:/app/logs` mounts a host directory into the container. If the container is compromised, an attacker can write to the host filesystem. Conversely, host users can tamper with container logs.
- **Severity**: **Medium**
- **Fix**: 
  - Use a named Docker volume instead: `volumes: - publisher-logs:/app/logs`
  - Or stream logs to stdout/stderr and collect with a log aggregator (Fluent Bit, Promtail)

### M6. K8s Role Can Read ALL Secrets in Namespace

- **File**: `k8s/role.yaml`
- **Issue**: The Role grants `get`, `list`, `watch` on ALL `secrets` in the namespace (no `resourceNames` restriction for read verbs). A compromised `fidesorigin-publisher` pod can read every secret in the `fidesorigin` namespace, not just its own.
- **Severity**: **Medium**
- **Fix**: 
  - Restrict read access to specific secret names:
    ```yaml
    - apiGroups: [""]
      resources: ["secrets"]
      resourceNames: ["fidesorigin-keys", "fidesorigin-publisher-keys"]
      verbs: ["get"]
    ```

### M7. Keeper State File Written to Scripts Directory

- **File**: `scripts/quarantine-keeper.js`
- **Issue**: The keeper state is written to `path.join(__dirname, '.keeper-state.json')`. The `scripts/` directory may be writable by the process, and the chmod to 0o600 has a try-catch that silently ignores errors on Windows. If the state file is readable by other users, it leaks which addresses have been processed and which wallets are known.
- **Severity**: **Medium**
- **Fix**: 
  - Use `fs.promises.writeFile` with explicit mode `0o600`
  - Store state in a proper database (Redis, PostgreSQL) or encrypted file
  - Fail hard if permissions cannot be set

### M8. deploy-contracts.yml Verification Runs Even When Deploy Skipped

- **File**: `.github/workflows/deploy-contracts.yml`
- **Issue**: The "Verify on Etherscan" step has `if: success()` and runs even when the "Deploy" step was skipped due to `confirm != 'DEPLOY'`. This means verification could attempt to verify non-existent or previous deployments.
- **Severity**: **Medium**
- **Fix**: 
  - Change to `if: success() && github.event.inputs.confirm == 'DEPLOY'`

### M9. deploy-web.yml Installs Unpinned Vercel CLI

- **File**: `.github/workflows/deploy-web.yml`
- **Issue**: `npm install -g vercel@latest` installs the latest Vercel CLI at runtime without pinning. A compromised Vercel CLI release could inject malicious code into the deployment.
- **Severity**: **Medium**
- **Fix**: 
  - Pin Vercel CLI version: `npm install -g vercel@39.x.x`
  - Or use `npx vercel@39.x.x` without global install

### M10. Root Vercel Config Mismatch with Next.js App

- **File**: `vercel.json` (root) and `apps/web/vercel.json`
- **Issue**: The root `vercel.json` configures `@vercel/static` builds and routes to `apps/web/public/`, while `apps/web/vercel.json` configures `framework: "nextjs"`. These two configurations could conflict or cause unexpected behavior when deploying from the root vs. the app directory.
- **Severity**: **Medium**
- **Fix**: 
  - Consolidate to a single Vercel configuration
  - Ensure the root `vercel.json` is not used if deploying from `apps/web/`

---

## Low Issues

### L1. Grafana Admin Password Env Var Name Inconsistency

- **File**: `docker-compose.yml` (root)
- **Issue**: Uses `GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:?...}` but `data-publisher/docker-compose.yml` uses `GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD:?...}`. Inconsistent env var naming causes confusion.
- **Severity**: **Low**
- **Fix**: Standardize on `GRAFANA_ADMIN_PASSWORD` across all compose files.

### L2. API CORS Allows localhost in Production

- **File**: `apps/api/api/risk-sync.js`
- **Issue**: `ALLOWED_ORIGINS` includes `http://localhost:3000` and `http://localhost:5173`. In production mode, the code checks `process.env.NODE_ENV === 'production'` before enforcing CORS, but the whitelist still contains development origins.
- **Severity**: **Low**
- **Fix**: 
  - Load allowed origins from environment variable with production-only defaults
  - Separate dev and production CORS configs

### L3. Example env Files Contain Pattern Passwords

- **File**: `.env.db.example`
- **Issue**: Contains `POSTGRES_PASSWORD=fidesorigin_secret_2026`, `PGADMIN_PASSWORD=admin_secret_2026`, etc. While these are examples, predictable patterns (`_secret_2026`) might be copy-pasted into production.
- **Severity**: **Low**
- **Fix**: 
  - Use obviously fake placeholders: `POSTGRES_PASSWORD=REPLACE_WITH_RANDOM_32CHAR_STRING`
  - Add a comment warning against copy-pasting

### L4. turbo.json Includes Sensitive Env Vars in Cache Key

- **File**: `turbo.json`
- **Issue**: `PRIVATE_KEY`, `ETHERSCAN_API_KEY` are in `globalEnv`. Turbo uses these to compute cache keys. This means builds with different private keys won't share cache (correct behavior), but it also means the cache system is aware of these sensitive values.
- **Severity**: **Low**
- **Fix**: 
  - Remove `PRIVATE_KEY` from `globalEnv` — it should not affect build outputs
  - Keep `ETHERSCAN_API_KEY` only if it affects build outputs (e.g., contract verification during build)

### L5. Missing Security Headers on API Vercel Config

- **File**: `apps/api/vercel.json`
- **Issue**: The API config has basic security headers but lacks:
  - `X-RateLimit-Limit` / rate limiting headers
  - `Permissions-Policy`
  - No CORS configuration for API routes
- **Severity**: **Low**
- **Fix**: Add `Permissions-Policy: interest-cohort=()` and other modern security headers.

### L6. No Resource Limits on Nginx in Production Compose

- **File**: `backend/docker-compose.prod.yml`
- **Issue**: The `nginx` service has no `deploy.resources.limits` configuration, unlike all other services.
- **Severity**: **Low**
- **Fix**: Add CPU and memory limits to the nginx service.

### L7. Slither Analysis Not Enforced in CI

- **File**: `.github/workflows/ci.yml`
- **Issue**: Slither is installed with `pip install slither-analyzer || true` and the analysis step is wrapped in a conditional that skips if Slither is unavailable. Solidity static analysis is not enforced.
- **Severity**: **Low**
- **Fix**: 
  - Make Slither a required check
  - Use a pre-built Docker image with Slither instead of installing at runtime
  - Fail the build if Slither finds high-severity issues

---

## Info / Observations

1. **Good Security Practices Observed**:
   - `.env` is properly gitignored and not tracked
   - Sealed Secrets and External Secrets Operator templates are provided
   - KMS key management (AWS KMS, Vault) is implemented with proper AbstractSigner
   - K8s security contexts (non-root, read-only root fs, drop ALL capabilities)
   - Resource limits on most K8s workloads
   - Pod Disruption Budget for HA
   - Topology spread constraints and pod anti-affinity
   - Docker multi-stage builds with non-root users
   - CI/CD workflows have explicit least-privilege permissions (`contents: read`)
   - TruffleHog secret scanning is pinned to a specific version
   - TruffleHog scans with `--only-verified` to reduce false positives
   - Health checks configured on containers
   - Input validation for Ethereum addresses
   - Rate limiting middleware exists (though edge rate limiting not configured)

2. **Architecture Note**: The project uses a mix of deployment targets (Vercel for web/API, Docker Compose for backend/data services, Kubernetes for data-publisher). This multi-platform approach increases operational complexity and the attack surface. Consider standardizing on a single container orchestration platform for production.

3. **Secret Rotation**: There is no documented secret rotation procedure. For a compliance system handling sanctions data, consider implementing automated rotation for:
   - AWS KMS keys (annual rotation)
   - Vault tokens (short TTL with renewal)
   - Database credentials (automated via Vault dynamic secrets or AWS RDS IAM auth)
   - API keys (Chainalysis, Etherscan, etc.)

4. **Compliance Considerations**: As a system handling sanctions and risk data, consider:
   - SOC 2 Type II or ISO 27001 alignment
   - Audit logging for all admin operations
   - Data retention policies for OFAC/sanctions data
   - GDPR/CCPA implications for address risk profiling

---

## Appendix: Files Audited

### CI/CD
- `.github/workflows/ci.yml`
- `.github/workflows/deploy-contracts.yml`
- `.github/workflows/deploy-subgraph.yml`
- `.github/workflows/deploy-web.yml`
- `.github/workflows/deploy.yml`
- `.github/workflows/publish-sdk.yml`
- `.github/workflows/secret-scan.yml`

### Docker
- `Dockerfile`
- `docker-compose.yml`
- `backend/Dockerfile`
- `backend/docker-compose.yml`
- `backend/docker-compose.prod.yml`
- `data-publisher/Dockerfile`
- `data-publisher/docker-compose.yml`
- `data-sync/Dockerfile`
- `data-sync/docker-compose.yml`

### Kubernetes
- `k8s/configmap.yaml`
- `k8s/cronjob.yaml`
- `k8s/deployment.yaml`
- `k8s/external-secrets.yaml`
- `k8s/kms-sealed-secret.yaml.template`
- `k8s/namespace.yaml`
- `k8s/networkpolicy-cilium.yaml`
- `k8s/networkpolicy.yaml`
- `k8s/pod-disruption-budget.yaml`
- `k8s/rolebinding.yaml`
- `k8s/role.yaml`
- `k8s/sealed-secret-template.yaml`
- `k8s/secret.yaml`
- `k8s/service.yaml`

### Vercel / Edge
- `vercel.json`
- `apps/web/vercel.json`
- `apps/api/vercel.json`

### Environment & Secrets
- `.env`
- `.env.example`
- `.env.local.example`
- `.env.db.example`
- `backend/.env.example`
- `data-publisher/.env`
- `data-publisher/.env.example`
- `data-sync/.env.example`

### Application Code (Key Files)
- `data-publisher/src/config.ts`
- `data-publisher/src/key-manager.ts`
- `data-publisher/src/kms-key-manager.ts`
- `scripts/quarantine-keeper.js`
- `apps/api/api/risk-sync.js`
- `apps/web/lib/env.ts`
- `apps/contracts/hardhat.config.bak.js`
- `apps/contracts/.openzeppelin/sepolia.json`
- `apps/contracts/deployments/sepolia-latest.json`

### Package & Build
- `package.json`
- `turbo.json`
- `pnpm-workspace.yaml`
- `.gitignore`

---

*End of Audit Report*
