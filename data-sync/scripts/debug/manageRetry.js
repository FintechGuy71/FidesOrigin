#!/usr/bin/env node

/**
 * Etherscan API 重试管理器
 * 设置和管理重试任务
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const RETRY_MARKER = '/root/.openclaw/workspace/fidesorigin-demo/data-sync/logs/etherscan_retry_active';
const CRON_COMMENT = 'ETHERSCAN_RETRY';

async function setupRetry() {
  console.log('🔧 设置 Etherscan API 持续重试...\n');
  
  // 计算明天6点的时间戳
  const now = new Date();
  const tomorrow6AM = new Date(now);
  tomorrow6AM.setDate(tomorrow6AM.getDate() + 1);
  tomorrow6AM.setHours(6, 0, 0, 0);
  
  const endTimestamp = Math.floor(tomorrow6AM.getTime() / 1000);
  
  console.log(`当前时间: ${now.toLocaleString('zh-CN')}`);
  console.log(`重试截止时间: ${tomorrow6AM.toLocaleString('zh-CN')}`);
  console.log(`时间戳: ${endTimestamp}\n`);
  
  // 写入标记文件
  fs.mkdirSync(path.dirname(RETRY_MARKER), { recursive: true });
  fs.writeFileSync(RETRY_MARKER, endTimestamp.toString());
  
  // 创建cron任务（每小时运行一次）
  const scriptPath = '/root/.openclaw/workspace/fidesorigin-demo/data-sync/scripts/retryEtherscan.sh';
  const cronJob = `0 * * * * ${scriptPath} # ${CRON_COMMENT}`;
  
  try {
    // 检查是否已有cron任务
    const { stdout: currentCrontab } = await execPromise('crontab -l 2>/dev/null || echo ""');
    
    if (currentCrontab.includes(CRON_COMMENT)) {
      console.log('⚠️  重试任务已存在，更新配置...\n');
      // 移除旧任务
      const newCrontab = currentCrontab
        .split('\n')
        .filter(line => !line.includes(CRON_COMMENT))
        .join('\n');
      
      await execPromise(`echo "${newCrontab}" | crontab -`);
    }
    
    // 添加新任务
    const newCrontab = currentCrontab.trim() + '\n' + cronJob + '\n';
    await execPromise(`echo "${newCrontab}" | crontab -`);
    
    console.log('✅ Cron任务已设置:');
    console.log(`   命令: ${cronJob}\n`);
    
    // 立即运行一次测试
    console.log('🚀 立即运行首次测试...\n');
    try {
      const { stdout, stderr } = await execPromise(`cd /root/.openclaw/workspace/fidesorigin-demo/data-sync && node scripts/testEtherscanSimple.js 2>&1`);
      console.log('测试输出:', stdout);
      if (stderr) console.error('测试错误:', stderr);
    } catch (e) {
      console.log('首次测试失败（预期内），将继续重试\n');
    }
    
    console.log('╔════════════════════════════════════════╗');
    console.log('║        重试机制已激活                  ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    console.log('📋 重试计划:');
    console.log(`   • 频率: 每小时一次`);
    console.log(`   • 截止: 明天 ${tomorrow6AM.getHours()}:00`);
    console.log(`   • 日志: logs/etherscan_retry.log`);
    console.log(`   • 状态: 运行中\n`);
    
    console.log('✅ 设置完成！如果明天6点前API恢复，数据将自动更新。');
    console.log('   届时我会通知你。\n');
    
  } catch (error) {
    console.error('❌ 设置失败:', error.message);
  }
}

async function checkStatus() {
  console.log('📊 检查重试状态...\n');
  
  try {
    // 检查标记文件
    if (fs.existsSync(RETRY_MARKER)) {
      const endTime = parseInt(fs.readFileSync(RETRY_MARKER, 'utf8'));
      const now = Math.floor(Date.now() / 1000);
      const remaining = endTime - now;
      
      if (remaining > 0) {
        const hours = Math.floor(remaining / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        console.log(`⏰ 重试进行中，剩余时间: ${hours}小时${minutes}分钟`);
      } else {
        console.log('⏰ 重试时间已结束');
      }
    } else {
      console.log('⏸️  重试未启动');
    }
    
    // 检查日志
    const logFile = '/root/.openclaw/workspace/fidesorigin-demo/data-sync/logs/etherscan_retry.log';
    if (fs.existsSync(logFile)) {
      const stats = fs.statSync(logFile);
      console.log(`📝 日志文件: ${(stats.size / 1024).toFixed(1)} KB`);
      
      // 显示最后几行
      const { stdout } = await execPromise(`tail -10 "${logFile}"`);
      console.log('\n📄 最近日志:');
      console.log(stdout);
    }
    
  } catch (error) {
    console.error('检查失败:', error.message);
  }
}

// 主函数
const command = process.argv[2];

if (command === 'status') {
  checkStatus();
} else {
  setupRetry();
}
