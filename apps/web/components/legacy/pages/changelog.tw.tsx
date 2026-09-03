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
            <h3>v3.3 — 監管模板</h3>
            <div className="date">2026 年 7 月</div>
            <ul>
              <li>為穩定幣發行方新增 MiCA 與 HKMA 合規模板</li>
              <li>強化 PolicyEngine，支援以司法管轄區為基礎的規則集</li>
              <li>在 Sepolia 測試網發布互動式示範</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-major">重大更新</span>
            <h3>v3.2 — 監控與索引</h3>
            <div className="date">2026 年 3 月</div>
            <ul>
              <li>推出 The Graph Subgraph，用於索引鏈上事件</li>
              <li>部署 Forta 監控機器人，進行即時異常偵測</li>
              <li>新增 WebSocket 串流，提供即時風險更新</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-major">重大更新</span>
            <h3>v3.1 — 完成安全審計</h3>
            <div className="date">2026 年 1 月</div>
            <ul>
              <li>完成 3 輪獨立安全審計</li>
              <li>解決合約、後端與基礎設施中超過 300 項發現項</li>
              <li>391 項測試通過，0 項未解決的嚴重問題</li>
              <li>核心合約測試覆蓋率達 99.9%</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-major">重大更新</span>
            <h3>v3.0 — Diamond 架構</h3>
            <div className="date">2025 年 10 月</div>
            <ul>
              <li>遷移至 EIP-2535 Diamond 模式，支援可升級的 facet</li>
              <li>新增多鏈支援（Ethereum、Base、Arbitrum）</li>
              <li>引入 QuarantineVault 隔離金庫，用於託管可疑交易</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-minor">次要更新</span>
            <h3>v2.0 — RiskRegistryV2</h3>
            <div className="date">2025 年 6 月</div>
            <ul>
              <li>升級 RiskRegistry，支援以 Merkle 證明為基礎的風險承諾</li>
              <li>強化 PolicyEngine，提供可設定的規則模板</li>
              <li>新增批量位址篩查 API</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-minor">次要更新</span>
            <h3>v1.0 — 初始發布</h3>
            <div className="date">2025 年 1 月</div>
            <ul>
              <li>在 Sepolia 測試網推出 FidesOrigin 協議</li>
              <li>發布 RiskRegistry 與 ComplianceEngine 合約</li>
              <li>推出 TypeScript SDK 與 REST API</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  
    </>
  );
}
