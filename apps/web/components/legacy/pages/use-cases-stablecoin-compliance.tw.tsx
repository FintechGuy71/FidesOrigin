/* Auto-generated from public/tw/use-cases/stablecoin-compliance.html — do not edit by hand. */
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

export default function ContentUseCasesStablecoinComplianceTW() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    
    <section className="uc-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">應用場景</p>
          <h1 className="display">穩定幣 <span>合規</span></h1>
          <p className="lead" style={{ "maxWidth": "700px", "marginTop": "20px" }}>以具確定性的鏈上風險篩查打造合規穩定幣。在不犧牲去中心化的前提下，滿足 MiCA、香港及全球監管要求。</p>
        </div>
      </div>
    </section>

    
    <section className="section" style={{ "paddingTop": "0" }}>
      <div className="container">
        <div className="uc-grid">
          <div className="reveal">
            <h2 className="h2">挑戰</h2>
            <p className="body-sm" style={{ "marginTop": "16px" }}>穩定幣發行方面臨關鍵的兩難：如何在遵循 OFAC 制裁、FATF 旅遊規則，以及如 MiCA 等新興法規的同時，不引入中心化或鏈下依賴——那恰恰會動搖區塊鏈存在的意義。</p>
            <p className="body-sm" style={{ "marginTop": "16px" }}>傳統方案依賴以 API 為基礎的篩查，會帶來延遲、單點故障與信任假設。監管機構正日益要求證明合規是<strong>具確定性且可審計</strong>的。</p>

            <h2 className="h2" style={{ "marginTop": "48px" }}>解決方案</h2>
            <ul className="uc-checklist" style={{ "marginTop": "16px" }}>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 對每筆轉帳進行鏈上 OFAC/UN 制裁篩查</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 在智能合約層級進行具確定性的策略執行</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 為可疑交易提供隔離金庫</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 透過 Chainlink Functions 即時更新風險畫像</li>
              <li><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 供監管機構查核的完整審計留痕</li>
            </ul>
          </div>
          <div className="reveal">
            <div className="uc-code">
              <div className="uc-code-header">
                <span>CompliantStableCoin.sol</span>
                <span>Solidity 0.8.26</span>
              </div>
              <pre><span className="comment">// Inherit CompliantStableCoin for automatic screening</span>
<span className="kw">contract</span> <span className="type">MyStableCoin</span> <span className="kw">is</span> <span className="type">CompliantStableCoin</span> &#123;

    <span className="kw">constructor</span>()
        <span className="type">CompliantStableCoin</span>(
            <span className="str">"MyStable"</span>,      <span className="comment">// name</span>
            <span className="str">"MST"</span>,           <span className="comment">// symbol</span>
            <span className="num">6</span>,               <span className="comment">// decimals</span>
            <span className="num">100_000_000</span> * <span className="num">1e6</span> <span className="comment">// max supply</span>
        )
    &#123;
        <span className="comment">// Configure policies</span>
        _setMaxTransferAmount(<span className="num">100_000</span> * <span className="num">1e6</span>);
        _requireKYC(<span className="kw">true</span>);
    &#125;

    <span className="comment">// Every transfer is automatically screened</span>
    <span className="comment">// against on-chain risk profiles</span>
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
          <h2 className="h2 section-title">專為受監管的穩定幣打造</h2>
        </div>
        <div className="uc-features">
          <div className="uc-feature reveal">
            <h3>MiCA 就緒</h3>
            <p>以鏈上儲備證明與交易篩查，符合歐盟《加密資產市場法規》（MiCA）。</p>
          </div>
          <div className="uc-feature reveal">
            <h3>香港牌照</h3>
            <p>遵循 HKMA 穩定幣發行方規範，包括即時制裁篩查與審計留痕。</p>
          </div>
          <div className="uc-feature reveal">
            <h3>OFAC 篩查</h3>
            <p>對每筆轉帳進行 SDN 名單檢查。透過去中心化預言機網路自動更新。</p>
          </div>
          <div className="uc-feature reveal">
            <h3>FATF 旅遊規則</h3>
            <p>內建 VASP 驗證與匯款人／收款人資料處理，支援跨境轉帳。</p>
          </div>
        </div>
      </div>
    </section>

    
    <section className="section">
      <div className="container">
        <div className="cta-section reveal">
          <h2 className="h1">準備好打造合規的穩定幣了嗎？</h2>
          <p>取得我們的 SDK、測試網部署，以及合規技術文件。</p>
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
