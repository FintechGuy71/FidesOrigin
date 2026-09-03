/* Auto-generated from public/blog/ofac-sanctions-screening-blockchain.html — do not edit by hand. */
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
    .blog-content blockquote { border-left: 3px solid var(--accent); padding-left: 20px; margin: 24px 0; color: var(--text-secondary); font-style: italic; }
    .blog-nav { display: flex; justify-content: space-between; margin-top: 48px; padding-top: 32px; border-top: 1px solid var(--border); }
    .blog-nav a { color: var(--accent); font-size: 0.875rem; }
`;

export default function ContentBlogOfacSanctionsScreeningBlockchainEN() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    <article className="blog-article">
      <div className="container">
        <div className="reveal">
          <p className="micro">Blog</p>
          <h1>OFAC Sanctions Screening on Blockchain: Best Practices</h1>
          <div className="blog-meta">
            <span>July 2026</span>
            <span className="tag">Compliance</span>
            <span>7 min read</span>
          </div>
        </div>

        <div className="blog-content reveal">
          <p>The Office of Foreign Assets Control (OFAC) maintains the Specially Designated Nationals (SDN) list — a compilation of individuals, entities, and addresses that US persons are prohibited from transacting with. For blockchain protocols, this creates unique challenges that traditional financial institutions don't face.</p>

          <h2>The Challenge of On-Chain Sanctions Screening</h2>

          <p>Unlike traditional finance where transactions flow through intermediaries, blockchain transactions are peer-to-peer. There is no bank to stop a transaction before it settles. This means compliance must be embedded at the protocol level:</p>

          <ul>
            <li><strong>Pre-transaction screening:</strong> Every transfer must be evaluated before execution</li>
            <li><strong>Non-custodial environments:</strong> No central authority holds funds or controls access</li>
            <li><strong>Pseudonymity:</strong> Addresses don't map 1:1 to real-world identities</li>
            <li><strong>Irreversibility:</strong> Once a transaction is mined, it cannot be undone</li>
          </ul>

          <h2>Best Practice #1: On-Chain Enforcement</h2>

          <p>The most robust approach is to embed sanctions screening directly into the smart contract. This ensures:</p>

          <ol>
            <li><strong>Determinism:</strong> Every transaction is screened under identical rules</li>
            <li><strong>No Bypass:</strong> Even direct contract calls trigger compliance checks</li>
            <li><strong>Auditability:</strong> Screening decisions are permanently recorded on-chain</li>
            <li><strong>Availability:</strong> No dependency on external APIs that could fail</li>
          </ol>

          <h2>Best Practice #2: Risk Tiers, Not Binary Blocks</h2>

          <p>A sophisticated approach uses risk tiers rather than simple allow/block:</p>

          <ul>
            <li><strong>UNKNOWN:</strong> New addresses with no history — require additional verification</li>
            <li><strong>LOW:</strong> No flags detected — allow with standard limits</li>
            <li><strong>MEDIUM:</strong> Some risk indicators — enhanced monitoring</li>
            <li><strong>HIGH:</strong> Significant risk — quarantine for manual review</li>
            <li><strong>CRITICAL:</strong> Sanctions match — block and alert</li>
          </ul>

          <h2>Best Practice #3: Keep Data Fresh</h2>

          <p>OFAC updates the SDN list regularly. On-chain registries must be updated autonomously. FidesOrigin uses Chainlink Functions to fetch the latest sanctions data and update the on-chain RiskRegistry without manual intervention.</p>

          <h2>Best Practice #4: Quarantine Over Block</h2>

          <p>Instead of outright blocking transactions (which can create UX issues and false positives), consider a quarantine mechanism:</p>

          <blockquote>"A quarantine vault holds suspicious funds for review rather than rejecting them outright. This reduces false positives while maintaining compliance."</blockquote>

          <h2>Conclusion</h2>

          <p>OFAC compliance on blockchain is not optional — it's a legal requirement for any protocol operating in or serving US persons. The question is not whether to comply, but how to do so without compromising the benefits of decentralization. On-chain enforcement is the answer.</p>
        </div>

        <div className="blog-nav reveal">
          <a href="/blog">← All Articles</a>
          <a href="/blog/hong-kong-stablecoin-license">Next: HK License →</a>
        </div>
      </div>
    </article>
  
    </>
  );
}
