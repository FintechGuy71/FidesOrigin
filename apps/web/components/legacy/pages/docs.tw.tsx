/* Auto-generated from public/tw/docs/index.html — do not edit by hand. */
export default function ContentDocsTW() {
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
        <li><a href="/tw/docs" className="active">概覽</a></li>
        <li><a href="/tw/docs/api">API 參考</a></li>
        <li><a href="/tw/docs/sdk">SDK</a></li>
        <li><a href="/tw/demo">Demo</a></li>
      </ul>
      <div className="docs-sidebar-title">資源</div>
      <ul className="docs-nav-tree">
        <li><a href="/tw/blog" target="_blank" rel="noopener">博客</a></li>
        <li><a href="https://github.com/FintechGuy71/FidesOrigin" target="_blank" rel="noopener">GitHub</a></li>
        <li><a href="/admin/dashboard">控制台</a></li>
      </ul>
    </aside>


    <div className="docs-content">
      <h1>文件 <span className="docs-version">V2.1</span></h1>
      <p className="docs-lead">將鏈上合規整合到您的協議所需的一切。現已支援 Guard 交易前攔截。</p>

      <div className="docs-cards">
        <a href="/tw/docs/api" className="docs-card">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h3>API 參考</h3>
          <p>地址風險檢查、規則管理和風險評估的 REST API 端點。</p>
        </a>
        <a href="/tw/docs/sdk" className="docs-card">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </div>
          <h3>SDK</h3>
          <p>用於錢包集成、地址篩選和事件訂閱的 JavaScript SDK。</p>
        </a>
        <a href="/tw/demo" className="docs-card">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h3>Demo</h3>
          <p>Sepolia 測試網上的互動式演示。篩查地址、檢視風險分數，並體驗 Guard 的實際效果。</p>
        </a>
        <a href="/tw/blog" className="docs-card" target="_blank" rel="noopener">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </div>
          <h3>博客</h3>
          <p>深入探討鏈上合規、風險引擎和 DeFi 監管。</p>
        </a>
        <a href="https://github.com/FintechGuy71/FidesOrigin" className="docs-card" target="_blank" rel="noopener">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
          </div>
          <h3>GitHub</h3>
          <p>源代碼、問題和貢獻。</p>
        </a>
      </div>

      <h2>快速開始</h2>

      <h3>1. 檢查地址</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>cURL</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
        </div>
        <pre><code>curl https://api.fidesorigin.com/api/v1/addresses/0x... \
  -H "Authorization: Bearer YOUR_API_KEY"</code></pre>
      </div>

      <h3>2. 安裝 SDK</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Shell</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
        </div>
        <pre><code>npm install @fidesorigin/sdk</code></pre>
      </div>

      <h3>3. Solidity 集成</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Solidity 0.8.26</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
        </div>
        <pre><code>import "@fidesorigin/contracts/CompliantStableCoin.sol";

contract MyToken is CompliantStableCoin &#123;
    constructor() CompliantStableCoin("MyToken", "MTK") &#123;&#125;
&#125;</code></pre>
      </div>

      <h2>核心概念</h2>
      <div className="docs-concept-grid">
        <div className="docs-concept">
          <h4>鏈上風險執行</h4>
          <p>風險檢查在交易內部執行，而非通過外部 API 調用。確定性、零延遲、不可繞過。</p>
        </div>
        <div className="docs-concept">
          <h4>交易前 Guard</h4>
          <p>V2.1 引入 Guard——零 gas 的交易前攔截。在交易提交之前即可評估風險，並可配置阻止與警告門檻。</p>
        </div>
        <div className="docs-concept">
          <h4>風險等級</h4>
          <p>五個級別：UNKNOWN、LOW、MEDIUM、HIGH、CRITICAL。每個級別在 ComplianceEngine 和 Guard 中觸發不同的執行操作。</p>
        </div>
        <div className="docs-concept">
          <h4>策略引擎</h4>
          <p>每個資產可配置規則：最大交易金額、日限額、制裁地址攔截、KYC 要求、冷卻期。</p>
        </div>
        <div className="docs-concept">
          <h4>隔離金庫</h4>
          <p>可疑轉賬被託管在隔離金庫中，直到人工審核或滿足自動化條件。</p>
        </div>
        <div className="docs-concept">
          <h4>合規規則</h4>
          <p>透過 REST API 建立、更新與管理可程式化合規規則。基於優先級的評估，支援條件—動作邏輯。</p>
        </div>
      </div>

      <h2>Sepolia 測試網合約</h2>
      <p>在 Sepolia 測試網（chainId: 11155111）上與協議互動。</p>
      <div className="docs-table-wrap">
        <table className="docs-table">
          <thead>
            <tr>
              <th>合約</th>
              <th>地址</th>
              <th>類型</th>
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

      <h2>架構概覽</h2>
      <div style={{ "background": "var(--bg-card)", "border": "1px solid var(--border)", "borderRadius": "var(--radius-md)", "padding": "8px" }}>
        <div className="docs-arch-item">
          <div className="docs-arch-icon">&#128279;</div>
          <div>
            <h4>RiskRegistryV2</h4>
            <p>鏈上存儲 20,000+ 風險檔案、制裁名單和實體標籤。UUPS 可升級代理位於 <code>0x953f...E896</code>。</p>
          </div>
        </div>
        <div className="docs-arch-item">
          <div className="docs-arch-icon">&#9881;&#65039;</div>
          <div>
            <h4>ComplianceEngine</h4>
            <p>策略評估、轉賬鉤子、保留管理與隔離編排。</p>
          </div>
        </div>
        <div className="docs-arch-item">
          <div className="docs-arch-icon">&#128737;&#65039;</div>
          <div>
            <h4>PreTransactionGuard (V2.1)</h4>
            <p>零 gas 的交易前風險評估。在交易提交前評估地址與交易，可配置阻止／警告門檻。與 GuardedComplianceEngine 整合。</p>
          </div>
        </div>
        <div className="docs-arch-item">
          <div className="docs-arch-icon">&#129689;</div>
          <div>
            <h4>CompliantStableCoin</h4>
            <p>內置合規鉤子的 ERC20 示例。繼承用於您自己的代幣。Sepolia 上的 fUSD 位於 <code>0x2245...95E9</code>。</p>
          </div>
        </div>
        <div className="docs-arch-item">
          <div className="docs-arch-icon">&#128202;</div>
          <div>
            <h4>Subgraph</h4>
            <p>索引鏈上事件，用於實時查詢和分析。</p>
          </div>
        </div>
      </div>
    </div>
  </div>
    </>
  );
}
