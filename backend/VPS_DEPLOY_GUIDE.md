# FidesOrigin VPS 部署指南 — 一键闭环

## 前提
- 一台 Linux VPS（Ubuntu 22.04+）
- Docker + Docker Compose 已安装
- 域名已指向 VPS IP（可选，用于 HTTPS）

## 步骤

### 1. 在 VPS 上 clone 代码
```bash
git clone https://github.com/FintechGuy71/FidesOrigin.git
cd FidesOrigin
```

### 2. 配置环境变量
```bash
cd backend
cp .env.example .env
nano .env  # 编辑以下关键变量
```

**必须修改的变量**：
```env
# 数据库（Docker Compose 会自动创建 PostgreSQL）
DATABASE_URL=postgresql://fides:fides_password@postgres:5432/fides_db

# JWT Secret — 必须随机生成，至少 64 字符
JWT_SECRET=your-random-64-char-secret-here-change-me

# Admin 密码 — 至少12位+大小写+数字+特殊字符
ADMIN_PASSWORD=YourStrongP@ssw0rd123

# 链上配置
SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com
POLICY_ENGINE_PROXY=0x87089F67A61F9643796AE154663A6a9F21196b38
RISK_REGISTRY_PROXY=0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc
COMPLIANCE_ENGINE_PROXY=0x50aAaf70b50fB26e588e0d296A4c042943FfB0AC
```

### 3. 一键部署
```bash
chmod +x deploy.sh
./deploy.sh
```

### 4. 验证
```bash
# 检查服务状态
docker compose -f docker-compose.prod.yml ps

# 测试 API
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/health
```

### 5. 配置域名 + SSL（可选）
如果使用域名，编辑 `nginx.conf` 中的 server_name，然后用 certbot 申请证书：
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 6. 更新（后续）
```bash
cd ~/FidesOrigin
git pull origin clean-main
backend/deploy.sh
```

---

## 文件清单（已准备就绪）
- `backend/Dockerfile` — 后端容器
- `backend/docker-compose.prod.yml` — 生产编排
- `backend/.env.example` — 环境变量模板
- `backend/deploy.sh` — 一键部署脚本
- `backend/nginx.conf` — 反向代理配置
- `.github/workflows/publish-sdk.yml` — SDK 自动发布

## 注意事项
- 首次部署会下载 PostgreSQL 和 Redis 镜像，可能需要 2-3 分钟
- 默认端口：8000（API）、5432（PostgreSQL）、6379（Redis）、80/443（Nginx）
- 确保防火墙放行 80/443 端口
