# Subgraph Deployment Status Report

> Generated: 2026-08-07
> Network: Sepolia Testnet (Chain ID 11155111)
> Subgraph Path: `apps/subgraph/`

---

## 1. Data Source Address Verification

### Current Configuration (`subgraph.yaml`)

| Contract            | Configured Address                           | Expected V2.1 Address                        | Status      |
| ------------------- | -------------------------------------------- | -------------------------------------------- | ----------- |
| RiskRegistry        | `0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc` | `0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc` | ✅ Match    |
| ComplianceEngine    | `0x50aAaf70b50fB26e588e0d296A4c042943FfB0AC` | `0x50aAaf70b50fB26e588e0d296A4c042943FfB0AC` | ✅ Match    |
| PolicyEngine        | `0x87089F67A61F9643796AE154663A6a9F21196b38` | `0x87089F67A61F9643796AE154663A6a9F21196b38` | ✅ Match    |
| FidesCompliance     | `0x945392d7Aabbf8dc4116711bD6c8dD6EF2098594` | `0x05497600618071C34CB3Fdb8A9E159e9589DEC79` | ❌ Mismatch |
| CompliantStableCoin | `0xb47a6520740a54B375e6F3B22bC316B4b02bFbCF` | `0x5028Dc7DA99bf461ed60a226c7CEf0bf7f77BF9A` | ❌ Mismatch |
| QuarantineVault     | **Missing**                                  | `0xF5593e26b2560b9fc71de729EA2D86F979dfd76b` | ❌ Missing  |

### Address Source References

- **FidesCompliance V2.1**: `0x05497600618071C34CB3Fdb8A9E159e9589DEC79` — Confirmed in `public/architecture.html` and deployment artifacts.
- **CompliantStableCoin**: `0x5028Dc7DA99bf461ed60a226c7CEf0bf7f77BF9A` — Confirmed in `public/architecture.html`.
- **QuarantineVault**: `0xF5593e26b2560b9fc71de729EA2D86F979dfd76b` — From `apps/contracts/deployments/quarantinevault-sepolia.json`.

---

## 2. Required Changes to `subgraph.yaml`

### 2.1 Update FidesCompliance Address

```yaml
# Current (incorrect)
address: "0x945392d7Aabbf8dc4116711bD6c8dD6EF2098594"

# Should be
address: "0x05497600618071C34CB3Fdb8A9E159e9589DEC79"
```

### 2.2 Update CompliantStableCoin Address

```yaml
# Current (incorrect)
address: "0xb47a6520740a54B375e6F3B22bC316B4b02bFbCF"

# Should be
address: "0x5028Dc7DA99bf461ed60a226c7CEf0bf7f77BF9A"
```

### 2.3 Add QuarantineVault Data Source

QuarantineVault is currently **not indexed** by the subgraph. It emits `FundsHeld`, `FundsReleased`, and other critical events that should be tracked for audit and reporting.

**Recommended addition to `subgraph.yaml`:**

```yaml
- kind: ethereum
  name: QuarantineVault
  network: sepolia
  source:
    abi: QuarantineVault
    address: '0xF5593e26b2560b9fc71de729EA2D86F979dfd76b'
    startBlock: 7650000 # TODO: verify actual deployment block
  mapping:
    kind: ethereum/events
    apiVersion: 0.0.9
    language: wasm/assemblyscript
    entities:
      - HoldRecord
      - QuarantineRelease
    abis:
      - name: QuarantineVault
        file: ./abis/QuarantineVault.json
    eventHandlers:
      - event: FundsHeld(indexed bytes32,indexed address,indexed address,uint256,address,string)
        handler: handleFundsHeld
      - event: FundsReleased(indexed bytes32,indexed address,uint256,address)
        handler: handleFundsReleased
      - event: FundsReviewed(indexed bytes32,indexed address,bool,string)
        handler: handleFundsReviewed
    file: ./src/mappings/quarantineVault.ts
```

> **Note**: The exact event signatures for QuarantineVault should be verified against the deployed contract ABI before creating the mapping. A placeholder `QuarantineVault.json` ABI file must also be added to `./abis/`.

---

## 3. Schema (`schema.graphql`) V2.1 Gap Analysis

### 3.1 Guard-Related Entities — Missing

The FidesCompliance V2.1 contract includes Guard pre-transaction screening with the following events:

| Event          | Parameters                                                    | Indexed? |
| -------------- | ------------------------------------------------------------- | -------- |
| `GuardCheck`   | `(address from, address to, uint8 action, uint256 riskScore)` | from, to |
| `GuardBlocked` | `(address from, address to, string reason)`                   | from, to |
| `GuardSet`     | `(address indexed guard)`                                     | guard    |
| `GuardEnabled` | `(bool enabled)`                                              | —        |

**Current schema has NO entities for these events.** The following entities should be added:

```graphql
type GuardCheck @entity(immutable: true) {
  id: ID! # txHash-logIndex
  from: String! @index
  to: String! @index
  action: String! # "ALLOW" | "WARN" | "BLOCK"
  riskScore: BigInt!
  timestamp: BigInt! @index
  blockNumber: BigInt!
  transactionHash: String!
}

type GuardBlocked @entity(immutable: true) {
  id: ID! # txHash-logIndex
  from: String! @index
  to: String! @index
  reason: String!
  timestamp: BigInt! @index
  blockNumber: BigInt!
  transactionHash: String!
}
```

### 3.2 QuarantineVault Entities — Missing

If QuarantineVault data source is added, the following entities should be defined:

```graphql
type QuarantineHold @entity(immutable: false) {
  id: ID! # holdId (bytes32)
  from: String! @index
  to: String! @index
  amount: BigInt!
  asset: String! @index
  reason: String!
  timestamp: BigInt! @index
  blockNumber: BigInt!
  transactionHash: String!
  released: Boolean!
  releasedAt: BigInt
  releasedBy: String
}
```

### 3.3 Existing Schema — Adequate for V2.1 Core

The following entities already exist and are sufficient for the V2.1 base functionality:

- ✅ `RiskProfile` / `RiskProfileUpdate` — RiskRegistry events
- ✅ `ComplianceCheck` / `HoldRecord` / `OperationLog` — ComplianceEngine events
- ✅ `Policy` / `PolicyVersion` / `PolicyEvaluation` / `WalletPolicy` — PolicyEngine events
- ✅ `FidesComplianceCheck` / `FidesTransactionBlocked` / `FidesTransactionQuarantined` / `FidesAuditLog` / `FidesRule` — FidesCompliance events
- ✅ `TokenTransfer` / `TokenTransferBlocked` / `KYCStatus` / `TokenPolicy` — CompliantStableCoin events
- ✅ `ProtocolStats` / `DailyStats` / `HourlyStats` / `DailyStatsAddress` — Aggregations

### 3.4 RiskTier Enum Consistency

The `RiskTier` enum in schema.graphql includes `CRITICAL`:

```graphql
enum RiskTier {
  UNKNOWN
  LOW
  MEDIUM
  HIGH
  CRITICAL
}
```

The contract's `RiskRegistry.getProfile()` returns a `uint8` tier. The mapping `shared/riskTier.ts` maps values 0-3 to UNKNOWN/LOW/MEDIUM/HIGH but does not handle value 4 (CRITICAL). This should be verified:

```typescript
// Current mapping in shared/riskTier.ts
if (tierValue === 0) return 'UNKNOWN';
if (tierValue === 1) return 'LOW';
if (tierValue === 2) return 'MEDIUM';
if (tierValue === 3) return 'HIGH';
// Missing: tierValue === 4 -> 'CRITICAL'
```

**Recommended fix**: Add `if (tierValue === 4) return 'CRITICAL';` to the shared mapping.

---

## 4. Deployment Prerequisites Checklist

Before deploying the updated subgraph, complete the following:

| #   | Task                                                            | Status     |
| --- | --------------------------------------------------------------- | ---------- |
| 1   | Update FidesCompliance address in `subgraph.yaml`               | ⏳ Pending |
| 2   | Update CompliantStableCoin address in `subgraph.yaml`           | ⏳ Pending |
| 3   | Add QuarantineVault data source to `subgraph.yaml`              | ⏳ Pending |
| 4   | Create `abis/QuarantineVault.json`                              | ⏳ Pending |
| 5   | Create `src/mappings/quarantineVault.ts`                        | ⏳ Pending |
| 6   | Add GuardCheck/GuardBlocked entities to `schema.graphql`        | ⏳ Pending |
| 7   | Update `src/mappings/fidesCompliance.ts` to handle Guard events | ⏳ Pending |
| 8   | Fix RiskTier mapping for CRITICAL tier (value 4)                | ⏳ Pending |
| 9   | Verify `startBlock` values for all data sources                 | ⏳ Pending |
| 10  | Run `graph codegen` and `graph build`                           | ⏳ Pending |
| 11  | Deploy with `graph deploy`                                      | ⏳ Pending |

---

## 5. Notes

- **Do NOT deploy** until all address updates and schema changes are completed and verified.
- The FidesCompliance address `0x945392d7Aabbf8dc4116711bD6c8dD6EF2098594` currently in `subgraph.yaml` appears to be from an older deployment (v3.0.2 or earlier). Updating to `0x05497600618071C34CB3Fdb8A9E159e9589DEC79` (V2.1) is required.
- The CompliantStableCoin address `0xb47a6520740a54B375e6F3B22bC316B4b02bFbCF` also appears to be from an older deployment. Updating to `0x5028Dc7DA99bf461ed60a226c7CEf0bf7f77BF9A` is required.
- QuarantineVault events are critical for audit reporting. Without this data source, the Subgraph cannot answer queries about held/released funds.
