"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FATFPublisher = void 0;
const ethers_1 = require("ethers");
const config_1 = require("./config");
const logger_1 = __importDefault(require("./logger"));
/** Minimal RiskRegistry ABI — only updateRiskProfile(). */
const RISK_REGISTRY_ABI = [
    'function updateRiskProfile(address addr, uint256 riskScore, uint8 tier, bytes32[] tags, bool isSanctioned)',
    'function getRiskProfile(address addr) view returns (uint256 riskScore, address, uint32 lastUpdated, uint8 riskTier, uint8 sourceConfidence, bool sanctioned, bool exists)',
    'function hasRole(bytes32 role, address account) view returns (bool)',
    'function ORACLE_ROLE() view returns (bytes32)',
];
/**
 * FATFPublisher — publishes FATF-enriched address risk data to the
 * RiskRegistry contract on-chain.
 *
 * Uses its own signer (the deployer / oracle account) separate from the
 * main publisher, because FATF data uses a dedicated oracle role.
 */
class FATFPublisher {
    provider;
    contract;
    signer;
    dryRun;
    gasLimit;
    txInterval;
    batchSize;
    constructor(opts) {
        const rpcUrl = opts?.rpcUrl ?? config_1.config.publisher.rpcUrl;
        const chainId = opts?.chainId ?? config_1.config.publisher.chainId;
        const registryAddress = opts?.registryAddress ?? '0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc';
        const privateKey = opts?.privateKey ?? process.env.FATF_ORACLE_PRIVATE_KEY ?? '';
        if (!privateKey) {
            throw new Error('FATFPublisher: FATF_ORACLE_PRIVATE_KEY is required (or pass opts.privateKey)');
        }
        this.provider = new ethers_1.JsonRpcProvider(rpcUrl, chainId);
        this.signer = new ethers_1.Wallet(privateKey, this.provider);
        this.contract = new ethers_1.Contract(registryAddress, RISK_REGISTRY_ABI, this.signer);
        this.dryRun = opts?.dryRun ?? config_1.config.publisher.dryRun;
        this.gasLimit = opts?.gasLimit ?? config_1.config.publisher.gasLimit;
        this.batchSize = opts?.batchSize ?? config_1.config.publisher.batchSize;
        this.txInterval = opts?.txInterval ?? config_1.config.publisher.txInterval;
    }
    /**
     * Initialise: verify signer has ORACLE_ROLE.
     */
    async initialize() {
        const oracleRole = await this.contract.ORACLE_ROLE();
        const hasRole = await this.contract.hasRole(oracleRole, this.signer.address);
        if (!hasRole) {
            logger_1.default.warn('FATFPublisher: signer does NOT have ORACLE_ROLE', {
                signer: this.signer.address,
                oracleRole,
            });
            // Don't throw in dry-run mode
            if (!this.dryRun) {
                throw new Error(`Address ${this.signer.address} lacks ORACLE_ROLE on RiskRegistry`);
            }
        }
        logger_1.default.info('FATFPublisher initialised', {
            signer: this.signer.address,
            registry: await this.contract.getAddress(),
            dryRun: this.dryRun,
        });
    }
    /**
     * Publish enriched address risk data on-chain.
     *
     * @param enrichments — Map<address, AddressJurisdiction> from AddressEnricher
     * @returns summary of all publish operations
     */
    async publish(enrichments) {
        const results = [];
        const total = enrichments.size;
        if (total === 0) {
            logger_1.default.info('FATFPublisher: no addresses to publish');
            return results;
        }
        logger_1.default.info('FATFPublisher: starting publish', { total, dryRun: this.dryRun });
        let i = 0;
        for (const [address, jur] of enrichments) {
            i++;
            // Only publish Ethereum addresses (0x + 40 hex)
            if (!address.match(/^0x[0-9a-fA-F]{40}$/)) {
                logger_1.default.debug('FATFPublisher: skipping non-Ethereum address', { address, index: i });
                continue;
            }
            try {
                const result = await this.publishSingle(address, jur, i, total);
                results.push(result);
            }
            catch (err) {
                results.push({
                    address,
                    txHash: '',
                    status: 'failed',
                    tier: jur.boostedTier ?? 'MEDIUM',
                    error: err.message,
                });
                logger_1.default.error('FATFPublisher: publish failed for address', {
                    address,
                    error: err.message,
                    index: i,
                });
            }
            // Rate limit between txs
            if (!this.dryRun && this.txInterval > 0 && i < total) {
                await new Promise(r => setTimeout(r, this.txInterval));
            }
            // Log progress every batch
            if (i % this.batchSize === 0) {
                logger_1.default.info('FATFPublisher: progress', {
                    published: i,
                    total,
                    successRate: `${results.filter(r => r.status === 'success' || r.status === 'dry-run').length}/${i}`,
                });
            }
        }
        const success = results.filter(r => r.status === 'success' || r.status === 'dry-run').length;
        const failed = results.filter(r => r.status === 'failed').length;
        logger_1.default.info('FATFPublisher: publish complete', { total: results.length, success, failed });
        return results;
    }
    /**
     * Publish a single enriched address to RiskRegistry.
     */
    async publishSingle(address, jur, index, total) {
        // Map boostedTier → numeric tier + risk score
        const { riskScore, tierNum } = this.tierToScore(jur.boostedTier ?? 'MEDIUM');
        // Build tags
        const tags = this.buildTags(jur);
        const tagsBytes32 = tags.map(t => this.stringToBytes32(t));
        // DRY RUN
        if (this.dryRun) {
            logger_1.default.info('FATFPublisher [DRY RUN]: would publish', {
                address,
                entity: jur.entityName,
                iso2: jur.iso2,
                fatfLevel: jur.fatfLevel,
                tier: jur.boostedTier,
                riskScore,
                tags,
                index,
                total,
            });
            return {
                address,
                txHash: `dryrun-${address}`,
                status: 'dry-run',
                tier: jur.boostedTier ?? 'MEDIUM',
            };
        }
        // Build gas params
        const feeData = await this.provider.getFeeData();
        const gasParams = { gasLimit: this.gasLimit };
        if (feeData.maxFeePerGas)
            gasParams.maxFeePerGas = feeData.maxFeePerGas;
        if (feeData.maxPriorityFeePerGas)
            gasParams.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
        else if (feeData.gasPrice)
            gasParams.gasPrice = feeData.gasPrice;
        // Send transaction
        const tx = await this.contract.updateRiskProfile(address, riskScore, tierNum, tagsBytes32, true, // isSanctioned — these are all OFAC SDN addresses
        gasParams);
        const receipt = await tx.wait(1);
        const status = receipt && receipt.status === 1 ? 'success' : 'failed';
        logger_1.default.debug('FATFPublisher: tx confirmed', {
            address,
            txHash: tx.hash,
            status,
            gasUsed: receipt?.gasUsed?.toString(),
            blockNumber: receipt?.blockNumber,
        });
        return {
            address,
            txHash: tx.hash,
            status,
            tier: jur.boostedTier ?? 'MEDIUM',
        };
    }
    /**
     * Map a boosted tier string to RiskRegistry numeric values.
     */
    tierToScore(tier) {
        switch (tier) {
            case 'CRITICAL':
                return { riskScore: 100, tierNum: 4 }; // RiskTier.CRITICAL
            case 'HIGH':
                return { riskScore: 80, tierNum: 3 }; // RiskTier.HIGH
            case 'MEDIUM':
            default:
                return { riskScore: 60, tierNum: 2 }; // RiskTier.MEDIUM
        }
    }
    /**
     * Build descriptive tags for an enriched address.
     */
    buildTags(jur) {
        const tags = ['ofac-sdn', 'sanctioned'];
        if (jur.fatfLevel === 'blacklist') {
            tags.push('fatf-blacklist');
            tags.push('fatf-call-for-action');
        }
        else if (jur.fatfLevel === 'greylist') {
            tags.push('fatf-greylist');
            tags.push('fatf-increased-monitoring');
        }
        if (jur.iso2) {
            tags.push(`country:${jur.iso2}`);
        }
        if (jur.entityName) {
            // Truncate entity name to fit bytes32 (31 chars max after hex encoding)
            const name = jur.entityName.slice(0, 31);
            tags.push(`entity:${name}`);
        }
        return tags;
    }
    /**
     * Convert a string to ethers bytes32.
     */
    stringToBytes32(str) {
        const hex = Buffer.from(str, 'utf8').toString('hex').padEnd(64, '0').slice(0, 64);
        return '0x' + hex;
    }
}
exports.FATFPublisher = FATFPublisher;
exports.default = FATFPublisher;
//# sourceMappingURL=fatf-publisher.js.map