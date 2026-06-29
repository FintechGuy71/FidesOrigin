# FidesOrigin Monorepo

## 项目结构

```
fidesorigin/
├── apps/
│   ├── api/              # API 服务
│   ├── contracts/        # 智能合约
│   ├── subgraph/         # The Graph 索引
│   └── web/              # Next.js 前端
├── packages/
│   ├── config/           # 共享配置
│   └── sdk/              # 客户端 SDK
├── package.json          # pnpm workspace 根配置
├── turbo.json            # Turborepo 构建管道
└── pnpm-workspace.yaml   # pnpm workspace 定义
```

## 快速开始

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建所有包
pnpm build

# 运行测试
pnpm test

# 类型检查
pnpm typecheck
```

## 安全修复记录

### 2026-06-15: CVE-2025-55182 修复
- **漏洞**: React Server Components 远程代码执行 (CVSS 10.0)
- **修复**: 降级 react/react-dom 19.2.3 → 19.2.1, next 15.1.11 → 15.1.9
- **状态**: ✅ 已修复并验证构建

## CI/CD

- **CI**: GitHub Actions (.github/workflows/ci.yml)
- **部署**: Vercel (前端) + The Graph Studio (Subgraph)
- **触发**: main 分支 push 自动触发
# Deployment trigger
