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
      background: linear-gradient(135deg, var(--gold) 0%, var(--accent) 100%);
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
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />

    <section className="about-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">关于我们</p>
          <h1 className="display">Building trust <span>on-chain</span></h1>
          <p className="lead" style={{ "maxWidth": "600px", "margin": "20px auto 0" }}>We believe compliance should be programmable, deterministic, and transparent — not a black box controlled by third-party APIs.</p>
        </div>
      </div>
    </section>

    <section className="section" style={{ "paddingTop": "0" }}>
      <div className="container">
        <div className="about-mission reveal">
          <h2>Our Mission</h2>
          <p>To make on-chain compliance as fundamental to Web3 as SSL is to the internet. Every transaction should be screened, every policy should be deterministic, and every rule should be auditable — without sacrificing decentralization.</p>
        </div>

        <div className="stats-grid reveal">
          <div className="stat-item">
            <div className="num">3</div>
            <div className="label">Security Audit Rounds</div>
          </div>
          <div className="stat-item">
            <div className="num">300+</div>
            <div className="label">Findings Resolved</div>
          </div>
          <div className="stat-item">
            <div className="num">391</div>
            <div className="label">Tests Passing</div>
          </div>
          <div className="stat-item">
            <div className="num">0</div>
            <div className="label">Critical Issues</div>
          </div>
        </div>
      </div>
    </section>

    <section className="section bg-secondary">
      <div className="container">
        <div className="reveal section-intro">
          <p className="micro">Values</p>
          <h2 className="h2 section-title">What we believe</h2>
        </div>
        <div className="values-grid">
          <div className="value-card reveal">
            <h3>Determinism Over Trust</h3>
            <p>Compliance rules should execute the same way every time, for every transaction. No hidden logic, no manual exceptions.</p>
          </div>
          <div className="value-card reveal">
            <h3>Transparency Over Opacity</h3>
            <p>All policies, risk profiles, and screening decisions are on-chain and publicly auditable. Regulators can verify; users can trust.</p>
          </div>
          <div className="value-card reveal">
            <h3>Decentralization Over Control</h3>
            <p>We don't hold your keys, freeze your funds, or censor your transactions. The protocol enforces rules; humans don't.</p>
          </div>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container">
        <div className="cta-section reveal">
          <h2 className="h1">Join us in building the future of on-chain compliance</h2>
          <p>We're always looking for builders who share our vision.</p>
          <div className="cta-buttons">
            <a href="mailto:contact@fidesorigin.com" className="btn btn-primary">Get in Touch</a>
            <a href="https://github.com/FintechGuy71/FidesOrigin" className="btn btn-secondary" rel="noopener noreferrer">GitHub</a>
          </div>
        </div>
      </div>
    </section>
  
    </>
  );
}
