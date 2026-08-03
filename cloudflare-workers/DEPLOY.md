# Cloudflare Workers 部署说明

## 自动部署

GitHub Actions 已配置，推送代码到 `main` 分支时自动部署。

### 配置 GitHub Secret

在 GitHub 仓库设置中添加：

1. 进入 Settings → Secrets and variables → Actions
2. 点击 "New repository secret"
3. Name: `CLOUDFLARE_API_TOKEN`
4. Secret: `[你的 Cloudflare API Token]`

### 触发部署

- 自动：修改 `cloudflare-workers/` 目录并 push 到 main
- 手动：Actions → Deploy Cloudflare Worker → Run workflow

## 手动部署

```bash
cd cloudflare-workers
export CLOUDFLARE_API_TOKEN="[你的 Cloudflare API Token]"
wrangler deploy
```

## 验证部署

```bash
curl -sI https://fidesorigin.com/ | grep -i "^content-security\|^x-frame\|^x-content\|^referrer\|^permissions"
```

应返回所有安全头。
