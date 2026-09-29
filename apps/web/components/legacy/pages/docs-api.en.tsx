/* Auto-generated from public/docs/api.html — do not edit by hand. */
import Link from "next/link";

export default function ContentDocsApiEN() {
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
        <li><Link href="/docs/api" className="active" prefetch={false}>API Reference</Link></li>
        <li><Link href="/docs/sdk" prefetch={false}>SDK</Link></li>
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
      <h1>API Reference <span className="docs-version">V2.1</span></h1>
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
          <li><code>amount</code> (optional) — Reserved field; accepted for forward compatibility but not currently used in the assessment.</li>
        </ul>
        <h4>Response</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="Copy code">Copy</button>
          </div>
          <pre><code>&#123;
{"\n  "}"address": "0x742d35cc6634c0532925a3b844bc9e7595f8deee",
{"\n  "}"chain": "ethereum",
{"\n  "}"risk_score": 12,
{"\n  "}"risk_level": "low",
{"\n  "}"scores": [
{"\n    "}&#123; "score": 12, "level": "low", "confidence": 0.85, "category": "overall" &#125;
{"\n  "}],
{"\n  "}"risk_factors": [
{"\n    "}&#123; "name": "Behavioral Risk Pattern", "category": "Behavior", "severity": "low" &#125;
{"\n  "}],
{"\n  "}"addressType": "wallet",
{"\n  "}"timestamp": "2026-08-07T15:23:00Z",
{"\n  "}"relatedEntities": [],
{"\n  "}"transactionStats": &#123;
{"\n    "}"totalTransactions": 3421,
{"\n    "}"totalVolume": 892000
{"\n  "}&#125;
{"\n"}&#125;</code></pre>
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
{"\n  "}"address": "0x742d35cc6634c0532925a3b844bc9e7595f8deee",
{"\n  "}"chain": "ethereum",
{"\n  "}"overallScore": 12,
{"\n  "}"overallLevel": "low",
{"\n  "}"scores": [&#123; "score": 12, "level": "low", "confidence": 0.85 &#125;],
{"\n  "}"flags": [],
{"\n  "}"addressType": "wallet",
{"\n  "}"timestamp": "2026-08-07T15:23:00Z"
{"\n"}&#125;</code></pre>
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
{"\n  "}"chainId": 1,
{"\n  "}"addresses": [
{"\n    "}"0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee",
{"\n    "}"0xdAC17F958D2ee523a2206206994597C13D831ec7"
{"\n  "}],
{"\n  "}"amount": "1000000000000000000"
{"\n"}&#125;</code></pre>
        </div>
        <h4>Response</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="Copy code">Copy</button>
          </div>
          <pre><code>&#123;
{"\n  "}"results": [
{"\n    "}&#123;
{"\n      "}"address": "0x742d35cc6634c0532925a3b844bc9e7595f8deee",
{"\n      "}"chain": "ethereum",
{"\n      "}"type": "wallet",
{"\n      "}"risk": &#123; "score": 12, "level": "low", "confidence": 0.85 &#125;,
{"\n      "}"flags": [],
{"\n      "}"assessedAt": "2026-08-07T15:23:00Z"
{"\n    "}&#125;
{"\n  "}],
{"\n  "}"summary": &#123;
{"\n    "}"total": 2,
{"\n    "}"highRisk": 0,
{"\n    "}"mediumRisk": 0,
{"\n    "}"lowRisk": 2
{"\n  "}&#125;
{"\n"}&#125;</code></pre>
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
{"\n  "}"rules": [
{"\n    "}&#123;
{"\n      "}"id": "rule_1",
{"\n      "}"name": "Block Critical Risk Addresses",
{"\n      "}"description": "Automatically block transactions to addresses with critical risk score",
{"\n      "}"status": "active",
{"\n      "}"priority": 100,
{"\n      "}"conditions": [&#123; "field": "risk.score", "operator": "greater_than", "value": 90 &#125;],
{"\n      "}"actions": [&#123; "type": "block", "params": &#123; "reason": "Critical risk score exceeded" &#125; &#125;],
{"\n      "}"createdAt": "2026-08-01T10:00:00Z",
{"\n      "}"updatedAt": "2026-08-01T10:00:00Z"
{"\n    "}&#125;
{"\n  "}],
{"\n  "}"total": 3,
{"\n  "}"page": 1,
{"\n  "}"limit": 50
{"\n"}&#125;</code></pre>
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
{"\n  "}"name": "Flag High Risk Mixer",
{"\n  "}"description": "Flag transactions involving known mixer addresses",
{"\n  "}"conditions": [
{"\n    "}&#123; "field": "address.tags", "operator": "contains", "value": "mixer" &#125;
{"\n  "}],
{"\n  "}"actions": [
{"\n    "}&#123; "type": "flag", "params": &#123; "reason": "Mixer interaction detected" &#125; &#125;
{"\n  "}],
{"\n  "}"priority": 75
{"\n"}&#125;</code></pre>
        </div>
        <h4>Response</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="Copy code">Copy</button>
          </div>
          <pre><code>&#123;
{"\n  "}"id": "rule_4",
{"\n  "}"name": "Flag High Risk Mixer",
{"\n  "}"description": "Flag transactions involving known mixer addresses",
{"\n  "}"status": "active",
{"\n  "}"priority": 75,
{"\n  "}"conditions": [...],
{"\n  "}"actions": [...],
{"\n  "}"createdAt": "2026-08-07T15:23:00Z",
{"\n  "}"updatedAt": "2026-08-07T15:23:00Z"
{"\n"}&#125;</code></pre>
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
{"\n  "}"totalAddresses": 20483,
{"\n  "}"highRiskCount": 142,
{"\n  "}"mediumRiskCount": 891,
{"\n  "}"lowRiskCount": 19450,
{"\n  "}"lastUpdated": "2026-08-07T15:23:00Z"
{"\n"}&#125;</code></pre>
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
      <p>V2.1 introduces the <strong>PreTransactionGuard</strong> — a zero-gas pre-transaction interception layer. Guard operations are executed directly on-chain via smart contract calls, not through the REST API. Use the <Link href="/docs/sdk#guard" prefetch={false}>On-Chain SDK</Link> for Guard integration.</p>

      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Solidity — Guard Interface</span>
          <button className="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>interface IPreTransactionGuard &#123;
{"\n    "}struct TransactionIntent &#123;
{"\n        "}address from;
{"\n        "}address to;
{"\n        "}uint256 value;
{"\n        "}address token;
{"\n        "}bytes data;
{"\n        "}uint256 chainId;
{"\n    "}&#125;
{"\n"}
{"\n    "}enum Action &#123; ALLOW, WARN, BLOCK &#125;
{"\n"}
{"\n    "}struct RiskAssessment &#123;
{"\n        "}Action action;
{"\n        "}uint256 riskScore;
{"\n        "}uint256 confidence;
{"\n        "}string reason;
{"\n        "}uint256 assessmentTime;
{"\n    "}&#125;
{"\n"}
{"\n    "}function assessAddress(address addr) external view returns (RiskAssessment memory);
{"\n    "}function assessTransaction(TransactionIntent calldata intent) external view returns (RiskAssessment memory);
{"\n"}&#125;</code></pre>
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
    </div>
  </div>
    </>
  );
}
