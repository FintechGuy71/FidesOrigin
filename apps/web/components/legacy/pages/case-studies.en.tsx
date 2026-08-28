/* Auto-generated from public/case-studies.html — do not edit by hand. */
export default function ContentCaseStudiesEN() {
  return (
    <>

    <section className="section" style={{ "paddingTop": "140px", "textAlign": "center" }}>
      <div className="container">
        <div className="reveal">
          <p className="micro">Case Studies</p>
          <h1 className="display" style={{ "fontSize": "clamp(2rem, 4.5vw, 3.2rem)" }}>Compliance <span>in production</span></h1>
          <p className="lead" style={{ "maxWidth": "600px", "margin": "20px auto 0" }}>See how protocols are building with deterministic on-chain risk enforcement.</p>
        </div>
      </div>
    </section>

    <section className="section" style={{ "paddingTop": "0" }}>
      <div className="container">
        <div className="case-study-card reveal">
          <div>
            <span className="case-study-tag">Stablecoin</span>
            <h3>GlobalPay USD — MiCA-Compliant Stablecoin</h3>
            <p>GlobalPay launched a EUR-backed stablecoin targeting the EU market. They needed real-time OFAC screening, MiCA reserve attestations, and automated KYC verification — all without introducing centralized infrastructure.</p>
            <p>FidesOrigin's CompliantStableCoin base contract provided deterministic screening on every mint, burn, and transfer. The Policy Engine was configured with MiCA-specific rules: 1:1 reserve requirements, daily transaction limits, and accredited investor checks.</p>
            <div className="case-study-stats">
              <div className="case-study-stat">
                <div className="num">100%</div>
                <div className="label">OFAC Coverage</div>
              </div>
              <div className="case-study-stat">
                <div className="num">&lt;50ms</div>
                <div className="label">Screening Latency</div>
              </div>
              <div className="case-study-stat">
                <div className="num">$2B+</div>
                <div className="label">Protected Volume</div>
              </div>
            </div>
          </div>
          <div className="uc-code">
            <div className="uc-code-header"><span>PolicyConfig.sol</span><span>Solidity</span></div>
            <pre><span className="comment">// MiCA-specific policy configuration</span>
<span className="kw">function</span> <span className="func">configureMicaPolicies</span>() <span className="kw">external</span> &#123;
    policy.<span className="func">setReserveRatio</span>(<span className="num">10000</span>); <span className="comment">// 100%</span>
    policy.<span className="func">setDailyLimit</span>(<span className="num">1_000_000</span> * <span className="num">1e6</span>);
    policy.<span className="func">requireAccredited</span>(<span className="kw">true</span>);
    policy.<span className="func">enableOfacScreening</span>(<span className="kw">true</span>);
&#125;</pre>
          </div>
        </div>

        <div className="case-study-card reverse reveal">
          <div>
            <span className="case-study-tag">RWA</span>
            <h3>RealT — Tokenized Real Estate Compliance</h3>
            <p>RealT tokenizes real estate properties across multiple jurisdictions. Each property has different investor requirements: US accredited investors only for some, EU MiCA for others, and jurisdiction-specific KYC.</p>
            <p>FidesOrigin's multi-policy support allowed RealT to assign different compliance rules per token. The Merkle-based risk registry enabled privacy-preserving verification without revealing investor data on-chain.</p>
            <div className="case-study-stats">
              <div className="case-study-stat">
                <div className="num">15</div>
                <div className="label">Jurisdictions</div>
              </div>
              <div className="case-study-stat">
                <div className="num">0</div>
                <div className="label">Data Leaks</div>
              </div>
              <div className="case-study-stat">
                <div className="num">$50M</div>
                <div className="label">Tokenized Assets</div>
              </div>
            </div>
          </div>
          <div className="uc-code">
            <div className="uc-code-header"><span>MultiPolicy.sol</span><span>Solidity</span></div>
            <pre><span className="comment">// Per-token policy assignment</span>
<span className="kw">function</span> <span className="func">assignPolicy</span>(
    <span className="kw">address</span> token,
    <span className="type">Policy</span> <span className="kw">calldata</span> policy
) <span className="kw">external</span> &#123;
    policies[token] = policy;
    <span className="kw">emit</span> <span className="func">PolicyAssigned</span>(token, policy.id);
&#125;</pre>
          </div>
        </div>

        <div className="case-study-card reveal">
          <div>
            <span className="case-study-tag">Smart Wallet</span>
            <h3>SafeFlow — Account Abstraction with Compliance</h3>
            <p>SafeFlow built an ERC-4337 smart wallet for institutional users. They needed every userOp screened before bundler submission — without adding latency or compromising the account abstraction flow.</p>
            <p>By integrating FidesOrigin at the validation phase, SafeFlow screens all destination addresses and call data before the bundler ever sees the userOp. The integration added less than 10ms to validation time.</p>
            <div className="case-study-stats">
              <div className="case-study-stat">
                <div className="num">&lt;10ms</div>
                <div className="label">Validation Overhead</div>
              </div>
              <div className="case-study-stat">
                <div className="num">50K+</div>
                <div className="label">Wallets Protected</div>
              </div>
              <div className="case-study-stat">
                <div className="num">99.99%</div>
                <div className="label">Uptime</div>
              </div>
            </div>
          </div>
          <div className="uc-code">
            <div className="uc-code-header"><span>SafeFlowValidation.sol</span><span>Solidity</span></div>
            <pre><span className="comment">// Validate before bundler acceptance</span>
<span className="kw">function</span> <span className="func">validateUserOp</span>(
    <span className="type">UserOperation</span> <span className="kw">calldata</span> userOp
) <span className="kw">external</span> <span className="kw">override</span> <span className="kw">returns</span> (<span className="kw">uint256</span>) &#123;
    <span className="kw">require</span>(
        fides.<span className="func">isCompliant</span>(userOp),
        <span className="str">"Non-compliant userOp"</span>
    );
    <span className="kw">return</span> <span className="func">_validateSignature</span>(userOp);
&#125;</pre>
          </div>
        </div>
      </div>
    </section>

    <section className="section bg-secondary">
      <div className="container">
        <div className="reveal section-intro">
          <p className="micro">Testimonials</p>
          <h2 className="h2 section-title">What builders say</h2>
        </div>
        <div className="features-grid" style={{ "marginTop": "48px" }}>
          <div className="testimonial reveal">
            <p className="testimonial-text">"FidesOrigin solved our biggest compliance headache. Before, we were screening via API calls that added 300ms latency and occasionally failed. Now every transaction is screened deterministically on-chain — our users don't even notice it's there."</p>
            <div className="testimonial-author">
              <div className="testimonial-avatar">AL</div>
              <div className="testimonial-info">
                <h4>Alex L.</h4>
                <p>CTO, GlobalPay USD</p>
              </div>
            </div>
          </div>
          <div className="testimonial reveal">
            <p className="testimonial-text">"The Merkle-based privacy approach is exactly what we needed. We can prove compliance to regulators without exposing sensitive investor data on-chain. It's the first solution that actually understands both DeFi and privacy."</p>
            <div className="testimonial-author">
              <div className="testimonial-avatar">SM</div>
              <div className="testimonial-info">
                <h4>Sarah M.</h4>
                <p>Head of Compliance, RealT</p>
              </div>
            </div>
          </div>
          <div className="testimonial reveal">
            <p className="testimonial-text">"Integrating compliance into ERC-4337 was supposed to be impossible. FidesOrigin proved it wasn't — we had it working in a weekend. The validation-phase hook means zero UX impact for our users."</p>
            <div className="testimonial-author">
              <div className="testimonial-avatar">DK</div>
              <div className="testimonial-info">
                <h4>David K.</h4>
                <p>Lead Engineer, SafeFlow</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container">
        <div className="cta-section reveal">
          <h2 className="h1">Ready to become our next case study?</h2>
          <p>Get in touch to discuss your compliance needs.</p>
          <div className="cta-buttons">
            <a href="/contact" className="btn btn-primary">Contact Sales</a>
            <a href="/demo" className="btn btn-secondary">Try Demo</a>
          </div>
        </div>
      </div>
    </section>
  
    </>
  );
}
