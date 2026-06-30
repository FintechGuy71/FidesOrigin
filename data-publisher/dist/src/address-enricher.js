"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddressEnricher = void 0;
const logger_1 = __importDefault(require("./logger"));
/**
 * AddressEnricher — cross-references OFAC SDN address data with FATF country lists.
 *
 * - Address in FATF **blacklist** country → CRITICAL
 * - Address in FATF **greylist** country → HIGH
 * - Address in OFAC SDN but not in any FATF list → MEDIUM (default sanctions tier)
 */
class AddressEnricher {
    /**
     * Enrich a list of OFAC / OpenSanctions entries with FATF jurisdiction data.
     *
     * @param ofacEntries — entries from OpenSanctionsCollector
     * @param fatfCountries — entries from FATFCollector
     * @returns Map<address, AddressJurisdiction>
     */
    enrich(ofacEntries, fatfCountries) {
        // Build FATF lookup: iso2 → FATFCountry
        const fatfMap = new Map();
        for (const fc of fatfCountries) {
            fatfMap.set(fc.iso2.toUpperCase(), fc);
        }
        const result = new Map();
        let boosted = 0;
        for (const entry of ofacEntries) {
            // Determine the primary country for this entity
            const iso2 = this.pickPrimaryCountry(entry.countries);
            let fatfLevel = 'none';
            let boostedTier = 'MEDIUM'; // default OFAC sanctions tier
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
                const addr = ca.address.toLowerCase().trim();
                if (!addr)
                    continue;
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
        logger_1.default.info('AddressEnricher: enrichment complete', {
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
    pickPrimaryCountry(countries) {
        if (!countries || countries.length === 0)
            return undefined;
        for (const c of countries) {
            const trimmed = c.trim();
            if (trimmed.length === 2)
                return trimmed.toUpperCase();
            // Attempt to convert common names — caller should pass iso2 but handle gracefully
            const normalised = COUNTRY_NAME_TO_ISO2[trimmed.toLowerCase()];
            if (normalised)
                return normalised;
        }
        return undefined;
    }
    /**
     * Convert tier string to numeric rank for comparison.
     */
    tierRank(tier) {
        switch (tier) {
            case 'CRITICAL': return 4;
            case 'HIGH': return 3;
            case 'MEDIUM': return 2;
            default: return 1;
        }
    }
}
exports.AddressEnricher = AddressEnricher;
/** Minimal country-name → ISO2 map for common FATF entries. */
const COUNTRY_NAME_TO_ISO2 = {
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
exports.default = AddressEnricher;
//# sourceMappingURL=address-enricher.js.map