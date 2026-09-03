/* Auto-generated from public/tw/blog/ofac-sanctions-screening-blockchain.html — do not edit by hand. */
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
    .blog-content blockquote { border-left: 3px solid var(--accent); padding-left: 20px; margin: 24px 0; color: var(--text-secondary); font-style: italic; }
    .blog-nav { display: flex; justify-content: space-between; margin-top: 48px; padding-top: 32px; border-top: 1px solid var(--border); }
    .blog-nav a { color: var(--accent); font-size: 0.875rem; }
`;

export default function ContentBlogOfacSanctionsScreeningBlockchainTW() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    <article className="blog-article">
      <div className="container">
        <div className="reveal">
          <p className="micro">部落格</p>
          <h1>區塊鏈上的 OFAC 制裁篩查：最佳實務</h1>
          <div className="blog-meta">
            <span>2026 年 7 月</span>
            <span className="tag">合規</span>
            <span>7 分鐘閱讀</span>
          </div>
        </div>

        <div className="blog-content reveal">
          <p>美國海外資產控制辦公室（OFAC）維護著特別指定國民名單（SDN list）——一份彙整了個人、實體與位址的名單，美國人士被禁止與其進行交易。對區塊鏈協議而言，這產生了傳統金融機構所不會面臨的獨特挑戰。</p>

          <h2>鏈上制裁篩查的挑戰</h2>

          <p>與傳統金融交易須流經中介機構不同，區塊鏈交易是點對點的。沒有一家銀行能在結算前擋下交易。這意味著合規必須內嵌於協議層：</p>

          <ul>
            <li><strong>交易前篩查：</strong>每筆轉帳在執行前都必須經過評估</li>
            <li><strong>非託管環境：</strong>沒有中央機構持有資金或控管存取</li>
            <li><strong>假名性：</strong>位址與現實世界身分並非一一對應</li>
            <li><strong>不可逆性：</strong>交易一旦上鏈，就無法撤銷</li>
          </ul>

          <h2>最佳實務 #1：鏈上強制執行</h2>

          <p>最穩健的做法是將制裁篩查直接嵌入智慧合約。這可確保：</p>

          <ol>
            <li><strong>確定性：</strong>每筆交易都在相同的規則下被篩查</li>
            <li><strong>無法繞過：</strong>即便是直接呼叫合約也會觸發合規檢查</li>
            <li><strong>可稽核性：</strong>篩查決定被永久記錄在鏈上</li>
            <li><strong>可用性：</strong>不依賴可能失效的外部 API</li>
          </ol>

          <h2>最佳實務 #2：風險分級，而非二元阻擋</h2>

          <p>進階做法採用風險分級，而非單純的允許／阻擋：</p>

          <ul>
            <li><strong>UNKNOWN：</strong>沒有歷史記錄的新位址——需要額外驗證</li>
            <li><strong>LOW：</strong>未偵測到風險標記——允許並套用標準限額</li>
            <li><strong>MEDIUM：</strong>有些風險指標——加強監控</li>
            <li><strong>HIGH：</strong>風險顯著——隔離以待人工審查</li>
            <li><strong>CRITICAL：</strong>命中制裁名單——阻擋並發出警報</li>
          </ul>

          <h2>最佳實務 #3：保持資料即時更新</h2>

          <p>OFAC 會定期更新 SDN 名單。鏈上註冊表必須自主更新。FidesOrigin 使用 Chainlink Functions 抓取最新的制裁資料並更新鏈上的 RiskRegistry，無需人工介入。</p>

          <h2>最佳實務 #4：隔離優先於阻擋</h2>

          <p>與其直接阻擋交易（可能造成 UX 問題與誤判），不如考慮隔離機制：</p>

          <blockquote>「隔離金庫（quarantine vault）會把可疑資金保留起來以供審查，而不是直接拒絕。這能在維持合規的同時減少誤判。」</blockquote>

          <h2>結論</h2>

          <p>區塊鏈上的 OFAC 合規並非可有可無——對任何在美國境內營運或服務美國人士的協議，這都是法律要求。問題不在於是否合規，而在於如何在合規的同時不犧牲去中心化的優勢。鏈上強制執行就是答案。</p>
        </div>

        <div className="blog-nav reveal">
          <a href="/tw/blog">← 全部文章</a>
          <a href="/tw/blog/hong-kong-stablecoin-license">下一篇：中國香港牌照 →</a>
        </div>
      </div>
    </article>

    </>
  );
}
