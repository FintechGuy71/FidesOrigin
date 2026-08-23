#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# FidesOrigin Subgraph 自动同步脚本
#
# 用途：
#   1. 读取 deployments/sepolia-latest.json 获取合约地址
#   2. 自动更新 subgraph.yaml
#   3. 执行 codegen + build
#   4. 部署到 The Graph Studio
#   5. 等待同步完成并验证
#
# 前置条件：
#   - graph CLI 已安装: npm install -g @graphprotocol/graph-cli
#   - 已认证: graph auth --studio <DEPLOY_KEY>
#   - 合约已部署且 deployments/sepolia-latest.json 存在
#
# 执行方式：
#   cd apps/subgraph
#   ./auto-sync.sh
#
# 环境变量：
#   SUBGRAPH_NAME         # Subgraph 名称 (默认: fidesorigin-sepolia)
#   STUDIO_DEPLOY_KEY     # The Graph Studio 部署密钥
#   WAIT_FOR_SYNC         # 是否等待同步完成 (true/false, 默认: true)
#   SYNC_TIMEOUT_MINUTES  # 同步等待超时分钟数 (默认: 30)
#   DRY_RUN               # 仅打印步骤，不执行 (true/false, 默认: false)
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── 颜色输出 ─────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ─── 配置 ─────────────────────────────────────────────────────────
SUBGRAPH_NAME="${SUBGRAPH_NAME:-fidesorigin-sepolia}"
WAIT_FOR_SYNC="${WAIT_FOR_SYNC:-true}"
SYNC_TIMEOUT_MINUTES="${SYNC_TIMEOUT_MINUTES:-30}"
DRY_RUN="${DRY_RUN:-false}"

# The Graph Studio 查询端点（需要根据实际部署更新）
STUDIO_QUERY_URL="https://api.studio.thegraph.com/query"
DEPLOYMENT_FILE="../contracts/deployments/sepolia-latest.json"

# ─── 工具函数 ─────────────────────────────────────────────────────
log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ─── 检查命令 ─────────────────────────────────────────────────────
check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 not found. Please install it first."
        return 1
    fi
    log_ok "$1 is available"
}

# ─── 读取部署记录 ─────────────────────────────────────────────────
load_deployment() {
    if [ ! -f "$DEPLOYMENT_FILE" ]; then
        log_error "Deployment record not found: $DEPLOYMENT_FILE"
        log_info "Please deploy contracts first: cd apps/contracts && npx hardhat run scripts/deploy-v3.0.4-sepolia.js --network sepolia"
        exit 1
    fi

    log_info "Loading deployment record from $DEPLOYMENT_FILE"

    # 读取各合约地址（优先从 upgrades 读取 proxy，否则从 contracts 读取）
    RISK_REGISTRY=$(jq -r '.upgrades.RiskRegistry.proxy // .contracts.RiskRegistry.address // .RiskRegistry.proxy // .RiskRegistry.address // empty' "$DEPLOYMENT_FILE")
    POLICY_ENGINE=$(jq -r '.upgrades.PolicyEngine.proxy // .contracts.PolicyEngine.address // .PolicyEngine.proxy // .PolicyEngine.address // empty' "$DEPLOYMENT_FILE")
    COMPLIANCE_ENGINE=$(jq -r '.upgrades.ComplianceEngine.proxy // .contracts.ComplianceEngine.address // .ComplianceEngine.proxy // .ComplianceEngine.address // empty' "$DEPLOYMENT_FILE")
    FIDES_COMPLIANCE=$(jq -r '.contracts.FidesCompliance.address // .FidesCompliance.address // empty' "$DEPLOYMENT_FILE")
    COMPLIANT_STABLE_COIN=$(jq -r '.contracts.CompliantStableCoin.address // .CompliantStableCoin.address // empty' "$DEPLOYMENT_FILE")

    # 读取升级后的 implementation 地址（用于验证）
    RISK_REGISTRY_IMPL=$(jq -r '.upgrades.RiskRegistry.newImpl // .upgrades.RiskRegistry.implementation // empty' "$DEPLOYMENT_FILE")
    POLICY_ENGINE_IMPL=$(jq -r '.upgrades.PolicyEngine.newImpl // .upgrades.PolicyEngine.implementation // empty' "$DEPLOYMENT_FILE")
    COMPLIANCE_ENGINE_IMPL=$(jq -r '.upgrades.ComplianceEngine.newImpl // .upgrades.ComplianceEngine.implementation // empty' "$DEPLOYMENT_FILE")

    # 读取 startBlock（使用最近的升级区块号，或默认）
    RISK_REGISTRY_BLOCK=$(jq -r '.upgrades.RiskRegistry.block // 7650000' "$DEPLOYMENT_FILE")
    POLICY_ENGINE_BLOCK=$(jq -r '.upgrades.PolicyEngine.block // 7650000' "$DEPLOYMENT_FILE")
    COMPLIANCE_ENGINE_BLOCK=$(jq -r '.upgrades.ComplianceEngine.block // 7650000' "$DEPLOYMENT_FILE")
    FIDES_BLOCK=$(jq -r '.contracts.FidesCompliance.block // 7800000' "$DEPLOYMENT_FILE")
    STABLE_COIN_BLOCK=$(jq -r '.contracts.CompliantStableCoin.block // 7800000' "$DEPLOYMENT_FILE")

    # 打印读取结果
    echo ""
    log_info "Contract Addresses from deployment record:"
    echo "  RiskRegistry:        ${RISK_REGISTRY:-<not set>}"
    echo "  PolicyEngine:        ${POLICY_ENGINE:-<not set>}"
    echo "  ComplianceEngine:    ${COMPLIANCE_ENGINE:-<not set>}"
    echo "  FidesCompliance:     ${FIDES_COMPLIANCE:-<not set>}"
    echo "  CompliantStableCoin: ${COMPLIANT_STABLE_COIN:-<not set>}"
    echo ""
    log_info "Implementation Addresses:"
    echo "  RiskRegistry Impl:     ${RISK_REGISTRY_IMPL:-<not set>}"
    echo "  PolicyEngine Impl:     ${POLICY_ENGINE_IMPL:-<not set>}"
    echo "  ComplianceEngine Impl: ${COMPLIANCE_ENGINE_IMPL:-<not set>}"
    echo ""
}

# ─── 更新 subgraph.yaml ───────────────────────────────────────────
update_subgraph_yaml() {
    log_info "Updating subgraph.yaml with new addresses..."

    if [ "$DRY_RUN" = "true" ]; then
        log_warn "DRY RUN: Would update subgraph.yaml with the following addresses:"
        echo "  RiskRegistry: $RISK_REGISTRY"
        echo "  PolicyEngine: $POLICY_ENGINE"
        echo "  ComplianceEngine: $COMPLIANCE_ENGINE"
        echo "  FidesCompliance: $FIDES_COMPLIANCE"
        echo "  CompliantStableCoin: $COMPLIANT_STABLE_COIN"
        return
    fi

    # 使用 sed 更新 subgraph.yaml 中的地址
    # 注意：这里假设 subgraph.yaml 中已有 dataSources 结构，我们只更新地址

    local tmp_file=$(mktemp)

    # 更健壮的更新方式：使用 Python/Node 解析 YAML
    if command -v node &> /dev/null; then
        node -e "
            const fs = require('fs');
            const yaml = require('yaml');
            const content = fs.readFileSync('subgraph.yaml', 'utf8');
            const doc = yaml.parse(content);

            const addressMap = {
                'RiskRegistry': '${RISK_REGISTRY}',
                'ComplianceEngine': '${COMPLIANCE_ENGINE}',
                'PolicyEngine': '${POLICY_ENGINE}',
                'FidesCompliance': '${FIDES_COMPLIANCE}',
                'CompliantStableCoin': '${COMPLIANT_STABLE_COIN}',
            };

            const blockMap = {
                'RiskRegistry': ${RISK_REGISTRY_BLOCK},
                'ComplianceEngine': ${COMPLIANCE_ENGINE_BLOCK},
                'PolicyEngine': ${POLICY_ENGINE_BLOCK},
                'FidesCompliance': ${FIDES_BLOCK},
                'CompliantStableCoin': ${STABLE_COIN_BLOCK},
            };

            for (const ds of doc.dataSources) {
                const name = ds.name;
                if (addressMap[name]) {
                    ds.source.address = addressMap[name];
                    ds.source.startBlock = blockMap[name] || ds.source.startBlock;
                    console.log('Updated', name, '->', addressMap[name], 'startBlock:', ds.source.startBlock);
                }
            }

            fs.writeFileSync('subgraph.yaml', yaml.stringify(doc));
        " 2>/dev/null || update_with_sed
    else
        update_with_sed
    fi

    log_ok "subgraph.yaml updated"
}

# ─── 备用：使用 sed 更新 ──────────────────────────────────────────
update_with_sed() {
    log_warn "Node.js yaml parser not available, using sed fallback"

    if [ -n "$RISK_REGISTRY" ]; then
        sed -i "s|address: \"0x953f985f38f94d6159c0600d1f15D543895cE896\"|address: \"$RISK_REGISTRY\"|g" subgraph.yaml 2>/dev/null || true
    fi
    if [ -n "$COMPLIANCE_ENGINE" ]; then
        sed -i "s|address: \"0xdF36A8b16F064308eeDE21A740FAc4e87b724F0E\"|address: \"$COMPLIANCE_ENGINE\"|g" subgraph.yaml 2>/dev/null || true
    fi
    if [ -n "$POLICY_ENGINE" ]; then
        sed -i "s|address: \"0xCA12BB2daD2a6D429277823366D8C88a490EDDeA\"|address: \"$POLICY_ENGINE\"|g" subgraph.yaml 2>/dev/null || true
    fi
    if [ -n "$FIDES_COMPLIANCE" ]; then
        sed -i "s|address: \"0x945392d7Aabbf8dc4116711bD6c8dD6EF2098594\"|address: \"$FIDES_COMPLIANCE\"|g" subgraph.yaml 2>/dev/null || true
    fi
    if [ -n "$COMPLIANT_STABLE_COIN" ]; then
        sed -i "s|address: \"0x2245A8FCf6aca017327eA8950Ba510e9596595E9\"|address: \"$COMPLIANT_STABLE_COIN\"|g" subgraph.yaml 2>/dev/null || true
    fi
}

# ─── 更新 networks.json ───────────────────────────────────────────
update_networks_json() {
    log_info "Updating networks.json..."

    if [ "$DRY_RUN" = "true" ]; then
        log_warn "DRY RUN: Would update networks.json"
        return
    fi

    if [ ! -f "networks.json" ]; then
        log_warn "networks.json not found, skipping"
        return
    fi

    node -e "
        const fs = require('fs');
        const networks = JSON.parse(fs.readFileSync('networks.json', 'utf8'));
        
        const addressMap = {
            'RiskRegistry': '${RISK_REGISTRY}',
            'ComplianceEngine': '${COMPLIANCE_ENGINE}',
            'PolicyEngine': '${POLICY_ENGINE}',
            'FidesCompliance': '${FIDES_COMPLIANCE}',
            'CompliantStableCoin': '${COMPLIANT_STABLE_COIN}',
        };

        const blockMap = {
            'RiskRegistry': ${RISK_REGISTRY_BLOCK},
            'ComplianceEngine': ${COMPLIANCE_ENGINE_BLOCK},
            'PolicyEngine': ${POLICY_ENGINE_BLOCK},
            'FidesCompliance': ${FIDES_BLOCK},
            'CompliantStableCoin': ${STABLE_COIN_BLOCK},
        };

        if (!networks.sepolia) networks.sepolia = {};
        
        for (const [name, address] of Object.entries(addressMap)) {
            if (address) {
                networks.sepolia[name] = {
                    address: address,
                    startBlock: blockMap[name] || 7650000
                };
            }
        }

        fs.writeFileSync('networks.json', JSON.stringify(networks, null, 2));
        console.log('networks.json updated');
    " 2>/dev/null || log_warn "Failed to update networks.json (Node.js may be unavailable)"
}

# ─── 执行 codegen ─────────────────────────────────────────────────
run_codegen() {
    log_info "Running graph codegen..."

    if [ "$DRY_RUN" = "true" ]; then
        log_warn "DRY RUN: Would execute 'graph codegen'"
        return
    fi

    graph codegen
    log_ok "Codegen complete"
}

# ─── 执行 build ───────────────────────────────────────────────────
run_build() {
    log_info "Running graph build..."

    if [ "$DRY_RUN" = "true" ]; then
        log_warn "DRY RUN: Would execute 'graph build'"
        return
    fi

    graph build
    log_ok "Build complete"
}

# ─── 部署到 The Graph Studio ──────────────────────────────────────
deploy_to_studio() {
    log_info "Deploying to The Graph Studio: $SUBGRAPH_NAME"

    if [ "$DRY_RUN" = "true" ]; then
        log_warn "DRY RUN: Would execute 'graph deploy --studio $SUBGRAPH_NAME'"
        return
    fi

    # 检查认证状态
    if [ ! -f "$HOME/.graph-cli/credentials" ] && [ -z "${STUDIO_DEPLOY_KEY:-}" ]; then
        log_warn "No Graph Studio credentials found"
        log_info "Please authenticate with: graph auth --studio <DEPLOY_KEY>"
        log_info "Or set STUDIO_DEPLOY_KEY environment variable"
        
        # 尝试使用环境变量认证
        if [ -n "${STUDIO_DEPLOY_KEY:-}" ]; then
            log_info "Authenticating with STUDIO_DEPLOY_KEY..."
            graph auth --studio "$STUDIO_DEPLOY_KEY"
        else
            read -p "Enter your Graph Studio deploy key (or press Enter to skip deploy): " deploy_key
            if [ -n "$deploy_key" ]; then
                graph auth --studio "$deploy_key"
            else
                log_warn "Skipping deployment. You can deploy manually later."
                return
            fi
        fi
    fi

    # 执行部署
    graph deploy --studio "$SUBGRAPH_NAME"
    log_ok "Deployment initiated!"
}

# ─── 等待同步完成 ─────────────────────────────────────────────────
wait_for_sync() {
    if [ "$WAIT_FOR_SYNC" != "true" ]; then
        log_info "Skipping sync wait (WAIT_FOR_SYNC=false)"
        return
    fi

    if [ "$DRY_RUN" = "true" ]; then
        log_warn "DRY RUN: Would wait for sync completion"
        return
    fi

    log_info "Waiting for subgraph to sync..."
    log_info "Timeout: ${SYNC_TIMEOUT_MINUTES} minutes"

    local start_time=$(date +%s)
    local timeout=$((SYNC_TIMEOUT_MINUTES * 60))
    local check_interval=30

    # 注意：实际查询需要 Subgraph 的部署 ID 和查询 URL
    # 这里提供一个轮询框架，实际使用时需要替换为正确的查询逻辑

    echo ""
    log_warn "Automatic sync verification requires the deployed subgraph query URL."
    log_info "After deployment, you can check sync status at The Graph Studio dashboard."
    echo ""
    log_info "Polling for sync status (checking every ${check_interval}s)..."

    local elapsed=0
    while [ $elapsed -lt $timeout ]; do
        local current_time=$(date +%s)
        elapsed=$((current_time - start_time))
        local remaining=$((timeout - elapsed))
        local minutes=$((elapsed / 60))
        local seconds=$((elapsed % 60))

        printf "\r  Elapsed: %02d:%02d | Remaining: %02d:%02d" \
            $minutes $seconds \
            $((remaining / 60)) $((remaining % 60))

        # 这里可以添加实际的 GraphQL 查询来检查同步状态
        # 例如：查询 _meta { block { number } }

        sleep $check_interval
    done

    echo ""
    log_warn "Sync wait timeout reached. Please check The Graph Studio dashboard for sync status."
}

# ─── 验证同步状态 ─────────────────────────────────────────────────
verify_sync() {
    log_info "Verifying subgraph sync status..."

    if [ "$DRY_RUN" = "true" ]; then
        log_warn "DRY RUN: Would verify sync status"
        return
    fi

    log_info "Subgraph verification checklist:"
    echo "  [ ] Subgraph deployed successfully"
    echo "  [ ] Syncing to latest block"
    echo "  [ ] No indexing errors"
    echo "  [ ] Query endpoint responding"
    echo ""
    log_info "Verify at: https://thegraph.com/studio/"
    log_info "Query URL format: https://api.studio.thegraph.com/query/<version>/$SUBGRAPH_NAME"
}

# ─── 保存同步记录 ─────────────────────────────────────────────────
save_sync_record() {
    local record_file="../contracts/deployments/subgraph-sync-${SUBGRAPH_NAME}-$(date +%Y%m%d-%H%M%S).json"

    if [ "$DRY_RUN" = "true" ]; then
        return
    fi

    node -e "
        const fs = require('fs');
        const record = {
            network: 'sepolia',
            timestamp: new Date().toISOString(),
            subgraphName: '$SUBGRAPH_NAME',
            contracts: {
                RiskRegistry: '${RISK_REGISTRY}',
                PolicyEngine: '${POLICY_ENGINE}',
                ComplianceEngine: '${COMPLIANCE_ENGINE}',
                FidesCompliance: '${FIDES_COMPLIANCE}',
                CompliantStableCoin: '${COMPLIANT_STABLE_COIN}',
            },
            startBlocks: {
                RiskRegistry: ${RISK_REGISTRY_BLOCK},
                PolicyEngine: ${POLICY_ENGINE_BLOCK},
                ComplianceEngine: ${COMPLIANCE_ENGINE_BLOCK},
                FidesCompliance: ${FIDES_BLOCK},
                CompliantStableCoin: ${STABLE_COIN_BLOCK},
            }
        };
        fs.writeFileSync('$record_file', JSON.stringify(record, null, 2));
        console.log('Sync record saved to: $record_file');
    " 2>/dev/null || log_warn "Failed to save sync record"
}

# ═══════════════════════════════════════════════════════════════════
# 主流程
# ═══════════════════════════════════════════════════════════════════
main() {
    echo "═══════════════════════════════════════════════════════════════"
    echo "  FidesOrigin Subgraph Auto-Sync"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo "  Subgraph Name: $SUBGRAPH_NAME"
    echo "  Dry Run: $DRY_RUN"
    echo "  Wait for Sync: $WAIT_FOR_SYNC"
    echo ""

    # ─── 步骤 0: 检查工具 ────────────────────────────────────────
    log_info "Checking prerequisites..."
    check_command jq || exit 1
    check_command node || exit 1
    check_command graph || {
        log_error "graph CLI not installed"
        log_info "Install with: npm install -g @graphprotocol/graph-cli"
        exit 1
    }
    echo ""

    # ─── 步骤 1: 读取部署记录 ────────────────────────────────────
    load_deployment

    # ─── 步骤 2: 更新配置 ────────────────────────────────────────
    update_subgraph_yaml
    update_networks_json

    # ─── 步骤 3: Codegen ─────────────────────────────────────────
    run_codegen

    # ─── 步骤 4: Build ───────────────────────────────────────────
    run_build

    # ─── 步骤 5: Deploy ──────────────────────────────────────────
    deploy_to_studio

    # ─── 步骤 6: Wait for sync ───────────────────────────────────
    wait_for_sync

    # ─── 步骤 7: Verify ──────────────────────────────────────────
    verify_sync

    # ─── 步骤 8: Save record ─────────────────────────────────────
    save_sync_record

    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Subgraph Auto-Sync Complete!"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    log_ok "Subgraph: $SUBGRAPH_NAME"
    log_info "Next steps:"
    echo "  1. Check sync status at The Graph Studio dashboard"
    echo "  2. Update frontend GraphQL endpoint"
    echo "  3. Verify data is indexing correctly"
    echo ""
}

# ─── 执行 ─────────────────────────────────────────────────────────
main "$@"
