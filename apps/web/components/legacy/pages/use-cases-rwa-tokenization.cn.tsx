/* Auto-generated from public/cn/use-cases/rwa-tokenization.html — do not edit by hand. */
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
    .uc-code {
      background: #0a0c14;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      overflow: hidden;
    }
    .uc-code-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: rgba(255,255,255,0.02);
      border-bottom: 1px solid var(--border);
      font-size: 0.8rem;
      color: var(--text-muted);
      font-family: var(--font-mono);
    }
    .uc-code pre {
      padding: 20px;
      overflow-x: auto;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      line-height: 1.7;
      color: var(--text-secondary);
      margin: 0;
    }
    .uc-code .comment { color: #5c6370; font-style: italic; }
    .uc-code .kw { color: #c678dd; }
    .uc-code .type { color: #e5c07b; }
    .uc-code .func { color: #61afef; }
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
      border-bottom: 1px solid rgba(255,255,255,0.04);
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

export default function ContentUseCasesRwaTokenizationCN() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />

    
    <section className="uc-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">Use Case</p>
          <h1 className="display">RWA <span>Tokenization Compliance</span></h1>
          <p className="lead" style={{ "maxWidth": "700px", "marginTop": "20px" }}>Tokenize real world assets with built-in securities compliance. On-chain accredited investor verification, jurisdiction gating, and automated KYC enforcement at the smart contract level.</p>
        </div>
      </div>
    </section>

    
    <section className="section" style={{ "paddingTop": "0" }}>
      <div className="container">
        <div className="uc-grid">
          <div className="reveal">
            <h2 className="h2">The Challenge</h2>
            <p className="body-sm" style={{ "marginTop": "16px" }}>Real world asset tokenization platforms face a fundamental regulatory challenge: securities laws apply to tokenized assets, but traditional compliance infrastructure cannot enforce rules at the smart contract level.</p>
            <p className="body-sm" style={{ "marginTop": "16px" }}>Regulators require proof that only accredited investors can hold security tokens, that transfers respect jurisdictional restrictions, and that KYC is completed before any token movement. Off-chain databases and API checks cannot provide deterministic enforcement.</p>

            <h2 className="h2" style={{ "marginTop": "48px" }}>The Solution</h2>
            <ul className="uc-checklist" style={{ "marginTop": "16px" }}>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Accredited investor verification on-chain via attestation registry</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Jurisdiction-based transfer restrictions enforced by smart contract</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> On-chain KYC status checks before every transfer</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Whitelist / blacklist management with multi-sig governance</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Full audit trail for securities regulators</li>
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
          <p className="micro">Regulatory Coverage</p>
          <h2 className="h2 section-title">Built for securities regulations</h2>
        </div>
        <div className="uc-features">
          <div className="uc-feature reveal">
            <h3>Regulation D / Reg S</h3>
            <p>Enforce accredited investor status and offshore transfer restrictions automatically at the contract level.</p>
          </div>
          <div className="uc-feature reveal">
            <h3>MiCA Asset-Referenced Tokens</h3>
            <p>Meet EU Markets in Crypto-Assets requirements for tokenized securities and e-money tokens.</p>
          </div>
          <div className="uc-feature reveal">
            <h3>Singapore MAS Framework</h3>
            <p>Comply with Singapore's Digital Token Offerings guidelines with on-chain KYC and investor classification.</p>
          </div>
          <div className="uc-feature reveal">
            <h3>Swiss DLT Act</h3>
            <p>Support ledger-based securities with compliant token transfers and registry integration.</p>
          </div>
        </div>

        <div style={{ "marginTop": "48px" }}>
          <div className="reg-card reveal">
            <h3>Accredited Investor Verification</h3>
            <p>Integrate with on-chain attestation providers to verify accredited investor status without exposing personal data. FidesOrigin checks cryptographic attestations in real-time before allowing token transfers. Status can be revoked instantly if circumstances change.</p>
          </div>
          <div className="reg-card reveal">
            <h3>Jurisdiction Gating</h3>
            <p>Configure per-jurisdiction transfer rules based on token holder residency. Block transfers to restricted jurisdictions, apply holding limits by region, and maintain compliance with local securities laws across 150+ jurisdictions.</p>
          </div>
          <div className="reg-card reveal">
            <h3>On-Chain KYC Integration</h3>
            <p>Connect KYC providers to the on-chain registry. Once a user completes KYC, their wallet address is attested on-chain. The smart contract verifies this attestation before every transfer — no API calls, no delays, no bypass paths.</p>
          </div>
        </div>
      </div>
    </section>

    
    <section className="section">
      <div className="container">
        <div className="cta-section reveal">
          <h2 className="h1">Ready to tokenize real world assets?</h2>
          <p>Build compliant securities tokens with on-chain investor verification and jurisdictional enforcement.</p>
          <div className="cta-buttons">
            <a href="/cn/docs" className="btn btn-primary">阅读文档</a>
            <a href="mailto:contact@fidesorigin.com" className="btn btn-secondary">联系销售</a>
          </div>
        </div>
      </div>
    </section>
  
    </>
  );
}
