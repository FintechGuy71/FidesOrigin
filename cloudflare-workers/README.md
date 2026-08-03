# FidesOrigin Cloudflare Workers 部署指南

## 方案概述
保留 Vercel 托管静态文件，通过 Cloudflare Workers 添加 HTTP 安全头。

```
用户 → Cloudflare DNS → Cloudflare Workers (添加安全头) → Vercel Origin
```

## 步骤

### 步骤1: DNS 迁移到 Cloudflare
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 添加站点 `fidesorigin.com`
3. 按提示修改域名注册商的 nameserver 为 Cloudflare 提供的地址
4. 等待 DNS 生效（通常几分钟到几小时）

### 步骤2: 创建 API Token
1. 在 Cloudflare Dashboard → My Profile → API Tokens
2. 创建 Token：模板选 "Edit Cloudflare Workers"
3. 权限：Zone:Read, Workers Scripts:Edit
4. 区域：包含 `fidesorigin.com`
5. 复制 Token

### 步骤3: 部署 Workers（以下两种方法）

#### 方法A: 自动部署（把 Token 给我）
```bash
export CLOUDFLARE_API_TOKEN="你的Token"
# 我会执行部署命令
```

#### 方法B: 自助部署
```bash
# 安装 wrangler
npm install -g wrangler

# 登录
wrangler login

# 部署
cd cloudflare-workers
wrangler deploy

# 配置路由（在 Cloudflare Dashboard 或命令行）
# 进入 Workers & Pages → fidesorigin-security → Triggers → Add route
# Pattern: fidesorigin.com/*
# Zone: fidesorigin.com
```

### 步骤4: 配置 DNS 记录
在 Cloudflare Dashboard → DNS：
- 删除现有的 `fidesorigin.com` A/CNAME 记录（指向 Vercel 的）
- 添加 Workers 路由（自动完成，只要步骤3配置了 route）

### 步骤5: 验证
```bash
curl -sI https://fidesorigin.com/ | grep -i "content-security\|x-frame\|x-content\|referrer\|permissions"
```

应该看到所有安全头都已添加。

## 文件说明

| 文件 | 说明 |
|------|------|
| `security-headers.js` | Workers 脚本，添加安全头并透传至 Vercel |
| `wrangler.toml` | Wrangler 配置文件 |

## 安全头清单

| 头 | 值 |
|----|-----|
| Content-Security-Policy | 完整CSP策略 |
| X-Frame-Options | DENY |
| X-Content-Type-Options | nosniff |
| Referrer-Policy | strict-origin-when-cross-origin |
| Permissions-Policy | camera=(), microphone=(), geolocation=() |
| Strict-Transport-Security | max-age=63072000 |
