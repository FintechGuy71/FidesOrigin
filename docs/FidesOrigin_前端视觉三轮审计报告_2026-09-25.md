# FidesOrigin 前端官网视觉三轮审计与重构报告（R6）

- **日期**：2026-09-25
- **范围**：apps/web（新版首页 4 语言 ×7 区块、导航/页脚、admin 后台、legacy 经典站抽查）、css 三层样式体系
- **方法**：源码逐组件走查 + Playwright 真实浏览器走查（1440/768/375 三档视口、深/浅双主题、全状态截图）+ 量化探针（WCAG 对比度、焦点可见性、触控目标、横向溢出）+ 既有验证套件（_verify.py 27 项 / _crosscheck.py 41 项）
- **约束遵守**：功能、文案、路由、接口零改动；全部为样式/可访问性/性能层修复

---

## 第一轮：体检与修复

### 问题清单（8 项）

| # | 严重度 | 位置 | 问题 |
|---|--------|------|------|
| V1 | **P0** | HeroHome canvas | 合规网格 canvas 恒为默认 300×150 贴左上角：canvas 是 replaced element，`absolute + inset-0` 不拉伸它（CSS2.1 §10.3.8 绝对定位替换元素 width:auto 取固有尺寸）；且 resize() 把 offsetWidth×dpr 写回 width 属性，HiDPI 下固有尺寸每轮翻倍（dpr=2→600px）→ 移动端横向溢出 600px |
| V2 | P1 | HeroScreen 输入框 | 聚焦环为浏览器默认蓝（@tailwindcss/forms base 层 `:focus` 注入 `-webkit-focus-ring-color`），与品牌金色环语言冲突 |
| V3 | P1 | header 移动菜单按钮 | 仅 focus-visible 环，普通 :focus（触屏点击后）残留默认蓝 outline |
| V4 | P2 | footer 8 个链接 | 无 focus-visible 环（键盘用户不可见焦点）；触控高度 22px |
| V5 | P2 | footer/hero 触控目标 | 页脚链接 22px、语言下拉项等低于 44px 触控标准（页脚部分） |
| V6 | 信息 | legacy 页 fullPage 截图空白带 | `.reveal` IO 滚动动画在截图时的伪影——非缺陷，确认无需修复 |
| V7 | 信息 | HeroScreen invalid 检测 | 走查脚本正则误报（字典文案为 "Enter a valid 0x address (42 chars)"），实际状态机工作正常 |
| V8 | 信息 | 对比度 | 暗色主题零违规；浅色主题（本轮新增）初版 text-3 对 ink-soft 4.39:1 → 见第二轮修正 |

### 已完成修复
1. **V1**：canvas 加显式 `h-full w-full`（切断「属性尺寸=固有尺寸=布局尺寸」自反馈环）；实测 1440×987 满铺、移动端溢出消失。
2. **V2**：设计系统新增 `.fio-input` 组件类（品牌金聚焦环 + 令牌化配色/圆角/过渡），HeroScreen 输入框改用之，删除内联 style。
3. **V3**：移动菜单按钮补 `focus:outline-none`。
4. **V4/V5**：页脚链接统一 `inline-block py-2.5 + rounded-sm + focus-visible:ring-2 ring-gold`（触控高度 ≥40px、焦点可见）。

### 第二轮关注重点
令牌体系补全（动效/间距/阴影/微色值）、深浅双主题、节奏统一、圆角漂移收敛。

---

## 第二轮：规范与重构

### 问题清单（6 项）

| # | 类别 | 问题 |
|---|------|------|
| S1 | 动效 | 时长散落 8 种写法（0.2s/0.25s/0.5s/0.7s + duration-200/300/500/1000），无统一语义 |
| S2 | 间距 | 六个首页章节混用 py-24/28 + md:py-32/36 两套垂直节奏 |
| S3 | 阴影 | 面板阴影仅一处硬编码（--fio-panel-shadow），卡片/弹层无阶梯 |
| S4 | 微色值 | 滚动条/选区/hover wash 等 6 处硬编码 rgba（暗色值），浅色主题下会错色 |
| S5 | 圆角 | admin 后台混用 rounded-xl/lg/2xl（12/8/16px），与设计令牌（3/6/10px）漂移 |
| S6 | 主题 | 仅暗色一套；打印/强光/系统浅色偏好无适配 |

### 已完成重构
1. **动效令牌**：`--dur-1..4`（150/250/500/700ms）+ 唯一 `--ease-out`；.fio-btn/.fio-animate-fade-up 收口。
2. **章节节奏令牌**：`--section-py: 7rem` / `--section-py-lg: 9rem`；六个章节（Features/Segments/Testimonials/Trust/HomeContact/Workflows）统一消费。
3. **阴影阶梯**：`--fio-shadow-card` / `--fio-shadow-pop`（含浅色主题对应值）。
4. **微色值令牌化**：`--fio-scrollbar/-hover`、`--fio-selection`、`--fio-hover-wash`、`--fio-hover-border`、`--fio-steel-glow`；组件层与 .fio-gradient-hero/scrollbar/selection/ghost-hover 全部改消费令牌。
5. **圆角收敛**：admin 后台 13 处 rounded-xl/lg/2xl → `rounded-[var(--radius-lg/md)]`。
6. **深浅双主题**：`@media (prefers-color-scheme: light)` + `html[data-theme]` 显式覆盖；浅色调色板 "Ledger Daylight"（暖纸白底 × 深青铜金，全部文本对比度 ≥5:1）；`color-scheme` 声明使原生控件随主题换肤。legacy.css 的 319 处 var() 引用经令牌层自动换肤，零改动。

### 第三轮关注重点
信息层级/数据可信感复审、交互反馈完整性、无障碍全项、首屏性能、残留死样式清理。

---

## 第三轮：复检与精修

### 问题清单（5 项）

| # | 类别 | 问题 |
|---|------|------|
| F1 | 死样式 | `.fio-delay-N` 独立块对无 animation 的元素无效（死 CSS） |
| F2 | 冗余类 | HeroHome 指标带条件类串产出重复 `md:border-l` |
| F3 | 死声明 | Trust/HomeContact 的 `.fio-eyebrow` 上 `justify-content:center`（inline-flex 的居中由父级 text-center 承担，justify-content 对 inline 级盒无效） |
| F4 | 性能 | 首屏粒子网络常驻 rAF：后台标签/滚出视口后仍绘制 |
| F5 | 对比度 | 浅色主题 `--fio-text-3` 对 `--fio-ink-soft` 4.39:1（<4.5） |

### 已完成精修
1. 删除 `.fio-delay-N` 死块（组合选择器保留）。
2. 指标带类串化简为单一表达式（消除重复 border-l）。
3. 删除两处无效 justify-content 内联声明。
4. canvas 循环加 visibilitychange + IntersectionObserver 门控：后台/离屏即停绘，回屏续画（视觉零变化，省电省 GPU）。
5. 浅色 `--fio-text-3` 加深至 `#54667a`（≈5.0:1）。

### 无障碍与性能复测结果
- **对比度**：深/浅双主题全页扫描 **零违规**（叶子文本节点逐个计算 WCAG 比率）。
- **焦点可见**：全部可见交互元素聚焦均有品牌金环（隐藏元素正确跳过）。
- **键盘可达**：skip-link 聚焦可见、菜单 Esc/方向键/Home/End 契约完备（R2 既有）。
- **语义化**：canvas role=img + aria-label、表单 label/htmlFor、role=status/aria-live 齐备。
- **横向溢出**：375px 视口零溢出（V1 修复后）。
- **首屏性能**：canvas 离屏停绘；无第三方 CSS unlayered 回归（_verify 27 项含该项）。

---

## 整体视觉一致性核对结果

| 维度 | 结果 |
|------|------|
| 色彩 | 全站经 --fio-* 单一真源；组件层零硬编码 hex/rgba（_verify 实测 PASS）；深/浅双主题均零对比度违规 |
| 字体 | 三族（sans/serif/mono）唯一真源 + 四语言 CJK 回退栈；微字号 0.6875rem 统一（≥11px 可读下限） |
| 字号阶梯/行高 | @theme 11 级阶梯带 line-height/letter-spacing（既有），本轮未破坏 |
| 间距 | 章节节奏 --section-py 两档统一；容器 max-w-6xl + px-4/sm:px-6 全站一致 |
| 圆角 | 3/6/10px 三档令牌收敛完毕（admin 13 处漂移已修） |
| 阴影 | card/pop/panel 三档令牌 |
| 层级 | --z-* 十档总表，零裸数字（_verify PASS） |
| 动效 | --dur-1..4 + --ease-out 唯一曲线；prefers-reduced-motion 全量尊重 |
| 断点 | 新版 sm/md/lg；legacy 480/600/768/900 各管各层（R2-045 决策保留，无同屏冲突面） |
| 交互状态 | 默认/悬停/聚焦/加载/空/错误六态走查通过（HeroScreen 五态截图确认） |
| 多端 | 1440/768/375 三档截图确认无溢出、无错位 |
| 浏览器 | 标准 CSS（无实验性属性）；backdrop-filter 带 -webkit- 前缀；canvas 修复符合 CSS2.1 规范语义 |

**验证**：_verify.py 27/27、_crosscheck.py 41/41、R6 走查脚本（对比度/焦点/溢出/触控）全绿、next build 成功（91 页静态导出）。
