/* Auto-generated from public/blog/index.html — do not edit by hand. */
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
    .blog-cta {
      text-align: center;
      padding: 80px 40px;
    }
    .blog-cta .btn-primary {
      background: var(--accent);
      color: var(--bg);
      box-shadow: none;
    }
    .blog-cta .btn-primary:hover {
      background: var(--gold);
      transform: translateY(-1px);
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

export default function ContentBlogEN() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />

    
    <section className="blog-hero">
      <div className="glow glow-1"></div>
      <div className="container blog-hero-content">
        <div className="reveal">
          <p className="micro">Blog</p>
          <h1 className="display">Insights on programmable<br /><span>on-chain compliance</span></h1>
          <p className="lead" style={{ "maxWidth": "600px", "marginTop": "20px" }}>Deep dives into risk engines, DeFi regulation, and the architecture of deterministic compliance.</p>
        </div>
      </div>
    </section>

    <div className="hr-fade"></div>

    
    <section className="section" style={{ "paddingTop": "60px" }}>
      <div className="container">
        <div className="reveal">
          <a href="/blog/travel-rule-on-chain" className="blog-card">
            <div>
              <div style={{ "marginBottom": "8px" }}>
                <span className="tag">Regulation</span>
                <span className="date">August 2026</span>
              </div>
              <h2>The Travel Rule On-Chain: What FATF Requires from Stablecoin Transfers</h2>
              <p>FATF Travel Rule requirements for stablecoin transfers in 2026, and why on-chain enforcement beats API-centric screening.</p>
            </div>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" /></svg>
          </a>
        </div>

        <div className="reveal" style={{ "marginTop": "16px" }}>
          <a href="/blog/hong-kong-stablecoin-license" className="blog-card">
            <div>
              <div style={{ "marginBottom": "8px" }}>
                <span className="tag">Regulation</span>
                <span className="date">July 2026</span>
              </div>
              <h2>Hong Kong Stablecoin License: Compliance Requirements</h2>
              <p>Guide to Hong Kong's stablecoin issuer licensing regime. HKMA requirements, reserve management, and on-chain compliance for VASPs.</p>
            </div>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" /></svg>
          </a>
        </div>

        <div className="reveal" style={{ "marginTop": "16px" }}>
          <a href="/blog/mica-stablecoin-compliance" className="blog-card">
            <div>
              <div style={{ "marginBottom": "8px" }}>
                <span className="tag">Regulation</span>
                <span className="date">July 2026</span>
              </div>
              <h2>MiCA Compliance for Stablecoins: A Technical Guide</h2>
              <p>Technical guide to EU MiCA compliance for stablecoin issuers. On-chain reserve attestations, transaction screening, and regulatory reporting.</p>
            </div>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" /></svg>
          </a>
        </div>

        <div className="reveal" style={{ "marginTop": "16px" }}>
          <a href="/blog/why-on-chain-compliance" className="blog-card">
            <div>
              <div style={{ "marginBottom": "8px" }}>
                <span className="tag">Category Definition</span>
                <span className="date">June 2026</span>
              </div>
              <h2>Why On-Chain: The End of API-Based Compliance</h2>
              <p>Why screening transactions through off-chain APIs is structurally broken — and what "on-chain risk enforcement" means for digital asset infrastructure.</p>
            </div>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" /></svg>
          </a>
        </div>
      </div>
    </section>
  
    </>
  );
}
