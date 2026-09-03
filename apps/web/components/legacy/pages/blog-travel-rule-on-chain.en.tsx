/* Hand-written new article — registry-driven, same shape as codemod output. */
const PAGE_CSS = `
.blog-article { padding: 140px 0 60px; }
    .blog-article .container { max-width: 800px; }
    .blog-article h1 { font-size: clamp(1.8rem, 4vw, 2.5rem); font-weight: 700; line-height: 1.2; margin-bottom: 16px; }
    .blog-meta { display: flex; align-items: center; gap: 16px; margin-bottom: 32px; color: var(--text-muted); font-size: 0.875rem; }
    .blog-meta .tag { background: var(--accent-dim); color: var(--accent); padding: 2px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
    .blog-content h2 { font-size: 1.4rem; font-weight: 600; margin: 48px 0 20px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
    .blog-content h3 { font-size: 1.1rem; font-weight: 600; margin: 32px 0 12px; color: var(--accent); }
    .blog-content p { color: var(--text-secondary); line-height: 1.8; margin-bottom: 20px; }
    .blog-content ul, .blog-content ol { color: var(--text-secondary); line-height: 1.8; margin-bottom: 20px; padding-left: 24px; }
    .blog-content li { margin-bottom: 8px; }
    .blog-content code { font-family: var(--font-mono); font-size: 0.85em; background: var(--bg-elevated); padding: 2px 6px; border-radius: 4px; color: var(--accent); }
    .blog-content pre { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 20px; overflow-x: auto; font-family: var(--font-mono); font-size: 0.8rem; line-height: 1.7; color: var(--text-secondary); margin: 20px 0; }
    .blog-content blockquote { border-left: 3px solid var(--accent); padding-left: 20px; margin: 24px 0; color: var(--text-secondary); font-style: italic; }
    .blog-nav { display: flex; justify-content: space-between; margin-top: 48px; padding-top: 32px; border-top: 1px solid var(--border); }
    .blog-nav a { color: var(--accent); font-size: 0.875rem; }
`;

export default function ContentBlogTravelRuleOnChainEN() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

      <article className="blog-article">
        <div className="container">
          <div className="reveal">
            <p className="micro">Blog</p>
            <h1>The Travel Rule On-Chain: What FATF Requires from Stablecoin Transfers</h1>
            <div className="blog-meta">
              <span>August 2026</span>
              <span className="tag">Regulation</span>
              <span>6 min read</span>
            </div>
          </div>

          <div className="blog-content reveal">
            <p>The FATF Travel Rule (Recommendation 16) requires Virtual Asset Service Providers to exchange originator and beneficiary information for transfers above USD 1,000. For stablecoin issuers, this is no longer a theoretical obligation: Hong Kong, the EU under MiCA/TFR, Singapore, and Japan all enforce it in 2026. The open question is architectural — where does Travel Rule compliance actually execute?</p>

            <h2>What the Travel Rule Actually Demands</h2>

            <p>Strip away the legal language and three technical requirements remain:</p>

            <ul>
              <li><strong>Identity binding:</strong> sender and receiver must be attributable to verified identities, not just addresses.</li>
              <li><strong>Pre-transmission screening:</strong> the transfer must be checked before value moves, not flagged after settlement.</li>
              <li><strong>Provable records:</strong> regulators expect tamper-evident evidence that every transfer was screened, with outcomes retained for years.</li>
            </ul>

            <h2>Why API-Centric Architectures Struggle</h2>

            <p>Most VASPs bolt the Travel Rule onto off-chain APIs. That works for custodial order books, but breaks down for on-chain stablecoin transfers:</p>

            <ol>
              <li><strong>Settlement outruns screening.</strong> A transfer confirms in 2-12 seconds; an API round-trip plus a counterparty VASP handshake can take longer. Screening after settlement is not compliance, it is forensics.</li>
              <li><strong>Non-custodial hops escape the model.</strong> The moment funds touch a self-hosted wallet or a DeFi pool, the bilateral VASP-to-VASP message model has no hook to attach to.</li>
              <li><strong>Logs are not proof.</strong> An off-chain screening log can be edited retroactively. Regulators increasingly ask why they should trust it.</li>
            </ol>

            <h2>The On-Chain Enforcement Pattern</h2>

            <p>The alternative is to move the enforcement point into the transfer path itself:</p>

            <ul>
              <li><strong>Identity registries on-chain:</strong> KYC attestations map addresses to verified entities, so identity binding becomes a lookup, not a message exchange.</li>
              <li><strong>Pre-execution policy checks:</strong> the token contract (or a compliance router in front of it) evaluates the risk score and Travel Rule data requirements before the state transition happens. A non-compliant transfer simply reverts — screening cannot be bypassed, delayed, or down.</li>
              <li><strong>Immutable audit events:</strong> every screening decision emits an on-chain event. The audit trail is the chain itself — deterministic, timestamped, and impossible to rewrite.</li>
            </ul>

            <blockquote>When enforcement moves into the execution path, the Travel Rule stops being a reporting obligation you satisfy afterwards and becomes a property of the transfer itself.</blockquote>

            <h2>What This Looks Like in Practice</h2>

            <p>With FidesOrigin, a stablecoin transfer flows through three gates in a single transaction: the risk oracle scores both counterparties, the policy engine evaluates the issuer's rules (jurisdiction, amount tiers, sanctioned entities), and the compliance engine either executes or reverts the transfer while writing the audit event. Total added latency: zero off-chain round-trips.</p>

            <p>For issuers facing Hong Kong's Stablecoin Ordinance, MiCA/TFR, or MAS guidelines, the conclusion is the same: the Travel Rule is solvable at the API layer only for the custodial slice of your flows. Everything that touches open networks needs enforcement where the transfer actually happens — on-chain.</p>
          </div>

          <div className="blog-nav reveal">
            <a href="/blog">← Back to Blog</a>
            <a href="/blog/mica-stablecoin-compliance">Next: MiCA Compliance for Stablecoins →</a>
          </div>
        </div>
      </article>
    </>
  );
}
