/* Auto-generated from public/tw/pricing.html — do not edit by hand. */
const PAGE_CSS = `
.pricing-hero { padding: 140px 0 60px; text-align: center; }
    .pricing-hero .display { font-size: clamp(2rem, 4.5vw, 3.2rem); }
    .pricing-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      margin-top: 48px;
    }
    .pricing-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 40px 32px;
      position: relative;
      transition: all 0.3s ease;
    }
    .pricing-card:hover { border-color: var(--border-light); transform: translateY(-4px); }
    .pricing-card.featured {
      border-color: var(--accent);
      background: linear-gradient(180deg, var(--bg-card) 0%, var(--accent-glow) 100%);
    }
    .pricing-card.featured::before {
      content: '最受歡迎';
      position: absolute;
      top: -1px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--accent);
      color: var(--bg);
      padding: 4px 16px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-radius: 0 0 var(--radius-sm) var(--radius-sm);
    }
    .pricing-name { font-size: 1.25rem; font-weight: 600; margin-bottom: 8px; }
    .pricing-desc { font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 24px; }
    .pricing-price { font-size: 3rem; font-weight: 800; letter-spacing: -0.03em; }
    .pricing-price span { font-size: 1rem; font-weight: 400; color: var(--text-muted); }
    .pricing-features { list-style: none; padding: 0; margin: 32px 0; }
    .pricing-features li {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      font-size: 0.875rem;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--fio-border-hairline);
    }
    .pricing-features li:last-child { border-bottom: none; }
    .pricing-features svg { width: 16px; height: 16px; color: var(--accent); flex-shrink: 0; }
    .pricing-features .missing { color: var(--text-muted); }
    .pricing-features .missing svg { color: var(--text-muted); }
    .pricing-cta { width: 100%; text-align: center; justify-content: center; }
    .pricing-note {
      text-align: center;
      margin-top: 48px;
      padding: 24px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
    }
    .pricing-note p { color: var(--text-secondary); font-size: 0.875rem; margin: 0; }
    .pricing-note a { color: var(--accent); }
    .compare-table-wrap { overflow-x: auto; margin-top: 48px; }
    .compare-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .compare-table th {
      text-align: left;
      padding: 16px;
      color: var(--text);
      font-weight: 600;
      border-bottom: 1px solid var(--border);
      background: var(--bg-card);
    }
    .compare-table td {
      padding: 14px 16px;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--border);
    }
    .compare-table tr:hover td { background: var(--bg-elevated); }
    .compare-table .check { color: var(--success); }
    .compare-table .dash { color: var(--text-muted); }
    @media (max-width: 900px) {
      .pricing-grid { grid-template-columns: 1fr; max-width: 400px; margin-left: auto; margin-right: auto; }
    }
`;

export default function ContentPricingTW() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    
    <section className="pricing-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">定價</p>
          <h1 className="display">簡單透明的<span>定價</span></h1>
          <p className="lead" style={{ "maxWidth": "600px", "margin": "20px auto 0" }}>免費起步，隨業務成長擴展。無隱藏費用、無長期合約。</p>
        </div>
      </div>
    </section>

    
    <section className="section" style={{ "paddingTop": "0" }}>
      <div className="container">
        <div className="pricing-grid">
          
          <div className="pricing-card reveal">
            <div className="pricing-name">Starter</div>
            <div className="pricing-desc">適合開發者與小型專案</div>
            <div className="pricing-price">$0<span>/月</span></div>
            <ul className="pricing-features">
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 每月 1,000 次 API 呼叫</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Sepolia 測試網存取</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 社群支援</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 基礎風險篩查</li>
              <li className="missing"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> 主網部署</li>
              <li className="missing"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> 自訂策略</li>
            </ul>
            <a href="/tw/docs" className="btn btn-secondary pricing-cta">免費開始</a>
          </div>

          
          <div className="pricing-card featured reveal">
            <div className="pricing-name">Growth</div>
            <div className="pricing-desc">適合成長中的協議與穩定幣發行方</div>
            <div className="pricing-price">$499<span>/月</span></div>
            <ul className="pricing-features">
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 每月 100,000 次 API 呼叫</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 主網＋測試網</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 優先電子郵件支援</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 自訂風險策略</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 隔離金庫</li>
              <li className="missing"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> 專屬基礎設施</li>
            </ul>
            <a href="/tw#contact" className="btn btn-primary pricing-cta">開始使用</a>
          </div>

          
          <div className="pricing-card reveal">
            <div className="pricing-name">Enterprise</div>
            <div className="pricing-desc">適合機構與大規模部署</div>
            <div className="pricing-price">客製報價</div>
            <ul className="pricing-features">
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 不限次數 API 呼叫</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 多鏈部署</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 全天候專屬支援</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> SLA 保證（99.99%）</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 客製合約開發</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 自建部署選項</li>
            </ul>
            <a href="/tw#contact" className="btn btn-secondary pricing-cta">聯繫銷售</a>
          </div>
        </div>

        <div className="pricing-note reveal">
          <p>所有方案均包含 <a href="/tw/docs/sdk">SDK</a>、<a href="/tw/docs/api">REST API</a> 與 <a href="https://github.com/FintechGuy71/FidesOrigin" rel="noopener noreferrer">開源合約</a> 的存取權限。需要客製化方案嗎？<a href="mailto:contact@fidesorigin.com">聯絡我們</a>。</p>
        </div>
      </div>
    </section>

    
    <section className="section bg-secondary">
      <div className="container">
        <div className="reveal section-intro">
          <p className="micro">方案比較</p>
          <h2 className="h2 section-title">功能比較</h2>
        </div>
        <div className="compare-table-wrap reveal">
          <table className="compare-table">
            <thead>
              <tr>
                <th>功能</th>
                <th>Starter</th>
                <th>Growth</th>
                <th>Enterprise</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>每月 API 呼叫次數</td><td>1,000</td><td>100,000</td><td>不限</td></tr>
              <tr><td>網路</td><td>Sepolia</td><td>主網＋測試網</td><td>多鏈</td></tr>
              <tr><td>風險篩查</td><td className="check">✓</td><td className="check">✓</td><td className="check">✓</td></tr>
              <tr><td>隔離金庫</td><td className="dash">—</td><td className="check">✓</td><td className="check">✓</td></tr>
              <tr><td>自訂策略</td><td className="dash">—</td><td className="check">✓</td><td className="check">✓</td></tr>
              <tr><td>Subgraph 存取</td><td className="check">✓</td><td className="check">✓</td><td className="check">✓</td></tr>
              <tr><td>支援服務</td><td>社群</td><td>優先電子郵件</td><td>全天候專屬</td></tr>
              <tr><td>SLA</td><td className="dash">—</td><td>99.9%</td><td>99.99%</td></tr>
              <tr><td>審計報告</td><td className="dash">—</td><td className="check">✓</td><td className="check">✓</td></tr>
              <tr><td>客製開發</td><td className="dash">—</td><td className="dash">—</td><td className="check">✓</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  
    </>
  );
}
