#!/bin/bash
# FidesOrigin Data Publisher — 安全启动脚本
# 支持从多种密码管理器读取私钥，绝不硬编码
# 
# Usage:
#   ./start.sh                    # 自动检测密码管理器
#   ./start.sh --env              # 从环境变量读取
#   ./start.sh --1password        # 从 1Password CLI 读取
#   ./start.sh --keychain         # 从 macOS Keychain 读取
#   ./start.sh --pass             # 从 pass (Unix 密码管理器) 读取
#   ./start.sh --bitwarden        # 从 Bitwarden CLI 读取
#   ./start.sh --file <path>      # 从指定文件读取（仅用于测试，不推荐）

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="fidesorigin-data-publisher"

echo "═══════════════════════════════════════════════════════"
echo "  FidesOrigin Data Publisher — Secure Startup"
echo "═══════════════════════════════════════════════════════"

# ============================================
# 检测钱包地址（用于验证私钥正确性）
# ============================================
EXPECTED_ADDRESS="0x5F6Ae278e7a62E64F9F467a91B693f372b84a374"

# ============================================
# 帮助信息
# ============================================
show_help() {
    cat <<EOF
用法: ./start.sh [选项]

选项:
  --env              从 PUBLISHER_PRIVATE_KEY 环境变量读取
  --1password        从 1Password CLI 读取 (op://vault/item/field)
  --keychain         从 macOS Keychain 读取
  --pass             从 pass (Unix 密码管理器) 读取
  --bitwarden        从 Bitwarden CLI 读取
  --file <path>      从指定文件读取（不推荐用于生产）
  --help             显示此帮助

环境变量:
  PUBLISHER_PRIVATE_KEY    私钥（仅在 --env 模式下使用）
  ONEPASSWORD_ITEM         1Password 项路径 (如: "op://FidesOrigin/publisher/private-key")
  KEYCHAIN_SERVICE         macOS Keychain service 名称
  PASS_PATH                pass 存储路径 (如: "fintech/fidesorigin/publisher")
  BITWARDEN_ITEM           Bitwarden 项名称
  DRY_RUN                  是否启用干运行模式 (默认: true)

示例:
  ./start.sh --env                          # 从环境变量启动
  ONEPASSWORD_ITEM="op://Dev/fidesorigin/key" ./start.sh --1password
  ./start.sh --pass                         # 从 pass 读取
EOF
}

# ============================================
# 验证私钥并导出地址
# ============================================
verify_key() {
    local key="$1"
    local source="$2"
    
    echo "验证私钥来源: $source..."
    
    # 使用 Node.js 验证私钥并获取地址
    local address
    address=$(cd "$SCRIPT_DIR" && node -e "
        const { Wallet } = require('ethers');
        try {
            const w = new Wallet('$key');
            console.log(w.address);
        } catch (e) {
            console.error('Invalid private key');
            process.exit(1);
        }
    " 2>&1)
    
    if [ $? -ne 0 ]; then
        echo "❌ 私钥验证失败"
        return 1
    fi
    
    echo "  钱包地址: $address"
    
    # 验证是否匹配预期地址
    if [ "$address" != "$EXPECTED_ADDRESS" ]; then
        echo "⚠️  警告: 钱包地址不匹配!"
        echo "  预期: $EXPECTED_ADDRESS"
        echo "  实际: $address"
        echo ""
        read -p "是否继续? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    echo "✅ 私钥验证通过"
    export PUBLISHER_ADDRESS="$address"
    return 0
}

# ============================================
# 从环境变量读取
# ============================================
load_from_env() {
    if [ -z "${PUBLISHER_PRIVATE_KEY:-}" ]; then
        echo "❌ PUBLISHER_PRIVATE_KEY 环境变量未设置"
        echo "  export PUBLISHER_PRIVATE_KEY=0x..."
        exit 1
    fi
    
    verify_key "$PUBLISHER_PRIVATE_KEY" "环境变量"
}

# ============================================
# 从 1Password 读取
# ============================================
load_from_1password() {
    if ! command -v op &> /dev/null; then
        echo "❌ 1Password CLI (op) 未安装"
        echo "  安装: https://developer.1password.com/docs/cli/get-started/"
        exit 1
    fi
    
    if [ -z "${ONEPASSWORD_ITEM:-}" ]; then
        echo "❌ ONEPASSWORD_ITEM 环境变量未设置"
        echo "  例如: export ONEPASSWORD_ITEM='op://vault/item/field'"
        exit 1
    fi
    
    echo "从 1Password 读取私钥..."
    local key
    key=$(op read "$ONEPASSWORD_ITEM" 2>&1)
    
    if [ $? -ne 0 ]; then
        echo "❌ 从 1Password 读取失败: $key"
        exit 1
    fi
    
    verify_key "$key" "1Password"
    export PUBLISHER_PRIVATE_KEY="$key"
}

# ============================================
# 从 macOS Keychain 读取
# ============================================
load_from_keychain() {
    if ! command -v security &> /dev/null; then
        echo "❌ security 命令不可用（仅 macOS）"
        exit 1
    fi
    
    local service="${KEYCHAIN_SERVICE:-fidesorigin-publisher}"
    echo "从 Keychain 读取私钥 (service: $service)..."
    
    local key
    key=$(security find-generic-password -s "$service" -w 2>&1)
    
    if [ $? -ne 0 ]; then
        echo "❌ 从 Keychain 读取失败"
        echo "  请先添加私钥: security add-generic-password -s '$service' -a 'publisher' -w '0x...'"
        exit 1
    fi
    
    verify_key "$key" "macOS Keychain"
    export PUBLISHER_PRIVATE_KEY="$key"
}

# ============================================
# 从 pass (Unix 密码管理器) 读取
# ============================================
load_from_pass() {
    if ! command -v pass &> /dev/null; then
        echo "❌ pass 未安装"
        echo "  安装: https://www.passwordstore.org/"
        exit 1
    fi
    
    if [ -z "${PASS_PATH:-}" ]; then
        echo "❌ PASS_PATH 环境变量未设置"
        echo "  例如: export PASS_PATH='fintech/fidesorigin/publisher'"
        exit 1
    fi
    
    echo "从 pass 读取私钥 (path: $PASS_PATH)..."
    local key
    key=$(pass "$PASS_PATH" 2>&1)
    
    if [ $? -ne 0 ]; then
        echo "❌ 从 pass 读取失败"
        echo "  请先添加: pass insert $PASS_PATH"
        exit 1
    fi
    
    verify_key "$key" "pass"
    export PUBLISHER_PRIVATE_KEY="$key"
}

# ============================================
# 从 Bitwarden CLI 读取
# ============================================
load_from_bitwarden() {
    if ! command -v bw &> /dev/null; then
        echo "❌ Bitwarden CLI (bw) 未安装"
        echo "  安装: https://bitwarden.com/help/cli/"
        exit 1
    fi
    
    if [ -z "${BITWARDEN_ITEM:-}" ]; then
        echo "❌ BITWARDEN_ITEM 环境变量未设置"
        echo "  例如: export BITWARDEN_ITEM='fidesorigin-publisher'"
        exit 1
    fi
    
    echo "从 Bitwarden 读取私钥 (item: $BITWARDEN_ITEM)..."
    
    # Check if logged in
    bw status | grep -q "unlocked" || {
        echo "  Bitwarden 未解锁，尝试解锁..."
        bw unlock
    }
    
    local key
    key=$(bw get password "$BITWARDEN_ITEM" 2>&1)
    
    if [ $? -ne 0 ]; then
        echo "❌ 从 Bitwarden 读取失败: $key"
        exit 1
    fi
    
    verify_key "$key" "Bitwarden"
    export PUBLISHER_PRIVATE_KEY="$key"
}

# ============================================
# 从文件读取（不推荐生产环境）
# ============================================
load_from_file() {
    local filepath="${1:-}"
    
    if [ -z "$filepath" ]; then
        echo "❌ 请提供文件路径: --file /path/to/key"
        exit 1
    fi
    
    if [ ! -f "$filepath" ]; then
        echo "❌ 文件不存在: $filepath"
        exit 1
    fi
    
    echo "从文件读取私钥 (文件会被删除)..."
    local key
    key=$(cat "$filepath")
    
    # 删除文件（安全考虑）
    shred -u "$filepath" 2>/dev/null || rm "$filepath"
    
    verify_key "$key" "文件"
    export PUBLISHER_PRIVATE_KEY="$key"
}

# ============================================
# 自动检测密码管理器
# ============================================
auto_detect() {
    echo "自动检测密码管理器..."
    
    if command -v op &> /dev/null && [ -n "${ONEPASSWORD_ITEM:-}" ]; then
        echo "  检测到 1Password"
        load_from_1password
        return
    fi
    
    if command -v bw &> /dev/null && [ -n "${BITWARDEN_ITEM:-}" ]; then
        echo "  检测到 Bitwarden"
        load_from_bitwarden
        return
    fi
    
    if command -v pass &> /dev/null && [ -n "${PASS_PATH:-}" ]; then
        echo "  检测到 pass"
        load_from_pass
        return
    fi
    
    if command -v security &> /dev/null && [ -n "${KEYCHAIN_SERVICE:-}" ]; then
        echo "  检测到 macOS Keychain"
        load_from_keychain
        return
    fi
    
    if [ -n "${PUBLISHER_PRIVATE_KEY:-}" ]; then
        echo "  检测到环境变量"
        load_from_env
        return
    fi
    
    echo "❌ 未检测到密码管理器配置"
    echo ""
    echo "可选方案:"
    echo "  1. 设置 PUBLISHER_PRIVATE_KEY 环境变量"
    echo "  2. 安装并配置 1Password CLI (op) + ONEPASSWORD_ITEM"
    echo "  3. 安装并配置 Bitwarden CLI (bw) + BITWARDEN_ITEM"
    echo "  4. 安装并配置 pass + PASS_PATH"
    echo "  5. macOS 用户: 配置 Keychain + KEYCHAIN_SERVICE"
    echo ""
    show_help
    exit 1
}

# ============================================
# 启动服务
# ============================================
start_service() {
    echo ""
    echo "═══════════════════════════════════════════════════════"
    echo "  启动 Data Publisher"
    echo "═══════════════════════════════════════════════════════"
    echo ""
    
    cd "$SCRIPT_DIR"
    
    # 设置默认 DRY_RUN
    local dry_run="${DRY_RUN:-true}"
    
    if [ "$dry_run" = "true" ]; then
        echo "⚠️  DRY RUN 模式 — 不会发送交易到链上"
        echo "  确认正常后运行: DRY_RUN=false ./start.sh"
    fi
    
    echo ""
    
    # 启动 Node.js 服务
    exec node dist/index.js
}

# ============================================
# 主逻辑
# ============================================
main() {
    case "${1:-}" in
        --env|-e)
            load_from_env
            ;;
        --1password|-1)
            load_from_1password
            ;;
        --keychain|-k)
            load_from_keychain
            ;;
        --pass|-p)
            load_from_pass
            ;;
        --bitwarden|-b)
            load_from_bitwarden
            ;;
        --file|-f)
            load_from_file "${2:-}"
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        "")
            auto_detect
            ;;
        *)
            echo "❌ 未知选项: $1"
            show_help
            exit 1
            ;;
    esac
    
    start_service
}

main "$@"
