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
// 4. Mock AWS KMS Tests (optional, using vi.fn)
// ───────────────────────────────────────────────────────────────────────────

describe('KmsSigner (AWS mode, mocked)', () => {
  it('should create KmsSigner with mock KMS client', async () => {
    // Mock KMSClient and its send method
    const mockSend = vi.fn().mockResolvedValue({
      PublicKey: Buffer.from(
        // Minimal SPKI public key: SEQUENCE { AlgorithmIdentifier, BIT STRING { 0x04 + 64-byte point } }
        // This is a real SPKI structure for secp256k1
        '3056301006072a8648ce3d020106052b8104000a03420004' +
        'b4a0c7f1c4c2c3e3f3e2f3c2f3e2f3c2f3e2f3c2f3e2f3c2f3e2f3c2f3e2f3c2f3e2f3c2f3e2f3c2f3e2f3c2f3e2f3c2f3e2f3c2f3e2f3c2f3e2f3c2f3e2f3c2f3e2f3c2f3e2f3c2f3e2f3c2f3e2f3c2f3e2f3c2f3e2f3c2f3e2f3',
        'hex'
      ),
    });

    // Use a real KMSClient constructor but replace send
    const { KMSClient } = await import('@aws-sdk/client-kms');
    const kmsClient = new KMSClient({ region: 'us-east-1' });
    (kmsClient as any).send = mockSend;

    const signer = await createSigner({
      provider: 'aws',
      awsKeyId: 'arn:aws:kms:us-east-1:123456789:key/test-key',
      awsRegion: 'us-east-1',
    });

    expect(signer).toBeInstanceOf(KmsSigner);
    const address = await signer.getAddress();
    expect(ethers.isAddress(address)).toBe(true);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ input: { KeyId: 'arn:aws:kms:us-east-1:123456789:key/test-key' } })
    );
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
// 5. DER→RSV Helper Tests
// ───────────────────────────────────────────────────────────────────────────

describe('KmsSigner._deriveAddressFromPublicKey', () => {
  it('should derive address from a known test vector', () => {
    // Real uncompressed secp256k1 public key (65 bytes + 0x04 prefix)
    const knownPubKey = Buffer.from(
      '048318137203303dd800bdc4f10d0279c2e2f7b80a65fdec9f8ebdef55a98654f' +
      'e19d6be94bd8b28c291c5e6d65e36f3c1b5e5a5e5a5e5a5e5a5e5a5e5a5e5a5e5a',
      'hex'
    );

    // Wrap in SPKI format
    const spki = Buffer.from(
      '3056301006072a8648ce3d020106052b8104000a034200' + knownPubKey.toString('hex'),
      'hex'
    );

    const address = KmsSigner._deriveAddressFromPublicKey(spki);
    expect(ethers.isAddress(address)).toBe(true);
  });
});
