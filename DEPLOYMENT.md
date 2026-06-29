# FidesOrigin 部署配置

## Vercel 自动部署配置

### 当前状态
- Vercel CLI 已登录（fintechguy71）
- Token 已持久化：`~/.vercel/auth.json`
- 项目已连接：`fintechguy71s-projects/fidesorigin-demo`

### 自动部署设置

#### 方法1：GitHub Actions（推荐）
已配置 `.github/workflows/deploy.yml`：
- 每次 push 到 main 分支自动触发
- 使用 `vercel --prod --yes` 部署
- 无需人工授权

#### 方法2：本地 CLI 部署
Token 已持久化，后续本地部署无需重新登录：
```bash
cd /root/.openclaw/workspace/fidesorigin-demo
npx vercel --prod --yes
```

### 部署检查清单

| 步骤 | 命令 | 说明 |
|------|------|------|
| 1. 提交代码 | `git add . && git commit -m "xxx"` | 保存改动 |
| 2. 推送代码 | `git push origin main` | 推送到 GitHub |
| 3. 自动部署 | GitHub Actions 触发 | 无需人工操作 |
| 4. 验证部署 | `curl -I https://fidesorigin.com` | 检查 HTTP 200 |

### 部署后验证（必须执行）

```bash
# 检查根路径
curl -s -o /dev/null -w "%{http_code}" https://fidesorigin.com/

# 检查子路径
curl -s -o /dev/null -w "%{http_code}" https://fidesorigin.com/cn/
curl -s -o /dev/null -w "%{http_code}" https://fidesorigin.com/address-check.html

# 检查域名双版本
curl -s -o /dev/null -w "%{http_code}" https://www.fidesorigin.com/
```

### 故障处理

| 问题 | 解决方式 |
|------|----------|
| Token 过期 | 重新执行 `npx vercel login` |
| 部署失败 | 检查 `vercel.json` 配置 |
| 域名未绑定 | 执行 `npx vercel domains add fidesorigin.com` |
| 构建错误 | 检查 `builds` 配置是否正确 |

## 结论

**Token 已持久化，后续部署无需人工授权。**

GitHub Actions 已配置自动部署，每次 push 到 main 分支会自动触发 Vercel 部署。
本地 CLI 部署也无需重新登录。
