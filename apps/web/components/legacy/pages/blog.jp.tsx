/* Auto-generated from public/jp/blog/index.html — do not edit by hand. */
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
          <Link href="/jp/blog/why-on-chain-compliance" className="blog-card" prefetch={false}>
            <img className="blog-thumb" src="/brand/covers/why-on-chain-compliance.png" alt="" loading="lazy" />
            <div>
              <div style={{ "marginBottom": "8px" }}>
                <span className="tag">カテゴリー定義</span>
                <span className="date">2026年6月</span>
              </div>
              <h2>なぜオンチェーンか：API ベースコンプライアンスの終焉</h2>
              <p>API ベースのコンプライアンスはアーキテクチャ的な誤りだ。未来はオンチェーンリスクエンフォースメント：決定論的、ゼロレイテンシー、迂回不可能。</p>
            </div>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" /></svg>
          </Link>
        </div>

        <div className="reveal" style={{ "marginTop": "16px" }}>
          <Link href="/jp/blog/travel-rule-on-chain" className="blog-card" prefetch={false}>
            <img className="blog-thumb" src="/brand/covers/travel-rule-on-chain.png" alt="" loading="lazy" />
            <div>
              <div style={{ "marginBottom": "8px" }}>
                <span className="tag">規制</span>
                <span className="date">2026年8月</span>
              </div>
              <h2>オンチェーンのトラベルルール：FATF がステーブルコイン送金に求めるもの</h2>
              <p>2026 年のステーブルコイン送金における FATF トラベルルール要件と、決済前コンプライアンスにおいてオンチェーン実行が API セントリックなスクリーニングに勝る理由。</p>
            </div>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" /></svg>
          </Link>
        </div>
        <div className="reveal" style={{ "marginTop": "16px" }}>
          <Link href="/jp/blog/ofac-sanctions-screening-blockchain" className="blog-card" prefetch={false}>
            <img className="blog-thumb" src="/brand/covers/ofac-sanctions-screening-blockchain.png" alt="" loading="lazy" />
            <div>
              <div style={{ "marginBottom": "8px" }}>
                <span className="tag">コンプライアンス</span>
                <span className="date">2026年7月</span>
              </div>
              <h2>ブロックチェーン上の OFAC サンクションスクリーニング：ベストプラクティス</h2>
              <p>ステーブルコインと DeFi プロトコル向けに、スマートコントラクトレベルで SDN リストチェックを実装するベストプラクティス。</p>
            </div>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" /></svg>
          </Link>
        </div>
        <div className="reveal" style={{ "marginTop": "16px" }}>
          <Link href="/jp/blog/hong-kong-stablecoin-license" className="blog-card" prefetch={false}>
            <img className="blog-thumb" src="/brand/covers/hong-kong-stablecoin-license.png" alt="" loading="lazy" />
            <div>
              <div style={{ "marginBottom": "8px" }}>
                <span className="tag">規制</span>
                <span className="date">2026年7月</span>
              </div>
              <h2>中国香港ステーブルコインライセンス：コンプライアンス要件</h2>
              <p>中国香港のステーブルコイン発行者ライセンス制度ガイド：HKMA の要件、準備資産管理、VASP 向けオンチェーンコンプライアンス。</p>
            </div>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" /></svg>
          </Link>
        </div>
        <div className="reveal" style={{ "marginTop": "16px" }}>
          <Link href="/jp/blog/mica-stablecoin-compliance" className="blog-card" prefetch={false}>
            <img className="blog-thumb" src="/brand/covers/mica-stablecoin-compliance.png" alt="" loading="lazy" />
            <div>
              <div style={{ "marginBottom": "8px" }}>
                <span className="tag">規制</span>
                <span className="date">2026年7月</span>
              </div>
              <h2>ステーブルコインの MiCA コンプライアンス：技術ガイド</h2>
              <p>ステーブルコイン発行者向け EU MiCA コンプライアンスの技術ガイド：オンチェーン準備資産証明、トランザクションスクリーニング、規制報告要件。</p>
            </div>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" /></svg>
          </Link>
        </div>
      </div>
    </section>
  
    </>
  );
}
