export interface AddressBatch {
    addresses: string[];
    riskScores: number[];
    tiers: number[];
    sanctioned: boolean[];
    tags: string[][];
}
export interface SourceData {
    id: string;
    name: string;
    url: string;
    riskScore: number;
    tier: number;
    sanctioned: boolean;
    tag: string;
}
/**
 * Enriched address with country and entity metadata.
 * Enables FATF cross-matching: address → country → FATF tier.
 */
export interface EnrichedAddress {
    address: string;
    country: string;
    entityName: string;
    entityId: string;
    lastSeen?: string;
}
export interface SyncState {
    lastSync: string;
    lastIncrementalSync?: string;
    sources: Record<string, {
        count: number;
        addresses: string[];
        /** Enriched metadata keyed by address (for country association & FATF tiering) */
        enriched?: Record<string, {
            country: string;
            entityName: string;
            entityId: string;
        }>;
        /** Addresses that failed on-chain publication (will be retried on next sync) */
        failed?: string[];
        /** Last HTTP ETag for conditional GET (e.g. ScamSniffer) */
        lastEtag?: string;
    }>;
}
export interface FetchOptions {
    /** If true, try delta URL first; fall back to last_seen filtering on full FTM. */
    incremental?: boolean;
    /** Number of days to look back for last_seen filter (default: 7). */
    days?: number;
    /** If true, skip the delta URL and use last_seen filter directly on full FTM. */
    skipDelta?: boolean;
    /** If true, also retry previously failed addresses for this source. */
    retryFailed?: boolean;
}
export interface BatchSyncOptions {
    incremental?: boolean;
    days?: number;
    dryRun?: boolean;
    retryFailed?: boolean;
}
/**
 * Fetch OFAC SDN crypto addresses from OpenSanctions FTM JSON.
 *
 * Supports incremental mode:
 *   - `incremental: true` → first tries delta URL, then falls back to `last_seen` filter.
 *   - `days: N` → only include entities whose `last_seen` is within N days.
 *
 * Returns enriched addresses with country and owner entity metadata,
 * enabling FATF cross-matching (address → country → FATF tier).
 */
export declare function fetchOfacAddresses(options?: FetchOptions): Promise<EnrichedAddress[]>;
/**
 * Fetch ScamSniffer phishing addresses.
 * ScamSniffer does not provide country data; returns empty country.
 */
export declare function fetchScamSnifferAddresses(): Promise<EnrichedAddress[]>;
/**
 * Run a full or incremental delta sync of all data sources.
 *
 * @param options.incremental — if true, only fetch entities updated in the last N days
 * @param options.days — lookback window for incremental mode (default 7)
 * @param options.dryRun — override config dryRun
 */
export declare function runBatchSync(options?: BatchSyncOptions): Promise<{
    totalNew: number;
    published: number;
    failed: number;
    sources: Record<string, number>;
}>;
//# sourceMappingURL=batch-collector.d.ts.map