/* Auto-generated from public/cn/use-cases/smart-wallet.html — do not edit by hand. */
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
       已上移到 css/legacy.css（共享）：这套类名跨 4 个 use-cases 家族 +
       case-studies 共用，原先每个页面各写一份且数值不一致
       （#5c6370 对比度仅 3.23:1、#c678dd 紫色破坏金色体系、缺 .str/.num）。
       此处不再重复定义。 */
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
    @media (max-width: 900px) {
      .uc-grid { grid-template-columns: 1fr; }
      .uc-features { grid-template-columns: 1fr; }
    }
`;

export default function ContentUseCasesSmartWalletCN() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    <section className="uc-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">应用场景</p>
          <h1 className="display">智能钱包<span>合规</span></h1>
          <p className="lead" style={{ "maxWidth": "700px", "marginTop": "20px" }}>将链上风险筛查直接嵌入智能钱包与账户抽象钱包。每个 userOp 在执行前都会经过评估，无法绕过。</p>
        </div>
      </div>
    </section>

    <section className="section" style={{ "paddingTop": "0" }}>
      <div className="container">
        <div className="uc-grid">
          <div className="reveal">
            <h2 className="h2">挑战</h2>
            <p className="body-sm" style={{ "marginTop": "16px" }}>智能钱包（ERC-4337）与账户抽象正在重塑 Web3 的用户体验，但也带来新的合规挑战：当用户通过 bundler 和 entry point 交互、而非直接由 EOA 调用合约时，该如何筛查交易？</p>
            <p className="body-sm" style={{ "marginTop": "16px" }}>传统合规方案依赖 dApp 层集成，而智能钱包完全可以绕过这一层。用户可以构造一个与任意合约交互的 userOp，bundler 会直接执行它——除非钱包自身强制执行合规。</p>

            <h2 className="h2" style={{ "marginTop": "48px" }}>解决方案</h2>
            <ul className="uc-checklist" style={{ "marginTop": "16px" }}>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 在 entrypoint 层面进行风险检查，先于 userOp 执行</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 自动筛查所有目标地址与调用数据</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 策略执行按钱包所有者维度，而非按 dApp 维度</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 即使直接向 bundler 提交也无法绕过</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 通过预言机网络实时更新风险画像</li>
            </ul>
          </div>
          <div className="reveal">
            <div className="uc-code">
              <div className="uc-code-header">
                <span>CompliantSmartWallet.sol</span>
                <span>Solidity 0.8.26</span>
              </div>
              <pre><span className="comment">// Smart wallet with embedded risk screening</span>
<span className="kw">contract</span> <span className="type">CompliantSmartWallet</span> <span className="kw">is</span> <span className="type">BaseAccount</span> &#123;

    <span className="kw">function</span> <span className="func">_validateUserOp</span>(
        <span className="type">UserOperation</span> <span className="kw">calldata</span> userOp,
        <span className="kw">bytes32</span> userOpHash
    ) <span className="kw">internal override</span> <span className="kw">returns</span> (<span className="kw">uint256</span>) &#123;
        <span className="comment">// Screen destination address</span>
        (<span className="kw">bool</span> allowed, <span className="kw">uint256</span> risk) =
            fides.<span className="func">evaluateTransaction</span>(
                <span className="kw">address</span>(<span className="kw">this</span>),
                userOp.dest,
                userOp.value
            );

        <span className="kw">if</span> (!allowed)
            <span className="kw">revert</span> <span className="func">ComplianceViolation</span>(risk);

        <span className="kw">return</span> <span className="kw">super</span>.<span className="func">_validateUserOp</span>(userOp, userOpHash);
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
          <p className="micro">核心能力</p>
          <h2 className="h2 section-title">为账户抽象而生</h2>
        </div>
        <div className="uc-features">
          <div className="uc-feature reveal">
            <h3>兼容 ERC-4337</h3>
            <p>可集成任何 ERC-4337 entrypoint。风险检查在 userOp 验证阶段执行，先于 bundler 受理。</p>
          </div>
          <div className="uc-feature reveal">
            <h3>与 Bundler 无关</h3>
            <p>可与任何 bundler 服务配合。合规由钱包合约执行，而非依赖基础设施。</p>
          </div>
          <div className="uc-feature reveal">
            <h3>按所有者配置策略</h3>
            <p>每位钱包所有者可配置自己的风险策略：每日限额、白名单地址、司法管辖区规则。</p>
          </div>
          <div className="uc-feature reveal">
            <h3>Session Key 支持</h3>
            <p>为 session key 与所有者密钥应用不同的风险策略，对委托访问实现细粒度管控。</p>
          </div>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container">
        <div className="cta-section reveal">
          <h2 className="h1">准备好构建合规的智能钱包了吗？</h2>
          <p>获取我们的 SDK、测试网部署与 ERC-4337 集成指南。</p>
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
