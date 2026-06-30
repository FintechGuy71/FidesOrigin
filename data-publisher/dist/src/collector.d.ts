import { DataSourceConfig, RawRiskData } from './types';
/**
 * Data Collector — fetches risk data from multiple sources
 */
export declare class DataCollector {
    private configs;
    constructor(configs: DataSourceConfig[]);
    /**
     * Collect data from all enabled sources
     */
    collectAll(): Promise<RawRiskData[]>;
    /**
     * Collect from a single source with retry logic
     */
    private collectFromSource;
    /**
     * Fetch OFAC SDN List (XML format)
     */
    private fetchOFAC;
    /**
     * Fetch Chainalysis API
     */
    private fetchChainalysis;
    /**
     * Fetch OpenSanctions API
     */
    private fetchOpenSanctions;
    /**
     * Fetch Etherscan labels
     */
    private fetchEtherscan;
    /**
     * Convert score (0-100) to tier
     */
    private scoreToTier;
    /**
     * Collect from a specific source by ID
     */
    collectFromSourceId(sourceId: string): Promise<RawRiskData[]>;
}
export default DataCollector;
//# sourceMappingURL=collector.d.ts.map