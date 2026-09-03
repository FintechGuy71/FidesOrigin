/* Auto-generated from public/cn/privacy.html — do not edit by hand. */
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

export default function ContentPrivacyCN() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />
<div className="legal-page">
    <div className="container">
      <h1>隐私政策</h1>
      <p className="last-updated">最后更新：2026年7月</p>

      <section className="legal-section">
        <h2>1. 概述</h2>
        <p>FidesOrigin 是一个链上合规协议。根据设计，我们最小化数据收集。本政策解释我们处理的有限数据以及如何保护这些数据。</p>
      </section>

      <section className="legal-section">
        <h2>2. 我们收集的信息</h2>
        <p><strong>链上数据：</strong>所有风险评估和合规检查都在链上进行。交易数据根据区块链技术的本质是公开的，不由我们收集。</p>
        <p><strong>网站分析：</strong>我们使用最低限度的分析来了解网站使用情况。这可能包括 IP 地址（匿名化）、浏览器类型和访问的页面。</p>
        <p><strong>钱包连接：</strong>当您连接钱包时，我们只读取您的公开地址。我们从不请求交易签名或访问私钥。</p>
      </section>

      <section className="legal-section">
        <h2>3. 我们如何使用信息</h2>
        <ul>
          <li>提供和改进我们的服务</li>
          <li>响应支持请求</li>
          <li>分析网站使用模式</li>
          <li>遵守法律义务</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>4. Cookie</h2>
        <p>我们使用必要的 Cookie 来实现网站功能。我们不使用跟踪 Cookie 进行广告目的。您可以在浏览器设置中禁用 Cookie。</p>
      </section>

      <section className="legal-section">
        <h2>5. 第三方服务</h2>
        <p>我们使用以下第三方服务：</p>
        <ul>
          <li><strong>Vercel：</strong>网站托管</li>
          <li><strong>The Graph：</strong>区块链数据索引</li>
          <li><strong>RPC 提供商：</strong>区块链节点访问</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>6. 数据安全</h2>
        <p>我们实施行业标准的安全措施。但是，没有任何系统是完全安全的。用户有责任保护自己的钱包私钥。</p>
      </section>

      <section className="legal-section">
        <h2>7. 您的权利</h2>
        <p>根据您所在的司法管辖区，您可能有权访问、更正或删除您的个人数据。请联系 <a href="mailto:privacy@fidesorigin.com">privacy@fidesorigin.com</a>。</p>
      </section>

      <section className="legal-section">
        <h2>8. 政策变更</h2>
        <p>我们可能会不时更新本政策。变更将发布在此页面上，并更新日期。</p>
      </section>

      <section className="legal-section">
        <h2>9. 联系我们</h2>
        <p>隐私相关问题请联系 <a href="mailto:privacy@fidesorigin.com">privacy@fidesorigin.com</a>。</p>
      </section>
    </div>
  </div>
    </>
  );
}
