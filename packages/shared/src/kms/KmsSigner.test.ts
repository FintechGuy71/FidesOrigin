import { describe, it, expect, vi } from 'vitest';
import { ethers } from 'ethers';
import { KmsSigner, LocalSigner, createSigner, createLocalSigner } from './KmsSigner';

// ───────────────────────────────────────────────────────────────────────────
// 1. LocalSigner Tests
// ───────────────────────────────────────────────────────────────────────────

describe('LocalSigner', () => {
  const TEST_PK = '0x' + '1'.repeat(64); // 64-char hex (dummy)
  const provider = new ethers.JsonRpcProvider('http://localhost:8545');

  it('should derive correct address from private key', () => {
    const signer = new LocalSigner(TEST_PK, provider);
    expect(signer.address).toBeDefined();
    expect(ethers.isAddress(signer.address)).toBe(true);
  });

  it('should sign a message and verify it', async () => {
    const signer = new LocalSigner(TEST_PK, provider);
    const message = 'Hello, FidesOrigin!';
    const signature = await signer.signMessage(message);

    // Ethers built-in verify
    const recovered = ethers.verifyMessage(message, signature);
    expect(recovered.toLowerCase()).toBe(signer.address.toLowerCase());
  });

  it('should sign a transaction and verify it', async () => {
    const signer = new LocalSigner(TEST_PK, provider);
    const tx = {
      to: '0x0000000000000000000000000000000000000001',
      value: 0n,
      gasLimit: 21000n,
      nonce: 0,
      chainId: 1,
      type: 2,
      maxFeePerGas: 10n,
      maxPriorityFeePerGas: 1n,
    };

    const serialized = await signer.signTransaction(tx);
    expect(serialized).toBeTruthy();
    expect(serialized.startsWith('0x')).toBe(true);
  });

  it('should connect to a new provider', () => {
    const signer = new LocalSigner(TEST_PK, provider);
    const newProvider = new ethers.JsonRpcProvider('http://other:8545');
    const connected = signer.connect(newProvider);
    expect(connected).toBeInstanceOf(LocalSigner);
    expect(connected.provider).toBe(newProvider);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2. createSigner Factory Tests
// ───────────────────────────────────────────────────────────────────────────

describe('createSigner', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should create a LocalSigner when KMS_PROVIDER=local', async () => {
    process.env.KMS_PROVIDER = 'local';
    process.env.NODE_ENV = 'development';

    const signer = await createSigner({
      localPrivateKey: '0x' + '2'.repeat(64),
    });

    expect(signer).toBeInstanceOf(LocalSigner);
  });

  it('should throw if local mode is used in production', async () => {
    process.env.KMS_PROVIDER = 'local';
    process.env.NODE_ENV = 'production';

    await expect(
      createSigner({ localPrivateKey: '0x' + '3'.repeat(64) })
    ).rejects.toThrow('forbidden in production');
  });

  it('should throw if local mode has no private key', async () => {
    process.env.KMS_PROVIDER = 'local';
    process.env.NODE_ENV = 'development';
    delete process.env.SYNC_PRIVATE_KEY;
    delete process.env.PRIVATE_KEY;

    await expect(createSigner()).rejects.toThrow('requires a private key');
  });

  it('should create a LocalSigner from SYNC_PRIVATE_KEY env var', async () => {
    process.env.KMS_PROVIDER = 'local';
    process.env.NODE_ENV = 'development';
    process.env.SYNC_PRIVATE_KEY = '0x' + '4'.repeat(64);

    const signer = await createSigner();
    expect(signer).toBeInstanceOf(LocalSigner);
  });

  it('should create a LocalSigner from PRIVATE_KEY env var', async () => {
    process.env.KMS_PROVIDER = 'local';
    process.env.NODE_ENV = 'development';
    process.env.PRIVATE_KEY = '0x' + '5'.repeat(64);

    const signer = await createSigner();
    expect(signer).toBeInstanceOf(LocalSigner);
  });

  it('should default to local when KMS_PROVIDER is unset', async () => {
    delete process.env.KMS_PROVIDER;
    process.env.NODE_ENV = 'development';
    process.env.PRIVATE_KEY = '0x' + '6'.repeat(64);

    const signer = await createSigner();
    expect(signer).toBeInstanceOf(LocalSigner);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3. createLocalSigner Guard Tests
// ───────────────────────────────────────────────────────────────────────────

describe('createLocalSigner', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should return a LocalSigner in development', () => {
    process.env.NODE_ENV = 'development';
    const signer = createLocalSigner('0x' + '7'.repeat(64));
    expect(signer).toBeInstanceOf(LocalSigner);
  });

  it('should throw in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => createLocalSigner('0x' + '8'.repeat(64))).toThrow(
      'forbidden in production'
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 4. AWS KMS 地址推导测试
//
// [FIX 2026-10-02] 原两个用例是 it.skip（测试盲区），且各自有实质缺陷：
//   1. `should create KmsSigner with mock KMS client`：createSigner 内部自建
//      `new KMSClient(...)`（KmsSigner.ts:356），测试 mock 的是一个【局部】实例，
//      注入不进去 → 一旦去掉 skip 就会发起真实 AWS 网络调用（CI 里必然失败/挂起）。
//      改为直接测 static `deriveAddress(client, keyId)` —— 它接受注入的 client，
//      无需网络即可覆盖「取公钥 → 解析 SPKI → 推导地址」的完整链路。
//   2. `should derive address from a known test vector`：测试向量是伪造的
//      （hex 长度 131，为奇数；内容是 5a5e5a5e 填充，不是合法 secp256k1 点），
//      `Buffer.from` 会静默丢弃末尾半字节，且断言只检查 isAddress 格式、
//      不校验地址值 → 即使跑起来也测不出正确性。
//      改为用确定性私钥 0x11×32 派生的【真实】未压缩公钥，并断言推导出
//      与之对应的精确地址（0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A）。
// ───────────────────────────────────────────────────────────────────────────

/**
 * 真实 secp256k1 测试向量（非伪造）：
 * 私钥 0x1111…11（32×0x11）→ 未压缩公钥（0x04 + 64 字节）→ 地址。
 * 由 ethers SigningKey 确定性派生，可复现。
 */
const REAL_UNCOMPRESSED_PUBKEY_HEX =
  '044f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa' +
  '385b6b1b8ead809ca67454d9683fcf2ba03456d6fe2c4abe2b07f0fbdbb2f1c1';
const REAL_EXPECTED_ADDRESS = '0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A';
/** 标准 secp256k1 SPKI DER 前缀（AlgorithmIdentifier + BIT STRING 头 + unusedBits=0） */
const SPKI_PREFIX_HEX = '3056301006072a8648ce3d020106052b8104000a034200';

describe('KmsSigner.deriveAddress (AWS mode, injected client)', () => {
  it('should derive the correct address from a mocked KMS GetPublicKey response', async () => {
    // AWS KMS 的 GetPublicKey 返回 SPKI 包装的未压缩公钥
    const spki = Buffer.from(SPKI_PREFIX_HEX + REAL_UNCOMPRESSED_PUBKEY_HEX, 'hex');
    expect(spki.length).toBe(88); // SPKI 固定 88 字节

    const mockSend = vi.fn().mockResolvedValue({ PublicKey: new Uint8Array(spki) });
    // deriveAddress 只用到 client.send，注入最小替身即可（无需真实 KMSClient / 网络）
    const fakeClient = { send: mockSend } as any;
    const keyId = 'arn:aws:kms:us-east-1:123456789:key/test-key';

    const address = await KmsSigner.deriveAddress(fakeClient, keyId);

    expect(mockSend).toHaveBeenCalledTimes(1);
    // 确认传入的是 GetPublicKeyCommand 且带正确 KeyId
    const sentCommand = mockSend.mock.calls[0][0];
    expect(sentCommand.input).toMatchObject({ KeyId: keyId });
    expect(address.toLowerCase()).toBe(REAL_EXPECTED_ADDRESS.toLowerCase());
    expect(ethers.isAddress(address)).toBe(true);
  });

  it('should throw if KMS returns no public key', async () => {
    const fakeClient = { send: vi.fn().mockResolvedValue({}) } as any;
    await expect(
      KmsSigner.deriveAddress(fakeClient, 'test-key')
    ).rejects.toThrow('KMS GetPublicKey returned no public key');
  });

  it('should throw if AWS_KMS_KEY_ID is missing', async () => {
    delete process.env.AWS_KMS_KEY_ID;

    await expect(
      createSigner({
        provider: 'aws',
        awsRegion: 'us-east-1',
      })
    ).rejects.toThrow('AWS_KMS_KEY_ID');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 5. SPKI 解析 → 地址推导
// ───────────────────────────────────────────────────────────────────────────

describe('KmsSigner._deriveAddressFromPublicKey', () => {
  it('should derive the exact address from a real secp256k1 SPKI test vector', () => {
    const spki = Buffer.from(SPKI_PREFIX_HEX + REAL_UNCOMPRESSED_PUBKEY_HEX, 'hex');

    const address = KmsSigner._deriveAddressFromPublicKey(spki);

    // 断言精确地址值（原 skip 版本只断言 isAddress 格式，测不出推导是否正确）
    expect(address.toLowerCase()).toBe(REAL_EXPECTED_ADDRESS.toLowerCase());
    expect(ethers.isAddress(address)).toBe(true);
  });

  it('should derive the same address as ethers for the same key (交叉验证)', () => {
    // 交叉验证：独立用 ethers 从私钥推导，应与 SPKI 解析路径得到同一地址。
    // 这能捕获「DER 偏移量算错但恰好产出合法格式地址」这类静默错误。
    const wallet = new ethers.Wallet('0x' + '11'.repeat(32));
    const spki = Buffer.from(SPKI_PREFIX_HEX + REAL_UNCOMPRESSED_PUBKEY_HEX, 'hex');

    expect(KmsSigner._deriveAddressFromPublicKey(spki).toLowerCase()).toBe(
      wallet.address.toLowerCase()
    );
  });

  it('should reject a non-SPKI buffer', () => {
    // 首字节非 0x30（SEQUENCE）→ 必须报错，不能静默返回错误地址
    expect(() => KmsSigner._deriveAddressFromPublicKey(Buffer.alloc(88, 0x00))).toThrow(
      'Invalid SPKI: expected SEQUENCE'
    );
  });

  it('should reject an EC point that is not 65 bytes / not 0x04-prefixed', () => {
    // 合法 SPKI 外壳但 BIT STRING 里塞压缩公钥（33 字节，0x02 前缀）→ 必须报错
    const compressed = Buffer.from(
      '024f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa',
      'hex'
    );
    const badSpki = Buffer.concat([
      Buffer.from(SPKI_PREFIX_HEX, 'hex'),
      compressed,
      Buffer.alloc(88 - Buffer.from(SPKI_PREFIX_HEX, 'hex').length - compressed.length),
    ]);
    expect(() => KmsSigner._deriveAddressFromPublicKey(badSpki)).toThrow('Invalid EC point');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 6. DER 签名 → flat RSV 转换
//
// [FIX 2026-10-02 新增覆盖] 此前 _derToRSV 完全没有测试，导致外层 SEQUENCE 的
// offset 用错（`_readDerLength` 返回长度值 68~72，却当长度字段字节数用）长期未被发现——
// 任何合法 DER 签名都会解析失败，AWS KMS 的【签名】路径同样完全不可用。
// 测试向量由确定性私钥 0x11×32 真实签名后按 AWS KMS 的 DER 规则编码（含正数前导零）。
// ───────────────────────────────────────────────────────────────────────────

/** 按 AWS KMS 规则把 flat r/s 编成 DER：SEQUENCE { INTEGER r, INTEGER s } */
function encodeDer(rHex: string, sHex: string): Buffer {
  const encInt = (hex: string): Buffer => {
    let b = Buffer.from(hex.slice(2), 'hex');
    // DER INTEGER 是有符号的：最高位为 1 时必须补 0x00 前导字节表示正数
    if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0x00]), b]);
    return Buffer.concat([Buffer.from([0x02, b.length]), b]);
  };
  const body = Buffer.concat([encInt(rHex), encInt(sHex)]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}

/** _derToRSV 是实例私有方法，但不使用 kmsClient/keyId，可用最小替身构造实例调用 */
function makeSignerForDer(address: string, chainId?: number): any {
  return new KmsSigner({ send: vi.fn() } as any, 'test-key', address, undefined, chainId);
}

describe('KmsSigner._derToRSV (DER → flat RSV)', () => {
  const PK = '0x' + '11'.repeat(32);
  const wallet = new ethers.Wallet(PK);
  const msgHash = ethers.hashMessage('hello fidesorigin');

  it('should parse a real AWS-KMS-style DER signature into flat RSV', () => {
    const sig = new ethers.SigningKey(PK).sign(msgHash);
    const der = encodeDer(sig.r, sig.s);
    expect(der[0]).toBe(0x30); // 确认测试向量确实是 DER（而非 flat）

    const signer = makeSignerForDer(wallet.address);
    const flat = (signer as any)._derToRSV(der, msgHash, wallet.address);

    // r 必须原样保留；s 可能被 low-s 规范化；v 由恢复公钥反推得出
    expect(flat.slice(0, 66)).toBe(sig.r);
    expect(flat.length).toBe(66 + 64 + 2); // r(32B) + s(32B) + v(1B) = 65 字节
    // 最终校验：解析出的签名必须能恢复出签名者地址（比逐字节比对更本质）
    const recovered = ethers.recoverAddress(msgHash, flat);
    expect(recovered.toLowerCase()).toBe(wallet.address.toLowerCase());
  });

  it('should emit EIP-155 v for a chain-specific signature', () => {
    const sig = new ethers.SigningKey(PK).sign(msgHash);
    const der = encodeDer(sig.r, sig.s);
    const chainId = 11155111; // Sepolia
    const signer = makeSignerForDer(wallet.address, chainId);

    const flat = (signer as any)._derToRSV(der, msgHash, wallet.address, chainId);

    // r 部分必须原样保留（DER 解析正确的直接证据）
    expect(flat.slice(0, 66)).toBe(sig.r);
    // EIP-155 下 v = 35 + 2*chainId(+0/1)，对 Sepolia 是 22310257/22310258 →
    // hex '1546c71'/'1546c72'（7 位，奇数长度需补零成 8 位）。
    // 注意：此时 flat 不是 65 字节标准签名，无法喂给 recoverAddress（这是 EIP-155 的预期行为，
    // 交易序列化时由 Transaction.from 处理），故此处校验 v 的取值与字节对齐而非恢复地址。
    const vHex = flat.slice(130);
    expect(vHex.length % 2).toBe(0); // 必须补到偶数长度（否则 Signature.from 抛异常，R3-H7）
    const v = parseInt(vHex, 16);
    const baseV = 35 + chainId * 2;
    expect(v === baseV || v === baseV + 1).toBe(true);
    // r/s 结构仍完整：去掉 v 后应是 64 字节
    expect(flat.slice(0, 130).length).toBe(2 + 64 + 64);
  });

  it('should enforce low-s normalization (EIP-2 / BIP-62)', () => {
    const secp256k1N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
    const sig = new ethers.SigningKey(PK).sign(msgHash);
    // 故意构造 high-s：把 s 换成 N - s，恢复出的地址应仍正确（规范化后等价）
    const sVal = BigInt(sig.s);
    const highS = secp256k1N - sVal;
    const highSHex = '0x' + highS.toString(16).padStart(64, '0');
    const der = encodeDer(sig.r, highSHex);

    const signer = makeSignerForDer(wallet.address);
    const flat = (signer as any)._derToRSV(der, msgHash, wallet.address);

    // 输出的 s 必须是 low-s（<= N/2）
    const outS = BigInt('0x' + flat.slice(66, 130));
    expect(outS <= secp256k1N / BigInt(2)).toBe(true);
    expect(ethers.recoverAddress(msgHash, flat).toLowerCase()).toBe(
      wallet.address.toLowerCase()
    );
  });

  it('should reject a malformed DER signature (not a SEQUENCE)', () => {
    const signer = makeSignerForDer(wallet.address);
    expect(() =>
      (signer as any)._derToRSV(Buffer.alloc(71, 0x00), msgHash, wallet.address)
    ).toThrow('Invalid DER signature: expected SEQUENCE');
  });

  it('should reject a DER signature whose r exceeds the buffer (畸形长度防护)', () => {
    // 外层 SEQUENCE 合法，但 r 的长度字段声明超出实际缓冲区 → 必须拒绝而非静默截断
    // （截断会导致 r/s 错位且 offset 失步，产出错误签名）
    const bogus = Buffer.concat([
      Buffer.from([0x30, 0x44, 0x02, 0x40]), // SEQUENCE len=68, INTEGER r len=64
      Buffer.alloc(8, 0xaa), // 实际只有 8 字节，远小于 64
    ]);
    const signer = makeSignerForDer(wallet.address);
    expect(() => (signer as any)._derToRSV(bogus, msgHash, wallet.address)).toThrow(
      /r exceeds buffer|Invalid DER/
    );
  });
});
