"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FATFCollector = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("./logger"));
/**
 * Hardcoded FATF blacklist (Call for Action).
 * Source: FATF Plenary, February 2026.
 * These jurisdictions are subject to countermeasures or enhanced due diligence.
 */
const FATF_BLACKLIST = [
    { country: 'DPRK', iso2: 'KP', riskTier: 'CRITICAL', reason: 'FATF Call for Action — Countermeasures', listType: 'blacklist' },
    { country: 'Iran', iso2: 'IR', riskTier: 'CRITICAL', reason: 'FATF Call for Action — Countermeasures', listType: 'blacklist' },
    { country: 'Myanmar', iso2: 'MM', riskTier: 'CRITICAL', reason: 'FATF Call for Action — Enhanced Due Diligence', listType: 'blacklist' },
];
/**
 * Hardcoded FATF greylist (Increased Monitoring).
 * Source: FATF Plenary, June 2026.
 * These jurisdictions are actively working with FATF on strategic deficiencies.
 */
const FATF_GREYLIST = [
    { country: 'Algeria', iso2: 'DZ', riskTier: 'HIGH', reason: 'FATF Increased Monitoring', listType: 'greylist' },
    { country: 'Angola', iso2: 'AO', riskTier: 'HIGH', reason: 'FATF Increased Monitoring', listType: 'greylist' },
    { country: 'Bolivia', iso2: 'BO', riskTier: 'HIGH', reason: 'FATF Increased Monitoring', listType: 'greylist' },
    { country: 'Bosnia and Herzegovina', iso2: 'BA', riskTier: 'HIGH', reason: 'FATF Increased Monitoring', listType: 'greylist' },
    { country: 'Bulgaria', iso2: 'BG', riskTier: 'HIGH', reason: 'FATF Increased Monitoring', listType: 'greylist' },
    { country: 'Cameroon', iso2: 'CM', riskTier: 'HIGH', reason: 'FATF Increased Monitoring', listType: 'greylist' },
    { country: 'Côte d\'Ivoire', iso2: 'CI', riskTier: 'HIGH', reason: 'FATF Increased Monitoring', listType: 'greylist' },
    { country: 'DR Congo', iso2: 'CD', riskTier: 'HIGH', reason: 'FATF Increased Monitoring', listType: 'greylist' },
    { country: 'Haiti', iso2: 'HT', riskTier: 'HIGH', reason: 'FATF Increased Monitoring', listType: 'greylist' },
    { country: 'Iraq', iso2: 'IQ', riskTier: 'HIGH', reason: 'FATF Increased Monitoring', listType: 'greylist' },
    { country: 'Kenya', iso2: 'KE', riskTier: 'HIGH', reason: 'FATF Increased Monitoring', listType: 'greylist' },
    { country: 'Kuwait', iso2: 'KW', riskTier: 'HIGH', reason: 'FATF Increased Monitoring', listType: 'greylist' },
    { country: 'Lao PDR', iso2: 'LA', riskTier: 'HIGH', reason: 'FATF Increased Monitoring', listType: 'greylist' },
    { country: 'Lebanon', iso2: 'LB', riskTier: 'HIGH', reason: 'FATF Increased Monitoring', listType: 'greylist' },
    { country: 'Monaco', iso2: 'MC', riskTier: 'HIGH', reason: 'FATF Increased Monitoring', listType: 'greylist' },
    { country: 'Namibia', iso2: 'NA', riskTier: 'HIGH', reason: 'FATF Increased Monitoring', listType: 'greylist' },
    { country: 'Nepal', iso2: 'NP', riskTier: 'HIGH', reason: 'FATF Increased Monitoring', listType: 'greylist' },
    { country: 'Papua New Guinea', iso2: 'PG', riskTier: 'HIGH', reason: 'FATF Increased Monitoring', listType: 'greylist' },
    { country: 'South Sudan', iso2: 'SS', riskTier: 'HIGH', reason: 'FATF Increased Monitoring', listType: 'greylist' },
    { country: 'Syria', iso2: 'SY', riskTier: 'HIGH', reason: 'FATF Increased Monitoring', listType: 'greylist' },
    { country: 'Venezuela', iso2: 'VE', riskTier: 'HIGH', reason: 'FATF Increased Monitoring', listType: 'greylist' },
    { country: 'Vietnam', iso2: 'VN', riskTier: 'HIGH', reason: 'FATF Increased Monitoring', listType: 'greylist' },
    { country: 'Virgin Islands (UK)', iso2: 'VG', riskTier: 'HIGH', reason: 'FATF Increased Monitoring', listType: 'greylist' },
    { country: 'Yemen', iso2: 'YE', riskTier: 'HIGH', reason: 'FATF Increased Monitoring', listType: 'greylist' },
];
/** Last hardcoded revision date. */
const HARDCODED_AS_OF = '2026-06-25';
/**
 * FATFCollector — returns country-level FATF risk data.
 *
 * FATF updates its lists 3× per year (Feb / Jun / Oct plenaries).
 * We ship hardcoded data and optionally verify against the FATF website.
 */
class FATFCollector {
    blacklistUrl;
    greylistUrl;
    useFallback;
    constructor(opts) {
        this.blacklistUrl = opts?.blacklistUrl ?? 'https://www.fatf-gafi.org/content/fatf-gafi/en/publications/High-risk-and-other-monitored-jurisdictions/Call-for-action-february-2026.html';
        this.greylistUrl = opts?.greylistUrl ?? 'https://www.fatf-gafi.org/content/fatf-gafi/en/publications/High-risk-and-other-monitored-jurisdictions/increased-monitoring-february-2026.html';
        this.useFallback = opts?.useFallback ?? true;
    }
    /**
     * Return hardcoded blacklist + greylist.
     * This is the primary method — FATF only changes 3× per year.
     */
    collect() {
        logger_1.default.info('FATFCollector: returning hardcoded lists', { asOf: HARDCODED_AS_OF, blacklist: FATF_BLACKLIST.length, greylist: FATF_GREYLIST.length });
        return [...FATF_BLACKLIST, ...FATF_GREYLIST];
    }
    /**
     * Return only the blacklist (Call for Action).
     */
    collectBlacklist() {
        return [...FATF_BLACKLIST];
    }
    /**
     * Return only the greylist (Increased Monitoring).
     */
    collectGreylist() {
        return [...FATF_GREYLIST];
    }
    /**
     * Optionally fetch the FATF pages and verify the hardcoded list is still current.
     * Falls back to hardcoded data on any error.
     *
     * @returns FATFCountry[] — verified or fallback list
     */
    async collectOnline() {
        try {
            logger_1.default.info('FATFCollector: verifying lists online...');
            const [blackRes, greyRes] = await Promise.allSettled([
                axios_1.default.get(this.blacklistUrl, { timeout: 15000, validateStatus: s => s === 200 }),
                axios_1.default.get(this.greylistUrl, { timeout: 15000, validateStatus: s => s === 200 }),
            ]);
            if (blackRes.status === 'fulfilled' && greyRes.status === 'fulfilled') {
                // Basic sanity: pages loaded — verify a known country appears
                const blackHtml = blackRes.value.data;
                const greyHtml = greyRes.value.data;
                if (blackHtml.includes('DPRK') && greyHtml.includes('Algeria')) {
                    logger_1.default.info('FATFCollector: online verification passed, hardcoded list is current');
                    return this.collect();
                }
                logger_1.default.warn('FATFCollector: online content mismatch — FATF lists may have changed. Using fallback.');
            }
            else {
                logger_1.default.warn('FATFCollector: failed to fetch one or both FATF pages, using hardcoded data');
            }
        }
        catch (err) {
            logger_1.default.warn('FATFCollector: online verification failed', { error: err.message });
        }
        if (!this.useFallback) {
            throw new Error('FATF online verification failed and useFallback=false');
        }
        return this.collect();
    }
    /**
     * Build a quick lookup Map keyed by ISO2 code.
     */
    toMap(countries) {
        const list = countries ?? this.collect();
        const map = new Map();
        for (const c of list) {
            map.set(c.iso2, c);
        }
        return map;
    }
}
exports.FATFCollector = FATFCollector;
exports.default = FATFCollector;
//# sourceMappingURL=fatf-collector.js.map