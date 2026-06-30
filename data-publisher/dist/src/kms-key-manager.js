"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createKeyManager = createKeyManager;
const ethers_1 = require("ethers");
const config_1 = require("./config");
const logger_1 = __importDefault(require("./logger"));
// ── Local Plaintext Key Manager (dev only) ────────────────────────────
class LocalKeyManager {
    wallet;
    constructor(privateKey, provider) {
        if (!privateKey.match(/^0x[0-9a-fA-F]{64}$/)) {
            throw new Error('Invalid private key format');
        }
        this.wallet = new ethers_1.Wallet(privateKey, provider);
        logger_1.default.info('[LocalKeyManager] Initialized', { address: this.wallet.address });
    }
    async getSigner() {
        return this.wallet;
    }
    async getAddress() {
        return this.wallet.address;
    }
}
class AWSKMSKeyManager {
    keyId;
    provider;
    chainId;
    cachedAddress;
    kmsClient;
    publicKeyPromise;
    constructor(keyId, provider, chainId) {
        this.keyId = keyId;
        this.provider = provider;
        this.chainId = chainId;
        logger_1.default.info('[AWSKMSKeyManager] Initialized', { keyId: keyId.substring(0, 20) + '...' });
    }
    /**
     * Lazily initialize and cache the KMS client.
     */
    async getKMSClient() {
        if (!this.kmsClient) {
            const { KMSClient } = await Promise.resolve().then(() => __importStar(require('@aws-sdk/client-kms')));
            this.kmsClient = new KMSClient({});
        }
        return this.kmsClient;
    }
    /**
     * Lazily fetch and cache the public key from KMS.
     */
    async getPublicKey() {
        if (!this.publicKeyPromise) {
            this.publicKeyPromise = (async () => {
                const client = await this.getKMSClient();
                const { GetPublicKeyCommand } = await Promise.resolve().then(() => __importStar(require('@aws-sdk/client-kms')));
                const response = await client.send(new GetPublicKeyCommand({ KeyId: this.keyId }));
                if (!response.PublicKey) {
                    throw new Error('KMS public key not available');
                }
                return response.PublicKey;
            })();
        }
        return this.publicKeyPromise;
    }
    async getSigner() {
        // Fetch public key (cached after first call)
        const publicKey = await this.getPublicKey();
        const address = this.deriveAddress(publicKey);
        this.cachedAddress = address;
        // Create a dummy wallet — we override ALL signing methods
        const dummyPrivateKey = '0x' + '00'.repeat(32);
        const wallet = new ethers_1.Wallet(dummyPrivateKey, this.provider);
        // Cache the client for signing operations
        const cachedClient = await this.getKMSClient();
        // ── Override signTransaction ─────────────────────────────────────
        wallet.signTransaction = async (tx) => {
            const unsignedHash = ethers_1.ethers.Transaction.from(tx).unsignedHash;
            const signature = await this.kmsSign(cachedClient, unsignedHash, address);
            return signature;
        };
        // ── Override signMessage ─────────────────────────────────────────
        wallet.signMessage = async (message) => {
            const msgHash = ethers_1.ethers.hashMessage(message);
            const signature = await this.kmsSign(cachedClient, msgHash, address);
            return signature;
        };
        // ── Override signTypedData ───────────────────────────────────────
        wallet.signTypedData = async (domain, types, value) => {
            const typedHash = ethers_1.ethers.TypedDataEncoder.hash(domain, types, value);
            const signature = await this.kmsSign(cachedClient, typedHash, address);
            return signature;
        };
        return wallet;
    }
    async getAddress() {
        if (this.cachedAddress)
            return this.cachedAddress;
        const publicKey = await this.getPublicKey();
        this.cachedAddress = this.deriveAddress(publicKey);
        return this.cachedAddress;
    }
    /**
     * Send a sign request to KMS and return a flat RSV hex signature.
     */
    async kmsSign(client, msgHash, address) {
        const { SignCommand } = await Promise.resolve().then(() => __importStar(require('@aws-sdk/client-kms')));
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
    deriveAddress(publicKey) {
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
        const hash = ethers_1.ethers.keccak256(pubKeyNoPrefix);
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
    derToRSV(derSig, msgHash, address) {
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
                const pubKey = ethers_1.ethers.SigningKey.recoverPublicKey(msgHash, { r: rHex, s: sNormalized, v });
                const recoveredAddr = '0x' + ethers_1.ethers.keccak256('0x' + pubKey.slice(4)).slice(26);
                if (recoveredAddr.toLowerCase() === address.toLowerCase()) {
                    return rHex + sNormalized.slice(2) + v.toString(16).padStart(2, '0');
                }
            }
            catch {
                // try next v
            }
        }
        // Try EIP-155 chain-specific v values
        const chainId = this.chainId;
        if (chainId > 0) {
            for (let recId = 0; recId <= 1; recId++) {
                try {
                    const v = chainId * 2 + 35 + recId;
                    const pubKey = ethers_1.ethers.SigningKey.recoverPublicKey(msgHash, { r: rHex, s: sNormalized, v });
                    const recoveredAddr = '0x' + ethers_1.ethers.keccak256('0x' + pubKey.slice(4)).slice(26);
                    if (recoveredAddr.toLowerCase() === address.toLowerCase()) {
                        return rHex + sNormalized.slice(2) + v.toString(16).padStart(2, '0');
                    }
                }
                catch {
                    // try next recovery id
                }
            }
        }
        throw new Error('Unable to determine signature recovery ID — address mismatch');
    }
    /**
     * Normalize s to low-s value (BIP-0062) to prevent signature malleability.
     */
    normalizeS(sHex) {
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
    readLength(buf, offset) {
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
    lengthSize(buf, offset) {
        const firstByte = buf[offset];
        if ((firstByte & 0x80) === 0) {
            return 1;
        }
        return 1 + (firstByte & 0x7f);
    }
}
// ── HashiCorp Vault Key Manager (optional fallback) ───────────────────
class VaultKeyManager {
    vaultAddr;
    secretPath;
    keyName;
    provider;
    token;
    cachedAddress;
    constructor(vaultConfig, provider) {
        this.vaultAddr = vaultConfig.addr;
        this.secretPath = vaultConfig.secretPath;
        this.keyName = vaultConfig.keyName;
        this.token = vaultConfig.token;
        this.provider = provider;
        logger_1.default.info('[VaultKeyManager] Initialized', { addr: this.vaultAddr, path: this.secretPath });
    }
    async getSigner() {
        try {
            const privateKey = await this.fetchKey();
            const wallet = new ethers_1.Wallet(privateKey, this.provider);
            this.cachedAddress = wallet.address;
            logger_1.default.info('[VaultKeyManager] Signer created', { address: wallet.address });
            return wallet;
        }
        catch (error) {
            logger_1.default.error('Failed to initialize Vault signer', { error: error.message });
            throw new Error('Vault signer initialization failed: ' + error.message);
        }
    }
    async getAddress() {
        if (this.cachedAddress)
            return this.cachedAddress;
        const signer = await this.getSigner();
        return await signer.getAddress();
    }
    async fetchKey() {
        const url = `${this.vaultAddr}/v1/${this.secretPath}`;
        const headers = { 'Content-Type': 'application/json' };
        if (this.token)
            headers['X-Vault-Token'] = this.token;
        const resp = await fetch(url, { headers });
        if (!resp.ok) {
            throw new Error(`Vault fetch failed: ${resp.status} ${resp.statusText}`);
        }
        const data = await resp.json();
        const key = data.data?.data?.[this.keyName] ?? data.data?.[this.keyName];
        if (!key || !key.match(/^0x[0-9a-fA-F]{64}$/)) {
            throw new Error(`Invalid or missing key in Vault at ${this.secretPath}/${this.keyName}`);
        }
        return key;
    }
}
// ── Key Manager Factory ───────────────────────────────────────────────
async function createKeyManager(provider) {
    const { publisher } = config_1.config;
    // Priority 1: AWS KMS
    if (publisher.kmsProvider === 'aws' && publisher.kmsKeyId) {
        return new AWSKMSKeyManager(publisher.kmsKeyId, provider, publisher.chainId);
    }
    // Priority 2: HashiCorp Vault
    if (publisher.kmsProvider === 'vault' && publisher.vault) {
        return new VaultKeyManager(publisher.vault, provider);
    }
    // Priority 3: Azure (legacy, keep backward compat) — cast to IKeyManager
    if (publisher.kmsProvider === 'azure' && publisher.kmsKeyId) {
        const { createKeyManager: legacyCreate } = await Promise.resolve().then(() => __importStar(require('./key-manager')));
        return (await legacyCreate(provider));
    }
    // Priority 4: Local plaintext (dev only) — REJECT in production
    if (publisher.privateKey) {
        if (config_1.config.env === 'production') {
            throw new Error('SECURITY VIOLATION: Plaintext private keys are NOT allowed in production. ' +
                'Use AWS KMS (KMS_PROVIDER=aws + KMS_KEY_ID) or HashiCorp Vault (KMS_PROVIDER=vault).');
        }
        logger_1.default.warn('[DEV ONLY] Using plaintext private key');
        return new LocalKeyManager(publisher.privateKey, provider);
    }
    throw new Error('No key manager configured. Set one of:\n' +
        '  - KMS_PROVIDER=aws + KMS_KEY_ID\n' +
        '  - KMS_PROVIDER=vault + VAULT_ADDR + VAULT_SECRET_PATH + VAULT_KEY_NAME\n' +
        '  - PUBLISHER_PRIVATE_KEY (dev only)');
}
//# sourceMappingURL=kms-key-manager.js.map