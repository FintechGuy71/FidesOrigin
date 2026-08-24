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

# 链上配置（v3.1.0 Sepolia 部署，2026-08-23 全新部署，详见 DEPLOYED.md）
SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com
FIDES_COMPLIANCE=0x2625eA99A0E7D419b8051C4f2B3cC0b5d78d79D5
COMPLIANCE_ENGINE_PROXY=0xdF36A8b16F064308eeDE21A740FAc4e87b724F0E
RISK_REGISTRY_PROXY=0x953f985f38f94d6159c0600d1f15D543895cE896
POLICY_ENGINE_PROXY=0xCA12BB2daD2a6D429277823366D8C88a490EDDeA
MERKLE_RISK_REGISTRY=0x31A034efbe22eDc1a78ceb37F52BA869D869c33B
QUARANTINE_VAULT=0x6803E163259B07F58111f56423aB0732858196Be
TIMELOCK=0x04B2Fc88b57AE8d8E6cE26d93294E3511cFbb247
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
git pull origin main
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
