/**
 * AWSKMSKeyManager 的 DER / SPKI 解析回归测试。
 *
 * 为什么这个文件重要：data-publisher 此前【零测试、零 CI 覆盖】，导致
 * kms-key-manager.ts 里三处解析 bug 长期潜伏（2026-10-02 发现并修复）：
 *   1. deriveAddress 外层 SEQUENCE：用 readLength（返回长度【值】86）当长度字段
 *      【字节数】(1) 用 → offset 跳到 87 → 对任何合法 SPKI 都抛
 *      'Invalid SPKI: expected AlgorithmIdentifier SEQUENCE'。
 *   2. deriveAddress AlgorithmIdentifier：只加了长度值、漏加长度字段本身 →
 *      offset 少 1，落在 0x0a 而非 BIT STRING 的 0x03。
 *   3. derToRSV 外层 SEQUENCE：同型错误 → DER 签名解析全失败。
 *   1+2+3 叠加 = AWS KMS 模式（取地址 + 签名）完全不可用。
 * 另补齐畸形 DER 越界防护（shared 的 R3-L15 修复此前未同步到这份拷贝）。
 *
 * 测试对象是编译产物 dist/（package.json 的 test 脚本为 `tsc && jest`），
 * 因为本包未装 ts-jest / @babel/preset-typescript，jest 无法直接转译 .ts。
 *
 * 注意：config.ts 在【模块加载时】就强制要求 key manager 配置，
 * 否则 import kms-key-manager 即抛错，故下面必须在 require 之前设置环境变量。
 */
'use strict';

// —— 必须在 require 被测模块之前设置（config.ts 顶层校验）——
process.env.RISK_REGISTRY_ADDRESS = '0x953f985f38f94d6159c0600d1f15D543895cE896';
process.env.FATF_RISK_REGISTRY_ADDRESS = '0x953f985f38f94d6159c0600d1f15D543895cE896';
process.env.PUBLISHER_PRIVATE_KEY = '0x' + '11'.repeat(32);

const { ethers, SigningKey, JsonRpcProvider } = require('ethers');
const { AWSKMSKeyManager } = require('../dist/src/kms-key-manager.js');

/** 标准 secp256k1 SPKI DER 前缀（SEQUENCE + AlgorithmIdentifier + BIT STRING 头 + unusedBits=0） */
const SPKI_PREFIX_HEX = '3056301006072a8648ce3d020106052b8104000a034200';
/** 确定性测试私钥（非机密，仅用于生成可复现的真实 secp256k1 向量） */
const TEST_PK = '0x' + '11'.repeat(32);
const SECP256K1_N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

const wallet = new ethers.Wallet(TEST_PK);
const MSG_HASH = ethers.hashMessage('hello fidesorigin');
const BASE_SIG = new SigningKey(TEST_PK).sign(MSG_HASH);

/** 构造 manager（KMS client 懒加载，构造不发网络请求） */
function makeManager() {
  return new AWSKMSKeyManager(
    'test-key-id',
    new JsonRpcProvider('http://localhost:8545'),
    11155111
  );
}

/** 真实未压缩公钥 → SPKI DER（与 AWS KMS GetPublicKey 返回格式一致） */
function makeSpki() {
  const uncompressed = new SigningKey(TEST_PK).publicKey.slice(2); // 去掉 0x，形如 04...
  return Buffer.from(SPKI_PREFIX_HEX + uncompressed, 'hex');
}

/**
 * 按 AWS KMS 规则把 flat r/s 编成 DER：SEQUENCE { INTEGER r, INTEGER s }
 * DER INTEGER 是有符号的：最高位为 1 时必须补 0x00 前导字节表示正数。
 * 真实 AWS KMS 签名里约 50% 的 r/s 需要这个前导字节。
 */
function encodeDer(rHex, sHex) {
  const encInt = (hex) => {
    let b = Buffer.from(hex.slice(2), 'hex');
    if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0x00]), b]);
    return Buffer.concat([Buffer.from([0x02, b.length]), b]);
  };
  const body = Buffer.concat([encInt(rHex), encInt(sHex)]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}

describe('AWSKMSKeyManager.deriveAddress (SPKI parsing)', () => {
  it('should derive the correct address from a real secp256k1 SPKI', () => {
    const address = makeManager().deriveAddress(makeSpki());
    // 断言精确地址值，而非只断言 isAddress 格式（后者测不出解析正确性）
    expect(address.toLowerCase()).toBe(wallet.address.toLowerCase());
    expect(ethers.isAddress(address)).toBe(true);
  });

  it('should agree with ethers for the same key (cross-validation)', () => {
    // 交叉验证：独立用 ethers 从私钥推导，应与 SPKI 解析路径得到同一地址。
    // 能捕获「DER offset 算错但恰好产出合法格式地址」这类静默错误。
    expect(makeManager().deriveAddress(makeSpki()).toLowerCase()).toBe(
      new ethers.Wallet(TEST_PK).address.toLowerCase()
    );
  });

  it('should reject a buffer that is not a SEQUENCE', () => {
    expect(() => makeManager().deriveAddress(Buffer.alloc(88, 0x00))).toThrow(
      'Invalid SPKI: expected SEQUENCE'
    );
  });

  it('should reject a compressed public key (33 bytes, not 65)', () => {
    const compressed = Buffer.from(
      '024f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa',
      'hex'
    );
    const prefix = Buffer.from(SPKI_PREFIX_HEX, 'hex');
    const badSpki = Buffer.concat([
      prefix,
      compressed,
      Buffer.alloc(88 - prefix.length - compressed.length),
    ]);
    expect(() => makeManager().deriveAddress(badSpki)).toThrow('Invalid EC point');
  });
});

describe('AWSKMSKeyManager.derToRSV (DER signature parsing)', () => {
  it('should parse a real AWS-KMS-style DER signature into flat RSV', () => {
    const der = encodeDer(BASE_SIG.r, BASE_SIG.s);
    expect(der[0]).toBe(0x30); // 确认测试向量确实是 DER 而非 flat

    const flat = makeManager().derToRSV(der, MSG_HASH, wallet.address);

    expect(flat.slice(0, 66)).toBe(BASE_SIG.r); // r 原样保留
    expect(flat.length).toBe(2 + 64 + 64 + 2); // 0x + r(32B) + s(32B) + v(1B)
    // 本质校验：解析结果必须能恢复出签名者地址
    expect(ethers.recoverAddress(MSG_HASH, flat).toLowerCase()).toBe(
      wallet.address.toLowerCase()
    );
  });

  it('should handle a DER signature whose s needs a leading zero byte', () => {
    // 构造 high-s（s 高位为 1 → DER 必须补 0x00 前导字节）。
    // 这正是曾经触发 "s exceeds buffer" 误报的路径：越界检查若用
    // 「跳过前导零后的 sStart」加上「已含前导零的 sLen」，就会多算 1 字节。
    const highS = '0x' + (SECP256K1_N - BigInt(BASE_SIG.s)).toString(16).padStart(64, '0');
    const der = encodeDer(BASE_SIG.r, highS);
    // 前置条件断言：确认这个向量确实需要前导零（否则测不到目标路径）
    expect((parseInt(highS.slice(2, 4), 16) & 0x80) !== 0).toBe(true);

    const flat = makeManager().derToRSV(der, MSG_HASH, wallet.address);

    // 输出 s 必须是 low-s（EIP-2 / BIP-62 规范化）
    const outS = BigInt('0x' + flat.slice(66, 130));
    expect(outS <= SECP256K1_N / BigInt(2)).toBe(true);
    // 规范化后仍应能恢复出同一地址
    expect(ethers.recoverAddress(MSG_HASH, flat).toLowerCase()).toBe(
      wallet.address.toLowerCase()
    );
  });

  it('should handle a DER signature whose r needs a leading zero byte', () => {
    // 对称覆盖 r 侧：探测一个 r 高位为 1 的消息（约 50% 概率，循环几次即可命中）
    let found = null;
    for (let i = 0; i < 200 && !found; i++) {
      const h = ethers.hashMessage('probe-' + i);
      const s = new SigningKey(TEST_PK).sign(h);
      if ((parseInt(s.r.slice(2, 4), 16) & 0x80) !== 0) found = { hash: h, sig: s };
    }
    expect(found).not.toBeNull();

    const der = encodeDer(found.sig.r, found.sig.s);
    const flat = makeManager().derToRSV(der, found.hash, wallet.address);

    expect(flat.slice(0, 66)).toBe(found.sig.r); // r 原样保留（未被前导零逻辑错位）
    expect(ethers.recoverAddress(found.hash, flat).toLowerCase()).toBe(
      wallet.address.toLowerCase()
    );
  });

  it('should reject a malformed DER signature (not a SEQUENCE)', () => {
    expect(() =>
      makeManager().derToRSV(Buffer.alloc(71, 0x00), MSG_HASH, wallet.address)
    ).toThrow('Invalid DER signature: expected SEQUENCE');
  });

  it('should reject a DER signature whose declared r length exceeds the buffer', () => {
    // 外层 SEQUENCE 合法，但 r 声明 64 字节而实际只有 8 字节。
    // 必须显式拒绝，不能静默截断（截断会导致 r/s 错位且 offset 失步，
    // 产出格式合法但值错误的签名 —— 比直接报错危险得多）。
    const bogus = Buffer.concat([
      Buffer.from([0x30, 0x44, 0x02, 0x40]),
      Buffer.alloc(8, 0xaa),
    ]);
    expect(() => makeManager().derToRSV(bogus, MSG_HASH, wallet.address)).toThrow(
      /exceeds buffer|Invalid DER/
    );
  });
});
