/* Auto-generated from public/cn/blog/ofac-sanctions-screening-blockchain.html — do not edit by hand. */
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
    .blog-content blockquote { border-left: 3px solid var(--accent); padding-left: 20px; margin: 24px 0; color: var(--text-secondary); font-style: italic; }
    .blog-nav { display: flex; justify-content: space-between; margin-top: 48px; padding-top: 32px; border-top: 1px solid var(--border); }
    .blog-nav a { color: var(--accent); font-size: 0.875rem; }
`;

export default function ContentBlogOfacSanctionsScreeningBlockchainCN() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

    <article className="blog-article">
      <div className="container">
        <div className="reveal">
          <p className="micro">博客</p>
          <h1>区块链上的 OFAC 制裁筛查：最佳实践</h1>
          <div className="blog-meta">
            <span>2026 年 7 月</span>
            <span className="tag">合规</span>
            <span>7 分钟阅读</span>
          </div>
        </div>

        <div className="blog-content reveal">
          <p>美国海外资产控制办公室（OFAC）维护着特别指定国民（SDN）名单——其中汇总了美国人士被禁止与其进行交易的个人、实体和地址。对于区块链协议而言，这带来了传统金融机构所不会面临的独特挑战。</p>

          <h2>链上制裁筛查的挑战</h2>

          <p>与传统金融中交易需经由中介机构流转不同，区块链交易是点对点的。没有银行可以在交易结算前将其拦截。这意味着合规必须嵌入协议层：</p>

          <ul>
            <li><strong>交易前筛查：</strong>每笔转账在执行前都必须经过评估</li>
            <li><strong>非托管环境：</strong>没有中心化机构持有资金或控制访问权限</li>
            <li><strong>假名性：</strong>地址与现实世界身份并非一一对应</li>
            <li><strong>不可逆性：</strong>交易一经上链便无法撤销</li>
          </ul>

          <h2>最佳实践 #1：链上强制执行</h2>

          <p>最稳健的做法是将制裁筛查直接嵌入智能合约。这确保了：</p>

          <ol>
            <li><strong>确定性：</strong>每笔交易都在完全相同的规则下接受筛查</li>
            <li><strong>无法绕过：</strong>即使是直接调用合约也会触发合规检查</li>
            <li><strong>可审计性：</strong>筛查决定被永久记录在链上</li>
            <li><strong>可用性：</strong>不依赖任何可能失效的外部 API</li>
          </ol>

          <h2>最佳实践 #2：风险分层，而非二元的阻止</h2>

          <p>更精细的做法采用风险分层，而不是简单的允许/阻止：</p>

          <ul>
            <li><strong>UNKNOWN：</strong>无历史记录的新地址——要求额外验证</li>
            <li><strong>LOW：</strong>未检测到风险标记——允许并适用标准限额</li>
            <li><strong>MEDIUM：</strong>存在一定风险指标——加强监测</li>
            <li><strong>HIGH：</strong>存在显著风险——隔离待人工审查</li>
            <li><strong>CRITICAL：</strong>命中制裁名单——阻止并告警</li>
          </ul>

          <h2>最佳实践 #3：保持数据新鲜</h2>

          <p>OFAC 会定期更新 SDN 名单。链上注册表必须自主更新。FidesOrigin 使用 Chainlink Functions 获取最新的制裁数据并更新链上 RiskRegistry，无需人工干预。</p>

          <h2>最佳实践 #4：隔离优先于阻止</h2>

          <p>与其直接阻止交易（可能引发用户体验问题和误判），不如考虑隔离机制：</p>

          <blockquote>"隔离金库会将可疑资金暂存待审，而不是直接拒绝。这在保持合规的同时降低了误判率。"</blockquote>

          <h2>结论</h2>

          <p>区块链上的 OFAC 合规并非可选项——它是任何在美国运营或服务美国人士的协议的法定要求。问题不在于是否合规，而在于如何在不牺牲去中心化优势的前提下实现合规。链上强制执行就是答案。</p>
        </div>

        <div className="blog-nav reveal">
          <a href="/cn/blog">← 全部文章</a>
          <a href="/cn/blog/hong-kong-stablecoin-license">下一篇：中国香港牌照 →</a>
        </div>
      </div>
    </article>
  
    </>
  );
}
