"use client";

/* 联系表单——真实收单版（本轮重写）。
   原 "Auto-generated from public/contact.html" 注释已过时：源文件 public/contact.html
   并不存在（生成器也找不到），本文件现为手维护的真实收单实现。 */
import { useState } from "react";

type SubmitStatus = "idle" | "submitting" | "success" | "error";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://fidesorigin-api.vercel.app/v1";

export default function ContentContactEN() {
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setStatus("submitting");
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          email: fd.get("email"),
          company: fd.get("company") || "",
          use_case: fd.get("use-case") || "",
          message: fd.get("message") || "",
          website: fd.get("website") || "", // 蜜罐字段，正常用户留空
        }),
      });
      if (res.ok) {
        setStatus("success");
        form.reset();
      } else if (res.status === 400) {
        setStatus("error");
        setErrorMsg("Please check your input and try again.");
      } else if (res.status === 429) {
        setStatus("error");
        setErrorMsg("Too many submissions. Please try again later.");
      } else {
        setStatus("error");
        setErrorMsg("Server error. Please try again later.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again later.");
    }
  };

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
          {/* 真实收单：POST 网关 /contact；mailto 仅作失败时的降级链接。 */}
          <form
            id="contactForm"
            onSubmit={handleSubmit}
          >
            {/* 蜜罐字段：正常用户不可见不填写，机器人填了后端直接拒绝 */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ "position": "absolute", "left": "-9999px", "opacity": 0, "height": 0, "width": 0 }}
            />
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
            <button
              type="submit"
              className="btn btn-primary"
              style={{ "width": "100%", "justifyContent": "center" }}
              disabled={status === "submitting"}
            >
              {status === "submitting" ? "Sending..." : "Send Message"}
            </button>
            {status === "success" && (
              <p role="status" style={{ "textAlign": "center", "marginTop": "16px", "fontSize": "0.9rem", "color": "var(--fio-success)" }}>
                Message sent! We&apos;ll get back to you within 24 hours.
              </p>
            )}
            {status === "error" && (
              <p role="alert" style={{ "textAlign": "center", "marginTop": "16px", "fontSize": "0.9rem", "color": "var(--fio-danger)" }}>
                {errorMsg}{" "}
                或直接邮件 <a href="mailto:contact@fidesorigin.com" style={{ "color": "var(--accent)" }}>contact@fidesorigin.com</a>
              </p>
            )}
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
