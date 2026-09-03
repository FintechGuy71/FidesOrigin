/* Auto-generated from public/tw/docs/api.html — do not edit by hand. */
export default function ContentDocsApiTW() {
  return (
    <>
<div className="docs-layout">
    <button className="docs-sidebar-toggle" id="sidebarToggle" aria-expanded="false" aria-label="切換側邊欄">
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      文件菜單
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
    </button>
    <aside className="docs-sidebar" id="docsSidebar">
      <div className="docs-sidebar-title">文件</div>
      <ul className="docs-nav-tree">
        <li><a href="/tw/docs">概覽</a></li>
        <li><a href="/tw/docs/api" className="active">API 參考</a></li>
        <li><a href="/tw/docs/sdk">SDK</a></li>
      </ul>
      <div className="docs-sidebar-title">資源</div>
      <ul className="docs-nav-tree">
        <li><a href="/tw/blog" target="_blank" rel="noopener">博客</a></li>
        <li><a href="https://github.com/FintechGuy71/FidesOrigin" target="_blank" rel="noopener">GitHub</a></li>
        <li><a href="/admin/dashboard">控制台</a></li>
      </ul>
    </aside>


    <div className="docs-content">
      <h1>API 參考 <span className="docs-version">V2.1</span></h1>
      <p className="docs-lead">鏈上合規與風險評估的 REST API。</p>

      <h2>基礎 URL</h2>
      <div className="docs-base-url">
        <code>https://api.fidesorigin.com/api/v1</code>
      </div>

      <h2>認證</h2>
      <p>所有 API 請求需要在 Authorization 頭中攜帶 Bearer token。</p>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Header</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
        </div>
        <pre><code>Authorization: Bearer YOUR_API_KEY</code></pre>
      </div>

      <h2>接口</h2>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method get">GET</span>
          <code className="docs-endpoint-path">/rules</code>
        </div>
        <p>列出所有活躍的合規規則。</p>
        <h4>響應</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="複製代碼">複製</button>
          </div>
          <pre><code>&#123;
  "rules": [
    &#123;
      "id": "rule-001",
      "name": "Sanctions Screening",
      "type": "BLOCK",
      "active": true,
      "priority": 1
    &#125;
  ]
&#125;</code></pre>
        </div>
      </div>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method get">GET</span>
          <code className="docs-endpoint-path">/address/&#123;address&#125;/risk</code>
        </div>
        <p>取得指定以太坊地址的最新風險檔案。</p>
        <h4>查詢參數</h4>
        <ul>
          <li><code>chainId</code>（選填）— 鏈 ID，預設為 1（以太坊）。支援 <code>sepolia</code>（11155111）、<code>base</code>（8453）等。</li>
          <li><code>amount</code>（選填）— 用於上下文感知評估的交易金額。</li>
        </ul>
        <h4>響應</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="複製代碼">複製</button>
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
        <p>地址風險檢查的代理端點，代理至 Python 後端風險引擎。</p>
        <h4>查詢參數</h4>
        <ul>
          <li><code>address</code>（必填）— 要檢查的以太坊地址。</li>
          <li><code>chainId</code>（選填）— 鏈 ID，預設為 1。</li>
        </ul>
        <h4>響應</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="複製代碼">複製</button>
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
        <p>在單一請求中對多個地址進行批次風險檢查。</p>
        <h4>請求體</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="複製代碼">複製</button>
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
        <h4>響應</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="複製代碼">複製</button>
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
          <span className="docs-method post">POST</span>
          <code className="docs-endpoint-path">/rules</code>
        </div>
        <p>建立新的合規規則。</p>
        <h4>請求體</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="複製代碼">複製</button>
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
        <h4>響應</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="複製代碼">複製</button>
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
        <p>更新現有的合規規則。</p>
      </div>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method delete">DELETE</span>
          <code className="docs-endpoint-path">/rules/&#123;id&#125;</code>
        </div>
        <p>刪除合規規則。</p>
      </div>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method get">GET</span>
          <code className="docs-endpoint-path">/monitor/stats</code>
        </div>
        <p>取得儀表板統計資料——已評估地址總數、風險分佈與合規指標。</p>
        <h4>響應</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="複製代碼">複製</button>
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
        <p>用於即時風險更新與告警的 WebSocket 端點。透過 <code>wss://api.fidesorigin.com/api/v1/monitor/stream</code> 連線。</p>
        <h4>事件</h4>
        <ul>
          <li><code>risk.update</code> — 地址風險評分更新。</li>
          <li><code>alert.new</code> — 新的合規告警。</li>
          <li><code>rule.match</code> — 規則匹配事件。</li>
          <li><code>connection.established</code> — 連線確認。</li>
        </ul>
      </div>

      <h2>Guard 整合（鏈上）</h2>
      <p>V2.1 引入了 <strong>PreTransactionGuard</strong>——零 Gas 的交易前攔截層。Guard 操作透過智慧合約呼叫直接在鏈上執行，而非透過 REST API。請使用<a href="/docs/sdk#guard">鏈上 SDK</a> 進行 Guard 整合。</p>

      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Solidity — Guard Interface</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
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

      <h2>錯誤碼</h2>
      <div className="docs-table-wrap">
        <table className="docs-table">
          <thead>
            <tr><th>代碼</th><th>狀態</th><th>描述</th></tr>
          </thead>
          <tbody>
            <tr><td><code>400</code></td><td>Bad Request</td><td>請求參數無效</td></tr>
            <tr><td><code>401</code></td><td>Unauthorized</td><td>缺少或無效的 API 密鑰</td></tr>
            <tr><td><code>404</code></td><td>Not Found</td><td>地址或資源未找到</td></tr>
            <tr><td><code>429</code></td><td>Rate Limited</td><td>請求過於頻繁</td></tr>
            <tr><td><code>500</code></td><td>Server Error</td><td>內部伺服器錯誤</td></tr>
          </tbody>
        </table>
      </div>

      <h2>速率限制</h2>
      <p>API 請求限速為<strong>每個 IP 位址每分鐘 60 次請求</strong>。WebSocket 串流不計入此限制。</p>
    </div>
  </div>
    </>
  );
}
