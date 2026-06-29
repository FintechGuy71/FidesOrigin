# FidesOrigin Formal Verification Preparation

> Prepared for: Formal Verification Tooling (Certora / K Framework)
> Prepared on: 2026-06-26
> Protocol Version: v0.4.0 Sepolia

---

## 1. Contracts & Functions Suitable for Formal Verification

### Tier 1 — Critical (Must Verify)

| Contract | Function | Why Critical | Complexity |
|----------|----------|-------------|------------|
| `RiskRegistry` | `updateRiskProfile(address, RiskProfile)` | Core risk data; incorrect values affect all downstream decisions | Medium |
| `RiskRegistry` | `getRiskScore(address)` | Returns canonical risk score; must be deterministic | Low |
| `RiskRegistry` | `upgradeToAndCall(address, bytes)` | UUPS upgrade; any bug = total protocol loss | High |
| `PolicyEngine` | `evaluateTransfer(address, address, uint256, address)` | Transaction approval gate; must not allow bypass | High |
| `PolicyEngine` | `setRiskTierThresholds(IAssetCompliance.RiskTier => uint256)` | Thresholds determine compliance decisions | Medium |
| `ComplianceEngine` | `checkTransfer(address, address, uint256, address)` | Daily limit enforcement | Medium |
| `ComplianceEngine` | `releaseQuarantine(bytes32)` | Fund release; must not allow unauthorized release | Medium |
| `QuarantineVault` | `releaseFunds(bytes32)` | Direct fund release; reentrancy risk | Medium |
| `FidesCompliance` | `checkAndExecuteTransaction(address, address, uint256, address, uint256)` | End-to-end compliance + execution | High |

> **Note**: Only `RiskRegistry`, `PolicyEngine`, and `ComplianceEngine` are UUPS proxies. `FidesCompliance`, `QuarantineVault`, and `CompliantStableCoin` are direct-deploy contracts. Do not write UUPS upgrade rules for direct-deploy contracts.

### Tier 2 — Important (Should Verify)

| Contract | Function | Why Important | Complexity |
|----------|----------|--------------|------------|
| `RiskRegistry` | `batchUpdateRiskProfiles(address[], RiskProfile[])` | Batch correctness; partial failure handling | Medium |
| `RiskRegistry` | `removeRiskProfile(address)` | State cleanup; must not corrupt storage | Low |
| `PolicyEngine` | `setIssuerPolicy(address, Policy)` | Policy configuration; must be consistent | Low |
| `ComplianceEngine` | `batchReleaseFunds(address[], uint256[])` | Batch fund release; atomicity concerns | Medium |
| `CompliantStableCoin` | `mint(address, uint256)` | Supply inflation; must respect role checks | Low |
| `CompliantStableCoin` | `burn(address, uint256)` | Supply deflation; must respect role checks | Low |
| `MerkleRiskRegistry` | `verifyAndSetRiskScore(bytes32[], address, uint256, bytes)` | Merkle proof + signature; must not allow forgery | High |

### Tier 3 — Supporting (Nice to Have)

| Contract | Function | Notes |
|----------|----------|-------|
| `RiskRegistry` | `scheduleUpgrade(address)` | Timelock delay enforcement |
| `RiskRegistry` | `executeUpgrade(uint256)` | Proposal execution after delay |
| `ComplianceEngine` | `setDailyLimit(address, uint256)` | Configuration bounds |
| `FidesCompliance` | `setComplianceThresholds(...)` | Threshold consistency |
| `CompliantStableCoin` | `pause()` / `unpause()` | Pauser role enforcement |

---

## 2. Tooling Recommendation: Certora vs K Framework

### Comparison Matrix

| Criteria | Certora | K Framework |
|----------|---------|-------------|
| **Maturity** | Very mature for Ethereum | Mature, but more general-purpose |
| **Learning Curve** | Moderate (CVL syntax) | Steep (K language) |
| **Ecosystem** | Strong DeFi adoption (Aave, Compound, Maker) | Academic + enterprise |
| **CI Integration** | Excellent (GitHub Actions, Docker) | Good (K server, manual setup) |
| **Verification Speed** | Fast (cloud-based prover) | Slower (local prover) |
| **Spec Reusability** | High (specs are reusable across versions) | Medium |
| **Cost** | ~$15-30K / audit cycle | Open source (self-hosted) |
| **Community** | Active Discord, good docs | Academic community |
| **IDE Support** | VS Code extension | Limited |
| **Best For** | DeFi protocols, access control, invariants | Novel consensus, VM verification |

### Recommendation: Certora

For FidesOrigin, **Certora** is the recommended choice because:

1. **DeFi-native**: Built specifically for Ethereum smart contract verification
2. **Proven track record**: Used by major protocols (Aave v3, Compound v3, Uniswap v4, Lido, MakerDAO)
3. **Access control expertise**: CVL has built-in patterns for role-based access control verification
4. **UUPS support**: Existing specs for OpenZeppelin UUPS pattern
5. **Time-efficient**: Cloud-based prover means faster iteration cycles
6. **Integration**: Easy GitHub Actions integration for CI

### K Framework Use Case

Consider K Framework for:
- **Long-term research**: Formalizing the entire FidesOrigin protocol semantics
- **Cross-chain verification**: If extending to non-EVM chains
- **Custom VM**: If building a custom execution environment
- **Academic collaboration**: University partnerships

### Suggested Approach: Hybrid

| Phase | Tool | Focus |
|-------|------|-------|
| Phase 1 | **Certora** | Core invariants, access control, upgrade safety |
| Phase 2 | **Certora** | Complete rule coverage for all Tier 1 + Tier 2 functions |
| Phase 3 | **K Framework** (optional) | Full protocol semantics, cross-chain properties |

---

## 3. Critical Invariants

### Invariant 1: Sanctioned → High Risk Score

```
forall address a:
  riskProfile[a].sanctioned == true → riskProfile[a].riskScore >= 75
```

- **Contract**: `RiskRegistry`
- **Rationale**: If an address is sanctioned, it must have a risk score of at least 75 (HIGH tier threshold)
- **Functions to check**: `updateRiskProfile`, `batchUpdateRiskProfiles`, `setRiskScore` (Merkle)
- **Counterexample risk**: Oracle sets sanctioned=true but riskScore=50
- **Spec importance**: ⭐⭐⭐⭐⭐

### Invariant 2: Critical Tier → Sanctioned

```
forall address a:
  riskProfile[a].tier == 4 (CRITICAL) → riskProfile[a].sanctioned == true
```

- **Contract**: `RiskRegistry` (via `PolicyEngine` interpretation)
- **Rationale**: An address at CRITICAL tier must be sanctioned; being at CRITICAL without being sanctioned is a logic error
- **Functions to check**: `updateRiskProfile`, `setRiskTierThresholds`, `evaluateTransaction`
- **Counterexample risk**: Tier promoted to CRITICAL but sanctioned remains false
- **Spec importance**: ⭐⭐⭐⭐⭐

### Invariant 3: Oracle-Only Risk Updates

```
forall address a, RiskProfile p:
  msg.sender must have ORACLE_ROLE to call updateRiskProfile(a, p)
```

- **Contract**: `RiskRegistry`
- **Rationale**: Only authorized oracles can modify risk profiles; unauthorized updates compromise the entire compliance system
- **Functions to check**: `updateRiskProfile`, `batchUpdateRiskProfiles`, `removeRiskProfile`
- **Counterexample risk**: Any address can call `updateRiskProfile` without role check
- **Spec importance**: ⭐⭐⭐⭐⭐

### Invariant 4: Daily Limit Monotonicity

```
forall address a, uint256 day:
  dailySpent[a][day] <= dailyLimit[a]
```

- **Contract**: `ComplianceEngine`
- **Rationale**: An address cannot spend more than its daily limit on any given day
- **Functions to check**: `checkCompliance`, `releaseQuarantine`, `batchReleaseFunds`
- **Counterexample risk**: Multiple releases in one day exceed limit
- **Spec importance**: ⭐⭐⭐⭐⭐

### Invariant 5: Quarantine Vault Balance Consistency

```
forall address a:
  quarantinedBalance[a] <= address(this).balance (for ETH) or token balance
```

- **Contract**: `QuarantineVault`
- **Rationale**: The protocol's recorded quarantined balance must not exceed actual holdings
- **Functions to check**: `releaseFunds`, `batchReleaseFunds`, `receive`
- **Counterexample risk**: Accounting bug allows releasing more than held
- **Spec importance**: ⭐⭐⭐⭐⭐

### Invariant 6: UUPS Upgrade Safety

```
forall address newImplementation:
  upgradeTo(newImplementation) → newImplementation has storageLayoutVersion() exposed
```

- **Contract**: `RiskRegistry`, `PolicyEngine`, `ComplianceEngine`
- **Rationale**: Prevents upgrading to incompatible implementations that corrupt storage
- **Functions to check**: `upgradeTo`, `upgradeToAndCall`, `scheduleUpgrade`, `executeUpgrade`
- **Counterexample risk**: Upgrade to contract without storage layout version check
- **Spec importance**: ⭐⭐⭐⭐⭐

### Invariant 7: Admin Role Non-Empty

```
forall bytes32 role:
  getRoleAdmin(role) != bytes32(0) → hasRole(getRoleAdmin(role), some_address) == true
```

- **Contract**: All `AccessControl` contracts
- **Rationale**: Every role must have an admin that can manage it; losing all admins = unrecoverable
- **Functions to check**: `grantRole`, `revokeRole`, `renounceRole`
- **Counterexample risk**: Admin renounces role without transferring
- **Spec importance**: ⭐⭐⭐⭐

### Invariant 8: StableCoin Supply Integrity

```
forall address a:
  totalSupply() == sum(balanceOf(all_addresses))
```

- **Contract**: `CompliantStableCoin`
- **Rationale**: Standard ERC-20 invariant; mint/burn must maintain supply integrity
- **Functions to check**: `mint`, `burn`, `_mint`, `_burn`
- **Spec importance**: ⭐⭐⭐⭐

---

## 4. Certora Specification Example

### File: `certora/specs/RiskRegistry.spec`

```cvl
// RiskRegistry Certora Specification
// FidesOrigin Protocol v0.4.0

using RiskRegistry as RiskRegistry;

// ---- Ghosts and Hooks ----

ghost mapping(address => uint256) ghostRiskScore;
ghost mapping(address => bool) ghostSanctioned;
ghost mapping(address => uint256) ghostTier;

hook Sstore riskProfiles[KEY address a].riskScore uint256 newScore {
    ghostRiskScore[a] = newScore;
}

hook Sstore riskProfiles[KEY address a].sanctioned bool newSanctioned {
    ghostSanctioned[a] = newSanctioned;
}

hook Sstore riskProfiles[KEY address a].riskTier uint8 newTier {
    ghostTier[a] = newTier;
}

hook Sload uint256 score riskProfiles[KEY address a].riskScore {
    require ghostRiskScore[a] == score;
}

hook Sload bool sanctioned riskProfiles[KEY address a].sanctioned {
    require ghostSanctioned[a] == sanctioned;
}

hook Sload uint8 tier riskProfiles[KEY address a].riskTier {
    require ghostTier[a] == tier;
}

// ---- Invariant: Sanctioned => High Risk Score ----

invariant sanctionedImpliesHighRisk(address a)
    ghostSanctioned[a] => ghostRiskScore[a] >= 75
    {
        preserved updateRiskProfile(address target, RiskRegistry.RiskProfile profile) with (env e) {
            require !hasRole(ORACLE_ROLE, e.msg.sender) => profile.sanctioned == ghostSanctioned[target];
        }
    }

// ---- Invariant: Critical Tier => Sanctioned ----

invariant criticalTierImpliesSanctioned(address a)
    ghostTier[a] == 4 => ghostSanctioned[a]
    {
        preserved updateRiskProfile(address target, RiskRegistry.RiskProfile profile) with (env e) {
            require profile.tier == 4 => profile.sanctioned;
        }
    }

// ---- Rule: Only ORACLE_ROLE can update risk profiles ----

rule onlyOracleCanUpdateRiskProfile(address target, RiskRegistry.RiskProfile profile) {
    env e;
    calldataarg args;
    
    require !hasRole(ORACLE_ROLE, e.msg.sender);
    
    storage init = lastStorage;
    updateRiskProfile(e, target, profile);
    
    assert lastStorage == init, "Non-oracle must not modify risk profile";
}

// ---- Rule: Risk score is deterministic ----

rule getRiskScoreDeterministic(address a) {
    env e1;
    env e2;
    
    uint256 score1 = getRiskScore(e1, a);
    uint256 score2 = getRiskScore(e2, a);
    
    assert score1 == score2, "getRiskScore must be deterministic";
}

// ---- Rule: Upgrade requires valid implementation ----

rule upgradeRequiresValidImplementation(address newImpl) {
    env e;
    
    require !hasRole(UPGRADER_ROLE, e.msg.sender) => (lastStorage == lastStorage);
    
    storage init = lastStorage;
    upgradeTo(e, newImpl);
    
    // If upgrade succeeded, newImpl must have been validated
    assert lastStorage != init => 
        newImpl.code.length > 0 &&
        _hasStorageLayout(newImpl),
        "Upgrade to invalid implementation must revert";

// CVL helper function (requires a harness or external contract call)
function _hasStorageLayout(address impl) returns bool {
    // In practice, call a view function or check a known interface selector
    return impl != address(0) && impl.code.length > 0;
}
}

// ---- Rule: Batch update consistency ----

rule batchUpdateAtomicity(address[] targets, RiskRegistry.RiskProfile[] profiles) {
    env e;
    
    require targets.length == profiles.length;
    require targets.length <= 100; // Practical limit for verification
    
    storage init = lastStorage;
    
    batchUpdateRiskProfiles@withrevert(e, targets, profiles);
    
    bool success = !lastReverted;
    
    // If successful, all profiles were updated
    assert success => 
        forall uint i. (i < targets.length => 
            riskProfile[targets[i]].riskScore == profiles[i].riskScore);
}

// ---- Rule: Remove profile clears state ----

rule removeProfileClearsState(address a) {
    env e;
    
    require hasRole(ORACLE_ROLE, e.msg.sender);
    
    removeRiskProfile(e, a);
    
    RiskRegistry.RiskProfile empty;
    assert riskProfile[a] == empty, "Removed profile must be zeroed";
}

// ---- Rule: Total profiles is monotonic (increments only on new) ----

rule totalProfilesMonotonic(address a, RiskRegistry.RiskProfile p) {
    env e;
    
    uint256 totalBefore = totalProfiles();
    
    // Check if profile exists before
    bool existedBefore = riskProfile[a].lastUpdated != 0;
    
    updateRiskProfile(e, a, p);
    
    uint256 totalAfter = totalProfiles();
    
    assert existedBefore => totalAfter == totalBefore, 
        "Update existing must not increment total";
    assert !existedBefore => totalAfter == totalBefore + 1, 
        "New profile must increment total";
}
```

### File: `certora/specs/ComplianceEngine.spec`

```cvl
// ComplianceEngine Certora Specification
// FidesOrigin Protocol v0.4.0

using ComplianceEngine as ComplianceEngine;

// ---- Invariant: Daily spent <= Daily limit ----

invariant dailyLimitEnforcement(address a, uint256 day)
    dailySpent[a][day] <= dailyLimit[a]
    {
        preserved checkCompliance(address target, uint256 amount) with (env e) {
            require target == a;
        }
        
        preserved releaseQuarantine(address target, uint256 amount) with (env e) {
            require target == a;
        }
    }

// ---- Rule: Quarantine release only by authorized ----

rule onlyAuthorizedCanRelease(address a, uint256 amount) {
    env e;
    
    require !hasRole(OPERATOR_ROLE, e.msg.sender);
    require !hasRole(DEFAULT_ADMIN_ROLE, e.msg.sender);
    
    storage init = lastStorage;
    releaseQuarantine@withrevert(e, a, amount);
    
    assert lastReverted, "Unauthorized release must revert";
}

// ---- Rule: History size is bounded ----

rule historySizeBounded(address a) {
    uint256 size = checkHistory[a].length;
    assert size <= MAX_HISTORY_SIZE, "History must not exceed max size";
}
```

### File: `certora/specs/PolicyEngine.spec`

```cvl
// PolicyEngine Certora Specification
// FidesOrigin Protocol v0.4.0

using PolicyEngine as PolicyEngine;
using RiskRegistry as RiskRegistry;

// ---- Invariant: Tier thresholds are monotonic ----
// NOTE: riskTierThresholds is a mapping(IAssetCompliance.RiskTier => uint256), not an array.
// In CVL, mapping(enum => uint256) is accessed by the enum's underlying uint8 value.
// LOW=0, MEDIUM=1, HIGH=2. CRITICAL is inferred as >= HIGH threshold.

invariant tierThresholdsMonotonic()
    tierThresholds[0] < tierThresholds[1] &&
    tierThresholds[1] < tierThresholds[2] &&
    tierThresholds[2] < tierThresholds[3]
    {
        preserved setRiskTierThresholds(IAssetCompliance.RiskTier tier, uint256 threshold) with (env e) {
            require hasRole(DEFAULT_ADMIN_ROLE, e.msg.sender);
        }
    }

// ---- Rule: Evaluate transaction respects tier logic ----
// NOTE: This rule assumes evaluateTransaction derives the tier from riskScore.
// In the actual contract, evaluateTransaction receives the tier as a parameter
// from the RiskRegistry. Verify this rule against the actual implementation
// or adjust to check the tier passed in matches the riskScore.

rule evaluateTransactionRespectsRisk(address from, address to, uint256 amount) {
    env e;
    
    uint256 riskScore = RiskRegistry.getRiskScore(e, from);
    PolicyEngine.RiskTier tier = evaluateTransaction(e, from, to, amount);
    
    assert riskScore < tierThresholds[0] => tier == LOW;
    assert riskScore >= tierThresholds[0] && riskScore < tierThresholds[1] => tier == MEDIUM;
    assert riskScore >= tierThresholds[1] && riskScore < tierThresholds[2] => tier == HIGH;
    assert riskScore >= tierThresholds[2] => tier == CRITICAL;
}

// ---- Rule: Deadline enforcement ----

rule deadlineEnforcement(address from, address to, uint256 amount, uint256 deadline) {
    env e;
    
    require e.block.timestamp > deadline;
    
    evaluateTransaction@withrevert(e, from, to, amount, deadline);
    
    assert lastReverted, "Expired deadline must revert";
}
```

### Certora Configuration: `certora/conf/fidesorigin.conf`

```json
{
    "files": [
        "contracts/RiskRegistry.sol",
        "contracts/PolicyEngine.sol",
        "contracts/ComplianceEngine.sol",
        "contracts/QuarantineVault.sol"
    ],
    "verify": "RiskRegistry:certora/specs/RiskRegistry.spec",
    "verify2": "PolicyEngine:certora/specs/PolicyEngine.spec",
    "verify3": "ComplianceEngine:certora/specs/ComplianceEngine.spec",
    "link": [
        "RiskRegistry:policyEngine=PolicyEngine",
        "PolicyEngine:riskRegistry=RiskRegistry",
        "ComplianceEngine:policyEngine=PolicyEngine"
    ],
    "rule": [
        "sanctionedImpliesHighRisk",
        "criticalTierImpliesSanctioned",
        "onlyOracleCanUpdateRiskProfile",
        "dailyLimitEnforcement",
        "tierThresholdsMonotonic"
    ],
    "optimistic_loop": true,
    "loop_iter": "3",
    "send_only": true,
    "solc": "0.8.20",
    "packages": [
        "@openzeppelin/contracts=node_modules/@openzeppelin/contracts"
    ]
}
```

> **Note**: Certora CLI supports a single `"verify"` key per run. For multiple contracts, run the Certora CLI multiple times or use a shell script. The previous document had duplicate `"verify"` keys which is invalid JSON.

---

## 5. Verification Plan

| Phase | Duration | Rules | Focus |
|-------|----------|-------|-------|
| **Phase 1: Setup** | 2-3 days | — | Install Certora, configure CI, write harness contracts |
| **Phase 2: Core Invariants** | 3-5 days | 6 rules | RiskRegistry invariants, access control, upgrade safety |
| **Phase 3: Policy & Compliance** | 3-5 days | 6 rules | Tier logic, daily limits, quarantine rules |
| **Phase 4: Integration** | 2-3 days | 4 rules | Cross-contract properties (e.g., PolicyEngine → RiskRegistry) |
| **Phase 5: Full Coverage** | 5-7 days | 15+ rules | Complete rule set, edge cases, parametric rules |
| **Total** | **15-23 days** | **~25 rules** | |

---

## 6. Resources

- **Certora Documentation**: https://docs.certora.com/
- **CVL Language Guide**: https://docs.certora.com/en/latest/cvl/index.html
- **Certora Prover GitHub**: https://github.com/Certora/Prover/
- **OpenZeppelin Certora Specs**: https://github.com/OpenZeppelin/openzeppelin-contracts/tree/master/certora
- **K Framework**: https://kframework.org/
- **K Eva (Ethereum)**: https://github.com/runtimeverification/evm-semantics

---

*Document version: 1.0 | Last updated: 2026-06-26*
