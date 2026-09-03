/* Auto-generated from public/contact.html — do not edit by hand. */
export default function ContentContactEN() {
  return (
    <>

    <section className="section" style={{ "paddingTop": "140px" }}>
      <div className="container">
        <div className="reveal" style={{ "textAlign": "center", "maxWidth": "600px", "margin": "0 auto" }}>
          <p className="micro">Contact</p>
          <h1 className="display" style={{ "fontSize": "clamp(2rem, 4.5vw, 3.2rem)" }}>Let's build <span>together</span></h1>
          <p className="lead" style={{ "marginTop": "20px" }}>Tell us about your compliance needs and we'll get back within 24 hours.</p>
        </div>
      </div>
    </section>

    <section className="section" style={{ "paddingTop": "0" }}>
      <div className="container">
        <div className="contact-form reveal">
          {/* ⚠ 原 action 是 Formspree 占位端点 "https://formspree.io/f/YOUR_FORM_ID"：
              用户点「Send Message」后既不会成功、也没有任何失败提示 ——
              联系表单这个页面唯一的核心功能实际上是失效的。
              在配置真实收单服务之前，这里降级为 mailto: 提交
              （encType="text/plain" 是 mailto 表单的必需项，否则正文为空）。
              TODO(业务): 接入真实收单端点后替换 action，并补前端成功/失败提示。 */}
          <form
            id="contactForm"
            action="mailto:contact@fidesorigin.com"
            method="POST"
            encType="text/plain"
          >
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input type="text" id="name" name="name" className="form-input" placeholder="John Doe" required />
            </div>
            <div className="form-group">
              <label htmlFor="email">Work Email</label>
              <input type="email" id="email" name="email" className="form-input" placeholder="john@company.com" required />
            </div>
            <div className="form-group">
              <label htmlFor="company">Company</label>
              <input type="text" id="company" name="company" className="form-input" placeholder="Acme Inc." />
            </div>
            <div className="form-group">
              <label htmlFor="use-case">Use Case</label>
              <select id="use-case" name="use-case" className="form-select">
                <option value="">Select your use case</option>
                <option value="stablecoin">Stablecoin Issuance</option>
                <option value="rwa">RWA Tokenization</option>
                <option value="smart-wallet">Smart Wallet</option>
                <option value="defi">DeFi Protocol</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="message">Message</label>
              <textarea id="message" name="message" className="form-input" placeholder="Tell us about your project and compliance requirements..."></textarea>
            </div>
            <button type="submit" className="btn btn-primary" style={{ "width": "100%", "justifyContent": "center" }}>Send Message</button>
            <p style={{ "textAlign": "center", "marginTop": "16px", "fontSize": "0.8rem", "color": "var(--text-muted)" }}>Prefer email? Reach us at <a href="mailto:contact@fidesorigin.com" style={{ "color": "var(--accent)" }}>contact@fidesorigin.com</a></p>
          </form>
        </div>
      </div>
    </section>

    <section className="section bg-secondary">
      <div className="container">
        <div className="reveal section-intro">
          <p className="micro">Other Ways to Connect</p>
          <h2 className="h2 section-title">Join the community</h2>
        </div>
        <div className="features-grid" style={{ "marginTop": "48px" }}>
          <div className="feature-card reveal">
            <div className="feature-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
            </div>
            <h3>GitHub</h3>
            <p>Explore our open-source contracts, SDK, and documentation.</p>
            <a href="https://github.com/FintechGuy71/FidesOrigin" target="_blank" rel="noopener" style={{ "color": "var(--accent)", "fontSize": "0.875rem" }}>View on GitHub →</a>
          </div>
          <div className="feature-card reveal">
            <div className="feature-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
            <h3>Discord</h3>
            <p>Join our developer community for support and discussions.</p>
            {/* 原为 <a href="#">：点击跳到页首并污染 history。
               社群频道尚未开通，改为不可聚焦的占位文本。 */}
            <span
              aria-disabled="true"
              style={{ "color": "var(--text-muted)", "fontSize": "0.875rem" }}
            >
              Coming Soon
            </span>
          </div>
          <div className="feature-card reveal">
            <div className="feature-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <h3>Email</h3>
            <p>For partnerships, press, and general inquiries.</p>
            <a href="mailto:contact@fidesorigin.com" style={{ "color": "var(--accent)", "fontSize": "0.875rem" }}>contact@fidesorigin.com</a>
          </div>
        </div>
      </div>
    </section>
  
    </>
  );
}
