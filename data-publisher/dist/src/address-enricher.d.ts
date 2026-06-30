import { FATFCountry } from './fatf-collector';
import { OpenSanctionsEntry } from './opensanctions-collector';
/**
 * Minimal representation of an OFAC SDN entry containing crypto addresses.
 */
export interface OFACEntry {
    /** Entity name from SDN list. */
    name: string;
    /** Entity type (individual, organization, etc.). */
    type: string;
    /** ISO 3166-1 alpha-2 country code if known. */
    country?: string;
    /** List of cryptocurrency addresses associated with this entity. */
    cryptoAddresses: {
        currency?: string;
        address: string;
    }[];
    /** Sanctions program (e.g. "IRAN", "DPRK"). */
    program?: string;
    /** Original data source. */
    source: string;
}
/**
 * Address-level jurisdiction enrichment result.
 * Combines OFAC sanctions data with FATF country risk tiers.
 */
export interface AddressJurisdiction {
    /** Blockchain address (lowercase, 0x-prefixed). */
    address: string;
    /** ISO 3166-1 alpha-2 country code if known. */
    iso2?: string;
    /** Data source (e.g. "OpenSanctions-OFAC-SDN"). */
    source: string;
    /** Sanctioned entity name. */
    entityName?: string;
    /** FATF list level for the associated country. */
    fatfLevel?: 'blacklist' | 'greylist' | 'none';
    /** Final boosted risk tier after FATF cross-check. */
    boostedTier?: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}
/**
 * AddressEnricher — cross-references OFAC SDN address data with FATF country lists.
 *
 * - Address in FATF **blacklist** country → CRITICAL
 * - Address in FATF **greylist** country → HIGH
 * - Address in OFAC SDN but not in any FATF list → MEDIUM (default sanctions tier)
 */
export declare class AddressEnricher {
    /**
     * Enrich a list of OFAC / OpenSanctions entries with FATF jurisdiction data.
     *
     * @param ofacEntries — entries from OpenSanctionsCollector
     * @param fatfCountries — entries from FATFCollector
     * @returns Map<address, AddressJurisdiction>
     */
    enrich(ofacEntries: OpenSanctionsEntry[], fatfCountries: FATFCountry[]): Map<string, AddressJurisdiction>;
    /**
     * Pick the most likely primary country from a list.
     * Prefers the first non-empty entry; normalises common variants.
     */
    private pickPrimaryCountry;
    /**
     * Convert tier string to numeric rank for comparison.
     */
    private tierRank;
}
export default AddressEnricher;
//# sourceMappingURL=address-enricher.d.ts.map