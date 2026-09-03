/* Auto-generated from public/cn/use-cases/rwa-tokenization.html — do not edit by hand. */
const PAGE_CSS = `
.uc-hero { padding: 140px 0 60px; }
    .uc-hero .display { font-size: clamp(2rem, 4.5vw, 3.2rem); }
    .uc-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 64px;
      align-items: center;
      margin-top: 48px;
    }
    /* .uc-code / .uc-code-header / .uc-code pre / .uc-code .{comment,kw,type,func,str,num}
       已上移到 css/legacy.css（共享）：case-studies.en.tsx 用同一套类名却
       没有 PAGE_CSS，导致该页代码块零样式。此处不再重复定义。 */
    .uc-features {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-top: 48px;
    }
    .uc-feature {
      padding: 24px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
    }
    .uc-feature h3 { font-size: 1rem; font-weight: 600; margin-bottom: 8px; }
    .uc-feature p { font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6; }
    .uc-checklist { list-style: none; padding: 0; }
    .uc-checklist li {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid var(--fio-border-hairline);
      font-size: 0.9rem;
      color: var(--text-secondary);
    }
    .uc-checklist svg { width: 20px; height: 20px; color: var(--success); flex-shrink: 0; margin-top: 2px; }
    .reg-card {
      padding: 24px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      margin-bottom: 16px;
    }
    .reg-card h3 { font-size: 1rem; font-weight: 600; margin-bottom: 8px; color: var(--accent); }
    .reg-card p { font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6; }
    @media (max-width: 900px) {
      .uc-grid { grid-template-columns: 1fr; }
      .uc-features { grid-template-columns: 1fr; }
    }
`;

export default function ContentUseCasesRwaTokenizationCN() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    
    <section className="uc-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">应用场景</p>
          <h1 className="display">RWA <span>代币化合规</span></h1>
          <p className="lead" style={{ "maxWidth": "700px", "marginTop": "20px" }}>为真实世界资产代币化内置证券合规：链上合格投资者验证、司法管辖区准入控制，以及智能合约层面的自动化 KYC 执行。</p>
        </div>
      </div>
    </section>

    
    <section className="section" style={{ "paddingTop": "0" }}>
      <div className="container">
        <div className="uc-grid">
          <div className="reveal">
            <h2 className="h2">挑战</h2>
            <p className="body-sm" style={{ "marginTop": "16px" }}>真实世界资产代币化平台面临一个根本性的监管挑战：证券法适用于代币化资产，但传统合规基础设施无法在智能合约层面执行规则。</p>
            <p className="body-sm" style={{ "marginTop": "16px" }}>监管方要求证明：只有合格投资者才能持有证券型代币，转账须遵守司法管辖区限制，且任何代币转移之前都必须完成 KYC。链下数据库与 API 检查无法提供确定性执行。</p>

            <h2 className="h2" style={{ "marginTop": "48px" }}>解决方案</h2>
            <ul className="uc-checklist" style={{ "marginTop": "16px" }}>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 通过认证注册表在链上验证合格投资者身份</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 由智能合约强制执行基于司法管辖区的转账限制</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 每笔转账前进行链上 KYC 状态检查</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 白名单/黑名单管理，配合多签治理</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 面向证券监管方的完整审计留痕</li>
            </ul>
          </div>
          <div className="reveal">
            <div className="uc-code">
              <div className="uc-code-header">
                <span>RWAToken.sol</span>
                <span>Solidity 0.8.26</span>
              </div>
              <pre><span className="comment">// Compliant RWA token with investor verification</span>
<span className="kw">contract</span> <span className="type">RWAToken</span> <span className="kw">is</span> <span className="type">CompliantERC20</span> &#123;

    <span className="kw">constructor</span>()
        <span className="type">CompliantERC20</span>(
            <span className="str">"Real Estate Token"</span>,
            <span className="str">"RET"</span>,
            <span className="num">18</span>,
            <span className="num">1_000_000</span> * <span className="num">1e18</span>
        )
    &#123;&#125;

    <span className="kw">function</span> <span className="func">_beforeTokenTransfer</span>(
        <span className="kw">address</span> from,
        <span className="kw">address</span> to,
        <span className="kw">uint256</span> amount
    ) <span className="kw">internal override</span> &#123;
        <span className="comment">// Verify accredited investor status</span>
        <span className="kw">require</span>(
            fides.<span className="func">isAccredited</span>(to),
            <span className="str">"Recipient not accredited"</span>
        );

        <span className="comment">// Enforce jurisdiction restrictions</span>
        <span className="kw">require</span>(
            fides.<span className="func">isJurisdictionAllowed</span>(to),
            <span className="str">"Jurisdiction restricted"</span>
        );

        <span className="kw">super</span>.<span className="func">_beforeTokenTransfer</span>(from, to, amount);
    &#125;
&#125;</pre>
            </div>
          </div>
        </div>
      </div>
    </section>

    
    <section className="section bg-secondary">
      <div className="container">
        <div className="reveal section-intro">
          <p className="micro">监管覆盖</p>
          <h2 className="h2 section-title">为证券监管而生</h2>
        </div>
        <div className="uc-features">
          <div className="uc-feature reveal">
            <h3>Regulation D / Reg S</h3>
            <p>在合约层面自动执行合格投资者身份要求与离岸转账限制。</p>
          </div>
          <div className="uc-feature reveal">
            <h3>MiCA 资产参考型代币</h3>
            <p>满足欧盟《加密资产市场法规》（MiCA）对代币化证券与电子货币代币的要求。</p>
          </div>
          <div className="uc-feature reveal">
            <h3>新加坡 MAS 框架</h3>
            <p>通过链上 KYC 与投资者分类，符合新加坡数字代币发行（DTO）指引。</p>
          </div>
          <div className="uc-feature reveal">
            <h3>瑞士 DLT 法案</h3>
            <p>通过合规的代币转账与登记册集成，支持瑞士 DLT 法案下的账本式证券。</p>
          </div>
        </div>

        <div style={{ "marginTop": "48px" }}>
          <div className="reg-card reveal">
            <h3>合格投资者验证</h3>
            <p>对接链上认证服务提供方，在不暴露个人数据的前提下验证合格投资者身份。FidesOrigin 在允许代币转账前实时核验加密认证；若情况发生变化，身份可即时撤销。</p>
          </div>
          <div className="reg-card reveal">
            <h3>司法管辖区准入控制</h3>
            <p>基于代币持有人的居住地，按司法管辖区配置转账规则：拦截流向受限司法管辖区的转账、按地区设置持仓限额，并覆盖 150+ 个司法管辖区，持续符合当地证券法规。</p>
          </div>
          <div className="reg-card reveal">
            <h3>链上 KYC 集成</h3>
            <p>将 KYC 服务提供方接入链上注册表。用户一旦完成 KYC，其钱包地址即在链上获得认证。智能合约在每笔转账前核验该认证——无需 API 调用、无延迟、无绕过路径。</p>
          </div>
        </div>
      </div>
    </section>

    
    <section className="section">
      <div className="container">
        <div className="cta-section reveal">
          <h2 className="h1">准备好将真实世界资产代币化了吗？</h2>
          <p>通过链上投资者验证与司法管辖区强制执行，构建合规的证券型代币。</p>
          <div className="cta-buttons">
            <a href="/cn/docs" className="btn btn-primary">阅读文档</a>
            <a href="mailto:contact@fidesorigin.com" className="btn btn-secondary">联系销售</a>
          </div>
        </div>
      </div>
    </section>
  
    </>
  );
}
