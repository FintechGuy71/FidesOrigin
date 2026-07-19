#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# FidesOrigin Subgraph 重新部署脚本
# ═══════════════════════════════════════════════════════════════════

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "  FidesOrigin Subgraph Redeploy — Sepolia"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# 检查 graph CLI
if ! command -v graph &> /dev/null; then
    echo "❌ graph CLI not found. Install with: npm install -g @graphprotocol/graph-cli"
    exit 1
fi

# 检查部署记录
DEPLOYMENT_FILE="../deployments/sepolia-latest.json"
if [ ! -f "$DEPLOYMENT_FILE" ]; then
    echo "❌ Deployment record not found: $DEPLOYMENT_FILE"
    echo "   Please deploy contracts first."
    exit 1
fi

echo "━━━ Step 1: Update subgraph.yaml with new addresses ━━━"
echo ""

# 读取新地址
RISK_REGISTRY=$(jq -r '.upgrades.RiskRegistry.newImpl // .contracts.RiskRegistry.address' "$DEPLOYMENT_FILE")
POLICY_ENGINE=$(jq -r '.upgrades.PolicyEngine.newImpl // .contracts.PolicyEngine.address' "$DEPLOYMENT_FILE")
COMPLIANCE_ENGINE=$(jq -r '.upgrades.ComplianceEngine.newImpl // .contracts.ComplianceEngine.address' "$DEPLOYMENT_FILE")
QUARANTINE_VAULT=$(jq -r '.contracts.QuarantineVault.address // "0x497176b21CC2EDd90a8725a3023742358311a382"' "$DEPLOYMENT_FILE")

echo "RiskRegistry: $RISK_REGISTRY"
echo "PolicyEngine: $POLICY_ENGINE"
echo "ComplianceEngine: $COMPLIANCE_ENGINE"
echo "QuarantineVault: $QUARANTINE_VAULT"
echo ""

# 更新 subgraph.yaml
sed -i "s/address: \".*RiskRegistry.*\"/address: \"$RISK_REGISTRY\"/g" subgraph.yaml
sed -i "s/address: \".*PolicyEngine.*\"/address: \"$POLICY_ENGINE\"/g" subgraph.yaml
sed -i "s/address: \".*ComplianceEngine.*\"/address: \"$COMPLIANCE_ENGINE\"/g" subgraph.yaml

echo "✅ subgraph.yaml updated"
echo ""

echo "━━━ Step 2: Codegen & Build ━━━"
echo ""

graph codegen
echo "✅ Codegen complete"
echo ""

graph build
echo "✅ Build complete"
echo ""

echo "━━━ Step 3: Deploy to The Graph Studio ━━━"
echo ""
echo "⚠️  You need to authenticate first:"
echo "   graph auth --studio <DEPLOY_KEY>"
echo ""
echo "Then deploy:"
echo "   graph deploy --studio fidesorigin-sepolia"
echo ""

# 自动部署（如果已认证）
if [ -f "$HOME/.graph-cli/credentials" ]; then
    echo "Detected existing auth. Attempting deploy..."
    graph deploy --studio fidesorigin-sepolia
else
    echo "Please authenticate and deploy manually:"
    echo "  1. graph auth --studio <YOUR_DEPLOY_KEY>"
    echo "  2. graph deploy --studio fidesorigin-sepolia"
fi

echo ""
echo "✅ Subgraph deployment initiated!"
echo "   Query URL will be available at The Graph Studio dashboard."
