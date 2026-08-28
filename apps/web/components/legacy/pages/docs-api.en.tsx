/* Auto-generated from public/docs/api.html — do not edit by hand. */
export default function ContentDocsApiEN() {
  return (
    <>
<div className="docs-layout">
    
    <aside className="docs-sidebar" id="docsSidebar">
      <div className="docs-sidebar-title">Documentation</div>
      <ul className="docs-nav-tree">
        <li><a href="/docs">Overview</a></li>
        <li><a href="/docs/api" className="active">API Reference</a></li>
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
      <h1>API Reference <span style={{ "fontSize": "0.5em", "color": "var(--accent)", "verticalAlign": "middle" }}>V2.1</span></h1>
      <p className="docs-lead">REST API for on-chain compliance, risk assessment, and rule management.</p>

      <h2>Base URL</h2>
      <div className="docs-base-url">
        <code>https://api.fidesorigin.com/api/v1</code>
      </div>

      <h2>Authentication</h2>
      <p>All API requests require an API key. Use either the <code>Authorization</code> header with a Bearer token, or the <code>X-API-Key</code> header directly.</p>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Header (Bearer)</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>Authorization: Bearer YOUR_API_KEY</code></pre>
      </div>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Header (X-API-Key)</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>X-API-Key: YOUR_API_KEY</code></pre>
      </div>

      <h2>Endpoints</h2>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method get">GET</span>
          <code className="docs-endpoint-path">/address/&#123;address&#125;/risk</code>
        </div>
        <p>Get the latest risk profile for a specific Ethereum address.</p>
        <h4>Query Parameters</h4>
        <ul>
          <li><code>chainId</code> (optional) — Chain ID, defaults to 1 (Ethereum). Supports <code>sepolia</code> (11155111), <code>base</code> (8453), etc.</li>
          <li><code>amount</code> (optional) — Transaction amount for context-aware assessment.</li>
        </ul>
        <h4>Response</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="Copy code">Copy</button>
          </div>
          <pre><code>&#123;
  "address": "0x742d35cc6634c0532925a3b844bc9e7595f8deee",
  "chain": "ethereum",
  "risk_score": 12,
  "risk_level": "low",
  "scores": [
    &#123; "score": 12, "level": "low", "confidence": 0.85, "category": "overall" &#125;
  ],
  "risk_factors": [
    &#123; "name": "Behavioral Risk Pattern", "category": "Behavior", "severity": "low" &#125;
  ],
  "addressType": "wallet",
  "timestamp": "2026-08-07T15:23:00Z",
  "relatedEntities": [],
  "transactionStats": &#123;
    "totalTransactions": 3421,
    "totalVolume": 892000
  &#125;
&#125;</code></pre>
        </div>
      </div>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method get">GET</span>
          <code className="docs-endpoint-path">/risk/check</code>
        </div>
        <p>Proxy endpoint for address risk checks. Proxies to the Python backend risk engine.</p>
        <h4>Query Parameters</h4>
        <ul>
          <li><code>address</code> (required) — Ethereum address to check.</li>
          <li><code>chainId</code> (optional) — Chain ID, defaults to 1.</li>
        </ul>
        <h4>Response</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="Copy code">Copy</button>
          </div>
          <pre><code>&#123;
  "address": "0x742d35cc6634c0532925a3b844bc9e7595f8deee",
  "chain": "ethereum",
  "overallScore": 12,
  "overallLevel": "low",
  "scores": [&#123; "score": 12, "level": "low", "confidence": 0.85 &#125;],
  "flags": [],
  "addressType": "wallet",
  "timestamp": "2026-08-07T15:23:00Z"
&#125;</code></pre>
        </div>
      </div>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method post">POST</span>
          <code className="docs-endpoint-path">/address/search</code>
        </div>
        <p>Batch risk check for multiple addresses in a single request.</p>
        <h4>Request Body</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="Copy code">Copy</button>
          </div>
          <pre><code>&#123;
  "chainId": 1,
  "addresses": [
    "0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee",
    "0xdAC17F958D2ee523a2206206994597C13D831ec7"
  ],
  "amount": "1000000000000000000"
&#125;</code></pre>
        </div>
        <h4>Response</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="Copy code">Copy</button>
          </div>
          <pre><code>&#123;
  "results": [
    &#123;
      "address": "0x742d35cc6634c0532925a3b844bc9e7595f8deee",
      "chain": "ethereum",
      "type": "wallet",
      "risk": &#123; "score": 12, "level": "low", "confidence": 0.85 &#125;,
      "flags": [],
      "assessedAt": "2026-08-07T15:23:00Z"
    &#125;
  ],
  "summary": &#123;
    "total": 2,
    "highRisk": 0,
    "mediumRisk": 0,
    "lowRisk": 2
  &#125;
&#125;</code></pre>
        </div>
      </div>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method get">GET</span>
          <code className="docs-endpoint-path">/rules</code>
        </div>
        <p>List compliance rules with pagination.</p>
        <h4>Query Parameters</h4>
        <ul>
          <li><code>status</code> (optional) — Filter by status: <code>active</code>, <code>inactive</code>, <code>draft</code>.</li>
          <li><code>limit</code> (optional) — Items per page, max 100, default 50.</li>
          <li><code>offset</code> (optional) — Pagination offset, default 0.</li>
        </ul>
        <h4>Response</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="Copy code">Copy</button>
          </div>
          <pre><code>&#123;
  "rules": [
    &#123;
      "id": "rule_1",
      "name": "Block Critical Risk Addresses",
      "description": "Automatically block transactions to addresses with critical risk score",
      "status": "active",
      "priority": 100,
      "conditions": [&#123; "field": "risk.score", "operator": "greater_than", "value": 90 &#125;],
      "actions": [&#123; "type": "block", "params": &#123; "reason": "Critical risk score exceeded" &#125; &#125;],
      "createdAt": "2026-08-01T10:00:00Z",
      "updatedAt": "2026-08-01T10:00:00Z"
    &#125;
  ],
  "total": 3,
  "page": 1,
  "limit": 50
&#125;</code></pre>
        </div>
      </div>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method post">POST</span>
          <code className="docs-endpoint-path">/rules</code>
        </div>
        <p>Create a new compliance rule.</p>
        <h4>Request Body</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="Copy code">Copy</button>
          </div>
          <pre><code>&#123;
  "name": "Flag High Risk Mixer",
  "description": "Flag transactions involving known mixer addresses",
  "conditions": [
    &#123; "field": "address.tags", "operator": "contains", "value": "mixer" &#125;
  ],
  "actions": [
    &#123; "type": "flag", "params": &#123; "reason": "Mixer interaction detected" &#125; &#125;
  ],
  "priority": 75
&#125;</code></pre>
        </div>
        <h4>Response</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="Copy code">Copy</button>
          </div>
          <pre><code>&#123;
  "id": "rule_4",
  "name": "Flag High Risk Mixer",
  "description": "Flag transactions involving known mixer addresses",
  "status": "active",
  "priority": 75,
  "conditions": [...],
  "actions": [...],
  "createdAt": "2026-08-07T15:23:00Z",
  "updatedAt": "2026-08-07T15:23:00Z"
&#125;</code></pre>
        </div>
      </div>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method patch">PATCH</span>
          <code className="docs-endpoint-path">/rules/&#123;id&#125;</code>
        </div>
        <p>Update an existing compliance rule.</p>
      </div>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method delete">DELETE</span>
          <code className="docs-endpoint-path">/rules/&#123;id&#125;</code>
        </div>
        <p>Delete a compliance rule.</p>
      </div>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method get">GET</span>
          <code className="docs-endpoint-path">/monitor/stats</code>
        </div>
        <p>Get dashboard statistics — total addresses assessed, risk distribution, and compliance metrics.</p>
        <h4>Response</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="Copy code">Copy</button>
          </div>
          <pre><code>&#123;
  "totalAddresses": 20483,
  "highRiskCount": 142,
  "mediumRiskCount": 891,
  "lowRiskCount": 19450,
  "lastUpdated": "2026-08-07T15:23:00Z"
&#125;</code></pre>
        </div>
      </div>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method get">GET</span>
          <code className="docs-endpoint-path">/monitor/stream</code>
        </div>
        <p>WebSocket endpoint for real-time risk updates and alerts. Connect via <code>wss://api.fidesorigin.com/api/v1/monitor/stream</code>.</p>
        <h4>Events</h4>
        <ul>
          <li><code>risk.update</code> — Risk score update for an address.</li>
          <li><code>alert.new</code> — New compliance alert.</li>
          <li><code>rule.match</code> — Rule match event.</li>
          <li><code>connection.established</code> — Connection confirmation.</li>
        </ul>
      </div>

      <h2>Guard Integration (On-Chain)</h2>
      <p>V2.1 introduces the <strong>PreTransactionGuard</strong> — a zero-gas pre-transaction interception layer. Guard operations are executed directly on-chain via smart contract calls, not through the REST API. Use the <a href="/docs/sdk#guard">On-Chain SDK</a> for Guard integration.</p>

      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Solidity — Guard Interface</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>interface IPreTransactionGuard &#123;
    struct TransactionIntent &#123;
        address from;
        address to;
        uint256 value;
        address token;
        bytes data;
        uint256 chainId;
    &#125;

    enum Action &#123; ALLOW, WARN, BLOCK &#125;

    struct RiskAssessment &#123;
        Action action;
        uint256 riskScore;
        uint256 confidence;
        string reason;
        uint256 assessmentTime;
    &#125;

    function assessAddress(address addr) external view returns (RiskAssessment memory);
    function assessTransaction(TransactionIntent calldata intent) external view returns (RiskAssessment memory);
&#125;</code></pre>
      </div>

      <h2>Error Codes</h2>
      <div className="docs-table-wrap">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Status</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>400</code></td>
              <td>Bad Request</td>
              <td>Invalid request parameters</td>
            </tr>
            <tr>
              <td><code>401</code></td>
              <td>Unauthorized</td>
              <td>Missing or invalid API key</td>
            </tr>
            <tr>
              <td><code>403</code></td>
              <td>Forbidden</td>
              <td>CSRF origin not allowed for state-changing requests</td>
            </tr>
            <tr>
              <td><code>404</code></td>
              <td>Not Found</td>
              <td>Address or resource not found</td>
            </tr>
            <tr>
              <td><code>429</code></td>
              <td>Rate Limited</td>
              <td>Too many requests (60 per minute per IP)</td>
            </tr>
            <tr>
              <td><code>500</code></td>
              <td>Server Error</td>
              <td>Internal server error</td>
            </tr>
            <tr>
              <td><code>502</code></td>
              <td>Bad Gateway</td>
              <td>Backend proxy unavailable</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Rate Limits</h2>
      <p>API requests are rate-limited to <strong>60 requests per minute per IP address</strong>. The WebSocket stream does not count against this limit.</p>
    </main>
  </div>
    </>
  );
}
