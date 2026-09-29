/* Auto-generated from public/cn/docs/api.html — do not edit by hand. */
import Link from "next/link";

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
        <li><Link href="/cn/docs" prefetch={false}>概览</Link></li>
        <li><Link href="/cn/docs/api" className="active" prefetch={false}>API 参考</Link></li>
        <li><Link href="/cn/docs/sdk" prefetch={false}>SDK</Link></li>
      </ul>
      <div className="docs-sidebar-title">资源</div>
      <ul className="docs-nav-tree">
        <li><Link href="/cn/blog" prefetch={false}>博客</Link></li>
        <li><a href="https://github.com/FintechGuy71/FidesOrigin" target="_blank" rel="noopener">GitHub</a></li>
        <li><Link href="/admin/dashboard" prefetch={false}>控制台</Link></li>
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
                <h4>查询参数</h4>
        <ul>
          <li><code>status</code>（可选）— 按状态过滤：<code>active</code>、<code>inactive</code>、<code>draft</code>。</li>
          <li><code>limit</code>（可选）— 每页条数，最大 100，默认 50。</li>
          <li><code>offset</code>（可选）— 分页偏移量，默认 0。</li>
        </ul>
<h4>响应</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="复制代码">复制</button>
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
          <span className="docs-method get">GET</span>
          <code className="docs-endpoint-path">/address/&#123;address&#125;/risk</code>
        </div>
        <p>获取指定以太坊地址的最新风险档案。</p>
        <h4>查询参数</h4>
        <ul>
          <li><code>chainId</code>（可选）— 链 ID，默认为 1（以太坊）。支持 <code>sepolia</code>（11155111）、<code>base</code>（8453）等。</li>
          <li><code>amount</code>（可选）— 预留字段：为前向兼容而接受，当前不参与评估。</li>
        </ul>
        <h4>响应</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="复制代码">复制</button>
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
        <p>在单个请求中对多个地址进行批量风险检查。</p>
        <h4>请求体</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="复制代码">复制</button>
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
        <h4>响应</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="复制代码">复制</button>
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
        <h4>响应</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="复制代码">复制</button>
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
      <p>V2.1 引入了 <strong>PreTransactionGuard</strong>——一个零 Gas 的交易前拦截层。Guard 操作通过智能合约调用直接在链上执行，而非通过 REST API。请使用<Link href="/cn/docs/sdk#guard" prefetch={false}>链上 SDK</Link> 进行 Guard 集成。</p>

      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Solidity — Guard Interface</span>
          <button className="docs-code-copy" aria-label="复制代码">复制</button>
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
            <tr><td><code>403</code></td><td>Forbidden</td><td>状态变更请求的 CSRF 来源不被允许</td></tr>
            <tr><td><code>404</code></td><td>Not Found</td><td>地址或资源未找到</td></tr>
            <tr><td><code>429</code></td><td>Rate Limited</td><td>请求过于频繁（每 IP 每分钟 60 次）</td></tr>
            <tr><td><code>500</code></td><td>Server Error</td><td>内部服务器错误</td></tr>
            <tr><td><code>502</code></td><td>Bad Gateway</td><td>后端代理不可用</td></tr>
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
