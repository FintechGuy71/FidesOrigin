/* Auto-generated from public/jp/docs/api.html — do not edit by hand. */
export default function ContentDocsApiJP() {
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
        <li><a href="/jp/docs/api" className="active">API リファレンス</a></li>
        <li><a href="/jp/docs/sdk">SDK</a></li>
      </ul>
      <div className="docs-sidebar-title">リソース</div>
      <ul className="docs-nav-tree">
        <li><a href="/jp/blog" target="_blank" rel="noopener">ブログ</a></li>
        <li><a href="https://github.com/FintechGuy71/FidesOrigin" target="_blank" rel="noopener">GitHub</a></li>
        <li><a href="/admin/dashboard">ダッシュボード</a></li>
      </ul>
    </aside>


    <div className="docs-content">
      <h1>API リファレンス <span className="docs-version">V2.1</span></h1>
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

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method get">GET</span>
          <code className="docs-endpoint-path">/address/&#123;address&#125;/risk</code>
        </div>
        <p>指定した Ethereum アドレスの最新リスクプロファイルを取得します。</p>
        <h4>クエリパラメータ</h4>
        <ul>
          <li><code>chainId</code>（オプション）— チェーン ID。デフォルトは 1（Ethereum）。<code>sepolia</code>（11155111）、<code>base</code>（8453）などをサポートします。</li>
          <li><code>amount</code>（オプション）— コンテキストを考慮した評価のための取引金額。</li>
        </ul>
        <h4>レスポンス</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
          </div>
          <pre><code>&#123;
  "address": "0x742d35cc6634c0532925a3b844bc9e7595f8deee",
  "chain": "ethereum",
  "risk_score": 12,
  "risk_level": "low",
  "scores": [
    &#123; "score": 12, "level": "low", "confidence": 0.85, "category": "overall" &#125;
  ],
  "risk_factors": [
    &#123; "name": "Behavioral Risk Pattern", "category": "Behavior", "severity": "low" &#125;
  ],
  "addressType": "wallet",
  "timestamp": "2026-08-07T15:23:00Z",
  "relatedEntities": [],
  "transactionStats": &#123;
    "totalTransactions": 3421,
    "totalVolume": 892000
  &#125;
&#125;</code></pre>
        </div>
      </div>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method get">GET</span>
          <code className="docs-endpoint-path">/risk/check</code>
        </div>
        <p>アドレスのリスクチェック用プロキシエンドポイント。Python バックエンドのリスクエンジンにプロキシします。</p>
        <h4>クエリパラメータ</h4>
        <ul>
          <li><code>address</code>（必須）— チェックする Ethereum アドレス。</li>
          <li><code>chainId</code>（オプション）— チェーン ID。デフォルトは 1。</li>
        </ul>
        <h4>レスポンス</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
          </div>
          <pre><code>&#123;
  "address": "0x742d35cc6634c0532925a3b844bc9e7595f8deee",
  "chain": "ethereum",
  "overallScore": 12,
  "overallLevel": "low",
  "scores": [&#123; "score": 12, "level": "low", "confidence": 0.85 &#125;],
  "flags": [],
  "addressType": "wallet",
  "timestamp": "2026-08-07T15:23:00Z"
&#125;</code></pre>
        </div>
      </div>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method post">POST</span>
          <code className="docs-endpoint-path">/address/search</code>
        </div>
        <p>1 回のリクエストで複数アドレスのリスクを一括チェックします。</p>
        <h4>リクエスト本文</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
          </div>
          <pre><code>&#123;
  "chainId": 1,
  "addresses": [
    "0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee",
    "0xdAC17F958D2ee523a2206206994597C13D831ec7"
  ],
  "amount": "1000000000000000000"
&#125;</code></pre>
        </div>
        <h4>レスポンス</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
          </div>
          <pre><code>&#123;
  "results": [
    &#123;
      "address": "0x742d35cc6634c0532925a3b844bc9e7595f8deee",
      "chain": "ethereum",
      "type": "wallet",
      "risk": &#123; "score": 12, "level": "low", "confidence": 0.85 &#125;,
      "flags": [],
      "assessedAt": "2026-08-07T15:23:00Z"
    &#125;
  ],
  "summary": &#123;
    "total": 2,
    "highRisk": 0,
    "mediumRisk": 0,
    "lowRisk": 2
  &#125;
&#125;</code></pre>
        </div>
      </div>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method post">POST</span>
          <code className="docs-endpoint-path">/rules</code>
        </div>
        <p>新しいコンプライアンスルールを作成します。</p>
        <h4>リクエスト本文</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
          </div>
          <pre><code>&#123;
  "name": "Flag High Risk Mixer",
  "description": "Flag transactions involving known mixer addresses",
  "conditions": [
    &#123; "field": "address.tags", "operator": "contains", "value": "mixer" &#125;
  ],
  "actions": [
    &#123; "type": "flag", "params": &#123; "reason": "Mixer interaction detected" &#125; &#125;
  ],
  "priority": 75
&#125;</code></pre>
        </div>
        <h4>レスポンス</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
          </div>
          <pre><code>&#123;
  "id": "rule_4",
  "name": "Flag High Risk Mixer",
  "description": "Flag transactions involving known mixer addresses",
  "status": "active",
  "priority": 75,
  "conditions": [...],
  "actions": [...],
  "createdAt": "2026-08-07T15:23:00Z",
  "updatedAt": "2026-08-07T15:23:00Z"
&#125;</code></pre>
        </div>
      </div>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method patch">PATCH</span>
          <code className="docs-endpoint-path">/rules/&#123;id&#125;</code>
        </div>
        <p>既存のコンプライアンスルールを更新します。</p>
      </div>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method delete">DELETE</span>
          <code className="docs-endpoint-path">/rules/&#123;id&#125;</code>
        </div>
        <p>コンプライアンスルールを削除します。</p>
      </div>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method get">GET</span>
          <code className="docs-endpoint-path">/monitor/stats</code>
        </div>
        <p>ダッシュボード統計（評価済みアドレス総数、リスク分布、コンプライアンス指標）を取得します。</p>
        <h4>レスポンス</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
          </div>
          <pre><code>&#123;
  "totalAddresses": 20483,
  "highRiskCount": 142,
  "mediumRiskCount": 891,
  "lowRiskCount": 19450,
  "lastUpdated": "2026-08-07T15:23:00Z"
&#125;</code></pre>
        </div>
      </div>

      <div className="docs-endpoint">
        <div className="docs-endpoint-header">
          <span className="docs-method get">GET</span>
          <code className="docs-endpoint-path">/monitor/stream</code>
        </div>
        <p>リアルタイムのリスク更新とアラートのための WebSocket エンドポイント。<code>wss://api.fidesorigin.com/api/v1/monitor/stream</code> に接続します。</p>
        <h4>イベント</h4>
        <ul>
          <li><code>risk.update</code> — アドレスのリスクスコア更新。</li>
          <li><code>alert.new</code> — 新規コンプライアンスアラート。</li>
          <li><code>rule.match</code> — ルールマッチイベント。</li>
          <li><code>connection.established</code> — 接続確認。</li>
        </ul>
      </div>

      <h2>Guard 連携（オンチェーン）</h2>
      <p>V2.1 では <strong>PreTransactionGuard</strong>（ゼロガスのトランザクション事前インターセプト層）を導入しました。Guard 操作は REST API ではなく、スマートコントラクト呼び出しによってオンチェーンで直接実行されます。Guard 連携には<a href="/docs/sdk#guard">オンチェーン SDK</a> をご利用ください。</p>

      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Solidity — Guard Interface</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>interface IPreTransactionGuard &#123;
    struct TransactionIntent &#123;
        address from;
        address to;
        uint256 value;
        address token;
        bytes data;
        uint256 chainId;
    &#125;

    enum Action &#123; ALLOW, WARN, BLOCK &#125;

    struct RiskAssessment &#123;
        Action action;
        uint256 riskScore;
        uint256 confidence;
        string reason;
        uint256 assessmentTime;
    &#125;

    function assessAddress(address addr) external view returns (RiskAssessment memory);
    function assessTransaction(TransactionIntent calldata intent) external view returns (RiskAssessment memory);
&#125;</code></pre>
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

      <h2>レート制限</h2>
      <p>API リクエストは<strong>IP アドレスごとに 1 分間 60 リクエスト</strong>に制限されています。WebSocket ストリームはこの制限にカウントされません。</p>
    </div>
  </div>
    </>
  );
}
