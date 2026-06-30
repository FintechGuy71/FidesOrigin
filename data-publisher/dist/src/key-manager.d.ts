import { Signer, JsonRpcProvider } from 'ethers';
/**
 * Abstract Key Manager — supports plain private key, AWS KMS, and Azure Key Vault
 */
export interface KeyManager {
    getSigner(): Promise<Signer>;
    getAddress(): Promise<string>;
}
/**
 * Factory function to create the appropriate key manager
 */
export declare function createKeyManager(provider: JsonRpcProvider): Promise<KeyManager>;
//# sourceMappingURL=key-manager.d.ts.map