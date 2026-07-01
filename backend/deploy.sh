#!/bin/bash
# ============================================================
# FidesOrigin 一键部署脚本
# 在 VPS 上执行: ./deploy.sh
# ============================================================

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
PROJECT_NAME="FidesOrigin"
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="docker-compose.prod.yml"
HEALTH_RETRIES=30
HEALTH_INTERVAL=2

# ==================== 工具函数 ====================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 未安装，请先安装"
        exit 1
    fi
}

# 健康检查
health_check() {
    local url="$1"
    local retries=${2:-$HEALTH_RETRIES}
    local interval=${3:-$HEALTH_INTERVAL}

    log_info "等待后端服务就绪..."
    for i in $(seq 1 $retries); do
        if curl -sf "$url" &>/dev/null; then
            log_success "服务健康检查通过: $url"
            return 0
        fi
        echo -n "."
        sleep $interval
    done
    echo ""
    log_error "健康检查失败: $url"
    return 1
}

# 显示部署信息
show_info() {
    echo ""
    echo "========================================"
    echo -e "${GREEN}${PROJECT_NAME} 部署完成${NC}"
    echo "========================================"
    echo ""
    echo "服务状态:"
    docker compose -f "$COMPOSE_FILE" ps
    echo ""
    echo "访问地址:"
    echo "  - API 文档:  http://your-domain.com/docs (开发环境)"
    echo "  - 健康检查:  http://your-domain.com/health"
    echo "  - 版本信息:  http://your-domain.com/api/version"
    echo ""
    echo "常用命令:"
    echo "  查看日志:    docker compose -f $COMPOSE_FILE logs -f backend"
    echo "  重启服务:    docker compose -f $COMPOSE_FILE restart backend"
    echo "  进入容器:    docker compose -f $COMPOSE_FILE exec backend sh"
    echo "  数据库迁移:  docker compose -f $COMPOSE_FILE exec backend alembic upgrade head"
    echo "  备份数据:    docker compose -f $COMPOSE_FILE exec postgres pg_dump -U fidesorigin fidesorigin > backup.sql"
    echo ""
}

# ==================== 主流程 ====================

echo "========================================"
echo -e "${BLUE}${PROJECT_NAME} 生产部署脚本${NC}"
echo "========================================"
echo ""

# 1. 检查环境
check_command docker
check_command docker compose
check_command curl

# 2. 检查 .env 文件
if [[ ! -f "$BACKEND_DIR/.env" ]]; then
    log_warn ".env 文件不存在，从 .env.example 复制"
    if [[ -f "$BACKEND_DIR/.env.example" ]]; then
        cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
        log_error "请先编辑 .env 文件，填入实际的安全密钥和密码后再运行"
        exit 1
    else
        log_error ".env.example 文件也不存在，无法继续部署"
        exit 1
    fi
fi

# 3. 检查是否在生产环境
cd "$BACKEND_DIR"

# 4. 拉取最新代码（如果当前目录是 git 仓库）
if [[ -d "$BACKEND_DIR/../.git" ]]; then
    log_info "拉取最新代码..."
    cd "$BACKEND_DIR/.."
    git pull origin main || git pull origin master || log_warn "Git pull 失败，使用本地代码继续"
    cd "$BACKEND_DIR"
else
    log_warn "非 Git 仓库，跳过代码拉取"
fi

# 5. 构建镜像
log_info "构建 Docker 镜像..."
docker compose -f "$COMPOSE_FILE" build --no-cache backend

# 6. 启动服务
log_info "启动所有服务..."
docker compose -f "$COMPOSE_FILE" up -d

# 7. 等待 PostgreSQL 就绪
log_info "等待数据库就绪..."
sleep 5

# 8. 执行数据库迁移
log_info "执行数据库迁移 (Alembic)..."
if docker compose -f "$COMPOSE_FILE" exec -T backend alembic upgrade head 2>/dev/null; then
    log_success "数据库迁移完成"
else
    log_warn "Alembic 迁移失败，尝试自动创建表..."
    docker compose -f "$COMPOSE_FILE" exec -T backend python -c "
import asyncio
from app.database import init_db
asyncio.run(init_db())
" || log_warn "数据库初始化失败，请手动检查"
fi

# 9. 健康检查
log_info "执行健康检查..."
if health_check "http://localhost:8000/health"; then
    log_success "后端服务正常运行"
else
    log_error "后端服务未通过健康检查，查看日志:"
    docker compose -f "$COMPOSE_FILE" logs --tail=50 backend
    exit 1
fi

# 10. 检查就绪状态
if health_check "http://localhost:8000/ready" 10 2; then
    log_success "后端服务已就绪"
else
    log_warn "就绪检查未通过，可能 Redis 连接有问题"
fi

# 11. 清理旧镜像
log_info "清理未使用的 Docker 资源..."
docker image prune -f || true

# 12. 显示结果
show_info

log_success "部署脚本执行完毕"
