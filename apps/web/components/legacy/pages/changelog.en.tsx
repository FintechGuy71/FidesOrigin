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
    .badge-major { background: rgba(74,222,128,0.12); color: var(--success); }
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
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />

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
            <h3>v3.3 — Regulatory Templates</h3>
            <div className="date">July 2026</div>
            <ul>
              <li>Added MiCA and HKMA compliance templates for stablecoin issuers</li>
              <li>Enhanced PolicyEngine with jurisdiction-based rule sets</li>
              <li>Released interactive demo on Sepolia testnet</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-major">Major</span>
            <h3>v3.2 — Monitoring & Indexing</h3>
            <div className="date">March 2026</div>
            <ul>
              <li>Launched The Graph subgraph for indexed on-chain events</li>
              <li>Deployed Forta monitoring bots for real-time anomaly detection</li>
              <li>Added WebSocket streaming for live risk updates</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-major">Major</span>
            <h3>v3.1 — Security Audit Complete</h3>
            <div className="date">January 2026</div>
            <ul>
              <li>Completed 3 rounds of independent security audits</li>
              <li>Resolved 300+ findings across contracts, backend, and infrastructure</li>
              <li>391 tests passing, 0 critical issues open</li>
              <li>Achieved 99.9% test coverage on core contracts</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-major">Major</span>
            <h3>v3.0 — Diamond Architecture</h3>
            <div className="date">October 2025</div>
            <ul>
              <li>Migrated to EIP-2535 Diamond pattern for upgradeable facets</li>
              <li>Added multi-chain support (Ethereum, Base, Arbitrum)</li>
              <li>Introduced QuarantineVault for suspicious transaction escrow</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-minor">Minor</span>
            <h3>v2.0 — RiskRegistryV2</h3>
            <div className="date">June 2025</div>
            <ul>
              <li>Upgraded RiskRegistry with Merkle-proof based risk commitments</li>
              <li>Enhanced PolicyEngine with configurable rule templates</li>
              <li>Added batch address screening API</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-minor">Minor</span>
            <h3>v1.0 — Initial Release</h3>
            <div className="date">January 2025</div>
            <ul>
              <li>Launched FidesOrigin protocol on Sepolia testnet</li>
              <li>Released RiskRegistry and ComplianceEngine contracts</li>
              <li>Published TypeScript SDK and REST API</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  
    </>
  );
}
