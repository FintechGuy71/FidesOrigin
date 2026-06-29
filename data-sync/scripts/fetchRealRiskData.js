const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  cacheDir: path.join(__dirname, '../cache'),
};

if (!fs.existsSync(CONFIG.cacheDir)) fs.mkdirSync(CONFIG.cacheDir, { recursive: true });

class RealRiskDataAggregator {
  constructor() {
    this.addresses = new Map();
  }

  async aggregateAll() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   聚合真实风险数据（多公开源）          ║');
    console.log('╚════════════════════════════════════════╝\n');

    // 1. 已有的 OFAC 静态数据
    await this.loadStaticOFAC();

    // 2. PhishFort 黑名单（公开 API）
    await this.fetchPhishFort();

    // 3. CryptoScamDB（公开 API）
    await this.fetchCryptoScamDB();

    // 4. Etherscan 公开标签（有限）
    await this.loadEtherscanLabels();

    // 5. 保存
    await this.saveAll();

    const total = this.addresses.size;
    const bl = Array.from(this.addresses.values()).filter(a => a.category === 'BLACKLIST').length;
    const gl = Array.from(this.addresses.values()).filter(a => a.category === 'GRAYLIST').length;
    const wl = Array.from(this.addresses.values()).filter(a => a.category === 'WHITELIST').length;

    console.log('\n✅ 聚合完成');
    console.log(`📊 总计: ${total} 个唯一地址`);
    console.log(`   BLACKLIST: ${bl}`);
    console.log(`   GRAYLIST: ${gl}`);
    console.log(`   WHITELIST: ${wl}`);
  }

  async loadStaticOFAC() {
    const file = path.join(CONFIG.cacheDir, 'ofac-crypto-sanctions.json');
    if (!fs.existsSync(file)) return;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const item of data) {
      this.add(item.address, { source: 'OFAC_STATIC', category: 'BLACKLIST', riskScore: 100, reason: item.reason, tags: item.tags || ['OFAC'] });
    }
    console.log(`📦 OFAC static: ${data.length} addresses`);
  }

  async fetchPhishFort() {
    console.log('\n📥 PhishFort blacklist...');
    try {
      const res = await axios.get('https://api.phishfort.com/v1/blacklist', { timeout: 15000 });
      const items = res.data?.result || [];
      let count = 0;
      for (const item of items) {
        const addr = item.url?.replace(/^https?:\/\//, '').replace(/^www\./, '');
        if (addr && addr.match(/^0x[a-fA-F0-9]{40}$/i)) {
          this.add(addr.toLowerCase(), { source: 'PhishFort', category: 'BLACKLIST', riskScore: 95, reason: item.type || 'Phishing', tags: [item.type, 'PHISHING'] });
          count++;
        }
      }
      console.log(`   ✅ ${count} addresses`);
    } catch (e) {
      console.log(`   ⏭️ ${e.message}`);
    }
  }

  async fetchCryptoScamDB() {
    console.log('\n📥 CryptoScamDB...');
    try {
      const res = await axios.get('https://api.cryptoscamdb.org/v1/addresses', { timeout: 15000 });
      const addresses = res.data?.result || res.data?.addresses || [];
      let count = 0;
      for (const item of addresses) {
        const addr = item.address || item;
        if (typeof addr === 'string' && addr.match(/^0x[a-fA-F0-9]{40}$/i)) {
          this.add(addr.toLowerCase(), { source: 'CryptoScamDB', category: 'BLACKLIST', riskScore: 90, reason: item.category || 'Scam', tags: [item.category, 'SCAM'] });
          count++;
        }
      }
      console.log(`   ✅ ${count} addresses`);
    } catch (e) {
      console.log(`   ⏭️ ${e.message}`);
    }
  }

  async loadEtherscanLabels() {
    console.log('\n📥 Etherscan labels...');
    const labels = [
      { addr: '0xdac17f958d2ee523a2206206994597c13d831ec7', label: 'USDT', tags: ['STABLECOIN'] },
      { addr: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', label: 'USDC', tags: ['STABLECOIN'] },
      { addr: '0x6b175474e89094c44da98b954eedeac495271d0f', label: 'DAI', tags: ['STABLECOIN'] },
      { addr: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', label: 'WETH', tags: ['WRAPPED'] },
      { addr: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', label: 'WBTC', tags: ['WRAPPED'] },
      { addr: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', label: 'UNI', tags: ['DEX'] },
      { addr: '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9', label: 'AAVE', tags: ['LENDING'] },
      { addr: '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b', label: 'COMP', tags: ['LENDING'] },
      { addr: '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45', label: 'UniswapV3', tags: ['DEX', 'ROUTER'] },
      { addr: '0xe592427a0aece92de3edee1f18e0157c05861564', label: 'UniswapV3Pos', tags: ['DEX'] },
      { addr: '0x0000000000000000000000000000000000000000', label: 'Null', tags: ['NULL'] },
    ];
    for (const item of labels) {
      this.add(item.addr.toLowerCase(), { source: 'Etherscan_Labels', category: 'WHITELIST', riskScore: 0, reason: item.label, tags: item.tags });
    }
    console.log(`   ✅ ${labels.length} addresses`);
  }

  add(address, data) {
    const key = address.toLowerCase();
    const existing = this.addresses.get(key);
    if (existing) {
      const sources = new Set([...(existing.sources || []), data.source]);
      const tags = new Set([...(existing.tags || []), ...(data.tags || [])]);
      const riskScore = Math.max(existing.riskScore || 0, data.riskScore || 0);
      const category = riskScore >= 80 ? 'BLACKLIST' : riskScore >= 50 ? 'GRAYLIST' : 'WHITELIST';
      this.addresses.set(key, { ...existing, ...data, sources: Array.from(sources), tags: Array.from(tags), riskScore, category });
    } else {
      this.addresses.set(key, { address: key, ...data, sources: [data.source], tags: data.tags || [] });
    }
  }

  async saveAll() {
    const output = Array.from(this.addresses.values());
    fs.writeFileSync(path.join(CONFIG.cacheDir, 'aggregated-risk-data.json'), JSON.stringify(output, null, 2));
    
    const dailyFormat = output.map(a => ({ address: a.address, source: a.sources.join(','), riskScore: a.riskScore, tier: a.category === 'BLACKLIST' ? 3 : a.category === 'GRAYLIST' ? 2 : 0, reason: a.reason }));
    fs.writeFileSync(path.join(CONFIG.cacheDir, 'risk-database.json'), JSON.stringify(dailyFormat, null, 2));
    
    console.log(`\n💾 Saved: ${output.length} total`);
  }
}

new RealRiskDataAggregator().aggregateAll().catch(console.error);
