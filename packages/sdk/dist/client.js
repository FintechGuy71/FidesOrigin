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
import { DEFAULT_API_CONFIG, API_ENDPOINTS, } from '@fidesorigin/shared';
import { FidesOriginError } from './error';
import { validateAddress, calculateBackoff, sleep, generateRequestId, sanitizeApiKey, deepMerge } from './utils';
export class FidesOriginClient {
    /** Client configuration */
    config;
    constructor(options = {}) {
        this.config = deepMerge({ ...DEFAULT_API_CONFIG, debug: false }, options);
        if (this.config.debug) {
            console.log('[FidesOriginClient] Initialized', {
                baseUrl: this.config.baseUrl,
                apiKey: sanitizeApiKey(this.config.apiKey || ''),
            });
        }
    }
    /**
     * Make an authenticated API request with retry logic
     *
     * @param endpoint - API endpoint path
     * @param options - Fetch options
     * @returns Parsed JSON response
     * @throws {FidesOriginError} On request failure
     */
    async request(endpoint, options = {}) {
        const url = `${this.config.baseUrl}${endpoint}`;
        const requestId = generateRequestId();
        const headers = {
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
            ...(options.headers || {}),
        };
        if (this.config.apiKey) {
            headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }
        const fetchOptions = {
            ...options,
            headers,
            signal: AbortSignal.timeout(this.config.timeout),
        };
        let lastError;
        for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
            try {
                if (this.config.debug) {
                    console.log(`[FidesOriginClient] Request ${requestId} attempt ${attempt + 1}`, {
                        method: options.method || 'GET',
                        url,
                    });
                }
                const response = await fetch(url, fetchOptions);
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new FidesOriginError(errorData.message || `HTTP ${response.status}: ${response.statusText}`, this.getErrorCode(response.status), {
                        requestId,
                        context: {
                            url,
                            method: options.method || 'GET',
                            status: response.status,
                            timestamp: new Date().toISOString(),
                        },
                    });
                }
                const data = await response.json();
                if (this.config.debug) {
                    console.log(`[FidesOriginClient] Response ${requestId} success`);
                }
                return data;
            }
            catch (error) {
                if (error instanceof FidesOriginError) {
                    lastError = error;
                }
                else if (error instanceof Error) {
                    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
                        lastError = FidesOriginError.fromTimeout({
                            url,
                            method: options.method || 'GET',
                        });
                    }
                    else {
                        lastError = FidesOriginError.fromNetworkError(error, {
                            url,
                            method: options.method || 'GET',
                        });
                    }
                }
                // Don't retry on client errors (except rate limiting)
                if (lastError && !lastError.isRetryable()) {
                    throw lastError;
                }
                // Don't retry after last attempt
                if (attempt >= this.config.maxRetries) {
                    throw lastError;
                }
                // Wait before retry
                const delay = lastError?.getRetryDelay(attempt, this.config.baseDelayMs, this.config.maxDelayMs) || calculateBackoff(attempt, this.config.baseDelayMs, this.config.maxDelayMs);
                if (this.config.debug) {
                    console.log(`[FidesOriginClient] Retrying ${requestId} after ${delay}ms`);
                }
                await sleep(delay);
            }
        }
        throw lastError || new FidesOriginError('Request failed after retries', 'UNKNOWN');
    }
    /**
     * Map HTTP status to error code
     */
    getErrorCode(status) {
        switch (status) {
            case 400:
                return 'INVALID_ADDRESS';
            case 401:
                return 'UNAUTHORIZED';
            case 404:
                return 'NOT_FOUND';
            case 429:
                return 'RATE_LIMITED';
            case 500:
            case 502:
            case 503:
            case 504:
                return 'SERVER_ERROR';
            default:
                return 'API_ERROR';
        }
    }
    // ========================================================================
    // Risk Assessment API
    // ========================================================================
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
    async checkAddress(address, chain) {
        validateAddress(address, chain);
        const response = await this.request(`${API_ENDPOINTS.risk.check}?address=${encodeURIComponent(address)}&chain=${chain}`);
        if (!response.success || !response.data) {
            throw new FidesOriginError(response.error?.message || 'Failed to check address risk', response.error?.code || 'API_ERROR');
        }
        return response.data;
    }
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
    async batchCheck(request) {
        // Validate all addresses
        request.addresses.forEach(({ address, chain }) => {
            validateAddress(address, chain);
        });
        const response = await this.request(API_ENDPOINTS.risk.batch, {
            method: 'POST',
            body: JSON.stringify(request),
        });
        if (!response.success || !response.data) {
            throw new FidesOriginError(response.error?.message || 'Failed to batch check addresses', response.error?.code || 'API_ERROR');
        }
        return response.data;
    }
    /**
     * Get risk profile for an address (cached/historical data)
     *
     * @param address - Blockchain address
     * @param chain - Blockchain network
     * @returns Risk profile
     */
    async getRiskProfile(address, chain) {
        validateAddress(address, chain);
        const response = await this.request(`${API_ENDPOINTS.risk.profile}?address=${encodeURIComponent(address)}&chain=${chain}`);
        if (!response.success || !response.data) {
            throw new FidesOriginError(response.error?.message || 'Failed to get risk profile', response.error?.code || 'API_ERROR');
        }
        return response.data;
    }
    // ========================================================================
    // Compliance API
    // ========================================================================
    /**
     * Run compliance checks for an address
     *
     * @param address - Blockchain address
     * @param chain - Blockchain network
     * @returns Array of compliance check results
     */
    async checkCompliance(address, chain) {
        validateAddress(address, chain);
        const response = await this.request(`${API_ENDPOINTS.compliance.check}?address=${encodeURIComponent(address)}&chain=${chain}`);
        if (!response.success || !response.data) {
            throw new FidesOriginError(response.error?.message || 'Failed to check compliance', response.error?.code || 'API_ERROR');
        }
        return response.data;
    }
    /**
     * Get all compliance policies
     *
     * @returns Array of policies
     */
    async getPolicies() {
        const response = await this.request(API_ENDPOINTS.compliance.policies);
        if (!response.success || !response.data) {
            throw new FidesOriginError(response.error?.message || 'Failed to get policies', response.error?.code || 'API_ERROR');
        }
        return response.data;
    }
    // ========================================================================
    // Utility Methods
    // ========================================================================
    /**
     * Check if the API is healthy and accessible
     *
     * @returns True if API is healthy
     */
    async healthCheck() {
        try {
            await this.request('/health');
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Get current SDK version
     *
     * @returns Version string
     */
    getVersion() {
        return '0.2.1';
    }
}
export default FidesOriginClient;
