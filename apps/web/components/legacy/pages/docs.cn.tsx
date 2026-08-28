/* Auto-generated from public/cn/docs/index.html — do not edit by hand. */
export default function ContentDocsCN() {
  return (
    <>
<div className="docs-layout">
    
    <aside className="docs-sidebar" id="docsSidebar">
      <div className="docs-sidebar-title">文档</div>
      <ul className="docs-nav-tree">
        <li><a href="/cn/docs" className="active">概览</a></li>
        <li><a href="/cn/docs/api">API 参考</a></li>
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
      <h1>文档</h1>
      <p className="docs-lead">将链上合规集成到您的协议所需的一切。</p>

      <div className="docs-cards">
        <a href="/cn/docs/api" className="docs-card">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h3>API 参考</h3>
          <p>地址风险检查、规则管理和风险评估的 REST API 端点。</p>
        </a>
        <a href="/cn/docs/sdk" className="docs-card">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </div>
          <h3>SDK</h3>
          <p>用于钱包集成、地址筛选和事件订阅的 JavaScript SDK。</p>
        </a>
        <a href="/cn/blog" className="docs-card" target="_blank" rel="noopener">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </div>
          <h3>博客</h3>
          <p>深入探讨链上合规、风险引擎和 DeFi 监管。</p>
        </a>
        <a href="https://github.com/FintechGuy71/FidesOrigin" className="docs-card" target="_blank" rel="noopener">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
          </div>
          <h3>GitHub</h3>
          <p>源代码、问题和贡献。</p>
        </a>
      </div>

      <h2>快速开始</h2>

      <h3>1. 检查地址</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>cURL</span>
          <button className="docs-code-copy" aria-label="复制代码">复制</button>
        </div>
        <pre><code>curl https://api.fidesorigin.com/api/v1/addresses/0x... \
  -H "Authorization: Bearer YOUR_API_KEY"</code></pre>
      </div>

      <h3>2. 安装 SDK</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Shell</span>
          <button className="docs-code-copy" aria-label="复制代码">复制</button>
        </div>
        <pre><code>npm install @fidesorigin/sdk</code></pre>
      </div>

      <h3>3. Solidity 集成</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Solidity 0.8.26</span>
          <button className="docs-code-copy" aria-label="复制代码">复制</button>
        </div>
        <pre><code>import "@fidesorigin/contracts/CompliantStableCoin.sol";

contract MyToken is CompliantStableCoin &#123;
    constructor() CompliantStableCoin("MyToken", "MTK") &#123;&#125;
&#125;</code></pre>
      </div>

      <h2>核心概念</h2>
      <div className="docs-concept-grid">
        <div className="docs-concept">
          <h4>链上风险执行</h4>
          <p>风险检查在交易内部执行，而非通过外部 API 调用。确定性、零延迟、不可绕过。</p>
        </div>
        <div className="docs-concept">
          <h4>风险等级</h4>
          <p>五个级别：UNKNOWN、LOW、MEDIUM、HIGH、CRITICAL。每个级别触发不同的执行操作。</p>
        </div>
        <div className="docs-concept">
          <h4>策略引擎</h4>
          <p>每个资产可配置规则：最大交易金额、日限额、制裁地址拦截、KYC 要求。</p>
        </div>
        <div className="docs-concept">
          <h4>隔离金库</h4>
          <p>可疑转账被托管在隔离金库中，直到人工审核或满足自动化条件。</p>
        </div>
      </div>

      <h2>架构概览</h2>
      <div style={{ "background": "var(--bg-card)", "border": "1px solid var(--border)", "borderRadius": "var(--radius-md)", "padding": "8px" }}>
        <div className="docs-arch-item">
          <div className="docs-arch-icon">&#128279;</div>
          <div>
            <h4>RiskRegistryV2</h4>
            <p>链上存储 20,000+ 风险档案、制裁名单和实体标签。</p>
          </div>
        </div>
        <div className="docs-arch-item">
          <div className="docs-arch-icon">&#9881;&#65039;</div>
          <div>
            <h4>ComplianceEngine</h4>
            <p>策略评估、转账钩子、隔离管理。</p>
          </div>
        </div>
        <div className="docs-arch-item">
          <div className="docs-arch-icon">&#129689;</div>
          <div>
            <h4>CompliantStableCoin</h4>
            <p>内置合规钩子的 ERC20 示例。继承用于您自己的代币。</p>
          </div>
        </div>
        <div className="docs-arch-item">
          <div className="docs-arch-icon">&#128202;</div>
          <div>
            <h4>Subgraph</h4>
            <p>索引链上事件，用于实时查询和分析。</p>
          </div>
        </div>
      </div>
    </main>
  </div>
    </>
  );
}
