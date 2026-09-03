/* Auto-generated from public/jp/use-cases/smart-wallet.html — do not edit by hand. */
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

export default function ContentUseCasesSmartWalletJP() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    <section className="uc-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">ユースケース</p>
          <h1 className="display">スマートウォレットの <span>コンプライアンス</span></h1>
          <p className="lead" style={{ "maxWidth": "700px", "marginTop": "20px" }}>オンチェーンのリスクスクリーニングをスマートウォレットやアカウントアブストラクションウォレットに直接組み込みます。すべての userOp は実行前に評価され、バイパスは一切不可能です。</p>
        </div>
      </div>
    </section>

    <section className="section" style={{ "paddingTop": "0" }}>
      <div className="container">
        <div className="uc-grid">
          <div className="reveal">
            <h2 className="h2">課題</h2>
            <p className="body-sm" style={{ "marginTop": "16px" }}>スマートウォレット（ERC-4337）とアカウントアブストラクションは、Web3 のユーザー体験を革新しています。しかし、新しいコンプライアンス上の課題も生じます。ユーザーが EOA からコントラクトへの直接呼び出しではなく、bundler や entry point を介してやり取りする場合、どのように取引をスクリーニングすればよいのでしょうか。</p>
            <p className="body-sm" style={{ "marginTop": "16px" }}>従来のコンプライアンスソリューションは dApp レベルの統合に依存しており、スマートウォレットはこれを完全に回避できます。ユーザーは任意のコントラクトとやり取りする userOp を構築でき、ウォレット自体がコンプライアンスを執行しない限り、bundler はそれを実行してしまいます。</p>

            <h2 className="h2" style={{ "marginTop": "48px" }}>ソリューション</h2>
            <ul className="uc-checklist" style={{ "marginTop": "16px" }}>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> userOp の実行前に、entrypoint レベルでリスクチェックを実施</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> すべての宛先アドレスとコールデータの自動スクリーニング</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> dApp 単位ではなく、ウォレット所有者ごとのポリシー執行</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> bundler への直接送信によるバイパスも不可能</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> オラクルネットワーク経由でのリアルタイムなリスクプロファイル更新</li>
            </ul>
          </div>
          <div className="reveal">
            <div className="uc-code">
              <div className="uc-code-header">
                <span>CompliantSmartWallet.sol</span>
                <span>Solidity 0.8.26</span>
              </div>
              <pre><span className="comment">// Smart wallet with embedded risk screening</span>
<span className="kw">contract</span> <span className="type">CompliantSmartWallet</span> <span className="kw">is</span> <span className="type">BaseAccount</span> &#123;

    <span className="kw">function</span> <span className="func">_validateUserOp</span>(
        <span className="type">UserOperation</span> <span className="kw">calldata</span> userOp,
        <span className="kw">bytes32</span> userOpHash
    ) <span className="kw">internal override</span> <span className="kw">returns</span> (<span className="kw">uint256</span>) &#123;
        <span className="comment">// Screen destination address</span>
        (<span className="kw">bool</span> allowed, <span className="kw">uint256</span> risk) =
            fides.<span className="func">evaluateTransaction</span>(
                <span className="kw">address</span>(<span className="kw">this</span>),
                userOp.dest,
                userOp.value
            );

        <span className="kw">if</span> (!allowed)
            <span className="kw">revert</span> <span className="func">ComplianceViolation</span>(risk);

        <span className="kw">return</span> <span className="kw">super</span>.<span className="func">_validateUserOp</span>(userOp, userOpHash);
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
          <p className="micro">機能</p>
          <h2 className="h2 section-title">アカウントアブストラクションのための設計</h2>
        </div>
        <div className="uc-features">
          <div className="uc-feature reveal">
            <h3>ERC-4337 互換</h3>
            <p>あらゆる ERC-4337 entrypoint と連携。リスクチェックは bundler が受理する前の userOp 検証中に実行されます。</p>
          </div>
          <div className="uc-feature reveal">
            <h3>Bundler に依存しない</h3>
            <p>あらゆる bundler サービスで動作します。コンプライアンスはインフラではなく、ウォレットコントラクトが執行します。</p>
          </div>
          <div className="uc-feature reveal">
            <h3>所有者ごとのポリシー</h3>
            <p>各ウォレット所有者は、1日あたりの限度額、ホワイトリストアドレス、管轄区域ルールなど、独自のリスクポリシーを設定できます。</p>
          </div>
          <div className="uc-feature reveal">
            <h3>セッションキー対応</h3>
            <p>セッションキーとオーナーキーで異なるリスクポリシーを適用。委任アクセスをきめ細かく制御できます。</p>
          </div>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container">
        <div className="cta-section reveal">
          <h2 className="h1">コンプライアンス対応のスマートウォレットを構築しませんか？</h2>
          <p>SDK、テストネットデプロイ、ERC-4337 統合ガイドをご利用いただけます。</p>
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
