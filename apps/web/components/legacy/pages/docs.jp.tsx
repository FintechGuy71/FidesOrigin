/* Auto-generated from public/jp/docs/index.html — do not edit by hand. */
export default function ContentDocsJP() {
  return (
    <>
<div className="docs-layout">
    <aside className="docs-sidebar" id="docsSidebar">
      <div className="docs-sidebar-title">ドキュメント</div>
      <ul className="docs-nav-tree">
        <li><a href="/jp/docs" className="active">概要</a></li>
        <li><a href="/jp/docs/api">API リファレンス</a></li>
        <li><a href="/jp/docs/sdk">SDK</a></li>
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
      <h1>ドキュメント</h1>
      <p className="docs-lead">プロトコルにオンチェーン・コンプライアンスを統合するために必要なすべて。</p>

      <div className="docs-cards">
        <a href="/jp/docs/api" className="docs-card">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h3>API リファレンス</h3>
          <p>住所リスクチェック、ルール管理、リスク評価の REST API エンドポイント。</p>
        </a>
        <a href="/jp/docs/sdk" className="docs-card">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </div>
          <h3>SDK</h3>
          <p>ウォレット統合、住所スクリーニング、イベント購読用 JavaScript SDK。</p>
        </a>
        <a href="/jp/blog" className="docs-card" target="_blank" rel="noopener">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </div>
          <h3>ブログ</h3>
          <p>オンチェーン・コンプライアンス、リスクエンジン、DeFi 規制の深掘り。</p>
        </a>
        <a href="https://github.com/FintechGuy71/FidesOrigin" className="docs-card" target="_blank" rel="noopener">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
          </div>
          <h3>GitHub</h3>
          <p>ソースコード、イシュー、コントリビューション。</p>
        </a>
      </div>

      <h2>クイックスタート</h2>

      <h3>1. 住所をチェック</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>cURL</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>curl https://api.fidesorigin.com/api/v1/addresses/0x... \
  -H "Authorization: Bearer YOUR_API_KEY"</code></pre>
      </div>

      <h3>2. SDK をインストール</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Shell</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>npm install @fidesorigin/sdk</code></pre>
      </div>

      <h3>3. Solidity 統合</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Solidity 0.8.26</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>import "@fidesorigin/contracts/CompliantStableCoin.sol";

contract MyToken is CompliantStableCoin &#123;
    constructor() CompliantStableCoin("MyToken", "MTK") &#123;&#125;
&#125;</code></pre>
      </div>

      <h2>核心概念</h2>
      <div className="docs-concept-grid">
        <div className="docs-concept">
          <h4>オンチェーン・リスク・エンフォースメント</h4>
          <p>リスクチェックはトランザクション内で実行され、外部 API 呼び出しではありません。決定論的、ゼロレイテンシ、回避不可能。</p>
        </div>
        <div className="docs-concept">
          <h4>リスクティア</h4>
          <p>5 レベル：UNKNOWN、LOW、MEDIUM、HIGH、CRITICAL。各レベルは異なるエンフォースメント・アクションをトリガーします。</p>
        </div>
        <div className="docs-concept">
          <h4>ポリシー・エンジン</h4>
          <p>アセットごとに設定可能なルール：最大取引金額、日次制限、制裁住所ブロック、KYC 要件。</p>
        </div>
        <div className="docs-concept">
          <h4>隔離金庫</h4>
          <p>怪しい転送は、手動レビューまたは自動化条件が満たされるまで、隔離金庫に保持されます。</p>
        </div>
      </div>

      <h2>アーキテクチャ概要</h2>
      <div style={{ "background": "var(--bg-card)", "border": "1px solid var(--border)", "borderRadius": "var(--radius-md)", "padding": "8px" }}>
        <div className="docs-arch-item">
          <div className="docs-arch-icon">&#128279;</div>
          <div>
            <h4>RiskRegistryV2</h4>
            <p>20,000+ リスクプロファイル、制裁リスト、エンティティタグのオンチェーン・ストレージ。</p>
          </div>
        </div>
        <div className="docs-arch-item">
          <div className="docs-arch-icon">&#9881;&#65039;</div>
          <div>
            <h4>ComplianceEngine</h4>
            <p>ポリシー評価、転送フック、隔離管理。</p>
          </div>
        </div>
        <div className="docs-arch-item">
          <div className="docs-arch-icon">&#129689;</div>
          <div>
            <h4>CompliantStableCoin</h4>
            <p>組み込みコンプライアンス・フックを持つ ERC20 の例。独自のトークンに継承します。</p>
          </div>
        </div>
        <div className="docs-arch-item">
          <div className="docs-arch-icon">&#128202;</div>
          <div>
            <h4>Subgraph</h4>
            <p>リアルタイム・クエリと分析のためのオンチェーン・イベントのインデックス。</p>
          </div>
        </div>
      </div>
    </main>
  </div>
    </>
  );
}
