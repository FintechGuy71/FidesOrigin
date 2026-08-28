/* Auto-generated from public/cn/use-cases/stablecoin-compliance.html — do not edit by hand. */
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
    @media (max-width: 900px) {
      .uc-grid { grid-template-columns: 1fr; }
      .uc-features { grid-template-columns: 1fr; }
    }
`;

export default function ContentUseCasesStablecoinComplianceCN() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />

    
    <section className="uc-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">Use Case</p>
          <h1 className="display">Stablecoin <span>Compliance</span></h1>
          <p className="lead" style={{ "maxWidth": "700px", "marginTop": "20px" }}>Build compliant stablecoins with deterministic on-chain risk screening. Meet MiCA, Hong Kong, and global regulatory requirements without compromising decentralization.</p>
        </div>
      </div>
    </section>

    
    <section className="section" style={{ "paddingTop": "0" }}>
      <div className="container">
        <div className="uc-grid">
          <div className="reveal">
            <h2 className="h2">The Challenge</h2>
            <p className="body-sm" style={{ "marginTop": "16px" }}>Stablecoin issuers face a critical dilemma: how to comply with OFAC sanctions, FATF travel rules, and emerging regulations like MiCA — without introducing centralization or off-chain dependencies that undermine the very purpose of blockchain.</p>
            <p className="body-sm" style={{ "marginTop": "16px" }}>Traditional solutions rely on API-based screening that introduces latency, single points of failure, and trust assumptions. Regulators are increasingly demanding proof that compliance is <strong>deterministic and auditable</strong>.</p>
            
            <h2 className="h2" style={{ "marginTop": "48px" }}>The Solution</h2>
            <ul className="uc-checklist" style={{ "marginTop": "16px" }}>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> On-chain OFAC/UN sanctions screening for every transfer</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Deterministic policy enforcement at the smart contract level</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Quarantine vault for suspicious transactions</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Real-time risk profile updates via Chainlink Functions</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Full audit trail for regulators</li>
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
          <p className="micro">Capabilities</p>
          <h2 className="h2 section-title">Built for regulated stablecoins</h2>
        </div>
        <div className="uc-features">
          <div className="uc-feature reveal">
            <h3>MiCA Ready</h3>
            <p>Meet EU Markets in Crypto-Assets regulation with on-chain reserve attestations and transaction screening.</p>
          </div>
          <div className="uc-feature reveal">
            <h3>Hong Kong License</h3>
            <p>Comply with HKMA stablecoin issuer requirements including real-time sanctions screening and audit trails.</p>
          </div>
          <div className="uc-feature reveal">
            <h3>OFAC Screening</h3>
            <p>SDN list checks on every transfer. Updated autonomously via decentralized oracle networks.</p>
          </div>
          <div className="uc-feature reveal">
            <h3>FATF Travel Rule</h3>
            <p>Built-in VASP verification and originator/beneficiary data handling for cross-border transfers.</p>
          </div>
        </div>
      </div>
    </section>

    
    <section className="section">
      <div className="container">
        <div className="cta-section reveal">
          <h2 className="h1">Ready to build a compliant stablecoin?</h2>
          <p>Get access to our SDK, testnet deployment, and compliance documentation.</p>
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
