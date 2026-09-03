/* Auto-generated from public/tw/docs/sdk.html — do not edit by hand. */
export default function ContentDocsSdkTW() {
  return (
    <>
<div className="docs-layout">
    <button className="docs-sidebar-toggle" id="sidebarToggle" aria-expanded="false" aria-label="切換側邊欄">
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      文件菜單
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
    </button>
    <aside className="docs-sidebar" id="docsSidebar">
      <div className="docs-sidebar-title">文件</div>
      <ul className="docs-nav-tree">
        <li><a href="/tw/docs">概覽</a></li>
        <li><a href="/tw/docs/api">API 參考</a></li>
        <li><a href="/tw/docs/sdk" className="active">SDK</a></li>
      </ul>
      <div className="docs-sidebar-title">資源</div>
      <ul className="docs-nav-tree">
        <li><a href="/tw/blog" target="_blank" rel="noopener">博客</a></li>
        <li><a href="https://github.com/FintechGuy71/FidesOrigin" target="_blank" rel="noopener">GitHub</a></li>
        <li><a href="/admin/dashboard">控制台</a></li>
      </ul>
    </aside>


    <div className="docs-content">
      <h1>SDK <span className="docs-version">v0.2.1</span></h1>
      <p className="docs-lead">用於錢包集成和鏈上合規的 JavaScript SDK。</p>

      <h2>Packages</h2>
      {/* ⚠ 原為 style={{ gridTemplateColumns: "1fr 1fr" }}：未分層內聯樣式恆勝任何
          @layer 內宣告，把 legacy.css 的 @media (max-width:600px)
          {.docs-cards{grid-template-columns:1fr}} 直接擊穿 —— 行動裝置仍是兩欄，
          卡片被壓到約 160px 寬。.docs-cards 的基線本就是 repeat(2,1fr)，
          這裡無需重複宣告。 */}
      <div className="docs-cards">
        <a href="#rest-sdk" className="docs-card">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h3>REST SDK</h3>
          <p>API 客戶端、風險檢查、規則管理、WebSocket 串流。</p>
        </a>
        <a href="#on-chain-sdk" className="docs-card">
          <div className="docs-card-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </div>
          <h3>On-Chain SDK</h3>
          <p>直接與智能合約互動、Guard 整合、免 gas 讀取。</p>
        </a>
      </div>

      <h2 id="rest-sdk">安裝</h2>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>npm</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
        </div>
        <pre><code>npm install @fidesorigin/sdk</code></pre>
      </div>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>yarn</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
        </div>
        <pre><code>yarn add @fidesorigin/sdk</code></pre>
      </div>

      <h2>快速開始</h2>

      <h3>初始化 SDK</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
        </div>
        <pre><code>import &#123; FidesOrigin &#125; from '@fidesorigin/sdk';

const fides = new FidesOrigin(&#123;
  apiKey: 'YOUR_API_KEY',
  network: 'sepolia' // 或 'mainnet', 'base'
&#125;);</code></pre>
      </div>

      <h3>檢查地址風險</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
        </div>
        <pre><code>const result = await fides.evaluateAddress('0x...');

console.log(result.riskTier); // 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
console.log(result.isSanctioned); // true 或 false</code></pre>
      </div>

      <h3>批量風險檢查</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
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

      <h3>WebSocket 串流</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
        </div>
        <pre><code>const ws = fides.createWebSocket(&#123;
  autoReconnect: true,
  reconnectInterval: 3000
&#125;);

await ws.connect();
ws.subscribe(['risk.update', 'alert.new', 'rule.match']);

ws.on('risk.update', (msg) =&gt; &#123;
  console.log('風險已更新:', msg.data.address, msg.data.risk);
&#125;);

ws.on('alert.new', (msg) =&gt; &#123;
  console.log('新告警:', msg.data);
&#125;);</code></pre>
      </div>

      <h3>訂閱事件</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
        </div>
        <pre><code>fides.on('RiskDetected', (event) =&gt; &#123;
  console.log('檢測到風險:', event.address, event.riskTier);
&#125;);

fides.on('SanctionAdded', (event) =&gt; &#123;
  console.log('新增制裁:', event.address);
&#125;);</code></pre>
      </div>

      <h2>核心 API</h2>
      <div className="docs-table-wrap">
        <table className="docs-table">
          <thead>
            <tr><th>方法</th><th>返回</th><th>描述</th></tr>
          </thead>
          <tbody>
            <tr><td><code>connect(provider)</code></td><td>Promise&lt;void&gt;</td><td>連接 Web3 提供商</td></tr>
            <tr><td><code>evaluateAddress(addr)</code></td><td>Promise&lt;RiskProfile&gt;</td><td>獲取地址風險檔案</td></tr>
            <tr><td><code>evaluateTx(tx)</code></td><td>Promise&lt;TxResult&gt;</td><td>交易預篩查</td></tr>
            <tr><td><code>subscribe(event)</code></td><td>EventEmitter</td><td>訂閱鏈上事件</td></tr>
            <tr><td><code>disconnect()</code></td><td>void</td><td>清理連接</td></tr>
          </tbody>
        </table>
      </div>

      <h2 id="on-chain-sdk">On-Chain SDK</h2>
      <p>如需直接與智能合約互動，請使用 On-Chain SDK。所有 view 函式均免 gas。</p>

      <h3>安裝</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>npm</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
        </div>
        <pre><code>npm install @fidesorigin/on-chain-sdk</code></pre>
      </div>

      <h3>初始化 On-Chain SDK</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
        </div>
        <pre><code>import &#123; FidesOriginSDK &#125; from '@fidesorigin/on-chain-sdk';
import &#123; JsonRpcProvider &#125; from 'ethers';

const provider = new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');

const addresses = &#123;
  complianceEngine: '0xdF36A8b16F064308eeDE21A740FAc4e87b724F0E',
  riskRegistry: '0x953f985f38f94d6159c0600d1f15D543895cE896',
  policyEngine: '0xCA12BB2daD2a6D429277823366D8C88a490EDDeA',
  riskOracle: '0x...' // 可選
&#125;;

const sdk = new FidesOriginSDK(addresses, provider);</code></pre>
      </div>

      <h3 id="guard">Guard 整合（V2.1）</h3>
      <p>使用 On-Chain SDK 與 <strong>PreTransactionGuard</strong> 和 <strong>GuardedComplianceEngine</strong> 互動，實現零 gas 的交易前風險評估。</p>

      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript — Guard 評估</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
        </div>
        <pre><code>import &#123; FidesOriginSDK, Decision &#125; from '@fidesorigin/on-chain-sdk';

// 透過合規引擎驗證轉帳
const validation = await sdk.validateTransfer(
  '0xSender...',
  '0xRecipient...',
  1000000000000000000n, // 1 ETH in wei
  '0xTokenAddress...'
);

if (validation.decision === Decision.BLOCK) &#123;
  console.warn('轉帳已被封鎖:', validation.reason);
&#125; else if (validation.decision === Decision.FLAG) &#123;
  console.warn('轉帳已標記待審核:', validation.reason);
&#125;

// 快速檢查
const canSend = await sdk.wouldTransferSucceed(
  '0xSender...', '0xRecipient...', 1000000000000000000n, '0xTokenAddress...'
);
console.log('是否可成功:', canSend);</code></pre>
      </div>

      <h3>風險檔案查詢（免 Gas）</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
        </div>
        <pre><code>const profile = await sdk.getRiskProfile('0x...');
console.log(profile.riskScore, profile.tier, profile.isSanctioned);

const sanctioned = await sdk.isSanctioned('0x...');
const tier = await sdk.getRiskTier('0x...');
const tags = await sdk.getTags('0x...');</code></pre>
      </div>

      <h3>事件監聽</h3>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
        </div>
        <pre><code>// 監聽轉帳驗證事件
const unsubscribe = sdk.onTransferValidated((asset, from, to, amount, decision, reason) =&gt; &#123;
  console.log(`Transfer $&#123;decision === Decision.ALLOW ? 'allowed' : 'blocked'&#125;: $&#123;reason&#125;`);
&#125;);

// 監聽制裁新增事件
const unsubSanction = sdk.onSanctionAdded((account, reason) =&gt; &#123;
  console.log('新增制裁:', account, reason);
&#125;);

// 清理
sdk.removeAllListeners();</code></pre>
      </div>

      <h2>Solidity 集成</h2>
      <p>將 FidesOrigin 合約直接導入您的 Solidity 項目：</p>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>Solidity 0.8.20</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
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

      <h2>類型</h2>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>TypeScript</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
        </div>
        <pre><code>interface RiskProfile &#123;
  address: string;
  riskScore: number;
  riskTier: 'UNKNOWN' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isSanctioned: boolean;
  tags: string[];
  entityName: string;
  lastUpdated: string;
&#125;

interface TxResult &#123;
  allowed: boolean;
  riskScore: number;
  riskTier: string;
  quarantineRequired: boolean;
  reason: string | null;
&#125;</code></pre>
      </div>

      <h2>React Hook</h2>
      <div className="docs-code-block">
        <div className="docs-code-header">
          <span>React</span>
          <button className="docs-code-copy" aria-label="複製代碼">複製</button>
        </div>
        <pre><code>import &#123; useRiskCheck &#125; from '@fintechguy71/fidesorigin-sdk/react';

function RiskBadge(&#123; address &#125;: &#123; address: string &#125;) &#123;
  const &#123; data, loading, error, refetch &#125; = useRiskCheck(&#123;
    options: &#123; baseUrl: 'https://api.fidesorigin.com', apiKey: 'pk_...' &#125;,
    pollInterval: 30000,
    enabled: true
  &#125;);

  if (loading) return &lt;span&gt;檢查中...&lt;/span&gt;;
  if (error) return &lt;span&gt;錯誤: &#123;error.message&#125;&lt;/span&gt;;
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
