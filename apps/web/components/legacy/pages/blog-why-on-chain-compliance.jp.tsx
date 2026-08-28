/* Auto-generated from public/jp/blog/why-on-chain-compliance.html — do not edit by hand. */
const PAGE_CSS = `
.blog-hero {
      position: relative;
      padding: 160px 0 40px;
      overflow: hidden;
    }
    .blog-hero .glow {
      position: absolute;
      border-radius: 50%;
      filter: blur(100px);
      opacity: 0.08;
      pointer-events: none;
    }
    .blog-hero .glow-1 {
      width: 400px; height: 400px;
      background: var(--accent);
      top: -100px; right: -100px;
    }
    .blog-hero-content {
      position: relative;
      z-index: 1;
    }
    .blog-hero .display {
      font-size: clamp(2rem, 4.5vw, 3.2rem);
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -0.03em;
    }
    .blog-hero .display span {
      background: linear-gradient(135deg, var(--accent) 0%, var(--gold) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hr-fade {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
      margin: 0 auto;
      max-width: 800px;
    }
    .article {
      font-size: 1rem;
      line-height: 1.75;
      color: var(--text-secondary);
    }
    .article p { margin-bottom: 1.5rem; }
    .article h2 {
      color: var(--text);
      font-size: 1.5rem;
      font-weight: 600;
      margin-top: 2.5rem;
      margin-bottom: 1rem;
      letter-spacing: -0.02em;
    }
    .article h3 {
      color: var(--text);
      font-size: 1.125rem;
      font-weight: 600;
      margin-top: 2rem;
      margin-bottom: 0.75rem;
      letter-spacing: -0.01em;
    }
    .article ul { margin-bottom: 1.5rem; padding-left: 1.5rem; }
    .article ul li { margin-bottom: 0.5rem; }
    .article a { color: var(--accent); text-decoration: none; }
    .article a:hover { text-decoration: underline; }
    .article blockquote {
      border-left: 2px solid var(--accent);
      padding-left: 1.25rem;
      margin: 1.5rem 0;
      color: var(--text);
      font-weight: 500;
    }
    .article strong { color: var(--text); font-weight: 600; }
    .article em { color: var(--accent); font-style: italic; }
    .article .callout {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 1.25rem 1.5rem;
      margin: 1.5rem 0;
    }
    .article .callout p:last-child { margin-bottom: 0; }
    .blog-code-block {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      overflow: hidden;
      margin: 1.5rem 0;
    }
    .blog-code-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 1rem;
      background: var(--bg-elevated);
      border-bottom: 1px solid var(--border);
      font-size: 0.8rem;
      color: var(--text-muted);
      font-family: var(--font-mono);
    }
    .blog-code-body {
      padding: 1rem;
      overflow-x: auto;
    }
    .blog-code-body pre {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      line-height: 1.7;
      color: var(--text-secondary);
      margin: 0;
    }
    .tk-keyword { color: #c586c0; }
    .tk-type { color: #4ec9b0; }
    .tk-func { color: #dcdcaa; }
    .tk-comment { color: #6a9955; }
    .tk-string { color: #ce9178; }
    .blog-cta {
      text-align: center;
      padding: 80px 40px;
    }
    .blog-cta .btn-primary {
      background: var(--accent);
      color: var(--bg);
      box-shadow: none;
    }
    .blog-cta .btn-primary:hover {
      background: var(--gold);
      transform: translateY(-1px);
    }
    @media (max-width: 640px) {
      .blog-hero { padding: 120px 0 30px; }
      .blog-code-body pre { white-space: pre-wrap; word-break: break-all; }
    }
`;

export default function ContentBlogWhyOnChainComplianceJP() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />

    
    <section className="blog-hero">
      <div className="glow glow-1"></div>
      <div className="container blog-hero-content">
        <div className="reveal">
          <p className="micro">Blog — 2026年6月</p>
          <h1 className="display">なぜオンチェーンか：<br /><span>API ベースコンプライアンスの終焉</span></h1>
          <p className="lead" style={{ "maxWidth": "600px", "marginTop": "20px" }}>今、暗号通貨のコンプライアンスに取り組む全員が、同じアーキテクチャ的誤りを犯している。彼らは間違ったことをやっている。そして、彼ら自身もそれを知っている。</p>
        </div>
      </div>
    </section>

    <div className="hr-fade"></div>

    
    <article className="article container" style={{ "maxWidth": "720px", "paddingTop": "60px", "paddingBottom": "60px" }}>
      <p>誰も大声で言いたがらない事実がある。今日の暗号通貨コンプライアンスの主要スタックはすべて、根本的に破綻した前提の上に構築されている。トランザクションを実行すると、それは中央集権的な API にヒットし、その API はバージニア州のどこかにあるデータベースを確認し、それから——うまくいけば、いつか——送金をブロックすべきかどうかを伝える。</p>

      <p>一秒考えてみろ。ブロックチェーンの約束は<em>非中央集権化、透明性、検閲抵抗</em>だ。そして、あなたのコンプライアンス・ソリューションはバージニア州の中央集権的 API である。</p>

      <p>それはフィーチャーではない。あなたが金を払って買っているバグだ。</p>

      <p>これらのシステムを構築している人々が愚かだと言っているわけではない。Chainalysis、Elliptic、TRM——彼らには優秀なエンジニアと良いデータがある。だが、彼らは間違った問題を間違ったアーキテクチャで解こうとしている。Web2 のコンプライアンスを Web3 のインフラにボルトで止めようとしている。その結果は、両方の世界の最悪を継承したフランケンシュタインだ。</p>

      <h2>API モデルは間違っている</h2>

      <p>API モデルが間違っている理由を具体的に説明しよう。手を振るだけでは役に立たない。</p>

      <p><strong>レイテンシー。</strong> API コールごとに、トランザクションフローにミリ秒、時に数秒が追加される。DeFi において、それは永遠だ。MEV ボットはあなたのコンプライアンス API が応答するのを待たない。DEX でトークンをスワップしようとしているユーザーも同様だ。その遅延は面倒なだけではない——経済的に破壊的だ。即時のファイナリティのために構築されたシステムに、バージニア州アシュバーンの誰かがデータベースの行を調べるのを待つように求めている。</p>

      <p><strong>単一障害点。</strong> API がダウンしたらどうなる？ コンプライアンス・プロバイダーが停止したら？ 彼らの DNS が失敗したら？ レート制限が発動したら？ 私はそれを目の当たりりにした——大手取引所は、KYT プロバイダーの API がダウンしたため、出金を停止しなければならなかった。コンプライアンス・スタック全体は、SLA に包まれた単一障害点だった。SLA はライブの時に役に立たない。</p>

      <p><strong>信頼の仮定。</strong> API が正しい答えを返すことを信頼しなければならない。データベースが最新であることを。プロバイダーが侵害されていないことを。転送中に応答が改竄されていないことを。トラストレスネスが全てのポイントである世界で、あなたは完全にサードパーティを信頼する必要があるコンプライアンス・システムを構築した。それはコンプライアンスについてすらトラストレスではない——<em>特に</em>コンプライアンスについて信頼しているのだ。</p>

      <p><strong>迂回経路。</strong> API チェックはトランザクションの<em>周り</em>で行われ、トランザクションの<em>内側</em>ではない。API が「ブロック」と言っても、フロントエンドは単に……ブロックしないこともできる。スマートコントラクトは知らない。ブロックチェーンは知らない。コンプライアンス・チェックはルールではなく提案だ。決意のある行為者はそれを完全に迂回できる。私たちはこれを何度も見てきた——制裁スクリーニングが、ユーザーフェイシング UI にのみ適用され、基礎となるスマートコントラクトには適用されない。それは茶番劇だ。</p>

      <p>Chainalysis KYT は代表的な例だ。動作はこうだ：トランザクションがバックエンドにヒットし、バックエンドが Chainalysis を呼び出し、Chainalysis が応答し、バックエンドがどうするかを決定する。ブロックチェーンが最後に知る。コンプライアンス・レイヤーは、保護すべきシステムの外にいる門番だ。</p>

      <p>そして Chainlink Functions もある。生の API よりは良いが、まだ間違っている。オラクル・モデルを押し付ける：リクエストを行い、オラクルネットワークがデータを取得し、オラクルがオンチェーンで返す。だが今、あなたはオラクルのガスを支払い、オラクルのレイテンシーを待ち、オラクルネットワークのセキュリティ・モデルを信頼している。改善だが、それでもラウンドトリップだ。コンプライアンス・チェックは実行環境にネイティブではない。訪問者だ。</p>

      <h2>正しい方法：オンチェーン・ネイティブ実行</h2>

      <p>正しい方法がどう見えるかを示そう。リスクデータはオンチェーンに存在する。ポリシー・エンジンはオンチェーンに存在する。評価は同じトランザクション内で、同じブロック内で、同じ実行コンテキストで行われる。API コールはない。レイテンシーはない。迂回はない。信頼の仮定はない。</p>

      <p>ユーザーがトークンを転送しようとすると、スマートコントラクト自身が受取人のリスク・プロファイルを確認する。受取人が制裁対象なら、転送はリバートする。リスク・スコアが高すぎれば、転送は隔離される。すべてがクリーンなら、転送は進む。これはすべて<em>一つの不可分トランザクション</em>で行われる。ブロックチェーンはサーバーに許可を求めない。答えは既にオンチェーンにあるから、それを知っている。</p>

      <p>これは小さな改善ではない。パラダイム・シフトだ。</p>

      <p>重要な利点は五つある：</p>

      <p><strong>1. 決定論性。</strong> 同じ入力は常に同じ出力を生む。アドレス A が制裁対象なら、それは<em>常に</em>制裁対象だ。競合状態もなく、古いデータもなく、「API がトランザクション中に更新されていた」ということもない。リスク・プロファイルはコンセンサス的事実だ。ネットワーク上の全ノードがそれに同意する。</p>

      <p><strong>2. ゼロレイテンシー。</strong> リスク・チェックはトランザクション実行の一部だ。ローカル変数から読み取るのと同じガスコストだ。ネットワークのラウンドトリップはない。HTTP タイムアウトはない。接続プールの枯渇はない。チェックはローカル変数から読み取るのと同じくらい速い——それがそうだからだ。</p>

      <p><strong>3. 迂回不可能。</strong> チェックはスマートコントラクト内で行われる。チェックが失敗すれば、トランザクションはリバートする。それを迂回する方法はない。コンプライアンス・レイヤーを飛ばしてコントラクトを直接呼び出すことはできない。コンプライアンス・レイヤー<em>が</em>コントラクトだ。セキュリティ境界は実行境界だ。これは警備員と壁の違いだ。</p>

      <p><strong>4. 透明性と監査可能性。</strong> すべてのリスク・チェックはオンチェーンに記録される。誰でも何が起こり、なぜ起こったかを見ることができる。プロバイダーのブラックボックス・アルゴリズムを信頼する必要はない。コンプライアンスを検証するために SOC-2 レポートは必要ない。コンプライアンスはトランザクション履歴だ。規制当局は直接検証できる。監査人は直接検証できる。あなたのユーザーも直接検証できる。透明性は追加するフィーチャーではない——デフォルトだ。</p>

      <p><strong>5. プロトコルレベルの統合。</strong> リスク・エンジンがスマートコントラクトなので、他のどのスマートコントラクトもそれを継承できる。あなたのステーブルコイン、あなたのウォレット、あなたの DEX、あなたの RWA トークン——すべてが同じオンチェーン・レジストリを呼び出す。統合は「SDK を追加して API コールを行う」ことではない。統合は「コントラクトをインポートしてチェックを継承する」ことだ。Solidity で三行だ。依存関係とプロトコルの違いだ。</p>

      <div className="callout">
        <p><strong>類推：</strong> API ベースのコンプライアンスは、データベースの制約を別のマイクロサービスに書くようなものだ。すべての挿入は、データが有効かどうかを確認するために REST API を呼び出す。API がダウンすれば、すべての書き込みを停止するか、ダーティデータをリスクするかのどちらかだ。オンチェーン・コンプライアンスはデータベース・トリガーのようなものだ。制約はトランザクション内で実行される。失敗すれば、トランザクションは失敗する。ネットワークコールはない。別のサービスはない。それを迂回する方法はない。</p>
      </div>

      <p>これは<em>バックエンド API</em>から<em>データベース・トリガー</em>へのシフトだ。API をより速くまたはより信頼できるようにすることではない。API がそもそも存在すべきではないことを気づくことだ。</p>

      <h2>FidesOrigin の実装</h2>

      <p>FidesOrigin はこの原則に基づいて構築されている。リスクデータはチェーンに同期される。ポリシー・エンジンはスマートコントラクトだ。評価は転送フック内で行われる。</p>

      <p>実際にどう見えるかを示そう。ステーブルコインがある。すべての転送を制裁リストとリスク・プロファイルに照らしてスクリーニングしたい。コンプライアンス・コントラクトを継承する。<code>_update</code> フックをオーバーライドする。そのフック内で、オンチェーン・リスク・エンジンを呼び出す。転送がポリシーに違反すれば、リバートする。以上だ。</p>

      <div className="blog-code-block">
        <div className="blog-code-header">
          <span>CompliantStableCoin.sol</span>
          <span>Solidity 0.8.26</span>
        </div>
        <div className="blog-code-body">
<pre><span className="tk-comment">// ステーブルコインはオンチェーン・リスク・スクリーニングを継承</span>
<span className="tk-keyword">contract</span> <span className="tk-type">CompliantStableCoin</span> <span className="tk-keyword">is</span> <span className="tk-type">ERC20</span>, <span className="tk-type">IFidesCompliance</span> &#123;

    <span className="tk-keyword">function</span> <span className="tk-func">_update</span>(
        <span className="tk-keyword">address</span> from, <span className="tk-keyword">address</span> to,
        <span className="tk-keyword">uint256</span> amount
    ) <span className="tk-keyword">internal override</span> &#123;
        <span className="tk-comment">// 転送実行前に評価</span>
        (<span className="tk-keyword">bool</span> allowed, <span className="tk-keyword">uint256</span> risk) =
            fides.<span className="tk-func">evaluateTransaction</span>(
                from, to, amount, <span className="tk-keyword">address</span>(<span className="tk-keyword">this</span>)
            );

        <span className="tk-keyword">if</span> (!allowed)
            <span className="tk-keyword">revert</span> <span className="tk-func">ComplianceViolation</span>(from, to, risk);

        <span className="tk-keyword">super</span>.<span className="tk-func">_update</span>(from, to, amount);
    &#125;
&#125;</pre>
        </div>
      </div>

      <p>API キーはない。レート制限はない。サービス依存はない。コンプライアンス・ロジックは転送自体と同じ実行コンテキスト内にある。トランザクションは有効か、そうでないかだ。「たぶん」はない。</p>

      <p>データ・レイヤーは自律的だ。OFAC SDN、Chainalysis、OpenSanctions——フィードは継続的にチェーンに同期される。だが、同期はバックグラウンド・プロセスであり、トランザクションの依存ではない。トランザクションはオンチェーンに既にあるものだけを読む。その読み取りは瞬時だ。書き込みは非同期だ。システムはデータの鮮度をトランザクション実行から切り離す。</p>

      <p>これは<em>問う</em>ことと<em>知る</em>ことの違いだ。API モデルは問う。オンチェーン・モデルは知る。</p>

      <h2>カテゴリーの定義：オンチェーンリスクエンフォースメント</h2>

      <p>これには新しい名前が必要だ。「コンプライアンス API」は間違っている。「オラクルベース・コンプライアンス」も間違っている。私たちが構築しているものは<em>オンチェーンリスクエンフォースメント</em>だ。</p>

      <p>リスク・スクリーニングではなく、リスク・エンフォースメントだ。スクリーニングは、何かを見て決定することだ。エンフォースメントは、システム自身が決定することだ。スクリーニングはオプションだ。エンフォースメントは必須だ。</p>

      <p>オンチェーンであり、オフチェーンではない。ハイブリッドでもない。ブリッジでもない。エンフォースメント・ロジックは、それが統制するトランザクションと同じレイヤーで実行される。リスクデータはコンセンサス・データだ。ポリシー実行はコンセンサス実行だ。結果はコンセンサス的事実だ。</p>

      <p>これは新しいカテゴリーだ。コンプライアンス API 全体を完全に置き換えるわけではない——調査ツール、フォレンジック分析、レポーティングのニーズは常に存在する。だが、転送ポリシーのリアルタイム執行において、API は間違ったツールだ。四角い穴に丸い杭を打ち込むようなものだ。その穴は日々大きくなっている。</p>

      <p>重要なプラットフォーム——ステーブルコイン発行体、スマートコントラクト・ウォレット、RWA トークン化、エージェンティック・ペイメント・レール——は、コアリスク・コントロールを外部 API に依存することを許容できない。KYT 応答を待つ間、すべての転送を停止するステーブルコインはステーブルコインではない。それは手順が増えた銀行 API だ。コンプライアンスをサードパーティ・サービスに委任するスマートウォレットはスマートウォレットではない。バックドアのあるフロントエンドだ。</p>

      <p>未来は、自身のルールを執行するコントラクトだ。自身のトランザクションをスクリーニングするプロトコルだ。許可を求めないウォレット——既に答えを知っているからだ。</p>

      <p>これが FidesOrigin が構築するものだ。コンプライアンス API ではない。オラクルでもない。トランザクション内で実行されるオンチェーン・リスク・エンジンだ。決定論的。ゼロレイテンシー。透明。迂回不可能。プロトコル・ネイティブ。</p>

      <p>次世代のオンチェーン・ファイナンスを構築しているなら、コンプライアンス・ベンダーは必要ない。コンプライアンス・プロトコルが必要だ。</p>

      <p>暗号通貨コンプライアンスの API 時代は終わりを告げている。エンフォースメントの時代が始まっている。</p>
    </article>

    <div className="hr-fade"></div>

    
    <section className="blog-cta">
      <div className="container" style={{ "maxWidth": "600px" }}>
        <h2 className="h2" style={{ "marginBottom": "16px" }}>オンチェーンリスクエンフォースメントで構築</h2>
        <p className="lead" style={{ "marginBottom": "32px" }}>FidesOrigin は、ステーブルコイン、スマートウォレット、RWA プラットフォーム、エージェンティック・ペイメント・レールのためのネイティブ・オンチェーン・リスク・エンジンだ。</p>
        <div style={{ "display": "flex", "gap": "12px", "justifyContent": "center", "flexWrap": "wrap" }}>
          <a href="/jp/" className="btn btn-primary">
            FidesOrigin を探る
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l5-5-5-5" /></svg>
          </a>
          <a href="mailto:contact@fidesorigin.com" className="btn btn-secondary">お問い合わせ</a>
        </div>
      </div>
    </section>
  
    </>
  );
}
