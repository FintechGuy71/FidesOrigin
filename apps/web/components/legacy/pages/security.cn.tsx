/* Auto-generated from public/cn/security.html — do not edit by hand. */
const PAGE_CSS = `
.sec-hero { padding: 140px 0 60px; text-align: center; }
    .sec-hero .display { font-size: clamp(2rem, 4.5vw, 3.2rem); }
    .audit-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 24px;
      margin-top: 48px;
    }
    .audit-stat {
      padding: 32px 24px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      text-align: center;
    }
    .audit-stat .num {
      font-size: 2.5rem;
      font-weight: 800;
      background: linear-gradient(135deg, var(--gold-bright) 0%, var(--gold) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .audit-stat .label { font-size: 0.875rem; color: var(--text-secondary); margin-top: 4px; }
    .audit-card {
      padding: 32px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      margin-bottom: 24px;
    }
    .audit-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .audit-card h3 { font-size: 1.25rem; font-weight: 600; }
    .audit-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 100px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge-success { background: var(--success-dim); color: var(--success); }
    .audit-list { list-style: none; padding: 0; }
    .audit-list li {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid var(--fio-border-hairline);
      font-size: 0.875rem;
      color: var(--text-secondary);
    }
    .audit-list li:last-child { border-bottom: none; }
    .severity {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      flex-shrink: 0;
    }
    .sev-critical { background: var(--danger-dim); color: var(--danger); }
    .sev-high { background: var(--warning-dim); color: var(--warning); }
    .sev-medium { background: var(--info-dim); color: var(--info); }
    .sev-low { background: var(--success-dim); color: var(--success); }
    .security-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-top: 48px;
    }
    .security-item {
      padding: 28px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
    }
    .security-item h3 { font-size: 1rem; font-weight: 600; margin: 12px 0 8px; }
    .security-item p { font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6; }
    .security-icon {
      width: 44px; height: 44px;
      border-radius: var(--radius-sm);
      background: var(--accent-dim);
      color: var(--accent);
      display: flex; align-items: center; justify-content: center;
    }
    .security-icon svg { width: 22px; height: 22px; }
    @media (max-width: 900px) {
      .audit-stats { grid-template-columns: repeat(2, 1fr); }
      .security-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 480px) {
      .audit-stats { grid-template-columns: 1fr; }
    }
`;

export default function ContentSecurityCN() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    
    <section className="sec-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">安全</p>
          <h1 className="display">三重审计，<span>久经考验</span></h1>
          <p className="lead" style={{ "maxWidth": "600px", "margin": "20px auto 0" }}>三轮独立安全审计，发现并解决 300+ 项问题，基础设施已具备生产就绪能力。</p>
        </div>
        <div className="audit-stats reveal">
          <div className="audit-stat">
            <div className="num">3</div>
            <div className="label">审计轮次</div>
          </div>
          <div className="audit-stat">
            <div className="num">300+</div>
            <div className="label">发现问题已解决</div>
          </div>
          <div className="audit-stat">
            <div className="num">391</div>
            <div className="label">测试通过</div>
          </div>
          <div className="audit-stat">
            <div className="num">0</div>
            <div className="label">未解决严重问题</div>
          </div>
        </div>
      </div>
    </section>

    
    <section className="section bg-secondary">
      <div className="container">
        <div className="reveal section-intro">
          <p className="micro">审计历史</p>
          <h2 className="h2 section-title">全面的安全审查</h2>
        </div>

        <div className="audit-card reveal">
          <div className="audit-card-header">
            <h3>第 1 轮 — 通用安全审计</h3>
            <span className="audit-badge badge-success">已完成</span>
          </div>
          <p style={{ "color": "var(--text-secondary)", "fontSize": "0.875rem", "marginBottom": "16px" }}>全面审查智能合约安全、访问控制与经济模型漏洞，共发现 158 项问题。</p>
          <ul className="audit-list">
            <li><span className="severity sev-critical">严重</span> BaseFacet 中的 Diamond Storage 冲突 — 迁移至 Diamond Storage 模式后解决</li>
            <li><span className="severity sev-high">高危</span> claimFunds 溢出 panic — 修复时间戳计算中的溢出问题</li>
            <li><span className="severity sev-high">高危</span> postTransferHook 访问控制 — 恢复正确的权限检查</li>
            <li><span className="severity sev-medium">中危</span> DiamondCut 提案取消 — 新增 cancelDiamondCutProposal()</li>
            <li><span className="severity sev-medium">中危</span> CompliantStableCoin 静默失败 — 移除 OPERATOR_ROLE 依赖</li>
          </ul>
        </div>

        <div className="audit-card reveal">
          <div className="audit-card-header">
            <h3>第 2 轮 — 通用安全审计</h3>
            <span className="audit-badge badge-success">已完成</span>
          </div>
          <p style={{ "color": "var(--text-secondary)", "fontSize": "0.875rem", "marginBottom": "16px" }}>第二轮聚焦前端、后端与基础设施安全，发现并解决 117+ 项问题。</p>
          <ul className="audit-list">
            <li><span className="severity sev-high">高危</span> CacheService.get() 崩溃 — 移除无效的 .decode() 调用</li>
            <li><span className="severity sev-high">高危</span> JWT 令牌类型校验 — 新增类型验证</li>
            <li><span className="severity sev-medium">中危</span> ContextVar 单例修复 — 改用模块级实例</li>
            <li><span className="severity sev-medium">中危</span> 登录响应校验 — 修复 Pydantic schema</li>
            <li><span className="severity sev-medium">中危</span> WebSocket 预认证 — 新增连接数限制</li>
          </ul>
        </div>

        <div className="audit-card reveal">
          <div className="audit-card-header">
            <h3>第 3 轮 — 最佳实践审计</h3>
            <span className="audit-badge badge-success">已完成</span>
          </div>
          <p style={{ "color": "var(--text-secondary)", "fontSize": "0.875rem", "marginBottom": "16px" }}>对齐 CertiK / OpenZeppelin / Stripe / CNCF / NIST 最佳实践，解决 28+ 项问题。</p>
          <ul className="audit-list">
            <li><span className="severity sev-medium">中危</span> K8s Role 权限 — 收紧为仅允许获取特定 Secret</li>
            <li><span className="severity sev-medium">中危</span> 容器镜像版本锁定 — 新增 BASE_IMAGE build-arg</li>
            <li><span className="severity sev-low">低危</span> CI 审计严格性 — 移除 pnpm audit 中的 || true</li>
            <li><span className="severity sev-low">低危</span> Git 清理 — 将部署产物加入 .gitignore</li>
            <li><span className="severity sev-low">低危</span> CSP nonce 生成 — 改为按请求生成，替代硬编码</li>
          </ul>
        </div>
      </div>
    </section>

    
    <section className="section">
      <div className="container">
        <div className="reveal section-intro">
          <p className="micro">安全特性</p>
          <h2 className="h2 section-title">纵深防御</h2>
        </div>
        <div className="security-grid">
          <div className="security-item reveal">
            <div className="security-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <h3>多签治理</h3>
            <p>所有合约升级均需通过 Gnosis Safe 多签批准，并附带时间锁延迟。</p>
          </div>
          <div className="security-item reveal">
            <div className="security-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <h3>时间锁保护</h3>
            <p>所有敏感操作均设 48 小时时间锁，透明、可审查、可取消。</p>
          </div>
          <div className="security-item reveal">
            <div className="security-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h3>实时监控</h3>
            <p>Forta 机器人监控所有合约交互，对异常或攻击模式即时告警。</p>
          </div>
          <div className="security-item reveal">
            <div className="security-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <h3>透明验证</h3>
            <p>所有合约均已在 Etherscan 上验证，源代码在 GitHub 开放，毫无隐藏。</p>
          </div>
          <div className="security-item reveal">
            <div className="security-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
            </div>
            <h3>Diamond 架构</h3>
            <p>可升级的 Diamond 模式，可在不引入代理风险的前提下新增功能。</p>
          </div>
          <div className="security-item reveal">
            <div className="security-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            </div>
            <h3>访问控制</h3>
            <p>基于角色的权限管理（OpenZeppelin AccessControl），消除单点失守风险。</p>
          </div>
        </div>
      </div>
    </section>
  
    </>
  );
}
