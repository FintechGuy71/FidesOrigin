"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockchainPublisher = void 0;
const ethers_1 = require("ethers");
const config_1 = require("./config");
const logger_1 = __importDefault(require("./logger"));
const kms_key_manager_1 = require("./kms-key-manager");
// RiskRegistry ABI (minimal — only the functions we need)
const RISK_REGISTRY_ABI = [
    'function updateRiskProfile(address addr, uint256 riskScore, uint8 tier, bytes32[] tags, bool isSanctioned)',
    'function getRiskProfile(address addr) view returns (uint256 riskScore, address, uint32 lastUpdated, uint8 riskTier, uint8 sourceConfidence, bool sanctioned, bool exists)',
    'function riskProfiles(address) view returns (uint256, address, uint32, uint8, uint8, bool, bool)',
    'function hasRole(bytes32 role, address account) view returns (bool)',
    'function ORACLE_ROLE() view returns (bytes32)',
    'function totalProfiles() view returns (uint256)',
];
/**
 * Blockchain Publisher — signs and sends transactions to RiskRegistry
 */
class BlockchainPublisher {
    provider;
    contract;
    signer;
    address;
    nonce = 0;
    isReady = false;
    oracleRole;
    constructor(cfg) {
        this.provider = new ethers_1.JsonRpcProvider(cfg.rpcUrl, cfg.chainId);
        this.contract = new ethers_1.Contract(cfg.riskRegistryAddress, RISK_REGISTRY_ABI, this.provider);
    }
    /**
     * Initialize the publisher (connect signer, verify role)
     */
    async initialize() {
        try {
            // Create key manager and get signer
            const keyManager = await (0, kms_key_manager_1.createKeyManager)(this.provider);
            this.signer = await keyManager.getSigner();
            this.address = await keyManager.getAddress();
            // Connect contract to signer
            this.contract = this.contract.connect(this.signer);
            // Get current nonce
            this.nonce = await this.provider.getTransactionCount(this.address, 'latest');
            // Verify ORACLE_ROLE
            this.oracleRole = await this.contract.ORACLE_ROLE();
            const hasRole = await this.contract.hasRole(this.oracleRole, this.address);
            if (!hasRole) {
                throw new Error(`Address ${this.address} does not have ORACLE_ROLE on RiskRegistry. ` +
                    `Grant role by calling: riskRegistry.grantRole(ORACLE_ROLE, ${this.address})`);
            }
            this.isReady = true;
            logger_1.default.info('Publisher initialized successfully', {
                address: this.address,
                riskRegistry: config_1.config.publisher.riskRegistryAddress,
                chainId: config_1.config.publisher.chainId,
                oracleRole: this.oracleRole,
                nonce: this.nonce,
            });
        }
        catch (error) {
            logger_1.default.error('Failed to initialize publisher', { error: error.stack });
            throw error;
        }
    }
    async getAddress() {
        return this.address;
    }
    /**
     * Get on-chain data for all addresses to determine which need updating
     */
    async getOnChainData(addresses) {
        const results = new Map();
        for (let i = 0; i < addresses.length; i += 10) {
            const batch = addresses.slice(i, i + 10);
            const promises = batch.map(async (addr) => {
                try {
                    const profile = await this.contract.riskProfiles(addr);
                    return {
                        address: addr,
                        score: Number(profile[0]),
                        tier: Number(profile[3]),
                        sanctioned: profile[5],
                        timestamp: Number(profile[2]),
                    };
                }
                catch (error) {
                    // Address not registered yet
                    return null;
                }
            });
            const batchResults = await Promise.all(promises);
            for (const r of batchResults) {
                if (r)
                    results.set(r.address, r);
            }
        }
        return results;
    }
    /**
     * Publish risk profiles to the blockchain
     */
    async publish(profiles) {
        if (!this.isReady) {
            throw new Error('Publisher not initialized. Call initialize() first.');
        }
        if (config_1.config.publisher.dryRun) {
            logger_1.default.info(`[DRY RUN] Would publish ${profiles.length} profiles`, {
                firstProfile: profiles[0],
            });
            return profiles.map(p => ({
                hash: `dryrun-${p.address}`,
                status: 'success',
            }));
        }
        const results = [];
        const batchSize = config_1.config.publisher.batchSize;
        for (let i = 0; i < profiles.length; i += batchSize) {
            const batch = profiles.slice(i, i + batchSize);
            logger_1.default.info(`Publishing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(profiles.length / batchSize)}`, {
                batchSize: batch.length,
                remaining: profiles.length - i - batch.length,
            });
            for (const profile of batch) {
                try {
                    const result = await this.publishSingle(profile);
                    results.push(result);
                }
                catch (error) {
                    results.push({
                        hash: '',
                        status: 'failed',
                        error: error.message,
                    });
                    logger_1.default.error(`Failed to publish profile for ${profile.address}`, { error: error.message });
                }
                // Rate limiting between transactions
                if (config_1.config.publisher.txInterval > 0) {
                    await new Promise(resolve => setTimeout(resolve, config_1.config.publisher.txInterval));
                }
            }
        }
        // Summary
        const successCount = results.filter(r => r.status === 'success').length;
        const failedCount = results.filter(r => r.status === 'failed').length;
        logger_1.default.info(`Publishing complete: ${successCount} success, ${failedCount} failed`, {
            total: results.length,
            success: successCount,
            failed: failedCount,
        });
        return results;
    }
    /**
     * Publish a single risk profile
     */
    async publishSingle(profile) {
        const tagsBytes32 = profile.tags.map(t => {
            // Convert string to bytes32 (pad with zeros)
            const hex = Buffer.from(t).toString('hex').padEnd(64, '0').slice(0, 64);
            return '0x' + hex;
        });
        // Build gas params
        const feeData = await this.provider.getFeeData();
        const gasParams = {
            gasLimit: config_1.config.publisher.gasLimit,
        };
        if (config_1.config.publisher.maxFeePerGas) {
            gasParams.maxFeePerGas = ethers_1.ethers.parseUnits(config_1.config.publisher.maxFeePerGas, 'gwei');
        }
        else if (feeData.maxFeePerGas) {
            gasParams.maxFeePerGas = feeData.maxFeePerGas;
        }
        if (config_1.config.publisher.maxPriorityFeePerGas) {
            gasParams.maxPriorityFeePerGas = ethers_1.ethers.parseUnits(config_1.config.publisher.maxPriorityFeePerGas, 'gwei');
        }
        else if (feeData.maxPriorityFeePerGas) {
            gasParams.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
        }
        else if (feeData.gasPrice) {
            gasParams.gasPrice = feeData.gasPrice;
        }
        // Send transaction
        const tx = await this.contract.updateRiskProfile(profile.address, profile.riskScore, profile.tier, tagsBytes32, profile.isSanctioned, gasParams);
        logger_1.default.debug(`Transaction sent: ${tx.hash}`, {
            address: profile.address,
            score: profile.riskScore,
            tier: profile.tier,
        });
        // Wait for confirmation
        const receipt = await tx.wait(1); // Wait for 1 confirmation
        if (!receipt) {
            throw new Error('Transaction receipt not received');
        }
        const status = receipt.status === 1 ? 'success' : 'failed';
        logger_1.default.info(`Transaction confirmed: ${tx.hash}`, {
            status,
            gasUsed: receipt.gasUsed.toString(),
            blockNumber: receipt.blockNumber,
        });
        return {
            hash: tx.hash,
            status,
            gasUsed: receipt.gasUsed,
            blockNumber: receipt.blockNumber,
        };
    }
    /**
     * Health check — verify connection and role
     */
    async healthCheck() {
        try {
            if (!this.isReady) {
                return { healthy: false, error: 'Publisher not initialized' };
            }
            // Check RPC connection
            const blockNumber = await this.provider.getBlockNumber();
            // Check role
            const hasRole = await this.contract.hasRole(this.oracleRole, this.address);
            if (!hasRole) {
                return { healthy: false, error: 'ORACLE_ROLE revoked' };
            }
            return { healthy: true };
        }
        catch (error) {
            return { healthy: false, error: error.message };
        }
    }
    /**
     * Estimate gas cost for publishing
     */
    async estimateGasCost(count) {
        try {
            const feeData = await this.provider.getFeeData();
            const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || BigInt(0);
            const totalGas = BigInt(config_1.config.publisher.gasLimit) * BigInt(count);
            const costWei = gasPrice * totalGas;
            const costEth = ethers_1.ethers.formatEther(costWei);
            return { eth: costEth };
        }
        catch (error) {
            logger_1.default.error('Failed to estimate gas', { error });
            return { eth: 'unknown' };
        }
    }
}
exports.BlockchainPublisher = BlockchainPublisher;
exports.default = BlockchainPublisher;
//# sourceMappingURL=publisher.js.map