// DEPRECATED: Use kms-key-manager.ts for all production key management
// This file is kept only for backward compatibility with PlainKeyManager (dev/test).
// [Audit Fix #1] Removed AWSKMSKeyManager and AzureKeyVaultManager dummy wallet implementations.
// All production KMS signing must go through kms-key-manager.ts which provides proper
// AbstractSigner implementations without loading dummy private keys into memory.
import { ethers, Signer, Wallet, JsonRpcProvider } from 'ethers';
import { config } from './config';
import logger from './logger';

/**
 * Key Manager Interface
 */
export interface KeyManager {
  getSigner(): Promise<Signer>;
  getAddress(): Promise<string>;
}

/**
 * Plain private key manager (development / testing only)
 * [Audit Fix #1] This is the ONLY key manager remaining in this file.
 * Production environments must use kms-key-manager.ts (AWS KMS, Vault Transit, etc.).
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
 * [Audit Fix #1] AWS KMS and Azure Key Vault dummy wallet implementations have been removed.
 * Production key management must use kms-key-manager.ts which provides proper
 * AbstractSigner implementations that route all signing through KMS without
 * ever loading a dummy private key into memory.
 *
 * Factory function to create the appropriate key manager
 */
export async function createKeyManager(provider: JsonRpcProvider): Promise<KeyManager> {
  const { publisher } = config;

  // [Audit Fix #1] Redirect AWS KMS to kms-key-manager.ts secure implementation
  if (publisher.kmsProvider === 'aws' && publisher.kmsKeyId) {
    const { createKeyManager: kmsCreate } = await import('./kms-key-manager');
    return kmsCreate(provider) as Promise<KeyManager>;
  }

  // [Audit Fix #1] Azure Key Vault not yet implemented in secure module
  if (publisher.kmsProvider === 'azure' && publisher.kmsKeyId) {
    throw new Error('Azure KMS not yet implemented');
  }

  if (publisher.privateKey) {
    return new PlainKeyManager(publisher.privateKey, provider);
  }

  throw new Error('No key manager configured. Set PUBLISHER_PRIVATE_KEY or KMS_PROVIDER + KMS_KEY_ID');
}
