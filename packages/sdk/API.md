# FidesOrigin SDK API Documentation

Complete API reference for the FidesOrigin JavaScript/TypeScript SDK.

## Table of Contents

- [FidesOriginClient](#fidesoriginclient)
- [Risk Assessment](#risk-assessment)
- [Rules Management](#rules-management)
- [WebSocket](#websocket)
- [React Hooks](#react-hooks)
- [Error Handling](#error-handling)
- [Types](#types)

---

## FidesOriginClient

Main client class for interacting with the FidesOrigin API.

### Constructor

```typescript
new FidesOriginClient(config: FidesOriginConfig)
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `config.baseUrl` | `string` | ✅ | API base URL |
| `config.apiKey` | `string` | | API key for authentication |
| `config.timeout` | `number` | | Request timeout in ms (default: 30000) |
| `config.debug` | `boolean` | | Enable debug logging (default: false) |
| `config.headers` | `Record<string, string>` | | Custom headers |

**Example:**

```typescript
const client = new FidesOriginClient({
  baseUrl: 'https://api.fidesorigin.com',
  apiKey: 'your-api-key',
  timeout: 60000,
  debug: true
});
```

---

### Methods

#### `checkAddress(address, options?)`

Check risk for a single address.

```typescript
checkAddress(
  address: string, 
  options?: RiskCheckOptions
): Promise<AddressRisk>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `address` | `string` | Wallet or contract address |
| `options.chain` | `Chain` | Blockchain chain (default: 'ethereum') |
| `options.includeEntities` | `boolean` | Include entity information |
| `options.includeStats` | `boolean` | Include transaction statistics |

**Returns:** `Promise<AddressRisk>`

**Example:**

```typescript
const risk = await client.checkAddress('0x742d...', {
  chain: 'ethereum',
  includeEntities: true,
  includeStats: true
});
```

---

#### `checkBatchAddresses(request)`

Check risk for multiple addresses.

```typescript
checkBatchAddresses(
  request: BatchRiskCheckRequest
): Promise<BatchRiskCheckResponse>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `request.addresses` | `string[]` | Array of addresses to check |
| `request.chain` | `Chain` | Blockchain chain |
| `request.detailed` | `boolean` | Include detailed information |

**Returns:** `Promise<BatchRiskCheckResponse>`

**Example:**

```typescript
const result = await client.checkBatchAddresses({
  addresses: ['0x123...', '0x456...'],
  chain: 'ethereum',
  detailed: true
});
```

---

#### `listRules(options?)`

List all compliance rules.

```typescript
listRules(options?: RuleListOptions): Promise<RuleListResponse>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `options.status` | `RuleStatus` | Filter by status |
| `options.page` | `number` | Page number (1-based) |
| `options.limit` | `number` | Items per page |

**Returns:** `Promise<RuleListResponse>`

---

#### `getRule(ruleId)`

Get a specific rule by ID.

```typescript
getRule(ruleId: string): Promise<Rule>
```

---

#### `createRule(request)`

Create a new compliance rule.

```typescript
createRule(request: CreateRuleRequest): Promise<Rule>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `request.name` | `string` | ✅ | Rule name |
| `request.description` | `string` | | Rule description |
| `request.conditions` | `RuleCondition[]` | ✅ | Rule conditions |
| `request.actions` | `RuleAction[]` | ✅ | Rule actions |
| `request.priority` | `number` | | Rule priority (default: 0) |

---

#### `updateRule(ruleId, request)`

Update an existing rule.

```typescript
updateRule(
  ruleId: string, 
  request: UpdateRuleRequest
): Promise<Rule>
```

---

#### `deleteRule(ruleId)`

Delete a rule.

```typescript
deleteRule(ruleId: string): Promise<void>
```

---

#### `createWebSocket(options?)`

Create a WebSocket connection for real-time updates.

```typescript
createWebSocket(options?: WebSocketOptions): FidesOriginWebSocket
```

---

## Risk Assessment

### Helper Functions

#### `checkAddress(address, apiKey, options?)`

Quick one-line risk check helper.

```typescript
import { checkAddress } from '@fidesorigin/sdk';

const risk = await checkAddress('0x742d...', 'YOUR_API_KEY');
```

---

#### `isRisky(riskLevel, threshold?)`

Check if risk level meets or exceeds threshold.

```typescript
isRisky(riskLevel: RiskLevel, threshold?: RiskLevel): boolean
```

**Example:**

```typescript
if (isRisky(risk.risk.level, 'medium')) {
  // Handle risky address
}
```

---

#### `isSafe(riskLevel)`

Check if risk level is 'low'.

```typescript
isSafe(riskLevel: RiskLevel): boolean
```

---

#### `getRiskColor(riskLevel)`

Get CSS color for risk level.

```typescript
getRiskColor(riskLevel: RiskLevel): string
// Returns: '#10B981' (low), '#F59E0B' (medium), '#EF4444' (high), '#7C2D12' (critical)
```

---

#### `getRiskLabel(riskLevel)`

Get human-readable label for risk level.

```typescript
getRiskLabel(riskLevel: RiskLevel): string
// Returns: 'Low Risk', 'Medium Risk', 'High Risk', 'Critical Risk'
```

---

### RiskAssessor Class

```typescript
import { RiskAssessor } from '@fidesorigin/sdk';

const assessor = new RiskAssessor(client);

// Check single address
const risk = await assessor.check('0x742d...');

// Check multiple
const batch = await assessor.checkBatch(['0x123...', '0x456...']);

// Find high-risk addresses
const highRisk = await assessor.findHighRisk(addresses, 'high');

// Validate all addresses are safe
const { safe, riskyAddresses } = await assessor.validateAllSafe(addresses);
```

---

## Rules Management

### RulesManager Class

```typescript
import { RulesManager } from '@fidesorigin/sdk';

const rules = new RulesManager(client);

// List rules
const list = await rules.list({ status: 'active' });

// Get active rules
const active = await rules.getActive();

// Get by priority
const highPriority = await rules.getByPriority(50);

// Enable default rules
await rules.enableDefaults();
```

---

### RuleBuilder Class

Fluent API for creating rules.

```typescript
import { createRuleBuilder } from '@fidesorigin/sdk';

const rule = await createRuleBuilder(client)
  .name('High Risk Sanctioned Address')
  .description('Flag addresses on sanctions list')
  .condition('risk.level', 'equals', 'critical')
  .condition('flags.category', 'contains', 'sanctions')
  .action('flag', { reason: 'Sanctioned entity' })
  .priority(100)
  .build();
```

---

### Rule Templates

Pre-defined rule templates:

```typescript
import { RuleTemplates } from '@fidesorigin/sdk';

// Block high risk addresses
const blockHighRisk = RuleTemplates.blockHighRisk(100);

// Flag sanctioned addresses
const flagSanctioned = RuleTemplates.flagSanctioned(90);

// Review mixer usage
const reviewMixer = RuleTemplates.reviewMixerUsage(50);

// Review large volume (>$100k)
const reviewVolume = RuleTemplates.reviewLargeVolume(100000, 30);

// Custom risk score threshold
const threshold = RuleTemplates.riskScoreThreshold(75, 'review', 50);
```

---

## WebSocket

### FidesOriginWebSocket

```typescript
const ws = client.createWebSocket({
  autoReconnect: true,
  reconnectInterval: 5000,
  maxReconnectAttempts: 10,
  subscriptions: ['risk.update', 'alert.new']
});

// Register handlers
ws.on('risk.update', (message) => {
  console.log('Risk update:', message.data);
});

ws.on('alert.new', (message) => {
  console.log('New alert:', message.data);
});

ws.on('connection.established', () => {
  console.log('Connected');
});

ws.on('connection.closed', () => {
  console.log('Disconnected');
});

// Connect
ws.connect();

// Disconnect
ws.disconnect();

// Check connection status
console.log(ws.isConnected);

// Subscribe/unsubscribe
ws.subscribe(['rule.match']);
ws.unsubscribe(['alert.new']);
```

---

## React Hooks

### `useRiskCheck(address, options)`

Hook for checking risk of a single address.

```typescript
const { 
  data,      // AddressRisk | null
  loading,   // boolean
  error,     // ApiError | null
  refetch,   // () => Promise<void>
  clear      // () => void
} = useRiskCheck(address, {
  client,           // FidesOriginClient (required)
  pollInterval: 0,  // Polling interval in ms (0 to disable)
  enabled: true,    // Enable on mount
  chain: 'ethereum' // Chain option
});
```

---

### `useBatchRiskCheck(addresses, options)`

Hook for batch risk checking.

```typescript
const { 
  data,      // { results: AddressRisk[], failed: string[] } | null
  loading,   // boolean
  error,     // ApiError | null
  refetch    // () => Promise<void>
} = useBatchRiskCheck(addresses, {
  client,
  chain: 'ethereum',
  detailed: true
});
```

---

### `useRiskDisplay()`

Hook for risk display helpers.

```typescript
const { getColor, getLabel, getIcon } = useRiskDisplay();

const color = getColor('high');  // '#EF4444'
const label = getLabel('high');  // 'High Risk'
const icon = getIcon('high');    // '⚠'
```

---

## Error Handling

### FidesOriginError

```typescript
import { FidesOriginError } from '@fidesorigin/sdk';

try {
  await client.checkAddress('0xinvalid');
} catch (error) {
  if (error instanceof FidesOriginError) {
    console.log({
      name: error.name,        // 'FidesOriginError'
      code: error.code,        // 'VALIDATION_ERROR'
      message: error.message,  // 'Invalid address format'
      details: error.details,  // { address: '0xinvalid' }
      status: error.status     // 400
    });
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `CONFIG_ERROR` | Invalid client configuration |
| `VALIDATION_ERROR` | Invalid input parameters |
| `AUTH_ERROR` | Authentication failed |
| `RATE_LIMIT_ERROR` | Rate limit exceeded |
| `NETWORK_ERROR` | Network connection error |
| `TIMEOUT_ERROR` | Request timeout |
| `HTTP_400` | Bad request |
| `HTTP_401` | Unauthorized |
| `HTTP_403` | Forbidden |
| `HTTP_404` | Not found |
| `HTTP_429` | Too many requests |
| `HTTP_500` | Server error |
| `UNKNOWN_ERROR` | Unexpected error |

---

## Types

### Core Types

```typescript
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

type AddressType = 'wallet' | 'contract' | 'exchange' | 'mixer' | 'unknown';

type Chain = 'ethereum' | 'bitcoin' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism' | 'base' | 'solana';

type RuleStatus = 'active' | 'inactive' | 'draft';

type RuleOperator = 
  | 'equals' 
  | 'not_equals' 
  | 'greater_than' 
  | 'less_than' 
  | 'contains' 
  | 'not_contains'
  | 'in'
  | 'not_in';
```

### Risk Types

```typescript
interface AddressRisk {
  address: string;
  chain: Chain;
  type: AddressType;
  risk: {
    score: number;      // 0-100
    level: RiskLevel;
    confidence: number; // 0-1
  };
  flags: RiskFlag[];
  entities?: Entity[];
  stats?: TransactionStats;
  assessedAt: string;
}

interface RiskFlag {
  id: string;
  name: string;
  category: string;
  severity: RiskLevel;
  description: string;
  metadata?: Record<string, unknown>;
}
```

### Rule Types

```typescript
interface Rule {
  id: string;
  name: string;
  description?: string;
  status: RuleStatus;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  createdAt: string;
  updatedAt: string;
}

interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value: unknown;
}

interface RuleAction {
  type: 'flag' | 'block' | 'review' | 'allow';
  params?: Record<string, unknown>;
}
```

### WebSocket Types

```typescript
type WebSocketEventType = 
  | 'risk.update'
  | 'alert.new'
  | 'rule.match'
  | 'connection.established'
  | 'connection.closed'
  | 'error';

interface WebSocketMessage {
  event: WebSocketEventType;
  data: unknown;
  timestamp: string;
}

interface RiskUpdateEvent {
  address: string;
  chain: Chain;
  risk: RiskScore;
  previousRisk?: RiskScore;
  reason: string;
}

interface AlertEvent {
  id: string;
  type: string;
  severity: RiskLevel;
  title: string;
  description: string;
  addresses?: string[];
  createdAt: string;
}
```

---

## Type Guards

```typescript
import { 
  isRiskUpdateEvent, 
  isAlertEvent, 
  isRuleMatchEvent 
} from '@fidesorigin/sdk';

ws.on('risk.update', (message) => {
  if (isRiskUpdateEvent(message.data)) {
    console.log('Address:', message.data.address);
    console.log('New score:', message.data.risk.score);
  }
});
```

---

*For more examples, see the [examples](./examples) directory.*
