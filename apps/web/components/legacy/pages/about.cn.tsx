/* Auto-generated from public/cn/about.html — do not edit by hand. */
const PAGE_CSS = `
.about-hero { padding: 140px 0 60px; text-align: center; }
    .about-hero .display { font-size: clamp(2rem, 4.5vw, 3.2rem); }
    .about-mission { text-align: center; max-width: 700px; margin: 0 auto; padding: 60px 0; }
    .about-mission h2 { font-size: 1.5rem; font-weight: 600; margin-bottom: 20px; }
    .about-mission p { color: var(--text-secondary); line-height: 1.8; font-size: 1.05rem; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 24px;
      margin-top: 48px;
    }
    .stat-item {
      padding: 32px 24px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      text-align: center;
    }
    .stat-item .num {
      font-size: 2.5rem;
      font-weight: 800;
      background: linear-gradient(135deg, var(--gold-bright) 0%, var(--gold) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .stat-item .label { font-size: 0.875rem; color: var(--text-secondary); margin-top: 4px; }
    .values-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-top: 48px;
    }
    .value-card {
      padding: 28px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
    }
    .value-card h3 { font-size: 1rem; font-weight: 600; margin-bottom: 8px; }
    .value-card p { font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6; }
    @media (max-width: 900px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .values-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 480px) {
      .stats-grid { grid-template-columns: 1fr; }
    }
`;

export default function ContentAboutCN() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    <section className="about-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">关于我们</p>
          <h1 className="display">构建<span>链上</span>信任</h1>
          <p className="lead" style={{ "maxWidth": "600px", "margin": "20px auto 0" }}>我们相信，合规应当可编程、确定性且透明，而非由第三方 API 控制的黑箱。</p>
        </div>
      </div>
    </section>

    <section className="section" style={{ "paddingTop": "0" }}>
      <div className="container">
        <div className="about-mission reveal">
          <h2>我们的使命</h2>
          <p>让链上合规成为 Web3 的基础能力，正如 SSL 之于互联网。每笔交易都应经过筛查，每项策略都应确定性执行，每条规则都应可审计——且不牺牲去中心化。</p>
        </div>

        <div className="stats-grid reveal">
          <div className="stat-item">
            <div className="num">3</div>
            <div className="label">安全审计轮次</div>
          </div>
          <div className="stat-item">
            <div className="num">300+</div>
            <div className="label">发现问题已解决</div>
          </div>
          <div className="stat-item">
            <div className="num">391</div>
            <div className="label">测试通过</div>
          </div>
          <div className="stat-item">
            <div className="num">0</div>
            <div className="label">严重问题</div>
          </div>
        </div>
      </div>
    </section>

    <section className="section bg-secondary">
      <div className="container">
        <div className="reveal section-intro">
          <p className="micro">价值观</p>
          <h2 className="h2 section-title">我们的理念</h2>
        </div>
        <div className="values-grid">
          <div className="value-card reveal">
            <h3>确定性优先于信任</h3>
            <p>合规规则应对每笔交易以相同方式执行，没有隐藏逻辑，也没有人工例外。</p>
          </div>
          <div className="value-card reveal">
            <h3>透明优先于黑箱</h3>
            <p>所有策略、风险画像与筛查决策均上链且可公开审计。监管方可验证，用户可信赖。</p>
          </div>
          <div className="value-card reveal">
            <h3>去中心化优先于管控</h3>
            <p>我们不持有你的私钥，不冻结你的资金，也不审查你的交易。规则由协议执行，而非由人执行。</p>
          </div>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container">
        <div className="cta-section reveal">
          <h2 className="h1">与我们共建链上合规的未来</h2>
          <p>我们始终期待与我们愿景一致的构建者加入。</p>
          <div className="cta-buttons">
            <a href="mailto:contact@fidesorigin.com" className="btn btn-primary">联系我们</a>
            <a href="https://github.com/FintechGuy71/FidesOrigin" className="btn btn-secondary" rel="noopener noreferrer">GitHub</a>
          </div>
        </div>
      </div>
    </section>
  
    </>
  );
}
