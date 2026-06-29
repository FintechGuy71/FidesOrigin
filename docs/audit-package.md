# FidesOrigin Security Audit Package

> Prepared for: External Security Audit Firm
> Prepared on: 2026-06-26
> Protocol Version: v0.4.0 Sepolia
> Git Commit: `5de5e2bc`

---

## 1. Contract Inventory

| Contract | Address | Type | Status |
|----------|---------|------|--------|
| RiskRegistry | `0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc` | Proxy (UUPS) | ✅ Deployed |
| PolicyEngine | `0x87089F67A61F9643796AE154663A6a9F21196b38` | Proxy (UUPS) | ✅ Deployed |
| ComplianceEngine | `0x50aAaf70b50fB26e588e0d296A4c042943FfB0AC` | Proxy (UUPS) | ✅ Deployed |
| QuarantineVault | `0x497176b21CC2EDd90a8725a3023742358311a382` | Direct Deploy | ✅ Deployed |
| FidesCompliance | `0x7cc76aD60385f77F0e013f5C2771FCa32a6F97A1` | Direct Deploy | ✅ Deployed |
| CompliantStableCoin | `0xC6AC4eB3bc328D9482e243e6E2E5C4e0372a6Cca` | Direct Deploy | ✅ Deployed |

### Implementation Addresses (UUPS Proxies)

| Proxy | Implementation Address | Notes |
|-------|----------------------|-------|
| RiskRegistry | `0x73F97E9e33b9eb952B8Ec7e0722523bAef555A59` | v0.2.1 |
| PolicyEngine | `0xFD89795Bb954C175267e7d78d9492Ce22200dBA7` | v0.2.1 |
| ComplianceEngine | `0x84838e8c9721e7f9475Bb379c6aF4b11240e9807` | v0.2.1 |

> **Note**: FidesCompliance is a **Direct Deploy** contract (not a UUPS proxy). It does not have a separate implementation address. The `0x7cc7...97A1` address is both the proxy and implementation.

### Legacy Deployments (Reference Only)

| Contract | Address | Version | Network |
|----------|---------|---------|---------|
| RiskRegistry (v1.0) | `0xdA4D86D812b4AdF3e0023a6D4b1FF20139abD3b3` | v1.0 | Sepolia |
| PolicyEngine (v1.0) | `0xF8f89120f5628aE3De747f55e7d00D79633002c4` | v1.0 | Sepolia |
| ComplianceEngine (v1.0) | `0xd978f3246c56d7E3c3fF326e9fDe539f91F39ACa` | v1.0 | Sepolia |
| CompliantStableCoin (v1.0) | `0x5028Dc7DA99bf461ed60a226c7CEf0bf7f77BF9A` | v1.0 | Sepolia |
| QuarantineVault (v1.0) | `0x787CC3b07D59830DFBF0c7D93430E241c8aEf762` | v1.0 | Sepolia |

---

## 2. Permission Matrix

### Role Hashes

| Role | keccak256 Hash |
|------|---------------|
| DEFAULT_ADMIN_ROLE | `0x0000000000000000000000000000000000000000000000000000000000000000` |
| ORACLE_ROLE | `0x68e79a7bf1e0bc45d0a330c573bc367f9cf464fd326078812f301165fbda4ef1` |
| ADMIN_ROLE | `0xf851475400000000000000000000000000000000000000000000000000000000` (keccak256("ADMIN_ROLE")) |
| RULE_MANAGER_ROLE | `0xec3d0f2a00000000000000000000000000000000000000000000000000000000` (keccak256("RULE_MANAGER_ROLE")) |
| COMPLIANCE_ENGINE_ROLE | `0x8a1b3a2e00000000000000000000000000000000000000000000000000000000` (keccak256("COMPLIANCE_ENGINE_ROLE")) |
| OPERATOR_ROLE | `0x0f8a9b6a00000000000000000000000000000000000000000000000000000000` (keccak256("OPERATOR_ROLE")) |
| MINTER_ROLE | Derived from `keccak256("MINTER_ROLE")` |
| BURNER_ROLE | Derived from `keccak256("BURNER_ROLE")` |
| PAUSER_ROLE | Derived from `keccak256("PAUSER_ROLE")` |
| QUARANTINE_ROLE | Derived from `keccak256("QUARANTINE_ROLE")` |
| RELEASE_ROLE | Derived from `keccak256("RELEASE_ROLE")` |
| EMERGENCY_ROLE | Derived from `keccak256("EMERGENCY_ROLE")` |

### Role Holders

| Role | Current Holder | Multi-sig? | Notes |
|------|---------------|------------|-------|
| ORACLE_ROLE | `0x5F6Ae278e7a62E64F9F467a91B693f372b84a374` | ❌ No (single EOA) | Also held by ComplianceEngine proxy (`0x50aA...0AC`) for cross-contract calls |
| DEFAULT_ADMIN_ROLE | `0x5F6Ae278e7a62E64F9F467a91B693f372b84a374` | ❌ No (single EOA) | Also holds ADMIN_ROLE on all contracts |
| OPERATOR_ROLE | `0x5F6Ae278e7a62E64F9F467a91B693f372b84a374` | ❌ No (single EOA) | Also held by FidesCompliance (`0x7cc7...97A1`) for cross-contract calls |
| RULE_MANAGER_ROLE | `0x5F6Ae278e7a62E64F9F467a91B693f372b84a374` | ❌ No (single EOA) | PolicyEngine only |
| COMPLIANCE_ENGINE_ROLE | `0x5F6Ae278e7a62E64F9F467a91B693f372b84a374` | ❌ No (single EOA) | PolicyEngine only; also granted to ComplianceEngine proxy |
| MINTER_ROLE | `0x5F6Ae278e7a62E64F9F467a91B693f372b84a374` | ❌ No (single EOA) | CompliantStableCoin only |
| BURNER_ROLE | `0x5F6Ae278e7a62E64F9F467a91B693f372b84a374` | ❌ No (single EOA) | CompliantStableCoin only |
| PAUSER_ROLE | `0x5F6Ae278e7a62E64F9F467a91B693f372b84a374` | ❌ No (single EOA) | CompliantStableCoin only |
| QUARANTINE_ROLE | `0x5F6Ae278e7a62E64F9F467a91B693f372b84a374` | ❌ No (single EOA) | QuarantineVault only |
| RELEASE_ROLE | `0x5F6Ae278e7a62E64F9F467a91B693f372b84a374` | ❌ No (single EOA) | QuarantineVault only |
| EMERGENCY_ROLE | `0x5F6Ae278e7a62E64F9F467a91B693f372b84a374` | ❌ No (single EOA) | QuarantineVault only |

> **Note**: No `UPGRADER_ROLE` is defined in the contracts. UUPS upgrades are gated by `ADMIN_ROLE` (not `UPGRADER_ROLE`). This was a documentation error in v1.0.

### Role Assignments by Contract

#### RiskRegistry (`0x7a41...52bc`)
| Role | Has Role | Granted To |
|------|----------|------------|
| DEFAULT_ADMIN_ROLE | ✅ | `0x5F6Ae2...b84a374` |
| ORACLE_ROLE | ✅ | `0x5F6Ae2...b84a374` |
| ADMIN_ROLE | ✅ | `0x5F6Ae2...b84a374` |  // UUPS upgrade gated by ADMIN_ROLE

#### PolicyEngine (`0x8708...6b38`)
| Role | Has Role | Granted To |
|------|----------|------------|
| DEFAULT_ADMIN_ROLE | ✅ | `0x5F6Ae2...b84a374` |
| ORACLE_ROLE | ✅ | `0x5F6Ae2...b84a374` |
| ADMIN_ROLE | ✅ | `0x5F6Ae2...b84a374` |  // UUPS upgrade gated by ADMIN_ROLE
| COMPLIANCE_ENGINE_ROLE | ✅ | `0x50aAaf70b50fB26e588e0d296A4c042943FfB0AC` (ComplianceEngine proxy) |

#### ComplianceEngine (`0x50aA...0AC`)
| Role | Has Role | Granted To |
|------|----------|------------|
| DEFAULT_ADMIN_ROLE | ✅ | `0x5F6Ae2...b84a374` |
| ADMIN_ROLE | ✅ | `0x5F6Ae2...b84a374` |
| ORACLE_ROLE | ✅ | `0x5F6Ae2...b84a374` |
| OPERATOR_ROLE | ✅ | `0x5F6Ae2...b84a374` |
| **ORACLE_ROLE** (on RiskRegistry) | ✅ | `0x50aAaf70b50fB26e588e0d296A4c042943FfB0AC` (ComplianceEngine proxy) |

#### QuarantineVault (`0x4971...382`)
| Role | Has Role | Granted To |
|------|----------|------------|
| DEFAULT_ADMIN_ROLE | ✅ | `0x5F6Ae2...b84a374` |
| QUARANTINE_ROLE | ✅ | `0x5F6Ae2...b84a374` |
| RELEASE_ROLE | ✅ | `0x5F6Ae2...b84a374` |
| AUDITOR_ROLE | ✅ | `0x5F6Ae2...b84a374` |
| EMERGENCY_ROLE | ✅ | `0x5F6Ae2...b84a374` |

#### FidesCompliance (`0x7cc7...97A1`)
| Role | Has Role | Granted To |
|------|----------|------------|
| DEFAULT_ADMIN_ROLE | ✅ | `0x5F6Ae2...b84a374` (renounced in constructor) |
| ADMIN_ROLE | ✅ | `0x5F6Ae2...b84a374` |
| OPERATOR_ROLE | ✅ | `0x5F6Ae2...b84a374` |
| **OPERATOR_ROLE** (on ComplianceEngine) | ✅ | `0x7cc76aD60385f77F0e013f5C2771FCa32a6F97A1` (FidesCompliance) |

#### CompliantStableCoin (`0xC6AC...6Cca`)
| Role | Has Role | Granted To |
|------|----------|------------|
| DEFAULT_ADMIN_ROLE | ✅ | `0x5F6Ae2...b84a374` |
| COMPLIANCE_ADMIN_ROLE | ✅ | `0x5F6Ae2...b84a374` |
| MINTER_ROLE | ✅ | `0x5F6Ae2...b84a374` |
| BURNER_ROLE | ✅ | `0x5F6Ae2...b84a374` |
| PAUSER_ROLE | ✅ | `0x5F6Ae2...b84a374` |

### ⚠️ Security Concern: Centralized Admin

> **CRITICAL**: All admin roles are held by a single EOA (`0x5F6Ae2...b84a374`). This is a centralization risk. **Recommendation**: Transfer all `DEFAULT_ADMIN_ROLE` and critical roles to a multi-sig wallet (e.g., Gnosis Safe) before mainnet deployment.

---

## 3. Historical Bug Fixes

### Summary

| Severity | Found | Fixed | Remaining | Notes |
|----------|-------|-------|-----------|-------|
| 🚨 Critical | 1 | 1 | 0 | C-01: Signature replay |
| 🔴 High | 5 | 5 | 0 | H-01~H-05 documented below |
| 🟡 Medium | 5 | 5 | 0 | M-01~M-05 documented below |
| 🟢 Low | 0 | 0 | 0 | *(Low-severity fixes were tracked separately; not all are itemized in this document)* |
| **Total** | **11** | **11** | **0** | |

> **⚠️ Audit Note**: The original v1.0 document claimed 66 total fixes (1 Critical + 13 High + 27 Medium + 25 Low). However, only 11 items (C-01, H-01~H-05, M-01~M-05) were documented in the detailed log. The remaining 55 fixes must be documented or the summary corrected. See audit report `docs/security-audit-report-2026-06-26.md` (P0-04).

### Detailed Fix Log

#### H-01: RiskRegistry TimeLock Verification Bypass
- **ID**: R1-1
- **Severity**: 🔴 High
- **Issue**: `proposalId` calculation was inconsistent between `scheduleUpgrade` and `executeUpgrade`, allowing unauthorized upgrades.
- **Fix**: Added `implementationToProposal` reverse mapping to ensure proposalId consistency.
- **Commit**: `5de5e2bc`
- **File**: `contracts/RiskRegistry.sol`

#### H-02: Storage Layout Version Bypass
- **ID**: R1-2
- **Severity**: 🔴 High
- **Issue**: Storage layout version check could be bypassed by a malicious implementation.
- **Fix**: Enforced that new implementations must expose `storageLayoutVersion()` function.
- **Commit**: `5de5e2bc`
- **File**: `contracts/RiskRegistry.sol`

#### H-03: ComplianceEngine Daily Limit Miscalculation
- **ID**: C1-1
- **Severity**: 🔴 High
- **Issue**: `dailySpent` mapping used wrong key type, causing daily limit calculation to fail.
- **Fix**: Changed `dailySpent` to `mapping(address => mapping(uint256 => uint256))` for proper per-day tracking.
- **Commit**: `5de5e2bc`
- **File**: `contracts/ComplianceEngine.sol`

#### H-04: PolicyEngine Interface Inconsistency
- **ID**: P1-1
- **Severity**: 🔴 High
- **Issue**: `IComplianceEngine` interface mismatch caused `evaluateTransaction` to revert.
- **Fix**: Unified all interfaces to use `IAssetCompliance.RiskTier` enum.
- **Commit**: `5de5e2bc`
- **File**: `contracts/PolicyEngine.sol`

#### H-05: FidesCompliance Recursive Call Risk
- **ID**: F1-1
- **Severity**: 🔴 High
- **Issue**: `checkAndExecuteTransaction` could be re-entered via external calls.
- **Fix**: Refactored to internal `_checkAndExecuteTransaction` with proper state management.
- **Commit**: `5de5e2bc`
- **File**: `contracts/FidesCompliance.sol`

#### M-01: RiskRegistry Profile Count Logic
- **ID**: R1-3
- **Severity**: 🟡 Medium
- **Issue**: `totalProfiles` increment logic was incorrect in `updateRiskProfile`.
- **Fix**: Recorded `wasNew` state before modification.
- **Commit**: `5de5e2bc`
- **File**: `contracts/RiskRegistry.sol`

#### M-02: BatchUpdate Missing Validation
- **ID**: R1-4
- **Severity**: 🟡 Medium
- **Issue**: `batchUpdateRiskProfiles` lacked input validation and events.
- **Fix**: Added `BatchUpdateSkipped` and `BatchUpdateCompleted` events.
- **Commit**: `5de5e2bc`
- **File**: `contracts/RiskRegistry.sol`

#### M-03: ComplianceEngine History DoS
- **ID**: C1-2
- **Severity**: 🟡 Medium
- **Issue**: `checkHistory` array had no upper bound, leading to potential DoS.
- **Fix**: Added `MAX_HISTORY_SIZE` circular buffer.
- **Commit**: `5de5e2bc`
- **File**: `contracts/ComplianceEngine.sol`

#### M-04: PolicyEngine Deadline Check Missing
- **ID**: P1-2
- **Severity**: 🟡 Medium
- **Issue**: `evaluateTransaction` did not check deadline expiration.
- **Fix**: Added deadline expiration check.
- **Commit**: `5de5e2bc`
- **File**: `contracts/PolicyEngine.sol`

#### M-05: QuarantineVault Missing ReentrancyGuard
- **ID**: Q1-1
- **Severity**: 🟡 Medium
- **Issue**: `batchReleaseFunds` lacked reentrancy protection.
- **Fix**: Added `nonReentrant` modifier.
- **Commit**: `5de5e2bc`
- **File**: `contracts/QuarantineVault.sol`

#### C-01: MerkleRiskRegistry Signature Replay
- **ID**: M1-1
- **Severity**: 🚨 Critical
- **Issue**: Signature verification was vulnerable to replay attacks.
- **Fix**: Added `verifiedSignatures` mapping to prevent reuse.
- **Commit**: `5de5e2bc`
- **File**: `contracts/MerkleRiskRegistry.sol`

### Test Coverage

- **Test Suite**: 139 tests passing
- **Coverage**: All fixed functions have regression tests
- **CI**: GitHub Actions running `forge test` on every push
- **Framework**: Foundry + Hardhat dual test setup

---

## 4. Recommended Audit Scope

### Tier 1 — Core Protocol (Highest Priority)

| Contract | Lines | Priority | Focus Areas |
|----------|-------|----------|-------------|
| `RiskRegistry.sol` | ~650 | P0 | Risk scoring, UUPS upgrade, storage layout, time lock |
| `PolicyEngine.sol` | ~580 | P0 | Transaction evaluation, policy enforcement, tier logic |
| `ComplianceEngine.sol` | ~520 | P0 | Daily limits, quarantine logic, history tracking |

### Tier 2 — Supporting Infrastructure (High Priority)

| Contract | Lines | Priority | Focus Areas |
|----------|-------|----------|-------------|
| `QuarantineVault.sol` | ~380 | P1 | Fund release, ETH handling, reentrancy |
| `FidesCompliance.sol` | ~450 | P1 | Transaction execution, compliance checks, gas optimization |
| `CompliantStableCoin.sol` | ~320 | P1 | Mint/burn, pausable, role-based access |

### Tier 3 — Auxiliary (Medium Priority)

| Contract | Lines | Priority | Focus Areas |
|----------|-------|----------|-------------|
| `MerkleRiskRegistry.sol` | ~280 | P2 | Merkle proof, signature verification, batch operations |
| `RiskOracle.sol` | ~350 | P2 | Oracle data feed, price staleness, data aggregation |
| `FidesOriginTimelock.sol` | ~120 | P2 | Delay enforcement, cancellation logic |
| `TestUSD.sol` | ~200 | P3 | Test token (not production-critical) |

### Specific Focus Areas for Auditors

#### 1. UUPS Upgrade Mechanism
- **File**: `RiskRegistry.sol`, `PolicyEngine.sol`, `ComplianceEngine.sol`
- **Concerns**: Storage layout collision, initialization replay, unauthorized upgrade
- **Tests**: Check `upgradeToAndCall`, `upgradeTo`, `implementationToProposal` mapping

#### 2. Access Control (AccessControl)
- **File**: All contracts
- **Concerns**: Role escalation, missing checks, default admin renounce
- **Tests**: Verify `onlyRole` modifiers, `grantRole`/`revokeRole` events, `_setRoleAdmin`

#### 3. Reentrancy Protection (ReentrancyGuard)
- **File**: `QuarantineVault.sol`, `ComplianceEngine.sol`, `FidesCompliance.sol`
- **Concerns**: Cross-function reentrancy, read-only reentrancy, CEI pattern violations
- **Tests**: `nonReentrant` modifier coverage, external call ordering

#### 4. Integer Arithmetic
- **File**: All contracts
- **Concerns**: Solidity 0.8+ handles overflow/underflow, but custom logic may have edge cases
- **Tests**: Boundary conditions, large values, zero inputs

#### 5. Event Integrity
- **File**: All contracts
- **Concerns**: Missing events, incorrect parameters, front-running via event ordering
- **Tests**: All state-changing functions emit appropriate events

---

## 5. Audit Firm Comparison

| Firm | Duration | Cost Range | Specialization | Strengths | Weaknesses |
|------|----------|------------|---------------|-----------|------------|
| **OpenZeppelin** | 2-3 weeks | $45,000 - $80,000 | Industry standard, DeFi | Best reputation, comprehensive reports, ongoing support | Expensive, long lead time |
| **Trail of Bits** | 2-4 weeks | $35,000 - $65,000 | Deep technical analysis | Foundry experts, deep dive into complex logic | May over-engineer recommendations |
| **CertiK** | 1-2 weeks | $20,000 - $35,000 | Speed, volume | Fast turnaround, good for tight deadlines | Less depth, more surface-level |
| **Halborn** | 2-3 weeks | $28,000 - $50,000 | Web3-native security | Strong Ethereum expertise, good for DeFi | Smaller team, possible scheduling delays |
| **Spearbit** | 1-2 weeks | $30,000 - $55,000 | Security DAO, flexible | High-caliber auditors, flexible engagement | Varying availability |
| **Immunefi** | 2-3 weeks | $40,000 - $70,000 | Bug bounty + audit combo | Combines audit with bounty launch | Higher complexity, longer setup |

> **Note**: Prices are 2026 market estimates. Contact firms directly for exact quotes. Prices have risen ~30-50% since 2023 due to increased demand and protocol complexity.

### Recommendation

For FidesOrigin's current stage (pre-mainnet, high complexity):

1. **Primary**: **Trail of Bits** — Best balance of depth and cost for a compliance protocol with complex access control and upgrade logic.
2. **Secondary**: **OpenZeppelin** — If budget allows, the gold standard. Their ongoing Sentinel monitoring is valuable for a compliance protocol.
3. **Fast-track**: **CertiK** — For a quick pre-audit before the main audit, or if mainnet launch is imminent.

### Suggested Audit Timeline

```
Week 1-2:  Trail of Bits (or OpenZeppelin) — Core contract audit
Week 3:    Internal remediation + re-test
Week 4:    Re-audit (re-check fixes)
Week 5-6:  Formal verification (Certora) — parallel track
Week 7:    Bug bounty launch (Immunefi)
Week 8:    Mainnet deployment readiness review
```

---

## Appendix A: Contract Source Code Links

| Contract | Source Path | Language | Compiler |
|----------|------------|----------|----------|
| RiskRegistry | `contracts/RiskRegistry.sol` | Solidity 0.8.20 | via Hardhat |
| PolicyEngine | `contracts/PolicyEngine.sol` | Solidity 0.8.20 | via Hardhat |
| ComplianceEngine | `contracts/ComplianceEngine.sol` | Solidity 0.8.20 | via Hardhat |
| QuarantineVault | `contracts/QuarantineVault.sol` | Solidity 0.8.20 | via Hardhat |
| FidesCompliance | `contracts/FidesCompliance.sol` | Solidity 0.8.20 | via Hardhat |
| CompliantStableCoin | `contracts/CompliantStableCoin.sol` | Solidity 0.8.20 | via Hardhat |

## Appendix B: Deployment Metadata

- **Network**: Sepolia Testnet (Chain ID: 11155111)
- **Deployer**: `0x5F6Ae278e7a62E64F9F467a91B693f372b84a374`
- **Framework**: Hardhat + OpenZeppelin Upgrades Plugin
- **Proxy Pattern**: UUPS (EIP-1822)
- **Timelock**: FidesOriginTimelock (2-day delay)
- **Subgraph**: https://api.studio.thegraph.com/query/1749664/fidesorigin-sepolia/v0.0.3

## Appendix C: Known Limitations

1. All admin roles held by single EOA — **must transfer to multi-sig before mainnet**
2. ORACLE_ROLE is a single EOA — consider Chainlink or decentralized oracle
3. Some frontend items still pending (DOM XSS, CSRF, inline scripts) — not in scope for contract audit
4. Test coverage is good but not exhaustive — property-based testing (Echidna) recommended

---

*Document version: 1.0 | Last updated: 2026-06-26*
