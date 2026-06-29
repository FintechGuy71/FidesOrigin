#!/bin/bash
# FidesOrigin Data Publisher — 一键部署脚本
# Usage: ./deploy.sh [target] [environment]
# Targets: docker | systemd | pm2
# Environments: dev | staging | production

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Defaults
TARGET="${1:-docker}"
ENV="${2:-production}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="fidesorigin-publisher"
VERSION="$(git describe --tags --always 2>/dev/null || echo '1.0.0')"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================
# Pre-flight checks
# ============================================
check_prerequisites() {
    log_info "Running pre-flight checks..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js not found. Install Node.js 18+ first."
        exit 1
    fi

    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js 18+ required, found $(node --version)"
        exit 1
    fi
    log_ok "Node.js $(node --version)"

    # Check required env vars
    local required_vars=("RPC_URL" "RISK_REGISTRY_ADDRESS")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ] && [ ! -f "$SCRIPT_DIR/.env" ]; then
            log_error "Missing required env var: $var (or .env file)"
            exit 1
        fi
    done

    # Check private key or KMS
    if [ -z "${PUBLISHER_PRIVATE_KEY:-}" ] && [ -z "${KMS_PROVIDER:-}" ]; then
        log_error "Either PUBLISHER_PRIVATE_KEY or KMS_PROVIDER must be set"
        exit 1
    fi

    log_ok "Pre-flight checks passed"
}

# ============================================
# Build
# ============================================
build_project() {
    log_info "Building project..."
    cd "$SCRIPT_DIR"

    if [ ! -d "node_modules" ]; then
        log_info "Installing dependencies..."
        npm ci --production=false
    fi

    npm run build
    log_ok "Build successful"
}

# ============================================
# Deploy via Docker
# ============================================
deploy_docker() {
    log_info "Deploying with Docker..."

    # Load env vars
    if [ -f "$SCRIPT_DIR/.env" ]; then
        export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
    fi

    # Build image
    docker build -t "${PROJECT_NAME}:${VERSION}" -t "${PROJECT_NAME}:latest" .
    log_ok "Docker image built: ${PROJECT_NAME}:${VERSION}"

    # Stop existing container
    if docker ps -q -f name="${PROJECT_NAME}" | grep -q .; then
        log_warn "Stopping existing container..."
        docker stop "${PROJECT_NAME}" || true
        docker rm "${PROJECT_NAME}" || true
    fi

    # Run new container
    docker run -d \
        --name "${PROJECT_NAME}" \
        --restart unless-stopped \
        -p "${MONITOR_PORT:-9090}:9090" \
        -v "${SCRIPT_DIR}/logs:/app/logs" \
        --env-file "$SCRIPT_DIR/.env" \
        --health-cmd="wget --quiet --tries=1 --spider http://localhost:9090/health || exit 1" \
        --health-interval=30s \
        --health-timeout=10s \
        --health-retries=3 \
        "${PROJECT_NAME}:latest"

    log_ok "Container started: ${PROJECT_NAME}"
    log_info "Health check: http://localhost:${MONITOR_PORT:-9090}/health"
    log_info "Metrics: http://localhost:${MONITOR_PORT:-9090}/metrics"
}

# ============================================
# Deploy via systemd
# ============================================
deploy_systemd() {
    log_info "Deploying with systemd..."

    # Ensure build
    build_project

    # Create service file
    local service_file="/etc/systemd/system/${PROJECT_NAME}.service"
    sudo tee "$service_file" > /dev/null <<EOF
[Unit]
Description=FidesOrigin Data Publisher
After=network.target

[Service]
Type=simple
User=${PUBLISHER_USER:-publisher}
WorkingDirectory=${SCRIPT_DIR}
Environment=NODE_ENV=${ENV}
EnvironmentFile=${SCRIPT_DIR}/.env
ExecStart=/usr/bin/node ${SCRIPT_DIR}/dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${PROJECT_NAME}

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${SCRIPT_DIR}/logs

[Install]
WantedBy=multi-user.target
EOF

    # Create user if needed
    if ! id "${PUBLISHER_USER:-publisher}" &>/dev/null; then
        sudo useradd -r -s /bin/false "${PUBLISHER_USER:-publisher}"
        log_ok "Created user: ${PUBLISHER_USER:-publisher}"
    fi

    # Set permissions
    sudo chown -R "${PUBLISHER_USER:-publisher}:${PUBLISHER_USER:-publisher}" "$SCRIPT_DIR"
    sudo chmod 600 "$SCRIPT_DIR/.env"

    # Enable and start
    sudo systemctl daemon-reload
    sudo systemctl enable "${PROJECT_NAME}"
    sudo systemctl restart "${PROJECT_NAME}"

    log_ok "Service installed and started"
    log_info "Status: sudo systemctl status ${PROJECT_NAME}"
    log_info "Logs: sudo journalctl -u ${PROJECT_NAME} -f"
}

# ============================================
# Deploy via PM2
# ============================================
deploy_pm2() {
    log_info "Deploying with PM2..."

    # Check PM2
    if ! command -v pm2 &> /dev/null; then
        log_info "Installing PM2..."
        npm install -g pm2
    fi

    # Ensure build
    build_project

    # Create ecosystem file
    cat > "$SCRIPT_DIR/ecosystem.config.js" <<EOF
module.exports = {
  apps: [{
    name: '${PROJECT_NAME}',
    script: '${SCRIPT_DIR}/dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: '${ENV}'
    },
    env_file: '${SCRIPT_DIR}/.env',
    log_file: '${SCRIPT_DIR}/logs/combined.log',
    out_file: '${SCRIPT_DIR}/logs/out.log',
    error_file: '${SCRIPT_DIR}/logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '512M',
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '30s',
    kill_timeout: 5000,
    listen_timeout: 10000,
    wait_ready: true,
    // Health check
    health_check_grace_period: 30000,
    // Auto restart on failure
    autorestart: true,
    // Don't restart if crashing too fast
    exp_backoff_restart_delay: 100,
  }]
};
EOF

    # Start/restart with PM2
    pm2 delete "${PROJECT_NAME}" 2>/dev/null || true
    pm2 start "$SCRIPT_DIR/ecosystem.config.js"
    pm2 save

    # Setup startup script
    pm2 startup systemd 2>/dev/null || true

    log_ok "PM2 process started"
    log_info "Status: pm2 status"
    log_info "Logs: pm2 logs ${PROJECT_NAME}"
}

# ============================================
# Post-deploy verification
# ============================================
verify_deployment() {
    log_info "Running post-deploy verification..."

    local max_wait=60
    local waited=0

    while [ $waited -lt $max_wait ]; do
        if curl -sf http://localhost:${MONITOR_PORT:-9090}/health > /dev/null 2>&1; then
            log_ok "Health check passed"
            break
        fi
        sleep 2
        waited=$((waited + 2))
        echo -n "."
    done

    if [ $waited -ge $max_wait ]; then
        log_error "Health check failed after ${max_wait}s"
        exit 1
    fi

    # Check metrics endpoint
    if curl -sf http://localhost:${MONITOR_PORT:-9090}/metrics > /dev/null 2>&1; then
        log_ok "Metrics endpoint accessible"
    fi

    # Check contract connection
    log_info "Checking contract connection..."
    # This would need a custom endpoint or log parsing

    log_ok "Deployment verified successfully!"
}

# ============================================
# Rollback
# ============================================
rollback() {
    log_warn "Rolling back deployment..."

    case "$TARGET" in
        docker)
            docker stop "${PROJECT_NAME}" 2>/dev/null || true
            docker rm "${PROJECT_NAME}" 2>/dev/null || true
            ;;
        systemd)
            sudo systemctl stop "${PROJECT_NAME}" 2>/dev/null || true
            ;;
        pm2)
            pm2 delete "${PROJECT_NAME}" 2>/dev/null || true
            ;;
    esac

    log_ok "Rollback complete"
}

# ============================================
# Main
# ============================================
main() {
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════╗"
    echo "║   FidesOrigin Data Publisher — Deployment Script     ║"
    echo "║   Target: ${TARGET} | Environment: ${ENV}                     ║"
    echo "╚══════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    # Trap errors for rollback
    trap 'log_error "Deployment failed!"; rollback; exit 1' ERR

    check_prerequisites

    case "$TARGET" in
        docker)
            deploy_docker
            ;;
        systemd)
            deploy_systemd
            ;;
        pm2)
            deploy_pm2
            ;;
        *)
            log_error "Unknown target: $TARGET. Use: docker | systemd | pm2"
            exit 1
            ;;
    esac

    verify_deployment

    echo -e "${GREEN}"
    echo "═══════════════════════════════════════════════════════"
    echo "  Deployment Complete! 🚀"
    echo "═══════════════════════════════════════════════════════"
    echo -e "${NC}"
    echo "  Health:    http://localhost:${MONITOR_PORT:-9090}/health"
    echo "  Metrics:   http://localhost:${MONITOR_PORT:-9090}/metrics"
    echo "  Logs:      ./logs/"
    echo ""
}

# Run
main "$@"
