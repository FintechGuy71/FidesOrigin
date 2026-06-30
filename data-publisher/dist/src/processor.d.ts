import { RawRiskData, RiskProfile } from './types';
/**
 * Data Processor — deduplicates, scores, and validates raw risk data
 */
export declare class DataProcessor {
    /**
     * Process raw data into normalized risk profiles
     */
    process(rawData: RawRiskData[]): RiskProfile[];
    /**
     * Deduplicate records by address + source
     */
    private deduplicate;
    /**
     * Merge records from multiple sources for the same address
     */
    private mergeByAddress;
    /**
     * Validate and normalize a single record
     */
    private validateAndNormalize;
    /**
     * Calculate tier from score
     */
    private scoreToTier;
    /**
     * Filter out profiles that don't need updating (already up to date on chain)
     */
    filterForUpdate(profiles: RiskProfile[], onChainData: Map<string, {
        score: number;
        tier: number;
        sanctioned: boolean;
        timestamp: number;
    }>): RiskProfile[];
}
export default DataProcessor;
//# sourceMappingURL=processor.d.ts.map