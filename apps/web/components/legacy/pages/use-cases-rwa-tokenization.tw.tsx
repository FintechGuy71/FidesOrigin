/* Auto-generated from public/tw/use-cases/rwa-tokenization.html — do not edit by hand. */
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

export default function ContentUseCasesRwaTokenizationTW() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    
    <section className="uc-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">應用場景</p>
          <h1 className="display">RWA <span>代幣化合規</span></h1>
          <p className="lead" style={{ "maxWidth": "700px", "marginTop": "20px" }}>為實體資產代幣化內建證券合規機制。在智能合約層級實現鏈上合格投資人驗證、司法管轄區限制，以及自動化 KYC 執行。</p>
        </div>
      </div>
    </section>

    
    <section className="section" style={{ "paddingTop": "0" }}>
      <div className="container">
        <div className="uc-grid">
          <div className="reveal">
            <h2 className="h2">挑戰</h2>
            <p className="body-sm" style={{ "marginTop": "16px" }}>實體資產代幣化平台面臨根本性的監管挑戰：證券法同樣適用於代幣化資產，但傳統合規基礎設施無法在智能合約層級執行規則。</p>
            <p className="body-sm" style={{ "marginTop": "16px" }}>監管機構要求證明：只有合格投資人能持有證券型代幣、轉帳須遵循司法管轄區限制，且任何代幣移動前都必須完成 KYC。鏈下資料庫與 API 檢查無法提供具確定性的執行。</p>

            <h2 className="h2" style={{ "marginTop": "48px" }}>解決方案</h2>
            <ul className="uc-checklist" style={{ "marginTop": "16px" }}>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 透過證明註冊表在鏈上驗證合格投資人身份</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 由智能合約執行以司法管轄區為基礎的轉帳限制</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 每次轉帳前進行鏈上 KYC 狀態檢查</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 結合多簽治理的白名單／黑名單管理</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 供證券監管機構查核的完整審計留痕</li>
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
          <p className="micro">監管涵蓋</p>
          <h2 className="h2 section-title">專為證券法規打造</h2>
        </div>
        <div className="uc-features">
          <div className="uc-feature reveal">
            <h3>Regulation D / Reg S</h3>
            <p>在合約層級自動執行合格投資人狀態與境外轉帳限制。</p>
          </div>
          <div className="uc-feature reveal">
            <h3>MiCA 資產掛鉤代幣</h3>
            <p>符合歐盟《加密資產市場法規》（MiCA）對代幣化證券與電子貨幣代幣的要求。</p>
          </div>
          <div className="uc-feature reveal">
            <h3>新加坡 MAS 框架</h3>
            <p>透過鏈上 KYC 與投資人分類，遵循新加坡數位代幣發行（DTO）準則。</p>
          </div>
          <div className="uc-feature reveal">
            <h3>瑞士 DLT 法案</h3>
            <p>以合規的代幣轉帳與註冊表整合，支援帳簿登記式證券。</p>
          </div>
        </div>

        <div style={{ "marginTop": "48px" }}>
          <div className="reg-card reveal">
            <h3>合格投資人驗證</h3>
            <p>與鏈上證明服務供應商整合，在不揭露個人資料的前提下驗證合格投資人身份。FidesOrigin 會在允許代幣轉帳前即時檢查加密證明；當情況改變時，可立即撤銷該身份。</p>
          </div>
          <div className="reg-card reveal">
            <h3>司法管轄區限制</h3>
            <p>依據代幣持有人的居住地設定各司法管轄區的轉帳規則。封鎖轉往受限制司法管轄區的交易、依地區套用持有上限，並在超過 150 個司法管轄區維持對當地證券法規的合規。</p>
          </div>
          <div className="reg-card reveal">
            <h3>鏈上 KYC 整合</h3>
            <p>將 KYC 服務供應商與鏈上註冊表連接。使用者完成 KYC 後，其錢包位址會在鏈上獲得證明。智能合約會在每筆轉帳前驗證這項證明——無須 API 呼叫、沒有延遲、沒有繞過路徑。</p>
          </div>
        </div>
      </div>
    </section>

    
    <section className="section">
      <div className="container">
        <div className="cta-section reveal">
          <h2 className="h1">準備好將實體資產代幣化了嗎？</h2>
          <p>結合鏈上投資人驗證與司法管轄區執行機制，打造合規的證券型代幣。</p>
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
