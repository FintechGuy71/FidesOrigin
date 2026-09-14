/* Auto-generated from public/case-studies.html — do not edit by hand. */
import Link from "next/link";

export default function ContentCaseStudiesEN() {
  return (
    <>

    <section className="section" style={{ "paddingTop": "140px", "textAlign": "center" }}>
      <div className="container">
        <div className="reveal">
          <p className="micro">Case Studies</p>
          <h1 className="display" style={{ "fontSize": "clamp(2rem, 4.5vw, 3.2rem)" }}>Compliance <span>in production</span></h1>
          <p className="lead" style={{ "maxWidth": "600px", "margin": "20px auto 0" }}>See how protocols are building with deterministic on-chain risk enforcement.</p>
          <p style={{ "fontSize": "0.8rem", "color": "var(--text-muted)", "marginTop": "12px", "fontStyle": "normal" }}>Illustrative scenarios based on typical deployment patterns. Names are anonymized composites.</p>
        </div>
      </div>
    </section>

    <section className="section" style={{ "paddingTop": "0" }}>
      <div className="container">
        <div className="case-study-card reveal">
          <div>
            <span className="case-study-tag">Stablecoin</span>
            <h3>European Stablecoin Issuer — MiCA-Ready Deployment</h3>
            <p>A European issuer launched a EUR-backed stablecoin targeting the EU market. They needed real-time OFAC screening, MiCA reserve attestations, and automated KYC verification — all without introducing centralized infrastructure.</p>
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
            <svg viewBox="0 0 320 96" aria-hidden="true" style={{"marginTop":"28px","width":"100%","maxWidth":"320px"}}>
              <circle cx="48" cy="48" r="34" fill="none" stroke="var(--fio-surface-3)" strokeWidth="4" />
              <circle cx="48" cy="48" r="34" fill="none" stroke="var(--fio-gold)" strokeWidth="4" strokeLinecap="round" transform="rotate(-90 48 48)" />
              <text x="48" y="53" textAnchor="middle" fill="var(--fio-cream)" fontSize="17" fontFamily="var(--font-mono)" fontWeight="600">100%</text>
              <line x1="104" y1="28" x2="300" y2="28" stroke="var(--fio-border-light)" strokeWidth="1" />
              <line x1="104" y1="48" x2="260" y2="48" stroke="var(--fio-border-light)" strokeWidth="1" />
              <line x1="104" y1="68" x2="284" y2="68" stroke="var(--fio-border-light)" strokeWidth="1" />
              <circle cx="104" cy="28" r="3" fill="var(--fio-gold)" />
              <circle cx="104" cy="48" r="3" fill="var(--fio-gold)" />
              <circle cx="104" cy="68" r="3" fill="var(--fio-gold)" />
            </svg>
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
            <h3>Tokenized Real Estate Platform — Multi-Jurisdiction Compliance</h3>
            <p>A tokenization platform issues real estate assets across multiple jurisdictions. Each property has different investor requirements: US accredited investors only for some, EU MiCA for others, and jurisdiction-specific KYC.</p>
            <p>FidesOrigin's multi-policy support allowed the platform to assign different compliance rules per token. The Merkle-based risk registry enabled privacy-preserving verification without revealing investor data on-chain.</p>
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
            <svg viewBox="0 0 320 96" aria-hidden="true" style={{"marginTop":"28px","width":"100%","maxWidth":"320px"}}>
              <rect x="8" y="8" width="304" height="80" fill="none" stroke="var(--fio-border-light)" strokeWidth="1" />
              <circle cx="34" cy="26" r="4" fill="var(--fio-gold)" opacity="0.35" />
              <circle cx="96" cy="26" r="4" fill="var(--fio-gold)" opacity="1" />
              <circle cx="158" cy="26" r="4" fill="var(--fio-gold)" opacity="1" />
              <circle cx="220" cy="26" r="4" fill="var(--fio-gold)" opacity="1" />
              <circle cx="282" cy="26" r="4" fill="var(--fio-gold)" opacity="0.35" />
              <circle cx="34" cy="50" r="4" fill="var(--fio-gold)" opacity="1" />
              <circle cx="96" cy="50" r="4" fill="var(--fio-gold)" opacity="1" />
              <circle cx="158" cy="50" r="4" fill="var(--fio-gold)" opacity="1" />
              <circle cx="220" cy="50" r="4" fill="var(--fio-gold)" opacity="0.35" />
              <circle cx="282" cy="50" r="4" fill="var(--fio-gold)" opacity="1" />
              <circle cx="34" cy="74" r="4" fill="var(--fio-gold)" opacity="1" />
              <circle cx="96" cy="74" r="4" fill="var(--fio-gold)" opacity="1" />
              <circle cx="158" cy="74" r="4" fill="var(--fio-gold)" opacity="0.35" />
              <circle cx="220" cy="74" r="4" fill="var(--fio-gold)" opacity="1" />
              <circle cx="282" cy="74" r="4" fill="var(--fio-gold)" opacity="1" />
            </svg>
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
            <h3>Institutional Smart Wallet — ERC-4337 with Compliance</h3>
            <p>An institutional wallet team built an ERC-4337 smart wallet for professional users. They needed every userOp screened before bundler submission — without adding latency or compromising the account abstraction flow.</p>
            <p>By integrating FidesOrigin at the validation phase, the wallet screens all destination addresses and call data before the bundler ever sees the userOp. The integration added less than 10ms to validation time.</p>
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
            <svg viewBox="0 0 320 96" aria-hidden="true" style={{"marginTop":"28px","width":"100%","maxWidth":"320px"}}>
              <line x1="16" y1="34" x2="304" y2="34" stroke="var(--fio-surface-3)" strokeWidth="6" strokeLinecap="round" />
              <line x1="16" y1="66" x2="40" y2="66" stroke="var(--fio-gold)" strokeWidth="6" strokeLinecap="round" />
              <text x="52" y="70" fill="var(--fio-cream)" fontSize="13" fontFamily="var(--font-mono)" fontWeight="600">&lt;10ms</text>
              <text x="16" y="22" fill="var(--fio-text-3)" fontSize="10" fontFamily="var(--font-mono)">MANUAL</text>
              <circle cx="16" cy="66" r="4" fill="var(--fio-cream)" />
            </svg>
          </div>
          <div className="uc-code">
            <div className="uc-code-header"><span>WalletValidation.sol</span><span>Solidity</span></div>
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
                <p>CTO, European Stablecoin Issuer</p>
              </div>
            </div>
          </div>
          <div className="testimonial reveal">
            <p className="testimonial-text">"The Merkle-based privacy approach is exactly what we needed. We can prove compliance to regulators without exposing sensitive investor data on-chain. It's the first solution that actually understands both DeFi and privacy."</p>
            <div className="testimonial-author">
              <div className="testimonial-avatar">SM</div>
              <div className="testimonial-info">
                <h4>Sarah M.</h4>
                <p>Head of Compliance, RWA Platform</p>
              </div>
            </div>
          </div>
          <div className="testimonial reveal">
            <p className="testimonial-text">"Integrating compliance into ERC-4337 was supposed to be impossible. FidesOrigin proved it wasn't — we had it working in a weekend. The validation-phase hook means zero UX impact for our users."</p>
            <div className="testimonial-author">
              <div className="testimonial-avatar">DK</div>
              <div className="testimonial-info">
                <h4>David K.</h4>
                <p>Lead Engineer, Smart Wallet Team</p>
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
            <Link href="/contact" className="btn btn-primary" prefetch={false}>Contact Sales</Link>
            <Link href="/demo" className="btn btn-secondary" prefetch={false}>Try Demo</Link>
          </div>
        </div>
      </div>
    </section>
  
    </>
  );
}
