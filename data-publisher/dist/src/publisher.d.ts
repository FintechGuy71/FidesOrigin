import { RiskProfile, PublisherConfig, TxResult } from './types';
/**
 * Blockchain Publisher — signs and sends transactions to RiskRegistry
 */
export declare class BlockchainPublisher {
    private provider;
    private contract;
    private signer?;
    private address?;
    private nonce;
    private isReady;
    private oracleRole?;
    constructor(cfg: PublisherConfig);
    /**
     * Initialize the publisher (connect signer, verify role)
     */
    initialize(): Promise<void>;
    getAddress(): Promise<string | undefined>;
    /**
     * Get on-chain data for all addresses to determine which need updating
     */
    getOnChainData(addresses: string[]): Promise<Map<string, {
        score: number;
        tier: number;
        sanctioned: boolean;
        timestamp: number;
    }>>;
    /**
     * Publish risk profiles to the blockchain
     */
    publish(profiles: RiskProfile[]): Promise<TxResult[]>;
    /**
     * Publish a single risk profile
     */
    private publishSingle;
    /**
     * Health check — verify connection and role
     */
    healthCheck(): Promise<{
        healthy: boolean;
        error?: string;
    }>;
    /**
     * Estimate gas cost for publishing
     */
    estimateGasCost(count: number): Promise<{
        eth: string;
        usd?: string;
    }>;
}
export default BlockchainPublisher;
//# sourceMappingURL=publisher.d.ts.map