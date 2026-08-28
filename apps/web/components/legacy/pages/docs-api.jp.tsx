/* Auto-generated from public/jp/docs/api.html — do not edit by hand. */
export default function ContentDocsApiJP() {
  return (
    <>
<div className="docs-layout">
    <aside className="docs-sidebar" id="docsSidebar">
      <div className="docs-sidebar-title">ドキュメント</div>
      <ul className="docs-nav-tree">
        <li><a href="/jp/docs">概要</a></li>
        <li><a href="/jp/docs/api" className="active">API リファレンス</a></li>
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
      <h1>API リファレンス</h1>
      <p className="docs-lead">オンチェーン・コンプライアンスとリスク評価の REST API。</p>

      <h2>ベース URL</h2>
      <div className="docs-base-url">
        <code>https://api.fidesorigin.com/api/v1</code>
      </div>

      <h2>認証</h2>
      <p>すべての API リクエストには Authorization ヘッダーで Bearer token が必要です。</p>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Header</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>Authorization: Bearer YOUR_API_KEY</code></pre>
      </div>

      <h2>エンドポイント</h2>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method get">GET</span>
          <code className="docs-endpoint-path">/addresses/&#123;address&#125;</code>
        </div>
        <p>指定された Ethereum アドレスのリスクプロファイルを取得します。</p>
        <h4>レスポンス</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
          </div>
          <pre><code>&#123;
  "address": "0x...",
  "risk_score": 85,
  "risk_tier": "HIGH",
  "is_sanctioned": false,
  "tags": ["mixer", "high_volume"],
  "entity_name": "Unknown",
  "last_updated": "2026-07-24T09:00:00Z"
&#125;</code></pre>
        </div>
      </div>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method post">POST</span>
          <code className="docs-endpoint-path">/risk-assessment</code>
        </div>
        <p>実行前にトランザクションをリスク評価のために送信します。</p>
        <h4>リクエスト本文</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
          </div>
          <pre><code>&#123;
  "from": "0x...",
  "to": "0x...",
  "amount": "1000000000000000000",
  "asset": "0x..."
&#125;</code></pre>
        </div>
        <h4>レスポンス</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
          </div>
          <pre><code>&#123;
  "allowed": true,
  "risk_score": 15,
  "risk_tier": "LOW",
  "quarantine_required": false,
  "reason": null
&#125;</code></pre>
        </div>
      </div>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method get">GET</span>
          <code className="docs-endpoint-path">/rules</code>
        </div>
        <p>すべてのアクティブなコンプライアンスルールを一覧表示します。</p>
        <h4>レスポンス</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
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

      <h2>エラーコード</h2>
      <div className="docs-table-wrap">
        <table className="docs-table">
          <thead>
            <tr><th>コード</th><th>ステータス</th><th>説明</th></tr>
          </thead>
          <tbody>
            <tr><td><code>400</code></td><td>Bad Request</td><td>無効なリクエストパラメータ</td></tr>
            <tr><td><code>401</code></td><td>Unauthorized</td><td>API キーがないか無効</td></tr>
            <tr><td><code>404</code></td><td>Not Found</td><td>アドレスまたはリソースが見つからない</td></tr>
            <tr><td><code>429</code></td><td>Rate Limited</td><td>リクエストが多すぎる</td></tr>
            <tr><td><code>500</code></td><td>Server Error</td><td>内部サーバーエラー</td></tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
    </>
  );
}
