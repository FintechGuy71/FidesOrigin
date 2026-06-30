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
/**
 * Plain private key manager (development / testing)
 */
class PlainKeyManager {
    wallet;
    constructor(privateKey, provider) {
        if (!privateKey.match(/^0x[0-9a-fA-F]{64}$/)) {
            throw new Error('Invalid private key format');
        }
        this.wallet = new ethers_1.Wallet(privateKey, provider);
        logger_1.default.info('Initialized plain key manager', { address: this.wallet.address });
    }
    async getSigner() {
        return this.wallet;
    }
    async getAddress() {
        return this.wallet.address;
    }
}
/**
 * AWS KMS Key Manager (production)
 * Requires @aws-sdk/client-kms to be installed
 */
class AWSKMSKeyManager {
    keyId;
    provider;
    cachedAddress;
    constructor(keyId, provider) {
        this.keyId = keyId;
        this.provider = provider;
        logger_1.default.info('Initialized AWS KMS key manager', { keyId: keyId.substring(0, 20) + '...' });
    }
    async getSigner() {
        try {
            const { KMSClient, GetPublicKeyCommand, SignCommand } = await Promise.resolve().then(() => __importStar(require('@aws-sdk/client-kms')));
            const { secp256k1 } = await Promise.resolve().then(() => __importStar(require('@noble/curves/secp256k1')));
            const { keccak256 } = ethers_1.ethers;
            const client = new KMSClient({});
            // Get public key from KMS
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
            if (startIndex === -1)
                throw new Error('Invalid DER public key');
            const rawPublicKey = pubKeyBuffer.subarray(startIndex, startIndex + 65);
            const publicKeyBytes = rawPublicKey.subarray(1);
            const hash = keccak256(publicKeyBytes);
            const address = '0x' + hash.substring(26);
            this.cachedAddress = address;
            // Create custom signer using Wallet as base
            const dummyPrivateKey = '0x' + '00'.repeat(32);
            const wallet = new ethers_1.Wallet(dummyPrivateKey, this.provider);
            // Override sign methods
            wallet.signTransaction = async (tx) => {
                const txBytes = ethers_1.ethers.Transaction.from(tx).unsignedHash;
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
                const recId = 27;
                const signature = rHex + sNormHex.slice(2) + recId.toString(16).padStart(2, '0');
                return signature;
            };
            return wallet;
        }
        catch (error) {
            logger_1.default.error('Failed to initialize AWS KMS signer', { error });
            throw new Error('AWS KMS signer initialization failed: ' + error.message);
        }
    }
    async getAddress() {
        if (this.cachedAddress)
            return this.cachedAddress;
        const signer = await this.getSigner();
        return await signer.getAddress();
    }
}
/**
 * Azure Key Vault Key Manager (production)
 */
class AzureKeyVaultManager {
    keyId;
    provider;
    constructor(keyId, provider) {
        this.keyId = keyId;
        this.provider = provider;
        logger_1.default.info('Initialized Azure Key Vault key manager', { keyId: keyId.substring(0, 30) + '...' });
    }
    async getSigner() {
        try {
            const { DefaultAzureCredential } = await Promise.resolve().then(() => __importStar(require('@azure/identity')));
            const { KeyClient, CryptographyClient } = await Promise.resolve().then(() => __importStar(require('@azure/keyvault-keys')));
            const credential = new DefaultAzureCredential();
            const keyVaultUrl = this.keyId.split('/keys/')[0];
            const keyName = this.keyId.split('/keys/')[1]?.split('/')[0] || '';
            const keyClient = new KeyClient(keyVaultUrl, credential);
            const keyBundle = await keyClient.getKey(keyName);
            // Get cryptography client
            const cryptoClient = new CryptographyClient(this.keyId, credential);
            // Create custom signer using Wallet as base
            const dummyPrivateKey = '0x' + '00'.repeat(32);
            const wallet = new ethers_1.Wallet(dummyPrivateKey, this.provider);
            // Derive address from public key
            const address = await this.deriveAddress(keyBundle.key);
            wallet.getAddress = async () => address;
            wallet.signTransaction = async (tx) => {
                const txBytes = ethers_1.ethers.Transaction.from(tx).unsignedHash;
                const signResult = await cryptoClient.sign('ES256K', Buffer.from(txBytes.slice(2), 'hex'));
                const r = '0x' + Buffer.from(signResult.result).slice(0, 32).toString('hex');
                const s = '0x' + Buffer.from(signResult.result).slice(32).toString('hex');
                const recId = 27;
                return r + s.slice(2) + recId.toString(16).padStart(2, '0');
            };
            return wallet;
        }
        catch (error) {
            logger_1.default.error('Failed to initialize Azure Key Vault signer', { error });
            throw new Error('Azure Key Vault signer initialization failed: ' + error.message);
        }
    }
    async deriveAddress(key) {
        const x = Buffer.from(key.x, 'base64');
        const y = Buffer.from(key.y, 'base64');
        const pubKey = Buffer.concat([Buffer.from([0x04]), x, y]);
        const hash = ethers_1.ethers.keccak256(pubKey.slice(1));
        return '0x' + hash.slice(26);
    }
    async getAddress() {
        const signer = await this.getSigner();
        return await signer.getAddress();
    }
}
/**
 * Factory function to create the appropriate key manager
 */
async function createKeyManager(provider) {
    const { publisher } = config_1.config;
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
//# sourceMappingURL=key-manager.js.map