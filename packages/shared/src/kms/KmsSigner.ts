/**
 * KmsSigner.ts — Unified KMS Signer for FidesOrigin
 *
 * Provides a production-ready AWS KMS signer and a local development fallback
 * that conforms to the ethers v6 AbstractSigner interface.
 *
 * Architecture:
 *   ┌─────────────────┐     ┌──────────────────┐
 *   │   createSigner  │────▶│   KmsSigner      │
 *   │   (factory)     │     │  (AbstractSigner) │
 *   └─────────────────┘     └──────────────────┘
 *          │                        │
 *          ├─ KMS_PROVIDER=aws ────▶│─▶ AWS KMS (GetPublicKey + Sign)
 *          └─ KMS_PROVIDER=local ───▶│─▶ ethers.Wallet (dev only)
 *
 * Security:
 *   - Production: private key NEVER leaves AWS KMS
 *   - Local: require() guarded by env check to avoid accidental prod use
 *   - s normalization (low-s) enforced to prevent malleability attacks
 *
 * @see https://docs.ethers.io/v6/api/providers/abstract-signer/
 */

import {
  AbstractSigner,
  Provider,
  Transaction,
  Signature,
  ethers,
  SigningKey,
  TransactionLike,
  TypedDataDomain,
  TypedDataField,
  Signer,
} from 'ethers';
import {
  KMSClient,
  GetPublicKeyCommand,
  SignCommand,
  SignCommandOutput,
} from '@aws-sdk/client-kms';

// ───────────────────────────────────────────────────────────────────────────
// 1. KMS Provider Type
// ───────────────────────────────────────────────────────────────────────────

export type KmsProvider = 'aws' | 'local';

export interface KmsSignerConfig {
  provider?: KmsProvider;           // 'aws' | 'local'
  awsKeyId?: string;                // AWS KMS Key ID (arn, alias, or raw key id)
  awsRegion?: string;              // AWS Region
  localPrivateKey?: string;        // Fallback: raw hex private key (dev only)
  providerInstance?: Provider;      // Ethers provider
}

// ───────────────────────────────────────────────────────────────────────────
// 2. AWS KMS Signer
// ───────────────────────────────────────────────────────────────────────────

export class KmsSigner extends AbstractSigner {
  private readonly _kmsClient: KMSClient;
  private readonly _keyId: string;
  private readonly _address: string;

  constructor(kmsClient: KMSClient, keyId: string, address: string, provider?: Provider) {
    super(provider);
    this._kmsClient = kmsClient;
    this._keyId = keyId;
    this._address = address;
  }

  async getAddress(): Promise<string> {
    return this._address;
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
    const msgHash = ethers.hashMessage(message);
    return this._kmsSign(msgHash);
  }

  async signTransaction(tx: TransactionLike): Promise<string> {
    const populated = await this.populateTransaction(tx);
    const txObj = Transaction.from(populated);
    const unsignedHash = txObj.unsignedHash;
    const flatSig = await this._kmsSign(unsignedHash);
    const sig = Signature.from(flatSig);
    txObj.signature = sig;
    return txObj.serialized;
  }

  async signTypedData(
    domain: TypedDataDomain,
    types: Record<string, TypedDataField[]>,
    value: Record<string, unknown>
  ): Promise<string> {
    const msgHash = ethers.TypedDataEncoder.hash(domain, types, value);
    return this._kmsSign(msgHash);
  }

  connect(provider: Provider): KmsSigner {
    return new KmsSigner(this._kmsClient, this._keyId, this._address, provider);
  }

  // ─── Internal: AWS KMS Sign + DER→RSV conversion ─────────────────────────

  private async _kmsSign(msgHash: string): Promise<string> {
    const response: SignCommandOutput = await this._kmsClient.send(
      new SignCommand({
        KeyId: this._keyId,
        Message: Buffer.from(msgHash.slice(2), 'hex'),
        MessageType: 'DIGEST',
        SigningAlgorithm: 'ECDSA_SHA_256',
      })
    );

    if (!response.Signature) {
      throw new Error('KMS signing failed: no signature returned');
    }

    return this._derToRSV(
      Buffer.from(response.Signature),
      msgHash,
      this._address
    );
  }

  /**
   * Convert DER-encoded ECDSA signature to flat RSV hex string.
   * Handles s-normalization (low-s) and v recovery.
   */
  private _derToRSV(derSig: Buffer, msgHash: string, address: string): string {
    let offset = 0;

    // SEQUENCE
    if (derSig[offset++] !== 0x30) {
      throw new Error('Invalid DER signature: expected SEQUENCE');
    }
    offset += this._readDerLength(derSig, offset);

    // INTEGER r
    if (derSig[offset++] !== 0x02) {
      throw new Error('Invalid DER signature: expected INTEGER for r');
    }
    const rLen = this._readDerLength(derSig, offset);
    offset += this._derLengthSize(derSig, offset);
    let rStart = offset;
    if (derSig[rStart] === 0x00 && rLen > 32) rStart++;
    const r = derSig.subarray(rStart, rStart + Math.min(rLen, 32));
    offset += rLen;

    // INTEGER s
    if (derSig[offset++] !== 0x02) {
      throw new Error('Invalid DER signature: expected INTEGER for s');
    }
    const sLen = this._readDerLength(derSig, offset);
    offset += this._derLengthSize(derSig, offset);
    let sStart = offset;
    if (derSig[sStart] === 0x00 && sLen > 32) sStart++;
    const s = derSig.subarray(sStart, sStart + Math.min(sLen, 32));

    const rHex = '0x' + r.toString('hex').padStart(64, '0');
    const sHex = '0x' + s.toString('hex').padStart(64, '0');

    // s-normalization: enforce low-s (BIP-62 / EIP-2)
    const secp256k1N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
    const halfN = secp256k1N / BigInt(2);
    const sVal = BigInt(sHex);
    const sNormalized =
      sVal > halfN
        ? '0x' + (secp256k1N - sVal).toString(16).padStart(64, '0')
        : sHex;

    // Recovery ID brute-force
    for (let v = 27; v <= 28; v++) {
      try {
        const pubKey = SigningKey.recoverPublicKey(msgHash, {
          r: rHex,
          s: sNormalized,
          v,
        });
        const recovered =
          '0x' + ethers.keccak256('0x' + pubKey.slice(4)).slice(26);
        if (recovered.toLowerCase() === address.toLowerCase()) {
          return rHex + sNormalized.slice(2) + v.toString(16).padStart(2, '0');
        }
      } catch {
        // try next v
      }
    }
    throw new Error('Unable to determine signature recovery ID');
  }

  private _readDerLength(buf: Buffer, offset: number): number {
    const firstByte = buf[offset];
    if ((firstByte & 0x80) === 0) return firstByte;
    const numBytes = firstByte & 0x7f;
    let length = 0;
    for (let i = 0; i < numBytes; i++) {
      length = (length << 8) | buf[offset + 1 + i];
    }
    return length;
  }

  private _derLengthSize(buf: Buffer, offset: number): number {
    const firstByte = buf[offset];
    if ((firstByte & 0x80) === 0) return 1;
    return 1 + (firstByte & 0x7f);
  }

  // ─── Static: derive Ethereum address from AWS KMS public key ─────────────

  static async deriveAddress(
    kmsClient: KMSClient,
    keyId: string
  ): Promise<string> {
    const response = await kmsClient.send(
      new GetPublicKeyCommand({ KeyId: keyId })
    );
    if (!response.PublicKey) {
      throw new Error('KMS GetPublicKey returned no public key');
    }
    return this._deriveAddressFromPublicKey(
      Buffer.from(response.PublicKey)
    );
  }

  static _deriveAddressFromPublicKey(publicKey: Buffer): string {
    const buf = publicKey;
    let offset = 0;

    // Parse outer SEQUENCE
    if (buf[offset++] !== 0x30) {
      throw new Error('Invalid SPKI: expected SEQUENCE');
    }
    offset += this._readAsn1Length(buf, offset);

    // Parse AlgorithmIdentifier SEQUENCE
    if (buf[offset++] !== 0x30) {
      throw new Error('Invalid SPKI: expected AlgorithmIdentifier SEQUENCE');
    }
    const algoLen = this._readAsn1Length(buf, offset);
    offset += this._asn1LengthSize(buf, offset);
    offset += algoLen;

    // Parse subjectPublicKey BIT STRING
    if (buf[offset++] !== 0x03) {
      throw new Error('Invalid SPKI: expected BIT STRING');
    }
    const bitStrLen = this._readAsn1Length(buf, offset);
    offset += this._asn1LengthSize(buf, offset);
    const unusedBits = buf[offset++];
    if (unusedBits !== 0) {
      throw new Error('Invalid SPKI: unused bits in BIT STRING');
    }

    const ecPoint = buf.subarray(offset, offset + bitStrLen - 1);
    if (ecPoint.length !== 65 || ecPoint[0] !== 0x04) {
      throw new Error(
        `Invalid EC point: expected 65 bytes starting with 0x04, got ${ecPoint.length} bytes`
      );
    }

    const pubKeyNoPrefix = ecPoint.subarray(1);
    const hash = ethers.keccak256(pubKeyNoPrefix);
    return '0x' + hash.substring(26);
  }

  private static _readAsn1Length(buf: Buffer, offset: number): number {
    const firstByte = buf[offset];
    if ((firstByte & 0x80) === 0) return firstByte;
    const numBytes = firstByte & 0x7f;
    let length = 0;
    for (let i = 0; i < numBytes; i++) {
      length = (length << 8) | buf[offset + 1 + i];
    }
    return length;
  }

  private static _asn1LengthSize(buf: Buffer, offset: number): number {
    const firstByte = buf[offset];
    if ((firstByte & 0x80) === 0) return 1;
    return 1 + (firstByte & 0x7f);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 3. Local Development Fallback (ethers.Wallet)
// ───────────────────────────────────────────────────────────────────────────

export class LocalSigner extends ethers.Wallet {
  private readonly _pk: string;

  constructor(privateKey: string, provider?: Provider) {
    super(privateKey, provider);
    this._pk = privateKey;
  }

  connect(provider: Provider): LocalSigner {
    return new LocalSigner(this._pk, provider);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 4. Factory: createSigner()
// ───────────────────────────────────────────────────────────────────────────

export async function createSigner(
  config?: KmsSignerConfig
): Promise<Signer> {
  const provider =
    config?.providerInstance ??
    (config?.awsRegion
      ? undefined
      : undefined);

  const kmsProvider: KmsProvider =
    config?.provider ??
    (process.env.KMS_PROVIDER as KmsProvider) ??
    'local'; // fallback to local if no env set

  // ─── AWS KMS Mode ──────────────────────────────────────────────────────
  if (kmsProvider === 'aws') {
    const keyId = config?.awsKeyId ?? process.env.AWS_KMS_KEY_ID;
    const region = config?.awsRegion ?? process.env.AWS_REGION ?? 'us-east-1';

    if (!keyId) {
      throw new Error(
        'KMS_PROVIDER=aws requires AWS_KMS_KEY_ID (or config.awsKeyId)'
      );
    }

    const kmsClient = new KMSClient({ region });
    const address = await KmsSigner.deriveAddress(kmsClient, keyId);
    return new KmsSigner(kmsClient, keyId, address, provider);
  }

  // ─── Local Mode ────────────────────────────────────────────────────────
  if (kmsProvider === 'local') {
    // Guard: local mode is NOT allowed in production
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'KMS_PROVIDER=local is forbidden in production. ' +
        'Set KMS_PROVIDER=aws and configure AWS_KMS_KEY_ID.'
      );
    }

    const privateKey =
      config?.localPrivateKey ??
      process.env.SYNC_PRIVATE_KEY ??
      process.env.PRIVATE_KEY;

    // [MEDIUM Fix #11] 安全建议：避免通过环境变量传递私钥明文
    // 环境变量在 /proc/<pid>/environ 中可见，且可能被日志记录。
    // 推荐使用 PRIVATE_KEY_FILE 环境变量指向文件路径，从文件读取私钥。
    // 示例：export PRIVATE_KEY_FILE=/run/secrets/private_key
    if (process.env.PRIVATE_KEY) {
      // 仅警告但不阻止使用（向后兼容）
      console.warn(
        '[Security Warning] PRIVATE_KEY is set as environment variable. ' +
        'Consider using PRIVATE_KEY_FILE instead to avoid exposing the key in /proc/environ or process logs.'
      );
    }
    // [MEDIUM Fix #11] 支持 PRIVATE_KEY_FILE 作为更安全的替代方案
    const privateKeyFromFile = process.env.PRIVATE_KEY_FILE
      ? (() => {
          try {
            const fs = require('fs');
            return fs.readFileSync(process.env.PRIVATE_KEY_FILE!, 'utf-8').trim();
          } catch (e) {
            throw new Error(
              `Failed to read private key from PRIVATE_KEY_FILE: ${process.env.PRIVATE_KEY_FILE}. Error: ${(e as Error).message}`
            );
          }
        })()
      : null;
    const finalPrivateKey = privateKeyFromFile ?? privateKey;

    if (!finalPrivateKey) {
      throw new Error(
        'KMS_PROVIDER=local requires a private key via ' +
        'config.localPrivateKey, SYNC_PRIVATE_KEY, PRIVATE_KEY, or PRIVATE_KEY_FILE'
      );
    }

    return new LocalSigner(finalPrivateKey, provider);
  }

  throw new Error(
    `Unknown KMS_PROVIDER: "${kmsProvider}". Expected "aws" or "local".`
  );
}

// Convenience: synchronous factory that returns a local Wallet immediately
// (for backwards compatibility with code that expects a synchronous signer)
export function createLocalSigner(
  privateKey: string,
  provider?: Provider
): LocalSigner {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('createLocalSigner is forbidden in production');
  }
  return new LocalSigner(privateKey, provider);
}
