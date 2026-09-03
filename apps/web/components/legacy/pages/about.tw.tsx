/* Auto-generated from public/tw/about.html — do not edit by hand. */
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

export default function ContentAboutTW() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    <section className="about-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">關於我們</p>
          <h1 className="display">在鏈上建立<span>信任</span></h1>
          <p className="lead" style={{ "maxWidth": "600px", "margin": "20px auto 0" }}>我們相信，合規應該是可編程、具確定性且透明的——而不是由第三方 API 控制的黑箱。</p>
        </div>
      </div>
    </section>

    <section className="section" style={{ "paddingTop": "0" }}>
      <div className="container">
        <div className="about-mission reveal">
          <h2>我們的使命</h2>
          <p>讓鏈上合規成為 Web3 的基礎，如同 SSL 之於網際網路。每筆交易都應經過篩查，每項策略都應具確定性，每條規則都應可審計——同時不犧牲去中心化。</p>
        </div>

        <div className="stats-grid reveal">
          <div className="stat-item">
            <div className="num">3</div>
            <div className="label">安全審計輪數</div>
          </div>
          <div className="stat-item">
            <div className="num">300+</div>
            <div className="label">已解決發現項</div>
          </div>
          <div className="stat-item">
            <div className="num">391</div>
            <div className="label">測試通過數</div>
          </div>
          <div className="stat-item">
            <div className="num">0</div>
            <div className="label">嚴重問題數</div>
          </div>
        </div>
      </div>
    </section>

    <section className="section bg-secondary">
      <div className="container">
        <div className="reveal section-intro">
          <p className="micro">核心價值</p>
          <h2 className="h2 section-title">我們的信念</h2>
        </div>
        <div className="values-grid">
          <div className="value-card reveal">
            <h3>以確定性取代信任</h3>
            <p>合規規則在每筆交易中，每次都以相同的方式執行。沒有隱藏邏輯，沒有人工例外。</p>
          </div>
          <div className="value-card reveal">
            <h3>以透明取代不透明</h3>
            <p>所有策略、風險畫像與篩查決策都在鏈上，可供公開審計。監管機構可以驗證，使用者可以信任。</p>
          </div>
          <div className="value-card reveal">
            <h3>以去中心化取代控制</h3>
            <p>我們不持有你的金鑰，不凍結你的資金，也不審查你的交易。規則由協議執行，而非人為干預。</p>
          </div>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container">
        <div className="cta-section reveal">
          <h2 className="h1">與我們共建鏈上合規的未來</h2>
          <p>我們持續尋找與我們擁有相同願景的建設者。</p>
          <div className="cta-buttons">
            <a href="mailto:contact@fidesorigin.com" className="btn btn-primary">與我們聯繫</a>
            <a href="https://github.com/FintechGuy71/FidesOrigin" className="btn btn-secondary" rel="noopener noreferrer">GitHub</a>
          </div>
        </div>
      </div>
    </section>
  
    </>
  );
}
