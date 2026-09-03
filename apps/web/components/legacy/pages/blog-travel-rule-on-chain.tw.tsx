/* Auto-generated from public/tw/blog/travel-rule-on-chain.html — do not edit by hand. */
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
    .blog-content pre { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 20px; overflow-x: auto; font-family: var(--font-mono); font-size: 0.8rem; line-height: 1.7; color: var(--text-secondary); margin: 20px 0; }
    .blog-content blockquote { border-left: 3px solid var(--accent); padding-left: 20px; margin: 24px 0; color: var(--text-secondary); font-style: italic; }
    .blog-nav { display: flex; justify-content: space-between; margin-top: 48px; padding-top: 32px; border-top: 1px solid var(--border); }
    .blog-nav a { color: var(--accent); font-size: 0.875rem; }
`;

export default function ContentBlogTravelRuleOnChainTW() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

      <article className="blog-article">
        <div className="container">
          <div className="reveal">
            <p className="micro">部落格</p>
            <h1>鏈上的旅行規則：FATF 對穩定幣轉帳有何要求</h1>
            <div className="blog-meta">
              <span>2026 年 8 月</span>
              <span className="tag">監管</span>
              <span>6 分鐘閱讀</span>
            </div>
          </div>

          <div className="blog-content reveal">
            <p>FATF 旅行規則（第 16 號建議）要求虛擬資產服務供應商（VASP）針對超過 1,000 美元的轉帳，交換匯款人與收款人資訊。對穩定幣發行方而言，這已不再是理論上的義務：中國香港、歐盟（MiCA/TFR）、新加坡與日本，都已在 2026 年強制執行該規則。懸而未決的是架構問題——旅行規則的合規究竟應該在哪裡執行？</p>

            <h2>旅行規則到底要求什麼</h2>

            <p>剝除法律條文的外衣後，剩下三項技術要求：</p>

            <ul>
              <li><strong>身分綁定：</strong>發送方與接收方必須能歸因到已驗證的身分，而不僅僅是位址。</li>
              <li><strong>轉帳前篩查：</strong>必須在價值移動之前完成轉帳檢查，而不是結算之後才標記。</li>
              <li><strong>可證明的紀錄：</strong>監管機構期望獲得防竄改的證據，證明每筆轉帳都經過篩查，且結果必須留存數年。</li>
            </ul>

            <h2>為什麼以 API 為中心的架構力有未逮</h2>

            <p>大多數 VASP 把旅行規則外掛在鏈下 API 上。這對託管型訂單簿可行，但對鏈上穩定幣轉帳就會失效：</p>

            <ol>
              <li><strong>結算跑在篩查前面。</strong>一筆轉帳在 2–12 秒內即完成確認；而 API 往返加上對手方 VASP 的握手，可能耗時更長。結算之後的篩查不是合規，而是事後鑑識。</li>
              <li><strong>非託管跳轉逃出了模型。</strong>資金一旦進入自託管錢包或 DeFi 池，雙邊的 VASP 對 VASP 訊息模型就無處掛載。</li>
              <li><strong>日誌不是證明。</strong>鏈下篩查日誌可能被事後修改。監管機構越來越常質問：憑什麼要相信它？</li>
            </ol>

            <h2>鏈上強制執行模式</h2>

            <p>另一種做法是把執行點移入轉帳路徑本身：</p>

            <ul>
              <li><strong>身分註冊表上鏈：</strong>KYC 認證將位址對應到已驗證的實體，使身分綁定變成一次查詢，而不是一次訊息交換。</li>
              <li><strong>執行前策略檢查：</strong>代幣合約（或位於其前的合規路由器）在狀態轉換發生之前，評估風險分數與旅行規則資料要求。不合規的轉帳會直接回滾——篩查無法被繞過、延遲或停擺。</li>
              <li><strong>不可竄改的審計事件：</strong>每一次篩查決定都會發出鏈上事件。審計留痕就是鏈本身——確定性、帶時間戳記且無法改寫。</li>
            </ul>

            <blockquote>當執行點移入執行路徑，旅行規則就不再是事後才履行的申報義務，而成為轉帳本身的特性。</blockquote>

            <h2>實務上是什麼樣子</h2>

            <p>透過 FidesOrigin，一筆穩定幣轉帳會在單筆交易內流經三道關卡：風險預言機為交易雙方評分，策略引擎評估發行方的規則（司法管轄區、金額分層、受制裁實體），合規引擎隨後執行轉帳或將其回滾，同時寫入審計事件。新增的延遲總計為：零次鏈下往返。</p>

            <p>對於面臨中國香港《穩定幣條例》、MiCA/TFR 或 MAS 指引的發行方，結論是一樣的：旅行規則只有在你資金流中託管的那一部分，才能在 API 層解決。凡是觸及開放網路的部分，都需要在轉帳真正發生的地方——鏈上——進行強制執行。</p>
          </div>

          <div className="blog-nav reveal">
            <a href="/tw/blog">← 返回部落格</a>
            <a href="/tw/blog/mica-stablecoin-compliance">下一篇：穩定幣的 MiCA 合規 →</a>
          </div>
        </div>
      </article>
    </>
  );
}
