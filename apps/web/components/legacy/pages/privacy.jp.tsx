/* Auto-generated from public/jp/privacy.html — do not edit by hand. */
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

export default function ContentPrivacyJP() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
<div className="legal-page">
    <div className="container">
      <h1>プライバシーポリシー</h1>
      <p className="last-updated">最終更新日：2026年7月</p>

      <section className="legal-section">
        <h2>1. 概要</h2>
        <p>FidesOrigin はオンチェーン・コンプライアンス・プロトコルです。設計上、データ収集を最小限に抑えています。本ポリシーでは、処理する限られたデータとその保護方法について説明します。</p>
      </section>

      <section className="legal-section">
        <h2>2. 収集する情報</h2>
        <p><strong>オンチェーン・データ：</strong>すべてのリスク評価とコンプライアンス・チェックはオンチェーンで行われます。取引データはブロックチェーン技術の性質上公開されており、当社が収集するものではありません。</p>
        <p><strong>ウェブサイト分析：</strong>ウェブサイトの使用状況を把握するため、最小限の分析を使用しています。これには、IP アドレス（匿名化）、ブラウザの種類、訪問したページなどが含まれる場合があります。</p>
        <p><strong>ウォレット接続：</strong>ウォレットを接続する際、公開アドレスのみを読み取ります。取引の署名や秘密鍵へのアクセスを求めることはありません。</p>
      </section>

      <section className="legal-section">
        <h2>3. 情報の利用方法</h2>
        <ul>
          <li>サービスの提供と改善</li>
          <li>サポートリクエストへの対応</li>
          <li>ウェブサイト使用パターンの分析</li>
          <li>法的義務の遵守</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>4. Cookie</h2>
        <p>ウェブサイト機能のために必要な Cookie を使用しています。広告目的のトラッキング Cookie は使用していません。ブラウザ設定で Cookie を無効にすることができます。</p>
      </section>

      <section className="legal-section">
        <h2>5. 第三者サービス</h2>
        <p>以下の第三者サービスを使用しています：</p>
        <ul>
          <li><strong>Vercel：</strong>ウェブサイトホスティング</li>
          <li><strong>The Graph：</strong>ブロックチェーン・データ・インデックス</li>
          <li><strong>RPC プロバイダー：</strong>ブロックチェーン・ノード・アクセス</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>6. データセキュリティ</h2>
        <p>業界標準のセキュリティ対策を実施しています。ただし、完全に安全なシステムは存在しません。ユーザーは自身のウォレット秘密鍵の保護に責任を持ちます。</p>
      </section>

      <section className="legal-section">
        <h2>7. ユーザーの権利</h2>
        <p>管轄区域によっては、個人データへのアクセス、訂正、削除の権利がある場合があります。<a href="mailto:privacy@fidesorigin.com">privacy@fidesorigin.com</a> までご連絡ください。</p>
      </section>

      <section className="legal-section">
        <h2>8. ポリシーの変更</h2>
        <p>本ポリシーは随時更新される場合があります。変更は更新日付と共に本ページに掲載されます。</p>
      </section>

      <section className="legal-section">
        <h2>9. お問い合わせ</h2>
        <p>プライバシーに関するご質問は <a href="mailto:privacy@fidesorigin.com">privacy@fidesorigin.com</a> まで。</p>
      </section>
    </div>
  </div>
    </>
  );
}
