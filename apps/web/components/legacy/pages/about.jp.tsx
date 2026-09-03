/* Auto-generated from public/jp/about.html — do not edit by hand. */
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

export default function ContentAboutJP() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    <section className="about-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">私たちについて</p>
          <h1 className="display">オンチェーンで <span>信頼を構築</span></h1>
          <p className="lead" style={{ "maxWidth": "600px", "margin": "20px auto 0" }}>コンプライアンスは、サードパーティ API が管理するブラックボックスではなく、プログラマブルで決定論的、かつ透明であるべきだと私たちは考えます。</p>
        </div>
      </div>
    </section>

    <section className="section" style={{ "paddingTop": "0" }}>
      <div className="container">
        <div className="about-mission reveal">
          <h2>私たちのミッション</h2>
          <p>オンチェーンコンプライアンスを、インターネットにおける SSL のように Web3 の基盤にすること。すべての取引がスクリーニングされ、すべてのポリシーが決定論的であり、すべてのルールが監査可能であること——分散性を犠牲にすることなく。</p>
        </div>

        <div className="stats-grid reveal">
          <div className="stat-item">
            <div className="num">3</div>
            <div className="label">セキュリティ監査ラウンド</div>
          </div>
          <div className="stat-item">
            <div className="num">300+</div>
            <div className="label">指摘事項を解決済み</div>
          </div>
          <div className="stat-item">
            <div className="num">391</div>
            <div className="label">テスト合格</div>
          </div>
          <div className="stat-item">
            <div className="num">0</div>
            <div className="label">重大な問題</div>
          </div>
        </div>
      </div>
    </section>

    <section className="section bg-secondary">
      <div className="container">
        <div className="reveal section-intro">
          <p className="micro">バリュー</p>
          <h2 className="h2 section-title">私たちが大切にすること</h2>
        </div>
        <div className="values-grid">
          <div className="value-card reveal">
            <h3>信頼より決定論</h3>
            <p>コンプライアンスルールは、どの取引に対しても毎回同じように実行されるべきです。隠れたロジックも手動の例外処理もありません。</p>
          </div>
          <div className="value-card reveal">
            <h3>不透明より透明性</h3>
            <p>すべてのポリシー、リスクプロファイル、スクリーニング判定はオンチェーンに記録され、誰でも監査できます。規制当局は検証でき、ユーザーは信頼できます。</p>
          </div>
          <div className="value-card reveal">
            <h3>管理より分散化</h3>
            <p>私たちはお客様の秘密鍵を保持せず、資産を凍結せず、取引を検閲しません。ルールを執行するのはプロトコルであり、人間ではありません。</p>
          </div>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container">
        <div className="cta-section reveal">
          <h2 className="h1">オンチェーンコンプライアンスの未来を、私たちと共に</h2>
          <p>私たちのビジョンに共感してくださるビルダーを常に歓迎しています。</p>
          <div className="cta-buttons">
            <a href="mailto:contact@fidesorigin.com" className="btn btn-primary">お問い合わせ</a>
            <a href="https://github.com/FintechGuy71/FidesOrigin" className="btn btn-secondary" rel="noopener noreferrer">GitHub</a>
          </div>
        </div>
      </div>
    </section>
  
    </>
  );
}
