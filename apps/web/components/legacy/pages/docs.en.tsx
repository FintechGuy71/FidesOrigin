/* Auto-generated from public/docs/index.html — do not edit by hand. */
export default function ContentDocsEN() {
  return (
    <>
<div className="docs-layout">
    
    <aside className="docs-sidebar" id="docsSidebar">
      <div className="docs-sidebar-title">Documentation</div>
      <ul className="docs-nav-tree">
        <li><a href="/docs" className="active">Overview</a></li>
        <li><a href="/docs/api">API Reference</a></li>
        <li><a href="/docs/sdk">SDK</a></li>
        <li><a href="/demo">Demo</a></li>
      </ul>
      <div className="docs-sidebar-title">Resources</div>
      <ul className="docs-nav-tree">
        <li><a href="/blog" target="_blank" rel="noopener">Blog</a></li>
        <li><a href="https://github.com/FintechGuy71/FidesOrigin" target="_blank" rel="noopener">GitHub</a></li>
        <li><a href="/admin/">Dashboard</a></li>
      </ul>
    </aside>

    
    <button className="docs-sidebar-toggle" id="sidebarToggle" aria-expanded="false" aria-label="Toggle sidebar">
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      Documentation Menu
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
    </button>

    
    <main className="docs-content">
      <h1>Documentation <span style={{ "fontSize": "0.5em", "color": "var(--accent)", "verticalAlign": "middle" }}>V2.1</span></h1>
      <p className="docs-lead">Everything you need to integrate on-chain compliance into your protocol. Now with Guard pre-transaction interception.</p>

      <div className="docs-cards">
        <a href="/docs/api" className="docs-card">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h3>API Reference</h3>
          <p>REST API endpoints for address risk checks, rules management, batch screening, and real-time monitoring.</p>
        </a>
        <a href="/docs/sdk" className="docs-card">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </div>
          <h3>SDK</h3>
          <p>JavaScript SDK for wallet integration, address screening, Guard integration, and event subscriptions.</p>
        </a>
        <a href="/demo" className="docs-card">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h3>Demo</h3>
          <p>Interactive demo on Sepolia testnet. Screen addresses, check risk scores, and see Guard in action.</p>
        </a>
        <a href="https://github.com/FintechGuy71/FidesOrigin" className="docs-card" target="_blank" rel="noopener">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
          </div>
          <h3>GitHub</h3>
          <p>Source code, issues, and contributions.</p>
        </a>
      </div>

      <h2>Quick Start</h2>

      <h3>1. Check an Address</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>cURL</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>curl https://api.fidesorigin.com/api/v1/address/0x.../risk \
  -H "X-API-Key: YOUR_API_KEY"</code></pre>
      </div>

      <h3>2. Install SDK</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Shell</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>npm install @fintechguy71/fidesorigin-sdk</code></pre>
      </div>

      <h3>3. Integrate in Solidity</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Solidity 0.8.20</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>import "@fidesorigin/contracts/CompliantStableCoin.sol";

contract MyToken is CompliantStableCoin &#123;
    constructor() CompliantStableCoin("MyToken", "MTK") &#123;&#125;
&#125;</code></pre>
      </div>

      <h2>Core Concepts</h2>
      <div className="docs-concept-grid">
        <div className="docs-concept">
          <h4>On-Chain Risk Enforcement</h4>
          <p>Risk checks execute inside the transaction, not via external API calls. Deterministic, zero-latency, un-bypassable.</p>
        </div>
        <div className="docs-concept">
          <h4>Pre-Transaction Guard</h4>
          <p>V2.1 introduces Guard — zero-gas pre-transaction interception. Assess risk before a transaction is even submitted, with configurable block and warn thresholds.</p>
        </div>
        <div className="docs-concept">
          <h4>Risk Tiers</h4>
          <p>Five levels: UNKNOWN, LOW, MEDIUM, HIGH, CRITICAL. Each tier triggers different enforcement actions in the ComplianceEngine and Guard.</p>
        </div>
        <div className="docs-concept">
          <h4>Policy Engine</h4>
          <p>Configurable rules per asset: max transaction amount, daily limits, sanctioned address blocking, KYC requirements, cooldown periods.</p>
        </div>
        <div className="docs-concept">
          <h4>Quarantine Vault</h4>
          <p>Suspicious transfers are held in escrow until manual review or automated criteria are met.</p>
        </div>
        <div className="docs-concept">
          <h4>Compliance Rules</h4>
          <p>Create, update, and manage programmable compliance rules via REST API. Priority-based evaluation with condition-action logic.</p>
        </div>
      </div>

      <h2>Sepolia Testnet Contracts</h2>
      <p>Interact with the protocol on Sepolia testnet (chainId: 11155111).</p>
      <div className="docs-table-wrap">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Contract</th>
              <th>Address</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>RiskRegistry (Proxy)</td>
              <td><code>0x953f985f38f94d6159c0600d1f15D543895cE896</code></td>
              <td>UUPS Proxy</td>
            </tr>
            <tr>
              <td>PolicyEngine (Proxy)</td>
              <td><code>0xCA12BB2daD2a6D429277823366D8C88a490EDDeA</code></td>
              <td>UUPS Proxy</td>
            </tr>
            <tr>
              <td>ComplianceEngine (Proxy)</td>
              <td><code>0xdF36A8b16F064308eeDE21A740FAc4e87b724F0E</code></td>
              <td>UUPS Proxy</td>
            </tr>
            <tr>
              <td>QuarantineVault</td>
              <td><code>0xF7c5c4DdcB0F868a6c271334131728CecA313DFb</code></td>
              <td>Direct Deploy</td>
            </tr>
            <tr>
              <td>FidesCompliance</td>
              <td><code>0x1176db6ECa38AA9C4d153Ae4d21C3972c6335707</code></td>
              <td>Direct Deploy</td>
            </tr>
            <tr>
              <td>CompliantStableCoin (fUSD)</td>
              <td><code>0x2245A8FCf6aca017327eA8950Ba510e9596595E9</code></td>
              <td>Direct Deploy</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Architecture Overview</h2>
      <div style={{ "background": "var(--bg-card)", "border": "1px solid var(--border)", "borderRadius": "var(--radius-md)", "padding": "8px" }}>
        <div className="docs-arch-item">
          <div className="docs-arch-icon">&#128279;</div>
          <div>
            <h4>RiskRegistryV2</h4>
            <p>On-chain storage for 20,000+ risk profiles, sanctions lists, and entity tags. UUPS upgradeable proxy at <code>0x953f...E896</code>.</p>
          </div>
        </div>
        <div className="docs-arch-item">
          <div className="docs-arch-icon">&#9881;&#65039;</div>
          <div>
            <h4>ComplianceEngine</h4>
            <p>Policy evaluation, transfer hooks, hold management, and quarantine orchestration.</p>
          </div>
        </div>
        <div className="docs-arch-item">
          <div className="docs-arch-icon">&#128737;&#65039;</div>
          <div>
            <h4>PreTransactionGuard (V2.1)</h4>
            <p>Zero-gas pre-transaction risk assessment. Assess addresses and transactions before submission with configurable block/warn thresholds. Integrates with GuardedComplianceEngine.</p>
          </div>
        </div>
        <div className="docs-arch-item">
          <div className="docs-arch-icon">&#129689;</div>
          <div>
            <h4>CompliantStableCoin</h4>
            <p>Example ERC20 with built-in compliance hooks. Inherit for your own token. Sepolia fUSD at <code>0x2245...95E9</code>.</p>
          </div>
        </div>
        <div className="docs-arch-item">
          <div className="docs-arch-icon">&#128202;</div>
          <div>
            <h4>Subgraph</h4>
            <p>Indexed on-chain events for real-time queries and analytics.</p>
          </div>
        </div>
      </div>
    </main>
  </div>
    </>
  );
}
