# GitHub Auto-Deploy Setup

## 配置步骤

### 1. GitHub Secrets 设置

在 GitHub 仓库设置中添加以下 Secrets：

| Secret | 说明 | 获取方式 |
|--------|------|----------|
| `VERCEL_TOKEN` | Vercel 个人访问令牌 | Vercel Dashboard → Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel 组织/用户 ID | Vercel Project Settings |
| `VERCEL_PROJECT_ID` | Vercel 项目 ID | Vercel Project Settings |

### 2. 配置路径
- GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret

### 3. 自动部署触发条件
- 推送到 `main` 或 `master` 分支
- 提交 Pull Request 到 `main` 或 `master` 分支

### 4. 部署流程
1. 代码推送到 GitHub
2. GitHub Actions 自动触发
3. 安装依赖（pnpm）
4. 构建 Next.js 应用
5. 自动部署到 Vercel Production

### 5. 验证部署
- 访问 https://fidesorigin.com 查看最新版本
- 在 Vercel Dashboard 查看部署日志

## 当前状态
- ✅ Vercel Token 已配置
- ✅ GitHub Actions 工作流已创建
- ⏳ 需要推送代码到 GitHub 触发首次部署

## 注意事项
- 使用 `--ignore-scripts` 避免构建脚本问题
- 使用 `--no-frozen-lockfile` 解决 lockfile 版本差异
- 构建命令：`cd apps/web && pnpm run build`

## 获取 Vercel 配置信息

在本地项目目录运行：
```bash
cat .vercel/project.json
```

输出示例：
```json
{
  "orgId": "your-org-id",
  "projectId": "your-project-id"
}
```
