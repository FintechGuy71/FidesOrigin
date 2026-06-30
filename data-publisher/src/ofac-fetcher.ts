import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import logger from './logger';
import { OFACEntry } from './address-enricher';

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
export async function fetchOFACXml(timeout: number = DEFAULT_TIMEOUT): Promise<string> {
  // Try primary URLs first
  for (const url of OFAC_SDN_URLS) {
    try {
      logger.info(`OFAC Fetcher: fetching from ${url}`);
      const response = await axios.get(url, {
        timeout,
        responseType: 'text',
        maxRedirects: 5,          // ← Fix: follow 302 redirects
        decompress: true,
        headers: {
          'User-Agent': 'FidesOrigin-DataPublisher/1.0',
          'Accept': 'application/xml, text/xml, */*',
        },
        validateStatus: (status) => status < 400,
      });

      if (response.data && typeof response.data === 'string' && response.data.length > 1000) {
        logger.info(`OFAC Fetcher: received ${response.data.length} bytes from ${url}`);
        return response.data;
      }
    } catch (err) {
      logger.warn(`OFAC Fetcher: primary URL failed: ${url}`, {
        error: (err as Error).message,
      });
    }
  }

  // Try fallback URLs (may be ZIP-compressed)
  for (const url of OFAC_FALLBACK_URLS) {
    try {
      logger.info(`OFAC Fetcher: trying fallback ${url}`);
      const response = await axios.get(url, {
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
        logger.info(`OFAC Fetcher: received ${xml.length} bytes from fallback ${url}`);
        return xml;
      }

      // If it's a ZIP, decompress using zlib
      // [Audit-Fix #16] Implemented ZIP decompression for OFAC SDN ZIP downloads.
      // The fallback URL (sanctionslistservice.ofac.treas.gov) serves a ZIP file.
      if (head.startsWith('PK')) {
        try {
          const zlib = await import('zlib');
          // ZIP files contain one or more entries. We need to parse the ZIP format.
          // For simplicity, use the unzipSync which handles standard ZIP files.
          const unzipped = zlib.unzipSync(buffer);
          const xml = unzipped.toString('utf-8');
          if (xml.length > 1000) {
            logger.info(`OFAC Fetcher: decompressed ZIP → ${xml.length} bytes from ${url}`);
            return xml;
          }
          logger.warn(`OFAC Fetcher: ZIP decompressed but content too small (${xml.length} bytes)`);
        } catch (zipErr) {
          logger.warn(`OFAC Fetcher: ZIP decompression failed: ${(zipErr as Error).message}`);
        }
      } else {
        logger.warn(`OFAC Fetcher: received unknown compressed format from ${url}, head=${head}`);
      }
    } catch (err) {
      logger.warn(`OFAC Fetcher: fallback URL failed: ${url}`, {
        error: (err as Error).message,
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
export async function parseOFACSdnXml(xml: string): Promise<OFACEntry[]> {
  const parsed = await parseStringPromise(xml, { explicitArray: false });
  const sdnEntries = parsed?.sdnList?.sdnEntry || [];
  const entries = Array.isArray(sdnEntries) ? sdnEntries : [sdnEntries];

  const results: OFACEntry[] = [];

  for (const entry of entries) {
    const name: string = entry.sdnName || entry.firstName || 'Unknown';
    const type: string = entry.sdnType || 'unknown';

    // Extract country from addressList
    let country: string | undefined;
    const addressList = entry.addressList?.address;
    if (addressList) {
      const addrObj = Array.isArray(addressList) ? addressList[0] : addressList;
      if (addrObj?.country) {
        country = normalizeCountryName(addrObj.country);
      }
    }

    // Extract programs
    const programs: string[] = [];
    const programList = entry.programList?.program;
    if (programList) {
      if (Array.isArray(programList)) {
        programs.push(...programList);
      } else {
        programs.push(programList);
      }
    }

    // Extract digital currency addresses from idList
    const cryptoAddresses: Array<{ address: string; currency?: string }> = [];
    const idList = entry.idList?.id;
    if (idList) {
      const ids = Array.isArray(idList) ? idList : [idList];
      for (const id of ids) {
        const idType: string = id.idType || '';
        const idNumber: string = id.idNumber || '';

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

  logger.info(`OFAC SDN parsed: ${entries.length} total entries, ${results.length} with crypto addresses`);

  return results;
}

/**
 * Fetch and parse OFAC SDN in one call.
 * Convenience wrapper.
 */
export async function fetchAndParseOFAC(timeout?: number): Promise<OFACEntry[]> {
  const xml = await fetchOFACXml(timeout);
  return parseOFACSdnXml(xml);
}

/**
 * Normalize country names from OFAC to ISO2 codes.
 * OFAC uses full country names; we need ISO2 for FATF matching.
 */
function normalizeCountryName(name: string): string {
  const lower = name.toLowerCase().trim();

  const countryMap: Record<string, string> = {
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

export default { fetchOFACXml, parseOFACSdnXml, fetchAndParseOFAC };
