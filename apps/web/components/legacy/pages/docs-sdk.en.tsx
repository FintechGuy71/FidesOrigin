/* Auto-generated from public/docs/sdk.html — do not edit by hand. */
export default function ContentDocsSdkEN() {
  return (
    <>
<div className="docs-layout">
    
    <button className="docs-sidebar-toggle" id="sidebarToggle" aria-expanded="false" aria-label="Toggle sidebar">
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      Documentation Menu
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
    </button>
    <aside className="docs-sidebar" id="docsSidebar">
      <div className="docs-sidebar-title">Documentation</div>
      <ul className="docs-nav-tree">
        <li><a href="/docs">Overview</a></li>
        <li><a href="/docs/api">API Reference</a></li>
        <li><a href="/docs/sdk" className="active">SDK</a></li>
        <li><a href="/demo">Demo</a></li>
      </ul>
      <div className="docs-sidebar-title">Resources</div>
      <ul className="docs-nav-tree">
        <li><a href="/blog" target="_blank" rel="noopener">Blog</a></li>
        <li><a href="https://github.com/FintechGuy71/FidesOrigin" target="_blank" rel="noopener">GitHub</a></li>
        <li><a href="/admin/dashboard">Dashboard</a></li>
      </ul>
    </aside>

    

    
    <div className="docs-content">
      <h1>SDK <span className="docs-version">v0.2.1</span></h1>
      <p className="docs-lead">JavaScript SDK for wallet integration, on-chain compliance, and Guard pre-transaction interception.</p>

      <h2>Packages</h2>
      {/* ⚠ 原为 style={{ gridTemplateColumns: "1fr 1fr" }}：未分层内联样式恒胜任何
          @layer 内声明，把 legacy.css 的 @media (max-width:600px)
          {.docs-cards{grid-template-columns:1fr}} 直接击穿 —— 移动端仍是两列，
          卡片被压到约 160px 宽。.docs-cards 的基线本就是 repeat(2,1fr)，
          这里无需重复声明。 */}
      <div className="docs-cards">
        <a href="#rest-sdk" className="docs-card">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h3>REST SDK</h3>
          <p>API client, risk checks, rule management, WebSocket streaming.</p>
        </a>
        <a href="#on-chain-sdk" className="docs-card">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </div>
          <h3>On-Chain SDK</h3>
          <p>Direct smart contract interaction, Guard integration, gas-free reads.</p>
        </a>
      </div>

      <h2 id="rest-sdk">REST SDK Installation</h2>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>npm</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>npm install @fintechguy71/fidesorigin-sdk</code></pre>
      </div>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>yarn</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>yarn add @fintechguy71/fidesorigin-sdk</code></pre>
      </div>

      <h2>Quick Start</h2>

      <h3>Initialize Client</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>import &#123; FidesOriginClient &#125; from '@fintechguy71/fidesorigin-sdk';

const fides = new FidesOriginClient(&#123;
  baseUrl: 'https://api.fidesorigin.com',
  apiKey: 'YOUR_API_KEY',
  timeout: 30000
&#125;);</code></pre>
      </div>
      <p className="docs-note"><strong>Note:</strong> In browser environments, only public API keys (prefix <code>pk_</code>) are allowed. Secret keys are strictly blocked for security.</p>

      <h3>Check Address Risk</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>const result = await fides.checkRisk(&#123;
  address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee',
  chainId: 1  // or 'ethereum', 'sepolia', 11155111
&#125;);

console.log(result.risk_level);   // 'low' | 'medium' | 'high' | 'critical'
console.log(result.risk_score);   // 0-100
console.log(result.risk_factors); // Array of risk flags</code></pre>
      </div>

      <h3>Batch Risk Check</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>const batch = await fides.batchCheckRisk(&#123;
  addresses: [
    '0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee',
    '0xdAC17F958D2ee523a2206206994597C13D831ec7'
  ],
  chainId: 1
&#125;);

console.log(batch.summary); // &#123; total, highRisk, mediumRisk, lowRisk &#125;</code></pre>
      </div>

      <h3>WebSocket Streaming</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>const ws = fides.createWebSocket(&#123;
  autoReconnect: true,
  reconnectInterval: 3000
&#125;);

await ws.connect();
ws.subscribe(['risk.update', 'alert.new', 'rule.match']);

ws.on('risk.update', (msg) =&gt; &#123;
  console.log('Risk updated:', msg.data.address, msg.data.risk);
&#125;);

ws.on('alert.new', (msg) =&gt; &#123;
  console.log('New alert:', msg.data);
&#125;);</code></pre>
      </div>

      <h2>Core API</h2>
      <div className="docs-table-wrap">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Method</th>
              <th>Returns</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>checkRisk(input)</code></td>
              <td>Promise&lt;RiskCheckResult&gt;</td>
              <td>Single address risk assessment</td>
            </tr>
            <tr>
              <td><code>batchCheckRisk(input)</code></td>
              <td>Promise&lt;BatchRiskCheckResult&gt;</td>
              <td>Batch address screening</td>
            </tr>
            <tr>
              <td><code>getAddressRisk(address)</code></td>
              <td>Promise&lt;AddressRisk&gt;</td>
              <td>Latest risk snapshot for an address</td>
            </tr>
            <tr>
              <td><code>getDashboardStats()</code></td>
              <td>Promise&lt;DashboardStats&gt;</td>
              <td>Global compliance statistics</td>
            </tr>
            <tr>
              <td><code>listRules(options?)</code></td>
              <td>Promise&lt;RuleListResponse&gt;</td>
              <td>List compliance rules with pagination</td>
            </tr>
            <tr>
              <td><code>createRule(req)</code></td>
              <td>Promise&lt;Rule&gt;</td>
              <td>Create a new compliance rule</td>
            </tr>
            <tr>
              <td><code>updateRule(id, req)</code></td>
              <td>Promise&lt;Rule&gt;</td>
              <td>Update an existing rule</td>
            </tr>
            <tr>
              <td><code>deleteRule(id)</code></td>
              <td>Promise&lt;void&gt;</td>
              <td>Delete a compliance rule</td>
            </tr>
            <tr>
              <td><code>createWebSocket(config?)</code></td>
              <td>FidesOriginWebSocket</td>
              <td>Create a real-time WebSocket connection</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="on-chain-sdk">On-Chain SDK</h2>
      <p>For direct smart contract interaction, use the On-Chain SDK. All view functions are gas-free.</p>

      <h3>Installation</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>npm</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>npm install @fidesorigin/on-chain-sdk</code></pre>
      </div>

      <h3>Initialize On-Chain SDK</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>import &#123; FidesOriginSDK &#125; from '@fidesorigin/on-chain-sdk';
import &#123; JsonRpcProvider &#125; from 'ethers';

const provider = new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');

const addresses = &#123;
  complianceEngine: '0xdF36A8b16F064308eeDE21A740FAc4e87b724F0E',
  riskRegistry: '0x953f985f38f94d6159c0600d1f15D543895cE896',
  policyEngine: '0xCA12BB2daD2a6D429277823366D8C88a490EDDeA',
  riskOracle: '0x...' // optional
&#125;;

const sdk = new FidesOriginSDK(addresses, provider);</code></pre>
      </div>

      <h3 id="guard">Guard Integration (V2.1)</h3>
      <p>Use the On-Chain SDK to interact with <strong>PreTransactionGuard</strong> and <strong>GuardedComplianceEngine</strong> for zero-gas pre-transaction risk assessment.</p>

      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript — Guard Assessment</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>import &#123; FidesOriginSDK, Decision &#125; from '@fidesorigin/on-chain-sdk';

// Validate a transfer through the compliance engine
const validation = await sdk.validateTransfer(
  '0xSender...',
  '0xRecipient...',
  1000000000000000000n, // 1 ETH in wei
  '0xTokenAddress...'
);

if (validation.decision === Decision.BLOCK) &#123;
  console.warn('Transfer blocked:', validation.reason);
&#125; else if (validation.decision === Decision.FLAG) &#123;
  console.warn('Transfer flagged for review:', validation.reason);
&#125;

// Quick check
const canSend = await sdk.wouldTransferSucceed(
  '0xSender...', '0xRecipient...', 1000000000000000000n, '0xTokenAddress...'
);
console.log('Would succeed:', canSend);</code></pre>
      </div>

      <h3>Risk Profile Queries (Gas-free)</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>const profile = await sdk.getRiskProfile('0x...');
console.log(profile.riskScore, profile.tier, profile.isSanctioned);

const sanctioned = await sdk.isSanctioned('0x...');
const tier = await sdk.getRiskTier('0x...');
const tags = await sdk.getTags('0x...');</code></pre>
      </div>

      <h3>Event Listeners</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>// Listen for transfer validation events
const unsubscribe = sdk.onTransferValidated((asset, from, to, amount, decision, reason) =&gt; &#123;
  console.log(`Transfer $&#123;decision === Decision.ALLOW ? 'allowed' : 'blocked'&#125;: $&#123;reason&#125;`);
&#125;);

// Listen for sanction additions
const unsubSanction = sdk.onSanctionAdded((account, reason) =&gt; &#123;
  console.log('Sanction added:', account, reason);
&#125;);

// Cleanup
sdk.removeAllListeners();</code></pre>
      </div>

      <h2>Solidity Integration</h2>
      <p>Import FidesOrigin contracts directly into your Solidity project:</p>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Solidity 0.8.20</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@fidesorigin/contracts/CompliantStableCoin.sol";

contract MyStableCoin is CompliantStableCoin &#123;
    constructor()
        CompliantStableCoin("MyStableCoin", "MSC")
    &#123;
        // Configure policy
        policy = IssuerPolicy(&#123;
            maxTxAmount: 1_000_000 * 10**6,
            dailyLimit: 10_000_000 * 10**6,
            allowMediumRisk: true,
            allowHighRisk: false,
            blockMixer: true,
            requireDestinationKYC: true,
            cooldownPeriod: 24 hours
        &#125;);
    &#125;
&#125;</code></pre>
      </div>

      <h2>Types</h2>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>interface RiskCheckResult &#123;
  address: string;
  chain: string;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_factors: RiskFactor[];
  scores?: RiskScore[];
  addressType?: 'wallet' | 'contract' | 'exchange' | 'mixer' | 'unknown';
  timestamp?: string;
  relatedEntities?: Entity[];
  transactionStats?: TransactionStats;
&#125;

interface RiskFactor &#123;
  name: string;
  category: string;
  severity: string;
  description?: string;
&#125;

interface RiskScore &#123;
  score: number;
  level: string;
  confidence: number;
&#125;

interface Rule &#123;
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'draft';
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  createdAt: string;
  updatedAt: string;
&#125;

interface RuleCondition &#123;
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in';
  value: unknown;
&#125;

interface RuleAction &#123;
  type: 'flag' | 'block' | 'review' | 'allow';
  params?: Record&lt;string, unknown&gt;;
&#125;

// On-Chain SDK types
enum Decision &#123; ALLOW = 0, FLAG = 1, BLOCK = 2 &#125;
enum RiskTier &#123; UNKNOWN = 0, LOW = 1, MEDIUM = 2, HIGH = 3, CRITICAL = 4 &#125;

interface TransferValidationResult &#123;
  wouldSucceed: boolean;
  decision: Decision;
  reason: string;
&#125;</code></pre>
      </div>

      <h2>React Hook</h2>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>React</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>import &#123; useRiskCheck &#125; from '@fintechguy71/fidesorigin-sdk/react';

function RiskBadge(&#123; address &#125;: &#123; address: string &#125;) &#123;
  const &#123; data, loading, error, refetch &#125; = useRiskCheck(&#123;
    options: &#123; baseUrl: 'https://api.fidesorigin.com', apiKey: 'pk_...' &#125;,
    pollInterval: 30000,
    enabled: true
  &#125;);

  if (loading) return &lt;span&gt;Checking...&lt;/span&gt;;
  if (error) return &lt;span&gt;Error: &#123;error.message&#125;&lt;/span&gt;;
  if (!data) return null;

  return (
    &lt;span className=&#123;`risk-$&#123;data.risk.level&#125;`&#125;&gt;
      &#123;data.risk.level.toUpperCase()&#125; (&#123;data.risk.score&#125;)
    &lt;/span&gt;
  );
&#125;</code></pre>
      </div>
    </div>
  </div>
    </>
  );
}
