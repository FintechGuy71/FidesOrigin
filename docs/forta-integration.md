# Forta Network Integration Design

## Overview

This document describes how FidesOrigin integrates with **Forta Network** — a decentralized real-time security monitoring network — to automatically detect attack addresses and update their risk profiles on-chain via `RiskRegistry.updateRiskProfile()`.

## 1. What is Forta?

**Forta** is a decentralized, real-time security monitoring network for smart contracts and Web3.

- **Detection Bots**: Community-built detection bots run on a decentralized network of scan nodes, continuously monitoring on-chain activity for threats (exploits, phishing, rug pulls, flash loans, etc.).
- **Real-time Alerts**: When a bot detects an attack, it emits an alert immediately (typically within 1–2 blocks).
- **SDK**: Developers can build bots using the Forta SDK (TypeScript/Python) or subscribe to existing bots via the Forta API.
- **Explorer**: Public UI at [forta.org](https://forta.org) showing all active bots and alerts.

### Key Forta Concepts

| Term | Description |
|------|-------------|
| **Bot** | A detection script (e.g., Attack Detector) deployed to Forta scan nodes |
| **Alert** | A structured event emitted by a bot when it detects a threat |
| **Scan Node** | A decentralized node that executes bots against blockchain data |
| **API** | RESTful API for querying historical alerts (`api.forta.network`) |
| **SDK** | TypeScript/Python SDK for building and running bots locally |

## 2. Integration Goals

1. **Detect attacks in real-time**: Subscribe to Forta’s `attack-detector` bot to receive alerts for new exploit addresses.
2. **Auto-update risk profiles**: When Forta detects an attack address, automatically call `RiskRegistry.updateRiskProfile()` to mark it as HIGH/CRITICAL tier.
3. **Minimize false positives**: Filter alerts by severity and confidence thresholds before updating on-chain.
4. **Audit trail**: Log every Forta-triggered update for compliance and debugging.

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Forta Network                                │
│  ┌──────────────────┐                                               │
│  │ Attack Detector  │  ──alert──▶  ┌──────────────┐               │
│  │ Bot              │              │ Forta API    │               │
│  └──────────────────┘              │ /webhook     │               │
│                                    └──────┬───────┘               │
└───────────────────────────────────────────┼─────────────────────────┘
                                            │
                                            ▼
                                    ┌──────────────┐
                                    │ FidesOrigin  │
                                    │ Forta Handler│
                                    │ (Node.js)    │
                                    └──────┬───────┘
                                           │
          ┌────────────────────────────────┼────────────────────────┐
          │                                │                        │
          ▼                                ▼                        ▼
   ┌──────────────┐               ┌──────────────────┐    ┌──────────────┐
   │ Webhook      │               │ Polling Loop     │    │ RiskRegistry │
   │ Server       │               │ (fallback)       │    │ Contract     │
   │ (Express)    │               │ (5 min interval) │    │ (on-chain)   │
   └──────────────┘               └──────────────────┘    └──────────────┘
```

## 4. Forta Alert Schema

Forta alerts are JSON objects with the following structure (relevant fields):

```json
{
  "alertId": "0x80ed3bdfa586d...",  // Forta bot ID (hex string from explorer.forta.network)
  "name": "Attack Detector",
  "description": "Flash loan attack detected",
  "severity": "CRITICAL",
  "type": "EXPLOIT",
  "metadata": {
    "attackerAddress": "0xBAD...",
    "victimAddress": "0xVIC...",
    "txHash": "0xabc...",
    "lossAmount": "1000000",
    "tokenSymbol": "USDC",
    "protocol": "SomeDeFi",
    "confidence": 0.95
  },
  "addresses": ["0xBAD...", "0xCONTRACT..."],
  "chainId": 1,
  "blockNumber": 19500000,
  "hash": "0xalert..."
}
```

### Severity Mapping to RiskTier

| Forta Severity | FidesOrigin Tier | Risk Score | Reason |
|----------------|------------------|------------|--------|
| `CRITICAL` | 4 (CRITICAL) | 100 | Active exploit in progress |
| `HIGH` | 3 (HIGH) | 90 | Likely attack or major exploit |
| `MEDIUM` | 2 (MEDIUM) | 60 | Suspicious activity |
| `LOW` | 1 (LOW) | 30 | Minor anomaly |
| `INFO` | 0 (UNKNOWN) | 0 | Ignore unless confirmed |

## 5. Webhook Integration (Primary)

### 5.1 Webhook Setup

FidesOrigin exposes a webhook endpoint that Forta (or a relay) can push alerts to.

```typescript
// src/forta-webhook.ts

import express from 'express';
import { ethers } from 'ethers';
import { config } from './config';
import logger from './logger';
import { RiskTier } from './types';

interface FortaAlert {
  alertId: string;
  name: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  type: string;
  metadata: {
    attackerAddress?: string;
    victimAddress?: string;
    txHash?: string;
    protocol?: string;
    confidence?: number;
    [key: string]: any;
  };
  addresses: string[];
  chainId: number;
  blockNumber: number;
  hash: string;
}

const SEVERITY_TO_TIER: Record<string, { tier: number; riskScore: number }> = {
  CRITICAL: { tier: 4, riskScore: 100 },
  HIGH: { tier: 3, riskScore: 90 },
  MEDIUM: { tier: 2, riskScore: 60 },
  LOW: { tier: 1, riskScore: 30 },
  INFO: { tier: 0, riskScore: 0 },
};

export class FortaWebhookHandler {
  private app: express.Application;
  private registry: ethers.Contract;
  private wallet: ethers.Wallet;
  private dryRun: boolean;
  private minConfidence: number;
  private allowedAlertIds: Set<string>;

  constructor(
    registryAddress: string,
    oracleKey: string,
    rpcUrl: string,
    chainId: number,
    opts: {
      dryRun?: boolean;
      minConfidence?: number;
      allowedAlertIds?: string[];
      port?: number;
    } = {}
  ) {
    this.app = express();
    this.app.use(express.json());

    const provider = new ethers.JsonRpcProvider(rpcUrl, chainId);
    this.wallet = new ethers.Wallet(oracleKey, provider);
    this.registry = new ethers.Contract(
      registryAddress,
      [
        'function updateRiskProfile(address subject, uint8 riskScore, uint8 tier, bytes32[] tags, bool sanctioned) external',
        'function hasRole(bytes32 role, address account) view returns (bool)',
        'function getTags(address addr) view returns (bytes32[])',
      ],
      this.wallet
    );

    this.dryRun = opts.dryRun ?? true;
    this.minConfidence = opts.minConfidence ?? 0.85;
    this.allowedAlertIds = new Set(opts.allowedAlertIds ?? ['0x80ed3bdfa586d...']);

    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (_req, res) => res.json({ status: 'ok' }));

    // Forta alert webhook
    this.app.post('/webhook/forta', async (req, res) => {
      try {
        const alert: FortaAlert = req.body;
        const result = await this.handleAlert(alert);
        res.status(200).json(result);
      } catch (error: any) {
        logger.error('Forta webhook error', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });
  }

  private async handleAlert(alert: FortaAlert): Promise<any> {
    // Validation
    if (!this.allowedAlertIds.has(alert.alertId)) {
      return { action: 'skipped', reason: 'alert_id_not_allowed' };
    }

    const confidence = alert.metadata.confidence ?? 0;
    if (confidence < this.minConfidence) {
      return { action: 'skipped', reason: 'confidence_too_low', confidence };
    }

    // Skip non-mainnet alerts (or handle multi-chain)
    if (alert.chainId !== 1) {
      return { action: 'skipped', reason: 'wrong_chain', chainId: alert.chainId };
    }

    const mapping = SEVERITY_TO_TIER[alert.severity];
    if (!mapping || mapping.tier === 0) {
      return { action: 'skipped', reason: 'severity_too_low', severity: alert.severity };
    }

    // Extract attacker addresses (prioritize metadata, fallback to addresses array)
    const rawAddresses = alert.metadata.attackerAddress
      ? [alert.metadata.attackerAddress]
      : alert.addresses;

    const ethAddresses = rawAddresses
      .filter(a => a.startsWith('0x') && a.length === 42)
      .map(a => a.toLowerCase());

    if (ethAddresses.length === 0) {
      return { action: 'skipped', reason: 'no_eth_addresses' };
    }

    const results = [];
    for (const addr of ethAddresses) {
      const tag = ethers.id(`forta-${alert.alertId.toLowerCase()}`);
      const tags = [tag, ethers.id(`forta-${alert.type.toLowerCase()}`)];

      logger.info(`Forta alert → updating risk profile`, {
        address: addr,
        alertId: alert.alertId,
        severity: alert.severity,
        tier: mapping.tier,
        confidence,
        txHash: alert.metadata.txHash,
      });

      if (this.dryRun) {
        results.push({
          address: addr,
          action: 'dry_run',
          tier: mapping.tier,
          riskScore: mapping.riskScore,
        });
        continue;
      }

      try {
        const tx = await this.registry.updateRiskProfile(
          addr,
          mapping.riskScore,
          mapping.tier,
          tags,
          true, // sanctioned = true for attacks
          { gasLimit: 300000 }
        );
        const receipt = await tx.wait(1);

        results.push({
          address: addr,
          action: 'updated',
          txHash: tx.hash,
          status: receipt.status === 1 ? 'success' : 'reverted',
          tier: mapping.tier,
          riskScore: mapping.riskScore,
        });
      } catch (error: any) {
        logger.error(`Failed to update profile for ${addr}`, { error: error.message });
        results.push({
          address: addr,
          action: 'failed',
          error: error.message,
        });
      }
    }

    return { action: 'processed', processed: results.length, results };
  }

  start(port: number = 3000): void {
    this.app.listen(port, () => {
      logger.info(`Forta webhook server listening on port ${port}`);
    });
  }
}
```

### 5.2 Webhook Security

Forta webhooks use HMAC-SHA256 signatures for authentication. Add a middleware:

```typescript
function verifyFortaWebhook(secret: string): express.RequestHandler {
  return (req, res, next) => {
    const signature = req.headers['x-forta-signature'] as string;
    if (!signature) {
      return res.status(401).json({ error: 'missing_signature' });
    }
    // Forta may send signature with "sha256=" prefix (common webhook format)
    const sig = signature.startsWith('sha256=') ? signature.slice(7) : signature;
    const body = JSON.stringify(req.body);
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return res.status(401).json({ error: 'invalid_signature' });
    }
    next();
  };
}

this.app.use('/webhook/forta', verifyFortaWebhook(process.env.FORTA_WEBHOOK_SECRET!));
```

## 6. Polling Fallback (Secondary)

If webhooks are unavailable or unreliable, poll the Forta GraphQL API for new alerts:

```typescript
// src/forta-polling.ts

import axios from 'axios';

const FORTA_API = 'https://api.forta.network/graphql';

const ALERT_QUERY = `
  query getAlerts($input: AlertsInput) {
    alerts(input: $input) {
      alerts {
        alertId
        name
        description
        severity
        type
        metadata
        addresses
        chainId
        blockNumber
        hash
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

interface FortaPollingOpts {
  botIds: string[];
  minConfidence: number;
  chainId: number;
  pollIntervalMs: number;
  since: string; // ISO timestamp
}

export class FortaPoller {
  private lastCursor: string | null = null;
  private isRunning = false;

  constructor(private handler: FortaWebhookHandler, private opts: FortaPollingOpts) {}

  async start(): Promise<void> {
    this.isRunning = true;
    while (this.isRunning) {
      try {
        await this.poll();
      } catch (error: any) {
        logger.error('Forta polling error', { error: error.message });
      }
      await new Promise(r => setTimeout(r, this.opts.pollIntervalMs));
    }
  }

  private async poll(): Promise<void> {
    const response = await axios.post(FORTA_API, {
      query: ALERT_QUERY,
      variables: {
        input: {
          botIds: this.opts.botIds,
          chainId: this.opts.chainId,
          createdSince: this.opts.since,
          first: 100,
          after: this.lastCursor,
        },
      },
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });

    const alerts = response.data?.data?.alerts?.alerts || [];
    for (const alert of alerts) {
      await this.handler.handleAlert(alert);
    }

    const pageInfo = response.data?.data?.alerts?.pageInfo;
    if (pageInfo?.hasNextPage) {
      this.lastCursor = pageInfo.endCursor;
    } else {
      this.lastCursor = null;
    }
  }

  stop(): void {
    this.isRunning = false;
  }
}
```

### Polling Schedule

| Mode | Interval | Use Case |
|------|----------|----------|
| Real-time | 30s | Webhook unavailable, high-priority alerts |
| Standard | 5min | Fallback, general monitoring |
| Batch | 15min | Historical backfill |

## 7. Configuration

```env
# .env
FORTA_ENABLED=true
FORTA_MODE=webhook          # or "polling" or "both"
FORTA_WEBHOOK_PORT=3000
FORTA_WEBHOOK_SECRET=your-secret-here
FORTA_MIN_CONFIDENCE=0.85
FORTA_ALLOWED_ALERT_IDS=0x80ed3bdfa586d...,0x9aaa5cd640d0...
FORTA_POLL_INTERVAL_MS=300000
FORTA_DRY_RUN=true
```

## 8. Alert Processing Pipeline

```
┌──────────┐    ┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│  Forta   │───▶│  Webhook    │───▶│  Validation  │───▶│  Rate Limit  │───▶│  On-Chain   │
│  Alert   │    │  / Polling   │    │  + Filter    │    │  + Debounce  │    │  Update     │
└──────────┘    └─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
                                      │ Confidence > 0.85
                                      │ AlertId in allowlist
                                      │ Severity ≥ HIGH
                                      │ ChainId matches
                                      │ Eth address present
```

### Rate Limiting & Debounce

```typescript
const RECENT_UPDATE_MAP = new Map<string, number>(); // address → timestamp
const DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

function shouldUpdate(address: string): boolean {
  const last = RECENT_UPDATE_MAP.get(address);
  if (last && Date.now() - last < DEBOUNCE_MS) return false;
  RECENT_UPDATE_MAP.set(address, Date.now());
  return true;
}
```

## 9. Monitoring & Alerting

| Metric | Source | Alert |
|--------|--------|-------|
| Forta alerts received | Webhook logs | > 0 (any) |
| On-chain update success rate | Tx receipts | < 95% |
| Polling lag | Cursor timestamp | > 10 min |
| False positive rate | Manual review weekly | > 5% |
| Gas cost per update | Tx receipts | > $50 per alert |

## 10. Integration Flow Diagram

```
┌────────────────┐
│  Forta Scan Node │
│  (decentralized) │
└───────┬────────┘
        │ Alert emitted (within 1-2 blocks of detection)
        ▼
┌────────────────────────┐
│  FidesOrigin Webhook    │
│  POST /webhook/forta    │
│  - Verify signature     │
│  - Filter by confidence │
│  - Map severity → tier  │
└───────┬────────────────┘
        │
        ▼
┌────────────────────────┐
│  Rate Limit + Debounce  │
│  - Skip if updated <5min│
│  - Skip if same tx hash │
└───────┬────────────────┘
        │
        ▼
┌────────────────────────┐
│  RiskRegistry.update()  │
│  - txHash on-chain      │
│  - tags: forta-*        │
└───────┬────────────────┘
        │
        ▼
┌────────────────────────┐
│  Subgraph indexing      │
│  - RiskProfile entity   │
│  - Address snapshot     │
│  - Dashboard queryable  │
└────────────────────────┘
```

## 11. Recommended Forta Bots to Subscribe

| Bot ID | Name | Description | Priority |
|--------|------|-------------|----------|
| `0x80ed3bdfa586d...` | Attack Detector | Detects flash loan attacks, exploits | **HIGH** |
| `0x9aaa5cd640d0...` | Phishing Bot | Detects phishing contract deployments | **HIGH** |
| `0x1d646c41fd09...` | Bridge Exploit | Detects bridge exploit patterns | MEDIUM |
| `0x...` | Rug Pull Detector | Early warning for rug pulls | MEDIUM |
| `0x...` | Suspicious Funding | Large fund movements from mixer | LOW |

## 12. Testing & Validation

```typescript
// Simulate a Forta alert for testing
// NOTE: Forta bot IDs are hex strings (e.g., 0x80ed3bdfa586d...).
// The 'ATTACK-DETECTOR-1' format used in v1.0 was a placeholder.
const testAlert: FortaAlert = {
  alertId: '0x80ed3bdfa586d...',  // Real Forta bot ID from explorer.forta.network
  name: 'Attack Detector',
  description: 'Flash loan attack',
  severity: 'CRITICAL',
  type: 'EXPLOIT',
  metadata: {
    attackerAddress: '0x1234567890123456789012345678901234567890',
    confidence: 0.95,
    txHash: '0xabc...',
  },
  addresses: ['0x1234567890123456789012345678901234567890'],
  chainId: 1,
  blockNumber: 19500000,
  hash: '0xalert...',
};

const handler = new FortaWebhookHandler(
  config.publisher.riskRegistryAddress,
  oracleKey,
  config.publisher.rpcUrl,
  config.publisher.chainId,
  { dryRun: true }
);
handler.handleAlert(testAlert).then(console.log);
```

## 13. Rollback & Recovery

If a false positive is identified (e.g., a Forta alert turns out to be a benign MEV transaction), the FidesOrigin oracle can issue a corrective update:

```typescript
// Downgrade a false positive
await registry.updateRiskProfile(
  addr,
  0,   // riskScore
  0,   // tier = UNKNOWN
  [ethers.id('forta-false-positive')],  // tags
  false, // sanctioned = false
);
```

All updates are immutable on-chain and indexed by the subgraph, so the full audit trail remains intact.

## 14. Future Enhancements

- **Multi-bot aggregation**: Combine signals from multiple Forta bots (e.g., Attack Detector + Phishing Bot) before updating on-chain.
- **Forta SDK native**: Run a custom FidesOrigin bot directly on Forta scan nodes to detect protocol-specific violations.
- **SLA guarantee**: If the Forta webhook latency exceeds 5 minutes, auto-fallback to polling mode.
- **Machine learning**: Use historical Forta alerts + on-chain outcomes to train a model that predicts false positives and reduces unnecessary updates.
