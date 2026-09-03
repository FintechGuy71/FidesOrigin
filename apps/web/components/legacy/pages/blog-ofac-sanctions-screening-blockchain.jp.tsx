/* Auto-generated from public/jp/blog/ofac-sanctions-screening-blockchain.html — do not edit by hand. */
const PAGE_CSS = `
.blog-article { padding: 140px 0 60px; }
    .blog-article .container { max-width: 800px; }
    .blog-article h1 { font-size: clamp(1.8rem, 4vw, 2.5rem); font-weight: 700; line-height: 1.2; margin-bottom: 16px; }
    .blog-meta { display: flex; align-items: center; gap: 16px; margin-bottom: 32px; color: var(--text-muted); font-size: 0.875rem; }
    .blog-meta .tag { background: var(--accent-dim); color: var(--accent); padding: 2px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
    .blog-content h2 { font-size: 1.4rem; font-weight: 600; margin: 48px 0 20px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
    .blog-content h3 { font-size: 1.1rem; font-weight: 600; margin: 32px 0 12px; color: var(--accent); }
    .blog-content p { color: var(--text-secondary); line-height: 1.8; margin-bottom: 20px; }
    .blog-content ul, .blog-content ol { color: var(--text-secondary); line-height: 1.8; margin-bottom: 20px; padding-left: 24px; }
    .blog-content li { margin-bottom: 8px; }
    .blog-content code { font-family: var(--font-mono); font-size: 0.85em; background: var(--bg-elevated); padding: 2px 6px; border-radius: 4px; color: var(--accent); }
    .blog-content blockquote { border-left: 3px solid var(--accent); padding-left: 20px; margin: 24px 0; color: var(--text-secondary); font-style: italic; }
    .blog-nav { display: flex; justify-content: space-between; margin-top: 48px; padding-top: 32px; border-top: 1px solid var(--border); }
    .blog-nav a { color: var(--accent); font-size: 0.875rem; }
`;

export default function ContentBlogOfacSanctionsScreeningBlockchainJP() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    <article className="blog-article">
      <div className="container">
        <div className="reveal">
          <p className="micro">ブログ</p>
          <h1>ブロックチェーン上の OFAC サンクション（制裁）スクリーニング：ベストプラクティス</h1>
          <div className="blog-meta">
            <span>2026年7月</span>
            <span className="tag">コンプライアンス</span>
            <span>7分で読めます</span>
          </div>
        </div>

        <div className="blog-content reveal">
          <p>米国外資産管理局（OFAC）は、特別指定国民（SDN）リストを管理しています。これは米国人による取引が禁じられた個人・団体・アドレスのリストです。ブロックチェーンプロトコルにとって、これは従来の金融機関には存在しない独自の課題を生み出します。</p>

          <h2>オンチェーン・サンクションスクリーニングの課題</h2>

          <p>トランザクションが仲介機関を経由する従来の金融とは異なり、ブロックチェーンのトランザクションはピアツーピアです。決済前にトランザクションを差し止める銀行は存在しません。そのため、コンプライアンスはプロトコルレベルに組み込む必要があります。</p>

          <ul>
            <li><strong>取引前スクリーニング：</strong>すべての送金は実行前に評価しなければならない</li>
            <li><strong>ノンカストディアル環境：</strong>資金を保有したりアクセスを制御したりする中央権限が存在しない</li>
            <li><strong>匿名性：</strong>アドレスは現実のアイデンティティと 1 対 1 で対応しない</li>
            <li><strong>非可逆性：</strong>一度トランザクションが承認されると取り消せない</li>
          </ul>

          <h2>ベストプラクティス #1：オンチェーンエンフォースメント</h2>

          <p>最も堅牢なアプローチは、サンクションスクリーニングをスマートコントラクトに直接組み込むことです。これにより以下が保証されます。</p>

          <ol>
            <li><strong>決定論性：</strong>すべてのトランザクションが同一のルールでスクリーニングされる</li>
            <li><strong>迂回不可：</strong>コントラクトの直接呼び出しでもコンプライアンスチェックがトリガーされる</li>
            <li><strong>監査可能性：</strong>スクリーニングの判定はオンチェーンに恒久的に記録される</li>
            <li><strong>可用性：</strong>障害を起こしうる外部 API に依存しない</li>
          </ol>

          <h2>ベストプラクティス #2：二値ブロックではなくリスクティア</h2>

          <p>高度なアプローチでは、単純な許可/ブロックではなくリスクティアを使用します。</p>

          <ul>
            <li><strong>UNKNOWN：</strong>履歴のない新規アドレス — 追加の検証を要求</li>
            <li><strong>LOW：</strong>フラグなし — 標準的な制限の範囲内で許可</li>
            <li><strong>MEDIUM：</strong>いくつかのリスク指標 — 強化されたモニタリング</li>
            <li><strong>HIGH：</strong>重大なリスク — 手動レビューのために隔離</li>
            <li><strong>CRITICAL：</strong>サンクション（制裁）対象に一致 — ブロックして警告を発報</li>
          </ul>

          <h2>ベストプラクティス #3：データの鮮度を保つ</h2>

          <p>OFAC は SDN リストを定期的に更新しています。オンチェーンのレジストリは自律的に更新される必要があります。FidesOrigin は Chainlink Functions を使用して最新のサンクションデータを取得し、手動介入なしでオンチェーンの RiskRegistry を更新します。</p>

          <h2>ベストプラクティス #4：ブロックよりも隔離</h2>

          <p>トランザクションを完全にブロックする（これはユーザー体験上の問題や誤検知を生みうる）代わりに、隔離メカニズムを検討してください。</p>

          <blockquote>「隔離ヴォールトは、疑わしい資金を即座に拒否するのではなく、レビューのために保有します。これにより、コンプライアンスを維持しながら誤検知を削減します。」</blockquote>

          <h2>結論</h2>

          <p>ブロックチェーンにおける OFAC コンプライアンスは選択肢ではありません。米国人にサービスを提供する、または米国内で事業を行うすべてのプロトコルにとって法的要件です。問題は、コンプライアンスを満たすかどうかではなく、分散性の利点を損なわずにどう実現するかです。その答えがオンチェーンエンフォースメントです。</p>
        </div>

        <div className="blog-nav reveal">
          <a href="/jp/blog">← 記事一覧</a>
          <a href="/jp/blog/hong-kong-stablecoin-license">次: 中国香港ライセンス →</a>
        </div>
      </div>
    </article>
  
    </>
  );
}
