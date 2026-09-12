/* Auto-generated from public/jp/changelog.html — do not edit by hand. */
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

export default function ContentChangelogJP() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    <section className="cl-hero">
      <div className="container">
        <div className="reveal">
          <p className="micro">変更履歴</p>
          <h1 className="display">プロトコルの <span>進化</span></h1>
          <p className="lead" style={{ "maxWidth": "600px", "margin": "20px auto 0" }}>初期リリースから最新のセキュリティ強化バージョンまで、すべてのマイルストーンを追跡できます。</p>
        </div>
      </div>
    </section>

    <section className="section" style={{ "paddingTop": "0" }}>
      <div className="container">
        <div className="timeline reveal">
          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-latest">最新</span>
            <h3>v3.1.0 — セキュリティ監査リリース</h3>
            <div className="date">2026年8月</div>
            <ul>
              <li>独立セキュリティ監査で指摘された全 53 件を完全修復（High 6 / Medium 15 / Low 26 / Info 6）</li>
              <li>コントラクト・ゲートウェイ API・データパイプラインで 9 件の Breaking Changes——詳細は CHANGELOG.md</li>
              <li>Sepolia に v3.1.0 コントラクト群を新規デプロイ；DEPLOYED.md を権威レジストリとして公開</li>
              <li>コントラクトテスト 449/449 合格（回帰テスト 15 件を追加）</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-major">メジャー</span>
            <h3>v2.8.0 — リアルタイムデモと多言語展開</h3>
            <div className="date">2026年8月</div>
            <ul>
              <li>Sepolia リアルタイムデモページ公開：MetaMask ウォレット連携とマルチ RPC フォールバック</li>
              <li>アドレスチェック V2.1 を全面刷新：リアルタイムのコントラクタクエリと Guard ステータス監視</li>
              <li>CN / TW / JP で 15 の翻訳ページを新規追加</li>
              <li>hreflang 付き sitemap を自動生成；ブランド統一の 404 ページ</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-major">メジャー</span>
            <h3>v2.7.0-A+ — セキュリティ強化</h3>
            <div className="date">2026年8月</div>
            <ul>
              <li>A+ セキュリティ監査レポート；Cloudflare Workers プロキシでセキュリティヘッダーを注入</li>
              <li>391 件のコントラクトテスト合格；Subgraph v0.0.4 に Guard エンティティを追加</li>
              <li>ウェブサイト v2.1 を全面再構築、EN/CN/TW/JP の 4 言語に対応</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-major">メジャー</span>
            <h3>v2.1.0 — Guard アーキテクチャ</h3>
            <div className="date">2026年7月</div>
            <ul>
              <li>FidesCompliance V2.1 に PreTransactionGuard を統合し、ガス不要の取引前チェックを実現</li>
              <li>GNN 駆動のアドレスプロファイリング</li>
              <li>UUPS プロキシによるプラガブルなコンプライアンスモジュール</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-minor">マイナー</span>
            <h3>v2.0.0 — RiskRegistryV2</h3>
            <div className="date">2026年7月</div>
            <ul>
              <li>RiskRegistry V2 に CDD ラベルを導入；PolicyEngine がウォレット単位のルールに対応</li>
              <li>QuarantineVault（隔離ボールト）；CompliantStableCoin (fUSD)</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-minor">マイナー</span>
            <h3>v1.0.0 — 初期リリース</h3>
            <div className="date">2026年7月</div>
            <ul>
              <li>プロトコル初期リリース、基本的な KYC/AML スクリーニングを内蔵</li>
              <li>OFAC ブラックリストチェック；プログラマブルなポリシールール</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  
    </>
  );
}
