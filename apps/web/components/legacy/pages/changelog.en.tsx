/* Auto-generated from public/changelog.html — do not edit by hand. */
const PAGE_CSS = `
.cl-hero { padding: 140px 0 60px; text-align: center; }
    .cl-hero .display { font-size: clamp(2rem, 4.5vw, 3.2rem); }
    .timeline { position: relative; max-width: 800px; margin: 48px auto 0; }
    .timeline::before {
      content: '';
      position: absolute;
      left: 24px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--border);
    }
    .timeline-item {
      position: relative;
      padding-left: 64px;
      padding-bottom: 40px;
    }
    .timeline-item:last-child { padding-bottom: 0; }
    .timeline-dot {
      position: absolute;
      left: 16px;
      top: 4px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--accent);
      border: 3px solid var(--bg);
    }
    .timeline-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 100px;
      font-size: 0.75rem;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .badge-latest { background: var(--accent-dim); color: var(--accent); }
    .badge-major { background: var(--success-dim); color: var(--success); }
    .badge-minor { background: var(--bg-card); color: var(--text-muted); }
    .timeline-item h3 { font-size: 1.1rem; font-weight: 600; margin-bottom: 8px; }
    .timeline-item .date { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px; }
    .timeline-item ul { color: var(--text-secondary); font-size: 0.875rem; line-height: 1.7; padding-left: 18px; }
    .timeline-item li { margin-bottom: 4px; }
    @media (max-width: 600px) {
      .timeline::before { left: 12px; }
      .timeline-item { padding-left: 40px; }
      .timeline-dot { left: 4px; }
    }
`;

export default function ContentChangelogEN() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    <section className="cl-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">Changelog</p>
          <h1 className="display">Protocol <span>evolution</span></h1>
          <p className="lead" style={{ "maxWidth": "600px", "margin": "20px auto 0" }}>Track every milestone, from initial release to the latest security-hardened version.</p>
        </div>
      </div>
    </section>

    <section className="section" style={{ "paddingTop": "0" }}>
      <div className="container">
        <div className="timeline reveal">
          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-latest">Latest</span>
            <h3>v3.1.0 — Security Audit Release</h3>
            <div className="date">August 2026</div>
            <ul>
              <li>Resolved all 53 findings from the independent security audit (6 High / 15 Medium / 26 Low / 6 Info)</li>
              <li>9 breaking changes across contracts, gateway API, and data pipeline — see CHANGELOG.md</li>
              <li>Fresh v3.1.0 contract set deployed on Sepolia; DEPLOYED.md published as the authoritative registry</li>
              <li>449/449 contract tests passing (15 new regression tests added)</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-major">Major</span>
            <h3>v2.8.0 — Real-Time Demo & Multilingual Expansion</h3>
            <div className="date">August 2026</div>
            <ul>
              <li>Live Sepolia demo page with MetaMask wallet integration and multi-RPC fallback</li>
              <li>Address Check V2.1 rewrite: real-time contract queries with Guard status monitoring</li>
              <li>15 new translated pages across CN / TW / JP</li>
              <li>Auto-generated sitemap with hreflang alternates; brand-consistent 404 page</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-major">Major</span>
            <h3>v2.7.0-A+ — Security Hardening</h3>
            <div className="date">August 2026</div>
            <ul>
              <li>A+ security audit report; Cloudflare Workers proxy for security headers</li>
              <li>391 passing contract tests; Subgraph v0.0.4 with Guard entities</li>
              <li>Website v2.1 full rebuild with EN/CN/TW/JP multilingual support</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-major">Major</span>
            <h3>v2.1.0 — Guard Architecture</h3>
            <div className="date">July 2026</div>
            <ul>
              <li>FidesCompliance V2.1 with PreTransactionGuard for zero-gas pre-flight checks</li>
              <li>GNN-powered address profiling</li>
              <li>Pluggable compliance modules via UUPS proxy</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-minor">Minor</span>
            <h3>v2.0.0 — RiskRegistryV2</h3>
            <div className="date">July 2026</div>
            <ul>
              <li>RiskRegistry V2 with CDD labels; PolicyEngine with per-wallet rules</li>
              <li>QuarantineVault for blocked funds; CompliantStableCoin (fUSD)</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-minor">Minor</span>
            <h3>v1.0.0 — Initial Release</h3>
            <div className="date">July 2026</div>
            <ul>
              <li>Initial protocol launch with basic KYC/AML screening</li>
              <li>OFAC blacklist checks; programmable policy rules</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  
    </>
  );
}
