/* Auto-generated from public/tw/docs/api.html — do not edit by hand. */
export default function ContentDocsApiTW() {
  return (
    <>
<div className="docs-layout">
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
        <li><a href="/admin/">控制台</a></li>
      </ul>
    </aside>

    <button className="docs-sidebar-toggle" id="sidebarToggle" aria-expanded="false" aria-label="切換側邊欄">
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      文件菜單
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
    </button>

    <main className="docs-content">
      <h1>API 參考</h1>
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
          <code className="docs-endpoint-path">/addresses/&#123;address&#125;</code>
        </div>
        <p>獲取指定以太坊地址的風險檔案。</p>
        <h4>響應</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="複製代碼">複製</button>
          </div>
          <pre><code>&#123;
  "address": "0x...",
  "risk_score": 85,
  "risk_tier": "HIGH",
  "is_sanctioned": false,
  "tags": ["mixer", "high_volume"],
  "entity_name": "Unknown",
  "last_updated": "2026-07-24T09:00:00Z"
&#125;</code></pre>
        </div>
      </div>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method post">POST</span>
          <code className="docs-endpoint-path">/risk-assessment</code>
        </div>
        <p>在執行前提交交易進行風險評估。</p>
        <h4>請求體</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="複製代碼">複製</button>
          </div>
          <pre><code>&#123;
  "from": "0x...",
  "to": "0x...",
  "amount": "1000000000000000000",
  "asset": "0x..."
&#125;</code></pre>
        </div>
        <h4>響應</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="複製代碼">複製</button>
          </div>
          <pre><code>&#123;
  "allowed": true,
  "risk_score": 15,
  "risk_tier": "LOW",
  "quarantine_required": false,
  "reason": null
&#125;</code></pre>
        </div>
      </div>

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
    </main>
  </div>
    </>
  );
}
