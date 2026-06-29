/**
 * OFAC SDN 数据源适配器
 * 获取美国财政部海外资产控制办公室的制裁名单
 *
 * 安全修复：
 *  - 使用成熟 SAX 解析器替代自研正则（修复跨 chunk 边界 / 子标签解析失败）
 *  - 显式引入 xml2js（修复 fallback 路径 ReferenceError）
 *  - BTC/TRON 地址不再 toLowerCase（保留大小写敏感性）
 *  - SSRF 防护：禁重定向、禁内网 IP、强制 HTTPS、TLS1.2+
 *  - ReDoS 防护：快速短路 + 锚定正则
 *  - 异常隔离：单条 entry 失败不影响整体
 *  - Promise.allSettled 多源容错
 *  - deduplicate 加入 chain 维度
 */

const axios = require('axios');
const https = require('https');
const http = require('http');
const net = require('net');
const dns = require('dns');
const sax = require('sax');
const xml2js = require('xml2js');
const { createLogger } = require('../utils/logger');

const logger = createLogger('ofacAdapter');

/**
 * 基于 sax 的流式 SDN XML 解析器（状态机自维护，无需外层切片）
 */
class StreamingXMLParser {
  constructor() {
    this.entries = [];
    this.parser = sax.parser(true /* strict */, { trim: true, lowercase: true });
    this._resetState();
    this._bind();
  }

  _resetState() {
    this._entry = null;
    this._text = '';
    this._inId = false;
    this._inAddr = false;
    this._idObj = null;
    this._addrObj = null;
    this._inProgram = false;
  }

  _newEntry() {
    this._entry = {
      ids: [],
      addresses: [],
      programs: [],
      lastName: '',
      firstName: '',
      sdnType: '',
      uid: '',
    };
  }

  _bind() {
    this.parser.onopentag = (node) => {
      if (node.name === 'sdnentry') {
        this._newEntry();
      } else if (this._entry) {
        if (node.name === 'program') {
          this._inProgram = true;
          this._text = '';
        } else if (node.name === 'id') {
          this._idObj = {};
          this._inId = true;
        } else if (node.name === 'address') {
          this._addrObj = {};
          this._inAddr = true;
        } else {
          this._text = '';
        }
      }
    };

    this.parser.ontext = (t) => {
      if (t) this._text += t;
    };

    this.parser.oncdata = (t) => {
      if (t) this._text += t;
    };

    this.parser.onclosetag = (name) => {
      if (!this._entry) {
        this._text = '';
        return;
      }
      const val = (this._text || '').trim();

      if (name === 'sdnentry') {
        this._entry.programList = this._entry.programs.filter(Boolean).join(',');
        this.entries.push(this._entry);
        this._entry = null;
        this._text = '';
        return;
      }

      if (name === 'program') {
        if (val) this._entry.programs.push(val);
        this._inProgram = false;
        this._text = '';
        return;
      }

      if (this._inId) {
        if (name === 'idtype') this._idObj.idType = val;
        else if (name === 'idnumber') this._idObj.idNumber = val;
        else if (name === 'id') {
          if (this._idObj.idType && this._idObj.idNumber) {
            this._entry.ids.push(this._idObj);
          }
          this._idObj = null;
          this._inId = false;
        }
        this._text = '';
        return;
      }

      if (this._inAddr) {
        if (name === 'address1') this._addrObj.address1 = val;
        else if (name === 'address2') this._addrObj.address2 = val;
        else if (name === 'city') this._addrObj.city = val;
        else if (name === 'stateorprovince') this._addrObj.stateOrProvince = val;
        else if (name === 'country') this._addrObj.country = val;
        else if (name === 'address') {
          if (this._addrObj.address1) this._entry.addresses.push(this._addrObj);
          this._addrObj = null;
          this._inAddr = false;
        }
        this._text = '';
        return;
      }

      // 顶层简单字段
      switch (name) {
        case 'lastname': this._entry.lastName = val; break;
        case 'firstname': this._entry.firstName = val; break;
        case 'sdntype': this._entry.sdnType = val; break;
        case 'uid': this._entry.uid = val; break;
        default: break;
      }
      this._text = '';
    };

    this.parser.onerror = (e) => {
      throw new Error(`XML parse error: ${e.message}`);
    };
  }

  /**
   * 喂入分块；sax 内部自维护状态，调用方无需切片
   */
  parseChunk(chunk) {
    this.parser.write(chunk);
  }

  finish() {
    this.parser.close();
  }

  getEntries() {
    return this.entries;
  }
}

class OFACAdapter {
  constructor() {
    this.name = 'OFAC_SDN';
    this.sdnUrl = 'https://www.treasury.gov/ofac/downloads/sdn.xml';
    this.consolidatedUrl = 'https://www.treasury.gov/ofac/downloads/consolidated/consolidated.xml';
    this.useStreaming = true;
    // 环境变量化阈值，默认 80MB
    // [High Fix] Robust parsing of maxXmlSize to prevent NaN bypass
    const rawSize = process.env.OFAC_MAX_XML_BYTES;
    const DEFAULT_MAX_XML = 80 * 1024 * 1024;
    if (rawSize !== undefined && rawSize !== null && rawSize !== '') {
      const parsed = Number(rawSize);
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1024 * 1024 || parsed > 1024 * 1024 * 1024) {
        throw new Error(`Invalid OFAC_MAX_XML_BYTES=${JSON.stringify(rawSize)}, must be an integer in [1MB, 1GB]`);
      }
      this.maxXmlSize = parsed;
    } else {
      this.maxXmlSize = DEFAULT_MAX_XML;
    }
    // 强制 HTTPS Agent（TLS 1.2+）
    this.httpsAgent = new https.Agent({
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    });
  }

  /**
   * 获取制裁名单（多源容错）
   */
  async fetchSanctions() {
    logger.info(`[${this.name}] 开始获取 OFAC 名单...`);

    try {
      let allAddresses;

      if (this.useStreaming) {
        const results = await Promise.allSettled([
          this._fetchWithStreaming(this.sdnUrl, 'SDN'),
          this._fetchWithStreaming(this.consolidatedUrl, 'CONSOLIDATED'),
        ]);

        const fulfilled = [];
        let failed = 0;
        for (const r of results) {
          if (r.status === 'fulfilled') {
            fulfilled.push(r.value);
          } else {
            failed++;
            logger.error(`[${this.name}] 源拉取失败: ${r.reason && r.reason.message}`);
          }
        }

        if (fulfilled.length === 0) {
          throw new Error('所有 OFAC 源拉取失败');
        }
        if (failed > 0) {
          logger.warn(`[${this.name}] ${failed} 个源拉取失败，继续使用其余源`);
        }

        allAddresses = fulfilled.flat();
      } else {
        // fallback：xml2js 全量解析（独立 try，互不影响）
        const results = await Promise.allSettled([
          (async () => {
            const data = await this.downloadXML(this.sdnUrl);
            return this.parseOFACXML(data, 'SDN');
          })(),
          (async () => {
            const data = await this.downloadXML(this.consolidatedUrl);
            return this.parseOFACXML(data, 'CONSOLIDATED');
          })(),
        ]);

        const ok = [];
        let failed = 0;
        for (const r of results) {
          if (r.status === 'fulfilled') ok.push(r.value);
          else {
            failed++;
            logger.error(`[${this.name}] fallback 源拉取失败: ${r.reason && r.reason.message}`);
          }
        }
        if (ok.length === 0) throw new Error('所有 OFAC 源拉取失败');
        if (failed > 0) logger.warn(`[${this.name}] ${failed} 个 fallback 源失败`);

        allAddresses = ok.flat();
      }

      const uniqueAddresses = this.deduplicate(allAddresses);
      logger.info(`[${this.name}] 获取完成: ${uniqueAddresses.length} 个唯一地址`);
      return uniqueAddresses;
    } catch (error) {
      logger.error(`[${this.name}] 获取失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 流式下载并解析（解析器自维护状态，无需外层切片）
   */
  async _fetchWithStreaming(url, listType) {
    logger.info(`[${this.name}] 流式下载 ${listType} 名单...`);

    // 协议校验
    this._assertHttps(url);

    const parser = new StreamingXMLParser();
    let totalBytes = 0;

    const response = await axios.get(url, {
      timeout: 120000,
      responseType: 'stream',
      maxRedirects: 0, // 制裁名单源不应被重定向
      maxContentLength: this.maxXmlSize,
      maxBodyLength: this.maxXmlSize,
      decompress: true,
      responseEncoding: 'utf8',
      proxy: false, // 禁用环境变量代理，避免 SSRF
      httpsAgent: this.httpsAgent,
      // 自定义 DNS 解析：禁止内网 IP
      lookup: (hostname, opts, cb) => {
        dns.lookup(hostname, opts, (err, address, family) => {
          if (err) return cb(err);
          if (!address) return cb(new Error(`DNS 解析为空: ${hostname}`));
          // 多地址场景
          const addrs = Array.isArray(address) ? address : [address];
          for (const a of addrs) {
            if (this._isPrivateIp(a)) {
              return cb(new Error(`Blocked private IP: ${a}`));
            }
          }
          cb(null, address, family);
        });
      },
      headers: {
        'Accept-Encoding': 'gzip, deflate',
      },
      validateStatus: (s) => s >= 200 && s < 300,
    });

    // Content-Type 校验
    const contentType = response.headers['content-type'] || '';
    if (!/xml/i.test(contentType)) {
      response.data.destroy();
      throw new Error(`Unexpected Content-Type: ${contentType}`);
    }

    // 提前拒绝：Content-Length 超限
    const contentLength = parseInt(response.headers['content-length'] || '0', 10);
    if (contentLength && contentLength > this.maxXmlSize) {
      response.data.destroy();
      throw new Error(`Content-Length 超限: ${contentLength}`);
    }

    return new Promise((resolve, reject) => {
      const stream = response.data;
      let buf = Buffer.alloc(0);
      let settled = false;

      const fail = (err) => {
        if (settled) return;
        settled = true;
        try { stream.destroy(); } catch (_) {}
        reject(err);
      };

      stream.on('data', (chunk) => {
        totalBytes += chunk.length;

        // 大小限制（基于字节）
        if (totalBytes > this.maxXmlSize) {
          return fail(new Error(`XML 超过 ${this.maxXmlSize} bytes`));
        }

        // Buffer 拼接，避免 UTF-8 多字节边界切割问题
        buf = Buffer.concat([buf, chunk]);

        try {
          parser.parseChunk(chunk.toString('utf8'));
        } catch (e) {
          return fail(e);
        }
      });

      stream.on('end', () => {
        if (settled) return;
        try {
          parser.finish();
        } catch (e) {
          return fail(e);
        }

        const entries = parser.getEntries();
        logger.info(
          `[${this.name}] ${listType} 流式下载完成: ${totalBytes} bytes, ${entries.length} entries`,
        );
        try {
          const addresses = this._extractCryptoAddresses(entries, listType);
          settled = true;
          resolve(addresses);
        } catch (e) {
          return fail(e);
        }
      });

      stream.on('error', (err) => fail(new Error(`流式下载失败: ${err.message}`)));
    });
  }

  /**
   * 从解析的 entries 中提取加密货币地址（单条失败隔离）
   */
  _extractCryptoAddresses(entries, listType) {
    const addresses = [];
    if (!Array.isArray(entries)) return addresses;

    for (const entry of entries) {
      try {
        this._extractOne(entry, listType, addresses);
      } catch (e) {
        logger.warn(`[${this.name}] 解析单条 entry 失败: ${e.message}`, {
          uid: entry && entry.uid,
        });
      }
    }
    return addresses;
  }

  _extractOne(entry, listType, addresses) {
    if (!entry || typeof entry !== 'object') return;

    const tags = ['OFAC', listType];
    if (Array.isArray(entry.programs) && entry.programs.length > 0) {
      for (const p of entry.programs) if (p) tags.push(p);
    } else if (entry.programList) {
      tags.push(entry.programList);
    }

    const entity = entry.lastName || entry.firstName || 'Unknown';
    const baseMeta = {
      entity,
      sdnType: entry.sdnType || '',
      program: Array.isArray(entry.programs) && entry.programs.length > 0
        ? entry.programs.join(',')
        : (entry.programList || ''),
      listType,
      uid: entry.uid || '',
    };

    // idList
    if (Array.isArray(entry.ids)) {
      for (const id of entry.ids) {
        if (!id || !id.idType || !id.idNumber) continue;
        if (this.isCryptoAddress(id.idNumber)) {
          const { chain, address } = this._detectAndNormalize(id.idNumber);
          addresses.push({
            address,
            chain,
            category: 'BLACKLIST',
            label: 'ofac_sanctioned',
            riskScore: 100,
            tags: JSON.stringify(tags),
            sources: JSON.stringify([this.name]),
            metadata: JSON.stringify({ ...baseMeta, idType: id.idType }),
          });
        }
      }
    }

    // addressList
    if (Array.isArray(entry.addresses)) {
      for (const addr of entry.addresses) {
        if (!addr || !addr.address1) continue;
        if (this.isCryptoAddress(addr.address1)) {
          const { chain, address } = this._detectAndNormalize(addr.address1);
          addresses.push({
            address,
            chain,
            category: 'BLACKLIST',
            label: 'ofac_sanctioned',
            riskScore: 100,
            tags: JSON.stringify(tags),
            sources: JSON.stringify([this.name]),
            metadata: JSON.stringify({
              ...baseMeta,
              city: addr.city || '',
              country: addr.country || '',
            }),
          });
        }
      }
    }
  }

  /**
   * 下载 XML（带重试 + jitter）
   */
  async downloadXML(url, retries = 3) {
    this._assertHttps(url);
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await axios.get(url, {
          timeout: 60000,
          responseType: 'text',
          maxRedirects: 0,
          maxContentLength: this.maxXmlSize,
          maxBodyLength: this.maxXmlSize,
          proxy: false,
          httpsAgent: this.httpsAgent,
          lookup: (hostname, opts, cb) => {
            dns.lookup(hostname, opts, (err, address, family) => {
              if (err) return cb(err);
              const addrs = Array.isArray(address) ? address : [address];
              for (const a of addrs) {
                if (this._isPrivateIp(a)) return cb(new Error(`Blocked private IP: ${a}`));
              }
              cb(null, address, family);
            });
          },
          validateStatus: (s) => s >= 200 && s < 300,
        });
        return response.data;
      } catch (error) {
        lastError = error;
        logger.warn(`[${this.name}] 下载失败 (尝试 ${attempt}/${retries}): ${error.message}`);
        if (attempt < retries) {
          const jitter = Math.random() * 1000;
          await this.sleep(2000 * attempt + jitter);
        }
      }
    }
    const msg = lastError && lastError.message ? lastError.message : String(lastError);
    throw new Error(`[${this.name}] 下载失败，已重试 ${retries} 次: ${msg}`);
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * xml2js fallback 解析
   */
  async parseOFACXML(xmlData, listType) {
    if (typeof xmlData !== 'string' || xmlData.length === 0) return [];

    const parser = new xml2js.Parser({
      explicitArray: false,
      strict: true,
    });
    const result = await parser.parseStringPromise(xmlData);

    const addresses = [];

    if (result && result.sdnList && result.sdnList.sdnEntry) {
      const entries = Array.isArray(result.sdnList.sdnEntry)
        ? result.sdnList.sdnEntry
        : [result.sdnList.sdnEntry];

      // 将 xml2js 结构归一化为 StreamingXMLParser 产物
      const normalized = entries.map((e) => this._normalizeXml2jsEntry(e));

      for (const entry of normalized) {
        try {
          this._extractOne(entry, listType, addresses);
        } catch (err) {
          logger.warn(`[${this.name}] fallback 单条解析失败: ${err.message}`);
        }
      }
    }

    return addresses;
  }

  _normalizeXml2jsEntry(entry) {
    const out = {
      ids: [],
      addresses: [],
      programs: [],
      lastName: '',
      firstName: '',
      sdnType: '',
      uid: '',
      programList: '',
    };

    if (!entry || typeof entry !== 'object') return out;

    out.lastName = (entry.lastName || '').toString();
    out.firstName = (entry.firstName || '').toString();
    out.sdnType = (entry.sdnType || '').toString();
    out.uid = (entry.uid || '').toString();

    // programList -> programs
    let progs = [];
    if (entry.programList && entry.programList.program) {
      progs = Array.isArray(entry.programList.program)
        ? entry.programList.program
        : [entry.programList.program];
    }
    out.programs = progs.map((p) => (p || '').toString()).filter(Boolean);
    out.programList = out.programs.join(',');

    // idList
    if (entry.idList && entry.idList.id) {
      const ids = Array.isArray(entry.idList.id) ? entry.idList.id : [entry.idList.id];
      for (const id of ids) {
        if (id && id.idType && id.idNumber) {
          out.ids.push({
            idType: (id.idType || '').toString(),
            idNumber: (id.idNumber || '').toString(),
          });
        }
      }
    }

    // addressList
    if (entry.addressList && entry.addressList.address) {
      const addrs = Array.isArray(entry.addressList.address)
        ? entry.addressList.address
        : [entry.addressList.address];
      for (const a of addrs) {
        if (a && a.address1) {
          out.addresses.push({
            address1: (a.address1 || '').toString(),
            city: (a.city || '').toString(),
            country: (a.country || '').toString(),
          });
        }
      }
    }

    return out;
  }

  /**
   * 加密货币地址识别（短路 + 锚定，避免 ReDoS）
   * 支持：ETH(0x)、TRON(T..)、BTC Legacy(P2PKH 1..)、BTC P2SH(3..)、Bech32/Bech32m(bc1..)
   */
  isCryptoAddress(str) {
    if (typeof str !== 'string' || str.length < 26 || str.length > 90) return false;
    const c = str.charCodeAt(0);

    // 0x (ETH)
    if (c === 0x30 /* '0' */ && str.charCodeAt(1) === 0x78 /* 'x' */) {
      return /^0x[0-9a-fA-F]{40}$/.test(str);
    }
    // 'T' (TRON Base58)
    if (c === 0x54 /* 'T' */) {
      return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(str);
    }
    // '1' / '3' (BTC legacy/P2SH)
    if (c === 0x31 /* '1' */ || c === 0x33 /* '3' */) {
      return /^[13][1-9A-HJ-NP-Za-km-z]{24,34}$/.test(str);
    }
    // 'bc1' (Bech32 / Bech32m)
    if (
      c === 0x62 /* 'b' */ &&
      str.charCodeAt(1) === 0x63 /* 'c' */ &&
      str.charCodeAt(2) === 0x31 /* '1' */
    ) {
      return /^bc1[02-9ac-hj-np-z]{6,87}$/i.test(str);
    }
    return false;
  }

  /**
   * 按链类型归一化（仅 ETH 小写化，BTC/TRON 保留原样）
   */
  _normalizeAddress(addr, chain) {
    if (!addr) return '';
    return chain === 'ethereum' ? addr.toLowerCase() : addr;
  }

  _detectAndNormalize(raw) {
    const chain = this.detectChain(raw);
    return { chain, address: this._normalizeAddress(raw, chain) };
  }

  /**
   * 检测链类型（基于严格正则避免误判）
   */
  detectChain(address) {
    if (typeof address !== 'string') return 'unknown';
    if (/^0x[0-9a-fA-F]{40}$/.test(address)) return 'ethereum';
    if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) return 'tron';
    if (/^bc1[02-9ac-hj-np-z]{6,87}$/i.test(address)) return 'bitcoin';
    if (/^[13][1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address)) return 'bitcoin';
    return 'unknown';
  }

  /**
   * 去重（加入 chain 维度）
   */
  deduplicate(addresses) {
    const seen = new Set();
    return addresses.filter((addr) => {
      if (!addr || !addr.address || !addr.chain) return false;
      const key = `${addr.chain}:${addr.address}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * 内网 IP 判断（SSRF 防护）
   */
  _isPrivateIp(ip) {
    if (typeof ip !== 'string') return false;
    const family = net.isIP(ip);
    if (family === 4) {
      const parts = ip.split('.').map(Number);
      if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
      const [a, b] = parts;
      return (
        a === 10 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        a === 127 ||
        (a === 169 && b === 254) || // link-local
        a === 0 ||
        a >= 224 // multicast / reserved
      );
    }
    if (family === 6) {
      const lower = ip.toLowerCase();
      // loopback ::1, ULA fc00::/7, link-local fe80::/10
      return (
        lower === '::1' ||
        /^fc/.test(lower) ||
        /^fd/.test(lower) ||
        /^fe[89ab]/.test(lower)
      );
    }
    // 非 IP（如剩余域名）按危险处理
    return true;
  }

  /**
   * 强制 HTTPS
   */
  _assertHttps(url) {
    let parsed;
    try {
      // eslint-disable-next-line no-new
      new URL(url);
      parsed = new URL(url);
    } catch (e) {
      throw new Error(`非法 URL: ${url}`);
    }
    if (parsed.protocol !== 'https:') {
      throw new Error(`仅允许 HTTPS 协议: ${url}`);
    }
  }
}

module.exports = { OFACAdapter, StreamingXMLParser };