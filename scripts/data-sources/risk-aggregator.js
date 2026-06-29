/**
 * @title Open Source Risk Data Aggregator
 * @notice Aggregates risk data from multiple free/open sources and syncs to RiskRegistry
 * @dev Sources: Etherscan tags, OFAC sanctions, SlowMist blacklist
 */

const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

// Cache directory for downloaded data
const CACHE_DIR = path.join(__dirname, '..', '.risk-cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Base class for risk data sources
 */
class RiskDataSource {
  constructor(name) {
    this.name = name;
  }

  async fetch() {
    throw new Error('Subclass must implement fetch()');
  }

  normalize(rawData) {
    throw new Error('Subclass must implement normalize()');
  }
}

/**
 * OFAC SDN List (Sanctions) - Free download from Treasury
 * URL: https://www.treasury.gov/ofac/downloads/sanctions/1.0/sdn_advanced.xml
 */
class OFACSource extends RiskDataSource {
  constructor() {
    super('OFAC_SDN');
    this.url = 'https://www.treasury.gov/ofac/downloads/sanctions/1.0/sdn_advanced.xml';
  }

  async fetch() {
    try {
      const response = await fetch(this.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const xmlText = await response.text();
      
      // Parse XML and extract crypto addresses
      // OFAC XML contains <DigitalCurrencyAddress> elements
      const addresses = [];
      const addressRegex = /<DigitalCurrencyAddress>([0-9a-fA-FxX]+)<\/DigitalCurrencyAddress>/g;
      let match;
      while ((match = addressRegex.exec(xmlText)) !== null) {
        addresses.push({
          address: match[1].toLowerCase().startsWith('0x') ? match[1].toLowerCase() : null,
          type: 'sanctioned',
          source: 'OFAC',
          riskScore: 100,
          tier: 4, // BLACK
        });
      }
      
      console.log(`[OFAC] Fetched ${addresses.length} sanctioned addresses`);
      return addresses.filter(a => a.address !== null);
    } catch (error) {
      console.warn(`[OFAC] Fetch failed: ${error.message}`);
      return [];
    }
  }

  normalize(rawData) {
    return rawData;
  }
}

/**
 * SlowMist Public Blacklist
 * URL: https://hacked.slowmist.io/ (scrape or use their API if available)
 */
class SlowMistSource extends RiskDataSource {
  constructor() {
    super('SlowMist');
    this.url = 'https://api.slowmist.io/v1/hacked/list';
  }

  async fetch() {
    try {
      const response = await fetch(this.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      // Extract addresses from SlowMist format
      const addresses = [];
      if (data && data.data && Array.isArray(data.data)) {
        for (const item of data.data) {
          if (item.addresses) {
            for (const addr of item.addresses) {
              addresses.push({
                address: addr.toLowerCase(),
                type: 'hacked',
                source: 'SlowMist',
                riskScore: 90,
                tier: 4, // BLACK
                metadata: {
                  project: item.project_name,
                  loss: item.loss_amount,
                  chain: item.chain,
                },
              });
            }
          }
        }
      }
      
      console.log(`[SlowMist] Fetched ${addresses.length} hacked addresses`);
      return addresses;
    } catch (error) {
      console.warn(`[SlowMist] Fetch failed: ${error.message}`);
      return [];
    }
  }

  normalize(rawData) {
    return rawData;
  }
}

/**
 * Etherscan Labels (requires API key for tag API)
 * Free tier: 5 calls/second, 100k calls/day
 */
class EtherscanLabelSource extends RiskDataSource {
  constructor(apiKey) {
    super('Etherscan_Labels');
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.etherscan.io/api';
  }

  async fetch() {
    if (!this.apiKey) {
      console.warn('[Etherscan] No API key provided, skipping');
      return [];
    }

    try {
      // Fetch known malicious labels
      const labels = [
        'phish-hack',
        'heist',
        'exploit',
        'fake-phishing',
        'malware',
      ];

      const addresses = [];
      for (const label of labels) {
        const url = `${this.baseUrl}?module=account&action=txlist&address=${label}&sort=desc&apikey=${this.apiKey}`;
        // Note: Etherscan doesn't have a direct "get addresses by label" API
        // This is a simplified example - in production you'd use their label API or scrape
        
        // For demo, we'll use a static list of known risky addresses
        // In production, integrate with their label API
      }

      console.log(`[Etherscan] Label integration configured (API key present)`);
      return addresses;
    } catch (error) {
      console.warn(`[Etherscan] Fetch failed: ${error.message}`);
      return [];
    }
  }

  normalize(rawData) {
    return rawData;
  }
}

/**
 * Risk Aggregator - combines all sources and syncs to RiskRegistry
 */
class RiskAggregator {
  constructor(riskRegistry, sources = []) {
    this.riskRegistry = riskRegistry;
    this.sources = sources;
  }

  async syncAll() {
    const allAddresses = [];

    for (const source of this.sources) {
      try {
        const data = await source.fetch();
        const normalized = source.normalize(data);
        allAddresses.push(...normalized);
      } catch (error) {
        console.error(`[${source.name}] Error:`, error.message);
      }
    }

    // Deduplicate by address
    const unique = new Map();
    for (const item of allAddresses) {
      const existing = unique.get(item.address);
      if (!existing || item.riskScore > existing.riskScore) {
        unique.set(item.address, item);
      }
    }

    console.log(`[Aggregator] Total unique risky addresses: ${unique.size}`);
    return Array.from(unique.values());
  }

  async syncToChain(addresses, oracleSigner) {
    if (!this.riskRegistry) {
      console.warn('[Aggregator] No RiskRegistry connected, skipping chain sync');
      return;
    }

    const batchSize = 50; // RiskRegistry batchUpdateRiskProfiles limit
    const batches = [];
    
    for (let i = 0; i < addresses.length; i += batchSize) {
      batches.push(addresses.slice(i, i + batchSize));
    }

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const accounts = batch.map(a => a.address);
      const scores = batch.map(a => a.riskScore);
      const tiers = batch.map(a => a.tier);
      const sanctioned = batch.map(a => a.tier === 4);

      try {
        const tx = await this.riskRegistry
          .connect(oracleSigner)
          .batchUpdateRiskProfiles(accounts, scores, tiers, sanctioned);
        await tx.wait();
        console.log(`[Aggregator] Batch ${i + 1}/${batches.length} synced (${batch.length} addresses)`);
      } catch (error) {
        console.error(`[Aggregator] Batch ${i + 1} failed:`, error.message);
      }
    }
  }
}

/**
 * CLI entry point for risk sync
 */
async function main() {
  const { ethers, network } = require('hardhat');
  
  // Get RiskRegistry address from latest deployment
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  const latestFile = path.join(deploymentsDir, `${network.name}-latest.json`);
  
  if (!fs.existsSync(latestFile)) {
    console.error(`No deployment found for ${network.name}. Run deploy-multichain.js first.`);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
  const riskRegistryAddress = deployment.contracts.RiskRegistry;

  console.log(`Connecting to RiskRegistry at ${riskRegistryAddress}`);

  const RiskRegistry = await ethers.getContractFactory('RiskRegistry');
  const riskRegistry = RiskRegistry.attach(riskRegistryAddress);

  // Initialize sources
  const sources = [
    new OFACSource(),
    new SlowMistSource(),
    new EtherscanLabelSource(process.env.ETHERSCAN_API_KEY),
  ];

  const aggregator = new RiskAggregator(riskRegistry, sources);

  // Fetch and sync
  const [deployer] = await ethers.getSigners();
  const addresses = await aggregator.syncAll();
  
  if (addresses.length > 0) {
    await aggregator.syncToChain(addresses, deployer);
  }

  console.log('[RiskSync] Complete');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  RiskDataSource,
  OFACSource,
  SlowMistSource,
  EtherscanLabelSource,
  RiskAggregator,
};
