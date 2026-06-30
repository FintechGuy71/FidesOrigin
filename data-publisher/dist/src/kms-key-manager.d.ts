import { Wallet, JsonRpcProvider } from 'ethers';
export interface IKeyManager {
    getSigner(): Promise<Wallet>;
    getAddress(): Promise<string>;
}
export interface VaultConfig {
    addr: string;
    secretPath: string;
    keyName: string;
    token?: string;
}
export declare function createKeyManager(provider: JsonRpcProvider): Promise<IKeyManager>;
//# sourceMappingURL=kms-key-manager.d.ts.map