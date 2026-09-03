/* Auto-generated from public/cn/blog/travel-rule-on-chain.html — do not edit by hand. */
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

export default function ContentBlogTravelRuleOnChainCN() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

      <article className="blog-article">
        <div className="container">
          <div className="reveal">
            <p className="micro">博客</p>
            <h1>链上的旅行规则：FATF 对稳定币转账有何要求</h1>
            <div className="blog-meta">
              <span>2026 年 8 月</span>
              <span className="tag">监管</span>
              <span>6 分钟阅读</span>
            </div>
          </div>

          <div className="blog-content reveal">
            <p>FATF 旅行规则（第 16 号建议）要求虚拟资产服务提供商（VASP）针对超过 1000 美元的转账交换汇款人与收款人信息。对于稳定币发行方而言，这不再是理论上的义务：中国香港、欧盟（MiCA/TFR）、新加坡和日本都将在 2026 年强制执行该规则。悬而未决的是架构问题——旅行规则合规究竟应该在哪里执行？</p>

            <h2>旅行规则到底要求什么</h2>

            <p>剥去法律条文的外衣，剩下三项技术要求：</p>

            <ul>
              <li><strong>身份绑定：</strong>发送方和接收方必须能归因到已验证的身份，而不仅仅是地址。</li>
              <li><strong>转账前筛查：</strong>必须在价值转移之前完成转账检查，而不是在结算之后才标记。</li>
              <li><strong>可证明的记录：</strong>监管机构期望获得防篡改的证据，证明每笔转账都经过了筛查，且结果须保留数年。</li>
            </ul>

            <h2>为什么以 API 为中心的架构力不从心</h2>

            <p>大多数 VASP 把旅行规则外挂在链下 API 上。这对托管型订单簿可行，但对链上稳定币转账就会失效：</p>

            <ol>
              <li><strong>结算跑在筛查前面。</strong>一笔转账在 2-12 秒内即完成确认；而 API 往返加上对手方 VASP 的握手可能耗时更长。结算之后的筛查不是合规，而是事后取证。</li>
              <li><strong>非托管跳转逃出了模型。</strong>资金一旦进入自托管钱包或 DeFi 池，双边的 VASP 对 VASP 消息模型就无处挂载。</li>
              <li><strong>日志不是证明。</strong>链下筛查日志可能被事后修改。监管机构越来越多地质问：凭什么要相信它？</li>
            </ol>

            <h2>链上强制执行模式</h2>

            <p>另一种做法是把执行点移入转账路径本身：</p>

            <ul>
              <li><strong>身份注册表上链：</strong>KYC 证明将地址映射到已验证实体，使身份绑定变成一次查询，而不是一次消息交换。</li>
              <li><strong>执行前策略检查：</strong>代币合约（或其前端的合规路由器）在状态转换发生之前评估风险分数与旅行规则数据要求。不合规的转账会直接回滚——筛查无法被绕过、延迟或停机。</li>
              <li><strong>不可篡改的审计事件：</strong>每一次筛查决定都会发出链上事件。审计留痕就是链本身——确定性、带时间戳且无法改写。</li>
            </ul>

            <blockquote>当执行点移入执行路径，旅行规则就不再是事后才履行的报告义务，而成为转账本身的属性。</blockquote>

            <h2>实践中是什么样子</h2>

            <p>借助 FidesOrigin，一笔稳定币转账在单笔交易中会流经三道关卡：风险预言机为交易双方评分，策略引擎评估发行方的规则（司法管辖区、金额分层、受制裁实体），合规引擎随后执行转账或将其回滚，同时写入审计事件。新增的延迟总计为：零次链下往返。</p>

            <p>对于面临中国香港《稳定币条例》、MiCA/TFR 或 MAS 指引的发行方，结论是一样的：旅行规则只有在你的资金流中托管的那一部分才能在 API 层解决。凡是触及开放网络的部分，都需要在转账真正发生的地方——链上——进行强制执行。</p>
          </div>

          <div className="blog-nav reveal">
            <a href="/cn/blog">← 返回博客</a>
            <a href="/cn/blog/mica-stablecoin-compliance">下一篇：稳定币的 MiCA 合规 →</a>
          </div>
        </div>
      </article>
    </>
  );
}
