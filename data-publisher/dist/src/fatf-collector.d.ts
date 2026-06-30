/**
 * FATF country-level risk data.
 * A country on the FATF blacklist (Call for Action) or greylist (Increased Monitoring).
 */
export interface FATFCountry {
    country: string;
    iso2: string;
    riskTier: 'CRITICAL' | 'HIGH';
    reason: string;
    listType: 'blacklist' | 'greylist';
}
/**
 * FATFCollector — returns country-level FATF risk data.
 *
 * FATF updates its lists 3× per year (Feb / Jun / Oct plenaries).
 * We ship hardcoded data and optionally verify against the FATF website.
 */
export declare class FATFCollector {
    private blacklistUrl;
    private greylistUrl;
    private useFallback;
    constructor(opts?: {
        blacklistUrl?: string;
        greylistUrl?: string;
        useFallback?: boolean;
    });
    /**
     * Return hardcoded blacklist + greylist.
     * This is the primary method — FATF only changes 3× per year.
     */
    collect(): FATFCountry[];
    /**
     * Return only the blacklist (Call for Action).
     */
    collectBlacklist(): FATFCountry[];
    /**
     * Return only the greylist (Increased Monitoring).
     */
    collectGreylist(): FATFCountry[];
    /**
     * Optionally fetch the FATF pages and verify the hardcoded list is still current.
     * Falls back to hardcoded data on any error.
     *
     * @returns FATFCountry[] — verified or fallback list
     */
    collectOnline(): Promise<FATFCountry[]>;
    /**
     * Build a quick lookup Map keyed by ISO2 code.
     */
    toMap(countries?: FATFCountry[]): Map<string, FATFCountry>;
}
export default FATFCollector;
//# sourceMappingURL=fatf-collector.d.ts.map