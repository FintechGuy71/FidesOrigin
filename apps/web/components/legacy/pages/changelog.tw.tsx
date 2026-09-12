/* Auto-generated from public/tw/changelog.html — do not edit by hand. */
const PAGE_CSS = `
.cl-hero { padding: 140px 0 60px; text-align: center; }
    .cl-hero .display { font-size: clamp(2rem, 4.5vw, 3.2rem); }
    .timeline { position: relative; max-width: 800px; margin: 48px auto 0; }
    .timeline::before {
      content: '';
      position: absolute;
      left: 24px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--border);
    }
    .timeline-item {
      position: relative;
      padding-left: 64px;
      padding-bottom: 40px;
    }
    .timeline-item:last-child { padding-bottom: 0; }
    .timeline-dot {
      position: absolute;
      left: 16px;
      top: 4px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--accent);
      border: 3px solid var(--bg);
    }
    .timeline-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 100px;
      font-size: 0.75rem;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .badge-latest { background: var(--accent-dim); color: var(--accent); }
    .badge-major { background: var(--success-dim); color: var(--success); }
    .badge-minor { background: var(--bg-card); color: var(--text-muted); }
    .timeline-item h3 { font-size: 1.1rem; font-weight: 600; margin-bottom: 8px; }
    .timeline-item .date { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px; }
    .timeline-item ul { color: var(--text-secondary); font-size: 0.875rem; line-height: 1.7; padding-left: 18px; }
    .timeline-item li { margin-bottom: 4px; }
    @media (max-width: 600px) {
      .timeline::before { left: 12px; }
      .timeline-item { padding-left: 40px; }
      .timeline-dot { left: 4px; }
    }
`;

export default function ContentChangelogTW() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    <section className="cl-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">更新日誌</p>
          <h1 className="display">協議的<span>演進</span></h1>
          <p className="lead" style={{ "maxWidth": "600px", "margin": "20px auto 0" }}>追蹤每一個里程碑，從初始發布到最新的安全強化版本。</p>
        </div>
      </div>
    </section>

    <section className="section" style={{ "paddingTop": "0" }}>
      <div className="container">
        <div className="timeline reveal">
          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-latest">最新</span>
            <h3>v3.1.0 — 安全審計修復版本</h3>
            <div className="date">2026 年 8 月</div>
            <ul>
              <li>完整修復獨立安全審計發現的全部 53 項問題（High 6 / Medium 15 / Low 26 / Info 6）</li>
              <li>合約、閘道 API 與資料鏈路共 9 項 Breaking Changes——詳見 CHANGELOG.md</li>
              <li>Sepolia 全新部署 v3.1.0 合約集；發布 DEPLOYED.md 作為權威合約註冊表</li>
              <li>合約測試 449/449 全綠（新增 15 項回歸測試）</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-major">重大</span>
            <h3>v2.8.0 — 實時演示與多語言擴展</h3>
            <div className="date">2026 年 8 月</div>
            <ul>
              <li>Sepolia 實時演示頁上線：MetaMask 錢包整合與多 RPC 回退</li>
              <li>地址查詢 V2.1 重寫：實時合約查詢與 Guard 狀態監控</li>
              <li>CN / TW / JP 新增 15 個翻譯頁面</li>
              <li>自動生成帶 hreflang 的 sitemap；品牌一致的 404 頁面</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-major">重大</span>
            <h3>v2.7.0-A+ — 安全加固</h3>
            <div className="date">2026 年 8 月</div>
            <ul>
              <li>A+ 安全審計報告；Cloudflare Workers 代理注入安全回應標頭</li>
              <li>391 項合約測試通過；Subgraph v0.0.4 新增 Guard 實體</li>
              <li>網站 v2.1 全面重建，支援 EN/CN/TW/JP 四語言</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-major">重大</span>
            <h3>v2.1.0 — Guard 架構</h3>
            <div className="date">2026 年 7 月</div>
            <ul>
              <li>FidesCompliance V2.1 整合 PreTransactionGuard，實現零 Gas 交易前攔截</li>
              <li>GNN 驅動的地址風險輪廓</li>
              <li>基於 UUPS 代理的可插拔合規模組</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-minor">次要</span>
            <h3>v2.0.0 — RiskRegistryV2</h3>
            <div className="date">2026 年 7 月</div>
            <ul>
              <li>RiskRegistry V2 引入 CDD 標籤；PolicyEngine 支援依錢包配置規則</li>
              <li>QuarantineVault 隔離金庫；CompliantStableCoin (fUSD)</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-minor">次要</span>
            <h3>v1.0.0 — 初始發布</h3>
            <div className="date">2026 年 7 月</div>
            <ul>
              <li>協議初始發布，內建基礎 KYC/AML 篩查</li>
              <li>OFAC 黑名單檢查；可編程策略規則</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  
    </>
  );
}
