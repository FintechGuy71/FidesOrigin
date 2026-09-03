/* Auto-generated from public/jp/docs/sdk.html — do not edit by hand. */
export default function ContentDocsSdkJP() {
  return (
    <>
<div className="docs-layout">
    <button className="docs-sidebar-toggle" id="sidebarToggle" aria-expanded="false" aria-label="サイドバーを切り替え">
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      ドキュメントメニュー
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
    </button>
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
        <li><a href="/admin/dashboard">ダッシュボード</a></li>
      </ul>
    </aside>


    <div className="docs-content">
      <h1>SDK <span className="docs-version">v0.2.1</span></h1>
      <p className="docs-lead">ウォレット統合とオンチェーン・コンプライアンス用 JavaScript SDK。</p>

      <h2>Packages</h2>
      {/* ⚠ 元は style={{ gridTemplateColumns: "1fr 1fr" }}：レイヤー未所属のインライン
          スタイルは @layer 内の宣言に常に優先し、legacy.css の @media (max-width:600px)
          {.docs-cards{grid-template-columns:1fr}} を打ち破ってしまう —— モバイルでも
          2 列のまま、カードが約 160px 幅に潰れる。.docs-cards のベースラインは元々
          repeat(2,1fr) のため、ここで再宣言する必要はない。 */}
      <div className="docs-cards">
        <a href="#rest-sdk" className="docs-card">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h3>REST SDK</h3>
          <p>API クライアント、リスクチェック、ルール管理、WebSocket ストリーミング。</p>
        </a>
        <a href="#on-chain-sdk" className="docs-card">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </div>
          <h3>On-Chain SDK</h3>
          <p>スマートコントラクトとの直接連携、Guard 統合、ガスフリー読み取り。</p>
        </a>
      </div>

      <h2 id="rest-sdk">インストール</h2>
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

      <h3>バッチリスクチェック</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>const batch = await fides.batchCheckRisk(&#123;
  addresses: [
    '0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee',
    '0xdAC17F958D2ee523a2206206994597C13D831ec7'
  ],
  chainId: 1
&#125;);

console.log(batch.summary); // &#123; total, highRisk, mediumRisk, lowRisk &#125;</code></pre>
      </div>

      <h3>WebSocket ストリーミング</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>const ws = fides.createWebSocket(&#123;
  autoReconnect: true,
  reconnectInterval: 3000
&#125;);

await ws.connect();
ws.subscribe(['risk.update', 'alert.new', 'rule.match']);

ws.on('risk.update', (msg) =&gt; &#123;
  console.log('リスク更新:', msg.data.address, msg.data.risk);
&#125;);

ws.on('alert.new', (msg) =&gt; &#123;
  console.log('新規アラート:', msg.data);
&#125;);</code></pre>
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

      <h2 id="on-chain-sdk">On-Chain SDK</h2>
      <p>スマートコントラクトと直接連携するには、On-Chain SDK を使用します。すべての view 関数はガスフリーです。</p>

      <h3>インストール</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>npm</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>npm install @fidesorigin/on-chain-sdk</code></pre>
      </div>

      <h3>On-Chain SDK の初期化</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>import &#123; FidesOriginSDK &#125; from '@fidesorigin/on-chain-sdk';
import &#123; JsonRpcProvider &#125; from 'ethers';

const provider = new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');

const addresses = &#123;
  complianceEngine: '0xdF36A8b16F064308eeDE21A740FAc4e87b724F0E',
  riskRegistry: '0x953f985f38f94d6159c0600d1f15D543895cE896',
  policyEngine: '0xCA12BB2daD2a6D429277823366D8C88a490EDDeA',
  riskOracle: '0x...' // オプション
&#125;;

const sdk = new FidesOriginSDK(addresses, provider);</code></pre>
      </div>

      <h3 id="guard">Guard 統合（V2.1）</h3>
      <p>On-Chain SDK を使用して <strong>PreTransactionGuard</strong> および <strong>GuardedComplianceEngine</strong> と連携し、ガス不要の取引前リスク評価を実行します。</p>

      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript — Guard 評価</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>import &#123; FidesOriginSDK, Decision &#125; from '@fidesorigin/on-chain-sdk';

// コンプライアンスエンジンで送金を検証
const validation = await sdk.validateTransfer(
  '0xSender...',
  '0xRecipient...',
  1000000000000000000n, // 1 ETH in wei
  '0xTokenAddress...'
);

if (validation.decision === Decision.BLOCK) &#123;
  console.warn('送金がブロックされました:', validation.reason);
&#125; else if (validation.decision === Decision.FLAG) &#123;
  console.warn('送金がレビュー対象としてフラグ付けされました:', validation.reason);
&#125;

// 簡易チェック
const canSend = await sdk.wouldTransferSucceed(
  '0xSender...', '0xRecipient...', 1000000000000000000n, '0xTokenAddress...'
);
console.log('成功見込み:', canSend);</code></pre>
      </div>

      <h3>リスクプロファイル照会（ガスフリー）</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>const profile = await sdk.getRiskProfile('0x...');
console.log(profile.riskScore, profile.tier, profile.isSanctioned);

const sanctioned = await sdk.isSanctioned('0x...');
const tier = await sdk.getRiskTier('0x...');
const tags = await sdk.getTags('0x...');</code></pre>
      </div>

      <h3>イベントリスナー</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>// 送金検証イベントを監視
const unsubscribe = sdk.onTransferValidated((asset, from, to, amount, decision, reason) =&gt; &#123;
  console.log(`Transfer $&#123;decision === Decision.ALLOW ? 'allowed' : 'blocked'&#125;: $&#123;reason&#125;`);
&#125;);

// 制裁追加イベントを監視
const unsubSanction = sdk.onSanctionAdded((account, reason) =&gt; &#123;
  console.log('制裁追加:', account, reason);
&#125;);

// クリーンアップ
sdk.removeAllListeners();</code></pre>
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

      <h2>React Hook</h2>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>React</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>import &#123; useRiskCheck &#125; from '@fintechguy71/fidesorigin-sdk/react';

function RiskBadge(&#123; address &#125;: &#123; address: string &#125;) &#123;
  const &#123; data, loading, error, refetch &#125; = useRiskCheck(&#123;
    options: &#123; baseUrl: 'https://api.fidesorigin.com', apiKey: 'pk_...' &#125;,
    pollInterval: 30000,
    enabled: true
  &#125;);

  if (loading) return &lt;span&gt;確認中...&lt;/span&gt;;
  if (error) return &lt;span&gt;エラー: &#123;error.message&#125;&lt;/span&gt;;
  if (!data) return null;

  return (
    &lt;span className=&#123;`risk-$&#123;data.risk.level&#125;`&#125;&gt;
      &#123;data.risk.level.toUpperCase()&#125; (&#123;data.risk.score&#125;)
    &lt;/span&gt;
  );
&#125;</code></pre>
      </div>
    </div>
  </div>
    </>
  );
}
