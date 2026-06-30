import { AddressJurisdiction } from './address-enricher';
/** Result of a single publish operation. */
export interface FATFPublishResult {
    address: string;
    txHash: string;
    status: 'success' | 'failed' | 'dry-run';
    tier: string;
    error?: string;
}
/**
 * FATFPublisher — publishes FATF-enriched address risk data to the
 * RiskRegistry contract on-chain.
 *
 * Uses its own signer (the deployer / oracle account) separate from the
 * main publisher, because FATF data uses a dedicated oracle role.
 */
export declare class FATFPublisher {
    private provider;
    private contract;
    private signer;
    private dryRun;
    private gasLimit;
    private txInterval;
    private batchSize;
    constructor(opts?: {
        rpcUrl?: string;
        chainId?: number;
        registryAddress?: string;
        privateKey?: string;
        gasLimit?: number;
        batchSize?: number;
        txInterval?: number;
        dryRun?: boolean;
    });
    /**
     * Initialise: verify signer has ORACLE_ROLE.
     */
    initialize(): Promise<void>;
    /**
     * Publish enriched address risk data on-chain.
     *
     * @param enrichments — Map<address, AddressJurisdiction> from AddressEnricher
     * @returns summary of all publish operations
     */
    publish(enrichments: Map<string, AddressJurisdiction>): Promise<FATFPublishResult[]>;
    /**
     * Publish a single enriched address to RiskRegistry.
     */
    private publishSingle;
    /**
     * Map a boosted tier string to RiskRegistry numeric values.
     */
    private tierToScore;
    /**
     * Build descriptive tags for an enriched address.
     */
    private buildTags;
    /**
     * Convert a string to ethers bytes32.
     */
    private stringToBytes32;
}
export default FATFPublisher;
//# sourceMappingURL=fatf-publisher.d.ts.map