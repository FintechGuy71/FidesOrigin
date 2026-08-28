/* Auto-generated from public/cn/pricing.html — do not edit by hand. */
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
      content: '最受欢迎';
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

export default function ContentPricingCN() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />

    
    <section className="pricing-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">定价</p>
          <h1 className="display">简单透明的<span>定价</span></h1>
          <p className="lead" style={{ "maxWidth": "600px", "margin": "20px auto 0" }}>免费开始。随业务增长而扩展。无隐藏费用，无长期合约。</p>
        </div>
      </div>
    </section>

    
    <section className="section" style={{ "paddingTop": "0" }}>
      <div className="container">
        <div className="pricing-grid">
          
          <div className="pricing-card reveal">
            <div className="pricing-name">入门版</div>
            <div className="pricing-desc">面向开发者和小型项目</div>
            <div className="pricing-price">$0<span>/月</span></div>
            <ul className="pricing-features">
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 每月 1,000 次 API 调用</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Sepolia 测试网访问</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 社区支持</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 基础风险筛查</li>
              <li className="missing"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> 主网部署</li>
              <li className="missing"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> 自定义策略</li>
            </ul>
            <a href="/cn/docs" className="btn btn-secondary pricing-cta">免费开始</a>
          </div>

          
          <div className="pricing-card featured reveal">
            <div className="pricing-name">成长版</div>
            <div className="pricing-desc">面向成长中的协议和稳定币发行方</div>
            <div className="pricing-price">$499<span>/月</span></div>
            <ul className="pricing-features">
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 每月 100,000 次 API 调用</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 主网 + 测试网</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 优先邮件支持</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 自定义风险策略</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 隔离金库</li>
              <li className="missing"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> 专属基础设施</li>
            </ul>
            <a href="mailto:contact@fidesorigin.com" className="btn btn-primary pricing-cta">开始使用</a>
          </div>

          
          <div className="pricing-card reveal">
            <div className="pricing-name">企业版</div>
            <div className="pricing-desc">面向机构和大型部署</div>
            <div className="pricing-price">定制</div>
            <ul className="pricing-features">
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 无限 API 调用</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 多链部署</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 24/7 专属支持</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> SLA 保障 (99.99%)</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 自定义合约开发</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 本地部署选项</li>
            </ul>
            <a href="mailto:contact@fidesorigin.com" className="btn btn-secondary pricing-cta">联系销售</a>
          </div>
        </div>

        <div className="pricing-note reveal">
          <p>所有套餐均包含我们的 <a href="/cn/docs/sdk">SDK</a>、<a href="/cn/docs/api">REST API</a> 和 <a href="https://github.com/FintechGuy71/FidesOrigin" rel="noopener noreferrer">开源合约</a> 访问权限。需要定制方案？<a href="mailto:contact@fidesorigin.com">联系我们</a>。</p>
        </div>
      </div>
    </section>

    
    <section className="section bg-secondary">
      <div className="container">
        <div className="reveal section-intro">
          <p className="micro">对比</p>
          <h2 className="h2 section-title">功能对比</h2>
        </div>
        <div className="compare-table-wrap reveal">
          <table className="compare-table">
            <thead>
              <tr>
                <th>功能</th>
                <th>入门版</th>
                <th>成长版</th>
                <th>企业版</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>每月 API 调用次数</td><td>1,000</td><td>100,000</td><td>无限</td></tr>
              <tr><td>网络</td><td>Sepolia</td><td>主网 + 测试网</td><td>多链</td></tr>
              <tr><td>风险筛查</td><td className="check">✓</td><td className="check">✓</td><td className="check">✓</td></tr>
              <tr><td>隔离金库</td><td className="dash">—</td><td className="check">✓</td><td className="check">✓</td></tr>
              <tr><td>自定义策略</td><td className="dash">—</td><td className="check">✓</td><td className="check">✓</td></tr>
              <tr><td>子图访问</td><td className="check">✓</td><td className="check">✓</td><td className="check">✓</td></tr>
              <tr><td>支持</td><td>社区</td><td>优先邮件</td><td>24/7 专属</td></tr>
              <tr><td>SLA</td><td className="dash">—</td><td>99.9%</td><td>99.99%</td></tr>
              <tr><td>审计报告</td><td className="dash">—</td><td className="check">✓</td><td className="check">✓</td></tr>
              <tr><td>定制开发</td><td className="dash">—</td><td className="dash">—</td><td className="check">✓</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  
    </>
  );
}
