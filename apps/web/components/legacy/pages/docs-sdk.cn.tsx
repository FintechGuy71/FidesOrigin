/* Auto-generated from public/cn/docs/sdk.html — do not edit by hand. */
import Link from "next/link";

export default function ContentDocsSdkCN() {
  return (
    <>
<div className="docs-layout">
    <button className="docs-sidebar-toggle" id="sidebarToggle" aria-expanded="false" aria-label="切换侧边栏">
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      文档菜单
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
    </button>
    <aside className="docs-sidebar" id="docsSidebar">
      <div className="docs-sidebar-title">文档</div>
      <ul className="docs-nav-tree">
        <li><Link href="/cn/docs" prefetch={false}>概览</Link></li>
        <li><Link href="/cn/docs/api" prefetch={false}>API 参考</Link></li>
        <li><Link href="/cn/docs/sdk" className="active" prefetch={false}>SDK</Link></li>
      </ul>
      <div className="docs-sidebar-title">资源</div>
      <ul className="docs-nav-tree">
        <li><Link href="/cn/blog" prefetch={false}>博客</Link></li>
        <li><a href="https://github.com/FintechGuy71/FidesOrigin" target="_blank" rel="noopener">GitHub</a></li>
        <li><Link href="/admin/dashboard" prefetch={false}>控制台</Link></li>
      </ul>
    </aside>


    <div className="docs-content">
      <h1>SDK <span className="docs-version">v0.2.1</span></h1>
      <p className="docs-lead">用于钱包集成和链上合规的 JavaScript SDK。</p>

      <h2>Packages</h2>
      {/* ⚠ 原为 style={{ gridTemplateColumns: "1fr 1fr" }}：未分层内联样式恒胜任何
          @layer 内声明，把 legacy.css 的 @media (max-width:600px)
          {.docs-cards{grid-template-columns:1fr}} 直接击穿 —— 移动端仍是两列，
          卡片被压到约 160px 宽。.docs-cards 的基线本就是 repeat(2,1fr)，
          这里无需重复声明。 */}
      <div className="docs-cards">
        <a href="#rest-sdk" className="docs-card">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h3>REST SDK</h3>
          <p>API 客户端、风险检查、规则管理、WebSocket 流式传输。</p>
        </a>
        <a href="#on-chain-sdk" className="docs-card">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </div>
          <h3>On-Chain SDK</h3>
          <p>直接与智能合约交互、Guard 集成、免 gas 读取。</p>
        </a>
      </div>

      <h2 id="rest-sdk">安装</h2>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>npm</span>
          <button className="docs-code-copy" aria-label="复制代码">复制</button>
        </div>
        <pre><code>npm install @fintechguy71/fidesorigin-sdk</code></pre>
      </div>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>yarn</span>
          <button className="docs-code-copy" aria-label="复制代码">复制</button>
        </div>
        <pre><code>yarn add @fintechguy71/fidesorigin-sdk</code></pre>
      </div>
      <p className="docs-note"><strong>包来源：</strong>SDK 已发布到公共 npm registry（上方命令即规范安装方式）。在公共 npm 首次发布生效前，也可通过 GitHub Packages 安装——在 <code>.npmrc</code> 中加入 <code>@fintechguy71:registry=https://npm.pkg.github.com</code> 并用 GitHub token 鉴权。</p>

      <h2>快速开始</h2>

      <h3>初始化客户端</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="复制代码">复制</button>
        </div>
        <pre><code>import &#123; FidesOriginClient &#125; from '@fintechguy71/fidesorigin-sdk';

const fides = new FidesOriginClient(&#123;
  baseUrl: 'https://api.fidesorigin.com',
  apiKey: 'YOUR_API_KEY',
  timeout: 30000
&#125;);</code></pre>
      </div>
      <p className="docs-note"><strong>注意：</strong>在浏览器环境中只允许使用公开 API Key（前缀 <code>pk_</code>）。出于安全考虑，密钥（secret key）会被严格禁止。</p>

      <h3>检查地址风险</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="复制代码">复制</button>
        </div>
        <pre><code>const result = await fides.checkRisk(&#123;
  address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee',
  chainId: 1  // 或 'ethereum'、'sepolia'、11155111
&#125;);

console.log(result.risk_level);   // 'low' | 'medium' | 'high' | 'critical'
console.log(result.risk_score);   // 0-100
console.log(result.risk_factors); // 风险标记数组</code></pre>
      </div>

      <h3>批量风险检查</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="复制代码">复制</button>
        </div>
        <pre><code>const batch = await fides.batchCheckRisk(&#123;
  addresses: [
    '0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee',
    '0xdAC17F958D2ee523a2206206994597C13D831ec7'
  ],
  chainId: 1
&#125;);

console.log(batch.summary); // &#123; total, highRisk, mediumRisk, lowRisk &#125;</code></pre>
      </div>

      <h3>WebSocket 流式传输</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="复制代码">复制</button>
        </div>
        <pre><code>const ws = fides.createWebSocket(&#123;
  autoReconnect: true,
  reconnectInterval: 3000
&#125;);

await ws.connect();
ws.subscribe(['risk.update', 'alert.new', 'rule.match']);

ws.on('risk.update', (msg) =&gt; &#123;
  console.log('风险已更新:', msg.data.address, msg.data.risk);
&#125;);

ws.on('alert.new', (msg) =&gt; &#123;
  console.log('新告警:', msg.data);
&#125;);</code></pre>
      </div>

      <h2>核心 API</h2>
      <div className="docs-table-wrap">
        <table className="docs-table">
          <thead>
            <tr><th>方法</th><th>返回</th><th>描述</th></tr>
          </thead>
          <tbody>
            <tr><td><code>checkRisk(input)</code></td><td>Promise&lt;RiskCheckResult&gt;</td><td>单地址风险评估</td></tr>
            <tr><td><code>batchCheckRisk(input)</code></td><td>Promise&lt;BatchRiskCheckResult&gt;</td><td>批量地址筛查</td></tr>
            <tr><td><code>getAddressRisk(address)</code></td><td>Promise&lt;AddressRisk&gt;</td><td>获取地址的最新风险快照</td></tr>
            <tr><td><code>getDashboardStats()</code></td><td>Promise&lt;DashboardStats&gt;</td><td>全局合规统计数据</td></tr>
            <tr><td><code>listRules(options?)</code></td><td>Promise&lt;RuleListResponse&gt;</td><td>分页列出合规规则</td></tr>
            <tr><td><code>createRule(req)</code></td><td>Promise&lt;Rule&gt;</td><td>创建新的合规规则</td></tr>
            <tr><td><code>updateRule(id, req)</code></td><td>Promise&lt;Rule&gt;</td><td>更新已有规则</td></tr>
            <tr><td><code>deleteRule(id)</code></td><td>Promise&lt;void&gt;</td><td>删除合规规则</td></tr>
            <tr><td><code>createWebSocket(config?)</code></td><td>FidesOriginWebSocket</td><td>创建实时 WebSocket 连接</td></tr>
          </tbody>
        </table>
      </div>


      <h2 id="on-chain-sdk">On-Chain SDK</h2>
      <p>如需直接与智能合约交互，请使用 On-Chain SDK。所有 view 函数均免 gas。</p>

      <h3>安装</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>npm</span>
          <button className="docs-code-copy" aria-label="复制代码">复制</button>
        </div>
        <pre><code>npm install @fintechguy71/on-chain-sdk</code></pre>
      </div>

      <h3>初始化 On-Chain SDK</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="复制代码">复制</button>
        </div>
        <pre><code>import &#123; FidesOriginSDK &#125; from '@fintechguy71/on-chain-sdk';

import &#123; JsonRpcProvider &#125; from 'ethers';

const provider = new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');

const addresses = &#123;
  complianceEngine: '0xdF36A8b16F064308eeDE21A740FAc4e87b724F0E',
  riskRegistry: '0x953f985f38f94d6159c0600d1f15D543895cE896',
  policyEngine: '0xCA12BB2daD2a6D429277823366D8C88a490EDDeA',
  riskOracle: '0x...' // 可选
&#125;;

const sdk = new FidesOriginSDK(addresses, provider);</code></pre>
      </div>

      <h3 id="guard">Guard 集成（V2.1）</h3>
      <p>使用 On-Chain SDK 与 <strong>PreTransactionGuard</strong> 和 <strong>GuardedComplianceEngine</strong> 交互，实现零 gas 的交易前风险评估。</p>

      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript — Guard 评估</span>
          <button className="docs-code-copy" aria-label="复制代码">复制</button>
        </div>
        <pre><code>import &#123; FidesOriginSDK, Decision &#125; from '@fintechguy71/on-chain-sdk';

// 通过合规引擎验证转账
const validation = await sdk.validateTransfer(
  '0xSender...',
  '0xRecipient...',
  1000000000000000000n, // 1 ETH in wei
  '0xTokenAddress...'
);

if (validation.decision === Decision.BLOCK) &#123;
  console.warn('转账已被阻止:', validation.reason);
&#125; else if (validation.decision === Decision.FLAG) &#123;
  console.warn('转账已标记待审核:', validation.reason);
&#125;

// 快速检查
const canSend = await sdk.wouldTransferSucceed(
  '0xSender...', '0xRecipient...', 1000000000000000000n, '0xTokenAddress...'
);
console.log('是否可成功:', canSend);</code></pre>
      </div>

      <h3>风险档案查询（免 Gas）</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="复制代码">复制</button>
        </div>
        <pre><code>const profile = await sdk.getRiskProfile('0x...');
console.log(profile.riskScore, profile.tier, profile.isSanctioned);

const sanctioned = await sdk.isSanctioned('0x...');
const tier = await sdk.getRiskTier('0x...');
const tags = await sdk.getTags('0x...');</code></pre>
      </div>

      <h3>事件监听</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="复制代码">复制</button>
        </div>
        <pre><code>// 监听转账验证事件
const unsubscribe = sdk.onTransferValidated((asset, from, to, amount, decision, reason) =&gt; &#123;
  console.log(`Transfer $&#123;decision === Decision.ALLOW ? 'allowed' : 'blocked'&#125;: $&#123;reason&#125;`);
&#125;);

// 监听制裁新增事件
const unsubSanction = sdk.onSanctionAdded((account, reason) =&gt; &#123;
  console.log('新增制裁:', account, reason);
&#125;);

// 清理
sdk.removeAllListeners();</code></pre>
      </div>

      <h2>Solidity 集成</h2>
      <p>将 FidesOrigin 合约直接导入您的 Solidity 项目：</p>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Solidity 0.8.20</span>
          <button className="docs-code-copy" aria-label="复制代码">复制</button>
        </div>
        <pre><code>// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@fidesorigin/contracts/CompliantStableCoin.sol";

contract MyStableCoin is CompliantStableCoin &#123;
    constructor()
        CompliantStableCoin("MyStableCoin", "MSC")
    &#123;
        policy = IssuerPolicy(&#123;
            maxTxAmount: 1_000_000 * 10**6,
            dailyLimit: 10_000_000 * 10**6,
            allowMediumRisk: true,
            allowHighRisk: false,
            blockMixer: true,
            requireDestinationKYC: true,
            cooldownPeriod: 24 hours
        &#125;);
    &#125;
&#125;</code></pre>
      </div>

      <h2>类型</h2>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="复制代码">复制</button>
        </div>
        <pre><code>interface RiskCheckResult &#123;
  address: string;
  chain: string;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_factors: RiskFactor[];
  scores?: RiskScore[];
  addressType?: 'wallet' | 'contract' | 'exchange' | 'mixer' | 'unknown';
  timestamp?: string;
  relatedEntities?: Entity[];
  transactionStats?: TransactionStats;
&#125;

interface RiskFactor &#123;
  name: string;
  category: string;
  severity: string;
  description?: string;
&#125;

interface RiskScore &#123;
  score: number;
  level: string;
  confidence: number;
&#125;

interface Rule &#123;
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'draft';
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  createdAt: string;
  updatedAt: string;
&#125;

interface RuleCondition &#123;
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in';
  value: unknown;
&#125;

interface RuleAction &#123;
  type: 'flag' | 'block' | 'review' | 'allow';
  params?: Record&lt;string, unknown&gt;;
&#125;

// On-Chain SDK types
enum Decision &#123; ALLOW = 0, FLAG = 1, BLOCK = 2 &#125;
enum RiskTier &#123; UNKNOWN = 0, LOW = 1, MEDIUM = 2, HIGH = 3, CRITICAL = 4 &#125;

interface TransferValidationResult &#123;
  wouldSucceed: boolean;
  decision: Decision;
  reason: string;
&#125;</code></pre>
      </div>

      <h2>React Hook</h2>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>React</span>
          <button className="docs-code-copy" aria-label="复制代码">复制</button>
        </div>
        <pre><code>import &#123; useRiskCheck &#125; from '@fintechguy71/fidesorigin-sdk/react';

function RiskBadge(&#123; address &#125;: &#123; address: string &#125;) &#123;
  const &#123; data, loading, error, refetch &#125; = useRiskCheck(&#123;
    options: &#123; baseUrl: 'https://api.fidesorigin.com', apiKey: 'pk_...' &#125;,
    pollInterval: 30000,
    enabled: true
  &#125;);

  if (loading) return &lt;span&gt;检查中...&lt;/span&gt;;
  if (error) return &lt;span&gt;错误: &#123;error.message&#125;&lt;/span&gt;;
  if (!data) return null;

  return (
    &lt;span className=&#123;`risk-$&#123;data.risk.level&#125;`&#125;&gt;
      &#123;data.risk.level.toUpperCase()&#125; (&#123;data.risk.score&#125;)
    &lt;/span&gt;
  );
&#125;</code></pre>
      </div>
    </div>
  </div>
    </>
  );
}
