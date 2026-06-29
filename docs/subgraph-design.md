# FidesOrigin Subgraph Design

## Overview

This document describes the design for indexing `RiskRegistry` events on-chain using **The Graph Protocol** (subgraph). The subgraph enables efficient off-chain querying of risk profile history, address metadata, and tag-based filtering — essential for the FidesOrigin compliance dashboard and downstream analytics.

## 1. Why The Graph?

On-chain event logs are expensive to scan sequentially. A subgraph provides:

- **Indexed event data**: Fast GraphQL queries instead of slow `eth_getLogs` RPC calls.
- **Historical data**: Full address risk profile evolution over time.
- **Aggregations**: Count addresses by tier, tag, or time range without custom indexing.
- **Real-time updates**: Subgraph indexing nodes sync new blocks as they arrive (~12s on Ethereum mainnet).

## 2. Event Definition

The `RiskRegistry` contract emits the following event:

```solidity
event RiskProfileUpdated(
    address indexed addr,        // The subject address
    uint256 riskScore,           // 0-100
    RiskTier tier,               // 0=UNKNOWN, 1=LOW, 2=MEDIUM, 3=HIGH, 4=CRITICAL
    bool isSanctioned
);
```

> **⚠️ CRITICAL NOTE**: The actual `RiskRegistry` contract event does **NOT** include `tags`, `timestamp`, or `updatedBy` parameters. The previous v1.0 design assumed a different event signature that does not exist on-chain. This mismatch would cause the subgraph to fail entirely. The schema and mapping below have been corrected to match the actual deployed contract.

> **Tags**: `tags` are stored in the contract's `riskProfiles` mapping but are **not emitted** in the event. To index tags, the mapping must call `getTags(addr)` on the contract (see Section 5). Alternatively, upgrade the contract to emit tags in the event for better indexing performance.

> **Timestamp**: Use `event.block.timestamp` instead of a dedicated event parameter.

> **UpdatedBy**: Use `event.transaction.from` (the transaction sender) as the updater address.

## 3. GraphQL Schema Design

```graphql
type RiskProfile @entity {
  id: ID!                       # Composite: subject + "-" + blockNumber + "-" + logIndex
  subject: Address!              # The wallet address
  riskScore: Int!                # 0-100
  tier: Int!                     # 0-4
  sanctioned: Boolean!
  tags: [String!]!               # Fetched via contract call (getTags) or off-chain enrichment
  timestamp: BigInt!             # event.block.timestamp
  blockNumber: BigInt!
  transactionHash: Bytes!
  updatedBy: Address!            # event.transaction.from
  logIndex: BigInt!              # For ordering within a block
}

# Unique address entity (1:1 with on-chain address) for latest snapshot
type Address @entity {
  id: ID!                        # The address itself (lower-cased)
  riskScore: Int!
  tier: Int!
  sanctioned: Boolean!
  tags: [String!]!               # Fetched via contract call or off-chain enrichment
  lastUpdated: BigInt!
  lastUpdatedBy: Address!
  # Relationships
  profiles: [RiskProfile!]! @derivedFrom(field: "subject")
  updateCount: Int!
  
  # FATF cross-reference fields (populated by off-chain enrichment)
  country: String
  fatfTier: Int                   # 0=none, 1=blacklist, 2=greylist
  entityName: String
  entityId: String
}

# Tag index for fast tag-based filtering (populated via contract call or off-chain)
type Tag @entity {
  id: ID!                        # tag string (hex)
  count: Int!
  addresses: [Address!]! @derivedFrom(field: "tags")
  riskProfiles: [RiskProfile!]! @derivedFrom(field: "tags")
}
```

## 4. Subgraph Manifest (`subgraph.yaml`)

```yaml
specVersion: 1.0.0
schema:
  file: ./schema.graphql
dataSources:
  - kind: ethereum
    name: RiskRegistry
    network: sepolia              # ✅ Deployed on Sepolia testnet (Chain ID 11155111)
    source:
      address: "0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc"
      abi: RiskRegistry
      startBlock: 6200000         # Sepolia deployment block (update to actual)
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.9
      language: wasm/assemblyscript
      entities:
        - RiskProfile
        - Address
        - Tag
      abis:
        - name: RiskRegistry
          file: ./abis/RiskRegistry.json
      eventHandlers:
        - event: RiskProfileUpdated(indexed address,uint256,uint8,bool)
          handler: handleRiskProfileUpdated
      file: ./src/mapping.ts
```

> **Fixes from v1.0**:
> - `network: sepolia` (was `mainnet` — the contract is on Sepolia)
> - `event: RiskProfileUpdated(indexed address,uint256,uint8,bool)` matches the actual 4-parameter contract event
> - Removed non-existent `bytes32[]`, `uint256`, and `indexed address` parameters
> - Updated `startBlock` to a realistic Sepolia block number

## 5. Mapping Logic (`src/mapping.ts`)

```typescript
import {
  BigInt,
  Bytes,
  Address as GraphAddress,
  ethereum,
} from '@graphprotocol/graph-ts';
import {
  RiskProfileUpdated,
} from '../generated/RiskRegistry/RiskRegistry';
import { RiskProfile, Address, Tag } from '../generated/schema';

export function handleRiskProfileUpdated(event: RiskProfileUpdated): void {
  const subjectAddr = event.params.addr.toHexString().toLowerCase();
  const txHash = event.transaction.hash.toHexString();
  const blockNumber = event.block.number.toString();
  const logIndex = event.logIndex.toString();
  
  // ✅ FIX v1.0: Use blockNumber + logIndex for globally unique ID
  // logIndex alone is not unique across blocks (it resets per block)
  const profileId = subjectAddr + '-' + blockNumber + '-' + logIndex;

  // ─── Create RiskProfile (immutable history entry) ───
  let profile = new RiskProfile(profileId);
  profile.subject = subjectAddr;
  profile.riskScore = event.params.riskScore.toI32();
  profile.tier = event.params.tier;
  profile.sanctioned = event.params.isSanctioned;
  profile.blockNumber = event.block.number;
  profile.transactionHash = Bytes.fromHexString(txHash) as Bytes;
  profile.timestamp = event.block.timestamp;        // ✅ From block, not event
  profile.updatedBy = event.transaction.from.toHexString().toLowerCase(); // ✅ From tx sender
  profile.logIndex = event.logIndex;
  
  // Tags are NOT emitted in the event. Options:
  // Option A: Call contract.getTags() (slower, increases indexing time)
  // Option B: Leave tags empty and populate via off-chain enrichment pipeline
  // Option C: Upgrade contract to emit tags in the event (recommended long-term)
  // For now, we use Option B and populate from an off-chain sync job.
  profile.tags = [];
  profile.save();

  // ─── Update Address (latest snapshot) ───
  let addr = Address.load(subjectAddr);
  if (!addr) {
    addr = new Address(subjectAddr);
    addr.updateCount = 0;
    addr.tags = [];
  }
  addr.riskScore = event.params.riskScore.toI32();
  addr.tier = event.params.tier;
  addr.sanctioned = event.params.isSanctioned;
  addr.lastUpdated = event.block.timestamp;
  addr.lastUpdatedBy = event.transaction.from.toHexString().toLowerCase();
  addr.updateCount = addr.updateCount + 1;
  addr.save();

  // Tag index is NOT populated from the event because tags are not emitted.
  // Use the off-chain enrichment pipeline (see Section 8) or contract upgrade.
}

// Optional: Contract call to fetch tags (expensive, use sparingly)
// import { RiskRegistry } from '../generated/RiskRegistry/RiskRegistry';
// function fetchTags(contract: RiskRegistry, subject: string): string[] {
//   const tags = contract.getTags(GraphAddress.fromString(subject));
//   const result: string[] = [];
//   for (let i = 0; i < tags.length; i++) {
//     result.push(tags[i].toHexString());
//   }
//   return result;
// }
```

## 6. Example Queries

### 6.1 Latest snapshot of all sanctioned HIGH-tier addresses

```graphql
{
  addresses(
    where: { sanctioned: true, tier: 3 }
    orderBy: lastUpdated
    orderDirection: desc
    first: 100
  ) {
    id
    riskScore
    tier
    sanctioned
    tags
    lastUpdated
    updateCount
    country
    fatfTier
  }
}
```

### 6.2 Full history of a single address

```graphql
{
  riskProfiles(
    where: { subject: "0x7ead67622f6a47318a55502634a429ef9dc5cebc" }
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    riskScore
    tier
    sanctioned
    tags
    timestamp
    blockNumber
    transactionHash
    updatedBy
  }
}
```

### 6.3 Filter by tag (e.g., OFAC SDN)

> **Note**: `tags_contains` filter requires the `tags` field to be populated. Since the contract event does not emit tags, this query will only work after an off-chain enrichment pipeline populates the `tags` field, or after the contract is upgraded to emit tags in the event.

```graphql
{
  addresses(
    where: { tags_contains: ["0x6f6661632d73646e"] }
    first: 50
  ) {
    id
    riskScore
    tier
    tags
    lastUpdated
  }
}
```

### 6.4 Time-range query (last 7 days)

```graphql
{
  riskProfiles(
    where: {
      timestamp_gte: "1717200000"
      timestamp_lt: "1717804800"
    }
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    subject {
      id
    }
    riskScore
    tier
    tags
    timestamp
  }
}
```

### 6.5 Aggregation: count by tier

```graphql
{
  addresses(where: { tier_gt: 0 }) {
    id
    tier
    updateCount
  }
}
# Aggregate client-side or use Apollo client @connection
```

## 7. Deployment & Operations

### 7.1 Subgraph Studio Deployment

```bash
# 1. Install graph CLI
npm install -g @graphprotocol/graph-cli

# 2. Initialize project
graph init --studio fidesorigin-risk-registry

# 3. Generate types from ABI + schema
cd fidesorigin-risk-registry
graph codegen

# 4. Build
graph build

# 5. Deploy to Subgraph Studio
graph deploy --studio fidesorigin-risk-registry
```

### 7.2 Self-Hosted (Docker)

```bash
# Run a local graph node (IPFS + Postgres + Graph Node)
docker-compose up -d

# Create and deploy
graph create --node http://localhost:8020 fidesorigin/risk-registry
graph deploy --node http://localhost:8020 --ipfs http://localhost:5001 fidesorigin/risk-registry
```

### 7.3 Monitoring

| Metric | Alert Threshold |
|--------|-----------------|
| Sync lag | > 100 blocks |
| Indexing errors | > 0 in 5 min |
| Query latency p99 | > 2s |
| Entity count | > 10M (scale signal) |

## 8. FATF Cross-Reference Integration

The off-chain `Address.country` and `Address.fatfTier` fields are populated by a separate enrichment pipeline (see `fatf-collector.ts`). This pipeline:

1. Reads the subgraph for all addresses with `country: null`.
2. Matches addresses to countries using the OpenSanctions owner-entity resolution (see `batch-collector.ts`).
3. Queries the FATF blacklist/greylist to determine the tier.
4. Writes back `country` and `fatfTier` via a `MetadataUpdate` handler or direct DB mutation.

This avoids storing FATF data on-chain (which changes quarterly) while still enabling fast GraphQL filtering:

```graphql
{
  addresses(where: { fatfTier: 1, sanctioned: true }) {
    id
    country
    riskScore
  }
}
```

## 9. Performance Considerations

- **Entity explosion**: Every `RiskProfileUpdated` event creates one `RiskProfile` entity. With 1M updates/year, this is manageable (subgraph nodes handle ~100M entities).
- **Tag indexing**: The `tags` field is a string array, not a relationship. For fast tag filtering, use `tags_contains` (which performs an array intersection scan).
- **Composite ID**: `profileId = subject + "-" + blockNumber + "-" + logIndex` guarantees global uniqueness. `logIndex` alone is not sufficient because it resets per block.
- ** pruning**: Set `grafting` or `pruning` in `subgraph.yaml` to discard old `RiskProfile` entities if history is not needed long-term.

## 10. Multi-Chain Support

To support multiple chains (Ethereum, Arbitrum, Polygon), deploy one subgraph per network with a shared schema:

```yaml
# subgraph.yaml — Sepolia testnet (current deployment)
network: sepolia

# subgraph-mainnet.yaml — Ethereum mainnet (future mainnet deployment)
network: mainnet

# subgraph-arbitrum.yaml — Arbitrum One
network: arbitrum-one
```

The client queries the appropriate subgraph endpoint based on `chainId`.

> **Note**: The current deployment is on **Sepolia** (Chain ID 11155111). The mainnet subgraph will only be deployed after mainnet readiness review.

## 11. Future Enhancements

- **Time-travel queries**: The Graph supports querying historical block states via `block: { number: ... }`.
- **Custom data sources**: Add a `file/ipfs` data source to ingest off-chain FATF PDFs or CSVs directly into the subgraph.
- **POI (Proof of Indexing)**: Enable POI for decentralized indexing rewards when migrating to The Graph Network.
