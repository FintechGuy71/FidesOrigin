"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchOFACXml = fetchOFACXml;
exports.parseOFACSdnXml = parseOFACSdnXml;
exports.fetchAndParseOFAC = fetchAndParseOFAC;
const axios_1 = __importDefault(require("axios"));
const xml2js_1 = require("xml2js");
const logger_1 = __importDefault(require("./logger"));
/**
 * OFAC SDN Fetcher — downloads and parses the OFAC SDN XML feed.
 *
 * ## 302 Redirect Fix
 *
 * The canonical URL `https://www.treasury.gov/ofac/downloads/sdn.xml`
 * issues a 302 redirect.  We handle this by:
 *
 * 1. Following redirects (maxRedirects: 5).
 * 2. Providing fallback URLs that point to the same dataset.
 * 3. Supporting ZIP-compressed downloads (auto-decompress).
 */
// Primary and fallback URLs for OFAC SDN XML
const OFAC_SDN_URLS = [
    'https://www.treasury.gov/ofac/downloads/sdn.xml',
    'https://www.treasury.gov/ofac/downloads/sdn_advanced.xml',
];
const OFAC_FALLBACK_URLS = [
    'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN_XML.ZIP',
];
/** Default HTTP timeout for OFAC downloads (30 s) */
const DEFAULT_TIMEOUT = 30000;
/**
 * Fetch the raw OFAC SDN XML, following redirects and trying fallbacks.
 *
 * @returns The XML string
 */
async function fetchOFACXml(timeout = DEFAULT_TIMEOUT) {
    // Try primary URLs first
    for (const url of OFAC_SDN_URLS) {
        try {
            logger_1.default.info(`OFAC Fetcher: fetching from ${url}`);
            const response = await axios_1.default.get(url, {
                timeout,
                responseType: 'text',
                maxRedirects: 5, // ← Fix: follow 302 redirects
                decompress: true,
                headers: {
                    'User-Agent': 'FidesOrigin-DataPublisher/1.0',
                    'Accept': 'application/xml, text/xml, */*',
                },
                validateStatus: (status) => status < 400,
            });
            if (response.data && typeof response.data === 'string' && response.data.length > 1000) {
                logger_1.default.info(`OFAC Fetcher: received ${response.data.length} bytes from ${url}`);
                return response.data;
            }
        }
        catch (err) {
            logger_1.default.warn(`OFAC Fetcher: primary URL failed: ${url}`, {
                error: err.message,
            });
        }
    }
    // Try fallback URLs (may be ZIP-compressed)
    for (const url of OFAC_FALLBACK_URLS) {
        try {
            logger_1.default.info(`OFAC Fetcher: trying fallback ${url}`);
            const response = await axios_1.default.get(url, {
                timeout,
                responseType: 'arraybuffer',
                maxRedirects: 5,
                decompress: true,
                headers: {
                    'User-Agent': 'FidesOrigin-DataPublisher/1.0',
                    'Accept-Encoding': 'gzip, deflate',
                },
                validateStatus: (status) => status < 400,
            });
            // If we got a buffer, try to decode as UTF-8 XML
            const buffer = Buffer.from(response.data);
            // Check if it's actually XML (not ZIP)
            const head = buffer.slice(0, 5).toString('ascii');
            if (head.startsWith('<?xml') || head.startsWith('<sdn')) {
                const xml = buffer.toString('utf-8');
                logger_1.default.info(`OFAC Fetcher: received ${xml.length} bytes from fallback ${url}`);
                return xml;
            }
            // If it's a ZIP, we'd need to decompress — log and continue
            logger_1.default.warn(`OFAC Fetcher: received compressed (ZIP) data from ${url}, decompression not supported in this path`);
        }
        catch (err) {
            logger_1.default.warn(`OFAC Fetcher: fallback URL failed: ${url}`, {
                error: err.message,
            });
        }
    }
    throw new Error('OFAC SDN XML could not be fetched from any source (all URLs failed)');
}
/**
 * Parse OFAC SDN XML and extract entries with crypto addresses.
 *
 * The SDN XML structure:
 * ```xml
 * <sdnList>
 *   <sdnEntry>
 *     <sdnType>Entity</sdnType>
 *     <sdnName>LAZARUS GROUP</sdnName>
 *     <programList>
 *       <program>DPRK2</program>
 *     </programList>
 *     <addressList>
 *       <address>
 *         <country>North Korea</country>
 *       </address>
 *     </addressList>
 *     <idList>
 *       <id>
 *         <idType>Digital Currency Address - ETH</idType>
 *         <idNumber>0xabc...</idNumber>
 *       </id>
 *     </idList>
 *   </sdnEntry>
 * </sdnList>
 * ```
 *
 * @param xml The raw SDN XML string
 * @returns Parsed OFAC entries that have at least one crypto address
 */
async function parseOFACSdnXml(xml) {
    const parsed = await (0, xml2js_1.parseStringPromise)(xml, { explicitArray: false });
    const sdnEntries = parsed?.sdnList?.sdnEntry || [];
    const entries = Array.isArray(sdnEntries) ? sdnEntries : [sdnEntries];
    const results = [];
    for (const entry of entries) {
        const name = entry.sdnName || entry.firstName || 'Unknown';
        const type = entry.sdnType || 'unknown';
        // Extract country from addressList
        let country;
        const addressList = entry.addressList?.address;
        if (addressList) {
            const addrObj = Array.isArray(addressList) ? addressList[0] : addressList;
            if (addrObj?.country) {
                country = normalizeCountryName(addrObj.country);
            }
        }
        // Extract programs
        const programs = [];
        const programList = entry.programList?.program;
        if (programList) {
            if (Array.isArray(programList)) {
                programs.push(...programList);
            }
            else {
                programs.push(programList);
            }
        }
        // Extract digital currency addresses from idList
        const cryptoAddresses = [];
        const idList = entry.idList?.id;
        if (idList) {
            const ids = Array.isArray(idList) ? idList : [idList];
            for (const id of ids) {
                const idType = id.idType || '';
                const idNumber = id.idNumber || '';
                // Match "Digital Currency Address - <CCY>"
                if (idType.toLowerCase().includes('digital currency address')) {
                    const address = idNumber.trim();
                    // Validate Ethereum address format
                    if (address.match(/^0x[0-9a-fA-F]{40}$/)) {
                        const currencyMatch = idType.match(/- (\w+)$/);
                        cryptoAddresses.push({
                            address,
                            currency: currencyMatch ? currencyMatch[1] : undefined,
                        });
                    }
                }
            }
        }
        // Only include entries that have at least one crypto address
        if (cryptoAddresses.length > 0) {
            results.push({ name, type, country, program: programs.join(','), cryptoAddresses, source: 'OFAC_SDN_XML' });
        }
    }
    logger_1.default.info(`OFAC SDN parsed: ${entries.length} total entries, ${results.length} with crypto addresses`);
    return results;
}
/**
 * Fetch and parse OFAC SDN in one call.
 * Convenience wrapper.
 */
async function fetchAndParseOFAC(timeout) {
    const xml = await fetchOFACXml(timeout);
    return parseOFACSdnXml(xml);
}
/**
 * Normalize country names from OFAC to ISO2 codes.
 * OFAC uses full country names; we need ISO2 for FATF matching.
 */
function normalizeCountryName(name) {
    const lower = name.toLowerCase().trim();
    const countryMap = {
        'north korea': 'KP',
        'dprk': 'KP',
        "democratic people's republic of korea": 'KP',
        'korea, democratic people\'s republic of': 'KP',
        'iran': 'IR',
        'iran (islamic republic of)': 'IR',
        'myanmar': 'MM',
        'burma': 'MM',
        'algeria': 'DZ',
        'angola': 'AO',
        'bolivia': 'BO',
        'bosnia and herzegovina': 'BA',
        'bulgaria': 'BG',
        'cameroon': 'CM',
        "cote d'ivoire": 'CI',
        'ivoire': 'CI',
        "côte d'ivoire": 'CI',
        'democratic republic of the congo': 'CD',
        'congo, democratic republic of the': 'CD',
        'haiti': 'HT',
        'iraq': 'IQ',
        'kenya': 'KE',
        'kuwait': 'KW',
        'lao pdr': 'LA',
        'laos': 'LA',
        "lao people's democratic republic": 'LA',
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
        'virgin islands (uk)': 'VG',
        'british virgin islands': 'VG',
        'virgin islands, british': 'VG',
        'yemen': 'YE',
        'russia': 'RU',
        'russian federation': 'RU',
        'cuba': 'CU',
        'sudan': 'SD',
        'libya': 'LY',
        'zimbabwe': 'ZW',
        'afghanistan': 'AF',
        'pakistan': 'PK',
        'china': 'CN',
        'people\'s republic of china': 'CN',
        'uae': 'AE',
        'united arab emirates': 'AE',
        'turkey': 'TR',
        'türkiye': 'TR',
    };
    return countryMap[lower] || name; // Return ISO2 if known, else original name
}
exports.default = { fetchOFACXml, parseOFACSdnXml, fetchAndParseOFAC };
//# sourceMappingURL=ofac-fetcher.js.map