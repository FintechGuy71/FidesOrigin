# FidesOrigin 官网完整重构方案

## 日期: 2026-08-06

## 目标: 全面适配 Deck 定位 + 三层实时风控技术升级

---

## 一、当前官网诊断

### 现有结构

```
EN (根目录)
├── index.html          # 首页 — 需重构
├── about.html          # 关于 — 需更新
├── address-check.html  # 地址检查 — 需升级
├── case-studies.html   # 案例 — 需更新
├── demo.html           # 演示 — 需重写
├── pricing.html        # 定价 — 需更新
├── contact.html        # 联系 — 保持
├── privacy.html        # 隐私 — 保持
├── security.html       # 安全 — 保持
├── terms.html          # 条款 — 保持
├── changelog.html      # 更新日志 — 保持
├── blog/               # 博客 — 需新增文章
│   ├── index.html
│   ├── hong-kong-stablecoin-license.html
│   ├── mica-stablecoin-compliance.html
│   ├── ofac-sanctions-screening-blockchain.html
│   └── why-on-chain-compliance.html
├── docs/               # 文档 — 需重写
│   ├── index.html      # 文档首页
│   ├── api.html        # API 参考
│   └── sdk.html        # SDK 指南
└── admin/              # 运营后台 — 需升级

CN/TW/JP (镜像结构)
```

### 问题诊断

1. **首页**: 未展示三层实时风控架构，仍停留在 V1 架构描述
2. **技术架构**: 无独立技术架构页面，Deck 中的分层架构未可视化
3. **演示**: demo.html 仅为静态展示，无交互式地址风险评估
4. **文档**: 未包含 Layer 1/2/3 详细文档、SDK 使用指南
5. **博客**: 缺少"实时风控引擎发布""PreTransactionGuard 技术解析"等关键文章
6. **多语言**: 技术术语翻译不统一

---

## 二、重构内容清单

### 2.1 首页重构 (index.html)

**新增板块**:

1. **Hero 区域**: 新标语 — "链上执行级可编程合规协议 → 实时风控引擎"
2. **三层架构可视化**: 动态架构图 (Layer 1/2/3)
3. **实时风控演示**: 嵌入式地址风险评估组件
4. **Deck 核心数据**: 目标客户痛点、网络飞轮效应
5. **Sepolia 部署状态**: 实时合约地址 + 网络状态

**移除/弱化**:

- 旧版 V1 架构描述
- 过时的功能列表

### 2.2 新增页面

| 页面          | 路径                  | 内容                          |
| ------------- | --------------------- | ----------------------------- |
| **技术架构**  | `/architecture.html`  | 三层架构详细图解 + 交互式组件 |
| **实时风控**  | `/realtime-risk.html` | Layer 1/2/3 详细说明 + 演示   |
| **Guard SDK** | `/guard-sdk.html`     | SDK 文档 + 代码示例           |
| **部署状态**  | `/deployments.html`   | 多链合约地址 + 验证链接       |

### 2.3 文档重构 (docs/)

```
docs/
├── index.html              # 文档首页 — 快速开始
├── architecture/           # 新增: 架构文档
│   ├── overview.html       # 架构概览
│   ├── layer1-guard.html   # Layer 1: PreTransactionGuard
│   ├── layer2-watcher.html # Layer 2: Mempool Watcher
│   └── layer3-execution.html # Layer 3: 执行层
├── sdk/
│   ├── index.html          # SDK 概览
│   ├── javascript.html     # JavaScript SDK
│   ├── solidity.html       # Solidity 集成
│   └── examples.html       # 代码示例
├── api.html                # API 参考 (更新)
├── deployments.html        # 部署地址
└── changelog.html          # 更新日志
```

### 2.4 博客新增文章

| 文章                                   | 目标         |
| -------------------------------------- | ------------ |
| "FidesOrigin 实时风控引擎发布"         | 产品发布公告 |
| "PreTransactionGuard: 零Gas预交易拦截" | 技术深度解析 |
| "三层架构 vs Chainlink ACE"            | 竞争对比     |
| "Sepolia 测试网部署指南"               | 开发者指南   |
| "从 Deck 到产品: FidesOrigin 进化之路" | 项目历程     |

### 2.5 演示升级 (demo.html)

**交互式演示**:

1. **地址风险评估**: 输入地址 → 显示 Guard 评估结果
2. **交易模拟**: 模拟转账 → 实时风控决策
3. **架构交互图**: 点击层级查看详情
4. **Sepolia 实时数据**: 连接测试网展示真实数据

### 2.6 运营后台升级 (admin/)

**新增功能**:

- Guard 管理面板 (启用/禁用、统计)
- 实时风险监控仪表盘
- 三层架构状态监控

---

## 三、多语言适配策略

### 语言版本

- **EN**: 源语言，技术术语标准
- **CN (zh-CN)**: 简体中文
- **TW (zh-TW)**: 繁体中文
- **JP (ja)**: 日语

### 技术术语词表 (关键)

| 英文                  | 中文简               | 中文繁               | 日文                       |
| --------------------- | -------------------- | -------------------- | -------------------------- |
| PreTransactionGuard   | 预交易守卫           | 預交易守衛           | プレトランザクションガード |
| Mempool Watcher       | 内存池监控器         | 記憶體池監控器       | メンプールウォッチャー     |
| RiskRegistry          | 风险注册表           | 風險註冊表           | リスクレジストリ           |
| PolicyEngine          | 策略引擎             | 策略引擎             | ポリシーエンジン           |
| Real-time Risk Engine | 实时风控引擎         | 即時風控引擎         | リアルタイムリスクエンジン |
| Layer 1/2/3           | 第一层/第二层/第三层 | 第一層/第二層/第三層 | レイヤー1/2/3              |
| Sanctioned Address    | 制裁地址             | 制裁地址             | 制裁対象アドレス           |

---

## 四、执行计划

### Phase 1: 核心页面 (今天)

1. 首页重构 (index.html)
2. 技术架构页 (architecture.html)
3. 实时风控页 (realtime-risk.html)
4. 文档首页更新 (docs/index.html)

### Phase 2: 文档与演示 (明天)

1. 三层架构文档 (docs/architecture/)
2. SDK 文档 (docs/sdk/)
3. 演示升级 (demo.html)
4. 部署状态页 (deployments.html)

### Phase 3: 博客与多语言 (后天)

1. 5篇新博客文章
2. 多语言同步翻译
3. 运营后台升级

### Phase 4: SEO 与优化

1. 结构化数据更新
2. OG 标签优化
3. 性能优化
4. 部署到 Vercel

---

## 五、技术实现要点

### 架构图实现

- CSS Grid + SVG 动态连线
- 滚动触发动画 (IntersectionObserver)
- 层级点击展开详情

### 交互式演示

- ethers.js 连接 Sepolia
- 调用 Guard 合约 view 函数
- 实时显示风险评估结果

### 多语言

- HTML lang 属性
- hreflang 链接
- 内容完全翻译 (非机翻)

---

## 六、验收标准

- [ ] 首页展示三层架构，视觉清晰
- [ ] 所有新页面有4语言版本
- [ ] 演示页可交互，连接 Sepolia
- [ ] 文档包含完整 Layer 1/2/3 说明
- [ ] 博客新增5篇文章
- [ ] 所有 OG/SEO 标签正确
- [ ] Vercel 部署成功，无 404
