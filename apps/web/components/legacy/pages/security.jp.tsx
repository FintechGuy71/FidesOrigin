/* Auto-generated from public/jp/security.html — do not edit by hand. */
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

export default function ContentSecurityJP() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    
    <section className="sec-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">セキュリティ</p>
          <h1 className="display">3度の監査済み、<span>実績を持つ</span></h1>
          <p className="lead" style={{ "maxWidth": "600px", "margin": "20px auto 0" }}>3ラウンドの独立セキュリティ監査を実施。300 件超の指摘事項を特定・解決済み。本番運用に対応したインフラストラクチャ。</p>
        </div>
        <div className="audit-stats reveal">
          <div className="audit-stat">
            <div className="num">3</div>
            <div className="label">監査ラウンド</div>
          </div>
          <div className="audit-stat">
            <div className="num">300+</div>
            <div className="label">指摘事項を解決済み</div>
          </div>
          <div className="audit-stat">
            <div className="num">391</div>
            <div className="label">テスト合格</div>
          </div>
          <div className="audit-stat">
            <div className="num">0</div>
            <div className="label">未解決の重大問題</div>
          </div>
        </div>
      </div>
    </section>

    
    <section className="section bg-secondary">
      <div className="container">
        <div className="reveal section-intro">
          <p className="micro">監査履歴</p>
          <h2 className="h2 section-title">包括的なセキュリティレビュー</h2>
        </div>

        <div className="audit-card reveal">
          <div className="audit-card-header">
            <h3>第1ラウンド — 総合セキュリティ監査</h3>
            <span className="audit-badge badge-success">完了</span>
          </div>
          <p style={{ "color": "var(--text-secondary)", "fontSize": "0.875rem", "marginBottom": "16px" }}>スマートコントラクトのセキュリティ、アクセス制御、経済的脆弱性に関する包括レビュー。158 件の指摘事項を特定。</p>
          <ul className="audit-list">
            <li><span className="severity sev-critical">重大</span> BaseFacet における Diamond Storage の衝突 — Diamond Storage パターンへの移行により解決</li>
            <li><span className="severity sev-high">高</span> claimFunds のオーバーフローパニック — タイムスタンプ計算のオーバーフローを修正</li>
            <li><span className="severity sev-high">高</span> postTransferHook のアクセス制御 — 適切な権限チェックを復元</li>
            <li><span className="severity sev-medium">中</span> DiamondCut 提案のキャンセル — cancelDiamondCutProposal() を追加</li>
            <li><span className="severity sev-medium">中</span> CompliantStableCoin のサイレント失敗 — OPERATOR_ROLE への依存を解消</li>
          </ul>
        </div>

        <div className="audit-card reveal">
          <div className="audit-card-header">
            <h3>第2ラウンド — 総合セキュリティ監査</h3>
            <span className="audit-badge badge-success">完了</span>
          </div>
          <p style={{ "color": "var(--text-secondary)", "fontSize": "0.875rem", "marginBottom": "16px" }}>フロントエンド、バックエンド、インフラのセキュリティに焦点を当てた2回目の監査。117 件超の指摘事項を特定・解決。</p>
          <ul className="audit-list">
            <li><span className="severity sev-high">高</span> CacheService.get() のクラッシュ — 無効な .decode() 呼び出しを削除</li>
            <li><span className="severity sev-high">高</span> JWT トークンの型検証 — 型チェックを追加</li>
            <li><span className="severity sev-medium">中</span> ContextVar シングルトンの修正 — モジュールレベルのインスタンスに変更</li>
            <li><span className="severity sev-medium">中</span> ログインレスポンスの検証 — Pydantic スキーマを修正</li>
            <li><span className="severity sev-medium">中</span> WebSocket の事前認証 — 接続数の制限を追加</li>
          </ul>
        </div>

        <div className="audit-card reveal">
          <div className="audit-card-header">
            <h3>第3ラウンド — ベストプラクティス監査</h3>
            <span className="audit-badge badge-success">完了</span>
          </div>
          <p style={{ "color": "var(--text-secondary)", "fontSize": "0.875rem", "marginBottom": "16px" }}>CertiK / OpenZeppelin / Stripe / CNCF / NIST のベストプラクティスに基づく監査。28 件超の指摘事項を解決。</p>
          <ul className="audit-list">
            <li><span className="severity sev-medium">中</span> K8s Role の権限 — 特定の Secret 取得のみに制限</li>
            <li><span className="severity sev-medium">中</span> コンテナイメージの固定 — BASE_IMAGE build-arg を追加</li>
            <li><span className="severity sev-low">低</span> CI 監査の厳格化 — pnpm audit から || true を削除</li>
            <li><span className="severity sev-low">低</span> Git の整理 — デプロイ成果物を .gitignore に追加</li>
            <li><span className="severity sev-low">低</span> CSP nonce の生成 — ハードコードではなくリクエスト単位で生成</li>
          </ul>
        </div>
      </div>
    </section>

    
    <section className="section">
      <div className="container">
        <div className="reveal section-intro">
          <p className="micro">セキュリティ機能</p>
          <h2 className="h2 section-title">多層防御</h2>
        </div>
        <div className="security-grid">
          <div className="security-item reveal">
            <div className="security-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <h3>マルチシグガバナンス</h3>
            <p>すべてのコントラクトアップグレードには、タイムロック付きの Gnosis Safe マルチシグ承認が必要です。</p>
          </div>
          <div className="security-item reveal">
            <div className="security-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <h3>タイムロック保護</h3>
            <p>すべての重要な操作に 48 時間のタイムロックを適用。透明で、レビュー可能、キャンセル可能です。</p>
          </div>
          <div className="security-item reveal">
            <div className="security-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h3>リアルタイムモニタリング</h3>
            <p>Forta ボットがすべてのコントラクトの相互作用を監視。異常や攻撃パターンを即座にアラートします。</p>
          </div>
          <div className="security-item reveal">
            <div className="security-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <h3>透明な検証</h3>
            <p>すべてのコントラクトは Etherscan で検証済み。ソースコードは GitHub で公開。隠し事は一切ありません。</p>
          </div>
          <div className="security-item reveal">
            <div className="security-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
            </div>
            <h3>Diamond アーキテクチャ</h3>
            <p>アップグレード可能な Diamond パターンにより、プロキシのリスクなしに機能を追加できます。</p>
          </div>
          <div className="security-item reveal">
            <div className="security-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            </div>
            <h3>アクセス制御</h3>
            <p>ロールベースの権限管理（OpenZeppelin AccessControl）。単一の侵害ポイントを排除します。</p>
          </div>
        </div>
      </div>
    </section>
  
    </>
  );
}
