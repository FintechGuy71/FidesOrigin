/* Auto-generated from public/jp/docs/sdk.html — do not edit by hand. */
export default function ContentDocsSdkJP() {
  return (
    <>
<div className="docs-layout">
    <aside className="docs-sidebar" id="docsSidebar">
      <div className="docs-sidebar-title">ドキュメント</div>
      <ul className="docs-nav-tree">
        <li><a href="/jp/docs">概要</a></li>
        <li><a href="/jp/docs/api">API リファレンス</a></li>
        <li><a href="/jp/docs/sdk" className="active">SDK</a></li>
      </ul>
      <div className="docs-sidebar-title">リソース</div>
      <ul className="docs-nav-tree">
        <li><a href="/jp/blog" target="_blank" rel="noopener">ブログ</a></li>
        <li><a href="https://github.com/FintechGuy71/FidesOrigin" target="_blank" rel="noopener">GitHub</a></li>
        <li><a href="/admin/">ダッシュボード</a></li>
      </ul>
    </aside>

    <button className="docs-sidebar-toggle" id="sidebarToggle" aria-expanded="false" aria-label="サイドバーを切り替え">
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      ドキュメントメニュー
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
    </button>

    <main className="docs-content">
      <h1>SDK</h1>
      <p className="docs-lead">ウォレット統合とオンチェーン・コンプライアンス用 JavaScript SDK。</p>

      <h2>インストール</h2>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>npm</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>npm install @fidesorigin/sdk</code></pre>
      </div>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>yarn</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>yarn add @fidesorigin/sdk</code></pre>
      </div>

      <h2>クイックスタート</h2>

      <h3>SDK を初期化</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>import &#123; FidesOrigin &#125; from '@fidesorigin/sdk';

const fides = new FidesOrigin(&#123;
  apiKey: 'YOUR_API_KEY',
  network: 'sepolia' // または 'mainnet', 'base'
&#125;);</code></pre>
      </div>

      <h3>住所リスクをチェック</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>const result = await fides.evaluateAddress('0x...');

console.log(result.riskTier); // 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
console.log(result.isSanctioned); // true または false</code></pre>
      </div>

      <h3>イベントを購読</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>fides.on('RiskDetected', (event) =&gt; &#123;
  console.log('リスク検出:', event.address, event.riskTier);
&#125;);

fides.on('SanctionAdded', (event) =&gt; &#123;
  console.log('制裁追加:', event.address);
&#125;);</code></pre>
      </div>

      <h2>コア API</h2>
      <div className="docs-table-wrap">
        <table className="docs-table">
          <thead>
            <tr><th>メソッド</th><th>戻り値</th><th>説明</th></tr>
          </thead>
          <tbody>
            <tr><td><code>connect(provider)</code></td><td>Promise&lt;void&gt;</td><td>Web3 プロバイダーに接続</td></tr>
            <tr><td><code>evaluateAddress(addr)</code></td><td>Promise&lt;RiskProfile&gt;</td><td>住所のリスクプロファイルを取得</td></tr>
            <tr><td><code>evaluateTx(tx)</code></td><td>Promise&lt;TxResult&gt;</td><td>トランザクションの事前スクリーニング</td></tr>
            <tr><td><code>subscribe(event)</code></td><td>EventEmitter</td><td>オンチェーン・イベントを購読</td></tr>
            <tr><td><code>disconnect()</code></td><td>void</td><td>接続をクリーンアップ</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Solidity 統合</h2>
      <p>FidesOrigin コントラクトを Solidity プロジェクトに直接インポート：</p>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Solidity 0.8.20</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
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

      <h2>型</h2>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
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
