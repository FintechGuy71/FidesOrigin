/* Auto-generated from public/tw/blog/index.html — do not edit by hand. */
import Link from "next/link";

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
      color: var(--accent-light);
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

    .blog-thumb {
      width: 190px;
      aspect-ratio: 1200 / 630;
      object-fit: cover;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      flex-shrink: 0;
      align-self: center;
    }
    @media (max-width: 600px) {
      .blog-thumb { width: 100%; }
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
          <p className="micro">部落格</p>
          <h1 className="display">可編程鏈上合規的<br /><span>深度洞察</span></h1>
          <p className="lead" style={{ "maxWidth": "600px", "marginTop": "20px" }}>風險引擎、DeFi 監管與確定性合規架構的深度解析。</p>
        </div>
      </div>
    </section>

    <div className="hr-fade"></div>

    
    <section className="section" style={{ "paddingTop": "60px" }}>
      <div className="container">
        <div className="reveal">
          <Link href="/tw/blog/travel-rule-on-chain" className="blog-card" prefetch={false}>
            <img className="blog-thumb" src="/brand/covers/travel-rule-on-chain.png" alt="" loading="lazy" />
            <div>
              <div style={{ "marginBottom": "8px" }}>
                <span className="tag">監管</span>
                <span className="date">2026 年 8 月</span>
              </div>
              <h2>鏈上旅行規則：FATF 對穩定幣轉帳的要求</h2>
              <p>2026 年穩定幣轉帳的 FATF 旅行規則要求，以及結算前合規中鏈上執行為何優於 API 中心化篩查。</p>
            </div>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" /></svg>
          </Link>
        </div>

        <div className="reveal" style={{ "marginTop": "16px" }}>
          <Link href="/tw/blog/why-on-chain-compliance" className="blog-card" prefetch={false}>
            <img className="blog-thumb" src="/brand/covers/why-on-chain-compliance.png" alt="" loading="lazy" />
            <div>
              <div style={{ "marginBottom": "8px" }}>
                <span className="tag">概念定義</span>
                <span className="date">2026 年 6 月</span>
              </div>
              <h2>為何鏈上：API 合規模式的終結</h2>
              <p>基於 API 的合規是一種架構層面的錯誤。未來屬於鏈上風險執行：確定性、零延遲、無法繞過的原生執行。</p>
            </div>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" /></svg>
          </Link>
        </div>
        <div className="reveal" style={{ "marginTop": "16px" }}>
          <Link href="/tw/blog/ofac-sanctions-screening-blockchain" className="blog-card" prefetch={false}>
            <img className="blog-thumb" src="/brand/covers/ofac-sanctions-screening-blockchain.png" alt="" loading="lazy" />
            <div>
              <div style={{ "marginBottom": "8px" }}>
                <span className="tag">合規</span>
                <span className="date">2026 年 7 月</span>
              </div>
              <h2>區塊鏈上的 OFAC 制裁篩查：最佳實踐</h2>
              <p>如何為穩定幣與 DeFi 協議在智能合約層實現 SDN 名單篩查的最佳實踐。</p>
            </div>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" /></svg>
          </Link>
        </div>
        <div className="reveal" style={{ "marginTop": "16px" }}>
          <Link href="/tw/blog/hong-kong-stablecoin-license" className="blog-card" prefetch={false}>
            <img className="blog-thumb" src="/brand/covers/hong-kong-stablecoin-license.png" alt="" loading="lazy" />
            <div>
              <div style={{ "marginBottom": "8px" }}>
                <span className="tag">監管</span>
                <span className="date">2026 年 7 月</span>
              </div>
              <h2>中國香港穩定幣牌照：合規要求</h2>
              <p>中國香港穩定幣發行方牌照制度指南：HKMA 要求、儲備資產管理，以及面向 VASP 的鏈上合規。</p>
            </div>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" /></svg>
          </Link>
        </div>
        <div className="reveal" style={{ "marginTop": "16px" }}>
          <Link href="/tw/blog/mica-stablecoin-compliance" className="blog-card" prefetch={false}>
            <img className="blog-thumb" src="/brand/covers/mica-stablecoin-compliance.png" alt="" loading="lazy" />
            <div>
              <div style={{ "marginBottom": "8px" }}>
                <span className="tag">監管</span>
                <span className="date">2026 年 7 月</span>
              </div>
              <h2>穩定幣的 MiCA 合規：技術指南</h2>
              <p>面向穩定幣發行方的歐盟 MiCA 合規技術指南：鏈上儲備證明、交易篩查與監管報告要求。</p>
            </div>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" /></svg>
          </Link>
        </div>
      </div>
    </section>
  
    </>
  );
}
