import { ethers, JsonRpcProvider, Wallet, AbstractSigner, TypedDataDomain, TypedDataField } from 'ethers';
import { config } from './config';
import logger from './logger';

// ── Key Manager Interface ─────────────────────────────────────────────

export interface IKeyManager {
  getSigner(): Promise<AbstractSigner>;
  getAddress(): Promise<string>;
}

// ── KMS AbstractSigner (replaces dummy Wallet) ─────────────────────

/**
 * Custom AbstractSigner that routes all signing through AWS KMS.
 * Avoids creating a Wallet with a dummy all-zero private key.
 */
class KMSAbstractSigner extends AbstractSigner {
  constructor(
    private kmsClient: KMSClientType,
    private address: string,
    provider: JsonRpcProvider,
    private chainId: number,
    private signFn: (msgHash: string) => Promise<string>
  ) {
    super(provider);
  }

  connect(provider: JsonRpcProvider): KMSAbstractSigner {
    return new KMSAbstractSigner(
      this.kmsClient,
      this.address,
      provider,
      this.chainId,
      this.signFn
    );
  }

  async getAddress(): Promise<string> {
    return this.address;
  }

  async signTransaction(tx: any): Promise<string> {
    const populated = await this.populateTransaction(tx);
    const txObj = ethers.Transaction.from(populated);
    const unsignedHash = txObj.unsignedHash;
    const flatSig = await this.signFn(unsignedHash);
    // flatSig is 0x{r:64hex}{s:64hex}{v:2hex}
    const sig = ethers.Signature.from({
      r: flatSig.slice(0, 66),
      s: '0x' + flatSig.slice(66, 130),
      v: parseInt(flatSig.slice(130, 132), 16),
    });
    txObj.signature = sig;
    return txObj.serialized;
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
    const msgHash = ethers.hashMessage(message);
    return this.signFn(msgHash);
  }

  async signTypedData(
    domain: TypedDataDomain,
    types: Record<string, Array<TypedDataField>>,
    value: Record<string, any>
  ): Promise<string> {
    const typedHash = ethers.TypedDataEncoder.hash(domain, types, value);
    return this.signFn(typedHash);
  }
}

// ── Local Plaintext Key Manager (dev only) ────────────────────────────

class LocalKeyManager implements IKeyManager {
  private wallet: Wallet;

  constructor(privateKey: string, provider: JsonRpcProvider) {
    if (!privateKey.match(/^0x[0-9a-fA-F]{64}$/)) {
      throw new Error('Invalid private key format');
    }
    this.wallet = new Wallet(privateKey, provider);
    logger.info('[LocalKeyManager] Initialized', { address: this.wallet.address });
  }

  async getSigner(): Promise<Wallet> {
    return this.wallet;
  }

  async getAddress(): Promise<string> {
    return this.wallet.address;
  }
}

// ── AWS KMS Key Manager (production) ──────────────────────────────────

interface KMSClientType {
  send: (command: any) => Promise<any>;
}

class AWSKMSKeyManager implements IKeyManager {
  private keyId: string;
  private provider: JsonRpcProvider;
  private chainId: number;
  private cachedAddress?: string;
  private kmsClient?: KMSClientType;
  private publicKeyPromise?: Promise<Uint8Array>;

  constructor(keyId: string, provider: JsonRpcProvider, chainId: number, private region?: string) {
    this.keyId = keyId;
    this.provider = provider;
    this.chainId = chainId;
    logger.info('[AWSKMSKeyManager] Initialized', { keyId: keyId.substring(0, 20) + '...', region: region || 'default' });
  }

  /**
   * Lazily initialize and cache the KMS client.
   */
  private async getKMSClient(): Promise<KMSClientType> {
    if (!this.kmsClient) {
      const { KMSClient } = await import('@aws-sdk/client-kms');
      this.kmsClient = new KMSClient({
        ...(this.region ? { region: this.region } : {}),
      });
    }
    return this.kmsClient;
  }

  /**
   * Lazily fetch and cache the public key from KMS.
   */
  private async getPublicKey(): Promise<Uint8Array> {
    if (!this.publicKeyPromise) {
      this.publicKeyPromise = (async () => {
        const client = await this.getKMSClient();
        const { GetPublicKeyCommand } = await import('@aws-sdk/client-kms');
        const response = await client.send(new GetPublicKeyCommand({ KeyId: this.keyId }));
        if (!response.PublicKey) {
          throw new Error('KMS public key not available');
        }
        return response.PublicKey as Uint8Array;
      })();
    }
    return this.publicKeyPromise;
  }

  async getSigner(): Promise<AbstractSigner> {
    // Fetch public key (cached after first call)
    const publicKey = await this.getPublicKey();
    const address = this.deriveAddress(publicKey);
    this.cachedAddress = address;

    // Cache the client for signing operations
    const cachedClient = await this.getKMSClient();

    // Use AbstractSigner instead of creating a dummy Wallet with all-zero private key
    const signer = new KMSAbstractSigner(
      cachedClient,
      address,
      this.provider,
      this.chainId,
      (msgHash: string) => this.kmsSign(cachedClient, msgHash, address)
    );

    return signer;
  }

  async getAddress(): Promise<string> {
    if (this.cachedAddress) return this.cachedAddress;
    const publicKey = await this.getPublicKey();
    this.cachedAddress = this.deriveAddress(publicKey);
    return this.cachedAddress;
  }

  /**
   * Send a sign request to KMS and return a flat RSV hex signature.
   */
  private async kmsSign(client: KMSClientType, msgHash: string, address: string): Promise<string> {
    const { SignCommand } = await import('@aws-sdk/client-kms');
    const response = await client.send(new SignCommand({
      KeyId: this.keyId,
      Message: Buffer.from(msgHash.slice(2), 'hex'),
      MessageType: 'DIGEST',
      SigningAlgorithm: 'ECDSA_SHA_256',
    }));

    if (!response.Signature) {
      throw new Error('KMS signing failed: no signature returned');
    }

    return this.derToRSV(Buffer.from(response.Signature), msgHash, address);
  }

  /**
   * Derive Ethereum address from a KMS SPKI-encoded public key.
   *
   * KMS returns a DER-encoded SubjectPublicKeyInfo (SPKI):
   *   SubjectPublicKeyInfo ::= SEQUENCE {
   *     algorithm        AlgorithmIdentifier,
   *     subjectPublicKey BIT STRING
   *   }
   *
   * The BIT STRING contains the uncompressed EC point: 0x04 || x || y (65 bytes total).
   */
  private deriveAddress(publicKey: Uint8Array): string {
    const buf = Buffer.from(publicKey);
    let offset = 0;

    // Parse outer SEQUENCE
    if (buf[offset++] !== 0x30) {
      throw new Error('Invalid SPKI: expected SEQUENCE');
    }
    offset += this.readLength(buf, offset); // skip SEQUENCE length

    // Parse AlgorithmIdentifier SEQUENCE
    if (buf[offset++] !== 0x30) {
      throw new Error('Invalid SPKI: expected AlgorithmIdentifier SEQUENCE');
    }
    offset += this.readLength(buf, offset); // skip AlgorithmIdentifier length

    // Parse subjectPublicKey BIT STRING
    if (buf[offset++] !== 0x03) {
      throw new Error('Invalid SPKI: expected BIT STRING');
    }
    const bitStrLen = this.readLength(buf, offset);
    offset += this.lengthSize(buf, offset);
    const unusedBits = buf[offset++];
    if (unusedBits !== 0) {
      throw new Error('Invalid SPKI: unused bits in BIT STRING');
    }

    // The remaining bytes are the EC point
    const ecPoint = buf.subarray(offset, offset + bitStrLen - 1);
    if (ecPoint.length !== 65 || ecPoint[0] !== 0x04) {
      throw new Error(`Invalid EC point: expected 65 bytes starting with 0x04, got ${ecPoint.length} bytes starting with 0x${ecPoint[0]?.toString(16)}`);
    }

    // Exclude 0x04 prefix, hash with keccak256, take last 20 bytes
    const pubKeyNoPrefix = ecPoint.subarray(1);
    const hash = ethers.keccak256(pubKeyNoPrefix);
    return '0x' + hash.substring(26);
  }

  /**
   * Convert DER-encoded ECDSA signature to Ethereum flat RSV signature.
   *
   * DER signature format:
   *   ECDSA-Sig-Value ::= SEQUENCE {
   *     r  INTEGER,
   *     s  INTEGER
   *   }
   *
   * We try both canonical v values (27/28) and EIP-155 chain-specific v values.
   */
  private derToRSV(derSig: Buffer, msgHash: string, address: string): string {
    let offset = 0;

    // Verify SEQUENCE tag
    if (derSig[offset++] !== 0x30) {
      throw new Error('Invalid DER signature: expected SEQUENCE');
    }
    offset += this.readLength(derSig, offset); // skip SEQUENCE length

    // Parse r INTEGER
    if (derSig[offset++] !== 0x02) {
      throw new Error('Invalid DER signature: expected INTEGER for r');
    }
    const rLen = this.readLength(derSig, offset);
    offset += this.lengthSize(derSig, offset);
    // Skip leading zero byte in INTEGER if present (for positive numbers)
    let rStart = offset;
    if (derSig[rStart] === 0x00 && rLen > 32) {
      rStart++;
    }
    const r = derSig.subarray(rStart, rStart + Math.min(rLen, 32));
    offset += rLen;

    // Parse s INTEGER
    if (derSig[offset++] !== 0x02) {
      throw new Error('Invalid DER signature: expected INTEGER for s');
    }
    const sLen = this.readLength(derSig, offset);
    offset += this.lengthSize(derSig, offset);
    let sStart = offset;
    if (derSig[sStart] === 0x00 && sLen > 32) {
      sStart++;
    }
    const s = derSig.subarray(sStart, sStart + Math.min(sLen, 32));
    offset += sLen;

    const rHex = '0x' + r.toString('hex').padStart(64, '0');
    const sHex = '0x' + s.toString('hex').padStart(64, '0');

    // Normalize s to low-s (BIP-0062) to prevent signature malleability
    const sNormalized = this.normalizeS(sHex);

    // Determine recovery ID — try both canonical values first
    for (let v = 27; v <= 28; v++) {
      try {
        const pubKey = ethers.SigningKey.recoverPublicKey(msgHash, { r: rHex, s: sNormalized, v });
        const recoveredAddr = '0x' + ethers.keccak256('0x' + pubKey.slice(4)).slice(26);
        if (recoveredAddr.toLowerCase() === address.toLowerCase()) {
          return rHex + sNormalized.slice(2) + v.toString(16).padStart(2, '0');
        }
      } catch {
        // try next v
      }
    }

    // Try EIP-155 chain-specific v values
    const chainId = this.chainId;
    if (chainId > 0) {
      for (let recId = 0; recId <= 1; recId++) {
        try {
          const v = chainId * 2 + 35 + recId;
          const pubKey = ethers.SigningKey.recoverPublicKey(msgHash, { r: rHex, s: sNormalized, v });
          const recoveredAddr = '0x' + ethers.keccak256('0x' + pubKey.slice(4)).slice(26);
          if (recoveredAddr.toLowerCase() === address.toLowerCase()) {
            return rHex + sNormalized.slice(2) + v.toString(16).padStart(2, '0');
          }
        } catch {
          // try next recovery id
        }
      }
    }

    throw new Error('Unable to determine signature recovery ID — address mismatch');
  }

  /**
   * Normalize s to low-s value (BIP-0062) to prevent signature malleability.
   */
  private normalizeS(sHex: string): string {
    const s = BigInt(sHex);
    const n = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141'); // secp256k1 order
    const halfN = n / BigInt(2);
    if (s > halfN) {
      const normalized = n - s;
      return '0x' + normalized.toString(16).padStart(64, '0');
    }
    return sHex;
  }

  /**
   * Read ASN.1 length field and return the content length.
   */
  private readLength(buf: Buffer, offset: number): number {
    const firstByte = buf[offset];
    if ((firstByte & 0x80) === 0) {
      return firstByte;
    }
    const numBytes = firstByte & 0x7f;
    let length = 0;
    for (let i = 0; i < numBytes; i++) {
      length = (length << 8) | buf[offset + 1 + i];
    }
    return length;
  }

  /**
   * Return the number of bytes used by the ASN.1 length field.
   */
  private lengthSize(buf: Buffer, offset: number): number {
    const firstByte = buf[offset];
    if ((firstByte & 0x80) === 0) {
      return 1;
    }
    return 1 + (firstByte & 0x7f);
  }
}

// ── HashiCorp Vault Key Manager (optional fallback) ───────────────────

class VaultKeyManager implements IKeyManager {
  private vaultAddr: string;
  private secretPath: string;
  private keyName: string;
  private provider: JsonRpcProvider;
  private token?: string;
  private cachedAddress?: string;
  private cachedSigner?: AbstractSigner;

  constructor(vaultConfig: VaultConfig, provider: JsonRpcProvider) {
    this.vaultAddr = vaultConfig.addr;
    this.secretPath = vaultConfig.secretPath;
    this.keyName = vaultConfig.keyName;
    this.token = vaultConfig.token;
    this.provider = provider;
    logger.info('[VaultKeyManager] Initialized', { addr: this.vaultAddr, path: this.secretPath });
  }

  async getSigner(): Promise<AbstractSigner> {
    if (this.cachedSigner) return this.cachedSigner;

    try {
      // [Security Fix] VaultKeyManager fetches plaintext private key from Vault secrets engine.
      // This loads the key into process memory, which partially defeats Vault's protection.
      // For true HSM-level security, use Vault's transit engine with a custom AbstractSigner
      // instead of the secrets engine. This is documented as a known limitation.
      const privateKey = await this.fetchKey();
      const wallet = new Wallet(privateKey, this.provider);
      this.cachedAddress = wallet.address;

      // Best-effort cleanup: clear the private key string reference
      // NOTE: Strings are immutable in JS, so the value may still exist in memory until GC.
      // For production, migrate to Vault transit engine.
      try {
        const buf = Buffer.from(privateKey);
        buf.fill(0);
      } catch { /* ignore cleanup errors */ }

      logger.warn(
        '[VaultKeyManager] ⚠️ Signer created with secrets engine — private key was loaded into memory. ' +
        'For production, use Vault transit engine or AWS KMS.'
      );

      this.cachedSigner = wallet;
      return wallet;
    } catch (error) {
      logger.error('Failed to initialize Vault signer', { error: (error as Error).message });
      throw new Error('Vault signer initialization failed: ' + (error as Error).message);
    }
  }

  async getAddress(): Promise<string> {
    if (this.cachedAddress) return this.cachedAddress;
    const signer = await this.getSigner();
    return await signer.getAddress();
  }

  private async fetchKey(): Promise<string> {
    const url = `${this.vaultAddr}/v1/${this.secretPath}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['X-Vault-Token'] = this.token;

    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      throw new Error(`Vault fetch failed: ${resp.status} ${resp.statusText}`);
    }
    const data: any = await resp.json();
    const key = data.data?.data?.[this.keyName] ?? data.data?.[this.keyName];
    if (!key || !key.match(/^0x[0-9a-fA-F]{64}$/)) {
      throw new Error(`Invalid or missing key in Vault at ${this.secretPath}/${this.keyName}`);
    }
    return key;
  }
}

export interface VaultConfig {
  addr: string;
  secretPath: string;
  keyName: string;
  token?: string;
}

// ── Key Manager Factory ───────────────────────────────────────────────

export async function createKeyManager(provider: JsonRpcProvider): Promise<IKeyManager> {
  const { publisher } = config;

  // Priority 1: AWS KMS
  if (publisher.kmsProvider === 'aws' && publisher.kmsKeyId) {
    return new AWSKMSKeyManager(publisher.kmsKeyId, provider, publisher.chainId, publisher.awsRegion);
  }

  // Priority 2: HashiCorp Vault
  if (publisher.kmsProvider === 'vault' && publisher.vault) {
    return new VaultKeyManager(publisher.vault, provider);
  }

  // Priority 3: Azure (legacy, keep backward compat) — cast to IKeyManager
  if (publisher.kmsProvider === 'azure' && publisher.kmsKeyId) {
    const { createKeyManager: legacyCreate } = await import('./key-manager');
    return (await legacyCreate(provider)) as IKeyManager;
  }

  // Priority 4: Local plaintext (dev only) — REJECT in production
  if (publisher.privateKey) {
    if (config.env === 'production') {
      throw new Error(
        'SECURITY VIOLATION: Plaintext private keys are NOT allowed in production. ' +
        'Use AWS KMS (KMS_PROVIDER=aws + KMS_KEY_ID) or HashiCorp Vault (KMS_PROVIDER=vault).'
      );
    }
    logger.warn('[DEV ONLY] Using plaintext private key');
    return new LocalKeyManager(publisher.privateKey, provider);
  }

  throw new Error(
    'No key manager configured. Set one of:\n' +
    '  - KMS_PROVIDER=aws + KMS_KEY_ID\n' +
    '  - KMS_PROVIDER=vault + VAULT_ADDR + VAULT_SECRET_PATH + VAULT_KEY_NAME\n' +
    '  - PUBLISHER_PRIVATE_KEY (dev only)'
  );
}
