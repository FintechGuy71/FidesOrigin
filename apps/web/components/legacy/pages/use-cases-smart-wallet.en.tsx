/* Auto-generated from public/use-cases/smart-wallet.html — do not edit by hand. */
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

export default function ContentUseCasesSmartWalletEN() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    <section className="uc-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">Use Case</p>
          <h1 className="display">Smart Wallet <span>Compliance</span></h1>
          <p className="lead" style={{ "maxWidth": "700px", "marginTop": "20px" }}>Embed on-chain risk screening directly into smart wallets and account abstraction wallets. Every userOp is evaluated before execution — no bypass possible.</p>
        </div>
      </div>
    </section>

    <section className="section" style={{ "paddingTop": "0" }}>
      <div className="container">
        <div className="uc-grid">
          <div className="reveal">
            <h2 className="h2">The Challenge</h2>
            <p className="body-sm" style={{ "marginTop": "16px" }}>Smart wallets (ERC-4337) and account abstraction are revolutionizing user experience in Web3. But they introduce a new compliance challenge: how do you screen transactions when users interact through bundlers and entry points rather than direct EOA-to-contract calls?</p>
            <p className="body-sm" style={{ "marginTop": "16px" }}>Traditional compliance solutions rely on dApp-level integration, which smart wallets bypass entirely. A user can construct a userOp that interacts with any contract, and the bundler will execute it — unless the wallet itself enforces compliance.</p>

            <h2 className="h2" style={{ "marginTop": "48px" }}>The Solution</h2>
            <ul className="uc-checklist" style={{ "marginTop": "16px" }}>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Risk checks at the entrypoint level, before userOp execution</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Automatic screening of all destination addresses and call data</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Policy enforcement per wallet owner, not per dApp</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Bypass impossible even via direct bundler submission</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Real-time risk profile updates via oracle networks</li>
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
          <p className="micro">Capabilities</p>
          <h2 className="h2 section-title">Built for account abstraction</h2>
        </div>
        <div className="uc-features">
          <div className="uc-feature reveal">
            <h3>ERC-4337 Compatible</h3>
            <p>Integrates with any ERC-4337 entrypoint. Risk checks run during userOp validation, before bundler acceptance.</p>
          </div>
          <div className="uc-feature reveal">
            <h3>Bundler-Agnostic</h3>
            <p>Works with any bundler service. Compliance is enforced by the wallet contract, not the infrastructure.</p>
          </div>
          <div className="uc-feature reveal">
            <h3>Policy Per Owner</h3>
            <p>Each wallet owner can configure their own risk policies: daily limits, whitelisted addresses, jurisdiction rules.</p>
          </div>
          <div className="uc-feature reveal">
            <h3>Session Key Support</h3>
            <p>Apply different risk policies to session keys vs. owner key. Granular control for delegated access.</p>
          </div>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container">
        <div className="cta-section reveal">
          <h2 className="h1">Ready to build a compliant smart wallet?</h2>
          <p>Get access to our SDK, testnet deployment, and ERC-4337 integration guide.</p>
          <div className="cta-buttons">
            <a href="/docs" className="btn btn-primary">Read Documentation</a>
            <a href="mailto:contact@fidesorigin.com" className="btn btn-secondary">Contact Sales</a>
          </div>
        </div>
      </div>
    </section>
  
    </>
  );
}
