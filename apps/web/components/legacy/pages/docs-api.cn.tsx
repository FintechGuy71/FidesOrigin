/* Auto-generated from public/cn/docs/api.html — do not edit by hand. */
export default function ContentDocsApiCN() {
  return (
    <>
<div className="docs-layout">
    <button className="docs-sidebar-toggle" id="sidebarToggle" aria-expanded="false" aria-label="切换侧边栏">
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      文档菜单
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
    </button>
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
        <li><a href="/admin/dashboard">控制台</a></li>
      </ul>
    </aside>


    <div className="docs-content">
      <h1>API 参考 <span className="docs-version">V2.1</span></h1>
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

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method get">GET</span>
          <code className="docs-endpoint-path">/address/&#123;address&#125;/risk</code>
        </div>
        <p>获取指定以太坊地址的最新风险档案。</p>
        <h4>查询参数</h4>
        <ul>
          <li><code>chainId</code>（可选）— 链 ID，默认为 1（以太坊）。支持 <code>sepolia</code>（11155111）、<code>base</code>（8453）等。</li>
          <li><code>amount</code>（可选）— 用于上下文感知评估的交易金额。</li>
        </ul>
        <h4>响应</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="复制代码">复制</button>
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
        <p>地址风险检查的代理端点，代理至 Python 后端风险引擎。</p>
        <h4>查询参数</h4>
        <ul>
          <li><code>address</code>（必填）— 要检查的以太坊地址。</li>
          <li><code>chainId</code>（可选）— 链 ID，默认为 1。</li>
        </ul>
        <h4>响应</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="复制代码">复制</button>
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
        <p>在单个请求中对多个地址进行批量风险检查。</p>
        <h4>请求体</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="复制代码">复制</button>
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
        <h4>响应</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="复制代码">复制</button>
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
        <p>创建新的合规规则。</p>
        <h4>请求体</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="复制代码">复制</button>
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
        <h4>响应</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="复制代码">复制</button>
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
        <p>更新已有的合规规则。</p>
      </div>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method delete">DELETE</span>
          <code className="docs-endpoint-path">/rules/&#123;id&#125;</code>
        </div>
        <p>删除合规规则。</p>
      </div>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method get">GET</span>
          <code className="docs-endpoint-path">/monitor/stats</code>
        </div>
        <p>获取仪表盘统计数据——已评估地址总数、风险分布与合规指标。</p>
        <h4>响应</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="复制代码">复制</button>
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
        <p>用于实时风险更新与告警的 WebSocket 端点。通过 <code>wss://api.fidesorigin.com/api/v1/monitor/stream</code> 连接。</p>
        <h4>事件</h4>
        <ul>
          <li><code>risk.update</code> — 地址风险评分更新。</li>
          <li><code>alert.new</code> — 新的合规告警。</li>
          <li><code>rule.match</code> — 规则匹配事件。</li>
          <li><code>connection.established</code> — 连接确认。</li>
        </ul>
      </div>

      <h2>Guard 集成（链上）</h2>
      <p>V2.1 引入了 <strong>PreTransactionGuard</strong>——一个零 Gas 的交易前拦截层。Guard 操作通过智能合约调用直接在链上执行，而非通过 REST API。请使用<a href="/docs/sdk#guard">链上 SDK</a> 进行 Guard 集成。</p>

      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Solidity — Guard Interface</span>
          <button className="docs-code-copy" aria-label="复制代码">复制</button>
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

      <h2>速率限制</h2>
      <p>API 请求限速为<strong>每个 IP 地址每分钟 60 次请求</strong>。WebSocket 流不计入此限制。</p>
    </div>
  </div>
    </>
  );
}
