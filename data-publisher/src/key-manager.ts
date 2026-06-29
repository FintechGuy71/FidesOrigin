import { ethers, Signer, Wallet, JsonRpcProvider } from 'ethers';
import { config } from './config';
import logger from './logger';

/**
 * Abstract Key Manager — supports plain private key, AWS KMS, and Azure Key Vault
 */
export interface KeyManager {
  getSigner(): Promise<Signer>;
  getAddress(): Promise<string>;
}

/**
 * Plain private key manager (development / testing)
 */
class PlainKeyManager implements KeyManager {
  private wallet: Wallet;

  constructor(privateKey: string, provider: JsonRpcProvider) {
    if (!privateKey.match(/^0x[0-9a-fA-F]{64}$/)) {
      throw new Error('Invalid private key format');
    }
    this.wallet = new Wallet(privateKey, provider);
    logger.info('Initialized plain key manager', { address: this.wallet.address });
  }

  async getSigner(): Promise<Signer> {
    return this.wallet;
  }

  async getAddress(): Promise<string> {
    return this.wallet.address;
  }
}

/**
 * AWS KMS Key Manager (production)
 * Requires @aws-sdk/client-kms to be installed
 */
class AWSKMSKeyManager implements KeyManager {
  private keyId: string;
  private provider: JsonRpcProvider;
  private cachedAddress?: string;
  private cachedSigner?: Signer;
  private cachedClient?: any; // KMSClient

  constructor(keyId: string, provider: JsonRpcProvider) {
    this.keyId = keyId;
    this.provider = provider;
    logger.info('Initialized AWS KMS key manager', { keyId: keyId.substring(0, 20) + '...' });
  }

  async getSigner(): Promise<Signer> {
    if (this.cachedSigner) return this.cachedSigner;

    try {
      const { KMSClient, GetPublicKeyCommand, SignCommand } = await import('@aws-sdk/client-kms');
      const { secp256k1 } = await import('@noble/curves/secp256k1');
      const { keccak256 } = ethers;

      // Use cached client or create new one with configured region
      if (!this.cachedClient) {
        const region = config.publisher.awsRegion || process.env.AWS_REGION;
        this.cachedClient = new KMSClient(region ? { region } : {});
      }
      const client = this.cachedClient;

      // Get public key from KMS (cached after first call)
      if (!this.cachedAddress) {
        const pubKeyResponse = await client.send(new GetPublicKeyCommand({
          KeyId: this.keyId,
        }));

        if (!pubKeyResponse.PublicKey) {
          throw new Error('KMS public key not available');
        }

        // Derive Ethereum address from public key
        const pubKeyBuffer = Buffer.from(pubKeyResponse.PublicKey);
        const prefix = Buffer.from([0x04]);
        const startIndex = pubKeyBuffer.indexOf(prefix);
        if (startIndex === -1) throw new Error('Invalid DER public key');
        
        const rawPublicKey = pubKeyBuffer.subarray(startIndex, startIndex + 65);
        const publicKeyBytes = rawPublicKey.subarray(1);
        
        const hash = keccak256(publicKeyBytes);
        const address = '0x' + hash.substring(26);
        this.cachedAddress = address;
      }
      const address = this.cachedAddress;

      // Create custom signer using Wallet as base
      const dummyPrivateKey = '0x' + '00'.repeat(32);
      const wallet = new Wallet(dummyPrivateKey, this.provider);

      // Override sign methods
      (wallet as any).signTransaction = async (tx: any) => {
        const populated = await wallet.populateTransaction(tx);
        const txObj = ethers.Transaction.from(populated);
        const txBytes = txObj.unsignedHash;
        const signResponse = await client.send(new SignCommand({
          KeyId: this.keyId,
          Message: Buffer.from(txBytes.slice(2), 'hex'),
          MessageType: 'DIGEST',
          SigningAlgorithm: 'ECDSA_SHA_256',
        }));

        if (!signResponse.Signature) {
          throw new Error('KMS signing failed');
        }

        // Convert DER signature to RSV format
        const sigBuffer = Buffer.from(signResponse.Signature);
        const rLen = sigBuffer[3];
        const r = sigBuffer.subarray(4, 4 + rLen);
        const sStart = 4 + rLen + 2;
        const sLen = sigBuffer[sStart - 1];
        const s = sigBuffer.subarray(sStart, sStart + sLen);

        const sHex = '0x' + s.toString('hex').padStart(64, '0');
        const sBig = BigInt(sHex);
        const n = secp256k1.CURVE.n;
        const sNormalized = sBig > n / 2n ? n - sBig : sBig;

        const rHex = '0x' + r.toString('hex').padStart(64, '0');
        const sNormHex = '0x' + sNormalized.toString(16).padStart(64, '0');

        const network = await this.provider.getNetwork();
        const chainId = BigInt(network.chainId);
        let recId: bigint | null = null;

        for (const v of [27n, 28n]) {
          try {
            const recovered = ethers.recoverAddress(txBytes, { r: rHex, s: sNormHex, v });
            if (recovered.toLowerCase() === this.cachedAddress!.toLowerCase()) {
              recId = v;
              break;
            }
          } catch {
            continue;
          }
        }

        if (recId === null && chainId > 0n) {
          const baseV = chainId * 2n + 35n;
          for (let v = 0n; v <= 1n; v++) {
            try {
              const recovered = ethers.recoverAddress(txBytes, { r: rHex, s: sNormHex, v: baseV + v });
              if (recovered.toLowerCase() === this.cachedAddress!.toLowerCase()) {
                recId = baseV + v;
                break;
              }
            } catch {
              continue;
            }
          }
        }

        if (recId === null) {
          throw new Error('Unable to determine signature recovery ID — address mismatch');
        }

        const flatSig = rHex + sNormHex.slice(2) + recId.toString(16).padStart(2, '0');
        const sig = ethers.Signature.from({
          r: flatSig.slice(0, 66),
          s: '0x' + flatSig.slice(66, 130),
          v: parseInt(flatSig.slice(130, 132), 16),
        });
        txObj.signature = sig;
        return txObj.serialized;
      };

      // Cache the signer for reuse
      this.cachedSigner = wallet as Signer;
      return this.cachedSigner;
    } catch (error) {
      logger.error('Failed to initialize AWS KMS signer', { error });
      throw new Error('AWS KMS signer initialization failed: ' + (error as Error).message);
    }
  }

  async getAddress(): Promise<string> {
    if (this.cachedAddress) return this.cachedAddress;
    await this.getSigner();
    if (!this.cachedAddress) throw new Error('AWS KMS address not available');
    return this.cachedAddress;
  }
}

/**
 * Azure Key Vault Key Manager (production)
 */
class AzureKeyVaultManager implements KeyManager {
  private keyId: string;
  private provider: JsonRpcProvider;
  private cachedAddress?: string;
  private cachedSigner?: Signer;

  constructor(keyId: string, provider: JsonRpcProvider) {
    this.keyId = keyId;
    this.provider = provider;
    logger.info('Initialized Azure Key Vault key manager', { keyId: keyId.substring(0, 30) + '...' });
  }

  async getSigner(): Promise<Signer> {
    if (this.cachedSigner) return this.cachedSigner;

    try {
      const { DefaultAzureCredential } = await import('@azure/identity');
      const { KeyClient, CryptographyClient } = await import('@azure/keyvault-keys');
      const credential = new DefaultAzureCredential();
      const keyVaultUrl = this.keyId.split('/keys/')[0];
      const keyName = this.keyId.split('/keys/')[1]?.split('/')[0] || '';

      const keyClient = new KeyClient(keyVaultUrl, credential);
      const keyBundle = await keyClient.getKey(keyName);
      
      // Get cryptography client
      const cryptoClient = new CryptographyClient(this.keyId, credential);

      // Create custom signer using Wallet as base
      const dummyPrivateKey = '0x' + '00'.repeat(32);
      const wallet = new Wallet(dummyPrivateKey, this.provider);

      // Derive address from public key (cache after first derivation)
      if (!this.cachedAddress) {
        const address = await this.deriveAddress(keyBundle.key);
        this.cachedAddress = address;
      }
      const address = this.cachedAddress;

      (wallet as any).getAddress = async () => address;
      (wallet as any).signTransaction = async (tx: any) => {
        const populated = await wallet.populateTransaction(tx);
        const txObj = ethers.Transaction.from(populated);
        const txBytes = txObj.unsignedHash;
        const signResult = await cryptoClient.sign('ES256K', Buffer.from(txBytes.slice(2), 'hex'));
        
        const r = '0x' + Buffer.from(signResult.result).slice(0, 32).toString('hex');
        const s = '0x' + Buffer.from(signResult.result).slice(32).toString('hex');

        const network = await this.provider.getNetwork();
        const chainId = BigInt(network.chainId);
        let recId: bigint | null = null;

        for (const v of [27n, 28n]) {
          try {
            const recovered = ethers.recoverAddress(txBytes, { r, s, v });
            if (recovered.toLowerCase() === this.cachedAddress!.toLowerCase()) {
              recId = v;
              break;
            }
          } catch {
            continue;
          }
        }

        if (recId === null && chainId > 0n) {
          const baseV = chainId * 2n + 35n;
          for (let v = 0n; v <= 1n; v++) {
            try {
              const recovered = ethers.recoverAddress(txBytes, { r, s, v: baseV + v });
              if (recovered.toLowerCase() === this.cachedAddress!.toLowerCase()) {
                recId = baseV + v;
                break;
              }
            } catch {
              continue;
            }
          }
        }

        if (recId === null) {
          throw new Error('Azure Key Vault: unable to recover valid recovery id');
        }

        const flatSig = r + s.slice(2) + recId.toString(16).padStart(2, '0');
        const sig = ethers.Signature.from({
          r: flatSig.slice(0, 66),
          s: '0x' + flatSig.slice(66, 130),
          v: parseInt(flatSig.slice(130, 132), 16),
        });
        txObj.signature = sig;
        return txObj.serialized;
      };

      // Cache the signer for reuse
      this.cachedSigner = wallet as Signer;
      return this.cachedSigner;
    } catch (error) {
      logger.error('Failed to initialize Azure Key Vault signer', { error });
      throw new Error('Azure Key Vault signer initialization failed: ' + (error as Error).message);
    }
  }

  private async deriveAddress(key: any): Promise<string> {
    const x = Buffer.from(key.x!, 'base64');
    const y = Buffer.from(key.y!, 'base64');
    const pubKey = Buffer.concat([Buffer.from([0x04]), x, y]);
    const hash = ethers.keccak256(pubKey.slice(1));
    return '0x' + hash.slice(26);
  }

  async getAddress(): Promise<string> {
    if (this.cachedAddress) return this.cachedAddress;
    await this.getSigner();
    if (!this.cachedAddress) throw new Error('Azure Key Vault address not available');
    return this.cachedAddress;
  }
}

/**
 * Factory function to create the appropriate key manager
 */
export async function createKeyManager(provider: JsonRpcProvider): Promise<KeyManager> {
  const { publisher } = config;

  if (publisher.kmsProvider === 'aws' && publisher.kmsKeyId) {
    return new AWSKMSKeyManager(publisher.kmsKeyId, provider);
  }

  if (publisher.kmsProvider === 'azure' && publisher.kmsKeyId) {
    return new AzureKeyVaultManager(publisher.kmsKeyId, provider);
  }

  if (publisher.privateKey) {
    return new PlainKeyManager(publisher.privateKey, provider);
  }

  throw new Error('No key manager configured. Set PUBLISHER_PRIVATE_KEY or KMS_PROVIDER + KMS_KEY_ID');
}
