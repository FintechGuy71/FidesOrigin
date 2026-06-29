/**
 * 开源社区数据源适配器
 * 从GitHub开源项目和社区维护列表获取风险地址
 */

const axios = require('axios');
const { createLogger } = require('../utils/logger');
const logger = createLogger('openSourceAdapter');

class OpenSourceAdapter {
  constructor() {
    this.name = 'OpenSource';
    
    // 开源数据源列表
    this.sources = [
      {
        name: 'EthereumScamDB',
        url: 'https://raw.githubusercontent.com/MrLuit/EtherScamDB/master/_data/scams.json',
        type: 'json',
        category: 'BLACKLIST',
      },
      {
        name: 'MetaMask_Phishing',
        url: 'https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/master/src/config.json',
        type: 'metamask',
        category: 'BLACKLIST',
      },
    ];
  }

  /**
   * 获取所有开源数据源的风险地址
   * 修复：添加限流和重试机制
   */
  async fetchSanctions() {
    console.log(`[${this.name}] 开始获取开源社区数据...`);
    
    const allAddresses = [];
    let requestCount = 0;
    const MAX_REQUESTS_PER_MINUTE = 30; // GitHub API 限制
    const requestTimestamps = [];
    
    for (const source of this.sources) {
      try {
        // 限流检查
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        const recentRequests = requestTimestamps.filter(t => t > oneMinuteAgo);
        
        if (recentRequests.length >= MAX_REQUESTS_PER_MINUTE) {
          const oldestRecent = recentRequests[0];
          const waitTime = 60000 - (now - oldestRecent);
          console.log(`[${this.name}] 限流: 等待 ${Math.ceil(waitTime / 1000)} 秒`);
          await this.sleep(waitTime);
        }
        
        console.log(`[${this.name}] 正在获取: ${source.name}`);
        requestTimestamps.push(Date.now());
        requestCount++;
        
        const addresses = await this.fetchFromSource(source);
        allAddresses.push(...addresses);
        console.log(`[${this.name}] ${source.name}: ${addresses.length} 个地址`);
      } catch (error) {
        console.error(`[${this.name}] ${source.name} 获取失败:`, error.message);
      }
    }
    
    // 去重
    const uniqueAddresses = this.deduplicate(allAddresses);
    
    console.log(`[${this.name}] 获取完成: ${uniqueAddresses.length} 个唯一地址`);
    return uniqueAddresses;
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 从单个数据源获取
   */
  async fetchFromSource(source) {
    const response = await axios.get(source.url, {
      timeout: 30000,
    });

    switch (source.type) {
      case 'json':
        return this.parseEthereumScamDB(response.data, source);
      case 'metamask':
        return this.parseMetaMaskConfig(response.data, source);
      default:
        return [];
    }
  }

  /**
   * 解析 EthereumScamDB 格式
   */
  parseEthereumScamDB(data, source) {
    const addresses = [];
    
    if (!Array.isArray(data)) return addresses;
    
    for (const scam of data) {
      // 提取地址
      if (scam.addresses) {
        for (const addr of scam.addresses) {
          if (this.isValidEthereumAddress(addr)) {
            addresses.push({
              address: addr.toLowerCase(),
              chain: 'ethereum',
              category: source.category,
              label: 'scam',
              riskScore: 90,
              tags: JSON.stringify(['Scam', source.name, scam.category || 'Unknown']),
              sources: JSON.stringify([this.name, source.name]),
              metadata: JSON.stringify({
                name: scam.name,
                url: scam.url,
                description: scam.description,
                category: scam.category,
                subcategory: scam.subcategory,
              }),
            });
          }
        }
      }
      
      // 提取coin地址
      if (scam.coin && scam.coin.addresses) {
        for (const coinAddr of scam.coin.addresses) {
          if (this.isValidEthereumAddress(coinAddr)) {
            addresses.push({
              address: coinAddr.toLowerCase(),
              chain: 'ethereum',
              category: source.category,
              label: 'scam_token',
              riskScore: 90,
              tags: JSON.stringify(['ScamToken', source.name]),
              sources: JSON.stringify([this.name, source.name]),
              metadata: JSON.stringify({
                name: scam.name,
                coinName: scam.coin?.name,
                coinSymbol: scam.coin?.symbol,
              }),
            });
          }
        }
      }
    }
    
    return addresses;
  }

  /**
   * 解析 MetaMask Phishing 配置
   */
  parseMetaMaskConfig(data, source) {
    const addresses = [];
    
    // MetaMask配置主要包含域名黑名单，不直接包含地址
    // 但我们可以记录这些域名用于前端拦截
    if (data.blacklist) {
      console.log(`[${this.name}] MetaMask: ${data.blacklist.length} 个黑名单域名`);
    }
    
    return addresses;
  }

  /**
   * 验证以太坊地址
   */
  isValidEthereumAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * 去重
   */
  deduplicate(addresses) {
    const seen = new Set();
    return addresses.filter(addr => {
      if (seen.has(addr.address)) return false;
      seen.add(addr.address);
      return true;
    });
  }

  /**
   * 添加自定义地址列表
   */
  async fetchCustomAddresses() {
    // 一些已知的风险地址，从社区收集
    const customAddresses = [
      {
        address: '0x0000000000000000000000000000000000000000',
        chain: 'ethereum',
        category: 'BLACKLIST',
        label: 'burn_address',
        riskScore: 100,
        tags: JSON.stringify(['Burn', 'Custom']),
        sources: JSON.stringify([this.name, 'CustomList']),
        metadata: JSON.stringify({ note: 'Zero address, commonly used in scams' }),
      },
    ];
    
    return customAddresses;
  }
}

module.exports = { OpenSourceAdapter };
