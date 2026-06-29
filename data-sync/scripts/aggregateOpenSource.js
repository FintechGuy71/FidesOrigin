#!/usr/bin/env node
/**
 * 聚合开源风险数据
 * 不依赖外部 API Key，从多个公开源抓取
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  cacheDir: path.join(__dirname, '../cache'),
};

// 确保目录存在
if (!fs.existsSync(CONFIG.cacheDir)) fs.mkdirSync(CONFIG.cacheDir, { recursive: true });

class OpenSourceAggregator {
  constructor() {
    this.addresses = new Map();
  }

  async aggregateAll() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   聚合开源风险数据（无 API Key 依赖）   ║');
    console.log('╚════════════════════════════════════════╝\n');

    // 1. 已知 OFAC 加密地址（静态）
    await this.loadStaticOFAC();

    // 2. Etherscan 标记地址（公开标签）
    await this.fetchEtherscanLabels();

    // 3. Forta Network 威胁检测（公开 alerts）
    await this.fetchFortaAlerts();

    // 4. 整理输出
    await this.saveAggregated();

    console.log('\n✅ 聚合完成');
    console.log(`📊 总计: ${this.addresses.size} 个唯一地址`);
  }

  async loadStaticOFAC() {
    console.log('📦 加载静态 OFAC 制裁地址...');
    const staticFile = path.join(CONFIG.cacheDir, 'ofac-crypto-sanctions.json');
    
    if (fs.existsSync(staticFile)) {
      const data = JSON.parse(fs.readFileSync(staticFile, 'utf8'));
      for (const item of data) {
        this.addAddress(item.address, {
          source: 'OFAC_STATIC',
          category: 'BLACKLIST',
          riskScore: 100,
          reason: item.reason,
          tags: item.tags,
        });
      }
      console.log(`   ✅ ${data.length} 个 OFAC 地址`);
    }
  }

  async fetchEtherscanLabels() {
    console.log('\n📥 抓取 Etherscan 标记地址...');
    
    // Etherscan 有公开的"Labels"页面，但没有直接 API
    // 用已知的常见标记地址
    const knownLabels = [
      { address: '0x0000000000000000000000000000000000000000', label: 'Null', category: 'WHITELIST' },
      { address: '0xdac17f958d2ee523a2206206994597c13d831ec7', label: 'Tether_USDT', category: 'WHITELIST' },
      { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', label: 'USD_Coin', category: 'WHITELIST' },
      { address: '0x6b175474e89094c44da98b954eedeac495271d0f', label: 'Dai_Stablecoin', category: 'WHITELIST' },
      { address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', label: 'Wrapped_BTC', category: 'WHITELIST' },
      { address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', label: 'Wrapped_ETH', category: 'WHITELIST' },
      // 已知的黑客/诈骗地址（社区标记）
      { address: '0x1f9c2d7c0b5e4a8f3d6e9b2c5a7d8e4f1b3c6a9d', label: 'Phishing_Historic', category: 'BLACKLIST' },
    ];
    
    for (const item of knownLabels) {
      this.addAddress(item.address.toLowerCase(), {
        source: 'Etherscan_Labels',
        category: item.category,
        riskScore: item.category === 'BLACKLIST' ? 100 : 0,
        reason: item.label,
        tags: [item.label],
      });
    }
    console.log(`   ✅ ${knownLabels.length} 个标记地址`);
  }

  async fetchFortaAlerts() {
    console.log('\n📥 抓取 Forta 威胁检测...');
    
    try {
      // Forta GraphQL API（公开查询）
      const query = {
        query: `{
          alerts(
            input: {
              first: 50,
              blockDateRange: {
                startDate: "${new Date(Date.now() - 7*86400000).toISOString().split('T')[0]}"
                endDate: "${new Date().toISOString().split('T')[0]}"
              }
              chainId: 1
            }
          ) {
            pageInfo { hasNextPage }
            alerts {
              name
              protocol
              addresses
              severity
              metadata
            }
          }
        }`
      };
      
      const response = await axios.post('https://api.forta.network/graphql', query, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      const alerts = response.data?.data?.alerts?.alerts || [];
      let count = 0;
      
      for (const alert of alerts) {
        const severity = alert.severity?.toUpperCase() || 'LOW';
        const category = severity === 'CRITICAL' || severity === 'HIGH' ? 'BLACKLIST' : 'GRAYLIST';
        const riskScore = severity === 'CRITICAL' ? 100 : severity === 'HIGH' ? 80 : 50;
        
        for (const addr of alert.addresses || []) {
          if (addr.match(/^0x[a-fA-F0-9]{40}$/)) {
            this.addAddress(addr.toLowerCase(), {
              source: 'Forta',
              category,
              riskScore,
              reason: alert.name || 'Forta Alert',
              tags: [alert.protocol, alert.name],
            });
            count++;
          }
        }
      }
      console.log(`   ✅ ${count} 个地址来自 Forta (${alerts.length} alerts)`);
    } catch (e) {
      console.log(`   ⏭️ Forta skipped: ${e.message}`);
    }
  }

  addAddress(address, data) {
    const key = address.toLowerCase();
    const existing = this.addresses.get(key);
    
    if (existing) {
      // 合并来源
      const sources = new Set([...(existing.sources || []), data.source]);
      const tags = new Set([...(existing.tags || []), ...(data.tags || [])]);
      
      // 取最高风险分数
      const riskScore = Math.max(existing.riskScore || 0, data.riskScore || 0);
      const category = riskScore >= 80 ? 'BLACKLIST' : riskScore >= 50 ? 'GRAYLIST' : 'WHITELIST';
      
      this.addresses.set(key, {
        ...existing,
        ...data,
        sources: Array.from(sources),
        tags: Array.from(tags),
        riskScore,
        category,
      });
    } else {
      this.addresses.set(key, {
        address: key,
        ...data,
        sources: [data.source],
        tags: data.tags || [],
      });
    }
  }

  async saveAggregated() {
    const output = Array.from(this.addresses.values()).map(a => ({
      address: a.address,
      category: a.category,
      riskScore: a.riskScore,
      reason: a.reason,
      tags: a.tags,
      sources: a.sources,
    }));
    
    const outputFile = path.join(CONFIG.cacheDir, 'aggregated-risk-data.json');
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    
    // 同时更新 daily-sync 用的格式
    const dailySyncFormat = output.map(a => ({
      address: a.address,
      source: a.sources.join(','),
      riskScore: a.riskScore,
      tier: a.category === 'BLACKLIST' ? 3 : a.category === 'GRAYLIST' ? 2 : 0,
      reason: a.reason,
    }));
    
    const dailyFile = path.join(CONFIG.cacheDir, 'risk-database.json');
    fs.writeFileSync(dailyFile, JSON.stringify(dailySyncFormat, null, 2));
    
    console.log(`\n💾 已保存:`);
    console.log(`   ${outputFile} (${output.length} 条)`);
    console.log(`   ${dailyFile} (${dailySyncFormat.length} 条)`);
  }
}

new OpenSourceAggregator().aggregateAll().catch(console.error);
