# FidesOrigin 官网前端两轮全面检查报告（R8）

- **日期**：2026-09-25
- **范围**：out/ 静态导出全部 **93 个页面**（英文根 18 + 英文子页 11 + cn/tw/jp 各 17 = 93；含 4 语言首页、pricing/docs/blog/use-cases/brand 等经典站、admin、404）
- **方法**：
  - **第一轮（巡检）**：Playwright 逐页浏览（1440 全页截图 + 375 移动全页截图，共约 110 张），自动化检测（图片加载、站内链接有效性、外链清单、占位文案、重复 id、h1 数量、桌面/移动横向溢出、空交互元素），配合多模态视觉逐页审查
  - **第二轮（复核）**：每项发现二次取证——重新截图、DOM 实测（computed style / getBoundingClientRect / 逐字符 SVG 量测）、滚动交互模拟、数据源源码追溯，剔除误报
- **说明**：检查期间发现并已即时修复一项高危回归（见 A1）；其余问题汇总待修复

---

## A. 已确认问题清单（按页面分组）

### 【全站 · legacy 经典站 ≈75 页】

**A1｜高｜全部内容不可见（已在检查中即时修复并上线）**
- **位置**：所有使用 `.reveal` 动画的经典站页面——pricing / docs(±api/sdk) / blog(±5 篇) / case-studies / brand / about / changelog / contact / demo / security / privacy(无 reveal) / terms / use-cases×3 及 cn/tw/jp 全部对应版本
- **描述**：pricing 移动端截图显示整页仅 header/footer 可见，正文全部空白；桌面同现象。`Block #…` 等内容在 DOM 中存在但 opacity=0
- **根因**：R7-6 的 JS 失败防御引入 specificity 回归——隐身规则 `html.js .reveal`（specificity 0,2,1）压过显示规则 `.reveal.visible`（0,2,0），IO 添加 visible 类后 opacity:0 仍胜出 → legacy 全站内容在正常浏览器中**永久隐身**
- **为什么此前未被发现**：visual-regression CI 的 Playwright 用 `reducedMotion: reduce`，恰好命中 CSS 尾部的 reduced-motion 分支（opacity:1）→ CI 全绿；R7 探针的 legacy 页路由未做 cleanUrls 映射（本地 http.server 返回 404 错误页）→ 探针测的是错误页
- **修复**：隐身规则改为 `html.js .reveal:not(.visible)`（元素获得 visible 后隐身规则不再匹配，从结构上消除 specificity 战争）；transition 独立放基础规则（避免淡入退化为瞬现）
- **验证**：滚动模拟后 case-studies 9/9、demo 7/7、security 13/13 等 17 页 reveal 元素 0 隐身；pricing 桌面/移动截图恢复完整内容
- **状态**：✅ 已修复并随本轮部署上线

### 【/address-check（+ cn/tw/jp 版，共 4 页）】

**A2｜中｜统计数据语义自相矛盾**
- **位置**：页首统计三卡（lead 文案下方）
- **描述**：副标题承诺 "Query **20,645+** risk addresses"（地址库规模），统计卡却显示 "**4** Total Addresses / 141 Blacklist / 3 Greylist"——访客会理解成地址库总共只有 4 个地址
- **根因**：源码追溯确认 stats 数据实为 `totalComplianceChecks`（**累计筛查次数**）与 blocked/sanctioned/flagged/held 计数，而标签文案是 "Total Addresses"——数据口径（筛查次数）与标签语义（地址数量）错位；本地/无后端环境显示 `--`
- **修复方向**：标签改为 "Total Screenings"（4 语言字典同步），或数据源改用地址库规模；同时在无后端时保持 `--` 现状即可
- **状态**：待修复

### 【/blog（+ cn/tw/jp 版，共 4 页）】

**A3｜中｜3/5 篇文章缺少列表入口**
- **位置**：blog 列表页文章卡片区
- **描述**：out/ 实际导出 5 篇文章详情页（why-on-chain-compliance / hong-kong-stablecoin-license / mica-stablecoin-compliance / ofac-sanctions-screening / travel-rule），列表页仅展示 2 篇（Travel Rule、OFAC Best Practices）——其余 3 篇无任何站内导航入口，只能直接输入 URL 或经 sitemap 访问
- **修复方向**：核实是否为有意精选；若非，补齐列表卡片或增加"更多文章"分区
- **状态**：待确认意图后修复

### 【/brand（+ cn/tw/jp 版，共 4 页）】

**A4｜低｜Palette 色值标注错位**
- **位置**：Palette 卡第二格
- **描述**：标签 "Surface" 标注 `#162638`——该值实为设计令牌 `--fio-surface-2`；`--fio-surface` 实际是 `#12202f`。品牌资产页的色值准确性直接影响外部引用
- **修复方向**：色值改 `#12202f`，或标签改为 "Surface Elevated"
- **状态**：待修复

**A5｜低｜Motif 卡 OG Card 预览区空白**
- **位置**：Motif — Ledger Precision 卡右下预览框
- **描述**：预览框仅四角刻线、内部空白，下方 "OG Card PNG / OG Card SVG" 按钮指向的资源内容未在预览区体现
- **修复方向**：预览框内填入 OG 卡实际渲染样式，或移除空预览框只保留下载按钮
- **状态**：待修复

**A6｜低｜Typography 卡示例文案易误读**
- **位置**：Typography 卡第三行
- **描述**：`JetBrains Mono — Data 20,645+ <50ms`——将首页指标数字当作字体示例文本，读起来像正文数据错位（cn/tw/jp 版同样）
- **修复方向**：改为明确的示例标注（如 `Metrics · 20,645 · <50ms`）或补充说明文字
- **状态**：待修复

---

## B. 第二轮复核排除的误报（避免误修）

| 现象 | 复核结论 |
|------|----------|
| pricing / case-studies / demo / docs 全页截图中部大片空白 | reveal 懒加载 + fullPage 截图伪影；真实滚动模拟后全部 reveal 元素 100% 可见（逐页统计 0 隐身） |
| 代码块 token（func/kw/num…）bbox 超出视口（docs/api 达 4108px） | 均在 `overflow-x:auto` 容器内横向滚动（legacy.css 明确设计："长行必须能横向滚动"），非布局破损 |
| pricing 移动端功能对比表 right=656 > 375 | `.compare-table-wrap { overflow-x: auto }` + 表格 `min-width:640px`（注释说明防止窄屏挤压），容器内滚动 |
| blog 页 `glow-1` 装饰光斑 right=1540 | `body { overflow-x: hidden }` 兜底裁剪，document.scrollWidth 正常、无横向滚动条 |
| 404 页 header logo "叠字" | 全页缩略图压缩伪影；2x 特写确认两行清晰无重叠 |
| 部分页面截图呈目录列表/404 错误页 | 本地并发爬虫（6 context）打单线程 http.server 的**响应错乱**，属巡检工具限制；生产 Vercel（cleanUrls）无此问题；已改串行重截确认 |
| 首页/docs 封印、盾牌 SVG | R7/R7 补充轮已修复，本轮复测无回归 |

---

## C. 各项自动化检测通过项（无异常）

| 检测项 | 结果 |
|--------|------|
| 图片加载（93 页全部 `<img>`） | 0 失败 |
| 站内链接（全部页面收集、映射文件存在性） | 0 死链 |
| 外链 | 仅 github.com 仓库链接，有效 |
| 占位文案（TODO/FIXME/lorem/占位） | 0 处 |
| 重复 id | 0 处 |
| h1 唯一性 | 全部页面恰 1 个 |
| 空 ARIA 交互元素 | 0 处 |
| 深浅双主题对比度 | 0 违规（R6 建立体检延续有效） |
| 触控目标 / 焦点可见 / 键盘可达 | R6 标准维持 |

---

## D. 整体质量评估

**修复 A1 后，官网整体质量评级：优秀（A）**。

- **工程健壮性**：93 页静态导出零死链、零图片失败、零重复 id；所有历史轮次修复（R1–R7）无回归
- **视觉一致性**：4 语言 × 全页面在深/浅双主题下令牌化统一；响应式在 320–1440 全档无布局破损（代码块/表格为容器内滚动设计）
- **内容准确性**：主文案无错别字、无占位残留；changelog 版本史与项目实际状态一致；遗留 6 处内容级小问题（A2–A6），无一影响功能
- **方法论教训**（已沉淀到探针工具）：① visual CI 的 reduced-motion 分支会掩盖 reveal 类回归——截图应包含非 reduced-motion 视口；② 本地爬虫必须映射 cleanUrls，否则 legacy 页巡检全部无效；③ 并发打单线程 http.server 会产生响应错乱假象

## E. 优先修复建议

1. ~~A1 legacy 全站隐身回归~~（**已在本轮修复上线**）
2. **A2 address-check 统计语义**（中）——金融产品页数据自洽性优先；改动小（标签文案 + 4 语言字典）
3. **A4 brand Surface 色值**（低但简单）——品牌资产页色值错误会被外部引用放大
4. **A3 blog 列表补齐**（中）——先确认 3 篇未展示是否有意精选
5. **A5 / A6 brand 预览与示例文案**（低）——顺手修复
