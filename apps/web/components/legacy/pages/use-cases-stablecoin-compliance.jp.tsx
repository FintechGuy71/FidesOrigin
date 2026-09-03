/* Auto-generated from public/jp/use-cases/stablecoin-compliance.html — do not edit by hand. */
const PAGE_CSS = `
.uc-hero { padding: 140px 0 60px; }
    .uc-hero .display { font-size: clamp(2rem, 4.5vw, 3.2rem); }
    .uc-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 64px;
      align-items: center;
      margin-top: 48px;
    }
    /* .uc-code / .uc-code-header / .uc-code pre / .uc-code .{comment,kw,type,func,str,num}
       已上移到 css/legacy.css（共享）：这套类名跨 4 个 use-cases 家族 +
       case-studies 共用，原先每个页面各写一份且数值不一致
       （#5c6370 对比度仅 3.23:1、#c678dd 紫色破坏金色体系、缺 .str/.num）。
       此处不再重复定义。 */
    .uc-features {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-top: 48px;
    }
    .uc-feature {
      padding: 24px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
    }
    .uc-feature h3 { font-size: 1rem; font-weight: 600; margin-bottom: 8px; }
    .uc-feature p { font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6; }
    .uc-checklist { list-style: none; padding: 0; }
    .uc-checklist li {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid var(--fio-border-hairline);
      font-size: 0.9rem;
      color: var(--text-secondary);
    }
    .uc-checklist svg { width: 20px; height: 20px; color: var(--success); flex-shrink: 0; margin-top: 2px; }
    @media (max-width: 900px) {
      .uc-grid { grid-template-columns: 1fr; }
      .uc-features { grid-template-columns: 1fr; }
    }
`;

export default function ContentUseCasesStablecoinComplianceJP() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    
    <section className="uc-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">ユースケース</p>
          <h1 className="display">ステーブルコインの <span>コンプライアンス</span></h1>
          <p className="lead" style={{ "maxWidth": "700px", "marginTop": "20px" }}>決定論的なオンチェーンリスクスクリーニングを備えた、コンプライアンス準拠のステーブルコインを構築。分散性を損なうことなく、MiCA や香港をはじめとする各国・地域の規制要件を満たします。</p>
        </div>
      </div>
    </section>

    
    <section className="section" style={{ "paddingTop": "0" }}>
      <div className="container">
        <div className="uc-grid">
          <div className="reveal">
            <h2 className="h2">課題</h2>
            <p className="body-sm" style={{ "marginTop": "16px" }}>ステーブルコイン発行者は重大なジレンマに直面しています。ブロックチェーンの存在意義そのものを損なう中央集権化やオフチェーン依存を持ち込むことなく、OFAC のサンクション（制裁）、FATF トラベルルール、そして MiCA などの新興規制に、いかにして準拠するかという課題です。</p>
            <p className="body-sm" style={{ "marginTop": "16px" }}>従来のソリューションは、遅延、単一障害点、信頼の前提を持ち込む API ベースのスクリーニングに依存しています。規制当局はますます、コンプライアンスが <strong>決定論的かつ監査可能</strong> であることの証明を求めています。</p>

            <h2 className="h2" style={{ "marginTop": "48px" }}>ソリューション</h2>
            <ul className="uc-checklist" style={{ "marginTop": "16px" }}>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> すべての送金に対するオンチェーンでの OFAC／国連サンクション（制裁）スクリーニング</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> スマートコントラクトレベルでの決定論的なポリシー執行</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 不正疑いのある取引のための隔離ボールト</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Chainlink Functions によるリアルタイムのリスクプロファイル更新</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 規制当局向けの完全な監査証跡</li>
            </ul>
          </div>
          <div className="reveal">
            <div className="uc-code">
              <div className="uc-code-header">
                <span>CompliantStableCoin.sol</span>
                <span>Solidity 0.8.26</span>
              </div>
              <pre><span className="comment">// Inherit CompliantStableCoin for automatic screening</span>
<span className="kw">contract</span> <span className="type">MyStableCoin</span> <span className="kw">is</span> <span className="type">CompliantStableCoin</span> &#123;

    <span className="kw">constructor</span>()
        <span className="type">CompliantStableCoin</span>(
            <span className="str">"MyStable"</span>,      <span className="comment">// name</span>
            <span className="str">"MST"</span>,           <span className="comment">// symbol</span>
            <span className="num">6</span>,               <span className="comment">// decimals</span>
            <span className="num">100_000_000</span> * <span className="num">1e6</span> <span className="comment">// max supply</span>
        )
    &#123;
        <span className="comment">// Configure policies</span>
        _setMaxTransferAmount(<span className="num">100_000</span> * <span className="num">1e6</span>);
        _requireKYC(<span className="kw">true</span>);
    &#125;

    <span className="comment">// Every transfer is automatically screened</span>
    <span className="comment">// against on-chain risk profiles</span>
&#125;</pre>
            </div>
          </div>
        </div>
      </div>
    </section>

    
    <section className="section bg-secondary">
      <div className="container">
        <div className="reveal section-intro">
          <p className="micro">機能</p>
          <h2 className="h2 section-title">規制対象のステーブルコインのための設計</h2>
        </div>
        <div className="uc-features">
          <div className="uc-feature reveal">
            <h3>MiCA 対応</h3>
            <p>オンチェーンのリザーブアテストと取引スクリーニングにより、欧州の暗号資産市場規制（MiCA）に準拠します。</p>
          </div>
          <div className="uc-feature reveal">
            <h3>香港ライセンス</h3>
            <p>リアルタイムのサンクション（制裁）スクリーニングや監査証跡を含め、HKMA のステーブルコイン発行者要件に準拠します。</p>
          </div>
          <div className="uc-feature reveal">
            <h3>OFAC スクリーニング</h3>
            <p>送金のたびに SDN リストをチェック。分散型オラクルネットワークを介して自律的に更新されます。</p>
          </div>
          <div className="uc-feature reveal">
            <h3>FATF トラベルルール</h3>
            <p>国境を越える送金に対応する、VASP 検証および送付人／受取人データの取り扱いを内蔵しています。</p>
          </div>
        </div>
      </div>
    </section>

    
    <section className="section">
      <div className="container">
        <div className="cta-section reveal">
          <h2 className="h1">コンプライアンス対応のステーブルコインを構築しませんか？</h2>
          <p>SDK、テストネットデプロイ、コンプライアンスドキュメントをご利用いただけます。</p>
          <div className="cta-buttons">
            <a href="/jp/docs" className="btn btn-primary">ドキュメントを読む</a>
            <a href="mailto:contact@fidesorigin.com" className="btn btn-secondary">営業に問い合わせ</a>
          </div>
        </div>
      </div>
    </section>
  
    </>
  );
}
