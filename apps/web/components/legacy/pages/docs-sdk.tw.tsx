/* Auto-generated from public/tw/docs/sdk.html — do not edit by hand. */
export default function ContentDocsSdkTW() {
  return (
    <>
<div className="docs-layout">
    <aside className="docs-sidebar" id="docsSidebar">
      <div className="docs-sidebar-title">文件</div>
      <ul className="docs-nav-tree">
        <li><a href="/tw/docs">概覽</a></li>
        <li><a href="/tw/docs/api">API 參考</a></li>
        <li><a href="/tw/docs/sdk" className="active">SDK</a></li>
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
      <h1>SDK</h1>
      <p className="docs-lead">用於錢包集成和鏈上合規的 JavaScript SDK。</p>

      <h2>安裝</h2>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>npm</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
        </div>
        <pre><code>npm install @fidesorigin/sdk</code></pre>
      </div>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>yarn</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
        </div>
        <pre><code>yarn add @fidesorigin/sdk</code></pre>
      </div>

      <h2>快速開始</h2>

      <h3>初始化 SDK</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
        </div>
        <pre><code>import &#123; FidesOrigin &#125; from '@fidesorigin/sdk';

const fides = new FidesOrigin(&#123;
  apiKey: 'YOUR_API_KEY',
  network: 'sepolia' // 或 'mainnet', 'base'
&#125;);</code></pre>
      </div>

      <h3>檢查地址風險</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
        </div>
        <pre><code>const result = await fides.evaluateAddress('0x...');

console.log(result.riskTier); // 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
console.log(result.isSanctioned); // true 或 false</code></pre>
      </div>

      <h3>訂閱事件</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
        </div>
        <pre><code>fides.on('RiskDetected', (event) =&gt; &#123;
  console.log('檢測到風險:', event.address, event.riskTier);
&#125;);

fides.on('SanctionAdded', (event) =&gt; &#123;
  console.log('新增制裁:', event.address);
&#125;);</code></pre>
      </div>

      <h2>核心 API</h2>
      <div className="docs-table-wrap">
        <table className="docs-table">
          <thead>
            <tr><th>方法</th><th>返回</th><th>描述</th></tr>
          </thead>
          <tbody>
            <tr><td><code>connect(provider)</code></td><td>Promise&lt;void&gt;</td><td>連接 Web3 提供商</td></tr>
            <tr><td><code>evaluateAddress(addr)</code></td><td>Promise&lt;RiskProfile&gt;</td><td>獲取地址風險檔案</td></tr>
            <tr><td><code>evaluateTx(tx)</code></td><td>Promise&lt;TxResult&gt;</td><td>交易預篩查</td></tr>
            <tr><td><code>subscribe(event)</code></td><td>EventEmitter</td><td>訂閱鏈上事件</td></tr>
            <tr><td><code>disconnect()</code></td><td>void</td><td>清理連接</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Solidity 集成</h2>
      <p>將 FidesOrigin 合約直接導入您的 Solidity 項目：</p>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Solidity 0.8.20</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
        </div>
        <pre><code>// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@fidesorigin/contracts/CompliantStableCoin.sol";

contract MyStableCoin is CompliantStableCoin &#123;
    constructor()
        CompliantStableCoin("MyStableCoin", "MSC")
    &#123;
        policy = IssuerPolicy(&#123;
            maxTxAmount: 1_000_000 * 10**6,
            dailyLimit: 10_000_000 * 10**6,
            allowMediumRisk: true,
            allowHighRisk: false,
            blockMixer: true,
            requireDestinationKYC: true,
            cooldownPeriod: 24 hours
        &#125;);
    &#125;
&#125;</code></pre>
      </div>

      <h2>類型</h2>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
        </div>
        <pre><code>interface RiskProfile &#123;
  address: string;
  riskScore: number;
  riskTier: 'UNKNOWN' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isSanctioned: boolean;
  tags: string[];
  entityName: string;
  lastUpdated: string;
&#125;

interface TxResult &#123;
  allowed: boolean;
  riskScore: number;
  riskTier: string;
  quarantineRequired: boolean;
  reason: string | null;
&#125;</code></pre>
      </div>
    </main>
  </div>
    </>
  );
}
