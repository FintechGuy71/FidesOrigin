/**
 * FidesOriginClient - Core SDK client for risk assessment API
 *
 * Provides methods for checking address risk, batch processing,
 * compliance checks, and real-time WebSocket updates.
 *
 * @example
 * ```ts
 * const client = new FidesOriginClient({
 *   apiKey: 'your-api-key',
 *   baseUrl: 'https://api.fidesorigin.com'
 * });
 *
 * const risk = await client.checkAddress('0x...', 'ethereum');
 * console.log(risk.overallLevel); // 'low' | 'medium' | 'high' | 'critical'
 * ```
 */
import type { AddressRisk, Chain, SDKConfig, BatchRiskCheckRequest, BatchRiskCheckResponse, ComplianceCheck, Policy } from '@fidesorigin/shared';
export interface ClientOptions extends SDKConfig {
    /** Enable debug logging */
    debug?: boolean;
}
export declare class FidesOriginClient {
    /** Client configuration */
    readonly config: Required<ClientOptions>;
    constructor(options?: ClientOptions);
    /**
     * Make an authenticated API request with retry logic
     *
     * @param endpoint - API endpoint path
     * @param options - Fetch options
     * @returns Parsed JSON response
     * @throws {FidesOriginError} On request failure
     */
    private request;
    /**
     * Map HTTP status to error code
     */
    private getErrorCode;
    /**
     * Check risk for a single address
     *
     * @param address - Blockchain address to check
     * @param chain - Blockchain network
     * @returns Risk assessment result
     * @throws {FidesOriginError} On validation or API failure
     *
     * @example
     * ```ts
     * const risk = await client.checkAddress('0x...', 'ethereum');
     * console.log(risk.overallScore, risk.overallLevel);
     * ```
     */
    checkAddress(address: string, chain: Chain): Promise<AddressRisk>;
    /**
     * Check risk for multiple addresses in a single request
     *
     * @param request - Batch check request with addresses and chains
     * @returns Batch risk check response
     * @throws {FidesOriginError} On validation or API failure
     *
     * @example
     * ```ts
     * const result = await client.batchCheck({
     *   addresses: [
     *     { address: '0x...', chain: 'ethereum' },
     *     { address: '0x...', chain: 'polygon' },
     *   ]
     * });
     * ```
     */
    batchCheck(request: BatchRiskCheckRequest): Promise<BatchRiskCheckResponse>;
    /**
     * Get risk profile for an address (cached/historical data)
     *
     * @param address - Blockchain address
     * @param chain - Blockchain network
     * @returns Risk profile
     */
    getRiskProfile(address: string, chain: Chain): Promise<AddressRisk>;
    /**
     * Run compliance checks for an address
     *
     * @param address - Blockchain address
     * @param chain - Blockchain network
     * @returns Array of compliance check results
     */
    checkCompliance(address: string, chain: Chain): Promise<ComplianceCheck[]>;
    /**
     * Get all compliance policies
     *
     * @returns Array of policies
     */
    getPolicies(): Promise<Policy[]>;
    /**
     * Check if the API is healthy and accessible
     *
     * @returns True if API is healthy
     */
    healthCheck(): Promise<boolean>;
    /**
     * Get current SDK version
     *
     * @returns Version string
     */
    getVersion(): string;
}
export default FidesOriginClient;
