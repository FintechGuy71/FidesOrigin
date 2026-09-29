/* Auto-generated from public/jp/docs/api.html — do not edit by hand. */
import Link from "next/link";

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
        <li><Link href="/jp/docs" prefetch={false}>概要</Link></li>
        <li><Link href="/jp/docs/api" className="active" prefetch={false}>API リファレンス</Link></li>
        <li><Link href="/jp/docs/sdk" prefetch={false}>SDK</Link></li>
      </ul>
      <div className="docs-sidebar-title">リソース</div>
      <ul className="docs-nav-tree">
        <li><Link href="/jp/blog" prefetch={false}>ブログ</Link></li>
        <li><a href="https://github.com/FintechGuy71/FidesOrigin" target="_blank" rel="noopener">GitHub</a></li>
        <li><Link href="/admin/dashboard" prefetch={false}>ダッシュボード</Link></li>
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
        <h4>クエリパラメータ</h4>
        <ul>
          <li><code>status</code>（任意）— ステータスで絞り込み：<code>active</code>、<code>inactive</code>、<code>draft</code>。</li>
          <li><code>limit</code>（任意）— 1 ページあたりの件数、最大 100、デフォルト 50。</li>
          <li><code>offset</code>（任意）— ページネーションのオフセット、デフォルト 0。</li>
        </ul>
        <h4>レスポンス</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
          </div>
          <pre><code>&#123;
{"\n  "}"rules": [
{"\n    "}&#123;
{"\n      "}"id": "rule_1",
{"\n      "}"name": "Block Critical Risk Addresses",
{"\n      "}"description": "Automatically block transactions to addresses with critical risk score",
{"\n      "}"status": "active",
{"\n      "}"priority": 100,
{"\n      "}"conditions": [&#123; "field": "risk.score", "operator": "greater_than", "value": 90 &#125;],
{"\n      "}"actions": [&#123; "type": "block", "params": &#123; "reason": "Critical risk score exceeded" &#125; &#125;],
{"\n      "}"createdAt": "2026-08-01T10:00:00Z",
{"\n      "}"updatedAt": "2026-08-01T10:00:00Z"
{"\n    "}&#125;
{"\n  "}],
{"\n  "}"total": 3,
{"\n  "}"page": 1,
{"\n  "}"limit": 50
{"\n"}&#125;</code></pre>
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
          <li><code>amount</code>（オプション）— 予約フィールド：前方互換のため受け付けますが、現在は評価に使用されません。</li>
        </ul>
        <h4>レスポンス</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
          </div>
          <pre><code>&#123;
{"\n  "}"address": "0x742d35cc6634c0532925a3b844bc9e7595f8deee",
{"\n  "}"chain": "ethereum",
{"\n  "}"risk_score": 12,
{"\n  "}"risk_level": "low",
{"\n  "}"scores": [
{"\n    "}&#123; "score": 12, "level": "low", "confidence": 0.85, "category": "overall" &#125;
{"\n  "}],
{"\n  "}"risk_factors": [
{"\n    "}&#123; "name": "Behavioral Risk Pattern", "category": "Behavior", "severity": "low" &#125;
{"\n  "}],
{"\n  "}"addressType": "wallet",
{"\n  "}"timestamp": "2026-08-07T15:23:00Z",
{"\n  "}"relatedEntities": [],
{"\n  "}"transactionStats": &#123;
{"\n    "}"totalTransactions": 3421,
{"\n    "}"totalVolume": 892000
{"\n  "}&#125;
{"\n"}&#125;</code></pre>
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
{"\n  "}"address": "0x742d35cc6634c0532925a3b844bc9e7595f8deee",
{"\n  "}"chain": "ethereum",
{"\n  "}"overallScore": 12,
{"\n  "}"overallLevel": "low",
{"\n  "}"scores": [&#123; "score": 12, "level": "low", "confidence": 0.85 &#125;],
{"\n  "}"flags": [],
{"\n  "}"addressType": "wallet",
{"\n  "}"timestamp": "2026-08-07T15:23:00Z"
{"\n"}&#125;</code></pre>
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
{"\n  "}"chainId": 1,
{"\n  "}"addresses": [
{"\n    "}"0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee",
{"\n    "}"0xdAC17F958D2ee523a2206206994597C13D831ec7"
{"\n  "}],
{"\n  "}"amount": "1000000000000000000"
{"\n"}&#125;</code></pre>
        </div>
        <h4>レスポンス</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
          </div>
          <pre><code>&#123;
{"\n  "}"results": [
{"\n    "}&#123;
{"\n      "}"address": "0x742d35cc6634c0532925a3b844bc9e7595f8deee",
{"\n      "}"chain": "ethereum",
{"\n      "}"type": "wallet",
{"\n      "}"risk": &#123; "score": 12, "level": "low", "confidence": 0.85 &#125;,
{"\n      "}"flags": [],
{"\n      "}"assessedAt": "2026-08-07T15:23:00Z"
{"\n    "}&#125;
{"\n  "}],
{"\n  "}"summary": &#123;
{"\n    "}"total": 2,
{"\n    "}"highRisk": 0,
{"\n    "}"mediumRisk": 0,
{"\n    "}"lowRisk": 2
{"\n  "}&#125;
{"\n"}&#125;</code></pre>
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
{"\n  "}"name": "Flag High Risk Mixer",
{"\n  "}"description": "Flag transactions involving known mixer addresses",
{"\n  "}"conditions": [
{"\n    "}&#123; "field": "address.tags", "operator": "contains", "value": "mixer" &#125;
{"\n  "}],
{"\n  "}"actions": [
{"\n    "}&#123; "type": "flag", "params": &#123; "reason": "Mixer interaction detected" &#125; &#125;
{"\n  "}],
{"\n  "}"priority": 75
{"\n"}&#125;</code></pre>
        </div>
        <h4>レスポンス</h4>
        <div className="docs-code-block">
          <div className="docs-code-header">
            <span>JSON</span>
            <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
          </div>
          <pre><code>&#123;
{"\n  "}"id": "rule_4",
{"\n  "}"name": "Flag High Risk Mixer",
{"\n  "}"description": "Flag transactions involving known mixer addresses",
{"\n  "}"status": "active",
{"\n  "}"priority": 75,
{"\n  "}"conditions": [...],
{"\n  "}"actions": [...],
{"\n  "}"createdAt": "2026-08-07T15:23:00Z",
{"\n  "}"updatedAt": "2026-08-07T15:23:00Z"
{"\n"}&#125;</code></pre>
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
{"\n  "}"totalAddresses": 20483,
{"\n  "}"highRiskCount": 142,
{"\n  "}"mediumRiskCount": 891,
{"\n  "}"lowRiskCount": 19450,
{"\n  "}"lastUpdated": "2026-08-07T15:23:00Z"
{"\n"}&#125;</code></pre>
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
      <p>V2.1 では <strong>PreTransactionGuard</strong>（ゼロガスのトランザクション事前インターセプト層）を導入しました。Guard 操作は REST API ではなく、スマートコントラクト呼び出しによってオンチェーンで直接実行されます。Guard 連携には<Link href="/jp/docs/sdk#guard" prefetch={false}>オンチェーン SDK</Link> をご利用ください。</p>

      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Solidity — Guard Interface</span>
          <button className="docs-code-copy" aria-label="コードをコピー">コピー</button>
        </div>
        <pre><code>interface IPreTransactionGuard &#123;
{"\n    "}struct TransactionIntent &#123;
{"\n        "}address from;
{"\n        "}address to;
{"\n        "}uint256 value;
{"\n        "}address token;
{"\n        "}bytes data;
{"\n        "}uint256 chainId;
{"\n    "}&#125;
{"\n"}
{"\n    "}enum Action &#123; ALLOW, WARN, BLOCK &#125;
{"\n"}
{"\n    "}struct RiskAssessment &#123;
{"\n        "}Action action;
{"\n        "}uint256 riskScore;
{"\n        "}uint256 confidence;
{"\n        "}string reason;
{"\n        "}uint256 assessmentTime;
{"\n    "}&#125;
{"\n"}
{"\n    "}function assessAddress(address addr) external view returns (RiskAssessment memory);
{"\n    "}function assessTransaction(TransactionIntent calldata intent) external view returns (RiskAssessment memory);
{"\n"}&#125;</code></pre>
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
            <tr><td><code>403</code></td><td>Forbidden</td><td>状態変更リクエストの CSRF オリジンが許可されていません</td></tr>
            <tr><td><code>404</code></td><td>Not Found</td><td>アドレスまたはリソースが見つからない</td></tr>
            <tr><td><code>429</code></td><td>Rate Limited</td><td>リクエストが多すぎます（IP ごとに毎分 60 回）</td></tr>
            <tr><td><code>500</code></td><td>Server Error</td><td>内部サーバーエラー</td></tr>
            <tr><td><code>502</code></td><td>Bad Gateway</td><td>バックエンドプロキシが利用不可</td></tr>
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
