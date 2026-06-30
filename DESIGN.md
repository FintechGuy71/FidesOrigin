# FidesOrigin 设计系统文档

> **安全修复版本**: v2.5.2 — 2026-07-01
> 本版本包含 72 项安全审计修复，详见 ARCHITECTURE.md 安全架构章节。

## 项目概述

FidesOrigin 是一个链上合规基础设施平台，为 Web3 企业提供地址风险扫描、交易监控、合规报告与监管对接服务。

本项目包含三个主要部分：
- **Website** (`/website/`) - 营销官网，面向潜在客户
- **Admin** (`/admin/`) - 运营后台，面向内部运营团队
- **Backend** (`/backend/`) - FastAPI 后端服务

---

## 设计系统

### 色彩规范

#### 主色调 (Dark Theme)

| Token | 值 | 用途 |
|-------|-----|------|
| `--bg-primary` | `#0f172a` | 页面主背景 |
| `--bg-secondary` | `#1e293b` | 卡片/侧边栏背景 |
| `--bg-card` | `#334155` | 输入框/次级卡片 |
| `--bg-hover` | `#475569` | 悬停状态 |
| `--text-primary` | `#f8fafc` | 主文字 |
| `--text-secondary` | `#94a3b8` | 次级文字 |
| `--text-muted` | `#64748b` | 弱化文字 |

#### 强调色

| Token | 值 | 用途 |
|-------|-----|------|
| `--accent-purple` | `#8b5cf6` | 主品牌色、按钮、高亮 |
| `--accent-cyan` | `#06b6d4` | 信息、链接、次级强调 |
| `--accent-pink` | `#ec4899` | 装饰、渐变 |

#### 状态色

| Token | 值 | 用途 |
|-------|-----|------|
| `--success` | `#22c55e` | 成功、正常状态 |
| `--warning` | `#f59e0b` | 警告、待处理 |
| `--danger` | `#ef4444` | 错误、危险操作 |
| `--info` | `#3b82f6` | 信息提示 |

#### 边框

| Token | 值 | 用途 |
|-------|-----|------|
| `--border` | `rgba(148, 163, 184, 0.2)` | 分割线、卡片边框 |

### 字体规范

- **主字体**: `Inter` (Google Fonts)
- **字重**: 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)
- **等宽字体**: `Monaco`, `Consolas` (用于地址显示)

### 间距系统

| Token | 值 |
|-------|-----|
| `--space-xs` | `4px` |
| `--space-sm` | `8px` |
| `--space-md` | `12px` |
| `--space-lg` | `16px` |
| `--space-xl` | `20px` |
| `--space-2xl` | `24px` |
| `--space-3xl` | `32px` |

### 圆角系统

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-sm` | `6px` | 小按钮、标签 |
| `--radius-md` | `8px` | 按钮、输入框 |
| `--radius-lg` | `10px` | 图标容器 |
| `--radius-xl` | `12px` | 卡片 |
| `--radius-2xl` | `16px` | 模态框 |
| `--radius-full` | `50%` | 圆形元素 |

---

## 组件库

### 按钮 (Button)

```
.btn-primary     → 紫色渐变背景，白色文字
.btn-secondary   → 深色背景，白色文字，边框
.btn-success     → 绿色背景，白色文字
.btn-danger      → 红色背景，白色文字
.btn-warning     → 橙色背景，深色文字
.btn-sm          → 小尺寸变体
```

### 卡片 (Card)

```
.card            → 深色背景，圆角，边框
.card-header     → 卡片头部，带标题和操作
.card-body       → 卡片内容区
```

### 标签 (Tag)

```
.tag-vip         → 金色/橙色，VIP标识
.tag-normal      → 绿色，正常用户
.tag-grey        → 灰色，灰名单
.tag-black       → 红色，黑名单
.tag-admin       → 紫色，管理员
.tag-operator    → 青色，操作员
```

### 表单 (Form)

```
.form-group      → 表单字段容器
.form-label      → 标签文字
.form-input      → 文本输入框
.form-select     → 下拉选择框
```

### 表格 (Table)

```
表头: 灰色文字，大写，小字号
行: 悬停高亮
单元格: 左对齐，适当内边距
地址单元格: 等宽字体
```

### 模态框 (Modal)

```
.modal           → 全屏遮罩，居中内容
.modal-content   → 内容容器，圆角，边框
.modal-title     → 标题
.modal-footer    → 底部操作区
```

### 统计卡片 (Stat Card)

```
.stat-card       → 网格布局卡片
.stat-label      → 标签（小字，灰色）
.stat-value      → 数值（大字，白色）
.stat-change     → 变化指示（带颜色）
```

### 导航 (Navigation)

```
.sidebar         → 固定侧边栏，280px宽
.nav-section     → 导航分组
.nav-title       → 分组标题（大写，小字）
.nav-item        → 导航项，悬停高亮
.nav-item.active → 激活状态（左边框）
```

---

## 布局规范

### Admin 布局

```
┌─────────────────────────────────────────┐
│  Sidebar (280px)    │  Main Content      │
│  - Logo             │  - Header          │
│  - Navigation       │  - Stats Grid      │
│  - Sections         │  - Charts          │
│                     │  - Tables          │
│                     │  - Cards           │
└─────────────────────────────────────────┘
```

### Website 布局

```
┌─────────────────────────────────────────┐
│  Navbar (Fixed, blur)                   │
├─────────────────────────────────────────┤
│  Hero Section (Full height)             │
├─────────────────────────────────────────┤
│  Features Grid (4 cols)                 │
├─────────────────────────────────────────┤
│  How It Works (4 steps)                 │
├─────────────────────────────────────────┤
│  Security (2 cols, image + text)        │
├─────────────────────────────────────────┤
│  Compliance Badges (4 cols)             │
├─────────────────────────────────────────┤
│  CTA Section                            │
├─────────────────────────────────────────┤
│  Footer (4 cols)                        │
└─────────────────────────────────────────┘
```

---

## 动画规范

### 过渡效果

| 效果 | 时长 | 缓动函数 |
|------|------|----------|
| 按钮悬停 | `0.2s` | `ease` |
| 卡片悬停 | `0.3s` | `ease` |
| 卡片上浮 | `0.4s` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| 页面切换 | `0.2s` | `ease` |
| 滚动显示 | `0.8s` | `cubic-bezier(0.4, 0, 0.2, 1)` |

### 关键帧动画

```css
/* 背景脉冲 */
@keyframes bgPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.7; } }

/* 粒子浮动 */
@keyframes float { 0%,100% { transform: translateY(100vh) scale(0); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateY(-10vh) scale(1); opacity: 0; } }

/* 骨架屏闪烁 */
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* 旋转加载 */
@keyframes spin { to { transform: rotate(360deg); } }
```

---

## 响应式断点

| 断点 | 宽度 | 调整 |
|------|------|------|
| Desktop | > 1200px | 完整布局 |
| Tablet | 768px - 1200px | 侧边栏隐藏，网格2列 |
| Mobile | < 768px | 单列，汉堡菜单 |

---

## 图标系统

- 使用 Unicode emoji 作为图标（⬡, 📊, 📡, 👥, 🏷️, ⚙️, 🔒, 🚫, ⏱️, 🔏, 🚨, 📜, 📋, 🔧）
- SVG 图标用于导航和社交媒体链接

---

## CDN 依赖

| 资源 | URL | 用途 |
|------|-----|------|
| Chart.js | `https://cdn.jsdelivr.net/npm/chart.js` | Admin 图表 |
| Ethers.js | `https://cdn.jsdelivr.net/npm/ethers@6.8.0/dist/ethers.umd.min.js` | Web3 交互 |
| Tailwind CSS | `https://cdn.tailwindcss.com` | Website 样式 |
| Inter Font | `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap` | 字体 |

---

## 文件结构

```
fidesorigin-demo/
├── admin/
│   └── index.html          # 运营后台 (69KB, 1676行)
├── website/
│   └── index.html          # 营销官网 (42KB, 689行)
├── backend/
│   ├── app/                # FastAPI 应用
│   ├── tests/              # 测试
│   ├── AUDIT_REPORT.md     # 代码审计报告
│   ├── DATABASE.md         # 数据库文档
│   ├── REFACTOR_SUMMARY.md # 重构总结
│   └── README.md           # 项目说明
└── DESIGN.md               # 本设计文档
```
