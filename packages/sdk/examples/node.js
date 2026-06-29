/**
 * FidesOrigin SDK - Node.js Example
 * 
 * This example demonstrates how to use the FidesOrigin SDK in a Node.js environment
 * 
 * Usage:
 *   npm install @fidesorigin/sdk
 *   node examples/node.js
 */

// Import the SDK (CommonJS)
const { FidesOriginClient, fides, isRisky, isSafe, getRiskLabel, getRiskColor } = require('../dist/cjs/index.js');

// Or using ESM:
// import { FidesOriginClient, fides, isRisky, isSafe, getRiskLabel, getRiskColor } from '@fidesorigin/sdk';

// Configuration
const CONFIG = {
  baseUrl: process.env.FIDES_ORIGIN_URL || 'https://api.fidesorigin.com',
  apiKey: process.env.FIDES_ORIGIN_API_KEY || 'your-api-key-here'
};

// Sample addresses for testing
const SAMPLE_ADDRESSES = [
  '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',  // Example address
  '0xdAC17F958D2ee523a2206206994597C13D831ec7',  // USDT Contract
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',  // USDC Contract
];

async function main() {
  console.log('🛡️  FidesOrigin SDK - Node.js Example\n');
  console.log('=====================================\n');

  // Initialize the client
  console.log('📡 Initializing client...');
  const client = new FidesOriginClient({
    baseUrl: CONFIG.baseUrl,
    apiKey: CONFIG.apiKey,
    debug: true
  });

  // Example 1: Quick one-line check using the helper
  console.log('\n📋 Example 1: Quick Risk Check');
  console.log('--------------------------------');
  try {
    // Using the simplified fides.checkAddress helper
    const quickCheck = await fides.checkAddress(
      SAMPLE_ADDRESSES[0],
      CONFIG.apiKey,
      { baseUrl: CONFIG.baseUrl, chain: 'ethereum' }
    );
    console.log(`Address: ${quickCheck.address}`);
    console.log(`Risk Level: ${getRiskLabel(quickCheck.risk.level)}`);
    console.log(`Risk Score: ${quickCheck.risk.score}/100`);
    console.log(`Is Risky: ${isRisky(quickCheck.risk.level) ? '⚠️ Yes' : '✅ No'}`);
  } catch (error) {
    console.error('Quick check failed:', error.message);
  }

  // Example 2: Single address check with full client
  console.log('\n📋 Example 2: Single Address Check');
  console.log('-----------------------------------');
  try {
    const singleCheck = await client.checkAddress(SAMPLE_ADDRESSES[1], {
      chain: 'ethereum',
      includeEntities: true,
      includeStats: true
    });
    
    console.log(`Address: ${singleCheck.address}`);
    console.log(`Type: ${singleCheck.type}`);
    console.log(`Risk Level: ${singleCheck.risk.level}`);
    console.log(`Confidence: ${(singleCheck.risk.confidence * 100).toFixed(1)}%`);
    
    if (singleCheck.stats) {
      console.log(`Total Transactions: ${singleCheck.stats.totalTransactions}`);
      console.log(`Total Volume: $${singleCheck.stats.totalVolume.toLocaleString()}`);
    }
    
    if (singleCheck.flags.length > 0) {
      console.log('\n🚩 Risk Flags:');
      singleCheck.flags.forEach(flag => {
        console.log(`  - ${flag.name} (${flag.severity}): ${flag.description}`);
      });
    }
  } catch (error) {
    console.error('Single check failed:', error.message);
  }

  // Example 3: Batch address check
  console.log('\n📋 Example 3: Batch Address Check');
  console.log('----------------------------------');
  try {
    const batchResult = await client.checkBatchAddresses({
      addresses: SAMPLE_ADDRESSES,
      chain: 'ethereum',
      detailed: true
    });
    
    console.log(`Checked ${batchResult.results.length} addresses`);
    
    if (batchResult.failed && batchResult.failed.length > 0) {
      console.log(`Failed: ${batchResult.failed.length} addresses`);
    }
    
    console.log('\nResults Summary:');
    batchResult.results.forEach(result => {
      const icon = isSafe(result.risk.level) ? '✅' : '⚠️';
      console.log(`  ${icon} ${result.address.slice(0, 20)}... - ${result.risk.level} (${result.risk.score})`);
    });
    
    // Risk statistics
    const { RiskAssessor } = require('../dist/cjs/index.js');
    const assessor = new RiskAssessor(client);
    
    // Count by risk level
    const riskCounts = batchResult.results.reduce((acc, result) => {
      acc[result.risk.level] = (acc[result.risk.level] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\nRisk Distribution:');
    Object.entries(riskCounts).forEach(([level, count]) => {
      console.log(`  ${level}: ${count}`);
    });
    
  } catch (error) {
    console.error('Batch check failed:', error.message);
  }

  // Example 4: Rules Management
  console.log('\n📋 Example 4: Rules Management');
  console.log('-------------------------------');
  try {
    // List existing rules
    const rulesList = await client.listRules({ limit: 5 });
    console.log(`Found ${rulesList.total} rules`);
    
    if (rulesList.rules.length > 0) {
      console.log('\nActive Rules:');
      rulesList.rules.forEach(rule => {
        console.log(`  - ${rule.name} (${rule.status}, priority: ${rule.priority})`);
      });
    }
    
    // Create a rule using the builder
    const { RulesManager, RuleTemplates } = require('../dist/cjs/index.js');
    const rulesManager = new RulesManager(client);
    
    console.log('\n📝 Available Rule Templates:');
    console.log('  - blockHighRisk: Block high and critical risk addresses');
    console.log('  - flagSanctioned: Flag sanctioned addresses');
    console.log('  - reviewMixerUsage: Review cryptocurrency mixer usage');
    console.log('  - reviewLargeVolume: Review large volume transactions');
    
  } catch (error) {
    console.error('Rules management failed:', error.message);
  }

  // Example 5: WebSocket Real-time Updates
  console.log('\n📋 Example 5: WebSocket Connection');
  console.log('-----------------------------------');
  
  const ws = client.createWebSocket({
    autoReconnect: true,
    subscriptions: ['risk.update', 'alert.new']
  });
  
  // Register event handlers
  ws.on('risk.update', (message) => {
    console.log('\n🔄 Risk Update Received:');
    console.log(JSON.stringify(message.data, null, 2));
  });
  
  ws.on('alert.new', (message) => {
    console.log('\n🚨 New Alert Received:');
    console.log(JSON.stringify(message.data, null, 2));
  });
  
  ws.on('connection.established', () => {
    console.log('✅ WebSocket connected successfully');
  });
  
  ws.on('error', (message) => {
    console.error('❌ WebSocket error:', message.data);
  });
  
  // Connect (commented out for demo)
  // ws.connect();
  
  // Wait a bit then disconnect
  // setTimeout(() => ws.disconnect(), 30000);
  
  console.log('WebSocket configured (not connected in demo)');
  console.log('Uncomment ws.connect() to test real-time updates');

  console.log('\n=====================================');
  console.log('✅ Examples completed!');
}

// Run examples
main().catch(console.error);
