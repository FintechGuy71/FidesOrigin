import { FATFCountry } from './fatf-collector';
import { OpenSanctionsEntry } from './opensanctions-collector';
import logger from './logger';

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
  cryptoAddresses: { currency?: string; address: string }[];
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
export class AddressEnricher {
  /**
   * Enrich a list of OFAC / OpenSanctions entries with FATF jurisdiction data.
   *
   * @param ofacEntries — entries from OpenSanctionsCollector
   * @param fatfCountries — entries from FATFCollector
   * @returns Map<address, AddressJurisdiction>
   */
  enrich(
    ofacEntries: OpenSanctionsEntry[],
    fatfCountries: FATFCountry[],
  ): Map<string, AddressJurisdiction> {
    // Build FATF lookup: iso2 → FATFCountry
    const fatfMap = new Map<string, FATFCountry>();
    for (const fc of fatfCountries) {
      fatfMap.set(fc.iso2.toUpperCase(), fc);
    }

    const result = new Map<string, AddressJurisdiction>();
    let boosted = 0;

    for (const entry of ofacEntries) {
      // Determine the primary country for this entity
      const iso2 = this.pickPrimaryCountry(entry.countries);

      let fatfLevel: 'blacklist' | 'greylist' | 'none' = 'none';
      let boostedTier: 'CRITICAL' | 'HIGH' | 'MEDIUM' = 'MEDIUM'; // default OFAC sanctions tier

      if (iso2) {
        const fc = fatfMap.get(iso2.toUpperCase());
        if (fc) {
          fatfLevel = fc.listType;
          boostedTier = fc.riskTier; // CRITICAL for blacklist, HIGH for greylist
          boosted++;
        }
      }

      // Emit one entry per crypto address
      for (const ca of entry.cryptoAddresses) {
        if (!ca.address || typeof ca.address !== 'string') continue;
        const addr = ca.address.toLowerCase().trim();
        if (!addr) continue;

        // If address already in result, keep the higher risk
        const existing = result.get(addr);
        const newTier = this.tierRank(boostedTier);
        if (existing && existing.boostedTier && this.tierRank(existing.boostedTier) >= newTier) {
          continue; // existing is equal or higher
        }

        result.set(addr, {
          address: addr,
          iso2,
          source: entry.dataSource,
          entityName: entry.name,
          fatfLevel,
          boostedTier,
        });
      }
    }

    logger.info('AddressEnricher: enrichment complete', {
      inputEntries: ofacEntries.length,
      outputAddresses: result.size,
      fatfBoosted: boosted,
    });

    return result;
  }

  /**
   * Pick the most likely primary country from a list.
   * Prefers the first non-empty entry; normalises common variants.
   */
  private pickPrimaryCountry(countries: string[]): string | undefined {
    if (!countries || countries.length === 0) return undefined;
    for (const c of countries) {
      const trimmed = c.trim();
      if (trimmed.length === 2) return trimmed.toUpperCase();
      // Attempt to convert common names — caller should pass iso2 but handle gracefully
      const normalised = COUNTRY_NAME_TO_ISO2[trimmed.toLowerCase()];
      if (normalised) return normalised;
    }
    return undefined;
  }

  /**
   * Convert tier string to numeric rank for comparison.
   */
  private tierRank(tier: string): number {
    switch (tier) {
      case 'CRITICAL': return 4;
      case 'HIGH': return 3;
      case 'MEDIUM': return 2;
      default: return 1;
    }
  }
}

/** Minimal country-name → ISO2 map for common FATF entries. */
const COUNTRY_NAME_TO_ISO2: Record<string, string> = {
  'north korea': 'KP',
  'dprk': 'KP',
  'korea, democratic people\'s republic of': 'KP',
  'iran': 'IR',
  'iran (islamic republic of)': 'IR',
  'myanmar': 'MM',
  'burma': 'MM',
  'algeria': 'DZ',
  'angola': 'AO',
  'bolivia': 'BO',
  'bolivia, plurinational state of': 'BO',
  'bosnia and herzegovina': 'BA',
  'bulgaria': 'BG',
  'cameroon': 'CM',
  'côte d\'ivoire': 'CI',
  'ivory coast': 'CI',
  'congo, democratic republic of the': 'CD',
  'dr congo': 'CD',
  'haiti': 'HT',
  'iraq': 'IQ',
  'kenya': 'KE',
  'kuwait': 'KW',
  'lao pdr': 'LA',
  'laos': 'LA',
  'lebanon': 'LB',
  'monaco': 'MC',
  'namibia': 'NA',
  'nepal': 'NP',
  'papua new guinea': 'PG',
  'south sudan': 'SS',
  'syria': 'SY',
  'syrian arab republic': 'SY',
  'venezuela': 'VE',
  'venezuela, bolivarian republic of': 'VE',
  'vietnam': 'VN',
  'virgin islands (british)': 'VG',
  'british virgin islands': 'VG',
  'yemen': 'YE',
};

export default AddressEnricher;
