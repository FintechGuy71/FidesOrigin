# FidesOrigin 前端提升报告（R13 · 两轮扫描闭环）

- **日期**：2026-09-26
- **范围**：12 个代表页面深度探针（性能/交互/动画合规/中间视口）+ 多模态视觉审查 + 生产状态码验证；两轮扫描（第一轮巡检 → 第二轮逐项复核取证）
- **基线**：main `1b2b9f8`（含 R6–R12 全部修复），产物重建后扫描

---

## 一、两轮扫描结论总览

**整体状态：优秀。** 12 页性能探针 DCL 11–111ms、页面总传输 634–865KB（无 >900KB 超标）、深浅双主题与 1280/1440/1600 三档视口零溢出、reduced-motion 下全部动画正确停用、CTA 悬停反馈正常、生产 404/401 状态码语义正确。两轮扫描确认 **4 项真实问题**（1 高 1 中 2 低）与 **2 项误报排除**。

---

## 二、问题清单（按影响程度排序）

### I1｜高｜visual CI 存在 reveal 回归检测盲区（R8-A1 型缺陷将再次漏检）
- **位置**：`.github/workflows/visual-regression.yml` → `apps/web/test/visual/visual.spec.ts`（全部用例 `emulateMedia({ reducedMotion: "reduce" })`）；对照 `apps/web/test/visual/interaction.spec.ts`（功能冒烟，无 reveal 用例）
- **描述**：R8-A1（`html.js .reveal` 压过 `.reveal.visible` 导致 legacy 全站隐身）之所以全绿上线，正是因为 visual 像素对比在 reduced-motion 下跑了 CSS 尾部"强制可见"分支。**只要有人再改 .reveal 相关规则，同样的盲区会重演**
- **优化方案**：在 interaction.spec.ts（功能断言、无像素基线依赖）新增用例：正常动效视口下滚动 legacy 页至底，断言全部 `.reveal` 元素获得 `visible` 类且 computed opacity > 0.9
- **预期效果**：reveal 回归从"上线后才被巡检发现"提前到 CI 拦截，闭环 R8-A1 型缺陷
- **状态**：✅ 本轮已实施

### I2｜中｜header 交互按钮缺 cursor:pointer（全站 16 页）
- **位置**：`components/ui/header.tsx` L198 语言下拉按钮、L284 移动菜单按钮
- **描述**：两按钮 computed `cursor: default`（探针实测）；键盘/触屏无感知，桌面鼠标用户缺少可点击暗示
- **优化方案**：两按钮 className 加 `cursor-pointer`
- **预期效果**：交互可点击暗示完整，消除与站内其它控件的行为不一致
- **状态**：✅ 本轮已实施

### I3｜低｜仓库卫生：历史审计脚本未忽略
- **位置**：仓库根 8 个 `apps/web/_audit_*.py`、`_css_out.txt`、`_dom_audit.py`（untracked）
- **描述**：一次性审计脚本散落工作区，git status 长期嘈杂
- **优化方案**：`.gitignore` 增加 `_audit_*.py`、`_css_out.txt`、`_dom_audit.py`
- **状态**：✅ 本轮已实施

### I4｜低｜brand 页 logo 原图无懒加载
- **位置**：`components/legacy/pages/brand.*.tsx`（4 语言）——页面传输 865KB（img 200KB）
- **描述**：展示型 logo 原图（127KB PNG）无 loading="lazy"；品牌页非首屏图片延迟加载可降首屏竞争
- **优化方案**：非首屏 `<img>` 加 `loading="lazy"`
- **预期效果**：brand 页 LCP 竞争降低；品牌资产页为展示原图可接受，不转 webp（保下载语义）
- **状态**：✅ 本轮已实施

### I5｜低（记录不实施）｜字体 preload 缺失
- **位置**：`out/index.html` —— `rel=preload as=font` 0 处
- **描述**：`output: 'export'` 静态导出下 next/font 不生成字体 preload link；字体经同源 @font-face 按需加载（共 103KB、display:swap），实测 DCL ≤111ms、无可见 FOUT
- **不实施原因**：preload 需硬编码构建 hash 文件名（不可维护）；收益/风险比不划算。记录为已知限制
- **状态**：📌 文档化

### I6｜误报排除（复核记录）
- admin/dashboard `auth/me` 404：本地静态服务器无 API 路由所致；生产 rewrite 返回 **401**（未授权语义正确）
- 生产 404 页状态码：正确返回 **404**（利于 SEO）
- 1280/1600 视口：无横向溢出；pricing/首页布局完好
- reduced-motion：R11 新增动画（radar sweep / flow dot）全部正确停用，0 违规
- CTA hover：default→hover 金色提亮反馈正常（截图对比确认）

---

## 三、已确认的优秀项（保持现状）

页面总传输全部 <900KB；DCL ≤111ms；三种字体自托管共 103KB 且正常加载；深浅双主题零溢出零对比度违规；R6–R12 全部修复无回归。

---

## 四、实施与部署记录

- 实施内容：I1（interaction.spec 新增 reveal 断言）、I2（cursor-pointer ×2）、I3（.gitignore 3 条）、I4（lazy ×4 页面）
- 验证：`_verify 27/27`、`_crosscheck 41/41`、新用例在 CI 中执行、探针 0 findings
- 部署：分支 → PR → CI → squash 合并 → Vercel 自动部署 → 生产抽查
