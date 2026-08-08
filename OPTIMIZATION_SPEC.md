# FidesOrigin 官网专项提升 - 任务规格书

## 版本: 2026-08-08

## 总控: 主 Agent

---

## 原则

1. 所有 Agent 独立工作，互不修改对方负责的文件
2. 全局批量修改（Plausible、mailto）由主 Agent 统一脚本执行
3. 每个 Agent 完成工作后，输出变更清单到本文件对应章节
4. 最终由 Agent 5（集成验证）统一检查所有变更

---

## 任务分组与文件隔离

### 主 Agent（已完成/将执行）

**负责: 全局批量脚本操作**

- [ ] P0-1: Plausible Analytics 全局注入（128 个 HTML 文件）
- [ ] P0-2: mailto: 批量替换为 /contact-form.html 重定向
- [ ] P3-14: CSP 策略审查（cdn.jsdelivr.net 依赖）

**输出目录**: 直接修改 `public/` 原始文件
**冲突声明**: 不修改 Agent 1-4 负责的文件内容（仅做链接替换）

---

### Agent 1: 内容可信度提升

**负责人**: 子 Agent A
**输入**: `public/about.html`, `public/index.html`（testimonial 区域）
**输出**:

- `public/about.html`（扩展版）
- `public/index.html`（testimonial 区域重写）

**具体任务**:

- P0-5: 替换 3 个虚构 testimonial 为真实风格的架构评估引用或移除
- P1-6: 扩展 About 页面，增加团队背景、顾问委员会占位区
- P1-7: 添加白皮书下载 CTA（链接到 /whitepaper.pdf）

**不可修改**: 其他页面的 testimonial（如果有）由主 Agent 统一处理

---

### Agent 2: 交互功能开发

**负责人**: 子 Agent B
**输入**: 新建文件
**输出**:

- `public/contact-form.html`（联系表单页面）
- `public/contact-success.html`（表单提交成功页）
- `public/thank-you.html`（通用感谢页）

**具体任务**:

- P0-2: 创建联系表单页面，字段：姓名、邮箱、公司、用例（下拉）、消息
- P0-4: Guard INACTIVE 状态处理 - 在 address-check.html 添加说明 banner
- P2-11: 移动端底部导航（作为独立 CSS/JS 组件，不侵入现有结构）

**不可修改**: 不修改现有 128 个 HTML 文件（除了 address-check.html 的 Guard 状态说明由主 Agent 注入标记，Agent 2 只替换标记区域）

---

### Agent 3: 文档与资产创建

**负责人**: 子 Agent C
**输入**: `WHITEPAPER-v0.5.0.md`, `ARCHITECTURE.md`
**输出**:

- `public/whitepaper.pdf`（PDF 白皮书）
- `public/assets/team-placeholder.html`（团队页面占位模板）
- `public/newsletter-signup.html`（邮件订阅页）

**具体任务**:

- P1-7: 从现有 Markdown 生成专业 PDF 白皮书
- P2-10: 创建 Newsletter 订阅页面（博客 CTA 入口）
- 为 about.html 创建团队区块的 HTML 模板

**不可修改**: 不修改任何现有 HTML 文件

---

### Agent 4: 性能优化

**负责人**: 子 Agent D
**输入**: `public/styles.css`, `public/index.html`
**输出**:

- `public/styles.css`（优化版）
- `public/index.html`（优化版）
- `public/sw.js`（Service Worker）
- `public/manifest.json`（PWA 清单）

**具体任务**:

- P2-8: CSS 优化（提取关键 CSS、加 lazy loading、preload）
- P2-8: Service Worker 缓存策略
- P3-13: 图片懒加载 `loading="lazy"` 批量添加

**不可修改**: 不修改除 index.html 和 styles.css 外的其他文件

---

### Agent 5: 集成验证与部署

**负责人**: 子 Agent E（等 1-4 完成后启动）
**输入**: 所有 Agent 的输出
**输出**:

- `INTEGRATION_REPORT.md`
- 最终部署到 Cloudflare

**具体任务**:

- 验证所有链接一致性（/contact-form.html 是否存在、所有 mailto 是否已替换）
- 验证 Plausible 覆盖 100% HTML 文件
- 验证多语言版本一致性（EN/CN/TW/JP 的导航同步）
- 验证 Cloudflare Worker 安全头未被覆盖
- 执行 Post-Deploy Checklist

---

## 冲突预防规则

1. **文件名唯一**: 各 Agent 创建的新文件使用命名前缀避免冲突
   - Agent 1: 不创建新文件，只修改现有文件
   - Agent 2: 新文件以 `contact-` 前缀
   - Agent 3: 新文件以 `newsletter-` 前缀或放入 assets/
   - Agent 4: 新文件 `sw.js`, `manifest.json`

2. **CSS 变量隔离**: Agent 4 优化 CSS 时，保留所有现有 CSS 变量名

3. **链接替换标记**: 主 Agent 将 mailto: 替换为 `#CONTACT_FORM_PLACEHOLDER#`，Agent 2 完成后主 Agent 再替换为真实链接

4. **Git 分支策略**: 所有工作在 `feat/website-optimization-2026-08-08` 分支

---

## 交付标准

每个 Agent 完成时，必须在 `memory/agent-{id}-report.md` 输出：

1. 修改的文件清单
2. 变更摘要（每处变更 1 句话）
3. 自我验证结果（链接是否可用、样式是否正常）
4. 与主 Agent 的交接说明

---

## 当前状态追踪

| Agent    | 状态        | 开始时间 | 完成时间 | 报告文件 |
| -------- | ----------- | -------- | -------- | -------- |
| 主 Agent | 🟡 执行中   | 14:20    | -        | -        |
| Agent 1  | ⏳ 等待启动 | -        | -        | -        |
| Agent 2  | ⏳ 等待启动 | -        | -        | -        |
| Agent 3  | ⏳ 等待启动 | -        | -        | -        |
| Agent 4  | ⏳ 等待启动 | -        | -        | -        |
| Agent 5  | ⏳ 等待前置 | -        | -        | -        |
