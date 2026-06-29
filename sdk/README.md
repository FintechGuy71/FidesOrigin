# @fidesorigin/sdk

> **3 lines of code to integrate on-chain risk control.**

FidesOrigin SDK is a TypeScript library for querying on-chain risk intelligence. It connects to FidesOrigin's RiskRegistry and PolicyEngine smart contracts to provide real-time sanctions screening, risk profiling, and transaction evaluation.

## Features

- 🛡️ **Sanctions Screening** — Check if an address is sanctioned
- 📊 **Risk Profiling** — Full risk score, tier, and tags
- 🔍 **Transaction Evaluation** — Evaluate transactions against policies (read-only)
- ⚡ **Zero Runtime Dependencies** — Only `ethers` v6 as peer dependency
- 🌐 **Browser & Node.js** — ESM + CJS dual output, works everywhere
- 🔧 **Custom Providers** — Use Alchemy, Infura, QuickNode, or any RPC

## Installation

```bash
npm install @fidesorigin/sdk ethers
```

> `ethers` v6 is required as a peer dependency.

## Quick Start

```typescript
import { FidesClient } from '@fidesorigin/sdk';

const client = new FidesClient({ network: 'sepolia' });

// Check if an address is sanctioned
const isSanctioned = await client.isSanctioned('0xE950DC316b836e4EeFb8308bf32Bf7C72a1358FF');
console.log(isSanctioned); // → true

// Get full risk profile
const profile = await client.getRiskProfile('0xE950DC316b836e4EeFb8308bf32Bf7C72a1358FF');
console.log(profile);
// → { riskScore: 100, tier: 3, sanctioned: true, tags: ['0xofac-sdn...'] }

// Evaluate a transaction
import { ethers } from 'ethers';

const result = await client.evaluateTransaction({
  from: '0x1234...',
  to: '0xE950DC316b836e4EeFb8308bf32Bf7C72a1358FF',
  amount: ethers.parseEther('1.0'),
});
console.log(result);
// → { allowed: false, riskScore: 100, reason: 'sanctioned' }
```

## Configuration

### Built-in Networks

Use a predefined testnet with a single option:

```typescript
// Sepolia (default)
const client = new FidesClient({ network: 'sepolia' });

// Holesky
const client = new FidesClient({ network: 'holesky' });

// Goerli (deprecated)
const client = new FidesClient({ network: 'goerli' });
```

### Custom Provider (Alchemy / Infura / QuickNode)

For mainnet or any custom RPC, provide the full configuration:

```typescript
const client = new FidesClient({
  network: 'custom',
  provider: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
  riskRegistry: '0x...',   // mainnet RiskRegistry address
  policyEngine: '0x...',  // mainnet PolicyEngine address
});
```

### Override Defaults

You can mix built-in presets with overrides:

```typescript
const client = new FidesClient({
  network: 'sepolia',
  provider: 'https://your-private-sepolia-rpc.com',
});
```

## API Reference

### `new FidesClient(config?)`

Create a client instance. `config` is optional; defaults to Sepolia testnet.

| Option | Type | Description |
|--------|------|-------------|
| `network` | `'sepolia' \| 'holesky' \| 'goerli' \| 'custom'` | Preset network (default: `'sepolia'`) |
| `provider` | `string` | RPC URL |
| `riskRegistry` | `string` | RiskRegistry proxy address |
| `policyEngine` | `string` | PolicyEngine proxy address |

### `isSanctioned(address: string): Promise<boolean>`

Check whether an address is flagged as sanctioned.

### `getRiskProfile(address: string): Promise<RiskProfile>`

Retrieve the complete risk profile for an address.

**Returns:**
```typescript
interface RiskProfile {
  riskScore: number;   // 0-100
  tier: 0 | 1 | 2 | 3 | 4 | 5;
  sanctioned: boolean;
  tags: string[];      // e.g. ['0xofac-sdn', 'mixer']
}
```

### `getRiskScore(address: string): Promise<number>`

Get the raw numerical risk score (0-100).

### `evaluateTransaction(tx: TransactionRequest): Promise<TransactionEvaluation>`

Evaluate a transaction against risk policies without broadcasting it.

**Parameters:**
```typescript
interface TransactionRequest {
  from: string;        // Sender address
  to: string;          // Recipient address
  amount: bigint;      // Amount in wei
  token?: string;      // ERC-20 token address (optional, ETH if omitted)
}
```

**Returns:**
```typescript
interface TransactionEvaluation {
  allowed: boolean;    // Whether the transaction is permitted
  riskScore: number;   // Computed risk score
  reason: string | null; // Reason for denial, if any
}
```

### `verifyNetwork(): Promise<void>`

Verify that the connected provider matches the expected `chainId` configured for the network. Throws a descriptive error if a mismatch is detected.

```typescript
await client.verifyNetwork();
```

### `getProvider(): Provider`

Access the underlying ethers `Provider` for advanced use cases.

### `getNetworkConfig(): Readonly<NetworkConfig>`

Get the active network configuration.

## TypeScript

All types are exported for convenience:

```typescript
import type {
  FidesClientConfig,
  RiskProfile,
  TransactionEvaluation,
  TransactionRequest,
  NetworkConfig,
  RiskTier,
} from '@fidesorigin/sdk';
```

## Browser Usage

```html
<script type="module">
  import { FidesClient } from '@fidesorigin/sdk';

  const client = new FidesClient({ network: 'sepolia' });
  const result = await client.isSanctioned('0x...');
  console.log(result);
</script>
```

## Error Handling

All async methods throw descriptive errors on failure:

```typescript
try {
  const profile = await client.getRiskProfile('0x...');
} catch (error) {
  console.error('Risk check failed:', error.message);
}
```

Methods also validate Ethereum addresses before making contract calls and will throw early with a clear message if an invalid address is supplied.

## Network Information

| Network | Chain ID | RiskRegistry | PolicyEngine |
|---------|----------|--------------|--------------|
| Sepolia | 11155111 | `0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc` | `0x87089F67A61F9643796AE154663A6a9F21196b38` |
| Holesky | 17000 | *placeholder* | *placeholder* |
| Goerli  | 5 | *placeholder* | *placeholder* |

> Goerli is deprecated. Use Sepolia or Holesky for testnet development.

## License

MIT © FidesOrigin
