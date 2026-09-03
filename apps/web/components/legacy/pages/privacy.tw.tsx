/* Auto-generated from public/tw/privacy.html — do not edit by hand. */
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

export default function ContentPrivacyTW() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />
<div className="legal-page">
    <div className="container">
      <h1>隱私政策</h1>
      <p className="last-updated">最後更新：2026年7月</p>

      <section className="legal-section">
        <h2>1. 概述</h2>
        <p>FidesOrigin 是一個鏈上合規協議。根據設計，我們最小化數據收集。本政策解釋我們處理的有限數據以及如何保護這些數據。</p>
      </section>

      <section className="legal-section">
        <h2>2. 我們收集的信息</h2>
        <p><strong>鏈上數據：</strong>所有風險評估和合規檢查都在鏈上進行。交易數據根據區塊鏈技術的本質是公開的，不由我們收集。</p>
        <p><strong>網站分析：</strong>我們使用最低限度的分析來了解網站使用情況。這可能包括 IP 地址（匿名化）、瀏覽器類型和訪問的頁面。</p>
        <p><strong>錢包連接：</strong>當您連接錢包時，我們只讀取您的公開地址。我們從不請求交易簽名或訪問私鑰。</p>
      </section>

      <section className="legal-section">
        <h2>3. 我們如何使用信息</h2>
        <ul>
          <li>提供和改進我們的服務</li>
          <li>響應支持請求</li>
          <li>分析網站使用模式</li>
          <li>遵守法律義務</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>4. Cookie</h2>
        <p>我們使用必要的 Cookie 來實現網站功能。我們不使用跟踪 Cookie 進行廣告目的。您可以在瀏覽器設置中禁用 Cookie。</p>
      </section>

      <section className="legal-section">
        <h2>5. 第三方服務</h2>
        <p>我們使用以下第三方服務：</p>
        <ul>
          <li><strong>Vercel：</strong>網站託管</li>
          <li><strong>The Graph：</strong>區塊鏈數據索引</li>
          <li><strong>RPC 提供商：</strong>區塊鏈節點訪問</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>6. 數據安全</h2>
        <p>我們實施行業標準的安全措施。但是，沒有任何系統是完全安全的。用戶有責任保護自己的錢包私鑰。</p>
      </section>

      <section className="legal-section">
        <h2>7. 您的權利</h2>
        <p>根據您所在的司法管轄區，您可能有權訪問、更正或刪除您的個人數據。請聯繫 <a href="mailto:privacy@fidesorigin.com">privacy@fidesorigin.com</a>。</p>
      </section>

      <section className="legal-section">
        <h2>8. 政策變更</h2>
        <p>我們可能會不時更新本政策。變更將發布在此頁面上，並更新日期。</p>
      </section>

      <section className="legal-section">
        <h2>9. 聯繫我們</h2>
        <p>隱私相關問題請聯繫 <a href="mailto:privacy@fidesorigin.com">privacy@fidesorigin.com</a>。</p>
      </section>
    </div>
  </div>
    </>
  );
}
