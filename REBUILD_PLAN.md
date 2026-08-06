# FidesOrigin 官网三阶段重构计划

## 项目信息

- **启动时间**: 2026-08-06
- **负责人**: Kimi Claw (主控)
- **目标**: 全面重构官网，对齐Pitch Deck叙事，提升金融专业度
- **交付标准**: 品味高级、金融专业、多语言完整、可部署

## 三阶段架构

### Phase 1: 核心骨架（Day 1-2）

1. **首页(index.html)** — 重写Hero、产品矩阵、三层架构展示
2. **架构页(architecture.html)** — 完整技术架构图（含Guard、AI、Oracle）
3. **导航&全局样式** — 统一设计系统，更新导航结构

### Phase 2: 深度内容（Day 2-3）

4. **技术博客**（6篇）:
   - Guard集成：事前风控的新标准
   - 图神经网络在链上地址画像中的应用
   - 可插拔合规模块 vs 专用L2
   - 实时Mempool监控与风险拦截
   - 从Chainalysis到FidesOrigin：风控范式的演进
   - 稳定币合规发行：香港牌照实践
5. **竞品对比页(vs-chainalysis-elliptic.html)** — Fides vs Chainalysis vs Elliptic
6. **商业模式页(pricing.html重构)** — 收费模型、ROI计算

### Phase 3: 多语言+部署（Day 3-4）

7. 所有新内容翻译为CN/TW/JP
8. Demo页升级（Guard流程展示）
9. 最终部署 + Post-Deploy检查

## 设计规范

- **色彩**: 保留现有深色金融主题（#05060a底色 + #9b8ed8紫 + #d4b87a金）
- **字体**: Space Grotesk(标题) + Plus Jakarta Sans(正文) + Geist Mono(代码)
- **排版**: 参考Apple/Linear的克制美学，大量留白
- **动效**: 微交互为主，不喧宾夺主
- **专业度**: 每个数据点都有来源，每个架构图都有技术深度

## 多语言策略

- EN: 源语言，最完整
- CN: 简中，金融科技专业术语
- TW: 繁中，台湾用语习惯
- JP: 日语，敬语+片假名技术词

## 中断恢复机制

- 每个Phase完成后保存检查点（git commit）
- 每个子任务输出到独立文件
- 主控Agent持续跟踪进度
- 失败任务自动重试（最多3次）

## 当前进度

- [x] Phase 1: 启动4个并行Agent（2026-08-06 11:17）
  - Agent A: 首页重构（index.html）
  - Agent B: 架构页（architecture.html）
  - Agent C: 技术博客 × 3（Guard/GNN/可插拔模块）
  - Agent D: 竞品对比页 + 技术博客 × 3（Mempool/Chainalysis对比/稳定币合规）
- [ ] 等待Agent完成
- [ ] Phase 2: 整合检查 + 修复
- [ ] Phase 3: 多语言翻译 + 部署
