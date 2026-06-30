import { OFACEntry } from './address-enricher';
/**
 * Fetch the raw OFAC SDN XML, following redirects and trying fallbacks.
 *
 * @returns The XML string
 */
export declare function fetchOFACXml(timeout?: number): Promise<string>;
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
export declare function parseOFACSdnXml(xml: string): Promise<OFACEntry[]>;
/**
 * Fetch and parse OFAC SDN in one call.
 * Convenience wrapper.
 */
export declare function fetchAndParseOFAC(timeout?: number): Promise<OFACEntry[]>;
declare const _default: {
    fetchOFACXml: typeof fetchOFACXml;
    parseOFACSdnXml: typeof parseOFACSdnXml;
    fetchAndParseOFAC: typeof fetchAndParseOFAC;
};
export default _default;
//# sourceMappingURL=ofac-fetcher.d.ts.map