# FidesOrigin 前端样式与展示冲突系统性排查报告（R7）

- **日期**：2026-09-25
- **方法**：Playwright 动态探针（13 页 × 5 视口 [320/375/768/1024/1440] × 深/浅主题：横向溢出、元素重叠、角标渲染、SVG bbox、页脚中档宽度、404 遮挡实测）+ 静态分析（!important、前缀缺失、渐进特性回退、JS 依赖渲染）+ 逐项源码定位根因
- **约束**：设计风格、功能、文案、路由、接口零改动——全部为冲突消解与防御性加固

---

## 发现与修复清单

### C1【P1｜样式覆盖冲突】"技术图纸角标"（.fio-ticks）从未渲染过
- **位置**：HeroHome 右侧面板、Features 三张视觉框、Workflows 蓝图框、HomeContact CTA 框（4 组件 6 实例）
- **现象**：四角 L 形金色刻线（品牌"合规蓝图"签名细节）完全不可见
- **根因**：刻线以 8 条 `background-image` 渐变画在元素自身上，但 4 个消费者全部在内联 `style` 设置 `background` **简写**——简写把 `background-image` 重置为 `none`，且内联优先级高于任何类，刻线自组件诞生起即被系统性抹掉
- **修复**：刻线图案整体移至 `.fio-ticks::before`（`position:absolute; inset:0; z-index:-1`——画在父背景之上、内容之下），与元素自身背景彻底解耦；内联简写不再冲突。实测 6 实例 ::before 均渲染 8 条渐变，截图确认四角刻线回归

### C2【P1｜元素越界】旋转监管封印文字环越出视口（768-1200px 全区间）
- **位置**：HeroHome 封印（`absolute -right-5 -top-8`）
- **现象**：探针实测 svg 内 text/g/textPath bbox right=775@768、1031@1024——旋转文字环（环直径≈svg 盒宽）在旋转 45° 时 bbox 外扩约 21px，而容器在 <1200px 时无侧向富余（max-w-6xl==viewport-48），封印尖端被 overflow guard 裁切
- **修复**：`-right-5` → `right-0 xl:-right-5`（sm-xl 贴边安全；≥1280 容器侧富余 ≥64px，恢复悬挑设计）

### C3【P1｜重叠压盖】封印压住面板窗口 chrome 标签（R6 探针因 aria-hidden 排除而漏检）
- **位置**：HeroHome 面板头部 `fidesorigin.com/admin` 标签
- **根因**：封印印章悬于面板右上角，右对齐标签被圆环压住右段
- **修复**：标签加 `sm:mr-24 xl:mr-28`——**必须用 margin**（flex 布局中 margin 参与分配使文字实际左移；此前误用 padding-right，inline 元素的 padding 推不动文字，第一次修复无效后纠正）。实测 labelClear=true

### C4【P2｜浏览器兼容】`min-h-[92svh]` 无回退
- **位置**：HeroHome hero 容器
- **根因**：`svh` 单位仅 Chromium 108+/Safari 15.4+/Firefox 101+ 支持，旧浏览器整条声明被丢弃 → hero 失去最小高度而塌陷
- **修复**：新增 `.fio-hero-min { min-height:100vh }` + `@supports (min-height:92svh)` 渐进覆盖；实测 minH=828px（92svh 生效）

### C5【P2｜浏览器兼容】`overflow-x-clip` 无回退
- **位置**：home-chrome 全站横向溢出防线
- **根因**：Safari <16 不识别 `clip` → 防线整体失效（横向滚动防护归零）
- **修复**：新增 `.fio-overflow-guard { overflow-x:hidden; overflow-x:clip }`——旧浏览器用 hidden 兜底（chrome 内无 sticky 元素，无副作用），新浏览器 clip 胜出（不创建滚动容器）

### C6【P2｜浏览器兼容】backdrop-filter 缺 -webkit- 前缀（3 处）
- **位置**：HeroHome 面板、HeroScreen 筛查框（内联 style）、legacy `.nav`（CSS）
- **根因**：Safari ≤15 需 `-webkit-backdrop-filter`，缺失时毛玻璃失效降级为半透明
- **修复**：3 处补齐前缀（header 原本已有）

### C7【P2｜渐进增强】legacy 站 `.reveal` 无 JS 失败防御
- **位置**：css/legacy.css reveal 动画 + 两个 legacy root layout
- **根因**：`.reveal { opacity:0 }` 无条件生效，JS 被禁用/加载失败时 IO 永不触发 → 经典站全部主要区块**永久不可见**
- **修复**：改为 `html.js .reveal` 门控；两个渲染 `<html>` 的 legacy layout head 加**阻塞内联**脚本 `document.documentElement.classList.add("js")`（CSS 生效前同步执行，正常路径零视觉差异、无闪烁窗口）；reduced-motion 分支同步门控。顺带将 reveal 的 `0.7s cubic-bezier(...)` 字面量收口到 `var(--dur-4)/var(--ease-out)` 动效令牌

### 探针误报澄清（非缺陷，已修正探针）
- 404"内容被 header 遮挡"：实为探针取容器 div（top=0）所致；h1 实测 top=378px，clear
- fixed 导航与流内容相交：设计行为（hero py-28 补偿），探针改为沿祖先链识别 fixed
- canvas 装饰层与内容相交：pointer-events:none 有意分层，排除
- Features radar 同心圆相交 / 图注压图（`-bottom-2` 有意压图）：SVG 内部相交与标注设计，加白名单规则

---

## 验证结果

| 检查 | 结果 |
|------|------|
| R7 探针（13 页 × 5 视口 × 深色 + 4 页浅色：溢出/重叠/角标/SVG/页脚/404） | **0 findings**（修复前 18） |
| _verify.py（层序/令牌/硬编码色/z-index 等 27 项） | 27/27 |
| _crosscheck.py（交叉复核 41 项） | 41/41 |
| next build（91 页静态导出） | 成功 |
| 视觉截图 | 角标回归、seal 避让、面板特写确认 |

**改动文件**：css/fio-design-system.css、css/legacy.css、components/HeroHome.tsx、components/HeroScreen.tsx、components/home-chrome.tsx、app/(legacy)/layout.tsx、app/[lang]/layout.tsx、探针 _r7_probe.js
