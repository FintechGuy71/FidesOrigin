# FidesOrigin 官网重构 — 内容规范

## 一、品牌叙事框架（对齐Pitch Deck）

### 核心定位

**"链上执行级可编程合规协议"**
不是"风险数据查询服务"，不是"事后分析工具"，而是**事中实时执行**的基础设施。

### 三层架构叙事

```
Layer 1: AI特征模型工程（链下）
  ├─ 图神经网络(GNN)地址关系分析
  ├─ 机器学习实时风险评分
  └─ CDD客户尽职调查标签体系

Layer 2: 链上检测与拦截（链上）
  ├─ 预言机(Oracle)准实时标签推送
  ├─ 可插拔合规模块（智能合约）
  ├─ Guard预检引擎
  └─ 准实时热更新

Layer 3: 实时情报与事件调查
  ├─ 7×24地址监控
  ├─ 黑名单自动冻结
  └─ 突发事件响应
```

### 关键差异化（vs Chainalysis / Elliptic）

| 维度     | Chainalysis/Elliptic | FidesOrigin           |
| -------- | -------------------- | --------------------- |
| 时机     | 事后调查、数据查询   | 事中实时拦截          |
| 层级     | 信息层               | 执行层                |
| 商业模式 | SaaS订阅 ($$$/年)    | 基础设施税 (按笔收费) |
| 技术栈   | 链下数据库           | 链上智能合约 + AI模型 |
| 部署方式 | API查询              | 可插拔模块嵌入        |

## 二、页面内容规划

### 1. 首页 (index.html)

- Hero: "链上执行级可编程合规" — 动态三层架构可视化
- 三层架构展示: AI模型 → Oracle → 合约执行
- 差异化数据: <50ms延迟、100%链上执行、Guard预检
- 客户logo墙: 稳定币发行方、RWA机构、支付平台
- CTA: Request Demo / View Docs

### 2. 架构页 (architecture.html)

- 完整技术架构图（SVG/Canvas）
- 各组件详细说明
- 数据流: 用户交易 → Mempool Watcher → Guard预检 → Risk Registry → 决策 → 执行/拦截
- 安全架构: UUPS升级、多签、紧急暂停
- 部署架构: 多链支持（Ethereum、Base、Polygon）

### 3. 技术博客

#### Blog 1: Guard集成 — 事前风控的新标准

- 什么是Pre-Transaction Guard
- 为什么比事后分析有效100倍
- FidesCompliance V2.1 Guard架构
- 代码示例

#### Blog 2: 图神经网络在链上地址画像中的应用

- GNN如何分析地址关系网络
- 从交易图谱到风险评分
- 实时特征工程流水线

#### Blog 3: 可插拔合规模块 vs 专用L2

- 为什么不自建链
- 模块热拔插的技术实现
- 客户案例: 稳定币发行方快速接入

#### Blog 4: 实时Mempool监控与风险拦截

- Mempool Watcher架构
- 零确认交易拦截
- 与Flashbots的竞争关系

#### Blog 5: 从Chainalysis到FidesOrigin — 风控范式的演进

- 传统链下风控的局限
- 链上执行级风控的优势
- 市场格局变化

#### Blog 6: 稳定币合规发行 — 香港牌照实践

- HKMA稳定币法案要求
- FidesOrigin如何满足监管要求
- 技术实现: 发行、赎回、转账全流程合规

### 4. 竞品对比页 (vs-chainalysis-elliptic.html)

- 三栏对比: FidesOrigin vs Chainalysis vs Elliptic
- 功能矩阵: 实时拦截、链上执行、AI模型、收费模式
- 客户案例对比
- 切换成本分析

### 5. 商业模式页 (pricing.html)

- 收费模型: 10-50美分/笔 + 0.01%-0.05%
- 三档套餐: Starter / Professional / Enterprise
- ROI计算器
- 客户证言

## 三、设计规范

### 色彩系统

```css
--fio-ink: #05060a; /* 主背景 */
--fio-ink-soft: #080a10; /* 次级背景 */
--fio-surface: #0c0e18; /* 卡片背景 */
--fio-surface-2: #111320; /* 悬浮背景 */
--fio-border: #252a3a; /* 边框 */
--fio-text: #f0f1f5; /* 主文字 */
--fio-text-2: #9a9fad; /* 次级文字 */
--fio-accent: #9b8ed8; /* 紫色强调 */
--fio-gold: #d4b87a; /* 金色强调 */
--fio-success: #5ce68a; /* 成功绿 */
--fio-danger: #fb8e8e; /* 危险红 */
```

### 字体

- 标题: 'Space Grotesk', sans-serif
- 正文: 'Plus Jakarta Sans', sans-serif
- 代码: 'Geist Mono', monospace

### 排版

- Hero标题: clamp(2.6rem, 5.5vw, 4.5rem)
- 段落: 1.05rem, line-height 1.7
- 卡片: 18px border-radius
- 间距: 100px section padding

### 动效

- fadeUp: 0.8s cubic-bezier(0.16,1,0.3,1)
- hover: translateY(-4px) + shadow
- 滚动触发: IntersectionObserver

## 四、技术实现规范

### 文件结构

```
.vercel/output/static/
├── index.html                    # 首页（重构）
├── architecture.html             # 架构页（新建）
├── vs-chainalysis-elliptic.html  # 竞品对比（新建）
├── pricing.html                  # 商业模式（重构）
├── blog/
│   ├── index.html               # 博客列表（重构）
│   ├── guard-pre-transaction.html
│   ├── gnn-address-profiling.html
│   ├── pluggable-vs-l2.html
│   ├── mempool-monitoring.html
│   ├── evolution-from-chainalysis.html
│   └── stablecoin-hong-kong.html
├── cn/                          # 中文版本
├── tw/                          # 繁中版本
├── jp/                          # 日语版本
└── styles.css                   # 全局样式（更新）
```

### 开发规范

- 纯静态HTML + CSS + 少量JS
- 无外部依赖（除Google Fonts）
- 响应式: mobile-first
- SEO: meta tags, structured data, Open Graph
- 性能: lazy loading, 图片优化

## 五、多语言对照表

### 关键术语

| EN                    | CN               | TW               | JP                             |
| --------------------- | ---------------- | ---------------- | ------------------------------ |
| On-Chain Compliance   | 链上合规         | 鏈上合規         | オンチェーン・コンプライアンス |
| Execution-Grade       | 执行级           | 執行級           | 実行グレード                   |
| Pre-Transaction Guard | 事前风控守卫     | 事前風控守衛     | トランザクション前ガード       |
| Risk Radar            | 风险雷达         | 風險雷達         | リスクレーダー                 |
| Pluggable Module      | 可插拔模块       | 可插拔模組       | プラガブルモジュール           |
| Mempool Watcher       | 内存池监控器     | 記憶體池監控器   | メンプール・ウォッチャー       |
| Real-time Screening   | 实时筛查         | 即時篩查         | リアルタイム・スクリーニング   |
| Immutable Audit Trail | 不可篡改审计追踪 | 不可篡改審計追蹤 | 改ざん不可能な監査証跡         |
| Stablecoin Issuer     | 稳定币发行方     | 穩定幣發行方     | ステーブルコイン発行体         |
| RWA Tokenization      | RWA代币化        | RWA代幣化        | RWAトークナイゼーション        |

## 六、质量检查清单

### 内容质量

- [ ] 每个技术术语都有解释
- [ ] 每个数据点都有来源或推导
- [ ] 架构图准确反映代码实现
- [ ] 竞品对比客观公正

### 设计质量

- [ ] 所有页面风格统一
- [ ] 移动端无布局问题
- [ ] 动效不卡顿
- [ ] 图片已优化

### 技术质量

- [ ] 所有链接可点击
- [ ] 多语言切换正常
- [ ] SEO meta完整
- [ ] Lighthouse评分 > 90

### 多语言

- [ ] EN完整
- [ ] CN无机器翻译痕迹
- [ ] TW用语地道
- [ ] JP敬语正确
