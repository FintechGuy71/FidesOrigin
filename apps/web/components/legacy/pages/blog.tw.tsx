/* Auto-generated from public/tw/blog/index.html — do not edit by hand. */
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

export default function ContentBlogTW() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    
    <section className="blog-hero">
      <div className="glow glow-1"></div>
      <div className="container blog-hero-content">
        <div className="reveal">
          <p className="micro">博客</p>
          <h1 className="display">可編程鏈上合規的<br /><span>深度洞察</span></h1>
          <p className="lead" style={{ "maxWidth": "600px", "marginTop": "20px" }}>風險引擎、DeFi 監管與確定性合規架構的深度解析。</p>
        </div>
      </div>
    </section>

    <div className="hr-fade"></div>

    
    <section className="section" style={{ "paddingTop": "60px" }}>
      <div className="container">
        <div className="reveal">
          <a href="/tw/blog/why-on-chain-compliance" className="blog-card">
            <div>
              <div style={{ "marginBottom": "8px" }}>
                <span className="tag">概念定義</span>
                <span className="date">2026 年 6 月</span>
              </div>
              <h2>為何鏈上：API 合規模式的終結</h2>
              <p>基於 API 的合規是一種架構層面的錯誤。未來屬於鏈上風險執行：確定性、零延遲、無法繞過的原生執行。</p>
            </div>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" /></svg>
          </a>
        </div>

        <div className="reveal" style={{ "marginTop": "16px" }}>
          <a href="/blog" className="blog-card">
            <div>
              <div style={{ "marginBottom": "8px" }}>
                <span className="tag">English</span>
                <span className="date">2026 年 7 月</span>
              </div>
              <h2>更多文章（英文版）</h2>
              <p>香港穩定幣牌照合規要求、MiCA 穩定幣合規技術指南等更多深度文章，請訪問英文博客。</p>
            </div>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" /></svg>
          </a>
        </div>
      </div>
    </section>
  
    </>
  );
}
