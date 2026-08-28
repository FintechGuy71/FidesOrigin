/* Auto-generated from public/jp/security.html — do not edit by hand. */
const PAGE_CSS = `
.sec-hero { padding: 140px 0 60px; text-align: center; }
    .sec-hero .display { font-size: clamp(2rem, 4.5vw, 3.2rem); }
    .audit-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 24px;
      margin-top: 48px;
    }
    .audit-stat {
      padding: 32px 24px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      text-align: center;
    }
    .audit-stat .num {
      font-size: 2.5rem;
      font-weight: 800;
      background: linear-gradient(135deg, var(--gold) 0%, var(--accent) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .audit-stat .label { font-size: 0.875rem; color: var(--text-secondary); margin-top: 4px; }
    .audit-card {
      padding: 32px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      margin-bottom: 24px;
    }
    .audit-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .audit-card h3 { font-size: 1.25rem; font-weight: 600; }
    .audit-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 100px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge-success { background: rgba(74,222,128,0.12); color: var(--success); }
    .audit-list { list-style: none; padding: 0; }
    .audit-list li {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      font-size: 0.875rem;
      color: var(--text-secondary);
    }
    .audit-list li:last-child { border-bottom: none; }
    .severity {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      flex-shrink: 0;
    }
    .sev-critical { background: rgba(248,113,113,0.15); color: var(--danger); }
    .sev-high { background: rgba(251,191,36,0.15); color: var(--warning); }
    .sev-medium { background: rgba(99,102,241,0.15); color: #818cf8; }
    .sev-low { background: rgba(74,222,128,0.12); color: var(--success); }
    .security-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-top: 48px;
    }
    .security-item {
      padding: 28px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
    }
    .security-item h3 { font-size: 1rem; font-weight: 600; margin: 12px 0 8px; }
    .security-item p { font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6; }
    .security-icon {
      width: 44px; height: 44px;
      border-radius: var(--radius-sm);
      background: var(--accent-dim);
      color: var(--accent);
      display: flex; align-items: center; justify-content: center;
    }
    .security-icon svg { width: 22px; height: 22px; }
    @media (max-width: 900px) {
      .audit-stats { grid-template-columns: repeat(2, 1fr); }
      .security-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 480px) {
      .audit-stats { grid-template-columns: 1fr; }
    }
`;

export default function ContentSecurityJP() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />

    
    <section className="sec-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">セキュリティ</p>
          <h1 className="display">Triple-audited, <span>実績を持つ</span></h1>
          <p className="lead" style={{ "maxWidth": "600px", "margin": "20px auto 0" }}>Three rounds of independent security audits. 300+ findings identified and resolved. Production-ready infrastructure.</p>
        </div>
        <div className="audit-stats reveal">
          <div className="audit-stat">
            <div className="num">3</div>
            <div className="label">Audit Rounds</div>
          </div>
          <div className="audit-stat">
            <div className="num">300+</div>
            <div className="label">Findings Resolved</div>
          </div>
          <div className="audit-stat">
            <div className="num">391</div>
            <div className="label">Tests Passing</div>
          </div>
          <div className="audit-stat">
            <div className="num">0</div>
            <div className="label">Critical Issues Open</div>
          </div>
        </div>
      </div>
    </section>

    
    <section className="section bg-secondary">
      <div className="container">
        <div className="reveal section-intro">
          <p className="micro">Audit History</p>
          <h2 className="h2 section-title">Comprehensive security review</h2>
        </div>

        <div className="audit-card reveal">
          <div className="audit-card-header">
            <h3>Round 1 — General Security Audit</h3>
            <span className="audit-badge badge-success">Completed</span>
          </div>
          <p style={{ "color": "var(--text-secondary)", "fontSize": "0.875rem", "marginBottom": "16px" }}>Comprehensive review of smart contract security, access controls, and economic vulnerabilities. 158 findings identified.</p>
          <ul className="audit-list">
            <li><span className="severity sev-critical">Critical</span> Diamond Storage collision in BaseFacet — resolved by migrating to Diamond Storage pattern</li>
            <li><span className="severity sev-high">High</span> claimFunds overflow panic — fixed overflow in timestamp calculation</li>
            <li><span className="severity sev-high">High</span> postTransferHook access control — restored proper permission checks</li>
            <li><span className="severity sev-medium">Medium</span> DiamondCut proposal cancellation — added cancelDiamondCutProposal()</li>
            <li><span className="severity sev-medium">Medium</span> CompliantStableCoin silent failures — removed OPERATOR_ROLE dependency</li>
          </ul>
        </div>

        <div className="audit-card reveal">
          <div className="audit-card-header">
            <h3>Round 2 — General Security Audit</h3>
            <span className="audit-badge badge-success">Completed</span>
          </div>
          <p style={{ "color": "var(--text-secondary)", "fontSize": "0.875rem", "marginBottom": "16px" }}>Second pass focusing on frontend, backend, and infrastructure security. 117+ findings identified and resolved.</p>
          <ul className="audit-list">
            <li><span className="severity sev-high">High</span> CacheService.get() crash — removed invalid .decode() calls</li>
            <li><span className="severity sev-high">High</span> JWT token type validation — added type verification</li>
            <li><span className="severity sev-medium">Medium</span> ContextVar singleton fix — module-level instance</li>
            <li><span className="severity sev-medium">Medium</span> Login response validation — fixed Pydantic schema</li>
            <li><span className="severity sev-medium">Medium</span> WebSocket pre-authentication — added connection limits</li>
          </ul>
        </div>

        <div className="audit-card reveal">
          <div className="audit-card-header">
            <h3>Round 3 — Best Practice Audit</h3>
            <span className="audit-badge badge-success">Completed</span>
          </div>
          <p style={{ "color": "var(--text-secondary)", "fontSize": "0.875rem", "marginBottom": "16px" }}>CertiK / OpenZeppelin / Stripe / CNCF / NIST best practices. 28+ findings resolved.</p>
          <ul className="audit-list">
            <li><span className="severity sev-medium">Medium</span> K8s Role permissions — restricted to specific Secret get</li>
            <li><span className="severity sev-medium">Medium</span> Container image pinning — added BASE_IMAGE build-arg</li>
            <li><span className="severity sev-low">Low</span> CI audit strictness — removed || true from pnpm audit</li>
            <li><span className="severity sev-low">Low</span> Git cleanup — added deployment artifacts to .gitignore</li>
            <li><span className="severity sev-low">Low</span> CSP nonce generation — per-request instead of hardcoded</li>
          </ul>
        </div>
      </div>
    </section>

    
    <section className="section">
      <div className="container">
        <div className="reveal section-intro">
          <p className="micro">Security Features</p>
          <h2 className="h2 section-title">Defense in depth</h2>
        </div>
        <div className="security-grid">
          <div className="security-item reveal">
            <div className="security-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <h3>Multi-Sig Governance</h3>
            <p>All contract upgrades require Gnosis Safe multi-signature approval with timelock delays.</p>
          </div>
          <div className="security-item reveal">
            <div className="security-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <h3>Timelock Protection</h3>
            <p>48-hour timelock on all sensitive operations. Transparent, reviewable, and cancellable.</p>
          </div>
          <div className="security-item reveal">
            <div className="security-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h3>Real-Time Monitoring</h3>
            <p>Forta bots monitor all contract interactions. Instant alerts on anomalies or attack patterns.</p>
          </div>
          <div className="security-item reveal">
            <div className="security-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <h3>Transparent Verification</h3>
            <p>All contracts verified on Etherscan. Source code open on GitHub. Nothing hidden.</p>
          </div>
          <div className="security-item reveal">
            <div className="security-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
            </div>
            <h3>Diamond Architecture</h3>
            <p>Upgradeable diamond pattern allows feature additions without proxy risks.</p>
          </div>
          <div className="security-item reveal">
            <div className="security-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            </div>
            <h3>Access Control</h3>
            <p>Role-based permissions (OpenZeppelin AccessControl). No single point of compromise.</p>
          </div>
        </div>
      </div>
    </section>
  
    </>
  );
}
