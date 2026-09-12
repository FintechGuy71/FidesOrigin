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
            <h3>v3.1.0 — 安全审计修复版本</h3>
            <div className="date">2026 年 8 月</div>
            <ul>
              <li>完整修复独立安全审计发现的全部 53 项问题（High 6 / Medium 15 / Low 26 / Info 6）</li>
              <li>合约、网关 API 与数据链路共 9 项 Breaking Changes——详见 CHANGELOG.md</li>
              <li>Sepolia 全新部署 v3.1.0 合约集；发布 DEPLOYED.md 作为权威合约注册表</li>
              <li>合约测试 449/449 全绿（新增 15 项回归测试）</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-major">重大</span>
            <h3>v2.8.0 — 实时演示与多语言扩展</h3>
            <div className="date">2026 年 8 月</div>
            <ul>
              <li>Sepolia 实时演示页上线：MetaMask 钱包集成与多 RPC 回退</li>
              <li>地址查询 V2.1 重写：实时合约查询与 Guard 状态监控</li>
              <li>CN / TW / JP 新增 15 个翻译页面</li>
              <li>自动生成带 hreflang 的 sitemap；品牌一致的 404 页面</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-major">重大</span>
            <h3>v2.7.0-A+ — 安全加固</h3>
            <div className="date">2026 年 8 月</div>
            <ul>
              <li>A+ 安全审计报告；Cloudflare Workers 代理注入安全响应头</li>
              <li>391 项合约测试通过；Subgraph v0.0.4 新增 Guard 实体</li>
              <li>网站 v2.1 全面重建，支持 EN/CN/TW/JP 四语言</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-major">重大</span>
            <h3>v2.1.0 — Guard 架构</h3>
            <div className="date">2026 年 7 月</div>
            <ul>
              <li>FidesCompliance V2.1 集成 PreTransactionGuard，实现零 Gas 交易前拦截</li>
              <li>GNN 驱动的地址风险画像</li>
              <li>基于 UUPS 代理的可插拔合规模块</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-minor">次要</span>
            <h3>v2.0.0 — RiskRegistryV2</h3>
            <div className="date">2026 年 7 月</div>
            <ul>
              <li>RiskRegistry V2 引入 CDD 标签；PolicyEngine 支持按钱包配置规则</li>
              <li>QuarantineVault 隔离金库；CompliantStableCoin (fUSD)</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-minor">次要</span>
            <h3>v1.0.0 — 首次发布</h3>
            <div className="date">2026 年 7 月</div>
            <ul>
              <li>协议首次发布，内置基础 KYC/AML 筛查</li>
              <li>OFAC 黑名单核查；可编程策略规则</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  
    </>
  );
}
