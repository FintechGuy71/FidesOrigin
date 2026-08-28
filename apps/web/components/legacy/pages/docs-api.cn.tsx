/* Auto-generated from public/cn/docs/api.html — do not edit by hand. */
export default function ContentDocsApiCN() {
  return (
    <>
<div className="docs-layout">
    <aside className="docs-sidebar" id="docsSidebar">
      <div className="docs-sidebar-title">文档</div>
      <ul className="docs-nav-tree">
        <li><a href="/cn/docs">概览</a></li>
        <li><a href="/cn/docs/api" className="active">API 参考</a></li>
        <li><a href="/cn/docs/sdk">SDK</a></li>
      </ul>
      <div className="docs-sidebar-title">资源</div>
      <ul className="docs-nav-tree">
        <li><a href="/cn/blog" target="_blank" rel="noopener">博客</a></li>
        <li><a href="https://github.com/FintechGuy71/FidesOrigin" target="_blank" rel="noopener">GitHub</a></li>
        <li><a href="/admin/">控制台</a></li>
      </ul>
    </aside>

    <button className="docs-sidebar-toggle" id="sidebarToggle" aria-expanded="false" aria-label="切换侧边栏">
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      文档菜单
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
    </button>

    <main className="docs-content">
      <h1>API 参考</h1>
      <p className="docs-lead">链上合规与风险评估的 REST API。</p>

      <h2>基础 URL</h2>
      <div className="docs-base-url">
        <code>https://api.fidesorigin.com/api/v1</code>
      </div>

      <h2>认证</h2>
      <p>所有 API 请求需要在 Authorization 头中携带 Bearer token。</p>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Header</span>
          <button className="docs-code-copy" aria-label="复制代码">复制</button>
        </div>
        <pre><code>Authorization: Bearer YOUR_API_KEY</code></pre>
      </div>

      <h2>接口</h2>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method get">GET</span>
          <code className="docs-endpoint-path">/addresses/&#123;address&#125;</code>
        </div>
        <p>获取指定以太坊地址的风险档案。</p>
        <h4>响应</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="复制代码">复制</button>
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
        <p>在执行前提交交易进行风险评估。</p>
        <h4>请求体</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="复制代码">复制</button>
          </div>
          <pre><code>&#123;
  "from": "0x...",
  "to": "0x...",
  "amount": "1000000000000000000",
  "asset": "0x..."
&#125;</code></pre>
        </div>
        <h4>响应</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="复制代码">复制</button>
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
        <p>列出所有活跃的合规规则。</p>
        <h4>响应</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="复制代码">复制</button>
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

      <h2>错误码</h2>
      <div className="docs-table-wrap">
        <table className="docs-table">
          <thead>
            <tr>
              <th>代码</th>
              <th>状态</th>
              <th>描述</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><code>400</code></td><td>Bad Request</td><td>请求参数无效</td></tr>
            <tr><td><code>401</code></td><td>Unauthorized</td><td>缺少或无效的 API 密钥</td></tr>
            <tr><td><code>404</code></td><td>Not Found</td><td>地址或资源未找到</td></tr>
            <tr><td><code>429</code></td><td>Rate Limited</td><td>请求过于频繁</td></tr>
            <tr><td><code>500</code></td><td>Server Error</td><td>内部服务器错误</td></tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
    </>
  );
}
