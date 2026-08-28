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
      background: linear-gradient(180deg, var(--bg-card) 0%, rgba(201,169,110,0.03) 100%);
    }
    .pricing-card.featured::before {
      content: 'Most Popular';
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
      border-bottom: 1px solid rgba(255,255,255,0.04);
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
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />

    
    <section className="pricing-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">定價</p>
          <h1 className="display">簡單透明的<span>定價</span></h1>
          <p className="lead" style={{ "maxWidth": "600px", "margin": "20px auto 0" }}>Start free. Scale as you grow. No hidden fees, no long-term contracts.</p>
        </div>
      </div>
    </section>

    
    <section className="section" style={{ "paddingTop": "0" }}>
      <div className="container">
        <div className="pricing-grid">
          
          <div className="pricing-card reveal">
            <div className="pricing-name">Starter</div>
            <div className="pricing-desc">For developers and small projects</div>
            <div className="pricing-price">$0<span>/month</span></div>
            <ul className="pricing-features">
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 1,000 API calls/month</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Sepolia testnet access</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Community support</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Basic risk screening</li>
              <li className="missing"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> Mainnet deployment</li>
              <li className="missing"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> Custom policies</li>
            </ul>
            <a href="/tw/docs" className="btn btn-secondary pricing-cta">免費開始</a>
          </div>

          
          <div className="pricing-card featured reveal">
            <div className="pricing-name">Growth</div>
            <div className="pricing-desc">For growing protocols and stablecoin issuers</div>
            <div className="pricing-price">$499<span>/month</span></div>
            <ul className="pricing-features">
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 100,000 API calls/month</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Mainnet + testnet</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Priority email support</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Custom risk policies</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Quarantine vault</li>
              <li className="missing"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> Dedicated infrastructure</li>
            </ul>
            <a href="mailto:contact@fidesorigin.com" className="btn btn-primary pricing-cta">開始使用</a>
          </div>

          
          <div className="pricing-card reveal">
            <div className="pricing-name">Enterprise</div>
            <div className="pricing-desc">For institutions and large-scale deployments</div>
            <div className="pricing-price">Custom</div>
            <ul className="pricing-features">
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Unlimited API calls</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Multi-chain deployment</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 24/7 dedicated support</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> SLA guarantee (99.99%)</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Custom contract development</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> On-premise option</li>
            </ul>
            <a href="mailto:contact@fidesorigin.com" className="btn btn-secondary pricing-cta">聯繫銷售</a>
          </div>
        </div>

        <div className="pricing-note reveal">
          <p>All plans include access to our <a href="/tw/docs/sdk">SDK</a>, <a href="/tw/docs/api">REST API</a>, and <a href="https://github.com/FintechGuy71/FidesOrigin" rel="noopener noreferrer">open-source contracts</a>. Need a custom solution? <a href="mailto:contact@fidesorigin.com">Let's talk</a>.</p>
        </div>
      </div>
    </section>

    
    <section className="section bg-secondary">
      <div className="container">
        <div className="reveal section-intro">
          <p className="micro">Compare</p>
          <h2 className="h2 section-title">功能比較</h2>
        </div>
        <div className="compare-table-wrap reveal">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Starter</th>
                <th>Growth</th>
                <th>Enterprise</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>API Calls / Month</td><td>1,000</td><td>100,000</td><td>Unlimited</td></tr>
              <tr><td>Networks</td><td>Sepolia</td><td>Mainnet + Testnet</td><td>Multi-chain</td></tr>
              <tr><td>Risk Screening</td><td className="check">✓</td><td className="check">✓</td><td className="check">✓</td></tr>
              <tr><td>Quarantine Vault</td><td className="dash">—</td><td className="check">✓</td><td className="check">✓</td></tr>
              <tr><td>Custom Policies</td><td className="dash">—</td><td className="check">✓</td><td className="check">✓</td></tr>
              <tr><td>Subgraph Access</td><td className="check">✓</td><td className="check">✓</td><td className="check">✓</td></tr>
              <tr><td>Support</td><td>Community</td><td>Priority Email</td><td>24/7 Dedicated</td></tr>
              <tr><td>SLA</td><td className="dash">—</td><td>99.9%</td><td>99.99%</td></tr>
              <tr><td>Audit Reports</td><td className="dash">—</td><td className="check">✓</td><td className="check">✓</td></tr>
              <tr><td>Custom Development</td><td className="dash">—</td><td className="dash">—</td><td className="check">✓</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  
    </>
  );
}
