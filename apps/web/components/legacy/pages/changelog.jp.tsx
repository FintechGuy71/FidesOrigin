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
            <h3>v3.3 — 規制テンプレート</h3>
            <div className="date">2026年7月</div>
            <ul>
              <li>ステーブルコイン発行者向けに MiCA および HKMA のコンプライアンステンプレートを追加</li>
              <li>PolicyEngine を強化し、管轄区域ベースのルールセットに対応</li>
              <li>Sepolia テストネットにてインタラクティブデモを公開</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-major">メジャー</span>
            <h3>v3.2 — モニタリングとインデックス化</h3>
            <div className="date">2026年3月</div>
            <ul>
              <li>オンチェーンイベントをインデックス化する The Graph Subgraph を公開</li>
              <li>リアルタイムの異常検知のため Forta モニタリングボットを配備</li>
              <li>リアルタイムのリスク更新に対応する WebSocket ストリーミングを追加</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-major">メジャー</span>
            <h3>v3.1 — セキュリティ監査完了</h3>
            <div className="date">2026年1月</div>
            <ul>
              <li>3ラウンドの独立セキュリティ監査を完了</li>
              <li>コントラクト、バックエンド、インフラ全体で 300 件超の指摘事項を解決</li>
              <li>391 件のテストが合格、重大な問題は 0 件</li>
              <li>コアコントラクトのテストカバレッジ 99.9% を達成</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-major">メジャー</span>
            <h3>v3.0 — Diamond アーキテクチャ</h3>
            <div className="date">2025年10月</div>
            <ul>
              <li>アップグレード可能な facet のため EIP-2535 Diamond パターンへ移行</li>
              <li>マルチチェーン対応を追加（Ethereum、Base、Arbitrum）</li>
              <li>不正疑いのある取引をエスクローする QuarantineVault を導入</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-minor">マイナー</span>
            <h3>v2.0 — RiskRegistryV2</h3>
            <div className="date">2025年6月</div>
            <ul>
              <li>RiskRegistry をアップグレードし、Merkle プルーフベースのリスクコミットメントに対応</li>
              <li>PolicyEngine を強化し、設定可能なルールテンプレートを追加</li>
              <li>アドレス一括スクリーニング API を追加</li>
            </ul>
          </div>

          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <span className="timeline-badge badge-minor">マイナー</span>
            <h3>v1.0 — 初期リリース</h3>
            <div className="date">2025年1月</div>
            <ul>
              <li>FidesOrigin プロトコルを Sepolia テストネットに公開</li>
              <li>RiskRegistry と ComplianceEngine コントラクトをリリース</li>
              <li>TypeScript SDK と REST API を公開</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  
    </>
  );
}
