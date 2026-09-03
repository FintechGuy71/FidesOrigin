/* Auto-generated from public/cn/changelog.html — do not edit by hand. */
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

export default function ContentChangelogCN() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    <section className="cl-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">更新日志</p>
          <h1 className="display">协议<span>演进</span></h1>
          <p className="lead" style={{ "maxWidth": "600px", "margin": "20px auto 0" }}>追踪每一个里程碑，从首次发布到最新的安全加固版本。</p>
        </div>
      </div>
    </section>

    <section className="section" style={{ "paddingTop": "0" }}>
      <div className="container">
        <div className="timeline reveal">
          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-latest">最新</span>
            <h3>v3.3 — 监管合规模板</h3>
            <div className="date">2026 年 7 月</div>
            <ul>
              <li>为稳定币发行方新增 MiCA 与 HKMA 合规模板</li>
              <li>PolicyEngine 增强：支持基于司法管辖区的规则集</li>
              <li>在 Sepolia 测试网发布交互式演示</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-major">重大版本</span>
            <h3>v3.2 — 监控与索引</h3>
            <div className="date">2026 年 3 月</div>
            <ul>
              <li>上线 The Graph Subgraph，索引链上事件</li>
              <li>部署 Forta 监控机器人，实时检测异常</li>
              <li>新增 WebSocket 流，实时推送风险更新</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-major">重大版本</span>
            <h3>v3.1 — 安全审计完成</h3>
            <div className="date">2026 年 1 月</div>
            <ul>
              <li>完成 3 轮独立安全审计</li>
              <li>解决合约、后端与基础设施中的 300+ 项发现问题</li>
              <li>391 项测试通过，0 项严重问题遗留</li>
              <li>核心合约测试覆盖率达到 99.9%</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-major">重大版本</span>
            <h3>v3.0 — Diamond 架构</h3>
            <div className="date">2025 年 10 月</div>
            <ul>
              <li>迁移至 EIP-2535 Diamond 模式，支持 facet 可升级</li>
              <li>新增多链支持（Ethereum、Base、Arbitrum）</li>
              <li>引入 QuarantineVault，对可疑交易进行隔离托管</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-minor">次要版本</span>
            <h3>v2.0 — RiskRegistryV2</h3>
            <div className="date">2025 年 6 月</div>
            <ul>
              <li>RiskRegistry 升级，支持基于 Merkle 证明的风险承诺</li>
              <li>PolicyEngine 增强：支持可配置规则模板</li>
              <li>新增批量地址筛查 API</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-minor">次要版本</span>
            <h3>v1.0 — 首次发布</h3>
            <div className="date">2025 年 1 月</div>
            <ul>
              <li>FidesOrigin 协议在 Sepolia 测试网上线</li>
              <li>发布 RiskRegistry 与 ComplianceEngine 合约</li>
              <li>发布 TypeScript SDK 与 REST API</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  
    </>
  );
}
