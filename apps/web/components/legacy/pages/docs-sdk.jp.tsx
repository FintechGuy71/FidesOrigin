/* Auto-generated from public/jp/docs/sdk.html — do not edit by hand. */
import Link from "next/link";

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
        <li><Link href="/jp/docs" prefetch={false}>概要</Link></li>
        <li><Link href="/jp/docs/api" prefetch={false}>API リファレンス</Link></li>
        <li><Link href="/jp/docs/sdk" className="active" prefetch={false}>SDK</Link></li>
      </ul>
      <div className="docs-sidebar-title">リソース</div>
      <ul className="docs-nav-tree">
        <li><Link href="/jp/blog" prefetch={false}>ブログ</Link></li>
        <li><a href="https://github.com/FintechGuy71/FidesOrigin" target="_blank" rel="noopener">GitHub</a></li>
        <li><Link href="/admin/dashboard" prefetch={false}>ダッシュボード</Link></li>
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
        <pre><code>npm install @fintechguy71/fidesorigin-sdk</code></pre>
      </div>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>yarn</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>yarn add @fintechguy71/fidesorigin-sdk</code></pre>
      </div>
      <p className="docs-note"><strong>パッケージの提供元:</strong> SDK は <strong>GitHub Packages</strong> に公開されています。インストール前に <code>.npmrc</code> へ <code>@fintechguy71:registry=https://npm.pkg.github.com</code> を追加し、GitHub トークンで認証すれば、上記コマンドでインストールできます。公共 npmjs.org へのミラーは次のステップです。</p>

      <h2>クイックスタート</h2>

      <h3>クライアントを初期化</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>import &#123; FidesOriginClient &#125; from '@fintechguy71/fidesorigin-sdk';
{"\n"}
{"\n"}const fides = new FidesOriginClient(&#123;
{"\n  "}baseUrl: 'https://api.fidesorigin.com',
{"\n  "}apiKey: 'YOUR_API_KEY',
{"\n  "}timeout: 30000
{"\n"}&#125;);</code></pre>
      </div>
      <p className="docs-note"><strong>注意：</strong>ブラウザ環境では公開 API キー（プレフィックス <code>pk_</code>）のみ使用できます。セキュリティ上、シークレットキーは厳格に禁止されます。</p>

      <h3>アドレスリスクをチェック</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>const result = await fides.checkRisk(&#123;
{"\n  "}address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee',
{"\n  "}chainId: 1  // または 'ethereum'、'sepolia'、11155111
{"\n"}&#125;);
{"\n"}
{"\n"}console.log(result.risk_level);   // 'low' | 'medium' | 'high' | 'critical'
{"\n"}console.log(result.risk_score);   // 0-100
{"\n"}console.log(result.risk_factors); // リスクフラグの配列</code></pre>
      </div>

      <h3>バッチリスクチェック</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>const batch = await fides.batchCheckRisk(&#123;
{"\n  "}addresses: [
{"\n    "}'0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee',
{"\n    "}'0xdAC17F958D2ee523a2206206994597C13D831ec7'
{"\n  "}],
{"\n  "}chainId: 1
{"\n"}&#125;);
{"\n"}
{"\n"}console.log(batch.summary); // &#123; total, highRisk, mediumRisk, lowRisk &#125;</code></pre>
      </div>

      <h3>WebSocket ストリーミング</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>const ws = fides.createWebSocket(&#123;
{"\n  "}autoReconnect: true,
{"\n  "}reconnectInterval: 3000
{"\n"}&#125;);
{"\n"}
{"\n"}await ws.connect();
{"\n"}ws.subscribe(['risk.update', 'alert.new', 'rule.match']);
{"\n"}
{"\n"}ws.on('risk.update', (msg) =&gt; &#123;
{"\n  "}console.log('リスク更新:', msg.data.address, msg.data.risk);
{"\n"}&#125;);
{"\n"}
{"\n"}ws.on('alert.new', (msg) =&gt; &#123;
{"\n  "}console.log('新規アラート:', msg.data);
{"\n"}&#125;);</code></pre>
      </div>

      <h2>コア API</h2>
      <div className="docs-table-wrap">
        <table className="docs-table">
          <thead>
            <tr><th>メソッド</th><th>戻り値</th><th>説明</th></tr>
          </thead>
          <tbody>
            <tr><td><code>checkRisk(input)</code></td><td>Promise&lt;RiskCheckResult&gt;</td><td>単一アドレスのリスク評価</td></tr>
            <tr><td><code>batchCheckRisk(input)</code></td><td>Promise&lt;BatchRiskCheckResult&gt;</td><td>アドレスの一括スクリーニング</td></tr>
            <tr><td><code>getAddressRisk(address)</code></td><td>Promise&lt;AddressRisk&gt;</td><td>アドレスの最新リスクスナップショットを取得</td></tr>
            <tr><td><code>getDashboardStats()</code></td><td>Promise&lt;DashboardStats&gt;</td><td>グローバルなコンプライアンス統計</td></tr>
            <tr><td><code>listRules(options?)</code></td><td>Promise&lt;RuleListResponse&gt;</td><td>コンプライアンスルールをページネーションで一覧</td></tr>
            <tr><td><code>createRule(req)</code></td><td>Promise&lt;Rule&gt;</td><td>新しいコンプライアンスルールを作成</td></tr>
            <tr><td><code>updateRule(id, req)</code></td><td>Promise&lt;Rule&gt;</td><td>既存のルールを更新</td></tr>
            <tr><td><code>deleteRule(id)</code></td><td>Promise&lt;void&gt;</td><td>コンプライアンスルールを削除</td></tr>
            <tr><td><code>createWebSocket(config?)</code></td><td>FidesOriginWebSocket</td><td>リアルタイム WebSocket 接続を作成</td></tr>
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
        <pre><code>npm install @fintechguy71/on-chain-sdk</code></pre>
      </div>

      <h3>On-Chain SDK の初期化</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>import &#123; FidesOriginSDK &#125; from '@fintechguy71/on-chain-sdk';
{"\n"}
{"\n"}import &#123; JsonRpcProvider &#125; from 'ethers';
{"\n"}
{"\n"}const provider = new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
{"\n"}
{"\n"}const addresses = &#123;
{"\n  "}complianceEngine: '0xdF36A8b16F064308eeDE21A740FAc4e87b724F0E',
{"\n  "}riskRegistry: '0x953f985f38f94d6159c0600d1f15D543895cE896',
{"\n  "}policyEngine: '0xCA12BB2daD2a6D429277823366D8C88a490EDDeA',
{"\n  "}riskOracle: '0x...' // オプション
{"\n"}&#125;;
{"\n"}
{"\n"}const sdk = new FidesOriginSDK(addresses, provider);</code></pre>
      </div>

      <h3 id="guard">Guard 統合（V2.1）</h3>
      <p>On-Chain SDK を使用して <strong>PreTransactionGuard</strong> および <strong>GuardedComplianceEngine</strong> と連携し、ガス不要の取引前リスク評価を実行します。</p>

      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript — Guard 評価</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>import &#123; FidesOriginSDK, Decision &#125; from '@fintechguy71/on-chain-sdk';
{"\n"}
{"\n"}// コンプライアンスエンジンで送金を検証
{"\n"}const validation = await sdk.validateTransfer(
{"\n  "}'0xSender...',
{"\n  "}'0xRecipient...',
{"\n  "}1000000000000000000n, // 1 ETH in wei
{"\n  "}'0xTokenAddress...'
{"\n"});
{"\n"}
{"\n"}if (validation.decision === Decision.BLOCK) &#123;
{"\n  "}console.warn('送金がブロックされました:', validation.reason);
{"\n"}&#125; else if (validation.decision === Decision.FLAG) &#123;
{"\n  "}console.warn('送金がレビュー対象としてフラグ付けされました:', validation.reason);
{"\n"}&#125;
{"\n"}
{"\n"}// 簡易チェック
{"\n"}const canSend = await sdk.wouldTransferSucceed(
{"\n  "}'0xSender...', '0xRecipient...', 1000000000000000000n, '0xTokenAddress...'
{"\n"});
{"\n"}console.log('成功見込み:', canSend);</code></pre>
      </div>

      <h3>リスクプロファイル照会（ガスフリー）</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>const profile = await sdk.getRiskProfile('0x...');
{"\n"}console.log(profile.riskScore, profile.tier, profile.isSanctioned);
{"\n"}
{"\n"}const sanctioned = await sdk.isSanctioned('0x...');
{"\n"}const tier = await sdk.getRiskTier('0x...');
{"\n"}const tags = await sdk.getTags('0x...');</code></pre>
      </div>

      <h3>イベントリスナー</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>// 送金検証イベントを監視
{"\n"}const unsubscribe = sdk.onTransferValidated((asset, from, to, amount, decision, reason) =&gt; &#123;
{"\n  "}console.log(`Transfer $&#123;decision === Decision.ALLOW ? 'allowed' : 'blocked'&#125;: $&#123;reason&#125;`);
{"\n"}&#125;);
{"\n"}
{"\n"}// 制裁追加イベントを監視
{"\n"}const unsubSanction = sdk.onSanctionAdded((account, reason) =&gt; &#123;
{"\n  "}console.log('制裁追加:', account, reason);
{"\n"}&#125;);
{"\n"}
{"\n"}// クリーンアップ
{"\n"}sdk.removeAllListeners();</code></pre>
      </div>

      <h2>Solidity 統合</h2>
      <p>FidesOrigin コントラクトを Solidity プロジェクトに直接インポート：</p>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Solidity 0.8.20</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>// SPDX-License-Identifier: MIT
{"\n"}pragma solidity ^0.8.20;
{"\n"}
{"\n"}import "@fidesorigin/contracts/CompliantStableCoin.sol";
{"\n"}
{"\n"}contract MyStableCoin is CompliantStableCoin &#123;
{"\n    "}constructor()
{"\n        "}CompliantStableCoin("MyStableCoin", "MSC")
{"\n    "}&#123;
{"\n        "}policy = IssuerPolicy(&#123;
{"\n            "}maxTxAmount: 1_000_000 * 10**6,
{"\n            "}dailyLimit: 10_000_000 * 10**6,
{"\n            "}allowMediumRisk: true,
{"\n            "}allowHighRisk: false,
{"\n            "}blockMixer: true,
{"\n            "}requireDestinationKYC: true,
{"\n            "}cooldownPeriod: 24 hours
{"\n        "}&#125;);
{"\n    "}&#125;
{"\n"}&#125;</code></pre>
      </div>

      <h2>型</h2>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>interface RiskCheckResult &#123;
{"\n  "}address: string;
{"\n  "}chain: string;
{"\n  "}risk_score: number;
{"\n  "}risk_level: 'low' | 'medium' | 'high' | 'critical';
{"\n  "}risk_factors: RiskFactor[];
{"\n  "}scores?: RiskScore[];
{"\n  "}addressType?: 'wallet' | 'contract' | 'exchange' | 'mixer' | 'unknown';
{"\n  "}timestamp?: string;
{"\n  "}relatedEntities?: Entity[];
{"\n  "}transactionStats?: TransactionStats;
{"\n"}&#125;
{"\n"}
{"\n"}interface RiskFactor &#123;
{"\n  "}name: string;
{"\n  "}category: string;
{"\n  "}severity: string;
{"\n  "}description?: string;
{"\n"}&#125;
{"\n"}
{"\n"}interface RiskScore &#123;
{"\n  "}score: number;
{"\n  "}level: string;
{"\n  "}confidence: number;
{"\n"}&#125;
{"\n"}
{"\n"}interface Rule &#123;
{"\n  "}id: string;
{"\n  "}name: string;
{"\n  "}description?: string;
{"\n  "}status: 'active' | 'inactive' | 'draft';
{"\n  "}priority: number;
{"\n  "}conditions: RuleCondition[];
{"\n  "}actions: RuleAction[];
{"\n  "}createdAt: string;
{"\n  "}updatedAt: string;
{"\n"}&#125;
{"\n"}
{"\n"}interface RuleCondition &#123;
{"\n  "}field: string;
{"\n  "}operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in';
{"\n  "}value: unknown;
{"\n"}&#125;
{"\n"}
{"\n"}interface RuleAction &#123;
{"\n  "}type: 'flag' | 'block' | 'review' | 'allow';
{"\n  "}params?: Record&lt;string, unknown&gt;;
{"\n"}&#125;
{"\n"}
{"\n"}// On-Chain SDK types
{"\n"}enum Decision &#123; ALLOW = 0, FLAG = 1, BLOCK = 2 &#125;
{"\n"}enum RiskTier &#123; UNKNOWN = 0, LOW = 1, MEDIUM = 2, HIGH = 3, CRITICAL = 4 &#125;
{"\n"}
{"\n"}interface TransferValidationResult &#123;
{"\n  "}wouldSucceed: boolean;
{"\n  "}decision: Decision;
{"\n  "}reason: string;
{"\n"}&#125;</code></pre>
      </div>

      <h2>React Hook</h2>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>React</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>import &#123; useRiskCheck &#125; from '@fintechguy71/fidesorigin-sdk/react';
{"\n"}
{"\n"}function RiskBadge(&#123; address &#125;: &#123; address: string &#125;) &#123;
{"\n  "}const &#123; data, loading, error, refetch &#125; = useRiskCheck(&#123;
{"\n    "}options: &#123; baseUrl: 'https://api.fidesorigin.com', apiKey: 'pk_...' &#125;,
{"\n    "}pollInterval: 30000,
{"\n    "}enabled: true
{"\n  "}&#125;);
{"\n"}
{"\n  "}if (loading) return &lt;span&gt;確認中...&lt;/span&gt;;
{"\n  "}if (error) return &lt;span&gt;エラー: &#123;error.message&#125;&lt;/span&gt;;
{"\n  "}if (!data) return null;
{"\n"}
{"\n  "}return (
{"\n    "}&lt;span className=&#123;`risk-$&#123;data.risk.level&#125;`&#125;&gt;
{"\n      "}&#123;data.risk.level.toUpperCase()&#125; (&#123;data.risk.score&#125;)
{"\n    "}&lt;/span&gt;
{"\n  "});
{"\n"}&#125;</code></pre>
      </div>
    </div>
  </div>
    </>
  );
}
