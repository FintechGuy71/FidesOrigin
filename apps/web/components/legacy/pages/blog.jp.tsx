/* Auto-generated from public/jp/blog/index.html — do not edit by hand. */
const PAGE_CSS = `
/* Blog page-specific styles */
    .blog-hero {
      position: relative;
      padding: 160px 0 60px;
      overflow: hidden;
    }
    .blog-hero .glow {
      position: absolute;
      border-radius: 50%;
      filter: blur(100px);
      opacity: 0.08;
      pointer-events: none;
    }
    .blog-hero .glow-1 {
      width: 400px; height: 400px;
      background: var(--accent);
      top: -100px; right: -100px;
    }
    .blog-hero-content {
      position: relative;
      z-index: var(--z-content);
    }
    .blog-hero .display {
      font-size: clamp(2rem, 4.5vw, 3.2rem);
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -0.03em;
    }
    .blog-hero .display span {
      background: linear-gradient(135deg, var(--gold-bright) 0%, var(--gold) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hr-fade {
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--fio-border-light), transparent);
      margin: 0 auto;
      max-width: 800px;
    }
    .blog-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 24px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      transition: all 0.3s ease;
    }
    .blog-card:hover {
      border-color: var(--border-light);
      background: var(--bg-card-hover);
      transform: translateY(-2px);
    }
    .blog-card h2 {
      font-size: 1.125rem;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--text);
    }
    .blog-card p {
      font-size: 0.875rem;
      color: var(--text-secondary);
      line-height: 1.6;
    }
    .blog-card .tag {
      display: inline-block;
      font-size: 0.625rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--accent);
      padding: 2px 8px;
      border-radius: 4px;
      background: var(--accent-dim);
      margin-right: 8px;
    }
    .blog-card .date {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .blog-card svg {
      width: 20px; height: 20px;
      color: var(--text-muted);
      flex-shrink: 0;
    }
    @media (max-width: 600px) {
      .blog-card { flex-direction: column; align-items: flex-start; }
      .blog-hero { padding: 120px 0 40px; }
    }

    .blog-card:focus, .blog-card:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
      border-radius: 12px;
    }
`;

export default function ContentBlogJP() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    
    <section className="blog-hero">
      <div className="glow glow-1"></div>
      <div className="container blog-hero-content">
        <div className="reveal">
          <p className="micro">ブログ</p>
          <h1 className="display">プログラマブルな<br /><span>オンチェーンコンプライアンス</span>の洞察</h1>
          <p className="lead" style={{ "maxWidth": "600px", "marginTop": "20px" }}>リスクエンジン、DeFi 規制、決定論的コンプライアンスのアーキテクチャを深掘りします。</p>
        </div>
      </div>
    </section>

    <div className="hr-fade"></div>

    
    <section className="section" style={{ "paddingTop": "60px" }}>
      <div className="container">
        <div className="reveal">
          <a href="/jp/blog/why-on-chain-compliance" className="blog-card">
            <div>
              <div style={{ "marginBottom": "8px" }}>
                <span className="tag">カテゴリー定義</span>
                <span className="date">2026年6月</span>
              </div>
              <h2>なぜオンチェーンか：API ベースコンプライアンスの終焉</h2>
              <p>API ベースのコンプライアンスはアーキテクチャ的な誤りだ。未来はオンチェーンリスクエンフォースメント：決定論的、ゼロレイテンシー、迂回不可能。</p>
            </div>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" /></svg>
          </a>
        </div>

        <div className="reveal" style={{ "marginTop": "16px" }}>
          <a href="/blog" className="blog-card">
            <div>
              <div style={{ "marginBottom": "8px" }}>
                <span className="tag">English</span>
                <span className="date">2026年7月</span>
              </div>
              <h2>その他の記事（英語版）</h2>
              <p>香港ステーブルコインライセンスのコンプライアンス要件、MiCA 技術ガイドなど、さらに詳しい記事は英語ブログをご覧ください。</p>
            </div>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" /></svg>
          </a>
        </div>
      </div>
    </section>
  
    </>
  );
}
