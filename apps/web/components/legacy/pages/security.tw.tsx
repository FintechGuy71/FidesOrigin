/* Auto-generated from public/tw/security.html — do not edit by hand. */
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

export default function ContentSecurityTW() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    
    <section className="sec-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">安全</p>
          <h1 className="display">三重審計，<span>久經考驗</span></h1>
          <p className="lead" style={{ "maxWidth": "600px", "margin": "20px auto 0" }}>三輪獨立安全審計，識別並解決超過 300 項發現項，具備可投入生產環境的基礎設施。</p>
        </div>
        <div className="audit-stats reveal">
          <div className="audit-stat">
            <div className="num">3</div>
            <div className="label">審計輪數</div>
          </div>
          <div className="audit-stat">
            <div className="num">300+</div>
            <div className="label">已解決發現項</div>
          </div>
          <div className="audit-stat">
            <div className="num">391</div>
            <div className="label">測試通過數</div>
          </div>
          <div className="audit-stat">
            <div className="num">0</div>
            <div className="label">未解決嚴重問題</div>
          </div>
        </div>
      </div>
    </section>

    
    <section className="section bg-secondary">
      <div className="container">
        <div className="reveal section-intro">
          <p className="micro">審計歷程</p>
          <h2 className="h2 section-title">全面的安全審計</h2>
        </div>

        <div className="audit-card reveal">
          <div className="audit-card-header">
            <h3>第一輪 — 全面安全審計</h3>
            <span className="audit-badge badge-success">已完成</span>
          </div>
          <p style={{ "color": "var(--text-secondary)", "fontSize": "0.875rem", "marginBottom": "16px" }}>全面審視智能合約安全、存取控制與經濟模型弱點。共識別 158 項發現項。</p>
          <ul className="audit-list">
            <li><span className="severity sev-critical">嚴重</span> BaseFacet 中的 Diamond Storage 衝突 — 透過遷移至 Diamond Storage 模式解決</li>
            <li><span className="severity sev-high">高</span> claimFunds 溢位異常 — 修復時間戳計算中的溢位</li>
            <li><span className="severity sev-high">高</span> postTransferHook 存取控制 — 恢復正確的權限檢查</li>
            <li><span className="severity sev-medium">中</span> DiamondCut 提案取消 — 新增 cancelDiamondCutProposal()</li>
            <li><span className="severity sev-medium">中</span> CompliantStableCoin 無聲失敗 — 移除 OPERATOR_ROLE 依賴</li>
          </ul>
        </div>

        <div className="audit-card reveal">
          <div className="audit-card-header">
            <h3>第二輪 — 全面安全審計</h3>
            <span className="audit-badge badge-success">已完成</span>
          </div>
          <p style={{ "color": "var(--text-secondary)", "fontSize": "0.875rem", "marginBottom": "16px" }}>第二輪審計聚焦前端、後端與基礎設施安全。識別並解決超過 117 項發現項。</p>
          <ul className="audit-list">
            <li><span className="severity sev-high">高</span> CacheService.get() 崩潰 — 移除無效的 .decode() 呼叫</li>
            <li><span className="severity sev-high">高</span> JWT token 類型驗證 — 新增類型校驗</li>
            <li><span className="severity sev-medium">中</span> ContextVar 單例修復 — 改為模組層級實例</li>
            <li><span className="severity sev-medium">中</span> 登入回應驗證 — 修復 Pydantic schema</li>
            <li><span className="severity sev-medium">中</span> WebSocket 驗證前連線 — 新增連線數量限制</li>
          </ul>
        </div>

        <div className="audit-card reveal">
          <div className="audit-card-header">
            <h3>第三輪 — 最佳實務審計</h3>
            <span className="audit-badge badge-success">已完成</span>
          </div>
          <p style={{ "color": "var(--text-secondary)", "fontSize": "0.875rem", "marginBottom": "16px" }}>對照 CertiK / OpenZeppelin / Stripe / CNCF / NIST 最佳實務。已解決超過 28 項發現項。</p>
          <ul className="audit-list">
            <li><span className="severity sev-medium">中</span> K8s Role 權限 — 限縮為僅可讀取特定 Secret</li>
            <li><span className="severity sev-medium">中</span> 容器映像版本固定 — 新增 BASE_IMAGE build-arg</li>
            <li><span className="severity sev-low">低</span> CI 審計嚴格性 — 移除 pnpm audit 後的 || true</li>
            <li><span className="severity sev-low">低</span> Git 清理 — 將部署產物加入 .gitignore</li>
            <li><span className="severity sev-low">低</span> CSP nonce 產生 — 改為每請求隨機產生，不再寫死</li>
          </ul>
        </div>
      </div>
    </section>

    
    <section className="section">
      <div className="container">
        <div className="reveal section-intro">
          <p className="micro">安全功能</p>
          <h2 className="h2 section-title">縱深防禦</h2>
        </div>
        <div className="security-grid">
          <div className="security-item reveal">
            <div className="security-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <h3>多簽治理</h3>
            <p>所有合約升級皆須通過 Gnosis Safe 多重簽名核准，並附帶時間鎖延遲。</p>
          </div>
          <div className="security-item reveal">
            <div className="security-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <h3>時間鎖保護</h3>
            <p>所有敏感操作皆附帶 48 小時時間鎖。透明、可審閱、可取消。</p>
          </div>
          <div className="security-item reveal">
            <div className="security-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h3>即時監控</h3>
            <p>Forta 機器人監控所有合約互動。發現異常或攻擊模式時立即發出警報。</p>
          </div>
          <div className="security-item reveal">
            <div className="security-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <h3>透明驗證</h3>
            <p>所有合約皆在 Etherscan 上完成驗證，原始碼公開於 GitHub。無所隱藏。</p>
          </div>
          <div className="security-item reveal">
            <div className="security-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
            </div>
            <h3>Diamond 架構</h3>
            <p>可升級的 Diamond 模式，可在不引入 proxy 風險的情況下新增功能。</p>
          </div>
          <div className="security-item reveal">
            <div className="security-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            </div>
            <h3>存取控制</h3>
            <p>以角色為基礎的權限管理（OpenZeppelin AccessControl）。沒有單一失守點。</p>
          </div>
        </div>
      </div>
    </section>
  
    </>
  );
}
