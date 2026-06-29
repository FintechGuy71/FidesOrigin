#!/bin/bash

# Etherscan API 持续重试脚本
# 每小时尝试连接一次，记录结果

LOG_FILE="/root/.openclaw/workspace/fidesorigin-demo/data-sync/logs/etherscan_retry.log"
RETRY_MARKER="/root/.openclaw/workspace/fidesorigin-demo/data-sync/logs/etherscan_retry_active"

cd /root/.openclaw/workspace/fidesorigin-demo/data-sync

# 确保日志目录存在
mkdir -p logs

# 检查是否还在重试期间（明天6点前）
CURRENT_HOUR=$(date +%H)
CURRENT_MINUTE=$(date +%M)

# 如果已经超过明天6点，停止重试
if [ -f "$RETRY_MARKER" ]; then
  END_TIME=$(cat "$RETRY_MARKER")
  CURRENT_TIME=$(date +%s)
  
  if [ "$CURRENT_TIME" -gt "$END_TIME" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 重试时间结束，停止任务" >> "$LOG_FILE"
    exit 0
  fi
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始重试Etherscan API..." >> "$LOG_FILE"

# 运行API测试
node scripts/testEtherscanSimple.js >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ API连接成功！尝试抓取数据..." >> "$LOG_FILE"
  node scripts/fetchEtherscanData.js >> "$LOG_FILE" 2>&1
  
  # 如果成功，发送通知
  echo "Etherscan API连接成功！数据已更新。" | wall 2>/dev/null || true
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ 连接失败，将在下次重试" >> "$LOG_FILE"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 重试完成" >> "$LOG_FILE"
echo "---" >> "$LOG_FILE"
