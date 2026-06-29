# 🛡️ FidesOrigin SDK

[![npm version](https://badge.fury.io/js/@fidesorigin%2Fsdk.svg)](https://www.npmjs.com/package/@fidesorigin/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Official JavaScript/TypeScript SDK for FidesOrigin - Risk assessment and compliance for Web3.

## Features

- 🔍 **Risk Assessment** - Check wallet and contract addresses for risk factors
- 📊 **Batch Processing** - Efficiently check multiple addresses at once
- 📜 **Rule Management** - Create and manage compliance rules programmatically
- 🔄 **Real-time Updates** - WebSocket support for live risk updates
- ⚛️ **React Integration** - Dedicated hooks for React applications
- 🌐 **Universal** - Works in browsers (UMD), Node.js (CommonJS/ESM), and TypeScript
- 🔒 **Type Safe** - Complete TypeScript type definitions included

## Installation

```bash
# npm
npm install @fidesorigin/sdk

# yarn
yarn add @fidesorigin/sdk

# pnpm
pnpm add @fidesorigin/sdk
```

## Quick Start

### One-Line Integration

```typescript
import { fides } from '@fidesorigin/sdk';

// Check a single address
const risk = await fides.checkAddress('0x742d...', 'YOUR_API_KEY');
console.log(risk.risk.level); // 'low' | 'medium' | 'high' | 'critical'
```

### Full Client Usage

```typescript
import { FidesOriginClient } from '@fidesorigin/sdk';

const client = new FidesOriginClient({
  baseUrl: 'https://api.fidesorigin.com',
  apiKey: 'YOUR_API_KEY'
});

// Check single address
const risk = await client.checkAddress('0x742d...', { chain: 'ethereum' });

// Check multiple addresses
const batch = await client.checkBatchAddresses({
  addresses: ['0x123...', '0x456...'],
  chain: 'ethereum'
});
```

## Usage Examples

### Browser (UMD)

```html
<script src="https://unpkg.com/@fidesorigin/sdk/dist/umd/fidesorigin.min.js"></script>
<script>
  const client = new FidesOrigin.FidesOriginClient({
    baseUrl: 'https://api.fidesorigin.com',
    apiKey: 'YOUR_API_KEY'
  });
  
  client.checkAddress('0x742d...').then(risk => {
    console.log(risk.risk.level);
  });
</script>
```

### Node.js (CommonJS)

```javascript
const { FidesOriginClient } = require('@fidesorigin/sdk');

const client = new FidesOriginClient({
  baseUrl: 'https://api.fidesorigin.com',
  apiKey: process.env.FIDES_API_KEY
});

async function main() {
  const risk = await client.checkAddress('0x742d...');
  console.log(`Risk Level: ${risk.risk.level}`);
}

main();
```

### Node.js (ESM)

```javascript
import { FidesOriginClient, isRisky } from '@fidesorigin/sdk';

const client = new FidesOriginClient({
  baseUrl: 'https://api.fidesorigin.com',
  apiKey: process.env.FIDES_API_KEY
});

const risk = await client.checkAddress('0x742d...');
if (isRisky(risk.risk.level, 'medium')) {
  console.warn('Address is risky!');
}
```

### React

```tsx
import { FidesOriginClient } from '@fidesorigin/sdk';
import { useRiskCheck } from '@fidesorigin/sdk/react';

const client = new FidesOriginClient({
  baseUrl: 'https://api.fidesorigin.com',
  apiKey: 'YOUR_API_KEY'
});

function RiskIndicator({ address }: { address: string }) {
  const { data, loading, error, refetch } = useRiskCheck(address, {
    client,
    pollInterval: 30000 // Refresh every 30 seconds
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return null;

  return (
    <div className={`risk-${data.risk.level}`}>
      Risk: {data.risk.level} ({data.risk.score}/100)
      <button onClick={refetch}>Refresh</button>
    </div>
  );
}
```

## Risk Assessment Helpers

```typescript
import { 
  isRisky, 
  isSafe, 
  getRiskColor, 
  getRiskLabel,
  filterByRiskLevel,
  sortByRiskScore 
} from '@fidesorigin/sdk';

// Check if address is risky
if (isRisky(risk.risk.level, 'medium')) {
  // Block transaction
}

// Check if address is safe
if (isSafe(risk.risk.level)) {
  // Proceed with transaction
}

// Get UI colors
const color = getRiskColor(risk.risk.level); // '#10B981' for low
const label = getRiskLabel(risk.risk.level); // 'Low Risk'

// Filter and sort results
const highRisk = filterByRiskLevel(results, 'high');
const sorted = sortByRiskScore(results);
```

## Rules Management

```typescript
import { RulesManager, RuleTemplates } from '@fidesorigin/sdk';

const rules = new RulesManager(client);

// Create rule from template
await rules.createFromTemplate('blockHighRisk', 100);

// Create custom rule with builder
await rules.builder()
  .name('My Custom Rule')
  .description('Flag high-risk DeFi protocols')
  .condition('risk.level', 'equals', 'high')
  .condition('flags.category', 'contains', 'defi')
  .action('flag', { reason: 'High risk DeFi' })
  .priority(80)
  .build();

// List and manage rules
const allRules = await rules.list();
await rules.activate('rule-id');
await rules.deactivate('rule-id');
```

## WebSocket Real-time Updates

```typescript
const ws = client.createWebSocket({
  autoReconnect: true,
  subscriptions: ['risk.update', 'alert.new']
});

ws.on('risk.update', (message) => {
  console.log('Risk updated:', message.data);
});

ws.on('alert.new', (message) => {
  console.log('New alert:', message.data);
});

ws.connect();
```

## API Documentation

See [API.md](./API.md) for complete API reference.

## Configuration Options

```typescript
interface FidesOriginConfig {
  baseUrl: string;           // API base URL (required)
  apiKey?: string;           // API key for authentication
  timeout?: number;          // Request timeout (default: 30000ms)
  debug?: boolean;           // Enable debug logging
  headers?: Record<string, string>;  // Custom headers
}
```

## Error Handling

```typescript
import { FidesOriginError } from '@fidesorigin/sdk';

try {
  const risk = await client.checkAddress('0xinvalid');
} catch (error) {
  if (error instanceof FidesOriginError) {
    console.log(error.code);     // 'VALIDATION_ERROR'
    console.log(error.message);  // 'Invalid address format'
    console.log(error.details);  // Additional error details
    console.log(error.status);   // HTTP status code
  }
}
```

## Supported Chains

- Ethereum (`ethereum`)
- Bitcoin (`bitcoin`)
- Polygon (`polygon`)
- BSC (`bsc`)
- Arbitrum (`arbitrum`)
- Optimism (`optimism`)
- Base (`base`)
- Solana (`solana`)

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13.1+
- Edge 80+

## Node.js Support

- Node.js 16+
- Node.js 18+
- Node.js 20+

## Development

```bash
# Clone repository
git clone https://github.com/FintechGuy71/FidesOrigin.git
cd FidesOrigin/sdk

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode
npm run build:watch
```

## License

MIT License - see [LICENSE](../LICENSE) for details.

## Support

- 📧 Email: support@fidesorigin.com
- 💬 Discord: [FidesOrigin Community](https://discord.gg/fidesorigin)
- 🐛 Issues: [GitHub Issues](https://github.com/FintechGuy71/FidesOrigin/issues)

---

Made with ❤️ by the FidesOrigin Team
