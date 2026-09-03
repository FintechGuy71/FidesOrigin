/* Auto-generated from public/tw/use-cases/smart-wallet.html — do not edit by hand. */
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

export default function ContentUseCasesSmartWalletTW() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    <section className="uc-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">應用場景</p>
          <h1 className="display">智能錢包 <span>合規</span></h1>
          <p className="lead" style={{ "maxWidth": "700px", "marginTop": "20px" }}>將鏈上風險篩查直接嵌入智能錢包與帳戶抽象錢包。每個 userOp 都會在執行前接受評估——無法繞過。</p>
        </div>
      </div>
    </section>

    <section className="section" style={{ "paddingTop": "0" }}>
      <div className="container">
        <div className="uc-grid">
          <div className="reveal">
            <h2 className="h2">挑戰</h2>
            <p className="body-sm" style={{ "marginTop": "16px" }}>智能錢包（ERC-4337）與帳戶抽象正在徹底改變 Web3 的使用者體驗，但也帶來新的合規挑戰：當使用者透過 bundler 與 entrypoint 互動，而非直接由 EOA 呼叫合約時，該如何篩查交易？</p>
            <p className="body-sm" style={{ "marginTop": "16px" }}>傳統合規方案依賴 dApp 層級的整合，而智能錢包完全繞過這一層。使用者可以構造與任意合約互動的 userOp，bundler 也會照樣執行——除非錢包本身強制執行合規。</p>

            <h2 className="h2" style={{ "marginTop": "48px" }}>解決方案</h2>
            <ul className="uc-checklist" style={{ "marginTop": "16px" }}>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 在 entrypoint 層級、userOp 執行前進行風險檢查</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 自動篩查所有目的地位址與 call data</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 以錢包持有者（而非以 dApp）為單位的策略執行</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 即使直接向 bundler 提交也無法繞過</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 透過預言機網路即時更新風險畫像</li>
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
          <p className="micro">功能特色</p>
          <h2 className="h2 section-title">專為帳戶抽象打造</h2>
        </div>
        <div className="uc-features">
          <div className="uc-feature reveal">
            <h3>相容 ERC-4337</h3>
            <p>可與任何 ERC-4337 entrypoint 整合。風險檢查在 userOp 驗證階段、bundler 接受之前執行。</p>
          </div>
          <div className="uc-feature reveal">
            <h3>Bundler 無關</h3>
            <p>適用於任何 bundler 服務。合規由錢包合約執行，而非依賴基礎設施。</p>
          </div>
          <div className="uc-feature reveal">
            <h3>按持有者設定策略</h3>
            <p>每位錢包持有者都能設定自己的風險策略：每日限額、白名單位址、司法管轄區規則。</p>
          </div>
          <div className="uc-feature reveal">
            <h3>Session Key 支援</h3>
            <p>為 session key 與持有者金鑰分別套用不同的風險策略，對委派的存取權限進行精細控制。</p>
          </div>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container">
        <div className="cta-section reveal">
          <h2 className="h1">準備好打造合規的智能錢包了嗎？</h2>
          <p>取得我們的 SDK、測試網部署，以及 ERC-4337 整合指南。</p>
          <div className="cta-buttons">
            <a href="/tw/docs" className="btn btn-primary">閱讀文件</a>
            <a href="mailto:contact@fidesorigin.com" className="btn btn-secondary">聯繫銷售</a>
          </div>
        </div>
      </div>
    </section>
  
    </>
  );
}
