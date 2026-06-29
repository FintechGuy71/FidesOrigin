/**
 * FidesOrigin - 制裁名单数据接入模块
 * 
 * 支持数据源：
 * - OFAC (美国财政部) - SDN List
 * - UN (联合国) - Consolidated List
 * - HMT (英国财政部) - Sanctions List
 * - EU (欧盟) - Financial Sanctions
 * 
 * @module sanctions-sync
 */

const https = require('https');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const dns = require('dns');
const { URL } = require('url');

// ============ 安全常量 ============
const MAX_REDIRECTS = 3;
const MAX_RESPONSE_SIZE = 150 * 1024 * 1024; // 150 MB
const REQUEST_TIMEOUT = 30000;

// ============ 配置 ============
const CONFIG = {
  sources: {
    ofac: {
      name: 'OFAC',
      url: 'https://www.treasury.gov/ofac/downloads/sdn.csv',
      altUrl: 'https://raw.githubusercontent.com/ultralytics/OFAC/main/sdn.csv',
      type: 'csv',
      priority: 1
    },
    ofacAddresses: {
      name: 'OFAC-Crypto',
      url: 'https://www.treasury.gov/ofac/downloads/sanctions/1.0/sdn_advanced.xml',
      type: 'xml',
      priority: 1
    },
    un: {
      name: 'UN',
      url: 'https://scsanctions.un.org/resources/xml/en/consolidated.xml',
      type: 'xml',
      priority: 2
    },
    hmt: {
      name: 'HMT',
      url: 'https://ofsistorage.blob.core.windows.net/publishlive/2022format/ConList.csv',
      type: 'csv',
      priority: 2
    },
    eu: {
      name: 'EU',
      url: 'https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=nM8a1B7k',
      type: 'xml',
      priority: 2
    }
  },

  cache: {
    dir: './cache/sanctions',
    ttl: 24 * 60 * 60 * 1000,
  },

  // 区块链地址匹配 — 使用 lookahead/lookbehind 避免匹配交易哈希等更长的十六进制字符串
  cryptoPatterns: {
    ethereum: /(?<![a-fA-F0-9])0x[a-fA-F0-9]{40}(?![a-fA-F0-9])/g,
    bitcoin: /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g,
    tron: /\bT[a-zA-Z0-9]{33}\b/g,
    litecoin: /\b[LM3][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g
  }
};

// ============ SSRF 防护工具函数 ============

/**
 * 判断 IP 是否为私有/内网地址
 */
function isPrivateIP(ip) {
  // IPv4 检查
  const v4Parts = ip.split('.').map(Number);
  if (v4Parts.length === 4 && v4Parts.every(n => n >= 0 && n <= 255)) {
    if (v4Parts[0] === 0) return true;                          // 0.0.0.0/8
    if (v4Parts[0] === 10) return true;                          // 10.0.0.0/8
    if (v4Parts[0] === 127) return true;                         // 127.0.0.0/8 (loopback)
    if (v4Parts[0] === 169 && v4Parts[1] === 254) return true;  // 169.254.0.0/16 (link-local / AWS metadata)
    if (v4Parts[0] === 172 && v4Parts[1] >= 16 && v4Parts[1] <= 31) return true; // 172.16.0.0/12
    if (v4Parts[0] === 192 && v4Parts[1] === 168) return true;  // 192.168.0.0/16
    if (v4Parts[0] === 100 && v4Parts[1] >= 64 && v4Parts[1] <= 127) return true; // CGNAT
    if (v4Parts[0] === 224) return true;                         // 多播
    if (v4Parts[0] >= 240) return true;                          // 保留
    return false;
  }

  // IPv6 检查
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fe80:')) return true;   // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA
  if (lower.startsWith('ff')) return true;      // 多播

  // IPv4-mapped IPv6
  const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIP(mapped[1]);

  return false;
}

/**
 * DNS 解析并检查是否解析到私有 IP
 */
function checkHostnameSafe(hostname) {
  return new Promise((resolve, reject) => {
    // 如果 hostname 本身就是 IP
    const ipMatch = /^(\d+\.\d+\.\d+\.\d+)$/.exec(hostname);
    if (ipMatch) {
      if (isPrivateIP(hostname)) {
        return reject(new Error(`SSRF blocked: direct private IP ${hostname}`));
      }
      return resolve();
    }

    dns.lookup(hostname, { all: true }, (err, addresses) => {
      if (err) {
        return reject(new Error(`DNS resolution failed for ${hostname}: ${err.message}`));
      }
      for (const addr of addresses) {
        if (isPrivateIP(addr.address)) {
          return reject(new Error(
            `SSRF blocked: ${hostname} resolves to private/internal IP ${addr.address}`
          ));
        }
      }
      resolve();
    });
  });
}

// ============ 安全 HTTP GET ============

/**
 * HTTP GET 请求（安全加固版）
 * - 强制 HTTPS
 * - 限制重定向次数
 * - SSRF 防护（DNS 解析 + 私有 IP 拦截）
 * - 响应体积限制（防 OOM）
 */
async function httpGet(url, options = {}, redirectCount = 0) {
  // 防御 1: 强制 HTTPS，禁止 HTTP 明文降级
  if (!url.startsWith('https://')) {
    throw new Error('Blocked insecure protocol: HTTPS is strictly required.');
  }

  // 防御 2: 限制重定向次数，防止循环重定向导致栈溢出
  if (redirectCount > MAX_REDIRECTS) {
    throw new Error(`Maximum redirects (${MAX_REDIRECTS}) exceeded.`);
  }

  const parsedUrl = new URL(url);

  // 防御 3: SSRF — 解析 DNS 并检查目标 IP 是否为内网
  await checkHostnameSafe(parsedUrl.hostname);

  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': 'FidesOrigin-Sanctions-Sync/1.0',
        'Accept': '*/*',
        ...options.headers
      }
    }, (res) => {
      // 处理重定向
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        const location = res.headers.location;
        // 消费当前响应体以释放资源
        res.resume();

        if (location) {
          // 处理绝对/相对 URL
          const nextUrl = location.startsWith('http')
            ? location
            : new URL(location, url).href;
          return resolve(httpGet(nextUrl, options, redirectCount + 1));
        }
        return reject(new Error(`Redirect ${res.statusCode} without Location header`));
      }

      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage || 'Error'}`));
      }

      // 防御 4: 使用 Buffer 数组收集数据（比字符串拼接性能好，避免 GC 压力）
      const chunks = [];
      let totalBytes = 0;
      let rejected = false;

      res.on('data', (chunk) => {
        if (rejected) return;
        totalBytes += chunk.length;

        // 防御 5: 响应体大小限制，防内存耗尽 (OOM)
        if (totalBytes > MAX_RESPONSE_SIZE) {
          rejected = true;
          req.destroy();
          reject(new Error(
            `Response size exceeded maximum limit (${MAX_RESPONSE_SIZE / 1024 / 1024}MB)`
          ));
          return;
        }
        chunks.push(chunk);
      });

      res.on('end', () => {
        if (rejected) return;
        resolve({
          data: Buffer.concat(chunks).toString('utf8'),
          contentType: res.headers['content-type']
        });
      });

      res.on('error', (err) => {
        if (!rejected) {
          rejected = true;
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// ============ 通用工具函数 ============

/**
 * 计算数据哈希
 */
function computeHash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ============ 安全 XML 解析（无正则，基于字符串查找） ============

/**
 * 大小写不敏感地查找标签起始位置
 */
function findTagOpen(text, tagName, startPos) {
  const lower = text.toLowerCase();
  const target = `<${tagName.toLowerCase()}`;
  return lower.indexOf(target, startPos);
}

/**
 * 大小写不敏感地查找关闭标签位置
 */
function findTagClose(text, tagName, startPos) {
  const lower = text.toLowerCase();
  const target = `</${tagName.toLowerCase()}>`;
  return lower.indexOf(target, startPos);
}

/**
 * 提取单个标签内容（大小写不敏感）
 * 返回去掉首尾空白后的文本，找不到则返回空字符串
 */
function extractTagContent(text, tagName) {
  const openIdx = findTagOpen(text, tagName, 0);
  if (openIdx === -1) return '';

  const tagEnd = text.indexOf('>', openIdx);
  if (tagEnd === -1) return '';

  // 自闭合标签
  if (text[tagEnd - 1] === '/') return '';

  const closeIdx = findTagClose(text, tagName, tagEnd + 1);
  if (closeIdx === -1) return '';

  return text.slice(tagEnd + 1, closeIdx).trim();
}

/**
 * 提取所有指定标签块的内容（大小写不敏感）
 * 使用字符串 indexOf 而非正则，防止 ReDoS
 */
function extractAllBlocks(text, tagName) {
  const blocks = [];
  let pos = 0;
  const closeTagLen = tagName.length + 3; // </tagName>

  // 安全上限：防止极端情况下的无限循环
  const maxBlocks = 1000000;

  while (pos < text.length && blocks.length < maxBlocks) {
    const openIdx = findTagOpen(text, tagName, pos);
    if (openIdx === -1) break;

    const tagEnd = text.indexOf('>', openIdx);
    if (tagEnd === -1) break;

    // 自闭合标签
    if (text[tagEnd - 1] === '/') {
      pos = tagEnd + 1;
      continue;
    }

    const closeIdx = findTagClose(text, tagName, tagEnd + 1);
    if (closeIdx === -1) break;

    blocks.push(text.slice(tagEnd + 1, closeIdx));
    pos = closeIdx + closeTagLen;
  }

  return blocks;
}

// ============ CSV 解析（安全，无正则回溯风险） ============

/**
 * 解析 CSV 行（字符级状态机，正确处理引号和转义）
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // 双引号转义
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

/**
 * 解析 CSV 文本（使用 parseCSVLine 解析表头和每行）
 */
function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];

  // 使用 parseCSVLine 解析表头，正确处理带引号的列名
  const headers = parseCSVLine(lines[0]);
  const results = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const entry = {};
    headers.forEach((h, idx) => {
      entry[h] = values[idx] || '';
    });
    results.push(entry);
  }

  return results;
}

// ============ 加密货币地址验证与提取 ============

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Base58 解码
 */
function base58Decode(str) {
  let num = BigInt(0);
  const base = BigInt(58);

  for (let i = 0; i < str.length; i++) {
    const idx = BASE58_ALPHABET.indexOf(str[i]);
    if (idx === -1) throw new Error(`Invalid Base58 character: ${str[i]}`);
    num = num * base + BigInt(idx);
  }

  const bytes = [];
  while (num > 0n) {
    bytes.unshift(Number(num & 0xffn));
    num >>= 8n;
  }

  // 前导 '1' 对应前导零字节
  for (let i = 0; i < str.length && str[i] === '1'; i++) {
    bytes.unshift(0);
  }

  return Buffer.from(bytes);
}

/**
 * 验证 Bitcoin 地址的 Base58Check 校验码
 */
function validateBitcoinAddress(address) {
  if (!/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) return false;
  try {
    const decoded = base58Decode(address);
    if (decoded.length < 5) return false;

    const payload = decoded.slice(0, -4);
    const checksum = decoded.slice(-4);

    const hash1 = crypto.createHash('sha256').update(payload).digest();
    const hash2 = crypto.createHash('sha256').update(hash1).digest();

    return checksum.equals(hash2.slice(0, 4));
  } catch {
    return false;
  }
}

/**
 * 验证 Tron 地址的 Base58Check 校验码（前缀 0x41）
 */
function validateTronAddress(address) {
  if (!/^T[a-zA-Z0-9]{33}$/.test(address)) return false;
  try {
    const decoded = base58Decode(address);
    if (decoded.length !== 25) return false;
    if (decoded[0] !== 0x41) return false; // Tron 主网前缀

    const payload = decoded.slice(0, -4);
    const checksum = decoded.slice(-4);

    const hash1 = crypto.createHash('sha256').update(payload).digest();
    const hash2 = crypto.createHash('sha256').update(hash1).digest();

    return checksum.equals(hash2.slice(0, 4));
  } catch {
    return false;
  }
}

/**
 * 验证 Litecoin 地址的 Base58Check 校验码
 */
function validateLitecoinAddress(address) {
  if (!/^[LM3][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) return false;
  try {
    const decoded = base58Decode(address);
    if (decoded.length < 5) return false;

    const version = decoded[0];
    // Litecoin: L/M = 0x30, P2SH (3) = 0x32, 也可能共用 Bitcoin 的 0x05
    if (version !== 0x30 && version !== 0x32 && version !== 0x05) return false;

    const payload = decoded.slice(0, -4);
    const checksum = decoded.slice(-4);

    const hash1 = crypto.createHash('sha256').update(payload).digest();
    const hash2 = crypto.createHash('sha256').update(hash1).digest();

    return checksum.equals(hash2.slice(0, 4));
  } catch {
    return false;
  }
}

/**
 * 验证 Ethereum 地址格式（无法在无 keccak256 依赖时做 EIP-55 校验，
 * 但通过 lookbehind/lookahead 正则已排除交易哈希等误报）
 */
function validateEthereumAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * 提取加密货币地址（带校验码验证，降低误报）
 */
function extractCryptoAddresses(text) {
  const addresses = {
    ethereum: [],
    bitcoin: [],
    tron: [],
    litecoin: []
  };

  if (!text) return addresses;

  // Ethereum
  const ethMatches = text.match(CONFIG.cryptoPatterns.ethereum) || [];
  addresses.ethereum = [...new Set(ethMatches.filter(validateEthereumAddress))];

  // Bitcoin — 带 Base58Check 校验
  const btcMatches = text.match(CONFIG.cryptoPatterns.bitcoin) || [];
  addresses.bitcoin = [...new Set(btcMatches.filter(validateBitcoinAddress))];

  // Tron — 带 Base58Check 校验
  const tronMatches = text.match(CONFIG.cryptoPatterns.tron) || [];
  addresses.tron = [...new Set(tronMatches.filter(validateTronAddress))];

  // Litecoin — 带 Base58Check 校验
  const ltcMatches = text.match(CONFIG.cryptoPatterns.litecoin) || [];
  addresses.litecoin = [...new Set(ltcMatches.filter(validateLitecoinAddress))];

  return addresses;
}

// ============ 数据源适配器 ============

/**
 * OFAC 数据适配器
 */
class OFACAdapter {
  static async fetch() {
    console.log('[OFAC] Fetching SDN list...');

    try {
      let response;
      let usedAlt = false;
      try {
        response = await httpGet(CONFIG.sources.ofac.url);
      } catch (e) {
        console.log('[OFAC] Primary URL failed, trying alternative...');
        response = await httpGet(CONFIG.sources.ofac.altUrl);
        usedAlt = true;
      }

      const raw = response.data;
      const records = parseCSV(raw);

      console.log(`[OFAC] Parsed ${records.length} records${usedAlt ? ' (from alt source)' : ''}`);

      const entries = records.map((r, idx) => {
        const entityName = r['Name'] || r['name'] || r['NAME'] || '';
        const fullAddress = [
          r['Address'] || r['address'] || '',
          r['City'] || r['city'] || '',
          r['Country'] || r['country'] || ''
        ].filter(Boolean).join(', ');

        const remarks = r['Remarks'] || r['remarks'] || r['Comment'] || '';
        const cryptoAddresses = extractCryptoAddresses(remarks + ' ' + fullAddress);

        return {
          uid: `OFAC-${r['Ent_Num'] || r['ent_num'] || idx}`,
          source: 'OFAC',
          sourceId: r['Ent_Num'] || r['ent_num'] || '',
          entityName: entityName,
          entityType: r['Entity_Type'] || r['type'] || 'Unknown',
          programs: (r['Programs'] || r['programs'] || '').split(';').filter(Boolean),
          addresses: [{
            address: fullAddress,
            city: r['City'] || r['city'] || '',
            country: r['Country'] || r['country'] || ''
          }],
          cryptoAddresses: cryptoAddresses,
          aliases: (r['Aliases'] || r['aliases'] || '').split(';').filter(Boolean),
          remarks: remarks,
          listType: 'SDN',
          riskLevel: 'CRITICAL',
          lastUpdated: new Date().toISOString()
        };
      }).filter(e => e.entityName);

      const cryptoEntries = await this.fetchCryptoAddresses();

      return {
        source: 'OFAC',
        total: entries.length,
        withCrypto: entries.filter(e =>
          Object.values(e.cryptoAddresses).some(arr => arr.length > 0)
        ).length,
        entries: [...entries, ...cryptoEntries],
        hash: computeHash(raw),
        fetchedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('[OFAC] Error:', error.message);
      throw error;
    }
  }

  /**
   * 获取 OFAC 加密货币专用地址列表
   * 使用安全的字符串解析替代正则解析 XML
   */
  static async fetchCryptoAddresses() {
    try {
      console.log('[OFAC] Fetching crypto addresses...');
      const { data } = await httpGet(CONFIG.sources.ofacAddresses.url);

      const entries = [];

      // 使用安全的字符串查找提取 DigitalCurrencyAddress 块
      const blocks = extractAllBlocks(data, 'DigitalCurrencyAddress');

      for (const block of blocks) {
        const address = extractTagContent(block, 'Address');
        const currency = extractTagContent(block, 'DigitalCurrencyName') || 'Unknown';

        if (address) {
          const currencyLower = currency.toLowerCase();
          const cryptoAddresses = {
            ethereum: [],
            bitcoin: [],
            tron: [],
            litecoin: []
          };

          if (currencyLower.includes('ethereum')) {
            if (validateEthereumAddress(address)) cryptoAddresses.ethereum = [address];
          } else if (currencyLower.includes('bitcoin') || currencyLower.includes('btc')) {
            if (validateBitcoinAddress(address)) cryptoAddresses.bitcoin = [address];
          } else if (currencyLower.includes('tron') || currencyLower.includes('trx')) {
            if (validateTronAddress(address)) cryptoAddresses.tron = [address];
          } else if (currencyLower.includes('litecoin') || currencyLower.includes('ltc')) {
            if (validateLitecoinAddress(address)) cryptoAddresses.litecoin = [address];
          }

          entries.push({
            uid: `OFAC-CRYPTO-${computeHash(address).slice(0, 16)}`,
            source: 'OFAC',
            sourceId: address,
            entityName: `Digital Currency Address (${currency})`,
            entityType: 'Digital Currency Address',
            programs: ['CYBER'],
            addresses: [],
            cryptoAddresses,
            aliases: [],
            remarks: `OFAC listed ${currency} address`,
            listType: 'Digital Currency Address',
            riskLevel: 'CRITICAL',
            lastUpdated: new Date().toISOString()
          });
        }
      }

      console.log(`[OFAC] Found ${entries.length} crypto addresses`);
      return entries;

    } catch (error) {
      console.error('[OFAC-Crypto] Error:', error.message);
      return [];
    }
  }
}

/**
 * UN 数据适配器
 */
class UNAdapter {
  static async fetch() {
    console.log('[UN] Fetching consolidated list...');

    try {
      const { data } = await httpGet(CONFIG.sources.un.url);

      console.log('[UN] Parsing XML with safe string-based parser...');

      const entries = [];

      // 使用安全的字符串查找提取 INDIVIDUAL 块
      const individualBlocks = extractAllBlocks(data, 'INDIVIDUAL');
      for (const block of individualBlocks) {
        const entry = this.parseUNEntry(block, 'INDIVIDUAL');
        if (entry) entries.push(entry);
      }

      // 使用安全的字符串查找提取 ENTITY 块
      const entityBlocks = extractAllBlocks(data, 'ENTITY');
      for (const block of entityBlocks) {
        const entry = this.parseUNEntry(block, 'ENTITY');
        if (entry) entries.push(entry);
      }

      console.log(`[UN] Parsed ${entries.length} records`);

      return {
        source: 'UN',
        total: entries.length,
        withCrypto: entries.filter(e =>
          Object.values(e.cryptoAddresses).some(arr => arr.length > 0)
        ).length,
        entries,
        hash: computeHash(data),
        fetchedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('[UN] Error:', error.message);
      throw error;
    }
  }

  /**
   * 解析 UN 条目（使用安全的 extractTagContent 替代正则）
   */
  static parseUNEntry(xmlBlock, type) {
    const uid = extractTagContent(xmlBlock, 'DATAID') ||
                extractTagContent(xmlBlock, 'REFERENCE_NUMBER');
    const firstName = extractTagContent(xmlBlock, 'FIRST_NAME');
    const secondName = extractTagContent(xmlBlock, 'SECOND_NAME');
    const thirdName = extractTagContent(xmlBlock, 'THIRD_NAME');
    const name = [firstName, secondName, thirdName].filter(Boolean).join(' ').trim();

    if (!name && type === 'INDIVIDUAL') {
      // 对于 ENTITY，名称可能在其他字段
      const entityName = extractTagContent(xmlBlock, 'ENTITY_NAME') ||
                         extractTagContent(xmlBlock, 'NAME');
      if (!entityName) return null;
    }

    // 提取地址块
    const addressBlocks = extractAllBlocks(xmlBlock, 'INDIVIDUAL_ADDRESS');
    const addressParts = [];
    for (const addrBlock of addressBlocks) {
      const street = extractTagContent(addrBlock, 'STREET');
      const city = extractTagContent(addrBlock, 'CITY');
      const country = extractTagContent(addrBlock, 'COUNTRY');
      const note = extractTagContent(addrBlock, 'NOTE');
      const parts = [street, city, country, note].filter(Boolean);
      if (parts.length) addressParts.push(parts.join(', '));
    }

    // 也检查 ENTITY_ADDRESS
    const entityAddrBlocks = extractAllBlocks(xmlBlock, 'ENTITY_ADDRESS');
    for (const addrBlock of entityAddrBlocks) {
      const street = extractTagContent(addrBlock, 'STREET');
      const city = extractTagContent(addrBlock, 'CITY');
      const country = extractTagContent(addrBlock, 'COUNTRY');
      const parts = [street, city, country].filter(Boolean);
      if (parts.length) addressParts.push(parts.join(', '));
    }

    const fullAddressText = addressParts.join('; ');

    // 提取备注
    const comments1 = extractTagContent(xmlBlock, 'COMMENTS1');
    const comments2 = extractTagContent(xmlBlock, 'COMMENTS2');
    const remarks = [comments1, comments2].filter(Boolean).join(' ');

    // 从备注和地址中提取加密地址（带校验码验证）
    const cryptoAddresses = extractCryptoAddresses(remarks + ' ' + fullAddressText);

    const listType = extractTagContent(xmlBlock, 'UN_LIST_TYPE');

    return {
      uid: `UN-${uid || computeHash(name).slice(0, 16)}`,
      source: 'UN',
      sourceId: uid || '',
      entityName: name || extractTagContent(xmlBlock, 'ENTITY_NAME') ||
                  extractTagContent(xmlBlock, 'NAME') || 'Unknown',
      entityType: type,
      programs: listType ? [listType] : [],
      addresses: addressParts.map(a => ({
        address: a,
        city: '',
        country: ''
      })),
      cryptoAddresses,
      aliases: [],
      remarks: remarks,
      listType: 'Consolidated',
      riskLevel: 'CRITICAL',
      lastUpdated: new Date().toISOString()
    };
  }
}

/**
 * HMT (英国财政部) 数据适配器
 */
class HMTAdapter {
  static async fetch() {
    console.log('[HMT] Fetching consolidated list...');

    try {
      const { data } = await httpGet(CONFIG.sources.hmt.url);
      const records = parseCSV(data);

      console.log(`[HMT] Parsed ${records.length} records`);

      const entries = records.map((r, idx) => {
        const entityName = r['Name'] || r['NAME'] || r['Name (1)'] || '';
        const remarks = r['Remarks'] || r['Other Information'] || '';
        const fullAddress = [
          r['Address'] || r['ADDRESS'] || r['Address (1)'] || '',
          r['Town'] || r['City'] || '',
          r['Country'] || r['COUNTRY'] || ''
        ].filter(Boolean).join(', ');

        const cryptoAddresses = extractCryptoAddresses(remarks + ' ' + fullAddress);

        return {
          uid: `HMT-${r['GroupID'] || r['Unique ID'] || idx}`,
          source: 'HMT',
          sourceId: r['GroupID'] || r['Unique ID'] || '',
          entityName: entityName,
          entityType: r['Entity Type'] || r['Subsidiary Nature'] || 'Unknown',
          programs: (r['Sanctioning Regime'] || '').split(',').filter(Boolean),
          addresses: [{
            address: fullAddress,
            city: r['Town'] || r['City'] || '',
            country: r['Country'] || r['COUNTRY'] || ''
          }],
          cryptoAddresses,
          aliases: [],
          remarks: remarks,
          listType: 'UK Sanctions',
          riskLevel: 'CRITICAL',
          lastUpdated: new Date().toISOString()
        };
      }).filter(e => e.entityName);

      return {
        source: 'HMT',
        total: entries.length,
        withCrypto: entries.filter(e =>
          Object.values(e.cryptoAddresses).some(arr => arr.length > 0)
        ).length,
        entries,
        hash: computeHash(data),
        fetchedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('[HMT] Error:', error.message);
      throw error;
    }
  }
}

/**
 * EU (欧盟) 数据适配器
 */
class EUAdapter {
  static async fetch() {
    console.log('[EU] Fetching financial sanctions list...');

    try {
      const { data } = await httpGet(CONFIG.sources.eu.url);

      const entries = [];

      // 使用安全的字符串查找提取实体
      const subjectBlocks = extractAllBlocks(data, 'sanctionEntity');
      for (block of subjectBlocks) {
        const nameBlocks = extractAllBlocks(block, 'nameAlias');
        const entityName = nameBlocks.length > 0
          ? extractTagContent(nameBlocks[0], 'wholeName')
          : '';

        const remark = extractTagContent(block, 'remark');
        const addressBlocks = extractAllBlocks(block, 'address');
        const addressParts = [];
        for (const addrBlock of addressBlocks) {
          const parts = [
            extractTagContent(addrBlock, 'street'),
            extractTagContent(addrBlock, 'city'),
            extractTagContent(addrBlock, 'countryDescription')
          ].filter(Boolean);
          if (parts.length) addressParts.push(parts.join(', '));
        }

        const fullAddressText = addressParts.join('; ');
        const cryptoAddresses = extractCryptoAddresses(remark + ' ' + fullAddressText);

        if (entityName) {
          entries.push({
            uid: `EU-${extractTagContent(block, 'euReferenceNumber') || computeHash(entityName).slice(0, 16)}`,
            source: 'EU',
            sourceId: extractTagContent(block, 'euReferenceNumber') || '',
            entityName: entityName,
            entityType: extractTagContent(block, 'subjectType') || 'Unknown',
            programs: extractAllBlocks(block, 'regulation')
              .map(r => extractTagContent(r, 'programme'))
              .filter(Boolean),
            addresses: addressParts.map(a => ({ address: a, city: '', country: '' })),
            cryptoAddresses,
            aliases: nameBlocks.slice(1).map(n => extractTagContent(n, 'wholeName')).filter(Boolean),
            remarks: remark,
            listType: 'EU Financial Sanctions',
            riskLevel: 'CRITICAL',
            lastUpdated: new Date().toISOString()
          });
        }
      }

      console.log(`[EU] Parsed ${entries.length} records`);

      return {
        source: 'EU',
        total: entries.length,
        withCrypto: entries.filter(e =>
          Object.values(e.cryptoAddresses).some(arr => arr.length > 0)
        ).length,
        entries,
        hash: computeHash(data),
        fetchedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('[EU] Error:', error.message);
      throw error;
    }
  }
}

// ============ 数据管理器 ============

/**
 * 制裁名单数据管理器
 * 负责数据源同步、缓存管理、去重合并
 */
class SanctionsDataManager {
  constructor() {
    this.adapters = {
      ofac: OFACAdapter,
      un: UNAdapter,
      hmt: HMTAdapter,
      eu: EUAdapter
    };
    this.cacheDir = CONFIG.cache.dir;
  }

  /**
   * 确保缓存目录存在
   */
  async ensureCacheDir() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (e) {
      // 目录可能已存在，忽略
    }
  }

  /**
   * 读取缓存
   */
  async readCache(sourceName) {
    try {
      const cachePath = path.join(this.cacheDir, `${sourceName.toLowerCase()}-cache.json`);
      const stat = await fs.stat(cachePath);
      const age = Date.now() - stat.mtime.getTime();

      if (age > CONFIG.cache.ttl) {
        console.log(`[${sourceName}] Cache expired (age: ${Math.round(age / 3600000)}h)`);
        return null;
      }

      const data = await fs.readFile(cachePath, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }

  /**
   * 写入缓存（使用临时文件 + 原子重命名防止并发损坏）
   */
  async writeCache(sourceName, data) {
    await this.ensureCacheDir();
    const cachePath = path.join(this.cacheDir, `${sourceName.toLowerCase()}-cache.json`);
    const tempPath = cachePath + '.tmp';

    try {
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
      await fs.rename(tempPath, cachePath);
    } catch (e) {
      // 清理临时文件
      try { await fs.unlink(tempPath); } catch {}
      throw e;
    }
  }

  /**
   * 同步单个数据源（带缓存）
   */
  async syncSource(sourceKey) {
    const adapter = this.adapters[sourceKey];
    if (!adapter) {
      console.warn(`[Sync] Unknown source: ${sourceKey}`);
      return null;
    }

    // 检查缓存
    const cached = await this.readCache(sourceKey);
    if (cached) {
      console.log(`[${sourceKey}] Using cached data (${cached.total} records)`);
      return cached;
    }

    // 拉取最新数据
    const data = await adapter.fetch();

    // 数据完整性检查：如果记录数比上次缓存少了 90% 以上，可能数据源被篡改
    if (cached && cached.total > 100 && data.total < cached.total * 0.1) {
      console.error(
        `[${sourceKey}] ANOMALY: Record count dropped from ${cached.total} to ${data.total}. ` +
        `Possible data source compromise. Skipping cache update.`
      );
      return cached; // 使用旧缓存
    }

    await this.writeCache(sourceKey, data);
    return data;
  }

  /**
   * 同步所有数据源并合并
   */
  async syncAll() {
    console.log('=== Starting sanctions list sync ===');
    const startTime = Date.now();

    const results = {};
    const errors = {};

    // 串行拉取，避免并发请求过多
    for (const [key, adapter] of Object.entries(this.adapters)) {
      try {
        results[key] = await this.syncSource(key);
      } catch (error) {
        console.error(`[${key}] Sync failed:`, error.message);
        errors[key] = error.message;

        // 失败时尝试使用旧缓存
        const cached = await this.readCache(key);
        if (cached) {
          console.log(`[${key}] Falling back to stale cache`);
          results[key] = cached;
        }
      }
    }

    // 合并所有数据源
    const allEntries = [];
    const cryptoAddressMap = {
      ethereum: new Set(),
      bitcoin: new Set(),
      tron: new Set(),
      litecoin: new Set()
    };

    for (const [source, data] of Object.entries(results)) {
      if (!data || !data.entries) continue;
      for (const entry of data.entries) {
        allEntries.push(entry);

        for (const [chain, addrs] of Object.entries(entry.cryptoAddresses || {})) {
          if (cryptoAddressMap[chain]) {
            addrs.forEach(a => cryptoAddressMap[chain].add(a));
          }
        }
      }
    }

    const summary = {
      totalEntries: allEntries.length,
      totalCryptoAddresses: {
        ethereum: cryptoAddressMap.ethereum.size,
        bitcoin: cryptoAddressMap.bitcoin.size,
        tron: cryptoAddressMap.tron.size,
        litecoin: cryptoAddressMap.litecoin.size
      },
      sources: Object.keys(results).filter(k => results[k]),
      failedSources: Object.keys(errors),
      syncedAt: new Date().toISOString(),
      duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`
    };

    console.log('=== Sync complete ===');
    console.log(`Total entries: ${summary.totalEntries}`);
    console.log(`Crypto addresses:`, summary.totalCryptoAddresses);
    console.log(`Duration: ${summary.duration}`);

    // 写入合并后的制裁名单缓存
    const merged = {
      summary,
      entries: allEntries,
      cryptoAddresses: {
        ethereum: [...cryptoAddressMap.ethereum],
        bitcoin: [...cryptoAddressMap.bitcoin],
        tron: [...cryptoAddressMap.tron],
        litecoin: [...cryptoAddressMap.litecoin]
      }
    };

    await this.ensureCacheDir();
    const mergedPath = path.join(this.cacheDir, 'sanctions-cache.json');
    const tempPath = mergedPath + '.tmp';
    try {
      await fs.writeFile(tempPath, JSON.stringify(merged, null, 2), 'utf8');
      await fs.rename(tempPath, mergedPath);
    } catch (e) {
      try { await fs.unlink(tempPath); } catch {}
      throw e;
    }

    return merged;
  }

  /**
   * 检查地址是否在制裁名单中
   */
  async checkAddress(address) {
    try {
      const cachePath = path.join(this.cacheDir, 'sanctions-cache.json');
      const data = JSON.parse(await fs.readFile(cachePath, 'utf8'));

      const addrLower = address.toLowerCase();
      for (const [chain, addresses] of Object.entries(data.cryptoAddresses || {})) {
        if (addresses.some(a => a.toLowerCase() === addrLower)) {
          return { sanctioned: true, chain, address };
        }
      }
      return { sanctioned: false };
    } catch (e) {
      console.error('[Check] Failed to load sanctions cache:', e.message);
      return { sanctioned: false, error: 'Cache not available' };
    }
  }
}

// ============ 导出 ============

module.exports = {
  CONFIG,
  OFACAdapter,
  UNAdapter,
  HMTAdapter,
  EUAdapter,
  SanctionsDataManager,
  // 工具函数导出（便于测试）
  httpGet,
  computeHash,
  parseCSV,
  parseCSVLine,
  extractAllBlocks,
  extractTagContent,
  extractCryptoAddresses,
  validateBitcoinAddress,
  validateTronAddress,
  validateLitecoinAddress,
  validateEthereumAddress,
  isPrivateIP
};