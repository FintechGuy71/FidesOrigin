#!/bin/bash
# FidesOrigin 自动化数据同步脚本
# 每周自动更新地址库和 Merkle Tree
# Usage: ./scripts/auto-update.sh

set -e

WORKSPACE="/root/.openclaw/workspace/fidesorigin-demo"
LOG_FILE="$WORKSPACE/logs/auto-update-$(date +%Y%m%d-%H%M%S).log"
CACHE_DIR="$WORKSPACE/data-sync/cache"

echo "========================================" | tee -a "$LOG_FILE"
echo "FidesOrigin Auto-Update: $(date)" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"

mkdir -p "$WORKSPACE/logs"

# Step 1: Run data sync
echo "[1/5] Running data sync..." | tee -a "$LOG_FILE"
cd "$WORKSPACE"
if [ -f "data-sync/src/index.js" ]; then
    node data-sync/src/index.js 2>&1 | tee -a "$LOG_FILE"
    echo "✅ Data sync completed" | tee -a "$LOG_FILE"
else
    echo "⚠️  data-sync/src/index.js not found, skipping" | tee -a "$LOG_FILE"
fi

# Step 2: Check if new addresses were found
LATEST_JSON=$(ls -t $CACHE_DIR/address-labels-v*.json 2>/dev/null | head -1)
if [ -z "$LATEST_JSON" ]; then
    echo "❌ No address database found" | tee -a "$LOG_FILE"
    exit 1
fi

echo "[2/5] Latest database: $(basename $LATEST_JSON)" | tee -a "$LOG_FILE"

# Step 3: Generate Merkle Tree
echo "[3/5] Generating Merkle Tree..." | tee -a "$LOG_FILE"
node -e "
const fs = require('fs');
const { StandardMerkleTree } = require('@openzeppelin/merkle-tree');

const db = JSON.parse(fs.readFileSync('$LATEST_JSON', 'utf8'));
console.log('Loaded', db.addressLabels.length, 'addresses');

const values = db.addressLabels.map(e => [e.address, e.riskScore || 50, e.riskTier || 'GREY']);
const tree = StandardMerkleTree.of(values, ['address', 'uint256', 'string']);

console.log('Merkle Root:', tree.root);
console.log('Leaves:', values.length);

const version = '$(date +%Y%m%d-%H%M%S)';
fs.writeFileSync('$CACHE_DIR/merkle-tree-latest.json', JSON.stringify(tree.dump(), null, 2));
fs.writeFileSync('$CACHE_DIR/merkle-root-latest.txt', tree.root);
fs.writeFileSync('$CACHE_DIR/auto-update-' + version + '.json', JSON.stringify({
    version: version,
    root: tree.root,
    leaves: values.length,
    timestamp: new Date().toISOString()
}, null, 2));

console.log('✅ Merkle Tree saved');
" 2>&1 | tee -a "$LOG_FILE"

# Step 4: Backup old files
echo "[4/5] Creating backup..." | tee -a "$LOG_FILE"
cp "$LATEST_JSON" "$CACHE_DIR/backup-$(date +%Y%m%d).json" 2>/dev/null || true
cp "$CACHE_DIR/merkle-tree-latest.json" "$CACHE_DIR/merkle-tree-backup-$(date +%Y%m%d).json" 2>/dev/null || true
echo "✅ Backup created" | tee -a "$LOG_FILE"

# Step 5: Summary
echo "[5/5] Update Summary:" | tee -a "$LOG_FILE"
echo "  Database: $(basename $LATEST_JSON)" | tee -a "$LOG_FILE"
if [ -f "$CACHE_DIR/merkle-root-latest.txt" ]; then
    echo "  Merkle Root: $(cat $CACHE_DIR/merkle-root-latest.txt)" | tee -a "$LOG_FILE"
fi

# Send notification if configured
if [ -n "$DISCORD_WEBHOOK" ]; then
    curl -s -X POST "$DISCORD_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d "{\"content\":\"🔄 FidesOrigin Auto-Update Complete\\nMerkle Root: $(cat $CACHE_DIR/merkle-root-latest.txt 2>/dev/null || echo 'N/A')\\nTime: $(date)\"}" \
        > /dev/null 2>&1 || true
fi

echo "========================================" | tee -a "$LOG_FILE"
echo "✅ Auto-update completed at $(date)" | tee -a "$LOG_FILE"
echo "Log saved to: $LOG_FILE"
