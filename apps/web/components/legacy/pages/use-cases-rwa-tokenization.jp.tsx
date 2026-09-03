/* Auto-generated from public/jp/use-cases/rwa-tokenization.html — do not edit by hand. */
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
       已上移到 css/legacy.css（共享）：case-studies.en.tsx 用同一套类名却
       没有 PAGE_CSS，导致该页代码块零样式。此处不再重复定义。 */
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
    .reg-card {
      padding: 24px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      margin-bottom: 16px;
    }
    .reg-card h3 { font-size: 1rem; font-weight: 600; margin-bottom: 8px; color: var(--accent); }
    .reg-card p { font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6; }
    @media (max-width: 900px) {
      .uc-grid { grid-template-columns: 1fr; }
      .uc-features { grid-template-columns: 1fr; }
    }
`;

export default function ContentUseCasesRwaTokenizationJP() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    
    <section className="uc-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">ユースケース</p>
          <h1 className="display">RWA <span>トークン化コンプライアンス</span></h1>
          <p className="lead" style={{ "maxWidth": "700px", "marginTop": "20px" }}>証券コンプライアンスを組み込んだ実物資産のトークン化。オンチェーンでの適格投資家検証、管轄区域ゲート、スマートコントラクトレベルでの自動 KYC 執行を実現します。</p>
        </div>
      </div>
    </section>

    
    <section className="section" style={{ "paddingTop": "0" }}>
      <div className="container">
        <div className="uc-grid">
          <div className="reveal">
            <h2 className="h2">課題</h2>
            <p className="body-sm" style={{ "marginTop": "16px" }}>実物資産のトークン化プラットフォームは、根本的な規制上の課題に直面しています。証券法はトークン化された資産にも適用されますが、従来のコンプライアンスインフラではスマートコントラクトレベルでルールを執行できません。</p>
            <p className="body-sm" style={{ "marginTop": "16px" }}>規制当局は、適格投資家のみがセキュリティトークンを保有できること、送金が管轄区域の制限を遵守すること、そしてトークンの移動前に必ず KYC が完了していることの証明を求めます。オフチェーンデータベースや API チェックでは、決定論的な執行は実現できません。</p>

            <h2 className="h2" style={{ "marginTop": "48px" }}>ソリューション</h2>
            <ul className="uc-checklist" style={{ "marginTop": "16px" }}>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> アテストレジストリによる適格投資家のオンチェーン検証</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> スマートコントラクトによる管轄区域ベースの送金制限の執行</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 送金のたびにオンチェーンで KYC ステータスを確認</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> マルチシグガバナンスによるホワイトリスト／ブラックリスト管理</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 証券規制当局向けの完全な監査証跡</li>
            </ul>
          </div>
          <div className="reveal">
            <div className="uc-code">
              <div className="uc-code-header">
                <span>RWAToken.sol</span>
                <span>Solidity 0.8.26</span>
              </div>
              <pre><span className="comment">// Compliant RWA token with investor verification</span>
<span className="kw">contract</span> <span className="type">RWAToken</span> <span className="kw">is</span> <span className="type">CompliantERC20</span> &#123;

    <span className="kw">constructor</span>()
        <span className="type">CompliantERC20</span>(
            <span className="str">"Real Estate Token"</span>,
            <span className="str">"RET"</span>,
            <span className="num">18</span>,
            <span className="num">1_000_000</span> * <span className="num">1e18</span>
        )
    &#123;&#125;

    <span className="kw">function</span> <span className="func">_beforeTokenTransfer</span>(
        <span className="kw">address</span> from,
        <span className="kw">address</span> to,
        <span className="kw">uint256</span> amount
    ) <span className="kw">internal override</span> &#123;
        <span className="comment">// Verify accredited investor status</span>
        <span className="kw">require</span>(
            fides.<span className="func">isAccredited</span>(to),
            <span className="str">"Recipient not accredited"</span>
        );

        <span className="comment">// Enforce jurisdiction restrictions</span>
        <span className="kw">require</span>(
            fides.<span className="func">isJurisdictionAllowed</span>(to),
            <span className="str">"Jurisdiction restricted"</span>
        );

        <span className="kw">super</span>.<span className="func">_beforeTokenTransfer</span>(from, to, amount);
    &#125;
&#125;</pre>
            </div>
          </div>
        </div>
      </div>
    </section>

    
    <section className="section bg-secondary">
      <div className="container">
        <div className="reveal section-intro">
          <p className="micro">規制カバレッジ</p>
          <h2 className="h2 section-title">証券規制に対応した設計</h2>
        </div>
        <div className="uc-features">
          <div className="uc-feature reveal">
            <h3>Regulation D / Reg S</h3>
            <p>適格投資家ステータスとオフショア送金の制限を、コントラクトレベルで自動的に執行します。</p>
          </div>
          <div className="uc-feature reveal">
            <h3>MiCA 資産参照トークン</h3>
            <p>トークン化証券および電子マネートークンについて、欧州の暗号資産市場規制（MiCA）の要件を満たします。</p>
          </div>
          <div className="uc-feature reveal">
            <h3>シンガポール MAS フレームワーク</h3>
            <p>オンチェーン KYC と投資者分類により、シンガポールのデジタルトークンオファリング（DTO）ガイドラインに準拠します。</p>
          </div>
          <div className="uc-feature reveal">
            <h3>スイス DLT 法</h3>
            <p>コンプライアンスに準拠したトークン送金とレジストリ連携により、台帳ベースの証券をサポートします。</p>
          </div>
        </div>

        <div style={{ "marginTop": "48px" }}>
          <div className="reg-card reveal">
            <h3>適格投資家の検証</h3>
            <p>オンチェーンのアテストプロバイダーと連携し、個人データを公開することなく適格投資家ステータスを検証します。FidesOrigin はトークン送金を許可する前に暗号学的アテステーションをリアルタイムで確認します。状況が変わった場合は、ステータスを即座に取り消せます。</p>
          </div>
          <div className="reg-card reveal">
            <h3>管轄区域ゲート</h3>
            <p>トークン保有者の居住地に基づき、管轄区域ごとの送金ルールを設定できます。制限対象の管轄区域への送金をブロックし、地域ごとに保有上限を適用し、150 を超える管轄区域で現地の証券法へのコンプライアンスを維持します。</p>
          </div>
          <div className="reg-card reveal">
            <h3>オンチェーン KYC 連携</h3>
            <p>KYC プロバイダーをオンチェーンレジストリに接続します。ユーザーが KYC を完了すると、そのウォレットアドレスがオンチェーンでアテストされます。スマートコントラクトは送金のたびにこのアテステーションを検証します——API コールも遅延もバイパス経路もありません。</p>
          </div>
        </div>
      </div>
    </section>

    
    <section className="section">
      <div className="container">
        <div className="cta-section reveal">
          <h2 className="h1">実物資産のトークン化を始めませんか？</h2>
          <p>オンチェーンの投資家検証と管轄区域レベルの執行を備えた、コンプライアンス準拠のセキュリティトークンを構築しましょう。</p>
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
