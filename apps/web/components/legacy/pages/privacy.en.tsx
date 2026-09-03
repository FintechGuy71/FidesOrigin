/* Auto-generated from public/privacy.html — do not edit by hand. */
const PAGE_CSS = `
.legal-page { padding: 120px 0 80px; }
    .legal-page .container { max-width: 800px; }
    .legal-page h1 { font-size: clamp(1.8rem, 4vw, 2.5rem); font-weight: 700; margin-bottom: 0.5rem; letter-spacing: -0.02em; }
    .legal-page .last-updated { color: var(--text-secondary); margin-bottom: 3rem; font-size: 0.9rem; }
    .legal-section { margin-bottom: 2.5rem; }
    .legal-section h2 { font-size: 1.15rem; font-weight: 600; margin-bottom: 1rem; color: var(--text); }
    .legal-section p, .legal-section li { color: var(--text-secondary); line-height: 1.7; margin-bottom: 0.75rem; }
    .legal-section ul { padding-left: 1.5rem; margin-bottom: 1rem; }
    .legal-section a { color: var(--accent); transition: opacity 0.2s; }
    .legal-section a:hover { opacity: 0.8; text-decoration: underline; }
    .legal-section strong { color: var(--text); font-weight: 600; }
    @media (max-width: 768px) {
      .legal-page { padding: 100px 0 60px; }
    }
`;

export default function ContentPrivacyEN() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />
<div className="legal-page">
    <div className="container">
      <h1>Privacy Policy</h1>
      <p className="last-updated">Last updated: July 2026</p>

      <section className="legal-section">
        <h2>1. Overview</h2>
        <p>FidesOrigin is an on-chain compliance protocol. By design, we minimize data collection. This policy explains what limited data we handle and how we protect it.</p>
      </section>

      <section className="legal-section">
        <h2>2. Information We Collect</h2>
        <p><strong>On-chain data:</strong> All risk assessments and compliance checks happen on-chain. Transaction data is public by nature of blockchain technology and is not collected by us.</p>
        <p><strong>Website analytics:</strong> We use minimal analytics to understand website usage. This may include IP address (anonymized), browser type, and pages visited.</p>
        <p><strong>Wallet connections:</strong> When you connect a wallet, we only read your public address. We never request transaction signing or access to private keys.</p>
      </section>

      <section className="legal-section">
        <h2>3. How We Use Information</h2>
        <ul>
          <li>To provide and improve our services</li>
          <li>To respond to support requests</li>
          <li>To analyze website usage patterns</li>
          <li>To comply with legal obligations</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>4. Cookies</h2>
        <p>We use essential cookies for website functionality. We do not use tracking cookies for advertising purposes. You can disable cookies in your browser settings.</p>
      </section>

      <section className="legal-section">
        <h2>5. Third-Party Services</h2>
        <p>We use the following third-party services:</p>
        <ul>
          <li><strong>Vercel:</strong> Website hosting</li>
          <li><strong>The Graph:</strong> Blockchain data indexing</li>
          <li><strong>RPC Providers:</strong> Blockchain node access</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>6. Data Security</h2>
        <p>We implement industry-standard security measures. However, no system is completely secure. Users are responsible for securing their own wallet private keys.</p>
      </section>

      <section className="legal-section">
        <h2>7. Your Rights</h2>
        <p>Depending on your jurisdiction, you may have rights to access, correct, or delete your personal data. Contact us at <a href="mailto:privacy@fidesorigin.com">privacy@fidesorigin.com</a>.</p>
      </section>

      <section className="legal-section">
        <h2>8. Changes to This Policy</h2>
        <p>We may update this policy from time to time. Changes will be posted on this page with an updated date.</p>
      </section>

      <section className="legal-section">
        <h2>9. Contact</h2>
        <p>For privacy-related questions, contact us at <a href="mailto:privacy@fidesorigin.com">privacy@fidesorigin.com</a>.</p>
      </section>
    </div>
  </div>
    </>
  );
}
