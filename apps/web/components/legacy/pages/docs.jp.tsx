/* Auto-generated from public/jp/docs/index.html — do not edit by hand. */
export default function ContentDocsJP() {
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
        <li><a href="/jp/docs" className="active">概要</a></li>
        <li><a href="/jp/docs/api">API リファレンス</a></li>
        <li><a href="/jp/docs/sdk">SDK</a></li>
        <li><a href="/jp/demo">デモ</a></li>
      </ul>
      <div className="docs-sidebar-title">リソース</div>
      <ul className="docs-nav-tree">
        <li><a href="/jp/blog" target="_blank" rel="noopener">ブログ</a></li>
        <li><a href="https://github.com/FintechGuy71/FidesOrigin" target="_blank" rel="noopener">GitHub</a></li>
        <li><a href="/admin/dashboard">ダッシュボード</a></li>
      </ul>
    </aside>


    <div className="docs-content">
      <h1>ドキュメント <span className="docs-version">V2.1</span></h1>
      <p className="docs-lead">プロトコルにオンチェーン・コンプライアンスを統合するために必要なすべて。Guard によるトランザクション前のインターセプトにも対応しました。</p>

      <div className="docs-cards">
        <a href="/jp/docs/api" className="docs-card">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h3>API リファレンス</h3>
          <p>住所リスクチェック、ルール管理、一括スクリーニング、リアルタイムモニタリングの REST API エンドポイント。</p>
        </a>
        <a href="/jp/docs/sdk" className="docs-card">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </div>
          <h3>SDK</h3>
          <p>ウォレット統合、住所スクリーニング、Guard 統合、イベント購読用 JavaScript SDK。</p>
        </a>
        <a href="/jp/demo" className="docs-card">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h3>デモ</h3>
          <p>Sepolia テストネットでのインタラクティブデモ。アドレスのスクリーニング、リスクスコアの確認、Guard の動作を体験できます。</p>
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
          <h4>トランザクション前 Guard</h4>
          <p>V2.1 で Guard を導入。ガスゼロのトランザクション前インターセプトにより、トランザクションの送信前にリスクを評価します。ブロックと警告のしきい値は設定可能です。</p>
        </div>
        <div className="docs-concept">
          <h4>リスクティア</h4>
          <p>5 レベル：UNKNOWN、LOW、MEDIUM、HIGH、CRITICAL。各ティアは、ComplianceEngine と Guard において異なるエンフォースメントアクションをトリガーします。</p>
        </div>
        <div className="docs-concept">
          <h4>ポリシー・エンジン</h4>
          <p>アセットごとに設定可能なルール：最大取引金額、日次制限、制裁住所ブロック、KYC 要件、クールダウン期間。</p>
        </div>
        <div className="docs-concept">
          <h4>隔離金庫</h4>
          <p>怪しい転送は、手動レビューまたは自動化条件が満たされるまで、隔離金庫に保持されます。</p>
        </div>
        <div className="docs-concept">
          <h4>コンプライアンスルール</h4>
          <p>REST API 経由でプログラマブルなコンプライアンスルールの作成・更新・管理が可能。条件-アクションロジックによる優先度ベースの評価。</p>
        </div>
      </div>

      <h2>Sepolia テストネットコントラクト</h2>
      <p>Sepolia テストネット（chainId: 11155111）でプロトコルとやり取りできます。</p>
      <div className="docs-table-wrap">
        <table className="docs-table">
          <thead>
            <tr>
              <th>コントラクト</th>
              <th>アドレス</th>
              <th>タイプ</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>RiskRegistry (Proxy)</td>
              <td><code>0x953f985f38f94d6159c0600d1f15D543895cE896</code></td>
              <td>UUPS プロキシ</td>
            </tr>
            <tr>
              <td>PolicyEngine (Proxy)</td>
              <td><code>0xCA12BB2daD2a6D429277823366D8C88a490EDDeA</code></td>
              <td>UUPS プロキシ</td>
            </tr>
            <tr>
              <td>ComplianceEngine (Proxy)</td>
              <td><code>0xdF36A8b16F064308eeDE21A740FAc4e87b724F0E</code></td>
              <td>UUPS プロキシ</td>
            </tr>
            <tr>
              <td>QuarantineVault</td>
              <td><code>0xF7c5c4DdcB0F868a6c271334131728CecA313DFb</code></td>
              <td>直接デプロイ</td>
            </tr>
            <tr>
              <td>FidesCompliance</td>
              <td><code>0x1176db6ECa38AA9C4d153Ae4d21C3972c6335707</code></td>
              <td>直接デプロイ</td>
            </tr>
            <tr>
              <td>CompliantStableCoin (fUSD)</td>
              <td><code>0x2245A8FCf6aca017327eA8950Ba510e9596595E9</code></td>
              <td>直接デプロイ</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>アーキテクチャ概要</h2>
      <div style={{ "background": "var(--bg-card)", "border": "1px solid var(--border)", "borderRadius": "var(--radius-md)", "padding": "8px" }}>
        <div className="docs-arch-item">
          <div className="docs-arch-icon">&#128279;</div>
          <div>
            <h4>RiskRegistryV2</h4>
            <p>20,000+ リスクプロファイル、制裁リスト、エンティティタグのオンチェーン・ストレージ。UUPS アップグレード可能プロキシ（<code>0x953f...E896</code>）。</p>
          </div>
        </div>
        <div className="docs-arch-item">
          <div className="docs-arch-icon">&#9881;&#65039;</div>
          <div>
            <h4>ComplianceEngine</h4>
            <p>ポリシー評価、転送フック、ホールド管理、隔離のオーケストレーション。</p>
          </div>
        </div>
        <div className="docs-arch-item">
          <div className="docs-arch-icon">&#128737;&#65039;</div>
          <div>
            <h4>PreTransactionGuard (V2.1)</h4>
            <p>ガスゼロのトランザクション前リスク評価。送信前にアドレスとトランザクションを評価し、ブロック/警告のしきい値は設定可能。GuardedComplianceEngine と統合します。</p>
          </div>
        </div>
        <div className="docs-arch-item">
          <div className="docs-arch-icon">&#129689;</div>
          <div>
            <h4>CompliantStableCoin</h4>
            <p>組み込みコンプライアンス・フックを持つ ERC20 の例。独自のトークンに継承します。Sepolia の fUSD：<code>0x2245...95E9</code>。</p>
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
    </div>
  </div>
    </>
  );
}
