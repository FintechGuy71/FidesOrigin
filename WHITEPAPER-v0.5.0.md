# FidesOrigin 项目白皮书 v0.5.0
**链上执行级可编程合规协议**

---

## 一、一句话定位

**FidesOrigin 是首个专注于链上执行合规决策的协议级解决方案。**

不是监控后告警，不是链下分析后人工处理，而是**在交易执行环节自动判定、自动执行**——拦截、冻结、路由到合规流程。

---

## 二、问题：现有方案为什么不行

### 现状
Web3 合规市场有 41 个平台，全部是**"监控 + 告警 + 人工处理"**模式：
- **Chainalysis / TRM Labs** → 交易监控、地址筛查、出报告
- **Forta / Hypernative** → 实时告警、异常检测
- **Notabene / Sygna** → Travel Rule 信息传递

### 核心痛点
```
用户发起转账 → 链下监控发现风险 → 发送告警邮件 → 运营人员看到后
→ 手动暂停合约/冻结账户 → 30 分钟后资金已转移
```

**问题：监控和执行的割裂。**

- 链下发现风险，链上无法自动拦截
- DeFi 协议 24/7 运行，人工响应跟不上
- 稳定币发行方面临监管问责，但没有链上执行工具
- RWA 代币化需要"转账即合规"，现有方案做不到

### 市场空白
**链上执行级合规 = 尚无广泛采用的成熟产品。**

---

## 三、解决方案：FidesOrigin

### 核心架构

```
用户发起转账
        ↓
┌──────────────────────────────────────────────────────┐
│  CompliantStableCoin / CompliantSmartWallet          │
│  自动调用 preTransferHook()                            │
└──────────────────────────────────────────────────────┘
        ↓
┌──────────────────────────────────────────────────────┐
│  ComplianceEngine（核心引擎）                          │
│  1. 查询 RiskRegistry → 获取地址风险档案                │
│  2. 查询 PolicyEngine → 获取发行方策略                  │
│  3. 综合判定 → ALLOW / BLOCK / FLAG / HOLD            │
└──────────────────────────────────────────────────────┘
        ↓
┌──────────────────────────────────────────────────────┐
│  链上自动执行                                          │
│  • ALLOW → 交易正常执行                               │
│  • BLOCK → revert，交易失败                            │
│  • HOLD  → 资金冻结，等待人工审核                      │
└──────────────────────────────────────────────────────┘
```

### 技术栈

| 组件 | 功能 | 状态 |
|------|------|------|
| **RiskRegistry** | 地址风险档案、制裁名单、标签系统 | ✅ Sepolia 部署 |
| **PolicyEngine** | 发行方策略配置、版本控制、回滚 | ✅ Sepolia 部署 |
| **ComplianceEngine** | 合规决策引擎、资金冻结、紧急模式 | ✅ Sepolia 部署 |
| **RiskOracle** | Chainlink Functions 链下数据上链 | ⚠️ 需配置 Router |
| **CompliantStableCoin** | 合规稳定币示范实现 | ✅ Sepolia 部署 |
| **The Graph Subgraph** | 事件索引、实时查询 | ✅ 已上线 Studio |

### 差异化能力

#### 1. 链上自动执行（差异化优势）
- 不是"监控后告警"，是"交易中自动拦截"
- 在交易执行环节自动拦截，零人工延迟

#### 2. 策略版本控制（领先）
- 所有策略变更自动保存历史版本
- 一键回滚到任意版本
- 监管审计时可证明"2026-05-09 14:30 我们将日限额从 100万 降到 50万"

#### 3. 模块化架构（灵活）
- Registry / Policy / Engine 三层分离
- 发行方只改 Policy，不用动 Engine
- 风控团队只改 Registry，不用动 Policy

#### 4. 多签升级（安全）
- TimelockController 48 小时延迟
- 紧急模式 4 小时快速响应
- 无单点故障

#### 5. 实时数据查询（透明）
- The Graph Subgraph 实时索引
- GraphQL API 任意查询
- 运营后台实时仪表盘

---

## 四、已完成里程碑

### 2026-05-09 架构改进完成

| 改进项 | 说明 |
|--------|------|
| **Rate Limiting** | RiskOracle 三层防护：调用冷却期 + 日请求上限 + 批量上限 |
| **策略版本控制** | PolicyEngine 自动版本快照 + 一键回滚 + 历史审计链 |
| **多签升级** | TimelockController 48h 标准延迟 + 4h 紧急模式 |
| **数据同步修复** | OFAC XML 正规解析 + Merkle Tree OpenZeppelin 标准实现 |
| **事件索引** | The Graph Subgraph 三数据源部署 |

### Sepolia 测试网部署

| 合约 | 地址 |
|------|------|
| RiskRegistry | `0xdA4D86D812b4AdF3e0023a6D4b1FF20139abD3b3` |
| PolicyEngine | `0xF8f89120f5628aE3De747f55e7d00D79633002c4` |
| ComplianceEngine | `0xd978f3246c56d7E3c3fF326e9fDe539f91F39ACa` |
| CompliantStableCoin | `0x5028Dc7DA99bf461ed60a226c7CEf0bf7f77BF9A` |
| CompliantSmartWallet | `0xC0F142DcC67a186C16e8c244b041A1c938891F0D` |

### The Graph Subgraph

| 配置 | 值 |
|------|-----|
| Studio | `fidesorigin-sepolia` |
| 查询端点 | `https://api.studio.thegraph.com/query/1749664/fidesorigin-sepolia/v0.0.1` |
| 同步状态 | ✅ Active，block 10819927 |

### 测试覆盖

- **224 个测试全部通过**（<30s）
- 跨合约集成测试 ✅
- 紧急暂停测试 ✅
- 策略回滚测试 ✅
- 批量更新测试 ✅

---

## 五、客户场景

### 场景 1：稳定币发行商

**客户**：香港持牌稳定币发行商

**痛点**：
- 监管要求"了解你的客户"+"交易监控"
- 现有方案是链下监控，发现可疑交易时已来不及拦截
- 需要向监管证明"我们在链上执行了合规"

**FidesOrigin 方案**：
```solidity
contract HKDStableCoin is CompliantStableCoin {
    // 自动嵌入 ComplianceEngine
    // 每一笔转账自动检查：
    // 1. 发送方/接收方是否在制裁名单
    // 2. 金额是否超过日限额
    // 3. 地址风险等级是否允许
    // 4. 不合规 → 自动 revert
}
```

**价值**：
- 监管审计时可直接展示链上执行记录
- 零人工延迟拦截可疑交易
- 策略可随时调整（如制裁新地址）

### 场景 2：RWA 代币化平台

**客户**：美国国债代币化平台

**痛点**：
- 只有 KYC 过的用户才能持有/转账
- 需要地域限制（美国用户不能买）
- 需要交易报告（谁、什么时候、买了多少）

**FidesOrigin 方案**：
```solidity
// PolicyEngine 配置：
// - 仅允许 KYC 地址
// - 禁止美国 IP 关联地址
// - 单笔不超过 $100K
// - 日累计不超过 $1M
```

**价值**：
- 转账即合规，不需要额外步骤
- 所有记录链上可审计
- The Graph 实时生成报告

### 场景 3：跨境支付公司

**客户**：使用 Crypto 做跨境结算的支付公司

**痛点**：
- 收款方地址可能是制裁地址
- 大额转账需要合规审查
- 不同国家不同监管要求

**FidesOrigin 方案**：
- 自动筛查收款方地址
- 高风险地址自动 HOLD，等待人工确认
- 多策略支持（不同国家不同规则）

---

## 六、市场机会

### 市场规模

| 指标 | 数据 |
|------|------|
| 全球 RegTech 2025 | $18.6B - $25.6B（据 Polaris Market Research / Grand View Research）|
| CAGR | 17% - 21% |
| 2033 预测 | $77B - $130B |
| Web3 合规子赛道 | ~$2-3B（嵌入式估计） |

### 竞争格局

| 类型 | 代表 | 模式 | 弱点 |
|------|------|------|------|
| 链下监控 SaaS | Chainalysis, TRM Labs | 监控+告警 | 无法链上执行 |
| DeFi 安全监控 | Forta, Hypernative | 实时告警 | 不处理合规执行 |
| Travel Rule | Notabene, Sygna | 信息传递 | 仅传递，不执行 |
| **FidesOrigin** | — | **链上自动执行** | **差异化定位** |

### 为什么现在

- **Binance $4.3B 和解** (2023) → 交易所合规预算暴增
- **RWA 代币化趋势** → $2-3B 美国国债已代币化（据 RWA.xyz / BCG 2025）
- **MiCA 生效 / 香港框架落地** → 稳定币需要链上合规
- **SEC 持续执法** → DeFi 协议被迫考虑合规

---

## 七、技术细节

### 合约架构

```solidity
// 三层分离
RiskRegistry     → 风险数据中心（只读为主）
PolicyEngine     → 策略配置中心（版本控制）
ComplianceEngine → 执行引擎（决策+冻结+暂停）

// 连接层
RiskOracle       → 链下数据上链（Chainlink Functions）
The Graph        → 事件索引+查询（Subgraph）
Timelock         → 多签升级（48h延迟+紧急模式）
```

### 安全特性

| 特性 | 实现 |
|------|------|
| 访问控制 | OpenZeppelin AccessControl |
| 紧急暂停 | ComplianceEngine emergencyMode |
| 升级安全 | TimelockController 48h 延迟 |
| 策略回滚 | PolicyEngine 版本快照 + 一键回滚 |
| 速率限制 | RiskOracle 调用冷却 + 日限 + 批量上限 |
| 数据验证 | OFAC XML 正规解析 + Merkle Tree 标准实现 |

### 事件索引（The Graph）

```graphql
query {
  protocolStats(id: "stats") {
    totalComplianceChecks
    totalBlocked
    totalHeld
    totalSanctioned
  }
  riskProfiles(first: 10, where: { isSanctioned: true }) {
    id
    riskScore
    tier
  }
  complianceChecks(first: 10, orderBy: timestamp, orderDirection: desc) {
    from
    to
    amount
    decision
    reason
  }
}
```

---

## 八、路线图

### Phase 1: 验证期（现在 - 2026 Q3）
- ✅ 核心合约开发
- ✅ Sepolia 测试网部署
- ✅ The Graph Subgraph 上线
- 🔄 安全审计（OpenZeppelin / Certik）
- 🔄 客户访谈验证（3-5 个稳定币/RWA 项目）
- ⏳ 运营后台前端（Next.js + The Graph API）
- ⏳ 主网部署评估（Base / Arbitrum）

### Phase 2: 产品化（2026 Q3 - Q4）
- 主网部署
- 多链支持（Ethereum / Base / Arbitrum / Tempo）
- 白标 SDK（开发者一键集成）
- 收费模式上线
- 种子轮融资

### Phase 3: 规模化（2027）
- 企业级客户（5-10 个稳定币/RWA 平台）
- AI 风险评分（链下模型 + 链上执行）
- 跨链风险同步
- 监管报告自动化
- A 轮融资

---

## 九、团队

**创始人**：杨鸿威（卫斯理）

| 经历 | 相关性 |
|------|--------|
| 微信支付 4级→9级 | 国内最大支付平台风控经验 |
| 字节跳动跨境支付 3-1 | 跨境合规、外汇管制 |
| 腾讯 Tenpay Global 10级 | 国际支付架构、监管对接 |
| 富途 Web3 产品 | 稳定币牌照申请、Crypto 支付 Infra |

**核心能力**：
- 支付行业深度经验（国内+跨境+Crypto）
- 正在申请香港稳定币牌照（直接客户视角）
- 产品+技术双全（能写代码、能设计架构）
- 监管理解（国内支付监管 + 香港 Web3 框架）

---

## 十、融资计划

### 目标
- **天使轮 / 种子轮**：$500K - $1.5M
- **用途**：安全审计 + 客户验证 + 团队扩张
- **时间**：2026 Q3

### 里程碑
1. 安全审计通过
2. 3 个付费意向客户
3. 主网部署完成
4. 运营后台上线

---

## 附录

### 查询端点

**The Graph Subgraph（实时数据）**:
```
https://api.studio.thegraph.com/query/1749664/fidesorigin-sepolia/v0.0.1
```

**Sepolia 合约**:
- RiskRegistry: `0xdA4D86D812b4AdF3e0023a6D4b1FF20139abD3b3`
- PolicyEngine: `0xF8f89120f5628aE3De747f55e7d00D79633002c4`
- ComplianceEngine: `0xd978f3246c56d7E3c3fF326e9fDe539f91F39ACa`

### 文档

- 协议文档：`README-PROTOCOL.md`
- 部署记录：`deployments/sepolia-latest.json`
- Subgraph：`subgraph/`
- 评估报告：`EVALUATION-REPORT-2026-05-09.md`

---

**联系我们**:
- GitHub: https://github.com/FintechGuy71/FidesOrigin
- 网站: https://fidesorigin.com
- 邮箱: contact@fidesorigin.com

**"不是监控合规，是执行合规。"**

---
*白皮书 v0.5.0 | 2026-05-09*
