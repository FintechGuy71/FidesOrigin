# Etherscan Labels Crawl Design

## Overview

This document describes how FidesOrigin crawls and indexes **Etherscan Label Cloud** data to enrich address risk profiles. Etherscan labels categorize addresses (wallets, contracts, tokens) by their real-world identity, enabling FidesOrigin to map known entity types to risk tiers.

## 1. Etherscan Label Cloud Structure

Etherscan maintains a public [Label Cloud](https://etherscan.io/labelcloud) that categorizes addresses by type. The data is available through two channels:

- **Web UI**: Paginated, browsable labels at `etherscan.io/labelcloud`
- **API**: `etherscan.io/api` with the `action=txlist` and related endpoints (requires API key, free tier: 5 req/s)

### 1.1 Label Categories

| Category | Description | Example Labels | Risk Mapping |
|----------|-------------|----------------|-------------|
| **Exchange** | Centralized exchange hot/cold wallets | `Binance`, `Coinbase`, `Kraken` | **LOW** — regulated, KYC compliant |
| **DeFi** | DEX routers, lending protocols, yield farms | `Uniswap`, `Aave`, `Compound` | **LOW** — legitimate protocols |
| **Phishing** | Known scam, phishing, or honeypot contracts | `Phishing`, `Fake_Phishing`, `Honeypot` | **HIGH** — active fraud |
| **Contract** | General smart contracts (no known risk) | `ERC-20`, `ERC-721`, `Multisig` | **MEDIUM** — unknown intent |
| **Token** | ERC-20 / ERC-721 tokens | `USDC`, `USDT`, `BAYC` | **LOW** — legitimate tokens |
| **Mixer** | Tornado Cash, etc. | `TornadoCash` | **HIGH** — privacy obfuscation |
| **Bridge** | Cross-chain bridge contracts | `Wormhole`, `LayerZero` | **LOW** — infrastructure |
| **Donation** | Charity / fundraising addresses | `UkraineDAO`, `Gitcoin` | **LOW** |
| **Bot** | MEV bots, arbitrage bots | `MEV Bot`, `Arbitrage` | **MEDIUM** — automated, not inherently risky |
| **Hack/Exploit** | Addresses involved in known hacks | `Hack`, `Exploit` | **CRITICAL** |

### 1.2 Web UI Structure

The Label Cloud page structure:

```
etherscan.io/labelcloud?page=1
├── HTML pagination (e.g., "Showing 1-25 of 1,234 labels")
├── Label cards:
│   ├── Label name (e.g., "Binance")
│   ├── Category badge (e.g., "Exchange")
│   └── Link to label page: etherscan.io/accounts/label/binance
│
erscan.io/accounts/label/binance
├── Label metadata
│   ├── Name: "Binance"
│   ├── Category: "Exchange"
│   └── Website: "https://binance.com"
├── Address table:
│   ├── Address | Name | Type | Balance | TxCount
│   └── Pagination (e.g., 25 / 50 / 100 per page)
```

### 1.3 API Endpoints

```
GET https://api.etherscan.io/api
  ?module=account
  &action=txlist
  &address=0x...
  &startblock=0
  &endblock=99999999
  &sort=asc
  &apikey=YourApiKey
```

**Note**: Etherscan does **not** expose a direct "list all labels" API. The label data must be scraped from the web UI or obtained via third-party datasets.

## 2. Crawl Strategy

### 2.1 Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Etherscan Label Crawler                          │
│                                                                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │
│  │  Label     │  │  Address   │  │  Risk      │  │  Local     │  │
│  │  Discovery │─▶│  Extraction│─▶│  Mapping   │─▶│  Database  │  │
│  │  (Web UI)  │  │  (Web UI)  │  │  (Rules)   │  │  (SQLite)  │  │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘  │
│        │                │                │                │         │
│        ▼                ▼                ▼                ▼         │
│   etherscan.io     etherscan.io     risk_rules.ts   labels.db      │
│   /labelcloud      /accounts/label                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Implementation (`src/etherscan-label-crawler.ts`)

```typescript
import axios from 'axios';
import * as cheerio from 'cheerio';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import logger from './logger';

// ─── Types ───────────────────────────────────────────────────────

interface EtherscanLabel {
  name: string;
  category: string;
  website?: string;
  addressCount: number;
}

interface EtherscanAddressEntry {
  address: string;
  labelName: string;
  category: string;
  entityName: string;   // Display name on Etherscan
  balance: string;
  txCount: number;
  riskTier: number;     // 0-4 mapped from category
  riskScore: number;    // 0-100 mapped from category
  tags: string[];
  crawledAt: string;
}

// ─── Risk Mapping Rules ──────────────────────────────────────────

const RISK_MAP: Record<string, { tier: number; riskScore: number; tags: string[] }> = {
  'Exchange':    { tier: 1, riskScore: 20,  tags: ['exchange', 'kyc'] },
  'DeFi':        { tier: 1, riskScore: 20,  tags: ['defi', 'protocol'] },
  'Token':       { tier: 1, riskScore: 15,  tags: ['token', 'erc20'] },
  'Bridge':      { tier: 1, riskScore: 20,  tags: ['bridge'] },
  'Donation':    { tier: 1, riskScore: 10,  tags: ['donation', 'charity'] },
  'Contract':    { tier: 2, riskScore: 40,  tags: ['contract'] },
  'Bot':         { tier: 2, riskScore: 45,  tags: ['bot', 'mev'] },
  'Phishing':    { tier: 3, riskScore: 90,  tags: ['phishing', 'scam'] },
  'Mixer':       { tier: 3, riskScore: 85,  tags: ['mixer', 'privacy'] },
  'Hack':        { tier: 4, riskScore: 100, tags: ['hack', 'exploit'] },
  'Unknown':     { tier: 2, riskScore: 50,  tags: ['unknown'] },
};

function mapRisk(category: string): { tier: number; riskScore: number; tags: string[] } {
  const normalized = category.trim().toLowerCase();
  for (const [key, value] of Object.entries(RISK_MAP)) {
    if (key.toLowerCase() === normalized) return value;
  }
  return RISK_MAP['Unknown'];
}

// ─── Rate Limiting ───────────────────────────────────────────────

const RATE_LIMIT_RPS = 5;           // Etherscan free tier: 5 requests/sec
const RATE_LIMIT_INTERVAL_MS = 1000 / RATE_LIMIT_RPS; // 200ms between requests

class RateLimiter {
  private lastRequestTime = 0;

  async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < RATE_LIMIT_INTERVAL_MS) {
      await new Promise(r => setTimeout(r, RATE_LIMIT_INTERVAL_MS - elapsed));
    }
    this.lastRequestTime = Date.now();
  }
}

const rateLimiter = new RateLimiter();

// ─── Database ────────────────────────────────────────────────────

async function initDb(dbPath: string = './etherscan-labels.db') {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      website TEXT,
      address_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT NOT NULL UNIQUE,
      label_name TEXT NOT NULL,
      category TEXT NOT NULL,
      entity_name TEXT,
      balance TEXT,
      tx_count INTEGER,
      risk_tier INTEGER,
      risk_score INTEGER,
      tags TEXT,  -- JSON array
      crawled_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (label_name) REFERENCES labels(name)
    );

    CREATE INDEX IF NOT EXISTS idx_address ON addresses(address);
    CREATE INDEX IF NOT EXISTS idx_category ON addresses(category);
    CREATE INDEX IF NOT EXISTS idx_label_name ON addresses(label_name);
  `);

  return db;
}

// ─── Web Scraper ─────────────────────────────────────────────────

const ETHERSCAN_BASE = 'https://etherscan.io';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

export class EtherscanLabelCrawler {
  private db: Awaited<ReturnType<typeof initDb>>;
  private rateLimiter = new RateLimiter();

  constructor(dbPath?: string) {
    this.init(dbPath);
  }

  private async init(dbPath?: string): Promise<void> {
    this.db = await initDb(dbPath);
  }

  /**
   * Step 1: Discover all labels from the Label Cloud paginated pages.
   */
  async discoverLabels(maxPages?: number): Promise<EtherscanLabel[]> {
    const labels: EtherscanLabel[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      if (maxPages && page > maxPages) break;

      await this.rateLimiter.throttle();
      const url = `${ETHERSCAN_BASE}/labelcloud?page=${page}`;
      logger.info(`Crawling label page ${page}`, { url });

      try {
        const resp = await axios.get(url, {
          headers: { 'User-Agent': USER_AGENT },
          timeout: 30000,
        });

        const $ = cheerio.load(resp.data);
        const cards = $('.card');

        if (cards.length === 0) {
          hasMore = false;
          break;
        }

        cards.each((_i, el) => {
          const $card = $(el);
          const name = $card.find('.card-title').text().trim();
          const category = $card.find('.badge').text().trim() || 'Unknown';
          const website = $card.find('a[href^="http"]').attr('href');
          const addressCountText = $card.find('.text-muted').text().match(/(\d+)/);
          const addressCount = addressCountText ? parseInt(addressCountText[1]) : 0;

          if (name) {
            labels.push({ name, category, website, addressCount });
          }
        });

        // Check for next page
        const nextBtn = $('.pagination .page-item.active + .page-item');
        hasMore = nextBtn.length > 0 && !nextBtn.hasClass('disabled');
        page++;
      } catch (error: any) {
        logger.error(`Failed to crawl page ${page}: ${error.message}`);
        hasMore = false;
      }
    }

    logger.info(`Label discovery complete: ${labels.length} labels found`);
    return labels;
  }

  /**
   * Step 2: Extract all addresses from a single label page.
   */
  async extractLabelAddresses(labelName: string): Promise<EtherscanAddressEntry[]> {
    const entries: EtherscanAddressEntry[] = [];
    const slug = labelName.toLowerCase().replace(/\s+/g, '-');
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      await this.rateLimiter.throttle();
      const url = `${ETHERSCAN_BASE}/accounts/label/${slug}?page=${page}`;

      try {
        const resp = await axios.get(url, {
          headers: { 'User-Agent': USER_AGENT },
          timeout: 30000,
        });

        const $ = cheerio.load(resp.data);
        const rows = $('table tbody tr');

        if (rows.length === 0) {
          hasMore = false;
          break;
        }

        rows.each((_i, el) => {
          const $row = $(el);
          const cells = $row.find('td');
          if (cells.length < 2) return;

          const addressLink = $(cells[0]).find('a').attr('href') || '';
          const address = addressLink.replace('/address/', '').toLowerCase();
          const entityName = $(cells[1]).text().trim();
          const balance = $(cells[2]).text().trim() || '';
          const txCountText = $(cells[3]).text().trim().replace(/,/g, '');
          const txCount = parseInt(txCountText) || 0;

          if (address && address.startsWith('0x') && address.length === 42) {
            entries.push({
              address,
              labelName,
              category: 'Unknown', // Will be filled from label metadata
              entityName,
              balance,
              txCount,
              riskTier: 0,
              riskScore: 0,
              tags: [],
              crawledAt: new Date().toISOString(),
            });
          }
        });

        // Check for next page
        const nextBtn = $('.pagination .page-item.active + .page-item');
        hasMore = nextBtn.length > 0 && !nextBtn.hasClass('disabled');
        page++;
      } catch (error: any) {
        logger.error(`Failed to extract addresses for "${labelName}" page ${page}: ${error.message}`);
        hasMore = false;
      }
    }

    return entries;
  }

  /**
   * Step 3: Full crawl — discover labels, extract addresses, persist to DB.
   */
  async runFullCrawl(opts: { maxLabelPages?: number; labelFilter?: string[] } = {}): Promise<{
    labels: number;
    addresses: number;
  }> {
    await this.db; // Ensure DB is initialized

    // 1. Discover labels
    const labels = await this.discoverLabels(opts.maxLabelPages);

    // Filter by category if specified
    const filteredLabels = opts.labelFilter
      ? labels.filter(l => opts.labelFilter!.includes(l.category))
      : labels;

    // 2. Insert labels into DB
    for (const label of filteredLabels) {
      await this.db.run(
        `INSERT INTO labels (name, category, website, address_count)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET
           category = excluded.category,
           website = excluded.website,
           address_count = excluded.address_count,
           updated_at = datetime('now')`,
        [label.name, label.category, label.website || null, label.addressCount]
      );
    }

    // 3. Extract and persist addresses for each label
    let totalAddresses = 0;
    for (const label of filteredLabels) {
      const riskMap = mapRisk(label.category);
      const addresses = await this.extractLabelAddresses(label.name);

      for (const entry of addresses) {
        entry.category = label.category;
        entry.riskTier = riskMap.tier;
        entry.riskScore = riskMap.riskScore;
        entry.tags = [...riskMap.tags, `label:${label.name.toLowerCase().replace(/\s+/g, '_')}`];

        await this.db.run(
          `INSERT INTO addresses
           (address, label_name, category, entity_name, balance, tx_count, risk_tier, risk_score, tags, crawled_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(address) DO UPDATE SET
             label_name = excluded.label_name,
             category = excluded.category,
             entity_name = excluded.entity_name,
             balance = excluded.balance,
             tx_count = excluded.tx_count,
             risk_tier = excluded.risk_tier,
             risk_score = excluded.risk_score,
             tags = excluded.tags,
             crawled_at = excluded.crawled_at`,
          [
            entry.address,
            entry.labelName,
            entry.category,
            entry.entityName,
            entry.balance,
            entry.txCount,
            entry.riskTier,
            entry.riskScore,
            JSON.stringify(entry.tags),
            entry.crawledAt,
          ]
        );
      }

      totalAddresses += addresses.length;
      logger.info(`Crawled "${label.name}": ${addresses.length} addresses (${label.category})`);
    }

    logger.info(`Full crawl complete: ${filteredLabels.length} labels, ${totalAddresses} addresses`);
    return { labels: filteredLabels.length, addresses: totalAddresses };
  }

  /**
   * Query the local DB for addresses by category or label.
   */
  async query(opts: {
    category?: string;
    label?: string;
    riskTier?: number;
    limit?: number;
  }): Promise<EtherscanAddressEntry[]> {
    await this.db;

    let sql = 'SELECT * FROM addresses WHERE 1=1';
    const params: any[] = [];

    if (opts.category) {
      sql += ' AND category = ?';
      params.push(opts.category);
    }
    if (opts.label) {
      sql += ' AND label_name = ?';
      params.push(opts.label);
    }
    if (opts.riskTier !== undefined) {
      sql += ' AND risk_tier = ?';
      params.push(opts.riskTier);
    }
    sql += ' LIMIT ?';
    params.push(opts.limit || 100);

    const rows = await this.db.all(sql, params);
    return rows.map(r => ({
      ...r,
      tags: JSON.parse(r.tags || '[]'),
    }));
  }

  /**
   * Export all addresses as FidesOrigin-compatible enriched records.
   */
  async exportForPublisher(): Promise<{
    address: string;
    riskScore: number;
    tier: number;
    tags: string[];
    sanctioned: boolean;
    source: string;
  }[]> {
    await this.db;
    const rows = await this.db.all('SELECT * FROM addresses');

    return rows.map(r => ({
      address: r.address,
      riskScore: r.risk_score,
      tier: r.risk_tier,
      tags: JSON.parse(r.tags || '[]'),
      sanctioned: r.category === 'Phishing' || r.category === 'Hack' || r.category === 'Mixer',
      source: 'etherscan-labels',
    }));
  }
}

// ─── CLI ─────────────────────────────────────────────────────────

if (require.main === module) {
  (async () => {
    const crawler = new EtherscanLabelCrawler('./etherscan-labels.db');

    const args = process.argv.slice(2);
    const command = args[0] || 'crawl';

    if (command === 'crawl') {
      const maxPages = args[1] ? parseInt(args[1]) : undefined;
      await crawler.runFullCrawl({ maxLabelPages: maxPages });
    } else if (command === 'query') {
      const category = args[1];
      const results = await crawler.query({ category, limit: 50 });
      console.table(results.map(r => ({
        address: r.address,
        label: r.labelName,
        category: r.category,
        tier: r.riskTier,
        score: r.riskScore,
      })));
    } else if (command === 'export') {
      const records = await crawler.exportForPublisher();
      console.log(JSON.stringify(records, null, 2));
    } else {
      console.log(`
Usage:
  ts-node etherscan-label-crawler.ts crawl [max_label_pages]
  ts-node etherscan-label-crawler.ts query [category]
  ts-node etherscan-label-crawler.ts export
`);
    }

    process.exit(0);
  })().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
```

## 3. Rate Limit Handling

### 3.1 Etherscan API Limits

| Tier | Rate Limit | Cost | Notes |
|------|-----------|------|-------|
| Free | 5 req/s | Free | Sufficient for label discovery |
| Pro | 10 req/s | $199/mo | Faster backfill |
| Enterprise | Custom | Custom | Dedicated endpoint |

### 3.2 Rate Limiting Strategy

```typescript
// Strict 5 req/s with burst bucket
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms

  constructor(maxRps: number = 5) {
    this.maxTokens = maxRps;
    this.tokens = maxRps;
    this.refillRate = maxRps / 1000;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
    await new Promise(r => setTimeout(r, waitMs));
    this.tokens -= 1;
  }
}
```

### 3.3 Exponential Backoff for Retries

```typescript
async function fetchWithRetry(url: string, maxRetries: number = 3): Promise<any> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await axios.get(url, { timeout: 30000 });
    } catch (error: any) {
      if (error.response?.status === 429) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        logger.warn(`Rate limited (429), retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error(`Max retries exceeded for ${url}`);
}
```

## 4. Risk Mapping Summary

| Etherscan Category | FidesOrigin Tier | Risk Score | Sanctioned | Rationale |
|--------------------|------------------|------------|------------|-----------|
| Exchange | LOW (1) | 20 | false | Regulated, KYC |
| DeFi | LOW (1) | 20 | false | Audited, legitimate |
| Token | LOW (1) | 15 | false | Standard ERC-20/721 |
| Bridge | LOW (1) | 20 | false | Infrastructure |
| Donation | LOW (1) | 10 | false | Charity |
| Contract | MEDIUM (2) | 40 | false | Unknown intent |
| Bot | MEDIUM (2) | 45 | false | Automated, monitor |
| **Unknown** | **MEDIUM (2)** | **50** | **false** | **Default fallback** |
| Phishing | HIGH (3) | 90 | true | Active fraud |
| Mixer | HIGH (3) | 85 | true | OFAC-sanctioned (e.g., TornadoCash) |
| Hack | CRITICAL (4) | 100 | true | Confirmed exploit |

## 5. Database Schema

### 5.1 Labels Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `name` | TEXT UNIQUE | Label name (e.g., "Binance") |
| `category` | TEXT | High-level category |
| `website` | TEXT | Official website URL |
| `address_count` | INTEGER | Approximate number of addresses |
| `created_at` | TEXT | ISO timestamp |
| `updated_at` | TEXT | ISO timestamp |

### 5.2 Addresses Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `address` | TEXT UNIQUE | Ethereum address (0x...) |
| `label_name` | TEXT FK | References `labels.name` |
| `category` | TEXT | Risk category |
| `entity_name` | TEXT | Display name from Etherscan |
| `balance` | TEXT | ETH balance (for reference) |
| `tx_count` | INTEGER | Transaction count |
| `risk_tier` | INTEGER | 0-4 mapped risk tier |
| `risk_score` | INTEGER | 0-100 mapped risk score |
| `tags` | TEXT | JSON array of tags |
| `crawled_at` | TEXT | ISO timestamp |

## 6. Integration with FidesOrigin Pipeline

### 6.1 Weekly Sync Schedule

```yaml
# docker-compose.yml or K8s CronJob
etherscan-crawler:
  image: fidesorigin/data-publisher
  command: ["ts-node", "src/etherscan-label-crawler.ts", "crawl", "100"]
  schedule: "0 4 * * 0"  # Every Sunday at 4 AM
  env:
    - DB_PATH=/data/etherscan-labels.db
```

### 6.2 Publishing to RiskRegistry

```typescript
// After crawling, push new labels to the blockchain
import { EtherscanLabelCrawler } from './etherscan-label-crawler';
import { runBatchSync } from './batch-collector';

async function publishEtherscanLabels(): Promise<void> {
  const crawler = new EtherscanLabelCrawler();
  const records = await crawler.exportForPublisher();

  // Filter to HIGH/CRITICAL categories only (to save gas)
  const highRisk = records.filter(r => r.tier >= 2);

  if (highRisk.length === 0) {
    logger.info('No new high-risk Etherscan labels to publish');
    return;
  }

  // Batch publish via existing pipeline
  // ... (reuse publishBatches logic from batch-collector.ts)
}
```

## 7. Alternatives & Fallbacks

| Source | Method | Coverage | Reliability |
|--------|--------|----------|-------------|
| Etherscan Label Cloud | Web scraping | ~2000 labels | Medium (HTML changes) |
| Etherscan API | REST API | Limited | High (stable) |
| Dune Analytics | SQL queries | User-contributed | Medium |
| Nansen | API | Premium | High (paid) |
| Arkham Intelligence | API | Premium | High (paid) |
| DeFiLlama | API | Protocols | High |
| ScamSniffer | GitHub | Phishing | High |

### Fallback Strategy

If Etherscan web scraping breaks (HTML structure changes):

1. **Dune Analytics**: Query user-submitted label tables.
2. **Community CSV**: Accept manual label uploads via the FidesOrigin dashboard.
3. **On-chain fallback**: Use the existing `batch-collector.ts` OFAC + ScamSniffer pipeline (no Etherscan dependency).

## 8. Testing

```bash
# Run a small test crawl (first 2 label pages)
npx ts-node src/etherscan-label-crawler.ts crawl 2

# Query by category
npx ts-node src/etherscan-label-crawler.ts query Phishing

# Export all for review
npx ts-node src/etherscan-label-crawler.ts export > labels.json
```

## 9. Monitoring

| Metric | Source | Alert |
|--------|--------|-------|
| Crawl duration | Job logs | > 2 hours |
| Addresses crawled | DB count | < 1000 (anomaly) |
| Failed page fetches | Error logs | > 5% |
| DB size | Filesystem | > 1GB |
| HTML structure change | Parse errors | Any parse failure |

## 10. Compliance Notes

- **Etherscan ToS**: Web scraping must comply with `etherscan.io/robots.txt`. Use a reasonable crawl rate (5 req/s).
- **⚠️ Web Scraping Risk**: Automated scraping of `etherscan.io/labelcloud` and `etherscan.io/accounts/label/*` may violate Etherscan's Terms of Service and result in IP bans, CAPTCHA challenges, or legal action. The `5 req/s` rate limit mentioned in Section 3.1 applies to the **API** (`api.etherscan.io`), not the web UI. There is no documented rate limit for the web UI, but aggressive scraping is likely to trigger anti-bot measures.
- **Mitigation**: Implement proxy rotation (residential or datacenter proxy pool), random request delays (1-5s), and rotate User-Agent strings. If IP banned, immediately fall back to alternative sources (Dune, ScamSniffer, community CSV) per Section 7.
- **Data attribution**: When presenting Etherscan label data to users, include an attribution link: "Data from Etherscan Label Cloud".
- **No personal data**: Etherscan labels identify organizations, not natural persons. No GDPR concerns.
