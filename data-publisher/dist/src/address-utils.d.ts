/**
 * Validate an Ethereum address format.
 * @param addr Raw address string
 * @param strict If true, also verify EIP-55 checksum
 * @returns true if valid
 */
export declare function isValidEthAddress(addr: string, strict?: boolean): boolean;
/**
 * Normalize an address to lowercase 0x format.
 * Returns undefined if the address is invalid.
 */
export declare function normalizeAddress(addr: string): string | undefined;
/**
 * Batch-normalize addresses, filtering out invalid ones.
 */
export declare function normalizeAddresses(addrs: string[]): string[];
/**
 * Convert a string to a bytes32 hex string compatible with Solidity.
 * Uses ethers.encodeBytes32String for short strings (< 32 bytes),
 * safely truncates longer strings at byte boundaries.
 */
export declare function stringToBytes32(str: string): string;
//# sourceMappingURL=address-utils.d.ts.map