/* Auto-generated from public/jp/blog/travel-rule-on-chain.html — do not edit by hand. */
const PAGE_CSS = `
.blog-article { padding: 140px 0 60px; }
    .blog-article .container { max-width: 800px; }
    .blog-article h1 { font-size: clamp(1.8rem, 4vw, 2.5rem); font-weight: 700; line-height: 1.2; margin-bottom: 16px; }
    .blog-meta { display: flex; align-items: center; gap: 16px; margin-bottom: 32px; color: var(--text-muted); font-size: 0.875rem; }
    .blog-meta .tag { background: var(--accent-dim); color: var(--accent); padding: 2px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
    .blog-content h2 { font-size: 1.4rem; font-weight: 600; margin: 48px 0 20px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
    .blog-content h3 { font-size: 1.1rem; font-weight: 600; margin: 32px 0 12px; color: var(--accent); }
    .blog-content p { color: var(--text-secondary); line-height: 1.8; margin-bottom: 20px; }
    .blog-content ul, .blog-content ol { color: var(--text-secondary); line-height: 1.8; margin-bottom: 20px; padding-left: 24px; }
    .blog-content li { margin-bottom: 8px; }
    .blog-content code { font-family: var(--font-mono); font-size: 0.85em; background: var(--bg-elevated); padding: 2px 6px; border-radius: 4px; color: var(--accent); }
    .blog-content pre { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 20px; overflow-x: auto; font-family: var(--font-mono); font-size: 0.8rem; line-height: 1.7; color: var(--text-secondary); margin: 20px 0; }
    .blog-content blockquote { border-left: 3px solid var(--accent); padding-left: 20px; margin: 24px 0; color: var(--text-secondary); font-style: italic; }
    .blog-nav { display: flex; justify-content: space-between; margin-top: 48px; padding-top: 32px; border-top: 1px solid var(--border); }
    .blog-nav a { color: var(--accent); font-size: 0.875rem; }
`;

export default function ContentBlogTravelRuleOnChainJP() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

      <article className="blog-article">
        <div className="container">
          <div className="reveal">
            <p className="micro">ブログ</p>
            <h1>オンチェーンのトラベルルール：FATF がステーブルコイン送金に求めるもの</h1>
            <div className="blog-meta">
              <span>2026年8月</span>
              <span className="tag">規制</span>
              <span>6分で読めます</span>
            </div>
          </div>

          <div className="blog-content reveal">
            <p>FATF トラベルルール（勧告 16）は、仮想資産サービスプロバイダー（VASP）に対して、1,000 米ドルを超える送金について送付人および受取人の情報の交換を義務づけています。ステーブルコイン発行者にとって、これはもはや理論上の義務ではありません。2026 年には、中国香港、EU（MiCA/TFR）、シンガポール、日本がいずれも施行しています。残された問いはアーキテクチャに関するものです。トラベルルール対応は、一体どこで実行されるべきなのでしょうか。</p>

            <h2>トラベルルールが実際に要求するもの</h2>

            <p>法的な文言を取り除くと、残るのは 3 つの技術的要件です。</p>

            <ul>
              <li><strong>アイデンティティの紐付け：</strong>送付人と受取人は、単なるアドレスではなく、検証済みのアイデンティティに帰属できなければなりません。</li>
              <li><strong>送信前スクリーニング：</strong>送金は価値が移動する前にチェックされなければならず、決済後にフラグを立てるのでは不十分です。</li>
              <li><strong>証明可能な記録：</strong>規制当局は、すべての送金がスクリーニングされたことを示す改ざん検知可能な証拠と、結果の複数年にわたる保存を期待しています。</li>
            </ul>

            <h2>API セントリックなアーキテクチャが苦戦する理由</h2>

            <p>多くの VASP は、トラベルルールをオフチェーン API に後付けしています。カストディアルなオーダーブックには通用しますが、オンチェーンのステーブルコイン送金では破綻します。</p>

            <ol>
              <li><strong>決済がスクリーニングを追い越す。</strong>送金は 2〜12 秒で確定します。API の往復とカウンターパーティの VASP とのハンドシェイクはそれ以上の時間がかかることがあります。決済後のスクリーニングはコンプライアンスではなく、フォレンジック（事後調査）です。</li>
              <li><strong>ノンカストディアルなホップはモデルの適用外。</strong>資金がセルフホスト型ウォレットや DeFi プールに触れた瞬間、二国間の VASP 間メッセージモデルには取り付くフックがなくなります。</li>
              <li><strong>ログは証拠ではない。</strong>オフチェーンのスクリーニングログは事後的に編集できます。規制当局は、なぜそれを信頼すべきなのかをますます問うようになっています。</li>
            </ol>

            <h2>オンチェーンエンフォースメントのパターン</h2>

            <p>代替案は、エンフォースメントのポイントを転送パスそのものに移動させることです。</p>

            <ul>
              <li><strong>アイデンティティレジストリのオンチェーン化：</strong>KYC アテステーションがアドレスを検証済みエンティティに紐付けるため、アイデンティティの紐付けはメッセージ交換ではなくルックアップになります。</li>
              <li><strong>実行前のポリシーチェック：</strong>トークンコントラクト（またはその手前にあるコンプライアンスルーター）が、状態遷移が起きる前にリスクスコアとトラベルルールのデータ要件を評価します。非準拠の送金は単にリバートします。スクリーニングは迂回も、遅延も、停止もできません。</li>
              <li><strong>不変の監査イベント：</strong>スクリーニング判定はすべてオンチェーンのイベントとして発行されます。監査証跡とはチェーンそのものです。決定論的で、タイムスタンプ付きで、書き換えは不可能です。</li>
            </ul>

            <blockquote>エンフォースメントが実行パスに移動すると、トラベルルールは事後に満たすべき報告義務ではなくなり、送金そのものの性質になります。</blockquote>

            <h2>実際のユースケース</h2>

            <p>FidesOrigin では、ステーブルコインの送金は 1 つのトランザクション内で 3 つのゲートを通過します。リスクオラクルが両カウンターパーティをスコアリングし、ポリシーエンジンが発行者のルール（管轄区域、金額ティア、制裁対象エンティティ）を評価し、コンプライアンスエンジンが送金を実行またはリバートしながら監査イベントを書き込みます。追加されるレイテンシーの合計はゼロで、オフチェーンの往復は発生しません。</p>

            <p>中国香港のステーブルコイン条例、MiCA/TFR、または MAS ガイドラインに直面する発行者にとって、結論は同じです。トラベルルールが API レイヤーで解決できるのは、フローのうちカストディアルな部分だけです。オープンなネットワークに触れるすべてにおいて、送金が実際に起きる場所、すなわちオンチェーンでのエンフォースメントが必要です。</p>
          </div>

          <div className="blog-nav reveal">
            <a href="/jp/blog">← ブログに戻る</a>
            <a href="/jp/blog/mica-stablecoin-compliance">次: ステーブルコインの MiCA コンプライアンス →</a>
          </div>
        </div>
      </article>
    </>
  );
}
