/* Auto-generated from public/docs/sdk.html — do not edit by hand. */
import Link from "next/link";

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
        <li><Link href="/docs" prefetch={false}>Overview</Link></li>
        <li><Link href="/docs/api" prefetch={false}>API Reference</Link></li>
        <li><Link href="/docs/sdk" className="active" prefetch={false}>SDK</Link></li>
        <li><Link href="/demo" prefetch={false}>Demo</Link></li>
      </ul>
      <div className="docs-sidebar-title">Resources</div>
      <ul className="docs-nav-tree">
        <li><Link href="/blog" prefetch={false}>Blog</Link></li>
        <li><a href="https://github.com/FintechGuy71/FidesOrigin" target="_blank" rel="noopener">GitHub</a></li>
        <li><Link href="/admin/dashboard" prefetch={false}>Dashboard</Link></li>
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
      <p className="docs-note"><strong>Package source:</strong> the SDK is published to <strong>GitHub Packages</strong>. To install, add <code>@fintechguy71:registry=https://npm.pkg.github.com</code> to your <code>.npmrc</code> and authenticate with a GitHub token (the command above then works). A public npmjs.org mirror is planned next.</p>

      <h2>Quick Start</h2>

      <h3>Initialize Client</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>import &#123; FidesOriginClient &#125; from '@fintechguy71/fidesorigin-sdk';
{"\n"}
{"\n"}const fides = new FidesOriginClient(&#123;
{"\n  "}baseUrl: 'https://api.fidesorigin.com',
{"\n  "}apiKey: 'YOUR_API_KEY',
{"\n  "}timeout: 30000
{"\n"}&#125;);</code></pre>
      </div>
      <p className="docs-note"><strong>Note:</strong> In browser environments, only public API keys (prefix <code>pk_</code>) are allowed. Secret keys are strictly blocked for security.</p>

      <h3>Check Address Risk</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>const result = await fides.checkRisk(&#123;
{"\n  "}address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee',
{"\n  "}chainId: 1  // or 'ethereum', 'sepolia', 11155111
{"\n"}&#125;);
{"\n"}
{"\n"}console.log(result.risk_level);   // 'low' | 'medium' | 'high' | 'critical'
{"\n"}console.log(result.risk_score);   // 0-100
{"\n"}console.log(result.risk_factors); // Array of risk flags</code></pre>
      </div>

      <h3>Batch Risk Check</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>const batch = await fides.batchCheckRisk(&#123;
{"\n  "}addresses: [
{"\n    "}'0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee',
{"\n    "}'0xdAC17F958D2ee523a2206206994597C13D831ec7'
{"\n  "}],
{"\n  "}chainId: 1
{"\n"}&#125;);
{"\n"}
{"\n"}console.log(batch.summary); // &#123; total, highRisk, mediumRisk, lowRisk &#125;</code></pre>
      </div>

      <h3>WebSocket Streaming</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>const ws = fides.createWebSocket(&#123;
{"\n  "}autoReconnect: true,
{"\n  "}reconnectInterval: 3000
{"\n"}&#125;);
{"\n"}
{"\n"}await ws.connect();
{"\n"}ws.subscribe(['risk.update', 'alert.new', 'rule.match']);
{"\n"}
{"\n"}ws.on('risk.update', (msg) =&gt; &#123;
{"\n  "}console.log('Risk updated:', msg.data.address, msg.data.risk);
{"\n"}&#125;);
{"\n"}
{"\n"}ws.on('alert.new', (msg) =&gt; &#123;
{"\n  "}console.log('New alert:', msg.data);
{"\n"}&#125;);</code></pre>
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
        <pre><code>npm install @fintechguy71/on-chain-sdk</code></pre>
      </div>

      <h3>Initialize On-Chain SDK</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>import &#123; FidesOriginSDK &#125; from '@fintechguy71/on-chain-sdk';
{"\n"}
{"\n"}import &#123; JsonRpcProvider &#125; from 'ethers';
{"\n"}
{"\n"}const provider = new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
{"\n"}
{"\n"}const addresses = &#123;
{"\n  "}complianceEngine: '0xdF36A8b16F064308eeDE21A740FAc4e87b724F0E',
{"\n  "}riskRegistry: '0x953f985f38f94d6159c0600d1f15D543895cE896',
{"\n  "}policyEngine: '0xCA12BB2daD2a6D429277823366D8C88a490EDDeA',
{"\n  "}riskOracle: '0x...' // optional
{"\n"}&#125;;
{"\n"}
{"\n"}const sdk = new FidesOriginSDK(addresses, provider);</code></pre>
      </div>

      <h3 id="guard">Guard Integration (V2.1)</h3>
      <p>Use the On-Chain SDK to interact with <strong>PreTransactionGuard</strong> and <strong>GuardedComplianceEngine</strong> for zero-gas pre-transaction risk assessment.</p>

      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript — Guard Assessment</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>import &#123; FidesOriginSDK, Decision &#125; from '@fintechguy71/on-chain-sdk';
{"\n"}
{"\n"}// Validate a transfer through the compliance engine
{"\n"}const validation = await sdk.validateTransfer(
{"\n  "}'0xSender...',
{"\n  "}'0xRecipient...',
{"\n  "}1000000000000000000n, // 1 ETH in wei
{"\n  "}'0xTokenAddress...'
{"\n"});
{"\n"}
{"\n"}if (validation.decision === Decision.BLOCK) &#123;
{"\n  "}console.warn('Transfer blocked:', validation.reason);
{"\n"}&#125; else if (validation.decision === Decision.FLAG) &#123;
{"\n  "}console.warn('Transfer flagged for review:', validation.reason);
{"\n"}&#125;
{"\n"}
{"\n"}// Quick check
{"\n"}const canSend = await sdk.wouldTransferSucceed(
{"\n  "}'0xSender...', '0xRecipient...', 1000000000000000000n, '0xTokenAddress...'
{"\n"});
{"\n"}console.log('Would succeed:', canSend);</code></pre>
      </div>

      <h3>Risk Profile Queries (Gas-free)</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>const profile = await sdk.getRiskProfile('0x...');
{"\n"}console.log(profile.riskScore, profile.tier, profile.isSanctioned);
{"\n"}
{"\n"}const sanctioned = await sdk.isSanctioned('0x...');
{"\n"}const tier = await sdk.getRiskTier('0x...');
{"\n"}const tags = await sdk.getTags('0x...');</code></pre>
      </div>

      <h3>Event Listeners</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>// Listen for transfer validation events
{"\n"}const unsubscribe = sdk.onTransferValidated((asset, from, to, amount, decision, reason) =&gt; &#123;
{"\n  "}console.log(`Transfer $&#123;decision === Decision.ALLOW ? 'allowed' : 'blocked'&#125;: $&#123;reason&#125;`);
{"\n"}&#125;);
{"\n"}
{"\n"}// Listen for sanction additions
{"\n"}const unsubSanction = sdk.onSanctionAdded((account, reason) =&gt; &#123;
{"\n  "}console.log('Sanction added:', account, reason);
{"\n"}&#125;);
{"\n"}
{"\n"}// Cleanup
{"\n"}sdk.removeAllListeners();</code></pre>
      </div>

      <h2>Solidity Integration</h2>
      <p>Import FidesOrigin contracts directly into your Solidity project:</p>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Solidity 0.8.20</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>// SPDX-License-Identifier: MIT
{"\n"}pragma solidity ^0.8.20;
{"\n"}
{"\n"}import "@fidesorigin/contracts/CompliantStableCoin.sol";
{"\n"}
{"\n"}contract MyStableCoin is CompliantStableCoin &#123;
{"\n    "}constructor()
{"\n        "}CompliantStableCoin("MyStableCoin", "MSC")
{"\n    "}&#123;
{"\n        "}// Configure policy
{"\n        "}policy = IssuerPolicy(&#123;
{"\n            "}maxTxAmount: 1_000_000 * 10**6,
{"\n            "}dailyLimit: 10_000_000 * 10**6,
{"\n            "}allowMediumRisk: true,
{"\n            "}allowHighRisk: false,
{"\n            "}blockMixer: true,
{"\n            "}requireDestinationKYC: true,
{"\n            "}cooldownPeriod: 24 hours
{"\n        "}&#125;);
{"\n    "}&#125;
{"\n"}&#125;</code></pre>
      </div>

      <h2>Types</h2>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>interface RiskCheckResult &#123;
{"\n  "}address: string;
{"\n  "}chain: string;
{"\n  "}risk_score: number;
{"\n  "}risk_level: 'low' | 'medium' | 'high' | 'critical';
{"\n  "}risk_factors: RiskFactor[];
{"\n  "}scores?: RiskScore[];
{"\n  "}addressType?: 'wallet' | 'contract' | 'exchange' | 'mixer' | 'unknown';
{"\n  "}timestamp?: string;
{"\n  "}relatedEntities?: Entity[];
{"\n  "}transactionStats?: TransactionStats;
{"\n"}&#125;
{"\n"}
{"\n"}interface RiskFactor &#123;
{"\n  "}name: string;
{"\n  "}category: string;
{"\n  "}severity: string;
{"\n  "}description?: string;
{"\n"}&#125;
{"\n"}
{"\n"}interface RiskScore &#123;
{"\n  "}score: number;
{"\n  "}level: string;
{"\n  "}confidence: number;
{"\n"}&#125;
{"\n"}
{"\n"}interface Rule &#123;
{"\n  "}id: string;
{"\n  "}name: string;
{"\n  "}description?: string;
{"\n  "}status: 'active' | 'inactive' | 'draft';
{"\n  "}priority: number;
{"\n  "}conditions: RuleCondition[];
{"\n  "}actions: RuleAction[];
{"\n  "}createdAt: string;
{"\n  "}updatedAt: string;
{"\n"}&#125;
{"\n"}
{"\n"}interface RuleCondition &#123;
{"\n  "}field: string;
{"\n  "}operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in';
{"\n  "}value: unknown;
{"\n"}&#125;
{"\n"}
{"\n"}interface RuleAction &#123;
{"\n  "}type: 'flag' | 'block' | 'review' | 'allow';
{"\n  "}params?: Record&lt;string, unknown&gt;;
{"\n"}&#125;
{"\n"}
{"\n"}// On-Chain SDK types
{"\n"}enum Decision &#123; ALLOW = 0, FLAG = 1, BLOCK = 2 &#125;
{"\n"}enum RiskTier &#123; UNKNOWN = 0, LOW = 1, MEDIUM = 2, HIGH = 3, CRITICAL = 4 &#125;
{"\n"}
{"\n"}interface TransferValidationResult &#123;
{"\n  "}wouldSucceed: boolean;
{"\n  "}decision: Decision;
{"\n  "}reason: string;
{"\n"}&#125;</code></pre>
      </div>

      <h2>React Hook</h2>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>React</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>import &#123; useRiskCheck &#125; from '@fintechguy71/fidesorigin-sdk/react';
{"\n"}
{"\n"}function RiskBadge(&#123; address &#125;: &#123; address: string &#125;) &#123;
{"\n  "}const &#123; data, loading, error, refetch &#125; = useRiskCheck(&#123;
{"\n    "}options: &#123; baseUrl: 'https://api.fidesorigin.com', apiKey: 'pk_...' &#125;,
{"\n    "}pollInterval: 30000,
{"\n    "}enabled: true
{"\n  "}&#125;);
{"\n"}
{"\n  "}if (loading) return &lt;span&gt;Checking...&lt;/span&gt;;
{"\n  "}if (error) return &lt;span&gt;Error: &#123;error.message&#125;&lt;/span&gt;;
{"\n  "}if (!data) return null;
{"\n"}
{"\n  "}return (
{"\n    "}&lt;span className=&#123;`risk-$&#123;data.risk.level&#125;`&#125;&gt;
{"\n      "}&#123;data.risk.level.toUpperCase()&#125; (&#123;data.risk.score&#125;)
{"\n    "}&lt;/span&gt;
{"\n  "});
{"\n"}&#125;</code></pre>
      </div>
    </div>
  </div>
    </>
  );
}
