/**
 * A single crypto-related sanctions entry from OpenSanctions.
 */
export interface OpenSanctionsEntry {
    /** OpenSanctions entity ID (e.g. "us-ofac-sdn/xxxxx"). */
    id: string;
    /** Entity / person name. */
    name: string;
    /** Entity type (Person, Organization, Company, etc.). */
    type: string;
    /** Associated countries (ISO2 or full names). */
    countries: string[];
    /** Crypto addresses linked to this entity. */
    cryptoAddresses: {
        currency: string;
        address: string;
    }[];
    /** Sanctions programs (e.g. ["SDNTO", "IRAN"]). */
    sanctionsPrograms: string[];
    /** Data source identifier. */
    dataSource: string;
}
/**
 * OpenSanctionsCollector — downloads structured OFAC SDN data from OpenSanctions.org
 * and extracts cryptocurrency wallet entries (~797 entities).
 *
 * Strategy:
 *  1. Try FollowTheMoney JSON (rich schema, reliable).
 *  2. Fall back to simple CSV.
 *  3. Filter to entities that have at least one crypto address.
 */
export declare class OpenSanctionsCollector {
    private ftmUrl;
    private csvUrl;
    private timeout;
    constructor(opts?: {
        ftmUrl?: string;
        csvUrl?: string;
        timeout?: number;
    });
    /**
     * Download and parse the OFAC SDN dataset, returning only entries
     * that have at least one cryptocurrency address.
     */
    collectCryptoAddresses(): Promise<OpenSanctionsEntry[]>;
    /**
     * Parse FollowTheMoney JSON (streaming line-by-line).
     * The file is a JSON array of entity objects, ~49MB.
     */
    private collectFromFTM;
    /**
     * Fallback: parse the simple CSV format using csv-parser (streaming).
     */
    private collectFromCSV;
    /**
     * Extract crypto addresses from a FollowTheMoney entity.
     * FTM stores them under `properties.cryptoAddress` or `properties.cryptoWallet`.
     */
    private extractCryptoFromFTM;
    /**
     * Extract country codes from FTM entity.
     */
    private extractCountriesFromFTM;
    /**
     * Extract sanctions program identifiers from FTM entity.
     */
    private extractProgramsFromFTM;
    /**
     * Heuristic currency guess from address format.
     */
    private guessCurrency;
    /**
     * Parse a raw crypto field from the CSV format.
     */
    private parseCryptoField;
    /**
     * Get the first non-empty value from an object by trying multiple keys.
     */
    private firstValue;
}
export default OpenSanctionsCollector;
//# sourceMappingURL=opensanctions-collector.d.ts.map