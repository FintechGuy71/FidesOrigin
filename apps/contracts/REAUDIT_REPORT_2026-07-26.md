# FidesOrigin Smart Contracts — Re-Audit Report (Round 2)

**Audit Date:** 2026-07-26  
**Scope:** Post-fix re-audit of all contracts at `/apps/contracts/`  
**Focus Areas:** Security of new/modified code, fix-induced regressions, gas, test gaps, deployment risks  
**Auditor:** Kimi Claw (Subagent)

---

## Executive Summary

This re-audit examined the FidesOrigin contracts **after** the 2026-07-23 audit fixes were applied. While many Critical/High issues from the first round were addressed, **this audit discovered 10 Critical, 10 High, and 10 Medium issues** in the newly added or modified code. Several "fixes" introduced new bugs, test coverage for new functionality is severely lacking, and at least one deployment script contains a syntax error that would prevent execution.

**Key Findings:**
- 🚨 **The QuarantineVault `claimDelay` default (`type(uint256).max`) does NOT cleanly disable `claimFunds`** — it causes an arithmetic overflow panic instead of a clean revert.
- 🚨 **The DiamondCutFacet timelock has no cancellation mechanism** — a proposed malicious cut cannot be stopped.
- 🚨 **ComplianceCoreFacet in the Diamond removes the `onlyRole(OPERATOR_ROLE)` guard** from `checkAddressCompliance`, making it a public griefing vector.
- 🚨 **Zero test coverage** for `claimFunds`, `setClaimDelay`, `setClaimRequiresApproval`, `proposeDiamondCut`, and `previewTransaction`.
- 🚨 **Deployment script `deploy-v3.0.4-sepolia.js` has duplicate `const` declarations** and will crash on execution.

---

## Critical Issues (10)

### C-01: Diamond ComplianceCoreFacet `checkAddressCompliance` Is Fully Public — Griefing Vector
**File:** `contracts/facets/ComplianceCoreFacet.sol`  
**Line:** `checkAddressCompliance()` function  
**Issue:** The standalone `ComplianceEngine.sol` version has `onlyRole(OPERATOR_ROLE)` on `checkAddressCompliance`, but the Diamond facet version (`ComplianceCoreFacet`) removed this modifier. The function is now `public whenNotPaused` with **no role restriction**.  
**Impact:** Anyone can call it to:
- Fill `checkHistory` (capped at 10,000, cyclic overwrite)
- Increment `totalChecks` and `addressCheckCount[addr]`  
**This is the H-05 issue from the previous audit, but the Diamond version made it worse, not better.**

### C-02: QuarantineVault `claimFunds` Overflows When `claimDelay == type(uint256).max`
**File:** `contracts/QuarantineVault.sol`  
**Line:** `claimFunds()` — `uint256 claimableAfter = record.timestamp + claimDelay;`  
**Issue:** The default `claimDelay = type(uint256).max` is intended to disable `claimFunds`. However, for any real record (`record.timestamp > 0`), `record.timestamp + type(uint256).max` **overflows in Solidity 0.8.x** and reverts with Panic(0x11). It does NOT cleanly emit `ClaimDelayNotMet`.  
**Impact:** Users get an opaque panic revert instead of a meaningful error. Off-chain indexers monitoring for `ClaimDelayNotMet` will never see it. If `record.timestamp == 0` (impossible for real records), it would work correctly.  
**Fix:** Add `if (claimDelay == type(uint256).max) revert ClaimDelayNotMet(type(uint256).max);` before the addition.

### C-03: DiamondCutFacet Has No Proposal Cancellation
**File:** `contracts/facets/DiamondCutFacet.sol`  
**Issue:** Once `proposeDiamondCut` is called, the proposal hash is stored with a 48-hour timelock. There is **no `cancelDiamondCutProposal` function**. If a compromised key proposes a malicious cut, or if the owner makes a mistake, the proposal cannot be cancelled. It can only be executed after 48 hours or left to expire (but it never actually expires — it just sits in the mapping forever).  
**Impact:** Malicious or erroneous proposals are irrevocable. If the owner loses control, the timelock is the only protection.

### C-04: Diamond Tests Use Old `diamondCut` Pattern — Tests Are Broken
**File:** `test/DiamondComplianceEngine.test.js`  
**Lines:** Multiple tests call `diamond.diamondCut(cut, ...)` directly without `proposeDiamondCut` first.  
**Issue:** The `DiamondCutFacet` was modified to require a 48-hour timelock (`proposeDiamondCut` → wait → `diamondCut`). The existing tests still call `diamondCut` directly, which will now revert with `NoProposalFound`. **These tests will fail if run.**  
**Impact:** The entire Diamond test suite is non-functional against the current contract code.

### C-05: RiskRegistryV2 `emergencySanction` Overwrites `preSanctionProfiles`
**File:** `contracts/RiskRegistryV2.sol`  
**Line:** `emergencySanction()` — `preSanctionProfiles[accounts[i]] = packed;`  
**Issue:** If an address is emergency-sanctioned twice, the second call **overwrites** the original `preSanctionProfiles`. `removeSanction` can then only restore to the most recent pre-sanction state, not the original.  
**Impact:** Original risk profile data is permanently lost after multiple sanctions.  
**Note:** This was M-08 in the previous audit and was **not fixed**.

### C-06: `claimFunds` / `setClaimDelay` / `setClaimRequiresApproval` Have ZERO Test Coverage
**File:** `test/QuarantineVault.test.js`  
**Issue:** A comprehensive grep of all test files found **no tests at all** for:
- `claimFunds` (the user self-claim path)
- `setClaimDelay` (admin function to enable/disable claims)
- `setClaimRequiresApproval` (admin function to flag records)  
**Impact:** The entire HIGH-3 fix (claim delay & approval system) is untested. The overflow bug in C-02 would have been caught immediately with even a single test.

### C-07: `proposeDiamondCut` / DiamondCut Timelock Have ZERO Test Coverage
**File:** `test/DiamondComplianceEngine.test.js`  
**Issue:** The M-01 fix (DiamondCut timelock) added `proposeDiamondCut`, `DiamondCutProposed` event, `TimelockNotExpired` error, and the 48-hour delay. **None of these are tested.** As noted in C-04, the existing tests don't even use the new flow.

### C-08: `previewTransaction` Has ZERO Test Coverage
**File:** `test/FidesCompliance.extended.test.js`  
**Issue:** The M-03 fix added `previewTransaction` as a pure view alternative to `evaluateTransaction`. No tests verify its behavior, authorization logic, or that it matches `evaluateTransaction`'s decision logic.

### C-09: `BaseFacet` Role Changes Emit NO Events
**File:** `contracts/facets/BaseFacet.sol`  
**Lines:** `_grantRole()`, `_revokeRole()`, `_setRoleAdmin()`  
**Issue:** `BaseFacet` reimplements AccessControl in Diamond Storage but **does not emit any events** for role changes. The OpenZeppelin `RoleGranted` / `RoleRevoked` events are absent. Off-chain indexers cannot track who has what role in the Diamond.  
**Impact:** Complete blindness for monitoring tools. The Diamond's role state is invisible to Subgraph/indexers.  
**Note:** `AdminFacet.grantRoleWithReason` emits a custom event, but `_grantRole` (used in `initialize` and internal flows) emits nothing.

### C-10: Deployment Script `deploy-v3.0.4-sepolia.js` Has Syntax Error
**File:** `scripts/deploy-v3.0.4-sepolia.js`  
**Line:** Duplicate `const fs = require('fs'); const path = require('path');` declarations  
**Issue:** The file imports `fs` and `path` at the top, then **redeclares them with `const`** ~40 lines later. In strict mode JS, this throws a `SyntaxError: Identifier 'fs' has already been declared`. **The script will not execute.**  
**Impact:** The primary Sepolia deployment/upgrade script is completely broken.

---

## High Issues (10)

### H-01: AdminFacet `withdrawETH` Uses Diamond Owner, Not BaseFacet Roles
**File:** `contracts/facets/AdminFacet.sol`  
**Line:** `withdrawETH()` — `LibDiamond.enforceIsContractOwner();`  
**Issue:** This function bypasses the BaseFacet role system entirely and checks the Diamond's `contractOwner` instead. If ownership is transferred via `LibDiamond.setContractOwner` (e.g., to a timelock) but BaseFacet roles remain with an EOA, the EOA cannot withdraw ETH. Conversely, if the Diamond owner is compromised, they can drain ETH even without `DEFAULT_ADMIN_ROLE`.  
**Impact:** Dual-admin inconsistency creates confusion and potential lockout or unauthorized access.

### H-02: Inconsistent Access Control Between Standalone and Diamond Versions
**File:** `contracts/ComplianceEngine.sol` vs `contracts/facets/ComplianceCoreFacet.sol`  
**Issue:** The standalone UUPS `ComplianceEngine` has `onlyRole(OPERATOR_ROLE)` on `checkAddressCompliance`. The Diamond `ComplianceCoreFacet` does not (see C-01). The standalone has `onlyRole(ADMIN_ROLE)` on `setRiskRegistry`/`setPolicyEngine`. The Diamond's `AdminFacet` also requires `ADMIN_ROLE`. But the `checkTransactionCompliance` function in the standalone version lacks `whenNotPaused`, while the Diamond version has it.  
**Impact:** Deployers cannot assume the Diamond behaves identically to the standalone contract. Security assumptions may be violated.

### H-03: QuarantineVault ETH Transfer Gas Limit Is 10000, Not 2300
**File:** `contracts/QuarantineVault.sol`  
**Lines:** `releaseFunds`, `batchReleaseFunds`, `claimFunds` — `gas: 10000`  
**Issue:** The previous audit (H-02) stated the fix was to limit ETH transfers to **2300 gas**. The current code uses **10000 gas**. While `nonReentrant` protects against reentrancy, 10000 gas is enough for significant computation (e.g., token transfers, multiple SSTOREs). A malicious `originalOwner` contract could use the extra gas for griefing (e.g., burning gas to increase transaction cost).  
**Impact:** Inconsistent with the documented fix. Gas griefing possible despite `nonReentrant`.

### H-04: RiskRegistryV2 `_authorizeUpgrade` Has Duplicate `require`
**File:** `contracts/RiskRegistryV2.sol`  
**Lines:** `_authorizeUpgrade()`  
**Issue:** The exact same `require(version >= UPGRADE_FROM_VERSION, ...)` statement appears **twice** in the function body (once labeled "C-3 FIX", once labeled "H-02 FIX"). The second is dead code.  
**Impact:** No direct security impact, but signals sloppy code review and increases deployment gas.

### H-05: MerkleRiskRegistryFacet Roles Never Granted During Initialization
**File:** `contracts/facets/MerkleRiskRegistryFacet.sol`  
**Issue:** The facet defines `ORACLE_ROLE` and `RELAYER_ROLE`, but `AdminFacet.initialize()` only grants `DEFAULT_ADMIN_ROLE`, `ADMIN_ROLE`, and `OPERATOR_ROLE`. No function in the Diamond grants `ORACLE_ROLE` or `RELAYER_ROLE` by default.  
**Impact:** `MerkleRiskRegistryFacet.updateMerkleRoot`, `setAddressRiskScore`, `addAddressTag`, etc. will **always revert with "Missing role"** unless an admin manually grants the role post-deployment. The facet is effectively non-functional out of the box.

### H-06: `FidesCompliance.evaluateTransaction` Bypasses `whenNotPaused`
**File:** `contracts/FidesCompliance.sol`  
**Line:** `evaluateTransaction()`  
**Issue:** The function has `nonReentrant` but **no `whenNotPaused`**. It calls `complianceEngine.checkTransfer()`, which **does** modify state (`dailySpent`, `lastTransferTime`). If `FidesCompliance` is paused but `ComplianceEngine` is not, state modifications still occur through this path.  
**Impact:** Pausable inconsistency. Emergency pause on FidesCompliance does not fully stop the compliance pipeline.

### H-07: RiskRegistryV2 `removeSanction` Does Not Update `_lastUpdateTime`
**File:** `contracts/RiskRegistryV2.sol`  
**Line:** `removeSanction()`  
**Issue:** After removing a sanction, `_lastUpdateTime[account]` retains the timestamp of the `emergencySanction` or last `updateRiskProfile` call. A subsequent `updateRiskProfile` by an oracle may then fail `MIN_UPDATE_INTERVAL` because the removal didn't reset the timestamp.  
**Impact:** Oracles may be unable to update a de-sanctioned address for up to 1 hour after removal.

### H-08: QuarantineVault `withdrawETH` Has No Gas Limit
**File:** `contracts/QuarantineVault.sol`  
**Line:** `withdrawETH()` — `(bool ok, ) = to.call{value: balance}("");`  
**Issue:** The emergency ETH withdrawal forwards **all available gas** to the recipient. If `to` is a malicious contract, it can execute arbitrary logic (though `nonReentrant` prevents reentry into QuarantineVault).  
**Impact:** Gas griefing. A malicious EMERGENCY_ROLE holder (or compromised key) could route ETH through a gas-consuming contract.

### H-09: `CompliantStableCoin.postTransferHook` Still Fails Silently
**File:** `contracts/examples/CompliantStableCoin.sol`  
**Line:** `_update()` → `complianceEngine.postTransferHook(...)`  
**Issue:** `postTransferHook` on `AssetComplianceFacet` / `ComplianceEngine` requires `OPERATOR_ROLE`. `CompliantStableCoin` is never granted this role. The `try/catch` silently swallows the revert. `TransferRecorded` event is never emitted.  
**Impact:** Post-transfer analytics and indexing are completely broken. This was H-03 in the previous audit and remains **unfixed**.

### H-10: `DiamondLoupeFacet.facetAddresses()` Still O(n²)
**File:** `contracts/facets/DiamondLoupeFacet.sol`  
**Line:** `facetAddresses()`  
**Issue:** While `facets()` and `facetFunctionSelectors()` were fixed to use the cached `facetSelectors` mapping, `facetAddresses()` still iterates all selectors with a nested deduplication loop.  
**Impact:** View call gas exhaustion for frontends/indexers when the Diamond has >100 selectors. Previous audit H-06 was only partially fixed.

---

## Medium Issues (10)

### M-01: Inconsistent Authorization in `evaluateTransaction` vs `checkAndExecuteTransaction`
**File:** `contracts/FidesCompliance.sol`  
**Issue:** `evaluateTransaction` allows `msg.sender == from || hasRole(OPERATOR_ROLE, msg.sender)`. `checkAndExecuteTransaction` requires `msg.sender == from` strictly. A user cannot call `checkAndExecuteTransaction` via a relayer, but they CAN call `evaluateTransaction` via a relayer. Inconsistent UX and security assumptions.

### M-02: Inconsistent Batch Error Handling
**File:** `contracts/QuarantineVault.sol`  
**Issue:** `batchDeposit` **reverts entirely** if any item is invalid (zero address, zero amount). `batchReleaseFunds` **skips** invalid items and emits `BatchReleaseFailed`. Inconsistent design patterns make integration unpredictable.

### M-03: DiamondCut Proposal Hash Doesn't Include Timestamp — Replay Risk
**File:** `contracts/facets/DiamondCutFacet.sol`  
**Line:** `proposeDiamondCut()` — `keccak256(abi.encode(_diamondCut, _init, _calldata))`  
**Issue:** The proposal hash does not include `block.timestamp`. If the exact same cut is proposed, executed, deleted, and then proposed again, it will have the **same hash** but a new timestamp. This is actually fine because the timestamp is stored separately... but if a proposal is never executed and never deleted, it sits in the mapping forever. If someone later accidentally proposes the same thing, the old `executeAfter` might have already passed, allowing **immediate execution** without a fresh 48-hour wait.  
**Impact:** A forgotten old proposal could be executed instantly upon re-proposal.

### M-04: `AdminFacet.initialize` Doesn't Emit Role Events
**File:** `contracts/facets/AdminFacet.sol`  
**Issue:** The `initialize` function grants three roles via `_grantRole` (internal, no events). Off-chain tools have no way to know which addresses were granted roles during Diamond initialization.

### M-05: `emergencySanction` Skips Already-Sanctioned Addresses Silently
**File:** `contracts/RiskRegistryV2.sol`  
**Line:** `emergencySanction()` — `if (sanctionedAddresses[accounts[i]]) continue;`  
**Issue:** If an address is already sanctioned, the loop silently `continue`s. No event is emitted. The caller has no on-chain signal that the address was skipped.  
**Impact:** Batch sanction operations may appear to succeed for all addresses when some were actually skipped.

### M-06: `QuarantineVault.setClaimDelay` Allows Zero Delay
**File:** `contracts/QuarantineVault.sol`  
**Line:** `setClaimDelay()`  
**Issue:** Setting `_delay = 0` makes `claimableAfter = record.timestamp`, allowing **instant claiming**. There is no minimum delay validation. An admin could accidentally or maliciously enable instant withdrawals.  
**Impact:** Operational risk. A single admin mistake enables immediate user withdrawals.

### M-07: `claimFunds` Emits `FundsReleased` Instead of `FundsClaimed`
**File:** `contracts/QuarantineVault.sol`  
**Line:** `claimFunds()`  
**Issue:** The user-claim path emits the same `FundsReleased` event as the admin-release path. Off-chain indexers cannot distinguish between admin-released funds and user-claimed funds without parsing `releasedBy == originalOwner`.  
**Impact:** Analytics and audit trails conflate two distinct operations.

### M-08: `_checkRisk` Duplicated Across Three Facets
**Files:** `ComplianceCoreFacet.sol`, `AssetComplianceFacet.sol`, `WalletComplianceFacet.sol`  
**Issue:** The identical `_checkRisk` internal function is copy-pasted in three facets. Any future fix to risk logic must be applied in three places.  
**Impact:** Maintenance burden and risk of inconsistency during future updates.

### M-09: `FidesCompliance.evaluateTransaction` Doesn't Update Transaction Stats
**File:** `contracts/FidesCompliance.sol`  
**Issue:** Unlike `checkAndExecuteTransaction` (which increments `totalTransactionsChecked`, `totalTransactionsAllowed`, etc.), `evaluateTransaction` updates **no statistics** on `FidesCompliance`. Users may assume it counts as a "check" but it doesn't.  
**Impact:** Metrics under-reporting. The "checked" counter only reflects `checkAndExecuteTransaction` usage.

### M-10: `deploy-v3.0.4-sepolia.js` Bypasses Upgrade Timelocks
**File:** `scripts/deploy-v3.0.4-sepolia.js`  
**Line:** `upgradeProxy()` function  
**Issue:** The script calls `proxy.upgradeToAndCall(newImplAddr, '0x')` **directly** without calling `proposeUpgrade` first. For `RiskRegistryV2`, this would fail because `_authorizeUpgrade` checks the timelock. But for older proxies (ComplianceEngine, PolicyEngine), the script may succeed depending on their `_authorizeUpgrade` implementation.  
**Impact:** Inconsistent upgrade behavior. Some proxies may upgrade instantly while others fail.

---

## Low / Informational (5)

### L-01: `DiamondCutFacet.proposeDiamondCut` Doesn't Emit Cut Details
**File:** `contracts/facets/DiamondCutFacet.sol`  
**Issue:** The `DiamondCutProposed` event only emits `proposalHash` and `executeAfter`. It does not include the actual `_diamondCut` configuration, making off-chain verification impossible without computing the hash locally.

### L-02: `BaseFacet` `nonReentrant` Initial State Is `0`, Not `1`
**File:** `contracts/facets/BaseFacet.sol`  
**Issue:** `reentrancyStatus` initializes to `0`. The modifier checks `!= 2` (pass), sets to `2`, then resets to `1`. After the first call, the state is `1`. This is functionally correct but unusual — the standard pattern initializes to `1`.

### L-03: RiskRegistryV2 `_authorizeUpgrade` Duplicate Require
**Note:** Already listed as H-04. Additional note: the duplicate was likely copy-pasted during merge and not caught in review.

### L-04: `QuarantineVault` Constructor Grants Roles Without Events
**File:** `contracts/QuarantineVault.sol`  
**Issue:** The constructor grants 5 roles via `_grantRole` (OpenZeppelin AccessControl) which DOES emit `RoleGranted` events. Actually this is fine — OZ emits events. But the `BaseFacet` version (C-09) does not.

### L-05: `DiamondLoupeFacet.facetsPaginated` Doesn't Validate `limit > 0`
**File:** `contracts/facets/DiamondLoupeFacet.sol`  
**Issue:** If `limit = 0`, `facetsPaginated` returns an empty array. Not a bug, but callers might not expect this behavior.

---

## Test Coverage Assessment

| Function / Feature | Tested? | Notes |
|--------------------|---------|-------|
| `QuarantineVault.claimFunds` | ❌ NO | Completely untested. C-02 overflow bug lives here. |
| `QuarantineVault.setClaimDelay` | ❌ NO | Untested. |
| `QuarantineVault.setClaimRequiresApproval` | ❌ NO | Untested. |
| `DiamondCutFacet.proposeDiamondCut` | ❌ NO | Untested. C-04 broken tests. |
| `DiamondCutFacet.diamondCut` (timelock path) | ❌ NO | Old tests bypass timelock. |
| `FidesCompliance.previewTransaction` | ❌ NO | Untested. |
| `FidesCompliance.evaluateTransaction` | ✅ YES | `FidesCompliance.extended.test.js` covers it. |
| `BaseFacet.hasRole` / `grantRole` | ✅ YES | Via `AdminFacet` tests. |
| `MerkleRiskRegistryFacet` | ⚠️ PARTIAL | Exists in Diamond tests but no role-specific tests. |
| `RiskRegistryV2.emergencySanction` | ⚠️ PARTIAL | RiskRegistry.test.js exists but may not cover overwrite. |
| `RiskRegistryV2.removeSanction` | ⚠️ PARTIAL | Same. |
| `QuarantineVault` ETH paths | ⚠️ PARTIAL | `receive()` tested, but `releaseFunds` ETH path not tested. |

**Verdict:** Critical gaps in test coverage for all new HIGH-3 fix functions and the DiamondCut timelock. The previous audit's test recommendations (Diamond lifecycle, QuarantineVault ETH claim, RiskOracle voting) remain largely unaddressed.

---

## Deployment Script Risks

| Script | Risk Level | Issue |
|--------|-----------|-------|
| `deploy-v3.0.4-sepolia.js` | 🔴 **CRITICAL** | Duplicate `const` declarations — script will not execute. |
| `deploy-v3.0.4-sepolia.js` | 🟠 HIGH | `upgradeProxy()` bypasses `proposeUpgrade` timelock for some contracts. |
| `deploy-diamond-sepolia.js` | 🟡 MEDIUM | Uses `gasLimit: 5000000` which may be insufficient for large facet cuts. |
| `deploy-diamond-sepolia.js` | 🟡 MEDIUM | Skips `initialize` selector registration (correct) but doesn't document this. |
| `deploy-diamond-sepolia.js` | 🟢 LOW | Hardcodes Sepolia contract addresses; no validation that they exist/have code. |

---

## Assessment of Specific Questions

### 1. Security of New Functions
- **`evaluateTransaction`** (FidesCompliance): ✅ Properly secured with `nonReentrant` and caller validation. Does not check `whenNotPaused` (H-06).
- **`previewTransaction`** (FidesCompliance): ✅ Pure view, no state changes. Same authorization as `evaluateTransaction`. No tests (C-08).
- **`proposeDiamondCut`** (DiamondCutFacet): ✅ Properly restricted to `LibDiamond.enforceIsContractOwner()`. No cancel function (C-03). No tests (C-07).

### 2. Diamond Storage Fix in BaseFacet
**Verdict:** ✅ **Works correctly.**
- `BASE_FACET_STORAGE_POSITION` = `keccak256("fidesorigin.base.facet.storage")`
- `LibComplianceStorage.DIAMOND_STORAGE_POSITION` = `keccak256("compliance.engine.diamond.storage")`
- `LibDiamond.DIAMOND_STORAGE_POSITION` = `keccak256("diamond.standard.diamond.storage")`
All three positions are distinct. No collision possible.

### 3. QuarantineVault `claimDelay` Default
**Verdict:** 🚨 **Does NOT properly disable `claimFunds`.**
- Default: `claimDelay = type(uint256).max`
- Expected behavior: Clean revert with `ClaimDelayNotMet`
- Actual behavior: **Arithmetic overflow panic (Panic 0x11)** on `record.timestamp + claimDelay`
- Fix required: Guard the addition (see C-02).

---

## Recommendations (Priority Order)

1. **IMMEDIATE — Fix C-02:** Add overflow guard to `QuarantineVault.claimFunds` before the `record.timestamp + claimDelay` addition.
2. **IMMEDIATE — Fix C-10:** Remove duplicate `const` declarations in `deploy-v3.0.4-sepolia.js`.
3. **HIGH — Fix C-01:** Add `onlyRole(OPERATOR_ROLE)` to `ComplianceCoreFacet.checkAddressCompliance` to match standalone behavior.
4. **HIGH — Fix C-03:** Add `cancelDiamondCutProposal(bytes32 proposalHash)` to `DiamondCutFacet`.
5. **HIGH — Fix C-04:** Update Diamond tests to use `proposeDiamondCut` → advance time → `diamondCut` flow.
6. **HIGH — Add Tests:** Write comprehensive tests for `claimFunds`, `setClaimDelay`, `setClaimRequiresApproval`, `proposeDiamondCut`, and `previewTransaction`.
7. **MEDIUM — Fix H-05:** Grant `ORACLE_ROLE` and `RELAYER_ROLE` in `AdminFacet.initialize` or document that they must be granted post-deployment.
8. **MEDIUM — Fix H-01:** Consider making `withdrawETH` use `onlyRole(DEFAULT_ADMIN_ROLE)` instead of `LibDiamond.enforceIsContractOwner()` for consistency.
9. **MEDIUM — Fix H-03:** Reduce ETH transfer gas limit to 2300 (or document why 10000 is necessary).
10. **LOW — Fix H-10:** Update `DiamondLoupeFacet.facetAddresses()` to use cached `facetSelectors`.

---

*End of Re-Audit Report*
