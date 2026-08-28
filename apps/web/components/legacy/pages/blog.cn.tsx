/* Auto-generated from public/cn/blog/index.html — do not edit by hand. */
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
      z-index: 1;
    }
    .blog-hero .display {
      font-size: clamp(2rem, 4.5vw, 3.2rem);
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -0.03em;
    }
    .blog-hero .display span {
      background: linear-gradient(135deg, var(--accent) 0%, var(--gold) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hr-fade {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
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
    @media (max-width: 640px) {
      .blog-card { flex-direction: column; align-items: flex-start; }
      .blog-hero { padding: 120px 0 40px; }
    }

    .blog-card:focus, .blog-card:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
      border-radius: 12px;
    }
`;

export default function ContentBlogCN() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />

    
    <section className="blog-hero">
      <div className="glow glow-1"></div>
      <div className="container blog-hero-content">
        <div className="reveal">
          <p className="micro">博客</p>
          <h1 className="display">可编程链上合规的<br /><span>深度洞察</span></h1>
          <p className="lead" style={{ "maxWidth": "600px", "marginTop": "20px" }}>风险引擎、DeFi 监管与确定性合规架构的深度解析。</p>
        </div>
      </div>
    </section>

    <div className="hr-fade"></div>

    
    <section className="section" style={{ "paddingTop": "60px" }}>
      <div className="container">
        <div className="reveal">
          <a href="/cn/blog/why-on-chain-compliance" className="blog-card">
            <div>
              <div style={{ "marginBottom": "8px" }}>
                <span className="tag">概念定义</span>
                <span className="date">2026 年 6 月</span>
              </div>
              <h2>为何链上：API 合规模式的终结</h2>
              <p>基于 API 的合规是一种架构层面的错误。未来属于链上风险执行：确定性、零延迟、无法绕过的原生执行。</p>
            </div>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" /></svg>
          </a>
        </div>

        <div className="reveal" style={{ "marginTop": "16px" }}>
          <a href="/cn/blog" className="blog-card">
            <div>
              <div style={{ "marginBottom": "8px" }}>
                <span className="tag">English</span>
                <span className="date">2026 年 7 月</span>
              </div>
              <h2>更多文章（英文版）</h2>
              <p>香港稳定币牌照合规要求、MiCA 稳定币合规技术指南等更多深度文章，请访问英文博客。</p>
            </div>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" /></svg>
          </a>
        </div>
      </div>
    </section>
  
    </>
  );
}
